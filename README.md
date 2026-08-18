# EZFINANZ — Personal Loan Application Platform

A production-minded personal loan application built with React, FastAPI, SQLAlchemy 2.x, Alembic, and PostgreSQL 18.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, React Router, TanStack Query, Axios |
| Backend | Python 3.11+, FastAPI, Pydantic, SQLAlchemy 2.x, Alembic |
| Database | PostgreSQL 18.x |
| Architecture | Modular Monolith with Backend-Enforced State Machine |

## Project Structure

```
EZFINANZ/
├── frontend/                  # React + Vite application
├── backend/                   # FastAPI application
│   ├── alembic/               # Alembic database migrations
│   │   └── versions/          # Migration version scripts
│   ├── app/
│   │   ├── api/               # API routes (health, etc.)
│   │   ├── core/              # Config, database engine, exceptions
│   │   └── models/            # SQLAlchemy 2.x domain models (13 tables)
│   └── tests/                 # Pytest test suite
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

1. **Activate / Create Virtual Environment**:
   ```bash
   cd backend
   python -m venv .venv
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
   Edit `.env` and set your local PostgreSQL credentials:
   ```ini
   DATABASE_URL=postgresql+psycopg2://postgres:YOUR_PASSWORD@localhost:5432/ezfinanz
   ```

4. **Run Database Migrations**:
   ```bash
   # Apply all migrations to latest version
   alembic upgrade head

   # Rollback one migration (if needed)
   alembic downgrade -1
   ```

5. **Start the Backend API Server**:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   - API Base: `http://localhost:8000`
   - OpenAPI Documentation: `http://localhost:8000/docs`
   - Health Check: `http://localhost:8000/api/v1/health`

6. **Run Backend Tests**:
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

2. **Configure Environment**:
   ```bash
   cp .env.example .env
   ```

3. **Start Frontend Dev Server**:
   ```bash
   npm run dev
   ```
   - App URL: `http://localhost:5173`

4. **Build for Production**:
   ```bash
   npm run build
   ```

---

## API Endpoints

### Health Check

```http
GET /api/v1/health
```

Response:
```json
{
  "status": "ok"
}
```

## Documentation

- [Architecture Document](docs/architecture.md) — System design, 13 database entities, ER diagram, state machine lifecycle, and security principles.

## License

This project is part of a technical assessment and is not licensed for public use.
