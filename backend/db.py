"""
db.py — MongoDB connection via Motor (async).

Set MONGO_URI and MONGO_DB_NAME in your .env file.
Call `get_db()` from any repo to get a database handle.
"""

import os
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        uri = os.environ.get("MONGO_URI", "mongodb://localhost:27017")
        _client = AsyncIOMotorClient(uri)
    return _client


def get_db() -> AsyncIOMotorDatabase:
    client = get_client()
    db_name = os.environ.get("MONGO_DB_NAME", "food_ordering")
    return client[db_name]


async def close_client() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None