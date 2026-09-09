#!/bin/bash

# ==============================================================================
# MongoDB Docker Backup Script
# Target Server: 213.142.132.232
# Destination: /root/backups/ (or /root)
# ==============================================================================

set -e

# Configuration
CONTAINER_NAME="fiperde-mongodb"
BACKUP_DIR="/root/backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILENAME="mongo_backup_${TIMESTAMP}.archive.gz"
BACKUP_FILEPATH="${BACKUP_DIR}/${BACKUP_FILENAME}"

# Project directory on VPS
PROJECT_DIR="/root/fiperdebackend"
# Fallback to current script directory if not on VPS or path differs
if [ ! -d "$PROJECT_DIR" ]; then
    PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

ENV_FILE="${PROJECT_DIR}/.env"

# Load credentials from .env if available
if [ -f "$ENV_FILE" ]; then
    MONGO_ROOT_USERNAME=$(grep -E '^MONGO_ROOT_USERNAME=' "$ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'" | tr -d '\r')
    MONGO_ROOT_PASSWORD=$(grep -E '^MONGO_ROOT_PASSWORD=' "$ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'" | tr -d '\r')
fi

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo "=========================================="
echo " Starting MongoDB Backup: $(date)"
echo " Container: ${CONTAINER_NAME}"
echo " Destination: ${BACKUP_FILEPATH}"
echo "=========================================="

# Check if docker container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "[-] Error: Container '${CONTAINER_NAME}' is not running!"
    exit 1
fi

# Perform backup using mongodump with gzip compression and stream directly to host file
if [ -n "$MONGO_ROOT_USERNAME" ] && [ -n "$MONGO_ROOT_PASSWORD" ]; then
    echo "[*] Running mongodump with authentication..."
    docker exec "$CONTAINER_NAME" mongodump \
        --username "$MONGO_ROOT_USERNAME" \
        --password "$MONGO_ROOT_PASSWORD" \
        --authenticationDatabase admin \
        --archive \
        --gzip > "$BACKUP_FILEPATH"
else
    echo "[*] Running mongodump without credentials..."
    docker exec "$CONTAINER_NAME" mongodump \
        --archive \
        --gzip > "$BACKUP_FILEPATH"
fi

# Verify backup file creation and size
if [ -s "$BACKUP_FILEPATH" ]; then
    FILE_SIZE=$(du -h "$BACKUP_FILEPATH" | cut -f1)
    echo "[+] Backup successfully created!"
    echo "    File: ${BACKUP_FILEPATH}"
    echo "    Size: ${FILE_SIZE}"
else
    echo "[-] Backup failed or produced empty file."
    rm -f "$BACKUP_FILEPATH"
    exit 1
fi

# Optional: Keep only the last 30 days of backups (uncomment if desired)
# echo "[*] Cleaning up backups older than 30 days..."
# find "$BACKUP_DIR" -type f -name "mongo_backup_*.archive.gz" -mtime +30 -delete

echo "=========================================="
echo " Backup finished successfully: $(date)"
echo "=========================================="
