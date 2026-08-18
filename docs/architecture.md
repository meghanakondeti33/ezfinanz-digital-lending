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
- **SQLAlchemy 2.x** — modern type-annotated ORM with declarative models
- **Alembic** — database migrations for reproducible schema versioning

### Database
- **PostgreSQL 18.x** — the only supported database (no SQLite fallback)

### Authentication (Phase 2)
- **JWT** tokens with secure password hashing (bcrypt)
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
                                            │ SQLAlchemy 2.x
                                            │
                                 ┌──────────▼───────────┐
                                 │                      │
                                 │    PostgreSQL 18     │
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

## 5. Database Choice & Rationale

**PostgreSQL** is the only supported database.

Reasons:
- **Production parity**: Avoids silent behavior divergences between SQLite in dev and Postgres in production (e.g. enum types, JSONB indexing, concurrency semantics).
- **Proper constraint enforcement**: Strict foreign keys, composite unique constraints, check constraints, and custom PostgreSQL ENUM types.
- **ACID transactions**: Ensures financial record integrity during multi-step updates (e.g. offer acceptance + term generation + audit log creation in a single transaction).
- **JSONB support**: Enables rich semi-structured audit trails and eligibility calculation rationale storage.
- **Numeric precision**: Native arbitrary-precision decimal support (`NUMERIC(p, s)`).

## 6. Why Modular Monolith

This is a modular monolith, **not microservices**.

Reasons:
- Single assessment deliverable — no orchestration or distributed tracing overhead.
- Modules (auth, kyc, eligibility, loan, admin) are separated cleanly by package boundaries (`app/models/`, `app/services/`, `app/api/`) but share the same database and transaction boundary.
- Clear module boundaries make future microservice extraction straightforward if needed.
- Dramatically simpler deployment, local setup, debugging, and automated testing.

## 7. Application State Machine

The loan application follows a strict state machine enforced by the backend.

```
SIGNUP → EMAIL_VERIFIED → PHONE_VERIFIED → KYC_SUBMITTED
→ KYC_VERIFIED → LOAN_DETAILS_SUBMITTED → ELIGIBILITY_CHECKED
→ OFFER_SELECTED → BANK_ACCOUNT_ADDED → DECLARATION_SIGNED
→ SELFIE_UPLOADED → SUBMITTED → UNDER_REVIEW
→ APPROVED / REJECTED → DISBURSED
```

Key principles:
- The backend owns the state. The frontend reads it.
- Transitions are validated server-side. Invalid transitions return `409 Conflict` errors.
- Each state defines which API endpoints and transitions are legal.
- Admin reviews can only be performed on applications in the `UNDER_REVIEW` state.

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
| **storage** | File storage abstraction (local filesystem now, S3-ready interface) |

---

## 9. Database Architecture (Phase 1)

### 9.1 Entity Overview (13 Tables)

| Table Name | Purpose | Key Attributes / Relationships |
|------------|---------|--------------------------------|
| `users` | Customer and admin identity | UUID PK, unique email, unique phone, password_hash, role (`CUSTOMER`/`ADMIN`), is_active |
| `user_verifications` | Email/phone verification state | FK→`users.id`, type (`EMAIL`/`PHONE`), status (`PENDING`/`VERIFIED`/`EXPIRED`/`FAILED`), otp_hash, attempt_count |
| `kyc_details` | KYC demographic info | FK→`users.id`, full_name, DOB, gender, address fields, id_type, sensitive id_number_hash, document_storage_key |
| `loan_applications` | Central domain entity | UUID PK, unique human-readable `application_number`, FK→`users.id`, `status` (state machine enum), Numeric financials |
| `eligibility_checks` | Historical eligibility evaluations | FK→`loan_applications.id`, Numeric score/dti_ratio, status (`ELIGIBLE`/`INELIGIBLE`/`MANUAL_REVIEW`), JSONB reasons |
| `loan_offers` | Pre-approved / calculated loan offers | FK→`loan_applications.id`, Numeric principal/interest_rate/processing_fee/gst, status (`GENERATED`/`SELECTED`/`EXPIRED`) |
| `loan_terms` | Selected repayment terms & schedule | FK→`loan_offers.id`, tenure_months, Numeric emi/total_interest/total_repayment/net_disbursement/irr |
| `bank_accounts` | Disbursement destination bank account | FK→`loan_applications.id`, holder name, account_number_hash, account_number_last4, ifsc, bank_name |
| `declarations` | Borrower legal agreements & terms acceptance | FK→`loan_applications.id`, accepted (bool), declaration_version, accepted_at, ip_address |
| `selfie_verifications` | Biometric / live photo verification | FK→`loan_applications.id`, storage_key (metadata only), type (`LIVE_PHOTO`), status, FK→`users.id` (reviewer) |
| `admin_reviews` | Credit officer approval decisions | FK→`loan_applications.id`, FK→`users.id` (admin_id), decision (`APPROVED`/`REJECTED`/`FURTHER_INFO`), remarks |
| `disbursements` | Loan payout records | FK→`loan_applications.id`, Numeric amount, status (`PENDING`/`INITIATED`/`SUCCESS`/`FAILED`), unique txn_reference |
| `audit_logs` | Immutable audit trail for all events | FK→`users.id` (actor_id nullable), FK→`loan_applications.id` (nullable), action, old_status, new_status, JSONB metadata |

### 9.2 Entity Relationship Diagram

```
User (1)
├── (1..*) UserVerification
├── (1..*) KYCDetail
└── (1..*) LoanApplication (Central)
            ├── (1..*) EligibilityCheck
            ├── (1..*) LoanOffer
            │           └── (1..*) LoanTerm
            ├── (1..*) BankAccount
            ├── (1..*) Declaration
            ├── (1..*) SelfieVerification ─── (0..1) User [reviewed_by]
            ├── (1..*) AdminReview ────────── (1) User [admin_id]
            ├── (1..*) Disbursement
            └── (1..*) AuditLog ───────────── (0..1) User [actor_id]
```

### 9.3 SQLAlchemy 2.x Architecture

The ORM utilizes modern SQLAlchemy 2.x patterns:
- Declarative models inheriting from `DeclarativeBase` with typed `Mapped[...]` and `mapped_column(...)`.
- UUIDs generated server/application-side as standard Python `uuid.UUID` mapping to PostgreSQL native `UUID`.
- Clean session lifecycle via FastAPI `Depends(get_db)` yielding pooled sessions.
- Explicit cascade definitions (`cascade="all, delete-orphan"`) on parent-child entity relationships.

### 9.4 Alembic Migration Strategy

- Migrations manage 100% of schema DDL — manual table creation is strictly prohibited.
- `alembic/env.py` dynamically loads the database connection string from application settings and imports all models to populate `target_metadata`.
- All migrations are bi-directional: `upgrade()` creates objects and `downgrade()` cleanly removes them in reverse topological order, including PostgreSQL custom ENUM types.

### 9.5 Architectural & Design Rationale

1. **UUID Primary Keys**: 
   - Eliminates enumeration attacks on customer loan applications.
   - Allows ID generation prior to database insert.
   - Avoids ID collision risks across distributed systems.

2. **Arbitrary-Precision Numerics for Financial Fields**:
   - `NUMERIC(15, 2)` for amounts (principal, EMI, processing fees, gst, repayments).
   - `NUMERIC(7, 4)` for rates/ratios (IRR, DTI ratio).
   - Floating-point arithmetic (`float`/`REAL`/`DOUBLE`) is strictly prohibited to prevent IEEE 754 precision loss in financial calculations.

3. **Storage Keys vs. Binary Data**:
   - Binary assets (KYC document scans, selfie photos) are never stored in the database.
   - Only secure storage references (`storage_key`) are saved, allowing storage backend migration (local disk to S3/Cloud Storage) without database schema changes.

4. **Sensitive Data Protection**:
   - Government identification numbers (PAN, Aadhaar) and bank account numbers are stored in hashed/protected representations (`id_number_hash`, `account_number_hash`).
   - Only non-sensitive display fragments (e.g. `account_number_last4`) are stored in plaintext for user interface rendering.
   - Passwords use `password_hash` with secure hashing algorithms.

5. **Immutable Audit Logging**:
   - The `audit_logs` table records every critical state mutation, administrative action, and transition with timestamp, actor reference, previous status, next status, and structured JSONB payload for compliance and dispute resolution.
