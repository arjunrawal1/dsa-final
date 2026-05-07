"""
users_repo.py — MongoDB-backed user storage.

Replaces the in-memory UserRegistry from users.py.
Each document in the `users` collection looks like:

{
    "_id":               "auth0|abc123",   # Auth0 user_id (sub) as the primary key
    "name":              "Priya",
    "email":             "priya@ncssm.edu",
    "orders_completed":  4,
    "strikes":           0,
    "times_been_leader": 2,
    "created_at":        <datetime>
}
"""

from datetime import datetime, timezone
from dataclasses import dataclass
from typing import Optional

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from db import get_db



@dataclass
class UserProfile:
    user_id: str
    name: str
    email: str
    orders_completed: int = 0
    strikes: int = 0
    times_been_leader: int = 0
    created_at: datetime = None

    @classmethod
    def from_doc(cls, doc: dict) -> "UserProfile":
        return cls(
            user_id=doc["_id"],
            name=doc["name"],
            email=doc["email"],
            orders_completed=doc.get("orders_completed", 0),
            strikes=doc.get("strikes", 0),
            times_been_leader=doc.get("times_been_leader", 0),
            created_at=doc.get("created_at"),
        )

    def to_dict(self) -> dict:
        return {
            "user_id": self.user_id,
            "name": self.name,
            "email": self.email,
            "orders_completed": self.orders_completed,
            "strikes": self.strikes,
            "times_been_leader": self.times_been_leader,
        }



class UsersRepo:

    def _col(self):
        return get_db()["users"]


    async def upsert_from_auth(self, user_id: str, name: str, email: str) -> UserProfile:
        """
        Called on every login via Auth0.
        Creates the user if they don't exist; updates name/email if they do.
        Never resets counters.
        """
        doc = await self._col().find_one_and_update(
            {"_id": user_id},
            {
                "$set":         {"name": name, "email": email},
                "$setOnInsert": {
                    "orders_completed":  0,
                    "strikes":           0,
                    "times_been_leader": 0,
                    "created_at":        datetime.now(timezone.utc),
                },
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        return UserProfile.from_doc(doc)


    async def get(self, user_id: str) -> UserProfile:
        doc = await self._col().find_one({"_id": user_id})
        if doc is None:
            raise KeyError(f"No user found with id '{user_id}'.")
        return UserProfile.from_doc(doc)

    async def get_many(self, user_ids: list[str]) -> dict[str, UserProfile]:
        """Batch fetch — returns a dict keyed by user_id."""
        cursor = self._col().find({"_id": {"$in": user_ids}})
        return {doc["_id"]: UserProfile.from_doc(doc) async for doc in cursor}

    async def exists(self, user_id: str) -> bool:
        return await self._col().count_documents({"_id": user_id}, limit=1) > 0

    # -- Mutations (atomic increments) ------------------------------------

    async def record_order(self, user_id: str) -> None:
        await self._col().update_one(
            {"_id": user_id},
            {"$inc": {"orders_completed": 1}},
        )

    async def add_strike(self, user_id: str) -> None:
        await self._col().update_one(
            {"_id": user_id},
            {"$inc": {"strikes": 1}},
        )

    async def record_led_group(self, user_id: str) -> None:
        await self._col().update_one(
            {"_id": user_id},
            {"$inc": {"times_been_leader": 1}},
        )