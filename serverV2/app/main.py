"""
Main entry point for the Recall API.

This module initializes the FastAPI application, configures middleware,
and includes all API routes.
"""

import time
from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uuid

from app.config import get_settings
from app.logging_config import setup_logging, get_logger
from app.api import api_router
from app.utils.auth import get_current_user, is_public_route
from app.middleware.auth import AuthMiddleware

# Setup logging
setup_logging()
logger = get_logger(__name__)
settings = get_settings()

# Initialize FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    description="API for Recall - a buffer-based note-taking app with AI search",
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Modify for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add authentication middleware
# app.add_middleware(AuthMiddleware)  # Uncomment to use middleware instead of dependencies


# Request ID middleware
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    """
    Add a unique request ID to each request for tracing.
    """
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id

    # Add request ID to logger context
    logger_with_context = get_logger(__name__)
    logger_with_context.extra = {"request_id": request_id}

    # Log request details
    path = request.url.path
    is_public = is_public_route(path)
    logger_with_context.info(f"Request started: {request.method} {path} " f"(Public: {is_public})")

    start_time = time.time()

    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        logger_with_context.info(
            f"Request completed: {request.method} {path} "
            f"- Status: {response.status_code} - Duration: {process_time:.3f}s"
        )
        response.headers["X-Request-ID"] = request_id
        return response
    except Exception as e:
        process_time = time.time() - start_time
        logger_with_context.error(
            f"Request failed: {request.method} {path} "
            f"- Error: {str(e)} - Duration: {process_time:.3f}s"
        )
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})


# Include API router
app.include_router(api_router, prefix="/api")


# Health check endpoint
@app.get("/health", tags=["health"])
async def health_check():
    """
    Health check endpoint to verify the API is running.
    """
    return {"status": "healthy", "timestamp": time.time()}


# User info endpoint
@app.get("/api/me", tags=["user"])
async def get_me(user=Depends(get_current_user)):
    """
    Get current authenticated user information.
    """
    if not user:
        return {"authenticated": False}

    return {
        "authenticated": True,
        "user": {"id": user.id, "email": user.email, "created_at": user.created_at},
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
