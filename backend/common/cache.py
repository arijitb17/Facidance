"""
backend/common/cache.py

Lightweight Redis caching layer for FastAPI services.
Caches JSON-serialisable responses with configurable TTL.
Falls back gracefully (no-op) if Redis is unavailable.

Usage:
    from backend.common.cache import cache_get, cache_set, cache_invalidate

    # In a read endpoint:
    cached = await cache_get(f"student:stats:{user_id}")
    if cached:
        return cached
    result = await expensive_db_call()
    await cache_set(f"student:stats:{user_id}", result, ttl=60)
    return result

    # In a write endpoint:
    await cache_invalidate(f"student:stats:{user_id}")
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

import redis.asyncio as redis

logger = logging.getLogger("cache")

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Default TTL in seconds (2 minutes — good balance for attendance data)
DEFAULT_TTL = 600

_pool: redis.Redis | None = None


async def _get_redis() -> redis.Redis:
    """Lazy-init a shared async Redis connection pool."""
    global _pool
    if _pool is None:
        _pool = redis.from_url(
            REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
    return _pool


async def cache_get(key: str) -> Any | None:
    """
    Retrieve a cached value by key.
    Returns the deserialised Python object, or None on miss / error.
    """
    try:
        r = await _get_redis()
        raw = await r.get(key)
        if raw is not None:
            logger.debug("CACHE HIT: %s", key)
            return json.loads(raw)
        logger.debug("CACHE MISS: %s", key)
    except Exception as e:
        logger.warning("Redis GET error (%s): %s", key, e)
    return None


async def cache_set(key: str, value: Any, ttl: int = DEFAULT_TTL) -> None:
    """
    Store a JSON-serialisable value with a TTL (seconds).
    Silently ignores errors so the app never breaks because of Redis.
    """
    try:
        r = await _get_redis()
        await r.setex(key, ttl, json.dumps(value, default=str))
        logger.debug("CACHE SET: %s (ttl=%ds)", key, ttl)
    except Exception as e:
        logger.warning("Redis SET error (%s): %s", key, e)


async def cache_invalidate(*keys: str) -> None:
    """
    Delete one or more cache keys.
    Supports glob patterns like "student:courses:*".
    """
    try:
        r = await _get_redis()
        for key in keys:
            if "*" in key:
                # Pattern-based deletion
                async for match in r.scan_iter(match=key, count=100):
                    await r.delete(match)
                logger.debug("CACHE INVALIDATE pattern: %s", key)
            else:
                await r.delete(key)
                logger.debug("CACHE INVALIDATE: %s", key)
    except Exception as e:
        logger.warning("Redis INVALIDATE error: %s", e)


async def cache_invalidate_user(user_id: str) -> None:
    """Invalidate all cached data for a specific user."""
    await cache_invalidate(f"student:*:{user_id}", f"teacher:*:{user_id}")
