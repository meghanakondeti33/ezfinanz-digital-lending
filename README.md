# EZFINANZ — Personal Loan Application Platform

A production-minded personal loan application built with React, FastAPI, SQLAlchemy 2.x, Alembic, PostgreSQL 18, Argon2id, and JWT.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, React Router, TanStack Query, Axios |
| Backend | Python 3.11+, FastAPI, Pydantic, SQLAlchemy 2.x, Alembic, Argon2id (`argon2-cffi`), PyJWT |
| Database | PostgreSQL 18.x |
| Architecture | Modular Monolith with Server-Enforced RBAC & State Machine |

## Project Structure

```
EZFINANZ/
├── frontend/                  # React + TypeScript + Vite application
│   └── src/
│       ├── context/           # AuthContext (state & session management)
│       ├── components/        # ProtectedRoute
│       ├── pages/             # Landing, Login, Register, Dashboard
│       └── lib/               # api-client.ts (Bearer token interceptor)
├── backend/                   # FastAPI application
│   ├── alembic/               # Alembic database migrations
│   ├── app/
│   │   ├── api/               # API routers (health, auth, customer/admin test)
│   │   ├── core/              # Config, database engine, security (Argon2id/JWT), auth (RBAC)
│   │   ├── models/            # SQLAlchemy 2.x domain models (13 tables)
│   │   ├── schemas/           # Pydantic schemas (auth, user)
│   │   ├── scripts/           # create_admin.py (Admin CLI tool)
│   │   └── services/          # auth_service.py
│   └── tests/                 # Comprehensive test suite (27 tests)
├── docs/                      # Architecture & design documentation
│   └── architecture.md
├── .gitignore
└── README.md
```

## Development Setup

### Prerequisites

- Python 3.11+
- Node.js 20+
- PostgreSQL 18.x (running locally on port 5432 with database `ezfinanz`)

---

### Backend Setup

1. **Activate Virtual Environment**:
   ```bash
   cd backend
   # Windows:
   .venv\Scripts\activate
   # Linux/macOS:
   source .venv/bin/activate
   ```

2. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure Environment Variables**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set your credentials:
   ```ini
   DATABASE_URL=postgresql+psycopg2://postgres:YOUR_PASSWORD@localhost:5432/ezfinanz
   JWT_SECRET_KEY=your-secure-random-secret-key
   JWT_ALGORITHM=HS256
   JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
   ```

4. **Run Database Migrations**:
   ```bash
   alembic upgrade head
   ```

5. **Create an Administrator Account**:
   ```bash
   python -m app.scripts.create_admin
   ```
   *(Prompts securely for email, phone, and password with masking)*

6. **Start the Backend API Server**:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   - OpenAPI Documentation: `http://localhost:8000/docs`
   - Health Check: `http://localhost:8000/api/v1/health`

7. **Run Test Suite**:
   ```bash
   pytest tests/ -v
   ```

---

### Frontend Setup

1. **Install Dependencies**:
   ```bash
   cd frontend
   npm install
   ```

2. **Start Frontend Dev Server**:
   ```bash
   npm run dev
   ```
   - App URL: `http://localhost:5173`
   - Pages: `/` (Landing), `/login`, `/register`, `/dashboard` (Protected)

3. **Build for Production**:
   ```bash
   npm run build
   ```

---

## Authentication & RBAC Endpoints

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/health` | Public | System liveness probe |
| `POST` | `/api/v1/auth/register` | Public | Customer registration (strictly role `CUSTOMER`) |
| `POST` | `/api/v1/auth/login` | Public | Authenticate and receive JWT access token |
| `GET` | `/api/v1/auth/me` | Authenticated | Retrieve current user profile (excludes password_hash) |
| `GET` | `/api/v1/customer/test` | Customer Only | Test endpoint requiring `CUSTOMER` role |
| `GET` | `/api/v1/admin/test` | Admin Only | Test endpoint requiring `ADMIN` role |

---

## Documentation

- [Architecture Document](docs/architecture.md) — Comprehensive technical specification, ER diagram, Argon2id & JWT architecture, RBAC model, and security rationales.

## License

This project is part of a technical assessment and is not licensed for public use.
