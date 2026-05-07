from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from db import close_client
from users_repo import UsersRepo
from groups_repo import GroupsRepo

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield                  # app runs
    await close_client()   # clean shutdown

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],   # add your prod domain here
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



users_repo = UsersRepo()
groups_repo = GroupsRepo(users_repo)



async def current_user_id(x_user_id: str = Header(...)) -> str:
    return x_user_id



class UpsertUserBody(BaseModel):
    name: str
    email: str

class CreateGroupBody(BaseModel):
    restaurant: str
    order_by: datetime
    arrival_time: datetime
    payment_method: str
    payment_timing: str
    payment_handle: Optional[str] = None

class AddOrderBody(BaseModel):
    description: str
    price: float

class MarkPaidBody(BaseModel):
    user_id: str

class TransferLeaderBody(BaseModel):
    new_leader_id: str



@app.post("/users/upsert")
async def upsert_user(body: UpsertUserBody, uid: str = Depends(current_user_id)):
    """Called from Next.js after every Auth0 login to ensure the user exists in MongoDB."""
    profile = await users_repo.upsert_from_auth(uid, body.name, body.email)
    return profile.to_dict()

@app.get("/users/me")
async def get_me(uid: str = Depends(current_user_id)):
    try:
        profile = await users_repo.get(uid)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return profile.to_dict()



@app.get("/groups")
async def list_groups(uid: str = Depends(current_user_id)):
    groups = await groups_repo.open_groups_with_users(uid)
    return {"groups": groups}

@app.post("/groups")
async def create_group(body: CreateGroupBody, uid: str = Depends(current_user_id)):
    try:
        group = await groups_repo.create_group(
            leader_id=uid,
            restaurant=body.restaurant,
            order_by=body.order_by,
            arrival_time=body.arrival_time,
            payment_method=body.payment_method,
            payment_timing=body.payment_timing,
            payment_handle=body.payment_handle,
        )
    except (KeyError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"group_id": group.group_id}

@app.get("/groups/{group_id}")
async def get_group(group_id: str, uid: str = Depends(current_user_id)):
    try:
        data = await groups_repo.get_group_with_users(group_id)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    data["current_user_id"] = uid
    return data

@app.post("/groups/{group_id}/join")
async def join_group(group_id: str, uid: str = Depends(current_user_id)):
    try:
        await groups_repo.join_group(group_id, uid)
    except (KeyError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True}

@app.post("/groups/{group_id}/order")
async def add_order(group_id: str, body: AddOrderBody, uid: str = Depends(current_user_id)):
    try:
        await groups_repo.add_order(group_id, uid, body.description, body.price)
    except (KeyError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True}

@app.post("/groups/{group_id}/lock")
async def lock_group(group_id: str, uid: str = Depends(current_user_id)):
    try:
        await groups_repo.lock_group(group_id, uid)
    except (KeyError, ValueError, PermissionError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True}

@app.post("/groups/{group_id}/complete")
async def complete_group(group_id: str, uid: str = Depends(current_user_id)):
    try:
        await groups_repo.complete_group(group_id, uid)
    except (KeyError, ValueError, PermissionError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True}

@app.post("/groups/{group_id}/paid")
async def mark_paid(group_id: str, body: MarkPaidBody, uid: str = Depends(current_user_id)):
    try:
        await groups_repo.mark_paid(group_id, body.user_id)
    except (KeyError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True}

@app.post("/groups/{group_id}/transfer")
async def transfer_leadership(
        group_id: str, body: TransferLeaderBody, uid: str = Depends(current_user_id)
):
    try:
        await groups_repo.transfer_leadership(group_id, uid, body.new_leader_id)
    except (KeyError, ValueError, PermissionError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True}