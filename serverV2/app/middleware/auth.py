"""
Authentication middleware for the Recall API.

This module handles authentication verification for all routes.
"""

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import re

from app.utils.auth import is_public_route
from app.db import get_supabase_client
from app.logging_config import get_logger

logger = get_logger(__name__)


class AuthMiddleware(BaseHTTPMiddleware):
    """
    Middleware for authentication verification.

    This middleware checks if the request has valid authentication
    for protected routes.
    """

    async def dispatch(self, request: Request, call_next):
        """
        Process the request and verify authentication if needed.

        Args:
            request: The incoming request
            call_next: The next middleware or route handler

        Returns:
            Response from the next middleware or route handler
        """
        # Check if the route is public (doesn't require authentication)
        if is_public_route(request.url.path):
            return await call_next(request)

        # Get authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            logger.warning(
                f"Missing or invalid Authorization header for protected route: {request.url.path}"
            )
            return JSONResponse(
                status_code=401,
                content={"detail": "Authentication required"},
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Extract token
        token = auth_header.replace("Bearer ", "")

        try:
            # Verify token with Supabase
            supabase = get_supabase_client()
            response = supabase.auth.get_user(token)

            if not response.user:
                logger.warning(f"Invalid token for protected route: {request.url.path}")
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Invalid authentication token"},
                    headers={"WWW-Authenticate": "Bearer"},
                )

            # Add user to request state for access in route handlers
            request.state.user = response.user

            # Continue processing the request
            return await call_next(request)

        except Exception as e:
            logger.error(f"Authentication error: {str(e)}")
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid authentication token"},
                headers={"WWW-Authenticate": "Bearer"},
            )
