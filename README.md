# EZFINANZ — Personal Loan Application Platform

A production-minded personal loan application built with React, FastAPI, SQLAlchemy 2.x, Alembic, PostgreSQL 18, Argon2id, and JWT.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, React Router, TanStack Query, Axios |
| Backend | Python 3.11+, FastAPI, Pydantic, SQLAlchemy 2.x, Alembic, Argon2id (`argon2-cffi`), PyJWT |
| Database | PostgreSQL 18.x |
| Architecture | Modular Monolith with Server-Enforced State Machine & Deterministic Underwriting |

## Project Structure

```
EZFINANZ/
├── frontend/                  # React + TypeScript + Vite application
│   └── src/
│       ├── context/           # AuthContext (state & session management)
│       ├── components/        # ProtectedRoute
│       ├── pages/             # Landing, Login, Register, Dashboard, LoanApplicationForm
│       ├── types/             # loan.ts, user.ts
│       └── lib/               # api-client.ts, loans-api.ts
├── backend/                   # FastAPI application
│   ├── alembic/               # Alembic database migrations
│   │   └── versions/          # 0001_initial_schema.py, 0002_add_loan_application_fields.py
│   ├── app/
│   │   ├── api/               # health, auth, loans, test_rbac
│   │   ├── core/              # config, database, security, auth
│   │   ├── models/            # SQLAlchemy 2.x domain models (13 tables)
│   │   ├── schemas/           # auth, user, loan, eligibility, offer
│   │   ├── scripts/           # create_admin.py
│   │   └── services/          # auth_service.py, loan_service.py, financial_service.py, eligibility_service.py, offer_service.py
│   └── tests/                 # Comprehensive test suite (46 tests)
│       ├── test_auth.py
│       ├── test_database.py
│       ├── test_loans.py
│       ├── test_eligibility_and_offers.py
│       └── test_migrations.py
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
   Ensure `.env` contains:
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

5. **Start the Backend API Server**:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   - OpenAPI Documentation: `http://localhost:8000/docs`
   - Health Check: `http://localhost:8000/api/v1/health`

6. **Run Test Suite**:
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
   - Pages: `/` (Landing), `/login`, `/register`, `/dashboard`, `/loans/new`, `/loans/:id`

3. **Build for Production**:
   ```bash
   npm run build
   ```

---

## API Endpoints

### Health & Auth Endpoints
| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/health` | Public | System liveness probe |
| `POST` | `/api/v1/auth/register` | Public | Customer registration |
| `POST` | `/api/v1/auth/login` | Public | Authenticate and receive JWT access token |
| `GET` | `/api/v1/auth/me` | Authenticated | Retrieve current user profile |

### Loan & Eligibility Endpoints (Phase 3 & 4)
| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `POST` | `/api/v1/loans/applications` | Customer | Create loan application draft (`DRAFT`) |
| `GET` | `/api/v1/loans/applications` | Customer | List customer applications (newest first) |
| `GET` | `/api/v1/loans/applications/{id}` | Customer | Get application by ID (strict ownership) |
| `PATCH` | `/api/v1/loans/applications/{id}` | Customer | Update draft details (409 on submitted) |
| `POST` | `/api/v1/loans/applications/{id}/submit` | Customer | Validate completeness & submit application (`SUBMITTED`) |
| `POST` | `/api/v1/loans/applications/{id}/eligibility` | Customer | Run eligibility check & generate offers (`ELIGIBILITY_CHECKED`) |
| `GET` | `/api/v1/loans/applications/{id}/offers` | Customer | List available loan offer packages with terms |
| `POST` | `/api/v1/loans/applications/{id}/offers/{offer_id}/select` | Customer | Select offer & lock terms (`OFFER_SELECTED`) |

### Verification Pipeline Endpoints (Phase 5)
| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `POST` | `/api/v1/loans/applications/{id}/kyc` | Customer | Submit & verify KYC details (ID masked in response) |
| `GET` | `/api/v1/loans/applications/{id}/kyc` | Customer | Retrieve KYC profile with masked ID (`XXXX-XXXX-1234`) |
| `POST` | `/api/v1/loans/applications/{id}/bank-account` | Customer | Submit & verify destination bank account |
| `GET` | `/api/v1/loans/applications/{id}/bank-account` | Customer | Retrieve bank details with masked account (`XXXXXX1234`) |
| `POST` | `/api/v1/loans/applications/{id}/selfie` | Customer | Submit live photo / selfie reference |
| `GET` | `/api/v1/loans/applications/{id}/selfie` | Customer | Retrieve selfie verification status |
| `POST` | `/api/v1/loans/applications/{id}/declaration` | Customer | Accept loan declaration terms (records IP & timestamp) |
| `GET` | `/api/v1/loans/applications/{id}/declaration` | Customer | Retrieve declaration status |
| `GET` | `/api/v1/loans/applications/{id}/verification` | Customer | Consolidated verification progress summary |

---

## Manual Demo Flow

1. Register or login as a customer (`/register` or `/login`).
2. Open Dashboard (`/dashboard`) and click **"Apply for Personal Loan"**.
3. Fill in loan parameters (Amount: `₹5,00,000`, Income: `₹60,000`, Debt: `₹10,000`, Tenure: `36 Months`).
4. Click **"Submit Application"** -> Status updates to `SUBMITTED`.
5. Click **"Check Loan Eligibility"**:
   - The engine evaluates DTI (16.7%), income sufficiency, and internal eligibility score (99/100).
   - Generates structured, explainable decision rationale.
6. Review the 3 generated loan packages:
   - **Standard Plan**: 12.5% p.a., 36 months, EMI ₹16,727
   - **Low Monthly EMI Plan**: 13.5% p.a., 48 months, EMI ₹13,538
   - **Fast Payoff Plan**: 11.5% p.a., 24 months, EMI ₹23,420
7. Click **"Select This Offer"** on your preferred plan -> Status transitions to `OFFER_SELECTED`.
8. Complete the **Verification Pipeline**:
   - **Step 1 (KYC)**: Submit identity details -> Verified with masked ID (`XXXX-XXXX-1234`).
   - **Step 2 (Bank Account)**: Submit banking details -> Verified with masked account (`XXXXXX1234`).
   - **Step 3 (Live Selfie)**: Submit simulated liveness photo -> Verified.
   - **Step 4 (Declaration)**: Check "I agree" and accept legal declaration terms -> Timestamp recorded.
9. Verification status reaches `COMPLETED` and application transitions to `UNDER_REVIEW` (ready for admin review).
10. Refresh browser -> All verification steps and application status persist from PostgreSQL.

---

## Documentation

- [Architecture Document](docs/architecture.md) — Comprehensive technical specification, ER diagram, Argon2id & JWT architecture, RBAC model, state machine, underwriting rules, and financial calculation formulas.
