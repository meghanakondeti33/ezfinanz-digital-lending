# EZFINANZ — Architecture Document

## 1. Project Goal

EZFINANZ is a personal loan application platform built as a technical assessment. It implements the complete customer journey from signup through loan disbursement, with an admin panel for application review and approval.

The platform is designed to be production-minded: it enforces business rules server-side, treats the frontend as an untrusted client, and uses a proper state machine to govern application flow.

## 2. Technology Stack

### Frontend
- **React** with **TypeScript** — type-safe UI development
- **Vite** — fast build tooling with HMR
- **Tailwind CSS** — utility-first styling
- **React Router** — client-side routing
- **TanStack Query** — server state management and caching
- **React Hook Form + Zod** — form handling with schema validation

### Backend
- **Python** with **FastAPI** — high-performance async API framework
- **Pydantic** — request/response validation and serialization
- **SQLAlchemy** — ORM with declarative models
- **Alembic** — database migrations

### Database
- **PostgreSQL** — the only supported database (no SQLite fallback)

### Authentication
- **JWT** tokens with secure password hashing
- **Role-based access control** (Customer, Admin)

## 3. High-Level Architecture

```
┌─────────────────────┐          ┌──────────────────────┐
│                     │  REST    │                      │
│   React Frontend    │◄────────►│   FastAPI Backend     │
│   (Vite dev server) │  JSON    │   (Uvicorn)          │
│                     │          │                      │
└─────────────────────┘          └──────────┬───────────┘
                                            │
                                            │ SQLAlchemy
                                            │
                                 ┌──────────▼───────────┐
                                 │                      │
                                 │    PostgreSQL         │
                                 │                      │
                                 └──────────────────────┘
```

## 4. Frontend / Backend Separation

The frontend and backend are fully separate applications:

- **Frontend** runs on port `5173` (Vite dev server) and makes REST API calls.
- **Backend** runs on port `8000` (Uvicorn) and exposes a JSON API under `/api/v1`.
- CORS is configured per-environment to allow frontend→backend communication.
- The frontend **never** decides application state transitions. It requests them, and the backend validates and executes them.
- Authentication tokens (JWT) will be sent as HTTP headers.

## 5. Database Choice

**PostgreSQL** is the only supported database.

Reasons:
- Production parity — no SQLite-in-dev surprises
- Proper constraint enforcement (foreign keys, unique, check)
- ACID transactions for financial data integrity
- JSON/JSONB support for flexible metadata
- Proven at scale

## 6. Why Modular Monolith

This is a modular monolith, **not microservices**.

Reasons:
- Single assessment deliverable — no orchestration overhead
- Modules (auth, kyc, eligibility, loan, admin) are separated by package but share the same database and process
- Clear boundaries make future extraction possible if needed
- Dramatically simpler deployment, debugging, and testing

## 7. Application State Machine

The loan application follows a strict state machine enforced by the backend.

```
SIGNUP → EMAIL_VERIFIED → PHONE_VERIFIED → KYC_SUBMITTED
→ KYC_VERIFIED → LOAN_DETAILS → ELIGIBILITY_CHECKED
→ OFFER_SELECTED → BANK_ACCOUNT_ADDED → DECLARATION_SIGNED
→ SELFIE_UPLOADED → SUBMITTED → UNDER_REVIEW
→ APPROVED / REJECTED → DISBURSED
```

Key principles:
- The backend owns the state. The frontend reads it.
- Transitions are validated server-side. Invalid transitions return errors.
- Each state defines which API endpoints are available.
- The admin can only approve/reject applications in the `UNDER_REVIEW` state.

## 8. Planned Major Modules

| Module | Responsibility |
|--------|---------------|
| **auth** | Signup, login, JWT issuance, password hashing, role-based access |
| **verification** | Email OTP, phone OTP (simulated) |
| **kyc** | KYC document upload, verification (simulated) |
| **loan** | Loan details capture, eligibility check, EMI calculation, offer selection |
| **bank** | Bank account details, verification (simulated) |
| **declaration** | Terms acceptance, digital declaration |
| **selfie** | Photo/selfie upload, verification (simulated) |
| **application** | State machine, application lifecycle, status tracking |
| **admin** | Dashboard, application review, approve/reject, disbursement |
| **storage** | File storage abstraction (local now, S3-ready interface) |
