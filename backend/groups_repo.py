

from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import Optional
import uuid

from pymongo import ReturnDocument, DESCENDING

from db import get_db
from users_repo import UsersRepo



@dataclass
class OrderItem:
    user_id: str
    description: str
    price: float
    paid: bool = False

    def to_doc(self) -> dict:
        return {"description": self.description, "price": self.price, "paid": self.paid}


@dataclass
class PaymentInfo:
    method: str    # cash | venmo | paypal | zelle | other
    timing: str    # before | after
    handle: Optional[str] = None

    def to_doc(self) -> dict:
        return {"method": self.method, "timing": self.timing, "handle": self.handle}


@dataclass
class Group:
    group_id: str
    status: str
    restaurant: str
    leader_id: str
    order_by: datetime
    arrival_time: datetime
    payment: PaymentInfo
    members: list[str] = field(default_factory=list)
    orders: dict[str, OrderItem] = field(default_factory=dict)
    created_at: datetime = None

    @classmethod
    def from_doc(cls, doc: dict) -> "Group":
        payment = PaymentInfo(
            method=doc["payment"]["method"],
            timing=doc["payment"]["timing"],
            handle=doc["payment"].get("handle"),
        )
        orders = {
            uid: OrderItem(
                user_id=uid,
                description=o["description"],
                price=o["price"],
                paid=o.get("paid", False),
            )
            for uid, o in doc.get("orders", {}).items()
        }
        return cls(
            group_id=doc["_id"],
            status=doc["status"],
            restaurant=doc["restaurant"],
            leader_id=doc["leader_id"],
            order_by=doc["order_by"],
            arrival_time=doc["arrival_time"],
            payment=payment,
            members=doc.get("members", []),
            orders=orders,
            created_at=doc.get("created_at"),
        )

    def to_api_dict(self, users: dict) -> dict:
        return {
            "group_id":       self.group_id,
            "status":         self.status,
            "restaurant":     self.restaurant,
            "leader_id":      self.leader_id,
            "leader_name":    users[self.leader_id].name if self.leader_id in users else "Unknown",
            "order_by":       self.order_by.isoformat(),
            "arrival_time":   self.arrival_time.isoformat(),
            "payment_method": self.payment.method,
            "payment_timing": self.payment.timing,
            "payment_handle": self.payment.handle,
            "member_count":   len(self.members),
            "members": [
                {"user_id": uid, "user_name": users[uid].name if uid in users else uid}
                for uid in self.members
            ],
            "orders": [
                {
                    "user_id":     uid,
                    "user_name":   users[uid].name if uid in users else uid,
                    "description": o.description,
                    "price":       o.price,
                    "paid":        o.paid,
                }
                for uid, o in self.orders.items()
            ],
        }


# ── Repository ────────────────────────────────────────────────────────────────

class GroupsRepo:

    def __init__(self, users_repo: UsersRepo):
        self._users = users_repo

    def _col(self):
        return get_db()["groups"]

    # -- Creation ---------------------------------------------------------

    async def create_group(
            self,
            leader_id: str,
            restaurant: str,
            order_by: datetime,
            arrival_time: datetime,
            payment_method: str,
            payment_timing: str,
            payment_handle: Optional[str] = None,
    ) -> Group:
        if not await self._users.exists(leader_id):
            raise KeyError(f"User '{leader_id}' is not registered.")
        if order_by >= arrival_time:
            raise ValueError("order_by must be before arrival_time.")

        group_id = uuid.uuid4().hex[:8]
        doc = {
            "_id":        group_id,
            "status":     "open",
            "restaurant": restaurant,
            "leader_id":  leader_id,
            "order_by":   order_by,
            "arrival_time": arrival_time,
            "payment": {
                "method": payment_method,
                "timing": payment_timing,
                "handle": payment_handle,
            },
            "members":    [leader_id],
            "orders":     {},
            "created_at": datetime.now(timezone.utc),
        }
        await self._col().insert_one(doc)
        await self._users.record_led_group(leader_id)
        return Group.from_doc(doc)


    async def join_group(self, group_id: str, user_id: str) -> Group:
        group = await self._get_open(group_id)
        if user_id in group.members:
            raise ValueError(f"User '{user_id}' is already in this group.")
        if not await self._users.exists(user_id):
            raise KeyError(f"User '{user_id}' is not registered.")

        doc = await self._col().find_one_and_update(
            {"_id": group_id, "status": "open"},
            {"$addToSet": {"members": user_id}},
            return_document=ReturnDocument.AFTER,
        )
        return Group.from_doc(doc)

    async def leave_group(self, group_id: str, user_id: str) -> None:
        group = await self._get_open(group_id)
        if user_id == group.leader_id:
            raise ValueError("Leader cannot leave — transfer leadership or disband first.")
        await self._col().update_one(
            {"_id": group_id},
            {
                "$pull":  {"members": user_id},
                "$unset": {f"orders.{user_id}": ""},
            },
        )


    async def add_order(
            self, group_id: str, user_id: str, description: str, price: float
    ) -> OrderItem:
        group = await self._get_open(group_id)
        if user_id not in group.members:
            raise ValueError("User must join the group before ordering.")

        item_doc = {"description": description, "price": price, "paid": False}
        await self._col().update_one(
            {"_id": group_id},
            {"$set": {f"orders.{user_id}": item_doc}},
        )
        return OrderItem(user_id=user_id, **item_doc)

    async def remove_order(self, group_id: str, user_id: str) -> None:
        await self._get_open(group_id)
        await self._col().update_one(
            {"_id": group_id},
            {"$unset": {f"orders.{user_id}": ""}},
        )

    async def mark_paid(self, group_id: str, user_id: str) -> None:
        await self._col().update_one(
            {"_id": group_id},
            {"$set": {f"orders.{user_id}.paid": True}},
        )


    async def lock_group(self, group_id: str, requester_id: str) -> None:
        group = await self._get_open(group_id)
        self._assert_leader(group, requester_id)

        await self._col().update_one(
            {"_id": group_id},
            {"$set": {"status": "locked"}},
        )
        # Record an order for every member who submitted one
        for uid in group.orders:
            await self._users.record_order(uid)

    async def complete_group(self, group_id: str, requester_id: str) -> None:
        group = await self.get_group(group_id)
        if group.status != "locked":
            raise ValueError("Group must be locked before completing.")
        self._assert_leader(group, requester_id)
        await self._col().update_one(
            {"_id": group_id},
            {"$set": {"status": "completed"}},
        )

    async def disband_group(self, group_id: str, requester_id: str) -> None:
        group = await self.get_group(group_id)
        self._assert_leader(group, requester_id)
        await self._col().delete_one({"_id": group_id})

    async def transfer_leadership(
            self, group_id: str, current_leader_id: str, new_leader_id: str
    ) -> None:
        group = await self._get_open(group_id)
        self._assert_leader(group, current_leader_id)
        if new_leader_id not in group.members:
            raise ValueError("New leader must already be a group member.")
        await self._col().update_one(
            {"_id": group_id},
            {"$set": {"leader_id": new_leader_id}},
        )
        await self._users.record_led_group(new_leader_id)


    async def get_group(self, group_id: str) -> Group:
        doc = await self._col().find_one({"_id": group_id})
        if doc is None:
            raise KeyError(f"No group found with id '{group_id}'.")
        return Group.from_doc(doc)

    async def get_group_with_users(self, group_id: str) -> dict:
        group = await self.get_group(group_id)
        users = await self._users.get_many(group.members)
        return group.to_api_dict(users)

    async def open_groups_with_users(self, current_user_id: str) -> list[dict]:
        """All open groups, serialized with user names and a has_ordered flag."""
        cursor = self._col().find({"status": "open"}).sort("created_at", DESCENDING)
        results = []
        async for doc in cursor:
            group = Group.from_doc(doc)
            users = await self._users.get_many(group.members)
            d = group.to_api_dict(users)
            d["has_ordered"] = current_user_id in group.orders
            d["is_member"] = current_user_id in group.members
            results.append(d)
        return results


    async def _get_open(self, group_id: str) -> Group:
        group = await self.get_group(group_id)
        if group.status != "open":
            raise ValueError(f"Group '{group_id}' is not open for changes.")
        return group

    @staticmethod
    def _assert_leader(group: Group, user_id: str) -> None:
        if group.leader_id != user_id:
            raise PermissionError("Only the group leader can perform this action.")