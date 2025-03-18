"""
Comprehensive Search Service for Semantic Buffer Search

This module provides an advanced search functionality using vector embeddings
and Supabase RPC for efficient, secure semantic searching.
"""

from typing import List, Dict, Any, Optional
import json
import uuid
from itertools import groupby
from operator import itemgetter

from app.db import get_supabase_client
from app.services.embedding_service import generate_embedding
from app.models.search import SearchQuery
from app.logging_config import get_logger

logger = get_logger(__name__)

async def get_user_accessible_buffers(supabase, user_id: str) -> List[str]:
    """
    Retrieve buffer IDs accessible to the user.

    Args:
        supabase: Supabase client
        user_id: ID of the user

    Returns:
        List of buffer IDs accessible to the user
    """
    logger.info(f"Retrieving accessible buffers for user {user_id}")
    
    try:
        # Step 1: Get buffers created by the user
        logger.debug("Fetching user's own buffers")
        user_buffers_query = (
            supabase.table("buffers")
            .select("id")
            .eq("user_id", user_id)
        )
        user_buffers_result = user_buffers_query.execute()
        user_buffer_ids = [
            str(buffer['id']) for buffer in user_buffers_result.data 
            if isinstance(buffer, dict) and 'id' in buffer
        ]
        logger.debug(f"Found {len(user_buffer_ids)} buffers created by user")

        # Step 2: Get bucket IDs where user is a member
        logger.debug("Fetching user's bucket memberships")
        bucket_members_query = (
            supabase.table("bucket_members")
            .select("bucket_id")
            .eq("user_id", user_id)
        )
        bucket_members_result = bucket_members_query.execute()
        bucket_ids = [
            str(member['bucket_id']) for member in bucket_members_result.data 
            if isinstance(member, dict) and 'bucket_id' in member
        ]
        logger.debug(f"Found {len(bucket_ids)} bucket memberships")

        # Step 3: Get buffer IDs from those buckets
        if bucket_ids:
            logger.debug("Fetching buffers from user's bucket memberships")
            bucket_buffers_query = (
                supabase.table("buffer_buckets")
                .select("buffer_id")
                .in_("bucket_id", bucket_ids)
            )
            bucket_buffers_result = bucket_buffers_query.execute()
            bucket_buffer_ids = [
                str(buffer['buffer_id']) for buffer in bucket_buffers_result.data 
                if isinstance(buffer, dict) and 'buffer_id' in buffer
            ]
            logger.debug(f"Found {len(bucket_buffer_ids)} buffers from bucket memberships")
        else:
            bucket_buffer_ids = []

        # Combine and deduplicate buffer IDs
        accessible_buffer_ids = list(set(user_buffer_ids + bucket_buffer_ids))
        logger.info(f"Total accessible buffers: {len(accessible_buffer_ids)}")
        
        return accessible_buffer_ids
    
    except Exception as e:
        logger.error(f"Error retrieving user accessible buffers: {str(e)}")
        return []

async def search_chunks(query: SearchQuery, user_id: str) -> Dict[str, Any]:
    """
    Perform a semantic search for buffer chunks.

    Args:
        query: Search query parameters
        user_id: ID of the user performing the search

    Returns:
        Dict containing search results
    """
    logger.info(f"Starting semantic search for user {user_id}")
    supabase = get_supabase_client()

    try:
        # Step 1: Generate embedding for the query
        logger.debug(f"Generating embedding for query: '{query.query}'")
        query_embedding = await generate_embedding(query.query)
        logger.debug(f"Embedding generated: {len(query_embedding)} dimensions")

        # Step 2: Get accessible buffer IDs
        logger.debug("Retrieving accessible buffer IDs")
        accessible_buffer_ids = await get_user_accessible_buffers(supabase, user_id)
        
        # If no accessible buffers, return empty results
        if not accessible_buffer_ids:
            logger.warning(f"No accessible buffers found for user {user_id}")
            return {
                "query": query.query,
                "results": []
            }

        # Step 3: Prepare search parameters for RPC
        logger.debug("Preparing search parameters")
        search_params = {
            "user_buffer_ids": accessible_buffer_ids,
            "query_embedding": query_embedding,
            "limit": query.limit,
            "include_outdated": query.include_outdated,
            "bucket_ids": query.bucket_ids or []
        }

        # Step 4: Execute semantic search via RPC
        logger.debug("Executing semantic search RPC")
        try:
            result = supabase.rpc('semantic_search_chunks', search_params).execute()
            results = result.data if hasattr(result, 'data') else result
        except Exception as exec_error:
            logger.error(f"Error executing search RPC: {str(exec_error)}")
            results = []

        # Step 5: Process search results
        logger.debug(f"Processing {len(results)} search results")
        processed_results = []
        for item in results:
            # Parse metadata safely
            metadata = item.get("metadata", {})
            if isinstance(metadata, str):
                try:
                    metadata = json.loads(metadata)
                except:
                    metadata = {}

            processed_results.append({
                "id": item["id"],
                "buffer_id": item["buffer_id"],
                "content": item["content"],
                "chunk_index": item["chunk_index"],
                "similarity": item["similarity"],
                "created_at": item["created_at"],
                "metadata": metadata,
            })

        logger.info(f"Found {len(processed_results)} chunk results for query")

        return {
            "query": query.query,
            "results": processed_results
        }

    except Exception as e:
        logger.error(f"Unexpected error in semantic search: {str(e)}")
        return {
            "query": query.query,
            "results": [],
            "error": str(e)
        }

async def search_buffers(query: SearchQuery, user_id: str) -> Dict[str, Any]:
    """
    Search for buffers and return both chunk-level and buffer-level results.

    Args:
        query: Search query parameters
        user_id: ID of the user performing the search

    Returns:
        Dict[str, Any]: Search results at both chunk and buffer levels
    """
    logger.info(f"Starting buffer search for user {user_id}")

    # Step 1: Get chunk results first
    logger.debug("Retrieving chunk results")
    chunk_search_result = await search_chunks(query, user_id)
    
    # If no chunks found, return empty results
    if not chunk_search_result.get('results'):
        logger.warning("No chunks found in search")
        return {
            "query": query.query,
            "chunk_results": [],
            "buffer_results": []
        }

    # Step 2: Group chunks by buffer
    logger.debug("Grouping chunks by buffer")
    sorted_chunks = sorted(
        chunk_search_result['results'], 
        key=lambda x: x['buffer_id']
    )

    # Step 3: Aggregate buffer results
    buffer_results = []
    for buffer_id, buffer_chunks in groupby(sorted_chunks, key=lambda x: x['buffer_id']):
        chunks = list(buffer_chunks)

        # Calculate buffer-level metrics
        avg_similarity = sum(chunk['similarity'] for chunk in chunks) / len(chunks)
        
        # Try to extract a title
        title = None
        for chunk in chunks:
            metadata = chunk.get('metadata', {})
            if metadata and 'title' in metadata:
                title = metadata['title']
                break

        # If no title found, use first chunk's content
        if not title and chunks:
            title = chunks[0]['content'].strip().split('\n')[0][:60]
            if len(title) == 60:
                title += '...'

        # Prepare buffer result
        buffer_result = {
            'id': buffer_id,
            'title': title,
            'chunks': sorted(chunks, key=lambda x: x['similarity'], reverse=True)[:3],
            'avg_similarity': avg_similarity,
            'created_at': chunks[0]['created_at']
        }

        buffer_results.append(buffer_result)

    # Step 4: Sort and limit buffer results
    logger.debug("Sorting and limiting buffer results")
    buffer_results.sort(key=lambda x: x['avg_similarity'], reverse=True)
    buffer_results = buffer_results[:query.limit]

    logger.info(f"Found {len(buffer_results)} buffer results")

    return {
        "query": query.query,
        "chunk_results": chunk_search_result['results'][:query.limit],
        "buffer_results": buffer_results
    }
