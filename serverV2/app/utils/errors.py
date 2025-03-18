"""
Error handling utilities for the Recall API.

This module provides custom exception classes and error handling tools.
"""

from typing import Dict, Any, Optional, Type
from fastapi import HTTPException, status


class RecallError(Exception):
    """Base exception class for Recall API errors."""

    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    default_message: str = "An internal error occurred"

    def __init__(self, message: Optional[str] = None, details: Optional[Dict[str, Any]] = None):
        self.message = message or self.default_message
        self.details = details
        super().__init__(self.message)

    def to_dict(self) -> Dict[str, Any]:
        """
        Convert exception to a dictionary for API responses.

        Returns:
            Dict[str, Any]: Error details
        """
        error_dict = {"message": self.message}
        if self.details:
            error_dict["details"] = self.details
        return error_dict

    def to_http_exception(self) -> HTTPException:
        """
        Convert to FastAPI HTTPException.

        Returns:
            HTTPException: FastAPI compatible HTTP exception
        """
        return HTTPException(status_code=self.status_code, detail=self.to_dict())


class AuthenticationError(RecallError):
    """Exception raised for authentication errors."""

    status_code = status.HTTP_401_UNAUTHORIZED
    default_message = "Authentication failed"


class PermissionError(RecallError):
    """Exception raised for permission errors."""

    status_code = status.HTTP_403_FORBIDDEN
    default_message = "Permission denied"


class NotFoundError(RecallError):
    """Exception raised for resource not found errors."""

    status_code = status.HTTP_404_NOT_FOUND
    default_message = "Resource not found"


class ValidationError(RecallError):
    """Exception raised for validation errors."""

    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    default_message = "Validation error"


class LLMError(RecallError):
    """Exception raised for LLM related errors."""

    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_message = "LLM service error"


# Function to convert RecallError to HTTPException
def handle_recall_error(error: Exception) -> HTTPException:
    """
    Convert any exception to an appropriate HTTPException.

    Args:
        error: Exception to convert

    Returns:
        HTTPException: FastAPI compatible HTTP exception
    """
    if isinstance(error, RecallError):
        return error.to_http_exception()

    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail={"message": str(error)}
    )
