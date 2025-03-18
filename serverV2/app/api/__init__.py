"""API routes package."""

from fastapi import APIRouter
from app.api import auth, buffers, search, augmented_search, buckets, users, templates

# Create a router instance for all API routes
api_router = APIRouter()

# Include all API routes
api_router.include_router(auth.router)
api_router.include_router(buffers.router)
api_router.include_router(search.router)
api_router.include_router(augmented_search.router)
api_router.include_router(buckets.router)
api_router.include_router(users.router)
api_router.include_router(templates.router)
