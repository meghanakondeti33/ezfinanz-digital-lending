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
- **Argon2id (`argon2-cffi`)** — memory-hard password hashing
- **PyJWT** — cryptographic JSON Web Token generation and validation

### Database
- **PostgreSQL 18.x** — the only supported database (no SQLite fallback)

### Authentication
- **Argon2id** password hashing
- **JWT** short-lived access tokens
- **Role-based access control** (`CUSTOMER`, `ADMIN`) enforced via FastAPI dependencies

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
- The frontend **never** decides application state transitions or user roles.
- Authentication tokens (JWT) are sent in the `Authorization: Bearer <token>` HTTP header.

## 5. Database Choice & Rationale

**PostgreSQL** is the only supported database.

Reasons:
- **Production parity**: Avoids silent behavior divergences between SQLite in dev and Postgres in production.
- **Proper constraint enforcement**: Strict foreign keys, composite unique constraints, check constraints, and custom PostgreSQL ENUM types.
- **ACID transactions**: Ensures financial record integrity during multi-step updates.
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

---

## 10. Authentication & Role-Based Access Control Architecture (Phase 2)

### 10.1 Authentication Flow

```
[ Customer Registration ]
  Email + Phone + Password
           ↓ (Pydantic validation & normalization)
  Check Uniqueness (409 Conflict if duplicate)
           ↓
  Argon2id Hashing
           ↓
  Save User (role = CUSTOMER, is_active = True)
           ↓
  Return Safe UserResponse (No password_hash)

[ Customer / Admin Login ]
  Email + Password
           ↓
  Query User by Email
           ↓
  Argon2id Verify (Generic 401 on failure)
           ↓
  Verify is_active (401 if deactivated)
           ↓
  Issue Signed JWT Access Token (sub=user.id, role=user.role, exp=30min)
           ↓
  Return TokenResponse (access_token, token_type, expires_in)
```

### 10.2 Password Hashing (Argon2id)
- Memory-hard **Argon2id** password hashing using `argon2-cffi`.
- Centralized password policy enforced across registration and CLI admin creation:
  - 8 to 128 characters
  - At least 1 uppercase letter
  - At least 1 lowercase letter
  - At least 1 digit
  - At least 1 special character
- Plaintext passwords and hashes are never logged, never returned in API models, and never included in JWT payloads.

### 10.3 JWT Architecture & Claims
- Signed using HMAC-SHA256 (`HS256`) with secret loaded from `JWT_SECRET_KEY` environment variable.
- Minimal payload:
  ```json
  {
    "sub": "414b4edf-0682-4135-94e4-2d388bcc7273",
    "role": "ADMIN",
    "iat": 1771334000,
    "exp": 1771335800
  }
  ```
- Short-lived default expiration: 30 minutes.

### 10.4 Role-Based Access Control (RBAC)
- Enforced server-side via FastAPI dependencies:
  - `get_current_user`: extracts bearer token, validates signature/expiration, verifies user exists and `is_active` in PostgreSQL.
  - `require_role(UserRole.ADMIN)` / `require_role(UserRole.CUSTOMER)`: verifies user role matches requirement; raises `403 Forbidden` if insufficient permissions.

| Endpoint | Authentication | Allowed Roles | Behavior for Unauthorized |
|---|---|---|---|
| `POST /api/v1/auth/register` | None (Public) | Anyone | N/A (Always creates `CUSTOMER`) |
| `POST /api/v1/auth/login` | None (Public) | Anyone | Generic 401 Unauthorized |
| `GET /api/v1/auth/me` | Bearer JWT | `CUSTOMER`, `ADMIN` | 401 Unauthorized |
| `GET /api/v1/customer/test` | Bearer JWT | `CUSTOMER` | 403 Forbidden if `ADMIN` |
| `GET /api/v1/admin/test` | Bearer JWT | `ADMIN` | 403 Forbidden if `CUSTOMER` |

### 10.5 Admin Creation Mechanism
- Public registration strictly forbids role specification.
- Administrators are created exclusively through the secure CLI utility:
  ```bash
  python -m app.scripts.create_admin
  ```
  Masks password input via `getpass` and validates all security constraints before database insertion.

### 10.6 Frontend Token Strategy & Security Trade-Offs
- Tokens stored in `localStorage` for assessment simplicity and injected into all outgoing Axios requests via request interceptor.
- **Security Trade-Off**: LocalStorage is vulnerable to XSS; in production, this should be paired with Content Security Policy (CSP) and transitioned to HttpOnly SameSite cookies with short-lived tokens and refresh rotation.
