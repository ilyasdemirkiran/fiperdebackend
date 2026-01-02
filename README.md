# Fiperde Backend

Bun.js backend API for Fiperde customer management with Firebase authentication, MongoDB database, and Docker deployment.

## Features

- 🔥 **Firebase Authentication** - Secure token-based authentication
- 🗄️ **MongoDB Database** - NoSQL database with multi-tenancy support
- 🐳 **Docker Ready** - Containerized deployment with Docker Compose
- 🔒 **Secure** - MongoDB not exposed externally, non-root Docker user
- 📊 **Customer CRUD** - Complete customer management API
- ✅ **Validation** - Request validation with Zod schemas
- 📝 **Logging** - Structured logging for production and development

## Prerequisites

- [Bun](https://bun.sh) v1.0+ (for local development)
- [Docker](https://www.docker.com/) and Docker Compose (for deployment)
- Firebase project with Admin SDK credentials
- VDS or server for deployment

## Quick Start

### 1. Clone and Install

```bash
cd /path/to/fiperdebackend
bun install
```

### 2. Configure Environment

Create `.env` file from template:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
PORT=3000
NODE_ENV=production
MONGODB_URI=mongodb://mongodb:27017/fiperde
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
```

### 3. Add Firebase Service Account

Download your Firebase service account JSON from Firebase Console and save it as `firebase-service-account.json` in the project root.

**Important:** This file contains sensitive credentials. Never commit it to Git.

### 4. Run with Docker

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop services
docker-compose down
```

The API will be available at `http://localhost:3000`

### 5. Local Development (without Docker)

For local development, you'll need a MongoDB instance:

```bash
# Start MongoDB locally (if installed)
mongod --dbpath ./data/db

# Update .env to point to local MongoDB
MONGODB_URI=mongodb://localhost:27017/fiperde

# Run development server
bun run dev
```

## API Documentation

### Authentication

All API endpoints (except `/health`) require Firebase authentication. Include the Firebase ID token in the `Authorization` header:

```
Authorization: Bearer <firebase-id-token>
```

The backend extracts `userId` and `companyId` from the token's custom claims.

### Endpoints

#### Health Check

```http
GET /health
```

Response:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2026-01-02T12:00:00.000Z",
    "version": "1.0.0"
  }
}
```

#### List Customers

```http
GET /api/customers?page=1&limit=20&status=active&search=john
```

Query Parameters:
- `page` (optional): Page number, default 1
- `limit` (optional): Items per page, default 20, max 100
- `status` (optional): Filter by status (`active` or `inactive`)
- `search` (optional): Search by name or surname

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "companyId": "company-id",
      "status": "active",
      "name": "John",
      "surname": "Doe",
      "phone": "+905551234567",
      "city": "Istanbul",
      "district": "Kadıköy",
      "address": "Example address",
      "imageCount": 0,
      "createdAt": "2026-01-02T12:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

#### Get Customer by ID

```http
GET /api/customers/:id
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "companyId": "company-id",
    "status": "active",
    "name": "John",
    "surname": "Doe",
    "phone": "+905551234567",
    "city": "Istanbul",
    "district": "Kadıköy",
    "address": "Example address",
    "imageCount": 0,
    "createdAt": "2026-01-02T12:00:00.000Z"
  }
}
```

#### Create Customer

```http
POST /api/customers
Content-Type: application/json
```

Request Body:
```json
{
  "name": "John",
  "surname": "Doe",
  "phone": "+905551234567",
  "city": "Istanbul",
  "district": "Kadıköy",
  "address": "Example address",
  "status": "active"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "generated-uuid",
    "companyId": "company-id",
    "status": "active",
    "name": "John",
    "surname": "Doe",
    "phone": "+905551234567",
    "city": "Istanbul",
    "district": "Kadıköy",
    "address": "Example address",
    "imageCount": 0,
    "createdAt": "2026-01-02T12:00:00.000Z"
  }
}
```

#### Update Customer

```http
PUT /api/customers/:id
Content-Type: application/json
```

Request Body (all fields optional):
```json
{
  "name": "Jane",
  "surname": "Smith",
  "phone": "+905559876543",
  "city": "Ankara",
  "district": "Çankaya",
  "address": "New address",
  "status": "inactive"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "companyId": "company-id",
    "status": "inactive",
    "name": "Jane",
    "surname": "Smith",
    "phone": "+905559876543",
    "city": "Ankara",
    "district": "Çankaya",
    "address": "New address",
    "imageCount": 0,
    "createdAt": "2026-01-02T12:00:00.000Z",
    "updatedAt": "2026-01-02T13:00:00.000Z"
  }
}
```

#### Delete Customer

```http
DELETE /api/customers/:id
```

Response:
```json
{
  "success": true,
  "data": {
    "message": "Customer deleted successfully"
  }
}
```

### Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "details": {}
  }
}
```

Common error codes:
- `AUTH_ERROR` - Authentication failed (401)
- `VALIDATION_ERROR` - Request validation failed (400)
- `CUSTOMER_NOT_FOUND` - Customer not found (404)
- `INTERNAL_ERROR` - Server error (500)

## Multi-Tenancy

The backend supports multi-tenancy through `companyId`:

1. Each authenticated user's Firebase token must contain a `companyId` custom claim
2. All customer operations are automatically scoped to the user's company
3. Users can only access customers belonging to their company

### Setting Firebase Custom Claims

In your Firebase Admin SDK (e.g., in your frontend auth flow):

```javascript
await admin.auth().setCustomUserClaims(userId, {
  companyId: 'company-123',
  role: 'admin'
});
```

## Database

### MongoDB Collections

**customers**
- Indexed by: `companyId`, `companyId + id`, `companyId + status`, `companyId + createdAt`
- Multi-tenant with automatic company scoping

### Security

- MongoDB is **NOT exposed** to external networks
- Only accessible within Docker network
- Backend communicates with MongoDB via internal Docker DNS

## Deployment

### VDS Deployment

1. **Install Docker on your VDS:**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

2. **Clone repository:**
```bash
git clone <your-repo-url>
cd fiperdebackend
```

3. **Configure environment:**
```bash
cp .env.example .env
nano .env  # Edit with your settings
```

4. **Add Firebase credentials:**
```bash
# Upload your firebase-service-account.json to the server
scp firebase-service-account.json user@your-vds:/path/to/fiperdebackend/
```

5. **Start services:**
```bash
docker-compose up -d
```

6. **Verify deployment:**
```bash
curl http://localhost:3000/health
```

### Production Considerations

- Use a reverse proxy (nginx/Caddy) for HTTPS
- Set up firewall rules (only expose necessary ports)
- Configure log rotation
- Set up monitoring and alerts
- Regular database backups

## Development

### Project Structure

```
fiperdebackend/
├── models/              # Shared TypeScript models (from frontend)
├── src/
│   ├── config/         # Configuration (env, firebase, database)
│   ├── middleware/     # Authentication and error handling
│   ├── repositories/   # Database access layer
│   ├── routes/         # API route handlers
│   ├── services/       # Business logic
│   ├── types/          # TypeScript types
│   ├── utils/          # Utilities (logger, response)
│   └── index.ts        # Application entry point
├── Dockerfile
├── docker-compose.yml
└── package.json
```

### Scripts

```bash
# Development with hot reload
bun run dev

# Production
bun run start

# Docker commands
bun run docker:build    # Build Docker image
bun run docker:up       # Start containers
bun run docker:down     # Stop containers
bun run docker:logs     # View logs
```

## License

Private - All rights reserved
