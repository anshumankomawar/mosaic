"""
Embedding service for generating vector embeddings from text.

This module handles the generation of embeddings for text chunks,
which enables semantic search functionality with different providers.
"""

import numpy as np
import time
import os
from typing import List, Dict, Any, Optional
import json
import httpx
from enum import Enum
from openai import AsyncOpenAI

from app.config import get_settings
from app.logging_config import get_logger

logger = get_logger(__name__)
settings = get_settings()

# Get the API key directly from settings - matching your structure
openai_api_key = settings.LLM.OPENAI_API_KEY

# Initialize AsyncOpenAI client
if not openai_api_key:
    raise Exception("OpenAI API key not found in settings")

async_openai_client = AsyncOpenAI(api_key=openai_api_key)


class EmbeddingProvider(str, Enum):
    """Supported embedding providers."""

    OPENAI = "openai"
    COHERE = "cohere"
    MISTRAL = "mistral"
    LOCAL = "local"


async def generate_openai_embedding(text: str) -> List[float]:
    """
    Generate an embedding vector using OpenAI's API.

    Args:
        text: The text to generate an embedding for

    Returns:
        List[float]: The embedding vector

    Raises:
        Exception: If there is an error generating the embedding
    """
    if not openai_api_key:
        raise Exception("OpenAI API key not found in settings")
        
    max_retries = 3
    retry_delay = 1  # seconds

    # Truncate text if necessary (OpenAI has token limits)
    # A simple approximation - 1 token ≈ 4 chars in English
    max_chars = 8000  # ~2000 tokens for text-embedding-ada-002
    if len(text) > max_chars:
        logger.warning(f"Text truncated from {len(text)} to {max_chars} characters for embedding")
        text = text[:max_chars]

    for attempt in range(max_retries):
        try:
            logger.debug(f"Generating OpenAI embedding for text of length {len(text)}")

            # Use the new client-based approach for OpenAI API v1.0.0+
            response = await async_openai_client.embeddings.create(
                model=settings.LLM.OPENAI_EMBEDDING_MODEL, 
                input=text
            )

            # Extract the embedding from the response
            embedding = response.data[0].embedding
            logger.debug(f"Successfully generated OpenAI embedding of dimension {len(embedding)}")

            return embedding

        except Exception as e:
            logger.error(
                f"Error generating OpenAI embedding (attempt {attempt+1}/{max_retries}): {str(e)}"
            )

            if attempt < max_retries - 1:
                logger.info(f"Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff
            else:
                logger.error("All OpenAI embedding generation attempts failed")
                raise Exception(
                    f"Failed to generate OpenAI embedding after {max_retries} attempts"
                ) from e


async def generate_cohere_embedding(text: str) -> List[float]:
    """
    Generate an embedding vector using Cohere's API.

    Args:
        text: The text to generate an embedding for

    Returns:
        List[float]: The embedding vector

    Raises:
        Exception: If there is an error generating the embedding
    """
    if not settings.LLM.COHERE_API_KEY:
        raise Exception("Cohere API key not configured")

    max_retries = 3
    retry_delay = 1  # seconds

    for attempt in range(max_retries):
        try:
            logger.debug(f"Generating Cohere embedding for text of length {len(text)}")

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.cohere.ai/v1/embed",
                    headers={
                        "Authorization": f"Bearer {settings.LLM.COHERE_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={"texts": [text], "model": "embed-english-v3.0", "truncate": "END"},
                )

                if response.status_code != 200:
                    raise Exception(
                        f"Cohere API returned status code {response.status_code}: {response.text}"
                    )

                data = response.json()
                embedding = data["embeddings"][0]
                logger.debug(
                    f"Successfully generated Cohere embedding of dimension {len(embedding)}"
                )

                return embedding

        except Exception as e:
            logger.error(
                f"Error generating Cohere embedding (attempt {attempt+1}/{max_retries}): {str(e)}"
            )

            if attempt < max_retries - 1:
                logger.info(f"Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff
            else:
                logger.error("All Cohere embedding generation attempts failed")
                raise Exception(
                    f"Failed to generate Cohere embedding after {max_retries} attempts"
                ) from e


async def generate_embedding(
    text: str, provider: str = settings.LLM.DEFAULT_PROVIDER
) -> List[float]:
    """
    Generate an embedding vector for the given text using the specified provider.

    Args:
        text: The text to generate an embedding for
        provider: The embedding provider to use

    Returns:
        List[float]: The embedding vector

    Raises:
        Exception: If there is an error generating the embedding
    """
    logger.info(f"Generating embedding using provider: {provider}")

    if provider == EmbeddingProvider.OPENAI:
        return await generate_openai_embedding(text)
    elif provider == EmbeddingProvider.COHERE:
        return await generate_cohere_embedding(text)
    # Add other providers as needed
    else:
        logger.warning(f"Unknown embedding provider: {provider}, falling back to OpenAI")
        return await generate_openai_embedding(text)


def calculate_similarity(embedding1: List[float], embedding2: List[float]) -> float:
    """
    Calculate the cosine similarity between two embeddings.

    Args:
        embedding1: First embedding vector
        embedding2: Second embedding vector

    Returns:
        float: Cosine similarity score (0-1, higher is more similar)
    """
    # Convert to numpy arrays for efficient calculation
    vec1 = np.array(embedding1)
    vec2 = np.array(embedding2)

    # Calculate cosine similarity
    dot_product = np.dot(vec1, vec2)
    norm1 = np.linalg.norm(vec1)
    norm2 = np.linalg.norm(vec2)

    similarity = dot_product / (norm1 * norm2)

    return float(similarity)
