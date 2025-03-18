"""
Augmentation service for generating responses from search results.

This module coordinates the search, LLM generation, and template formatting
to produce augmented responses to user queries.
"""

from typing import List, Dict, Any, Optional

from app.models.search import SearchQuery, AugmentedSearchRequest, LLMProvider
from app.services import search_service, llm_service, template_service
from app.logging_config import get_logger
from app.config import get_settings

logger = get_logger(__name__)
settings = get_settings()


async def generate_augmented_response(
    request: AugmentedSearchRequest, user_id: str
) -> Dict[str, Any]:
    """
    Generate an augmented response to a search query.

    This function:
    1. Searches for relevant chunks
    2. Passes them to an LLM for response generation
    3. Formats the response using the specified template

    Args:
        request: Search and augmentation parameters
        user_id: ID of the user performing the search

    Returns:
        Dict[str, Any]: Augmented search response
    """
    logger.info(f"Generating augmented response for query: '{request.query.query}'")

    # Perform vector search
    search_results = await search_service.search_buffers(request.query, user_id)

    # Get the most relevant chunks to use as context
    chunk_results = search_results.get("chunk_results", [])
    buffer_results = search_results.get("buffer_results", [])

    if not chunk_results:
        logger.warning(f"No search results found for query: '{request.query.query}'")
        return {
            "query": request.query.query,
            "response": "I couldn't find any relevant information about that in your notes.",
            "sources": [],
            "provider": request.llm_provider,
        }

    # Prepare context for the LLM
    context_chunks = chunk_results[:10]  # Use top 10 chunks or fewer

    # Generate response from LLM
    response = await llm_service.generate_llm_response(
        query=request.query.query,
        context=context_chunks,
        provider=request.llm_provider,
        temperature=request.temperature,
        max_tokens=request.max_tokens,
    )

    # Prepare source information
    sources = []
    for buffer in buffer_results[:5]:  # Include up to 5 sources
        source = {
            "id": buffer["id"],
            "title": buffer["title"],
            "created_at": buffer["created_at"],
            "chunk_ids": [chunk["id"] for chunk in buffer["chunks"][:3]],
        }
        sources.append(source)

    # Format the response using a template
    formatted_response = await template_service.format_augmented_response(
        query=request.query.query,
        response=response,
        sources=sources,
        template_name=request.template,
        user_id=user_id,
    )

    logger.info(f"Successfully generated augmented response for query: '{request.query.query}'")

    return {
        "query": request.query.query,
        "response": formatted_response,
        "sources": sources,
        "provider": request.llm_provider,
    }
