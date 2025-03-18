"""Database initialization and client access."""

from app.db.supabase import get_supabase_client
from app.db.cache import get_cache_client, cached

__all__ = ["get_supabase_client", "get_cache_client", "cached"]
