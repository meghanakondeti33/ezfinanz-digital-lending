# EZFINANZ — Personal Loan Application Platform

A production-minded personal loan application built with React, FastAPI, and PostgreSQL.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query |
| Backend | Python, FastAPI, Pydantic, SQLAlchemy, Alembic |
| Database | PostgreSQL |
| Auth | JWT, bcrypt, role-based access control |

## Project Structure

```
EZFINANZ/
├── frontend/          # React + Vite application
├── backend/           # FastAPI application
├── docs/              # Architecture & design documentation
├── .gitignore
└── README.md
```

## Development Setup

### Prerequisites

- Python 3.11+
- Node.js 20+
- PostgreSQL 15+

### Backend

```bash
cd backend

# Copy environment config
cp .env.example .env
# Edit .env with your PostgreSQL credentials

# Install dependencies
pip install -r requirements.txt

# Start the dev server
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.
Interactive docs at `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend

# Copy environment config
cp .env.example .env

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The app will be available at `http://localhost:5173`.

## API Endpoints

### Health Check

```
GET /api/v1/health
```

Response:
```json
{
  "status": "ok"
}
```

## Documentation

- [Architecture](docs/architecture.md) — System design, tech choices, state machine concept

## License

This project is part of a technical assessment and is not licensed for public use.
