# FastTransfers API — Node.js + MongoDB

A RESTful backend for the FastTransfers document management tool, rewritten in **Node.js + Express** with **MongoDB** as the sole database (replacing ASP.NET Core + SQL Server).

---

## Architecture

```
fasttransfers-api/
├── src/
│   ├── server.js               ← Entry point (bootstrap + graceful shutdown)
│   ├── app.js                  ← Express app factory (CORS, body parsing, routes)
│   ├── config/
│   │   ├── db.js               ← MongoDB connections (main + file-content)
│   │   └── logger.js           ← Winston logger (console + file sinks)
│   ├── models/
│   │   └── index.js            ← All Mongoose schemas (User, Project, Folder,
│   │                              SchemaTemplate, AppFile)
│   ├── services/
│   │   ├── auth.service.js     ← JWT (HS256) + bcrypt password hashing
│   │   └── fileStorage.service.js  ← MongoDB file-content CRUD (storageKey = ObjectId)
│   ├── middleware/
│   │   ├── auth.js             ← Bearer JWT guard → req.userId
│   │   ├── errorHandler.js     ← Domain error classes + global Express error handler
│   │   └── validate.js         ← express-validator result checker
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── projects.controller.js
│   │   ├── folders.controller.js
│   │   ├── schema.controller.js
│   │   └── files.controller.js
│   └── routes/
│       └── index.js            ← All API routes mounted under /api
├── .env.example
├── Dockerfile
└── package.json
```

---

## Storage Design

| Data | Collection | DB |
|---|---|---|
| Users, Projects, Folders, Schemas, File metadata | `users`, `projects`, `folders`, `schematemplates`, `appfiles` | `fasttransfers` (main) |
| Raw HTML file content | `fileContents` | `FastTransfersFiles` (separate) |

The file content collection mirrors the spec's **MongoDB** storage provider. The `storageKey` field on every `AppFile` document is the MongoDB `ObjectId` string of the corresponding `fileContents` document.

---

## API Endpoints

All routes except `/api/auth/*` require `Authorization: Bearer <token>`.

```
GET    /api/health

POST   /api/auth/register          { name, email, password }
POST   /api/auth/login             { email, password }

GET    /api/projects
GET    /api/projects/:id
POST   /api/projects               { name }
PUT    /api/projects/:id           { name }
DELETE /api/projects/:id

GET    /api/projects/:projectId/folders
POST   /api/projects/:projectId/folders   { name }
PUT    /api/folders/:id            { name }
DELETE /api/folders/:id

GET    /api/folders/:folderId/schema
PUT    /api/folders/:folderId/schema      { schemaYaml, templateHtml, templateCss }

GET    /api/folders/:folderId/files
POST   /api/folders/:folderId/files       { name, content?, metadata? }
GET    /api/files/:id
PUT    /api/files/:id              { name?, content?, metadata? }
DELETE /api/files/:id
```

### Error responses

| Condition | HTTP |
|---|---|
| Validation failure | 422 + `{ message, errors: { field: msg } }` |
| Not found | 404 |
| Ownership violation | 403 |
| Duplicate (e.g. email) | 409 |
| Bad request | 400 |
| Server error | 500 |

---

## Setup

### 1. Install dependencies

```bash
cd fasttransfers-api
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your values
```

Key variables:

| Variable | Description |
|---|---|
| `MONGODB_URI` | Main DB connection string |
| `MONGODB_FILES_URI` | File-content DB (can be same URI) |
| `MONGODB_FILES_DB` | File-content DB name (default: `FastTransfersFiles`) |
| `MONGODB_FILES_COLLECTION` | Collection name (default: `fileContents`) |
| `JWT_SECRET` | ≥32-char random string |
| `JWT_EXPIRY_MINUTES` | Token TTL (default: 60) |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed origins |

### 3. Run

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

API is available at `http://localhost:5000/api`.

---

## Docker

```bash
# Build
docker build -t fasttransfers-api .

# Run
docker run -p 8080:8080 \
  -e MONGODB_URI="mongodb+srv://user:pass@cluster/fasttransfers" \
  -e MONGODB_FILES_URI="mongodb+srv://user:pass@cluster" \
  -e JWT_SECRET="your-32-char-secret-here" \
  -e CORS_ALLOWED_ORIGINS="https://your-frontend.com" \
  fasttransfers-api
```

---

## Frontend `.env`

```
REACT_APP_API_URL=http://localhost:5000
```

---

## Key design notes

- **No migrations needed** — Mongoose creates collections automatically on first write.
- **Cascade deletes** — deleting a project removes all its folders, schemas, files, and file content. Same for folder deletion.
- **Schema upsert** — `PUT /api/folders/:folderId/schema` creates the schema if it doesn't exist, or updates it if it does (matches the frontend's single `upsertSchema` thunk).
- **File content stored separately** — list endpoints (`GET /api/folders/:folderId/files`) never fetch content, keeping list responses fast. Content is only fetched when opening a single file (`GET /api/files/:id`).
- **Metadata** — `AppFile.metadata` is an embedded array of `{ key, value }` objects, equivalent to the `AppFileMetadata` table in the original SQL schema.
