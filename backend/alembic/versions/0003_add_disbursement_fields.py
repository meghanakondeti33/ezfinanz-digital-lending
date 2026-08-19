"""Add DISBURSEMENT_PROCESSING status and disbursement enhancement fields

Revision ID: 0003_add_disbursement_fields
Revises: 0002_add_loan_application_fields
Create Date: 2026-08-19 11:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0003_add_disbursement_fields'
down_revision: Union[str, None] = '0002_add_loan_application_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add DISBURSEMENT_PROCESSING to application_status enum if not already present
    with op.get_context().autocommit_block():
        op.execute(
            sa.text("ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'DISBURSEMENT_PROCESSING' AFTER 'APPROVED';")
        )

    # 2. Add columns to disbursements table
    op.add_column(
        'disbursements',
        sa.Column('net_amount', sa.Numeric(precision=15, scale=2), nullable=True)
    )
    op.add_column(
        'disbursements',
        sa.Column('destination_account_summary', sa.String(length=255), nullable=True)
    )
    op.add_column(
        'disbursements',
        sa.Column('bank_account_id', postgresql.UUID(as_uuid=True), nullable=True)
    )
    op.create_foreign_key(
        'fk_disbursements_bank_account_id',
        'disbursements',
        'bank_accounts',
        ['bank_account_id'],
        ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    op.drop_constraint('fk_disbursements_bank_account_id', 'disbursements', type_='foreignkey')
    op.drop_column('disbursements', 'bank_account_id')
    op.drop_column('disbursements', 'destination_account_summary')
    op.drop_column('disbursements', 'net_amount')
