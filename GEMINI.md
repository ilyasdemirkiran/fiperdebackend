# Fiperde Backend - Project Context & Guidelines

This file serves as a guide for Gemini CLI to maintain consistency and follow project-specific patterns.

## Project Overview
Fiperde Backend is a multi-tenant backend service built with **Bun**, **Hono**, and **MongoDB**. It uses **Firebase Admin SDK** for authentication and management.

## Tech Stack
- **Runtime**: Bun
- **Web Framework**: Hono
- **Language**: TypeScript
- **Database**: MongoDB (Native Driver)
- **Auth**: Firebase Admin
- **Validation**: Zod
- **Utilities**: `es-toolkit`, `date-fns`, `libphonenumber-js`, `axios`

## Core Architecture
The project follows a layered architecture:
1. **Routes (`src/routes/`)**: Define endpoints and handle basic request/response logic.
2. **Services (`src/services/`)**: Contain business logic, validation (Zod), and orchestration of repositories.
3. **Repositories (`src/repositories/`)**: Data access layer directly interacting with MongoDB.
4. **Types (`src/types/`)**: Centralized Zod schemas and TypeScript interfaces.

## Key Conventions

### 1. Naming & Structure
- **Files**: Use kebab-case for filenames (e.g., `customer-image.service.ts`).
- **Classes**: Use PascalCase (e.g., `CustomerService`).
- **Import Aliases**: Always use `@/` to refer to the `src/` directory.

### 2. Multi-tenancy
- Most data is partitioned by `companyId`.
- Repositories often receive `companyId` as the first argument to target the correct collection or filter data.
- Example: `getCustomersCollection(companyId)` in repositories.

### 3. Database Patterns
- Use the native MongoDB driver.
- Complex queries should prefer **Aggregation Pipelines** over multiple queries.
- Repositories should handle `ObjectId` conversions where necessary.
- Transactions are used for multi-collection operations (see `CustomerService.deleteCustomer`).

### 4. Error Handling & Validation
- **Errors**: Throw `AppError` (from `@/middleware/error-handler`) in services. It takes `(status, message, errorCode)`.
- **Validation**: Use Zod schemas from `src/types/` for input validation within services or routes.
- **Responses**: Use `successResponse` from `@/utils/response` for consistent API output.

### 5. Logging
- Use the custom logger from `@/utils/logger`.
- Levels: `info`, `error`, `warn`, `debug`, `request`, `response`.

## Development Commands
- **Start Dev**: `bun run dev` (watch mode)
- **Test**: `bun test`
- **Lint**: `bun run lint`
- **Type Check**: `bun run typecheck`

## Common Patterns

### Repository Template
```typescript
import { Collection, ObjectId } from "mongodb";
import { getSomeCollection } from "@/repositories/collections/core.collections";

export class SomeRepository {
  private getCollection(companyId: string): Collection<SomeType> {
    return getSomeCollection(companyId);
  }
  // ... methods
}
```

### Service Template
```typescript
import { AppError } from "@/middleware/error-handler";
import { someSchema } from "@/types/some/some";

export class SomeService {
  async someMethod(companyId: string, input: any) {
    const validated = someSchema.parse(input);
    // ... logic
  }
}
```

## Special Tools & Skills
- **Context7**: Use for up-to-date documentation on Hono, Zod, MongoDB, or Firebase Admin.
