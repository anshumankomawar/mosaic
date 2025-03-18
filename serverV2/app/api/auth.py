"""
API routes for authentication operations.

This module defines the FastAPI endpoints for user registration, login, password reset, etc.
"""

from fastapi import APIRouter, HTTPException, status, Depends, BackgroundTasks, Request
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field, EmailStr

from app.db import get_supabase_client
from app.logging_config import get_logger
from app.utils.errors import handle_recall_error, AuthenticationError
from app.utils.auth import get_optional_user

router = APIRouter(prefix="/auth", tags=["auth"])
logger = get_logger(__name__)


class SignUpRequest(BaseModel):
    """Model for user signup request."""

    email: EmailStr = Field(..., description="User's email address")
    password: str = Field(..., description="User's password", min_length=8)
    full_name: Optional[str] = Field(default=None, description="User's full name")


class LoginRequest(BaseModel):
    """Model for user login request."""

    email: EmailStr = Field(..., description="User's email address")
    password: str = Field(..., description="User's password")


class PasswordResetRequest(BaseModel):
    """Model for password reset request."""

    email: EmailStr = Field(..., description="User's email address")


class PasswordResetConfirmRequest(BaseModel):
    """Model for password reset confirmation."""

    token: str = Field(..., description="Password reset token")
    password: str = Field(..., description="New password", min_length=8)


class AuthResponse(BaseModel):
    """Model for authentication response."""

    access_token: Optional[str] = Field(default=None, description="JWT access token")
    refresh_token: Optional[str] = Field(default=None, description="JWT refresh token")
    user: Dict[str, Any] = Field(..., description="User information")
    session_created: bool = Field(..., description="Whether a session was created")
    email_confirmed: bool = Field(..., description="Whether the email is confirmed")
    confirmation_sent: bool = Field(..., description="Whether a confirmation email was sent")


class RefreshTokenRequest(BaseModel):
    """Model for token refresh request."""

    refresh_token: str = Field(..., description="JWT refresh token")


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def sign_up(request: SignUpRequest) -> Dict[str, Any]:
    """
    Register a new user account.

    - **email**: User's email address
    - **password**: User's password (min 8 characters)
    - **full_name**: Optional user's full name

    Returns user information and session details if available.
    """
    try:
        supabase = get_supabase_client()

        # Create user in Supabase Auth
        user_data = {
            "email": request.email,
            "password": request.password,
        }

        if request.full_name:
            user_data["data"] = {"full_name": request.full_name}

        try:
            # First check if user already exists to give better error
            existing_user = await supabase.auth.admin.get_user_by_email(request.email)
            if existing_user and existing_user.user:
                logger.warning(f"Attempt to create existing user: {request.email}")
                raise AuthenticationError("User with this email already exists")
        except Exception as e:
            # If the admin API fails (missing permissions) or other errors, continue
            # We'll catch duplicate emails in the sign-up call
            pass

        # Now sign up
        try:
            response = supabase.auth.sign_up(user_data)

            # Check if user was created successfully
            if not response.user:
                raise AuthenticationError("Failed to create user account")

            # Create response
            result = {
                "user": {
                    "id": response.user.id,
                    "email": response.user.email,
                    "created_at": response.user.created_at,
                    "email_confirmed": response.user.email_confirmed_at is not None,
                },
                "session_created": response.session is not None,
                "email_confirmed": response.user.email_confirmed_at is not None,
                "confirmation_sent": response.user.confirmation_sent_at is not None,
            }

            # Add session details if available
            if response.session:
                result["access_token"] = response.session.access_token
                result["refresh_token"] = response.session.refresh_token

            return result

        except Exception as e:
            logger.error(f"Sign-up error: {str(e)}")
            # Provide a more helpful error message
            if "User already registered" in str(e):
                raise AuthenticationError("User with this email already exists")
            else:
                raise AuthenticationError(f"Failed to create user account: {str(e)}")

    except AuthenticationError as e:
        logger.warning(f"Sign up error: {str(e)}")
        raise handle_recall_error(e)
    except Exception as e:
        logger.exception(f"Error during sign up: {str(e)}")
        raise handle_recall_error(e)


@router.post("/login", response_model=None)
async def login(request: LoginRequest) -> Dict[str, Any]:
    """
    Log in with email and password.

    - **email**: User's email address
    - **password**: User's password

    Returns access token and user information.
    """
    try:
        supabase = get_supabase_client()

        # Sign in with email and password
        response = supabase.auth.sign_in_with_password(
            {"email": request.email, "password": request.password}
        )

        # Check if login was successful
        if not response.user:
            raise AuthenticationError("Invalid email or password")

        # Return token and user information
        return {
            "access_token": response.session.access_token,
            "refresh_token": response.session.refresh_token,
            "user": {
                "id": response.user.id,
                "email": response.user.email,
                "created_at": response.user.created_at,
                "last_sign_in_at": getattr(response.user, "last_sign_in_at", None),
            },
        }

    except AuthenticationError as e:
        logger.warning(f"Login error: {str(e)}")
        raise handle_recall_error(e)
    except Exception as e:
        logger.exception(f"Error during login: {str(e)}")
        raise handle_recall_error(e)


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(user=Depends(get_optional_user)) -> Dict[str, str]:
    """
    Log out the current user.

    Returns a success message.
    """
    try:
        if not user:
            return {"message": "Not logged in"}

        supabase = get_supabase_client()

        # Sign out
        supabase.auth.sign_out()

        return {"message": "Successfully logged out"}

    except Exception as e:
        logger.exception(f"Error during logout: {str(e)}")
        raise handle_recall_error(e)


@router.post("/refresh", response_model=AuthResponse)
async def refresh_token(request: RefreshTokenRequest) -> Dict[str, Any]:
    """
    Refresh authentication token.

    - **refresh_token**: JWT refresh token

    Returns new access token and user information.
    """
    try:
        supabase = get_supabase_client()

        try:
            # Refresh token
            response = supabase.auth.refresh_session(request.refresh_token)

            # Check if refresh was successful
            if not response.user:
                raise AuthenticationError("Invalid or expired refresh token")

            # Return token and user information
            return {
                "access_token": response.session.access_token,
                "refresh_token": response.session.refresh_token,
                "user": {
                    "id": response.user.id,
                    "email": response.user.email,
                    "created_at": response.user.created_at,
                    "last_sign_in_at": getattr(response.user, "last_sign_in_at", None),
                },
            }
        except Exception as e:
            logger.error(f"Token refresh error: {str(e)}")
            raise AuthenticationError("Invalid or expired refresh token")

    except AuthenticationError as e:
        logger.warning(f"Token refresh error: {str(e)}")
        raise handle_recall_error(e)
    except Exception as e:
        logger.exception(f"Error during token refresh: {str(e)}")
        raise handle_recall_error(e)


@router.post("/password/reset/request", status_code=status.HTTP_200_OK)
async def request_password_reset(
    request: PasswordResetRequest, background_tasks: BackgroundTasks
) -> Dict[str, str]:
    """
    Request a password reset.

    - **email**: User's email address

    Returns a success message.
    """
    try:
        supabase = get_supabase_client()

        # Send password reset email
        background_tasks.add_task(supabase.auth.reset_password_email, request.email)

        # Always return success to prevent email enumeration
        return {
            "message": "If an account with this email exists, a password reset link has been sent"
        }

    except Exception as e:
        logger.exception(f"Error requesting password reset: {str(e)}")
        # Still return success to prevent email enumeration
        return {
            "message": "If an account with this email exists, a password reset link has been sent"
        }


@router.post("/password/reset/confirm", status_code=status.HTTP_200_OK)
async def confirm_password_reset(request: PasswordResetConfirmRequest) -> Dict[str, str]:
    """
    Confirm a password reset.

    - **token**: Password reset token
    - **password**: New password

    Returns a success message.
    """
    try:
        supabase = get_supabase_client()

        try:
            # Reset password using token
            response = supabase.auth.verify_otp(
                {"token_hash": request.token, "type": "recovery", "new_password": request.password}
            )

            # Check if reset was successful
            if not response:
                raise AuthenticationError("Invalid or expired password reset token")

            return {"message": "Password has been reset successfully"}
        except Exception as e:
            logger.error(f"Password reset error: {str(e)}")
            raise AuthenticationError("Invalid or expired password reset token")

    except AuthenticationError as e:
        logger.warning(f"Password reset error: {str(e)}")
        raise handle_recall_error(e)
    except Exception as e:
        logger.exception(f"Error during password reset: {str(e)}")
        raise handle_recall_error(e)


@router.get("/status", status_code=status.HTTP_200_OK)
async def auth_status(request: Request, user=Depends(get_optional_user)) -> Dict[str, Any]:
    """
    Check authentication status.

    Returns authentication status and user info if logged in.
    """
    if user:
        return {
            "authenticated": True,
            "user": {
                "id": user.id,
                "email": user.email,
                "created_at": user.created_at,
                "last_sign_in_at": getattr(user, "last_sign_in_at", None),
            },
        }
    else:
        return {"authenticated": False}
