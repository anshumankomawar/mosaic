"""
Authentication utilities for the Recall API.

This module handles authentication with Supabase and provides
dependencies for getting the current user.
"""

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Dict, Any, Optional
import re

from app.db import get_supabase_client
from app.logging_config import get_logger

logger = get_logger(__name__)

# Authentication
security = HTTPBearer(auto_error=False)

# Define public routes that don't require authentication
PUBLIC_ROUTES = [
    # Auth routes
    r"^/api/auth/signup$",
    r"^/api/auth/login$",
    r"^/api/auth/password/reset/request$",
    r"^/api/auth/password/reset/confirm$",
    r"^/api/auth/refresh$",
    # Health check
    r"^/health$",
    # Documentation routes
    r"^/docs$",
    r"^/redoc$",
    r"^/openapi.json$",
]


def is_public_route(path: str) -> bool:
    """
    Check if a route is public (doesn't require authentication).

    Args:
        path: The request path

    Returns:
        bool: True if the route is public, False otherwise
    """
    for pattern in PUBLIC_ROUTES:
        if re.match(pattern, path):
            return True
    return False


async def get_current_user(
    request: Request, credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Dict[str, Any]:
    """
    Verify JWT with Supabase and return the current user.

    Args:
        request: The current request
        credentials: Bearer token credentials from the request

    Returns:
        Dict[str, Any]: User data from Supabase Auth

    Raises:
        HTTPException: If authentication fails
    """
    # Check if the route is public
    if is_public_route(request.url.path):
        return None

    # Otherwise require authentication
    if not credentials:
        logger.warning(f"Missing authentication for protected route: {request.url.path}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    supabase = get_supabase_client()

    try:
        # Verify JWT with Supabase
        response = supabase.auth.get_user(token)
        user = response.user

        if not user:
            logger.warning("Invalid authentication token")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

        logger.debug(f"Authenticated user: {user.id}")
        return user

    except Exception as e:
        logger.error(f"Authentication error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_optional_user(
    request: Request, credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[Dict[str, Any]]:
    """
    Verify JWT with Supabase and return the current user, if available.
    Unlike get_current_user, this does not raise an exception for missing credentials.

    Args:
        request: The current request
        credentials: Bearer token credentials from the request

    Returns:
        Optional[Dict[str, Any]]: User data from Supabase Auth, or None if no valid credentials
    """
    if not credentials:
        return None

    token = credentials.credentials
    supabase = get_supabase_client()

    try:
        # Verify JWT with Supabase
        response = supabase.auth.get_user(token)
        user = response.user

        if not user:
            return None

        logger.debug(f"Authenticated user: {user.id}")
        return user

    except Exception as e:
        logger.debug(f"Optional authentication failed: {str(e)}")
        return None
