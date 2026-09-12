import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import User
from app.schemas.store import UserOut, RedeemRequest, RedeemResponse
from app.services.ledger_service import (
    record_redeem_transaction,
    record_earn_transaction,
    get_user_points_balance,
    InsufficientPointsError,
)
from decimal import Decimal

router = APIRouter(prefix="/users", tags=["users"])

AVAILABLE_REWARDS = [
    {
        "id": "reward-coffee",
        "title": "Gloria Jean's — Pulsuz Qəhvə Kuponu",
        "points_cost": 200,
        "category": "Kafe & Restoran",
        "icon": "Coffee",
        "id": "reward-beverage",
        "title": "1 Pulsuz Sərinləşdirici İçki (Sirab / Badamlı / Şirə)",
        "points_cost": 150,
        "category": "Market Hədiyyəsi",
        "icon": "CupSoda",
    },
    {
        "id": "reward-azercell",
        "title": "Azercell / Bakcell — 2 AZN Balans",
        "points_cost": 300,
        "category": "Mobil Rabitə",
        "icon": "PhoneCall",
        "id": "reward-icecream",
        "title": "1 Pulsuz Qaymaqlı Dondurma (Plombir / Eskimo)",
        "points_cost": 150,
        "category": "Market Hədiyyəsi",
        "icon": "IceCream",
    },
    {
        "id": "reward-cinema",
        "title": "Park Cinema — 1 Ədəd Film Bileti",
        "points_cost": 500,
        "category": "Əyləncə",
        "icon": "Film",
        "id": "reward-chocolate",
        "title": "1 Pulsuz Şokolad və ya Şirniyyat (Alpen Gold / KitKat)",
        "points_cost": 200,
        "category": "Market Hədiyyəsi",
        "icon": "Gift",
    },
    {
        "id": "reward-bolt",
        "title": "Bolt Taksi — 3 AZN Endirim Kuponu",
        "points_cost": 350,
        "category": "Nəqliyyat",
        "icon": "Car",
        "id": "reward-voucher-5azn",
        "title": "Marketlərdə 5 AZN Endirim Çeki",
        "points_cost": 400,
        "category": "Market Çeki",
        "icon": "ShoppingBag",
    },
]


@router.get("/me", response_model=UserOut)
async def get_current_user(db: AsyncSession = Depends(get_db)):
    """
    Returns demo user profile and SebEt points balance backed by double-entry ledger.
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

    # Synchronize ledger points
    ledger_points = await get_user_points_balance(db, user.id)
    if ledger_points == 0 and user.sebet_points > 0:
        await record_earn_transaction(
            db=db,
            user_id=user.id,
            purchase_amount=(Decimal(user.sebet_points) / Decimal("3")).quantize(Decimal("0.01")),
            merchant_name="Welcome Promo Fund",
            earn_rate=Decimal("0.03"),
            platform_fee=Decimal("0.00"),
            description="Initial welcome points allocation",
        )
        await db.commit()
        ledger_points = await get_user_points_balance(db, user.id)

    return UserOut(
        id=user.id,
        phone_number=user.phone_number,
        full_name=user.full_name,
        sebet_points=ledger_points,
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
    Redeems SebEt points for partner vouchers using ACID double-entry transactions.
    """
    stmt = select(User)
    res = await db.execute(stmt)
    user = res.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    # Ensure user has points in ledger if legacy sebet_points exists
    ledger_points = await get_user_points_balance(db, user.id)
    if ledger_points == 0 and user.sebet_points > 0:
        await record_earn_transaction(
            db=db,
            user_id=user.id,
            purchase_amount=(Decimal(user.sebet_points) / Decimal("3")).quantize(Decimal("0.01")),
            merchant_name="Welcome Promo Fund",
            earn_rate=Decimal("0.03"),
            platform_fee=Decimal("0.00"),
            description="Initial welcome points allocation",
        )
        await db.commit()

    try:
        merchant_name = payload.title.split("—")[0].strip() if "—" in payload.title else "Partner Merchant"
        tx, merchant_net, fee, voucher_code = await record_redeem_transaction(
            db=db,
            user_id=user.id,
            points_to_redeem=payload.points_cost,
            merchant_name=merchant_name,
            servicing_fee_rate=Decimal("0.05"),
            description=f"Redeemed for {payload.title}",
        )
        await db.commit()
        remaining_points = await get_user_points_balance(db, user.id)

        return RedeemResponse(
            success=True,
            voucher_code=voucher_code,
            remaining_points=remaining_points,
            reward_title=payload.title,
            message=f"Təbriklər! {payload.title} kuponunuz aktivdir.",
        )
    except InsufficientPointsError as ipe:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(ipe))
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


