"""Add purpose, employment_type, and requested_tenure_months to loan_applications

Revision ID: 0002_add_loan_application_fields
Revises: 0001_initial_schema
Create Date: 2026-08-18 19:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0002_add_loan_application_fields'
down_revision: Union[str, None] = '0001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('loan_applications', sa.Column('purpose', sa.String(length=255), nullable=True))
    op.add_column('loan_applications', sa.Column('employment_type', sa.String(length=50), nullable=True))
    op.add_column('loan_applications', sa.Column('requested_tenure_months', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('loan_applications', 'requested_tenure_months')
    op.drop_column('loan_applications', 'employment_type')
    op.drop_column('loan_applications', 'purpose')
