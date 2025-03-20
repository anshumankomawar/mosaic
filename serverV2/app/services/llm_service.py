"""
LLM service for generating responses using various providers.

This module handles the generation of augmented responses from LLMs
using the search results as context.
"""

import openai
import json
import time
import httpx
import os
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

from app.models.search import LLMProvider
from app.config import get_settings
from app.logging_config import get_logger

load_dotenv()

logger = get_logger(__name__)
settings = get_settings()

# Configure OpenAI with API key from environment variables
openai.api_key = os.getenv("OPENAI_API_KEY")


async def generate_openai_response(
    query: str,
    context: List[Dict[str, Any]],
    system_prompt: str,
    temperature: float = 0.3,
    max_tokens: Optional[int] = None,
) -> str:
    """
    Generate a response using OpenAI's API.

    Args:
        query: The user's query
        context: List of context chunks from search results
        system_prompt: System prompt for the LLM
        temperature: Temperature setting (higher = more creative)
        max_tokens: Maximum tokens in the response

    Returns:
        str: Generated response

    Raises:
        Exception: If there is an error generating the response
    """
    max_retries = 3
    retry_delay = 1  # seconds

    # Format context chunks for the prompt
    context_text = ""
    for i, chunk in enumerate(context):
        context_text += f"\n--- CHUNK {i+1} ---\n{chunk['content']}\n"

    # Prepare messages
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"QUERY: {query}\n\nCONTEXT:\n{context_text}"},
    ]

    for attempt in range(max_retries):
        try:
            logger.debug(f"Generating OpenAI response for query: '{query}'")

            params = {
                "model": settings.LLM.OPENAI_MODEL,
                "messages": messages,
                "temperature": temperature,
            }

            if max_tokens:
                params["max_tokens"] = max_tokens

            response = await openai.ChatCompletion.acreate(**params)

            response_text = response.choices[0].message.content
            logger.debug(f"Successfully generated OpenAI response of length {len(response_text)}")

            return response_text

        except Exception as e:
            logger.error(
                f"Error generating OpenAI response (attempt {attempt+1}/{max_retries}): {str(e)}"
            )

            if attempt < max_retries - 1:
                logger.info(f"Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff
            else:
                logger.error("All OpenAI response generation attempts failed")
                raise Exception(
                    f"Failed to generate OpenAI response after {max_retries} attempts"
                ) from e


async def generate_anthropic_response(
    query: str,
    context: List[Dict[str, Any]],
    system_prompt: str,
    temperature: float = 0.3,
    max_tokens: Optional[int] = None,
) -> str:
    """
    Generate a response using Anthropic's API.

    Args:
        query: The user's query
        context: List of context chunks from search results
        system_prompt: System prompt for the LLM
        temperature: Temperature setting (higher = more creative)
        max_tokens: Maximum tokens in the response

    Returns:
        str: Generated response

    Raises:
        Exception: If there is an error generating the response
    """
    if not settings.LLM.ANTHROPIC_API_KEY:
        raise Exception("Anthropic API key not configured")

    max_retries = 3
    retry_delay = 1  # seconds

    # Format context chunks for the prompt
    context_text = ""
    for i, chunk in enumerate(context):
        context_text += f"\n--- CHUNK {i+1} ---\n{chunk['content']}\n"

    user_message = f"QUERY: {query}\n\nCONTEXT:\n{context_text}"

    for attempt in range(max_retries):
        try:
            logger.debug(f"Generating Anthropic response for query: '{query}'")

            headers = {
                "x-api-key": settings.LLM.ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            }

            data = {
                "model": settings.LLM.ANTHROPIC_MODEL,
                "system": system_prompt,
                "messages": [{"role": "user", "content": user_message}],
                "temperature": temperature,
            }

            if max_tokens:
                data["max_tokens"] = max_tokens

            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    "https://api.anthropic.com/v1/messages", headers=headers, json=data
                )

                if response.status_code != 200:
                    raise Exception(
                        f"Anthropic API returned status code {response.status_code}: {response.text}"
                    )

                result = response.json()
                response_text = result["content"][0]["text"]

                logger.debug(
                    f"Successfully generated Anthropic response of length {len(response_text)}"
                )
                return response_text

        except Exception as e:
            logger.error(
                f"Error generating Anthropic response (attempt {attempt+1}/{max_retries}): {str(e)}"
            )

            if attempt < max_retries - 1:
                logger.info(f"Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff
            else:
                logger.error("All Anthropic response generation attempts failed")
                raise Exception(
                    f"Failed to generate Anthropic response after {max_retries} attempts"
                ) from e


async def generate_mistral_response(
    query: str,
    context: List[Dict[str, Any]],
    system_prompt: str,
    temperature: float = 0.3,
    max_tokens: Optional[int] = None,
) -> str:
    """
    Generate a response using Mistral's API.

    Args:
        query: The user's query
        context: List of context chunks from search results
        system_prompt: System prompt for the LLM
        temperature: Temperature setting (higher = more creative)
        max_tokens: Maximum tokens in the response

    Returns:
        str: Generated response

    Raises:
        Exception: If there is an error generating the response
    """
    if not settings.LLM.MISTRAL_API_KEY:
        raise Exception("Mistral API key not configured")

    max_retries = 3
    retry_delay = 1  # seconds

    # Format context chunks for the prompt
    context_text = ""
    for i, chunk in enumerate(context):
        context_text += f"\n--- CHUNK {i+1} ---\n{chunk['content']}\n"

    for attempt in range(max_retries):
        try:
            logger.debug(f"Generating Mistral response for query: '{query}'")

            headers = {
                "Authorization": f"Bearer {settings.LLM.MISTRAL_API_KEY}",
                "Content-Type": "application/json",
            }

            data = {
                "model": settings.LLM.MISTRAL_MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"QUERY: {query}\n\nCONTEXT:\n{context_text}"},
                ],
                "temperature": temperature,
            }

            if max_tokens:
                data["max_tokens"] = max_tokens

            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    "https://api.mistral.ai/v1/chat/completions", headers=headers, json=data
                )

                if response.status_code != 200:
                    raise Exception(
                        f"Mistral API returned status code {response.status_code}: {response.text}"
                    )

                result = response.json()
                response_text = result["choices"][0]["message"]["content"]

                logger.debug(
                    f"Successfully generated Mistral response of length {len(response_text)}"
                )
                return response_text

        except Exception as e:
            logger.error(
                f"Error generating Mistral response (attempt {attempt+1}/{max_retries}): {str(e)}"
            )

            if attempt < max_retries - 1:
                logger.info(f"Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff
            else:
                logger.error("All Mistral response generation attempts failed")
                raise Exception(
                    f"Failed to generate Mistral response after {max_retries} attempts"
                ) from e


async def generate_llm_response(
    query: str,
    context: List[Dict[str, Any]],
    provider: LLMProvider = LLMProvider.OPENAI,
    temperature: float = 0.3,
    max_tokens: Optional[int] = None,
) -> str:
    """
    Generate a response using the specified LLM provider.

    Args:
        query: The user's query
        context: List of context chunks from search results
        provider: The LLM provider to use
        temperature: Temperature setting (higher = more creative)
        max_tokens: Maximum tokens in the response

    Returns:
        str: Generated response

    Raises:
        Exception: If there is an error generating the response
    """
    # Create a system prompt
    system_prompt = """
    You are Recall's response generator. Your task is to provide a comprehensive 
    answer to the user's query based on the context provided.
    
    Guidelines:
    1. Only use information contained in the provided context chunks.
    2. If the context doesn't contain enough information to answer the query, 
       clearly state this limitation.
    3. Format your response in a clear and readable way, using markdown when appropriate.
    4. Do not reference the chunks directly in your answer.
    5. Do not include phrases like "Based on the provided context" or "According to the information given".
    6. Provide a direct, clear answer without unnecessary disclaimers.
    """

    logger.info(f"Generating response using {provider} provider for query: '{query}'")

    if provider == LLMProvider.OPENAI:
        return await generate_openai_response(
            query, context, system_prompt, temperature, max_tokens
        )
    elif provider == LLMProvider.ANTHROPIC:
        return await generate_anthropic_response(
            query, context, system_prompt, temperature, max_tokens
        )
    elif provider == LLMProvider.MISTRAL:
        return await generate_mistral_response(
            query, context, system_prompt, temperature, max_tokens
        )
    else:
        logger.warning(f"Unsupported LLM provider: {provider}, falling back to OpenAI")
        return await generate_openai_response(
            query, context, system_prompt, temperature, max_tokens
        )
