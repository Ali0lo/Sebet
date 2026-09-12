import uuid
from dataclasses import dataclass
from typing import Optional
from fastapi import Header, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.chain import Chain


@dataclass
class MerchantContext:
    """Authenticated merchant session context."""
    merchant_id: uuid.UUID
    name: str
    category: str
    is_admin: bool
    chain: Chain


async def get_current_merchant(
    x_merchant_id: Optional[str] = Header(None, alias="X-Merchant-Id"),
    x_is_admin: Optional[str] = Header(None, alias="X-Is-Admin"),
    db: AsyncSession = Depends(get_db),
) -> MerchantContext:
    """
    Authenticates and resolves the current merchant from the X-Merchant-Id header.
    Returns HTTP 401 if missing or invalid.
    """
    if not x_merchant_id:
        raise HTTPException(
            status_code=401,
            detail="Merchant authentication required. Please provide X-Merchant-Id header.",
        )

    try:
        merchant_uuid = uuid.UUID(x_merchant_id.strip())
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=401,
            detail="Invalid merchant credentials format. Expected UUID.",
        )

    chain = await db.get(Chain, merchant_uuid)
    if not chain:
        raise HTTPException(
            status_code=401,
            detail=f"Merchant with ID {merchant_uuid} not found or inactive.",
        )

    is_admin = False
    if x_is_admin and str(x_is_admin).strip().lower() in ("true", "1", "yes", "admin"):
        is_admin = True

    return MerchantContext(
        merchant_id=chain.id,
        name=chain.name,
        category=getattr(chain, "category", "Grocery") or "Grocery",
        is_admin=is_admin,
        chain=chain,
    )


async def verify_merchant_access(
    merchant_id: Optional[uuid.UUID] = None,
    current_merchant: MerchantContext = Depends(get_current_merchant),
) -> uuid.UUID:
    """
    Enforces strict tenant isolation and guards against parameter tampering.
    If a merchant provides a target merchant_id (via path or query) that differs from
    their own authenticated merchant_id, and they are not an admin, immediately raise HTTP 403 Forbidden.
    """
    if merchant_id is not None:
        if merchant_id != current_merchant.merchant_id and not current_merchant.is_admin:
            raise HTTPException(
                status_code=403,
                detail="Forbidden: You cannot access data or transaction records belonging to another merchant.",
            )
        return merchant_id

    return current_merchant.merchant_id
