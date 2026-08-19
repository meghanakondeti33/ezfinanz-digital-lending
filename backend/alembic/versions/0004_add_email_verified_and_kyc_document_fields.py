"""Add email_verified to users and document fields to kyc_details

Revision ID: 0004_add_email_verified_and_kyc_document_fields
Revises: 0003_add_disbursement_fields
Create Date: 2026-08-19 18:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0004_add_email_kyc_fields'
down_revision: Union[str, None] = '0003_add_disbursement_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add email_verified to users table
    op.add_column(
        'users',
        sa.Column('email_verified', sa.Boolean(), nullable=False, server_default=sa.text('false'))
    )

    # 2. Add document fields to kyc_details table
    op.add_column(
        'kyc_details',
        sa.Column('document_filename', sa.String(length=255), nullable=True)
    )
    op.add_column(
        'kyc_details',
        sa.Column('document_status', sa.String(length=50), nullable=True, server_default=sa.text("'KYC_NOT_SUBMITTED'"))
    )
    op.add_column(
        'kyc_details',
        sa.Column('document_rejection_reason', sa.Text(), nullable=True)
    )
    op.add_column(
        'kyc_details',
        sa.Column('document_uploaded_at', postgresql.TIMESTAMP(timezone=True), nullable=True)
    )


def downgrade() -> None:
    # 1. Remove document fields from kyc_details
    op.drop_column('kyc_details', 'document_uploaded_at')
    op.drop_column('kyc_details', 'document_rejection_reason')
    op.drop_column('kyc_details', 'document_status')
    op.drop_column('kyc_details', 'document_filename')

    # 2. Remove email_verified from users
    op.drop_column('users', 'email_verified')
