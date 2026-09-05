import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import User
from app.schemas.store import UserOut, RedeemRequest, RedeemResponse

router = APIRouter(prefix="/users", tags=["users"])

AVAILABLE_REWARDS = [
    {
        "id": "reward-coffee",
        "title": "Gloria Jean's — Pulsuz Qəhvə Kuponu",
        "points_cost": 200,
        "category": "Kafe & Restoran",
        "icon": "Coffee",
    },
    {
        "id": "reward-azercell",
        "title": "Azercell / Bakcell — 2 AZN Balans",
        "points_cost": 300,
        "category": "Mobil Rabitə",
        "icon": "PhoneCall",
    },
    {
        "id": "reward-cinema",
        "title": "Park Cinema — 1 Ədəd Film Bileti",
        "points_cost": 500,
        "category": "Əyləncə",
        "icon": "Film",
    },
    {
        "id": "reward-bolt",
        "title": "Bolt Taksi — 3 AZN Endirim Kuponu",
        "points_cost": 350,
        "category": "Nəqliyyat",
        "icon": "Car",
    },
]


@router.get("/me", response_model=UserOut)
async def get_current_user(db: AsyncSession = Depends(get_db)):
    """
    Returns demo user profile and SebEt points balance.
    """
    stmt = select(User)
    res = await db.execute(stmt)
    user = res.scalars().first()
    if not user:
        # Create default user if not exists
        user = User(
            phone_number="+994501234567",
            full_name="Ali Iskandarli",
            sebet_points=250,
        )
        db.add(user)
        await db.commit()

    return UserOut(
        id=user.id,
        phone_number=user.phone_number,
        full_name=user.full_name,
        sebet_points=user.sebet_points,
    )


@router.get("/rewards")
async def list_available_rewards():
    """
    Lists rewards redeemable with SebEt points.
    """
    return AVAILABLE_REWARDS


@router.post("/redeem", response_model=RedeemResponse)
async def redeem_reward(payload: RedeemRequest, db: AsyncSession = Depends(get_db)):
    """
    Redeems SebEt points for partner vouchers (coffee, mobile balance, cinema).
    """
    stmt = select(User)
    res = await db.execute(stmt)
    user = res.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user.sebet_points < payload.points_cost:
        raise HTTPException(
            status_code=400,
            detail=f"Kifayət qədər bal yoxdur! Tələb olunan: {payload.points_cost}, Sizin balınız: {user.sebet_points}",
        )

    user.sebet_points -= payload.points_cost
    await db.commit()

    voucher_code = f"SEBET-{uuid.uuid4().hex[:6].upper()}"

    return RedeemResponse(
        success=True,
        voucher_code=voucher_code,
        remaining_points=user.sebet_points,
        reward_title=payload.title,
        message=f"Təbriklər! {payload.title} kuponunuz aktivdir.",
    )

