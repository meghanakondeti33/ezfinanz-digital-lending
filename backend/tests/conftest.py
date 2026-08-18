"""
Pytest fixtures for EZFINANZ tests.

Provides isolated test database engine, session, and FastAPI TestClient.
"""

import os
import pytest
from typing import Generator
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
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
    Yields a SQLAlchemy session wrapped in a transaction that is rolled back
    after the test to ensure test isolation.
    """
    connection = engine.connect()
    transaction = connection.begin()
    SessionLocal = sessionmaker(bind=connection, autocommit=False, autoflush=False)
    session = SessionLocal()

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture(scope="function")
def client() -> Generator[TestClient, None, None]:
    """FastAPI TestClient for API endpoints."""
    with TestClient(fastapi_app) as test_client:
        yield test_client
