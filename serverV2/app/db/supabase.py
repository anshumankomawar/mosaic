"""
Supabase client configuration and initialization.

Provides access to the Supabase client for database operations.
"""

from functools import lru_cache
from os import walk
from supabase import create_client, Client

from app.config import get_settings
from app.logging_config import get_logger

logger = get_logger(__name__)
settings = get_settings()


@lru_cache()
def get_supabase_client() -> Client:
    """
    Create and cache a Supabase client instance.

    Returns:
        Client: Initialized Supabase client
    """
    logger.debug("Initializing Supabase client")
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
