"""
Alembic migration lifecycle tests for EZFINANZ Phase 1.
Tests upgrade head -> downgrade -1 -> upgrade head.
"""

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect

from app.core.config import settings


@pytest.fixture(scope="module")
def alembic_cfg():
    """Alembic config pointing to backend/alembic.ini."""
    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
    return cfg


def test_migration_upgrade_and_downgrade_cycle(alembic_cfg, engine):
    """
    Verify complete migration cycle:
    1. upgrade head
    2. verify tables exist
    3. downgrade base (or -1)
    4. verify tables dropped
    5. upgrade head
    6. verify tables recreated
    """
    # 1. Upgrade to head
    command.upgrade(alembic_cfg, "head")
    inspector = inspect(engine)
    tables_after_upgrade = set(inspector.get_table_names())
    assert "loan_applications" in tables_after_upgrade
    assert "users" in tables_after_upgrade

    # 2. Downgrade to base
    command.downgrade(alembic_cfg, "base")
    inspector = inspect(engine)
    tables_after_downgrade = set(inspector.get_table_names())
    assert "loan_applications" not in tables_after_downgrade
    assert "users" not in tables_after_downgrade

    # 3. Upgrade to head again (reproducibility)
    command.upgrade(alembic_cfg, "head")
    inspector = inspect(engine)
    tables_recreated = set(inspector.get_table_names())
    assert "loan_applications" in tables_recreated
    assert "users" in tables_recreated
    assert "disbursements" in tables_recreated

    # Restore default development demo accounts
    from app.core.database import SessionLocal
    from app.services.auth_service import ensure_default_accounts
    db = SessionLocal()
    try:
        ensure_default_accounts(db)
    finally:
        db.close()
