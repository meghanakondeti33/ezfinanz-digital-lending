"""
Health check endpoint.

Provides a simple liveness probe for the API.
"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check():
    """
    Returns API health status.

    Used by monitoring, load balancers, and the frontend
    to verify backend availability.
    """
    return {"status": "ok"}
