#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# MongoDB Auth Migration Script (Replica Set Uyumlu)
# Mevcut verileri koruyarak authentication ekler.
# Replica Set: Production → rs0, Test → rs0-test
#
# Kullanım:
#   1. Mevcut container'lar çalışıyor olmalı (auth'suz eski config ile)
#   2. Bu scripti çalıştır: bash scripts/migrate-mongo-auth.sh
#   3. Script başarılı olunca yeni docker-compose.yml ile restart et:
#      docker-compose down && docker-compose up -d
# ─────────────────────────────────────────────────────────────────

set -euo pipefail

# .env dosyasından credential'ları oku
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ .env dosyası bulunamadı: $ENV_FILE"
    exit 1
fi

# .env'den değişkenleri parse et
MONGO_USER=$(grep '^MONGO_ROOT_USERNAME=' "$ENV_FILE" | cut -d '=' -f2-)
MONGO_PASS=$(grep '^MONGO_ROOT_PASSWORD=' "$ENV_FILE" | cut -d '=' -f2-)

if [ -z "$MONGO_USER" ] || [ -z "$MONGO_PASS" ]; then
    echo "❌ .env dosyasında MONGO_ROOT_USERNAME veya MONGO_ROOT_PASSWORD bulunamadı"
    exit 1
fi

echo "🔐 MongoDB Auth Migration (Replica Set Uyumlu)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ─── Yardımcı fonksiyon: Primary hazır olana kadar bekle ───
wait_for_primary() {
    local container=$1
    local rs_name=$2
    local max_retries=30
    local retry=0

    echo "   ⏳ Replica set '$rs_name' primary bekleniyor ($container)..."
    while [ $retry -lt $max_retries ]; do
        # Primary olup olmadığını kontrol et
        local is_primary
        is_primary=$(docker exec "$container" mongosh --quiet --eval "
            try {
                const status = rs.status();
                const primary = status.members.find(m => m.stateStr === 'PRIMARY');
                if (primary) { print('YES'); } else { print('NO'); }
            } catch(e) { print('NO'); }
        " 2>/dev/null || echo "NO")

        if echo "$is_primary" | grep -q "YES"; then
            echo "   ✅ Primary hazır."
            return 0
        fi

        retry=$((retry + 1))
        sleep 2
    done

    echo "   ❌ Primary $max_retries deneme sonrası bulunamadı!"
    return 1
}

# ─── Yardımcı fonksiyon: RS'yi başlat (henüz initiate edilmediyse) ───
ensure_rs_initiated() {
    local container=$1
    local rs_name=$2
    local host=$3

    echo "   🔄 Replica set '$rs_name' durumu kontrol ediliyor..."
    docker exec "$container" mongosh --quiet --eval "
        try {
            const status = rs.status();
            print('ℹ️  Replica set zaten aktif: ' + status.set);
        } catch(e) {
            print('⚠️  Replica set henüz başlatılmamış, initiate ediliyor...');
            rs.initiate({
                _id: '${rs_name}',
                members: [{ _id: 0, host: '${host}:27017' }]
            });
            print('✅ Replica set başlatıldı.');
        }
    " 2>&1
}

# ─── Adım 1: Production MongoDB yedeğini al ───
echo "📦 Adım 1/4: MongoDB yedeği alınıyor..."
BACKUP_DIR="/tmp/mongo-backup-$(date +%Y%m%d_%H%M%S)"

# Replica set üzerinden tutarlı snapshot almak için --oplog kullan
docker exec fiperde-mongodb mongodump \
    --host "mongodb:27017" \
    --oplog \
    --out /tmp/backup 2>&1 || {
    # oplog desteklenmiyorsa (henüz RS yoksa) opsuz dene
    echo "   ⚠️  --oplog başarısız, oplog'suz deneniyor..."
    docker exec fiperde-mongodb mongodump --out /tmp/backup 2>&1
}

docker cp fiperde-mongodb:/tmp/backup "$BACKUP_DIR"
docker exec fiperde-mongodb rm -rf /tmp/backup
echo "   ✅ Yedek alındı: $BACKUP_DIR"
echo ""

# ─── Adım 2: Production RS'yi başlat ve primary bekle ───
echo "🔗 Adım 2/4: Production Replica Set hazırlanıyor..."
ensure_rs_initiated "fiperde-mongodb" "rs0" "mongodb"
wait_for_primary "fiperde-mongodb" "rs0"
echo ""

# ─── Adım 3: Production MongoDB'ye admin user ekle ───
echo "👤 Adım 3/4: Production MongoDB'ye admin kullanıcı ekleniyor..."
docker exec fiperde-mongodb mongosh --quiet --eval "
    // Primary'de olduğumuzdan emin ol
    while (!db.hello().isWritablePrimary) {
        print('⏳ Primary olana kadar bekleniyor...');
        sleep(1000);
    }

    const adminDb = db.getSiblingDB('admin');
    const existingUser = adminDb.getUser('${MONGO_USER}');
    if (existingUser) {
        print('⚠️  Kullanıcı zaten mevcut, atlanıyor.');
    } else {
        adminDb.createUser({
            user: '${MONGO_USER}',
            pwd: '${MONGO_PASS}',
            roles: [{ role: 'root', db: 'admin' }]
        });
        print('✅ Admin kullanıcı oluşturuldu.');
    }
"
echo ""

# ─── Adım 4: Test MongoDB'ye admin user ekle ───
echo "👤 Adım 4/4: Test MongoDB'ye admin kullanıcı ekleniyor..."

# Test RS'yi de başlat
ensure_rs_initiated "fiperde-mongodb-test" "rs0-test" "mongodb-test"
wait_for_primary "fiperde-mongodb-test" "rs0-test"

docker exec fiperde-mongodb-test mongosh --quiet --eval "
    while (!db.hello().isWritablePrimary) {
        print('⏳ Primary olana kadar bekleniyor...');
        sleep(1000);
    }

    const adminDb = db.getSiblingDB('admin');
    const existingUser = adminDb.getUser('${MONGO_USER}');
    if (existingUser) {
        print('⚠️  Kullanıcı zaten mevcut, atlanıyor.');
    } else {
        adminDb.createUser({
            user: '${MONGO_USER}',
            pwd: '${MONGO_PASS}',
            roles: [{ role: 'root', db: 'admin' }]
        });
        print('✅ Admin kullanıcı oluşturuldu.');
    }
"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Migration tamamlandı!"
echo ""
echo "Şimdi yeni config ile restart edin:"
echo "  docker-compose down && docker-compose up -d"
echo ""
echo "Doğrulama:"
echo "  # Auth olmadan bağlantı reddedilmeli:"
echo "  docker exec fiperde-mongodb mongosh --eval \"db.adminCommand('ping')\""
echo ""
echo "  # Auth ile bağlantı başarılı olmalı:"
echo "  docker exec fiperde-mongodb mongosh -u '$MONGO_USER' -p '<password>' --authenticationDatabase admin --eval \"db.adminCommand('ping')\""
echo ""
echo "  # Replica set durumu:"
echo "  docker exec fiperde-mongodb mongosh -u '$MONGO_USER' -p '<password>' --authenticationDatabase admin --eval \"rs.status()\""
echo ""
echo "Yedek konumu: $BACKUP_DIR"
