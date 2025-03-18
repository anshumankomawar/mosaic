"""
Buffer service for managing buffer content.

This module handles the creation, updating, and management of buffers,
including chunking and embedding generation.
"""

import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional

from app.db import get_supabase_client
from app.services.chunking_service import chunk_text
from app.services.embedding_service import generate_embedding, EmbeddingProvider
from app.models.buffer import BufferCreate, BufferUpdate, BufferMarkOutdated
from app.logging_config import get_logger
from app.config import get_settings

logger = get_logger(__name__)
settings = get_settings()


async def create_buffer(buffer: BufferCreate, user_id: str) -> Dict[str, Any]:
    """
    Create a new buffer with the given content.

    Args:
        buffer: Buffer creation model with content and bucket IDs
        user_id: ID of the user creating the buffer

    Returns:
        Dict[str, Any]: Created buffer data
    """
    supabase = get_supabase_client()

    logger.info(f"Creating new buffer for user {user_id}")

    # Generate a new UUID for the buffer
    buffer_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    # Insert buffer into database
    result = (
        supabase.table("buffers")
        .insert(
            {
                "id": buffer_id,
                "content": buffer.content,
                "user_id": user_id,
                "created_at": now,
                "version": 1,
                "is_active": True,
                "is_outdated": False,
            }
        )
        .execute()
    )

    if not result.data:
        logger.error(f"Failed to create buffer: {result.error}")
        raise Exception("Failed to create buffer")

    # Link to buckets if provided
    if buffer.bucket_ids:
        bucket_links = []
        for bucket_id in buffer.bucket_ids:
            # Check if bucket exists and user has access
            bucket = supabase.table("buckets").select("*").eq("id", bucket_id).execute()
            if not bucket.data:
                logger.warning(f"Bucket {bucket_id} not found, skipping association")
                continue

            # Check if user is a member of this bucket
            member = (
                supabase.table("bucket_members")
                .select("*")
                .eq("bucket_id", bucket_id)
                .eq("user_id", user_id)
                .execute()
            )

            if not member.data and bucket.data[0]["created_by"] != user_id:
                logger.warning(
                    f"User {user_id} does not have access to bucket {bucket_id}, skipping association"
                )
                continue

            bucket_links.append({"buffer_id": buffer_id, "bucket_id": bucket_id})

        if bucket_links:
            logger.debug(f"Associating buffer {buffer_id} with {len(bucket_links)} buckets")
            supabase.table("buffer_buckets").insert(bucket_links).execute()

    # Split buffer into chunks
    chunk_size = buffer.chunk_size or settings.CHUNKING.DEFAULT_CHUNK_SIZE
    chunk_overlap = buffer.chunk_overlap or settings.CHUNKING.DEFAULT_CHUNK_OVERLAP

    chunks = chunk_text(buffer.content, chunk_size, chunk_overlap)
    logger.info(f"Buffer {buffer_id} split into {len(chunks)} chunks")

    # Process and store chunks
    for i, chunk in enumerate(chunks):
        # Generate embedding for the chunk
        try:
            embedding = await generate_embedding(chunk["content"])

            # Store chunk with embedding
            supabase.table("buffer_chunks").insert(
                {
                    "id": chunk["id"],
                    "buffer_id": buffer_id,
                    "content": chunk["content"],
                    "chunk_index": chunk["chunk_index"],
                    "embedding": embedding,
                    "metadata": chunk["metadata"],
                    "created_at": chunk["created_at"],
                }
            ).execute()

        except Exception as e:
            logger.error(f"Error processing chunk {i} of buffer {buffer_id}: {str(e)}")
            # Continue with next chunk to ensure at least some are processed

    # Get bucket IDs for this buffer
    bucket_links = (
        supabase.table("buffer_buckets").select("bucket_id").eq("buffer_id", buffer_id).execute()
    )
    bucket_ids = [link["bucket_id"] for link in bucket_links.data]

    logger.info(f"Successfully created buffer {buffer_id} with {len(chunks)} chunks")

    return {
        "id": buffer_id,
        "content": buffer.content,
        "created_at": now,
        "user_id": user_id,
        "version": 1,
        "bucket_ids": bucket_ids,
        "is_outdated": False,
        "outdated_reason": None,
        "outdated_at": None,
        "parent_id": None,
        "chunk_count": len(chunks),
    }


async def update_buffer(buffer: BufferUpdate, user_id: str) -> Dict[str, Any]:
    """
    Update a buffer by creating a new version.

    Args:
        buffer: Buffer update model with new content and parent ID
        user_id: ID of the user updating the buffer

    Returns:
        Dict[str, Any]: Created buffer data

    Raises:
        Exception: If the parent buffer is not found or the user doesn't have access
    """
    supabase = get_supabase_client()

    logger.info(f"Updating buffer {buffer.parent_id} for user {user_id}")

    # Check if parent buffer exists and user has access
    parent = (
        supabase.table("buffers")
        .select("*")
        .eq("id", buffer.parent_id)
        .eq("user_id", user_id)
        .execute()
    )

    if not parent.data:
        logger.error(
            f"Parent buffer {buffer.parent_id} not found or user {user_id} doesn't have access"
        )
        raise Exception("Parent buffer not found or access denied")

    parent_data = parent.data[0]
    current_version = parent_data["version"]

    # Generate a new UUID for the buffer
    buffer_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    # Insert new version
    result = (
        supabase.table("buffers")
        .insert(
            {
                "id": buffer_id,
                "content": buffer.content,
                "user_id": user_id,
                "created_at": now,
                "parent_id": buffer.parent_id,
                "version": current_version + 1,
                "is_active": True,
                "is_outdated": False,
            }
        )
        .execute()
    )

    if not result.data:
        logger.error(f"Failed to update buffer: {result.error}")
        raise Exception("Failed to update buffer")

    # Copy bucket associations from parent
    bucket_links = (
        supabase.table("buffer_buckets")
        .select("bucket_id")
        .eq("buffer_id", buffer.parent_id)
        .execute()
    )

    if bucket_links.data:
        new_links = []
        for link in bucket_links.data:
            new_links.append({"buffer_id": buffer_id, "bucket_id": link["bucket_id"]})

        logger.debug(f"Copying {len(new_links)} bucket associations from parent buffer")
        supabase.table("buffer_buckets").insert(new_links).execute()

    # Get chunking parameters
    chunk_size = buffer.chunk_size or settings.CHUNKING.DEFAULT_CHUNK_SIZE
    chunk_overlap = buffer.chunk_overlap or settings.CHUNKING.DEFAULT_CHUNK_OVERLAP

    # Split buffer into chunks
    chunks = chunk_text(buffer.content, chunk_size, chunk_overlap)
    logger.info(f"Updated buffer {buffer_id} split into {len(chunks)} chunks")

    # Process and store chunks
    for i, chunk in enumerate(chunks):
        # Generate embedding for the chunk
        try:
            embedding = await generate_embedding(chunk["content"])

            # Store chunk with embedding
            supabase.table("buffer_chunks").insert(
                {
                    "id": chunk["id"],
                    "buffer_id": buffer_id,
                    "content": chunk["content"],
                    "chunk_index": chunk["chunk_index"],
                    "embedding": embedding,
                    "metadata": chunk["metadata"],
                    "created_at": chunk["created_at"],
                }
            ).execute()

        except Exception as e:
            logger.error(f"Error processing chunk {i} of buffer {buffer_id}: {str(e)}")
            # Continue with next chunk to ensure at least some are processed

    # Get bucket IDs for this buffer
    bucket_ids = [link["bucket_id"] for link in bucket_links.data]

    logger.info(
        f"Successfully created new version of buffer {buffer.parent_id} with ID {buffer_id}"
    )

    return {
        "id": buffer_id,
        "content": buffer.content,
        "created_at": now,
        "user_id": user_id,
        "version": current_version + 1,
        "bucket_ids": bucket_ids,
        "is_outdated": False,
        "outdated_reason": None,
        "outdated_at": None,
        "parent_id": buffer.parent_id,
        "chunk_count": len(chunks),
    }


async def mark_buffer_outdated(
    buffer_id: str, outdated_data: BufferMarkOutdated, user_id: str
) -> Dict[str, Any]:
    """
    Mark a buffer as outdated.

    Args:
        buffer_id: ID of the buffer to mark as outdated
        outdated_data: Data about why the buffer is outdated
        user_id: ID of the user marking the buffer as outdated

    Returns:
        Dict[str, Any]: Updated buffer data

    Raises:
        Exception: If the buffer is not found or the user doesn't have access
    """
    supabase = get_supabase_client()

    logger.info(f"Marking buffer {buffer_id} as outdated")

    # Check if buffer exists and user has access
    buffer = (
        supabase.table("buffers").select("*").eq("id", buffer_id).eq("user_id", user_id).execute()
    )

    if not buffer.data:
        logger.error(f"Buffer {buffer_id} not found or user {user_id} doesn't have access")
        raise Exception("Buffer not found or access denied")

    now = datetime.utcnow().isoformat()

    # Update buffer to mark as outdated
    result = (
        supabase.table("buffers")
        .update({"is_outdated": True, "outdated_reason": outdated_data.reason, "outdated_at": now})
        .eq("id", buffer_id)
        .execute()
    )

    if not result.data:
        logger.error(f"Failed to mark buffer as outdated: {result.error}")
        raise Exception("Failed to mark buffer as outdated")

    # Get bucket IDs for this buffer
    bucket_links = (
        supabase.table("buffer_buckets").select("bucket_id").eq("buffer_id", buffer_id).execute()
    )
    bucket_ids = [link["bucket_id"] for link in bucket_links.data]

    logger.info(f"Successfully marked buffer {buffer_id} as outdated")

    buffer_data = result.data[0]
    return {
        "id": buffer_id,
        "content": buffer_data["content"],
        "created_at": buffer_data["created_at"],
        "user_id": buffer_data["user_id"],
        "version": buffer_data["version"],
        "bucket_ids": bucket_ids,
        "is_outdated": True,
        "outdated_reason": outdated_data.reason,
        "outdated_at": now,
        "parent_id": buffer_data["parent_id"],
    }


async def soft_delete_buffer(buffer_id: str, user_id: str) -> Dict[str, Any]:
    """
    Soft delete a buffer by marking it as inactive.

    Args:
        buffer_id: ID of the buffer to delete
        user_id: ID of the user deleting the buffer

    Returns:
        Dict[str, Any]: Message indicating success

    Raises:
        Exception: If the buffer is not found or the user doesn't have access
    """
    supabase = get_supabase_client()

    logger.info(f"Soft deleting buffer {buffer_id} for user {user_id}")

    # Check if buffer exists and user has access
    buffer = (
        supabase.table("buffers").select("*").eq("id", buffer_id).eq("user_id", user_id).execute()
    )

    if not buffer.data:
        logger.error(f"Buffer {buffer_id} not found or user {user_id} doesn't have access")
        raise Exception("Buffer not found or access denied")

    # Mark as inactive
    result = supabase.table("buffers").update({"is_active": False}).eq("id", buffer_id).execute()

    if not result.data:
        logger.error(f"Failed to soft delete buffer: {result.error}")
        raise Exception("Failed to soft delete buffer")

    logger.info(f"Successfully soft deleted buffer {buffer_id}")

    return {"message": "Buffer marked as deleted"}


async def get_buffer_by_id(buffer_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    """
    Get a buffer by its ID.

    Args:
        buffer_id: ID of the buffer to retrieve
        user_id: ID of the user retrieving the buffer

    Returns:
        Optional[Dict[str, Any]]: Buffer data if found, None otherwise
    """
    supabase = get_supabase_client()

    logger.debug(f"Retrieving buffer {buffer_id}")

    # Get the buffer
    buffer = supabase.table("buffers").select("*").eq("id", buffer_id).execute()

    if not buffer.data:
        logger.warning(f"Buffer {buffer_id} not found")
        return None

    # Check if user has access
    buffer_data = buffer.data[0]

    if buffer_data["user_id"] != user_id:
        # Check if user is a member of any associated buckets
        bucket_links = (
            supabase.table("buffer_buckets")
            .select("bucket_id")
            .eq("buffer_id", buffer_id)
            .execute()
        )

        has_access = False
        for link in bucket_links.data:
            member = (
                supabase.table("bucket_members")
                .select("*")
                .eq("bucket_id", link["bucket_id"])
                .eq("user_id", user_id)
                .execute()
            )

            if member.data:
                has_access = True
                break

        if not has_access:
            logger.warning(f"User {user_id} does not have access to buffer {buffer_id}")
            return None

    # Get bucket IDs
    bucket_links = (
        supabase.table("buffer_buckets").select("bucket_id").eq("buffer_id", buffer_id).execute()
    )

    bucket_ids = [link["bucket_id"] for link in bucket_links.data]

    # Get chunk count
    chunks = supabase.table("buffer_chunks").select("id").eq("buffer_id", buffer_id).execute()

    chunk_count = len(chunks.data)

    # Combine data
    result = {**buffer_data, "bucket_ids": bucket_ids, "chunk_count": chunk_count}

    return result
