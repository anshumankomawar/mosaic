"""
Redis cache client for the Recall API.

This module provides cache functionality for improving performance.
"""

import json
import redis
from typing import Any, Optional, Dict, Union
from functools import lru_cache
import time

from app.config import get_settings
from app.logging_config import get_logger

logger = get_logger(__name__)
settings = get_settings()


class CacheClient:
    """Client for interacting with the Redis cache."""

    def __init__(self, redis_url: str, enabled: bool = True, ttl: int = 3600):
        """
        Initialize the cache client.

        Args:
            redis_url: Redis connection URL
            enabled: Whether the cache is enabled
            ttl: Default time-to-live for cache entries in seconds
        """
        self.enabled = enabled
        self.ttl = ttl

        if enabled:
            try:
                self.redis = redis.from_url(redis_url)
                logger.info("Redis cache initialized")
            except Exception as e:
                logger.error(f"Failed to initialize Redis cache: {str(e)}")
                self.enabled = False
                self.redis = None
        else:
            self.redis = None

    def get(self, key: str) -> Optional[Any]:
        """
        Get a value from the cache.

        Args:
            key: Cache key

        Returns:
            Optional[Any]: Value if found, None otherwise
        """
        if not self.enabled or not self.redis:
            return None

        try:
            value = self.redis.get(key)
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            logger.warning(f"Cache get error for key '{key}': {str(e)}")
            return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """
        Set a value in the cache.

        Args:
            key: Cache key
            value: Value to store
            ttl: Time-to-live in seconds (overrides default)

        Returns:
            bool: True if successful, False otherwise
        """
        if not self.enabled or not self.redis:
            return False

        try:
            ttl = ttl or self.ttl
            return self.redis.setex(key, ttl, json.dumps(value, default=str))
        except Exception as e:
            logger.warning(f"Cache set error for key '{key}': {str(e)}")
            return False

    def delete(self, key: str) -> bool:
        """
        Delete a value from the cache.

        Args:
            key: Cache key

        Returns:
            bool: True if successful, False otherwise
        """
        if not self.enabled or not self.redis:
            return False

        try:
            return bool(self.redis.delete(key))
        except Exception as e:
            logger.warning(f"Cache delete error for key '{key}': {str(e)}")
            return False

    def clear(self, pattern: str = "*") -> bool:
        """
        Clear cache entries matching a pattern.

        Args:
            pattern: Redis key pattern to match

        Returns:
            bool: True if successful, False otherwise
        """
        if not self.enabled or not self.redis:
            return False

        try:
            cursor = 0
            while True:
                cursor, keys = self.redis.scan(cursor, pattern, 100)
                if keys:
                    self.redis.delete(*keys)
                if cursor == 0:
                    break
            return True
        except Exception as e:
            logger.warning(f"Cache clear error for pattern '{pattern}': {str(e)}")
            return False


@lru_cache()
def get_cache_client() -> CacheClient:
    """
    Get or create a cache client instance.

    Returns:
        CacheClient: Initialized cache client
    """
    return CacheClient(
        redis_url=settings.REDIS_URL, enabled=settings.ENABLE_CACHE, ttl=settings.CACHE_TTL_SECONDS
    )


async def cached(key_prefix: str, cache_key_fn=None, ttl: Optional[int] = None):
    """
    Decorator for caching async function results.

    Args:
        key_prefix: Prefix for cache keys
        cache_key_fn: Function to generate cache key from args/kwargs
        ttl: Time-to-live for cache entries

    Returns:
        Decorator function
    """

    def decorator(func):
        async def wrapper(*args, **kwargs):
            cache = get_cache_client()

            if not cache.enabled:
                return await func(*args, **kwargs)

            # Generate cache key
            if cache_key_fn:
                cache_key = f"{key_prefix}:{cache_key_fn(*args, **kwargs)}"
            else:
                # Default key generation - use args and kwargs
                arg_str = ",".join(str(arg) for arg in args)
                kwarg_str = ",".join(f"{k}:{v}" for k, v in sorted(kwargs.items()))
                cache_key = f"{key_prefix}:{arg_str}:{kwarg_str}"

            # Try to get from cache
            cached_value = cache.get(cache_key)
            if cached_value is not None:
                logger.debug(f"Cache hit for key: {cache_key}")
                return cached_value

            # Not in cache, call function
            logger.debug(f"Cache miss for key: {cache_key}")
            start_time = time.time()
            result = await func(*args, **kwargs)
            execution_time = time.time() - start_time

            # Store in cache
            cache.set(cache_key, result, ttl)
            logger.debug(
                f"Cached result for key: {cache_key} (execution time: {execution_time:.3f}s)"
            )

            return result

        return wrapper

    return decorator
