"""
Pytest fixtures for EZFINANZ tests.

Provides isolated test database engine, session with savepoint rollback, and FastAPI TestClient.
"""

import pytest
from typing import Generator
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session

from app.core.config import settings
from app.core.database import Base, get_db
from app.main import app as fastapi_app
import app.models  # noqa: F401


@pytest.fixture(scope="session")
def engine():
    """Create database engine."""
    test_engine = create_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,
    )
    return test_engine


@pytest.fixture(scope="function")
def db_session(engine) -> Generator[Session, None, None]:
    """
    Yields a SQLAlchemy session wrapped in a transaction with savepoints.
    Allows application code to call session.commit() inside endpoints without
    breaking test isolation, as the outer transaction is always rolled back.
    """
    connection = engine.connect()
    transaction = connection.begin()
    nested = connection.begin_nested()

    SessionLocal = sessionmaker(bind=connection, autocommit=False, autoflush=False, expire_on_commit=False)
    session = SessionLocal()

    @event.listens_for(session, "after_transaction_end")
    def restart_savepoint(session, trans):
        nonlocal nested
        if trans.nested:
            return
        if connection.closed:
            return
        nested = connection.begin_nested()

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture(scope="function")
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """FastAPI TestClient with overridden database session."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    fastapi_app.dependency_overrides[get_db] = override_get_db
    with TestClient(fastapi_app) as test_client:
        yield test_client
    fastapi_app.dependency_overrides.clear()
