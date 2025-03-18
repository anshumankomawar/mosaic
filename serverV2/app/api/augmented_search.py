"""
API routes for augmented search operations.

This module defines the FastAPI endpoints for augmented search,
which combines vector search with LLM response generation.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any

from app.utils.auth import get_current_user
from app.models.search import AugmentedSearchRequest, AugmentedSearchResponse
from app.services import augmentation_service
from app.logging_config import get_logger

router = APIRouter(prefix="/augmented-search", tags=["augmented-search"])
logger = get_logger(__name__)


@router.post("/", response_model=AugmentedSearchResponse)
async def augmented_search(
    request: AugmentedSearchRequest, user=Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Search and generate an augmented response.

    This endpoint:
    1. Performs a search based on the provided query
    2. Uses an LLM to generate a response from the search results
    3. Formats the response using the specified template

    Args:
        request: Augmented search request parameters

    Returns:
        AugmentedSearchResponse: Generated response with source information
    """
    try:
        return await augmentation_service.generate_augmented_response(request, user.id)
    except Exception as e:
        logger.exception(f"Error generating augmented response: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating augmented response: {str(e)}",
        )
