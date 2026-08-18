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

---

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
| **loans** | Loan application lifecycle, draft creation, updates, submission, ownership |
| **eligibility** | Deterministic underwriting engine, DTI scoring, explainable decision rationale |
| **offers** | Reducing-balance EMI calculations, multi-tier offer generation, selection |
| **verification** | Email OTP, phone OTP (simulated) |
| **kyc** | KYC document upload, verification (simulated) |
| **bank** | Bank account details, verification (simulated) |
| **declaration** | Terms acceptance, digital declaration |
| **selfie** | Photo/selfie upload, verification (simulated) |
| **admin** | Dashboard, application review, approve/reject, disbursement |
| **storage** | File storage abstraction (local filesystem now, S3-ready interface) |

---

## 9. Database Architecture (Phase 1 & 3)

### 9.1 Entity Overview (13 Tables)

| Table Name | Purpose | Key Attributes / Relationships |
|------------|---------|--------------------------------|
| `users` | Customer and admin identity | UUID PK, unique email, unique phone, password_hash, role (`CUSTOMER`/`ADMIN`), is_active |
| `user_verifications` | Email/phone verification state | FK→`users.id`, type (`EMAIL`/`PHONE`), status (`PENDING`/`VERIFIED`/`EXPIRED`/`FAILED`), otp_hash, attempt_count |
| `kyc_details` | KYC demographic info | FK→`users.id`, full_name, DOB, gender, address fields, id_type, sensitive id_number_hash, document_storage_key |
| `loan_applications` | Central domain entity | UUID PK, unique human-readable `application_number`, FK→`users.id`, `status`, `purpose`, `requested_amount`, `monthly_income`, `employment_type`, `employer_name`, `existing_debt`, `requested_tenure_months`, `submitted_at` |
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

---

## 11. Core Loan Application Workflow & State Machine (Phase 3)

```
                    ┌─────────────────────────┐
                    │      CREATE DRAFT       │
                    │  POST /loans/applications│
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
        ┌──────────►│          DRAFT          │◄──────────┐
        │           │ (Editable & Resumeable) │           │
        │           └────────────┬────────────┘           │
        │                        │                        │
  PATCH (Update Draft)           │ POST /submit           │
        │                        │ (Completeness Check)   │
        └────────────────────────┘                        │
                                 │                        │
                                 ▼                        │
                    ┌─────────────────────────┐           │
                    │        SUBMITTED        │           │
                    │ (Immutable / Read-Only) │           │
                    └────────────┬────────────┘           │
                                 │                        │
                                 │ PATCH attempt          │
                                 ▼                        │
                         409 CONFLICT ────────────────────┘
```

---

## 12. Eligibility Engine, Explainability & Loan Offers (Phase 4)

### 12.1 Underwriting & Eligibility Rules
The engine evaluates loan applications deterministically using configurable underwriting guidelines:
- **Minimum Gross Monthly Income**: ₹25,000.00
- **Maximum Debt-to-Income (DTI) Ratio**: 50.00%
  $$\text{DTI} = \frac{\text{existing\_monthly\_debt}}{\text{monthly\_income}}$$
- **Maximum Loan-to-Income Multiplier**: 30.0x gross monthly income
- **Loan Amount Range**: ₹25,000.00 to ₹5,000,000.00
- **Tenure Range**: 6 to 60 months

### 12.2 Explainable Decision Generation
Rather than returning a black-box boolean, the engine computes:
1. **Internal Eligibility Score** (0–100 scale): A deterministic underwriting score based on DTI bands, income brackets, and employment stability. This is strictly an internal metric and NOT an external credit bureau score (no CIBIL/Experian integration in this phase).
2. **Structured Rationale List**: Transparent reasons explaining the evaluation (e.g. income verification, DTI compliance, affordability threshold, tenure approval).

### 12.3 Reducing-Balance Financial Mathematics
- **Monthly Interest Rate**: $r = \frac{\text{Annual Rate}}{1200}$
- **Reducing-Balance EMI**:
  $$\text{EMI} = \frac{P \times r \times (1+r)^n}{(1+r)^n - 1}$$
- **Total Interest Payable**: $\text{Total Repayment} - \text{Principal}$
- **Processing Fee & GST**: $\text{Fee} = P \times \text{fee}\%$, $\text{GST} = \text{Fee} \times 18\%$
- **Net Disbursement**: $\text{Principal} - (\text{Fee} + \text{GST})$
- **Effective Annual Cost Rate**:
  $$\text{APR} = \text{Annual Rate} + \left( \frac{\text{Total Charges}}{P} \times \frac{12}{n} \times 100 \right)$$

### 12.4 Multi-Tier Loan Offer Generation
Eligible applicants automatically receive 3 distinct, transparent loan options for comparison:
1. **Standard Plan**: 12.50% p.a., requested tenure, 1.50% processing fee
2. **Low Monthly EMI Plan**: 13.50% p.a., extended tenure (+12 months, max 60m), 1.75% processing fee
3. **Fast Payoff Plan (Low Total Interest)**: 11.50% p.a., accelerated tenure (-12 months, min 12m), 1.25% processing fee

### 12.5 State Transitions

```
[ SUBMITTED ] ──► POST /eligibility ──► [ ELIGIBILITY_CHECKED ] ──► POST /offers/{id}/select ──► [ OFFER_SELECTED ]
```

### 12.6 API Endpoints

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/v1/loans/applications/{id}/eligibility` | Customer | Evaluates underwriting rules, persists score/reasons, and generates 3 offers |
| `GET` | `/api/v1/loans/applications/{id}/offers` | Customer | Lists available loan packages with complete repayment schedules |
| `POST` | `/api/v1/loans/applications/{id}/offers/{offer_id}/select` | Customer | Selects chosen offer, marks others expired, and transitions to `OFFER_SELECTED` |
