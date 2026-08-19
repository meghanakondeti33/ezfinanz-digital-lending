"""Initial database schema for EZFINANZ

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-08-18 18:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('phone', sa.String(length=20), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('role', sa.Enum('CUSTOMER', 'ADMIN', name='user_role'), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_phone'), 'users', ['phone'], unique=True)

    # 2. user_verifications
    op.create_table(
        'user_verifications',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('verification_type', sa.Enum('EMAIL', 'PHONE', name='verification_type'), nullable=False),
        sa.Column('status', sa.Enum('PENDING', 'VERIFIED', 'EXPIRED', 'FAILED', name='verification_status'), nullable=False),
        sa.Column('otp_hash', sa.String(length=255), nullable=True),
        sa.Column('expires_at', postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('verified_at', postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('attempt_count', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_user_verifications_user_id'), 'user_verifications', ['user_id'], unique=False)

    # 3. kyc_details
    op.create_table(
        'kyc_details',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('full_name', sa.String(length=255), nullable=False),
        sa.Column('date_of_birth', sa.Date(), nullable=False),
        sa.Column('gender', sa.Enum('MALE', 'FEMALE', 'OTHER', name='gender_type'), nullable=False),
        sa.Column('address_line_1', sa.String(length=500), nullable=False),
        sa.Column('address_line_2', sa.String(length=500), nullable=True),
        sa.Column('city', sa.String(length=100), nullable=False),
        sa.Column('state', sa.String(length=100), nullable=False),
        sa.Column('pincode', sa.String(length=10), nullable=False),
        sa.Column('id_type', sa.Enum('AADHAAR', 'PAN', 'PASSPORT', 'DRIVING_LICENSE', 'VOTER_ID', name='id_document_type'), nullable=False),
        sa.Column('id_number_hash', sa.String(length=255), nullable=False),
        sa.Column('document_storage_key', sa.String(length=500), nullable=True),
        sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_kyc_details_user_id'), 'kyc_details', ['user_id'], unique=False)

    # 4. loan_applications
    op.create_table(
        'loan_applications',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('application_number', sa.String(length=50), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('status', sa.Enum('DRAFT', 'EMAIL_VERIFIED', 'PHONE_VERIFIED', 'KYC_SUBMITTED', 'KYC_VERIFIED', 'LOAN_DETAILS_SUBMITTED', 'ELIGIBILITY_CHECKED', 'OFFER_SELECTED', 'BANK_ACCOUNT_ADDED', 'DECLARATION_SIGNED', 'SELFIE_UPLOADED', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'DISBURSED', name='application_status'), nullable=False),
        sa.Column('monthly_income', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('requested_amount', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('existing_debt', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('credit_score', sa.Integer(), nullable=True),
        sa.Column('employer_name', sa.String(length=255), nullable=True),
        sa.Column('designation', sa.String(length=255), nullable=True),
        sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('submitted_at', postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_loan_applications_application_number'), 'loan_applications', ['application_number'], unique=True)
    op.create_index(op.f('ix_loan_applications_user_id'), 'loan_applications', ['user_id'], unique=False)
    op.create_index(op.f('ix_loan_applications_status'), 'loan_applications', ['status'], unique=False)
    op.create_index('ix_loan_applications_created_at', 'loan_applications', ['created_at'], unique=False)

    # 5. eligibility_checks
    op.create_table(
        'eligibility_checks',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('application_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('score', sa.Numeric(precision=7, scale=2), nullable=True),
        sa.Column('dti_ratio', sa.Numeric(precision=7, scale=4), nullable=True),
        sa.Column('status', sa.Enum('ELIGIBLE', 'INELIGIBLE', 'MANUAL_REVIEW', name='eligibility_status'), nullable=False),
        sa.Column('reasons', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('calculated_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['application_id'], ['loan_applications.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_eligibility_checks_application_id'), 'eligibility_checks', ['application_id'], unique=False)

    # 6. loan_offers
    op.create_table(
        'loan_offers',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('application_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('principal', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('interest_rate', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('processing_fee', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('gst', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('other_charges', sa.Numeric(precision=15, scale=2), nullable=False, server_default=sa.text('0.00')),
        sa.Column('status', sa.Enum('GENERATED', 'SELECTED', 'EXPIRED', 'REJECTED', name='offer_status'), nullable=False),
        sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['application_id'], ['loan_applications.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_loan_offers_application_id'), 'loan_offers', ['application_id'], unique=False)

    # 7. loan_terms
    op.create_table(
        'loan_terms',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('offer_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenure_months', sa.Integer(), nullable=False),
        sa.Column('emi', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('total_interest', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('total_repayment', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('total_charges', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('net_disbursement', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('irr', sa.Numeric(precision=7, scale=4), nullable=True),
        sa.Column('selected_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['offer_id'], ['loan_offers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_loan_terms_offer_id'), 'loan_terms', ['offer_id'], unique=False)

    # 8. bank_accounts
    op.create_table(
        'bank_accounts',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('application_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('account_holder_name', sa.String(length=255), nullable=False),
        sa.Column('account_number_hash', sa.String(length=255), nullable=False),
        sa.Column('account_number_last4', sa.String(length=4), nullable=False),
        sa.Column('ifsc', sa.String(length=20), nullable=False),
        sa.Column('bank_name', sa.String(length=255), nullable=False),
        sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['application_id'], ['loan_applications.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_bank_accounts_application_id'), 'bank_accounts', ['application_id'], unique=False)

    # 9. declarations
    op.create_table(
        'declarations',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('application_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('accepted', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('declaration_version', sa.String(length=50), nullable=False, server_default=sa.text("'v1.0'")),
        sa.Column('accepted_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('ip_address', sa.String(length=50), nullable=True),
        sa.ForeignKeyConstraint(['application_id'], ['loan_applications.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_declarations_application_id'), 'declarations', ['application_id'], unique=False)

    # 10. selfie_verifications
    op.create_table(
        'selfie_verifications',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('application_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('storage_key', sa.String(length=500), nullable=False),
        sa.Column('verification_type', sa.Enum('LIVE_PHOTO', 'DOCUMENT_MATCH', name='selfie_verification_type'), nullable=False),
        sa.Column('status', sa.Enum('PENDING', 'VERIFIED', 'REJECTED', 'PHOTO_PENDING_REVIEW', 'PHOTO_APPROVED', 'PHOTO_RETAKE_REQUIRED', name='selfie_verification_status'), nullable=False),
        sa.Column('rejection_reason', sa.String(length=500), nullable=True),
        sa.Column('reviewed_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('submitted_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('reviewed_at', postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['application_id'], ['loan_applications.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['reviewed_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_selfie_verifications_application_id'), 'selfie_verifications', ['application_id'], unique=False)

    # 11. admin_reviews
    op.create_table(
        'admin_reviews',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('application_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('admin_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('decision', sa.Enum('APPROVED', 'REJECTED', 'FURTHER_INFO_REQUIRED', name='review_decision'), nullable=False),
        sa.Column('remarks', sa.Text(), nullable=True),
        sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['admin_id'], ['users.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['application_id'], ['loan_applications.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_admin_reviews_admin_id'), 'admin_reviews', ['admin_id'], unique=False)
    op.create_index(op.f('ix_admin_reviews_application_id'), 'admin_reviews', ['application_id'], unique=False)

    # 12. disbursements
    op.create_table(
        'disbursements',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('application_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('amount', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('status', sa.Enum('PENDING', 'INITIATED', 'SUCCESS', 'FAILED', name='disbursement_status'), nullable=False),
        sa.Column('transaction_reference', sa.String(length=100), nullable=True),
        sa.Column('initiated_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('completed_at', postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('failure_reason', sa.String(length=500), nullable=True),
        sa.ForeignKeyConstraint(['application_id'], ['loan_applications.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('transaction_reference')
    )
    op.create_index(op.f('ix_disbursements_application_id'), 'disbursements', ['application_id'], unique=False)

    # 13. audit_logs
    op.create_table(
        'audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('actor_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('application_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('action', sa.String(length=100), nullable=False),
        sa.Column('old_status', sa.String(length=50), nullable=True),
        sa.Column('new_status', sa.String(length=50), nullable=True),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['actor_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['application_id'], ['loan_applications.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_audit_logs_application_id'), 'audit_logs', ['application_id'], unique=False)


def downgrade() -> None:
    # Drop tables in reverse topological order
    op.drop_table('audit_logs')
    op.drop_table('disbursements')
    op.drop_table('admin_reviews')
    op.drop_table('selfie_verifications')
    op.drop_table('declarations')
    op.drop_table('bank_accounts')
    op.drop_table('loan_terms')
    op.drop_table('loan_offers')
    op.drop_table('eligibility_checks')
    op.drop_table('loan_applications')
    op.drop_table('kyc_details')
    op.drop_table('user_verifications')
    op.drop_table('users')

    # Drop enum types
    op.execute("DROP TYPE IF EXISTS user_role")
    op.execute("DROP TYPE IF EXISTS verification_type")
    op.execute("DROP TYPE IF EXISTS verification_status")
    op.execute("DROP TYPE IF EXISTS gender_type")
    op.execute("DROP TYPE IF EXISTS id_document_type")
    op.execute("DROP TYPE IF EXISTS application_status")
    op.execute("DROP TYPE IF EXISTS eligibility_status")
    op.execute("DROP TYPE IF EXISTS offer_status")
    op.execute("DROP TYPE IF EXISTS selfie_verification_type")
    op.execute("DROP TYPE IF EXISTS selfie_verification_status")
    op.execute("DROP TYPE IF EXISTS review_decision")
    op.execute("DROP TYPE IF EXISTS disbursement_status")
