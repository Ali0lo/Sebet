import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List, Tuple
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.ledger import (
    LedgerAccount,
    LedgerTransaction,
    LedgerEntry,
    AccountCategory,
    TransactionType,
    TransactionStatus,
    EntryDirection,
)

POINTS_PER_DOLLAR = Decimal("100")
DOLLARS_PER_POINT = Decimal("0.01")


class LedgerError(Exception):
    """Base exception for ledger operations."""
    pass


class UnbalancedTransactionError(LedgerError):
    """Raised when sum(debits) != sum(credits) in a transaction."""
    pass


class InsufficientPointsError(LedgerError):
    """Raised when a user attempts to redeem more points than available."""
    pass


class AccountNotFoundError(LedgerError):
    """Raised when a specified ledger account does not exist."""
    pass


def assert_balanced_entries(entries: List[LedgerEntry]) -> None:
    """
    Enforces the fundamental double-entry invariant: Sum(Debits) == Sum(Credits).
    """
    total_debits = Decimal("0.0000")
    total_credits = Decimal("0.0000")

    for entry in entries:
        if entry.amount <= Decimal("0"):
            raise UnbalancedTransactionError(f"Entry amount must be positive: got {entry.amount}")
        if entry.direction == EntryDirection.DEBIT:
            total_debits += entry.amount
        elif entry.direction == EntryDirection.CREDIT:
            total_credits += entry.amount
        else:
            raise UnbalancedTransactionError(f"Invalid entry direction: {entry.direction}")

    discrepancy = abs(total_debits - total_credits)
    if discrepancy > Decimal("0.00001"):
        raise UnbalancedTransactionError(
            f"Double-entry violation! Total Debits (${total_debits:.4f}) != Total Credits (${total_credits:.4f}). "
            f"Discrepancy: ${discrepancy:.4f}"
        )


async def get_or_create_user_points_account(
    db: AsyncSession, user_id: uuid.UUID, user_name: Optional[str] = None
) -> LedgerAccount:
    """
    Retrieves or initializes the liability account representing the platform's
    point obligations to a specific user.
    """
    code = f"USR-PTS-{user_id}"
    stmt = select(LedgerAccount).where(LedgerAccount.account_code == code)
    account = (await db.execute(stmt)).scalar_one_or_none()

    if not account:
        account = LedgerAccount(
            account_code=code,
            name=f"User Points Liability - {user_name or str(user_id)[:8]}",
            category=AccountCategory.LIABILITY,
            currency="USD",
            user_id=user_id,
        )
        db.add(account)
        await db.flush()

    return account


async def get_or_create_merchant_account(
    db: AsyncSession,
    merchant_id: Optional[uuid.UUID],
    merchant_name: Optional[str] = None,
    category: AccountCategory = AccountCategory.ASSET,
) -> LedgerAccount:
    """
    Retrieves or initializes a merchant clearing account.
    - ASSET (Receivable): for merchant earn charges (Merchant owes platform).
    - LIABILITY (Payable): for merchant redemption reimbursement (Platform owes merchant).
    """
    prefix = "MER-RCV" if category == AccountCategory.ASSET else "MER-PAY"
    m_id_str = str(merchant_id) if merchant_id else (merchant_name or "DEFAULT").upper().replace(" ", "-")
    code = f"{prefix}-{m_id_str}"

    stmt = select(LedgerAccount).where(LedgerAccount.account_code == code)
    account = (await db.execute(stmt)).scalar_one_or_none()

    if not account:
        name_desc = "Receivable" if category == AccountCategory.ASSET else "Payable Reimbursement"
        account = LedgerAccount(
            account_code=code,
            name=f"Merchant {merchant_name or m_id_str} {name_desc}",
            category=category,
            currency="USD",
            chain_id=merchant_id if isinstance(merchant_id, uuid.UUID) else None,
        )
        db.add(account)
        await db.flush()

    return account


async def get_or_create_brand_account(
    db: AsyncSession,
    brand_name: Optional[str] = None,
    campaign_id: Optional[uuid.UUID] = None,
) -> LedgerAccount:
    """
    Retrieves or initializes a brand sponsor clearing account.
    - ASSET (Receivable): for brand-sponsored point subsidies (Brand owes platform / ad pool).
    """
    cleaned_name = (brand_name or "BRAND").upper().replace(" ", "-").replace("&", "AND")
    code = f"BRD-ADV-{cleaned_name}"

    stmt = select(LedgerAccount).where(LedgerAccount.account_code == code)
    account = (await db.execute(stmt)).scalar_one_or_none()

    if not account:
        account = LedgerAccount(
            account_code=code,
            name=f"Brand Ad Pool - {brand_name or cleaned_name}",
            category=AccountCategory.ASSET,
            currency="USD",
        )
        db.add(account)
        await db.flush()

    return account


async def get_or_create_system_account(
    db: AsyncSession, code: str, name: str, category: AccountCategory
) -> LedgerAccount:
    """
    Retrieves or initializes a platform system account (e.g. fee revenues).
    """
    stmt = select(LedgerAccount).where(LedgerAccount.account_code == code)
    account = (await db.execute(stmt)).scalar_one_or_none()

    if not account:
        account = LedgerAccount(
            account_code=code,
            name=name,
            category=category,
            currency="USD",
        )
        db.add(account)
        await db.flush()

    return account


async def get_account_balance(db: AsyncSession, account_id: uuid.UUID) -> Decimal:
    """
    Calculates exact real-time account balance from posted ledger entries.
    - ASSET / EXPENSE: Balance = sum(Debits) - sum(Credits)
    - LIABILITY / EQUITY / REVENUE: Balance = sum(Credits) - sum(Debits)
    """
    acc_stmt = select(LedgerAccount).where(LedgerAccount.id == account_id)
    account = (await db.execute(acc_stmt)).scalar_one_or_none()
    if not account:
        raise AccountNotFoundError(f"Account {account_id} not found")

    debits_stmt = select(func.coalesce(func.sum(LedgerEntry.amount), Decimal("0.0000"))).where(
        LedgerEntry.account_id == account_id,
        LedgerEntry.direction == EntryDirection.DEBIT,
    )
    credits_stmt = select(func.coalesce(func.sum(LedgerEntry.amount), Decimal("0.0000"))).where(
        LedgerEntry.account_id == account_id,
        LedgerEntry.direction == EntryDirection.CREDIT,
    )

    total_debits = Decimal(str((await db.execute(debits_stmt)).scalar() or "0.0000"))
    total_credits = Decimal(str((await db.execute(credits_stmt)).scalar() or "0.0000"))

    if account.category in (AccountCategory.ASSET, AccountCategory.EXPENSE):
        return total_debits - total_credits
    else:
        return total_credits - total_debits


async def get_user_points_balance(db: AsyncSession, user_id: uuid.UUID) -> int:
    """
    Returns the user's available points balance derived strictly from the double-entry ledger.
    """
    account = await get_or_create_user_points_account(db, user_id)
    balance_usd = await get_account_balance(db, account.id)
    if balance_usd <= Decimal("0"):
        return 0
    return int(balance_usd * POINTS_PER_DOLLAR)


async def record_earn_transaction(
    db: AsyncSession,
    user_id: uuid.UUID,
    purchase_amount: Decimal,
    merchant_id: Optional[uuid.UUID] = None,
    merchant_name: str = "Merchant A",
    earn_rate: Decimal = Decimal("0.03"),
    platform_fee: Optional[Decimal] = None,
    reference_id: Optional[str] = None,
    description: Optional[str] = None,
    brand_bonus_points: int = 0,
    brand_bonus_usd: Decimal = Decimal("0.0000"),
    brand_campaign_id: Optional[uuid.UUID] = None,
    brand_name: Optional[str] = None,
) -> Tuple[LedgerTransaction, int, Decimal, Decimal]:
    """
    Records an earn transaction according to clearinghouse rules:
    - User purchase: $50.00 at 3% earn rate -> $1.50 points credit (150 points).
    - Platform fee: $0.30 platform clearing fee credit.
    - Merchant debit: $1.80 ($1.50 point liability + $0.30 clearing fee).
    
    If Brand-Sponsored Boost (e.g. 5x on brand SKUs):
    - Merchant pays strictly their base obligation ($1.80) protecting store margins.
    - Brand Ad Pool is debited for brand_bonus_usd (e.g. $1.20).
    - User receives base points + brand bonus points.
    
    Returns (LedgerTransaction, points_awarded, merchant_debit, platform_fee)
    """
    # 1. Exact decimal calculations
    purchase_amount = Decimal(str(purchase_amount)).quantize(Decimal("0.0001"))
    earn_rate = Decimal(str(earn_rate))
    base_points_usd = (purchase_amount * earn_rate).quantize(Decimal("0.0001"))
    base_points_awarded = int(base_points_usd * POINTS_PER_DOLLAR)

    brand_bonus_usd = Decimal(str(brand_bonus_usd)).quantize(Decimal("0.0001"))
    total_user_points_usd = (base_points_usd + brand_bonus_usd).quantize(Decimal("0.0001"))
    total_points_awarded = base_points_awarded + int(brand_bonus_points)

    if platform_fee is None:
        fee_usd = Decimal("0.3000")
    else:
        fee_usd = Decimal(str(platform_fee)).quantize(Decimal("0.0001"))

    # Supermarket merchant is STRICTLY debited for their base earn + fee
    merchant_total_debit = (base_points_usd + fee_usd).quantize(Decimal("0.0001"))

    # 2. Resolve accounts
    merchant_account = await get_or_create_merchant_account(
        db, merchant_id=merchant_id, merchant_name=merchant_name, category=AccountCategory.ASSET
    )
    user_account = await get_or_create_user_points_account(db, user_id)
    clearing_revenue_account = await get_or_create_system_account(
        db,
        code="REV-CLEARING-FEE",
        name="Platform Clearing Fee Revenue",
        category=AccountCategory.REVENUE,
    )

    brand_account = None
    if brand_bonus_usd > Decimal("0.0000"):
        brand_account = await get_or_create_brand_account(
            db, brand_name=brand_name, campaign_id=brand_campaign_id
        )

    # 3. Create journal transaction header
    desc_extra = f" (+{brand_bonus_points} {brand_name or 'Brand'} boost)" if brand_bonus_points > 0 else ""
    tx = LedgerTransaction(
        transaction_type=TransactionType.EARN,
        reference_id=reference_id or f"EARN-{uuid.uuid4().hex[:8]}",
        description=description
        or f"Earned {total_points_awarded} pts{desc_extra} on ${purchase_amount:.2f} purchase at {merchant_name}",
    )
    db.add(tx)
    await db.flush()

    # 4. Prepare atomic balanced entries
    entries = [
        # Merchant A is debited base liability + fee (Asset / Receivable)
        LedgerEntry(
            transaction_id=tx.id,
            account_id=merchant_account.id,
            direction=EntryDirection.DEBIT,
            amount=merchant_total_debit,
            points_amount=None,
            description=f"Merchant {merchant_name} base debit (${base_points_usd:.4f} liability + ${fee_usd:.4f} fee)",
        ),
        # User receives points credit (Liability / Customer Points)
        LedgerEntry(
            transaction_id=tx.id,
            account_id=user_account.id,
            direction=EntryDirection.CREDIT,
            amount=total_user_points_usd,
            points_amount=total_points_awarded,
            description=f"Points earned by user ({total_points_awarded} pts = ${total_user_points_usd:.4f})",
        ),
        # Platform retains $0.30 clearing fee revenue (Revenue)
        LedgerEntry(
            transaction_id=tx.id,
            account_id=clearing_revenue_account.id,
            direction=EntryDirection.CREDIT,
            amount=fee_usd,
            points_amount=None,
            description=f"Platform clearing fee on ${purchase_amount:.2f} purchase",
        ),
    ]

    # If brand bonus exists, Brand Ad Pool is debited (Asset / Receivable from Brand)
    if brand_account and brand_bonus_usd > Decimal("0.0000"):
        entries.append(
            LedgerEntry(
                transaction_id=tx.id,
                account_id=brand_account.id,
                direction=EntryDirection.DEBIT,
                amount=brand_bonus_usd,
                points_amount=brand_bonus_points,
                description=f"Brand {brand_name or 'Sponsor'} subsidy ({brand_bonus_points} pts = ${brand_bonus_usd:.4f})",
            )
        )

    # 5. Invariant check: Assert debits == credits
    assert_balanced_entries(entries)
    db.add_all(entries)

    # 6. Update current balances
    user_account.current_balance = (user_account.current_balance or Decimal("0.0000")) + total_user_points_usd
    merchant_account.current_balance = (merchant_account.current_balance or Decimal("0.0000")) + merchant_total_debit
    clearing_revenue_account.current_balance = (clearing_revenue_account.current_balance or Decimal("0.0000")) + fee_usd
    if brand_account and brand_bonus_usd > Decimal("0.0000"):
        brand_account.current_balance = (brand_account.current_balance or Decimal("0.0000")) + brand_bonus_usd

    # 7. Synchronize cached user sebet_points
    user = await db.get(User, user_id)
    if user:
        user.sebet_points = int(user_account.current_balance * POINTS_PER_DOLLAR)

    await db.flush()
    return tx, total_points_awarded, merchant_total_debit, fee_usd


async def record_redeem_transaction(
    db: AsyncSession,
    user_id: uuid.UUID,
    points_to_redeem: int,
    merchant_id: Optional[uuid.UUID] = None,
    merchant_name: str = "Merchant B",
    servicing_fee_rate: Decimal = Decimal("0.05"),
    reference_id: Optional[str] = None,
    description: Optional[str] = None,
) -> Tuple[LedgerTransaction, Decimal, Decimal, str]:
    """
    Executes an ACID double-entry redemption transaction with pessimistic row-locking
    and atomic conditional balance checking to prevent race conditions and double-spending:
    - User is debited 150 points ($1.50).
    - Servicing fee: 5% of $1.50 = $0.075 platform revenue.
    - Merchant B receives cash reimbursement of $1.50 - $0.075 = $1.425 net.
    
    Returns (LedgerTransaction, merchant_reimbursement, platform_fee, voucher_code)
    """
    if points_to_redeem <= 0:
        raise ValueError("Points to redeem must be greater than zero.")

    # 1. PESSIMISTIC LOCK: Exclusively lock the user's liability account row
    code = f"USR-PTS-{user_id}"
    lock_stmt = (
        select(LedgerAccount)
        .where(LedgerAccount.account_code == code)
        .with_for_update()
    )
    user_account = (await db.execute(lock_stmt)).scalar_one_or_none()

    if not user_account:
        user_account = await get_or_create_user_points_account(db, user_id)

    # Sync current_balance from entries if needed
    if (user_account.current_balance or Decimal("0.0000")) == Decimal("0.0000"):
        calc_bal = await get_account_balance(db, user_account.id)
        if calc_bal > Decimal("0.0000"):
            user_account.current_balance = calc_bal

    # 2. Exact decimal calculations
    points_usd = (Decimal(points_to_redeem) * DOLLARS_PER_POINT).quantize(Decimal("0.0001"))
    servicing_fee_rate = Decimal(str(servicing_fee_rate))
    platform_servicing_fee = (points_usd * servicing_fee_rate).quantize(Decimal("0.0001"))
    merchant_net_reimbursement = (points_usd - platform_servicing_fee).quantize(Decimal("0.0001"))

    # 3. ATOMIC CONDITIONAL UPDATE:
    # Guarantees concurrency safety across both PostgreSQL and SQLite:
    # WHERE current_balance >= points_usd ensures only 1 concurrent process succeeds.
    update_stmt = (
        update(LedgerAccount)
        .where(
            LedgerAccount.id == user_account.id,
            LedgerAccount.current_balance >= points_usd,
        )
        .values(
            current_balance=LedgerAccount.current_balance - points_usd,
            version=LedgerAccount.version + 1,
        )
    )
    update_res = await db.execute(update_stmt)
    if update_res.rowcount == 0:
        fresh_stmt = select(LedgerAccount.current_balance).where(LedgerAccount.id == user_account.id)
        fresh_bal = (await db.execute(fresh_stmt)).scalar() or Decimal("0.0000")
        avail_pts = int(fresh_bal * POINTS_PER_DOLLAR)
        raise InsufficientPointsError(
            f"Kifayət qədər bal yoxdur! Tələb olunan: {points_to_redeem}, Sizin balınız: {avail_pts}"
        )

    # 4. Resolve destination accounts
    merchant_account = await get_or_create_merchant_account(
        db, merchant_id=merchant_id, merchant_name=merchant_name, category=AccountCategory.LIABILITY
    )
    redemption_revenue_account = await get_or_create_system_account(
        db,
        code="REV-REDEMPTION-FEE",
        name="Platform Redemption Servicing Fee Revenue",
        category=AccountCategory.REVENUE,
    )

    merchant_account.current_balance = (merchant_account.current_balance or Decimal("0.0000")) + merchant_net_reimbursement
    redemption_revenue_account.current_balance = (redemption_revenue_account.current_balance or Decimal("0.0000")) + platform_servicing_fee

    voucher_code = f"SEBET-{uuid.uuid4().hex[:6].upper()}"

    # 5. Create journal transaction header
    tx = LedgerTransaction(
        transaction_type=TransactionType.REDEEM,
        reference_id=reference_id or voucher_code,
        description=description
        or f"Redeemed {points_to_redeem} pts (${points_usd:.2f}) at {merchant_name}",
    )
    db.add(tx)
    await db.flush()

    # 6. Prepare atomic balanced entries
    entries = [
        # User points liability debited $1.50 (150 points extinguished)
        LedgerEntry(
            transaction_id=tx.id,
            account_id=user_account.id,
            direction=EntryDirection.DEBIT,
            amount=points_usd,
            points_amount=points_to_redeem,
            description=f"Redeem {points_to_redeem} pts at {merchant_name}",
        ),
        # Merchant B credited $1.425 net cash reimbursement payable
        LedgerEntry(
            transaction_id=tx.id,
            account_id=merchant_account.id,
            direction=EntryDirection.CREDIT,
            amount=merchant_net_reimbursement,
            points_amount=None,
            description=f"Merchant {merchant_name} net reimbursement (${points_usd:.4f} - ${platform_servicing_fee:.4f})",
        ),
        # Platform credited $0.075 redemption fee revenue
        LedgerEntry(
            transaction_id=tx.id,
            account_id=redemption_revenue_account.id,
            direction=EntryDirection.CREDIT,
            amount=platform_servicing_fee,
            points_amount=None,
            description=f"Platform 5% servicing fee on {points_to_redeem} pts redemption",
        ),
    ]

    # 7. Invariant check: Assert debits == credits
    assert_balanced_entries(entries)
    db.add_all(entries)

    # 8. Synchronize cached user points
    user = await db.get(User, user_id)
    if user:
        user_account.current_balance -= points_usd
        user.sebet_points = max(0, int(user_account.current_balance * POINTS_PER_DOLLAR))

    await db.flush()
    return tx, merchant_net_reimbursement, platform_servicing_fee, voucher_code


async def verify_ledger_integrity(db: AsyncSession) -> dict:
    """
    Performs a full clearinghouse audit:
    - Verifies Sum(Debits) == Sum(Credits) for EVERY transaction in the system.
    - Verifies global Sum(Debits) == Sum(Credits).
    - Summarizes total customer points liability, merchant receivables, merchant payables, and platform revenues.
    """
    # 1. Fetch all transactions with their entries
    tx_stmt = select(LedgerTransaction)
    txs = (await db.execute(tx_stmt)).scalars().all()

    unbalanced_tx_ids: List[uuid.UUID] = []
    total_debits = Decimal("0.0000")
    total_credits = Decimal("0.0000")

    for tx in txs:
        entries_stmt = select(LedgerEntry).where(LedgerEntry.transaction_id == tx.id)
        entries = (await db.execute(entries_stmt)).scalars().all()

        tx_debits = sum(e.amount for e in entries if e.direction == EntryDirection.DEBIT)
        tx_credits = sum(e.amount for e in entries if e.direction == EntryDirection.CREDIT)

        total_debits += tx_debits
        total_credits += tx_credits

        if abs(tx_debits - tx_credits) > Decimal("0.00001"):
            unbalanced_tx_ids.append(tx.id)

    # 2. Summarize account categories
    acc_stmt = select(LedgerAccount)
    accounts = (await db.execute(acc_stmt)).scalars().all()

    total_points_liability_usd = Decimal("0.0000")
    total_merchant_receivables_usd = Decimal("0.0000")
    total_merchant_payables_usd = Decimal("0.0000")
    total_clearing_rev = Decimal("0.0000")
    total_redemption_rev = Decimal("0.0000")

    for acc in accounts:
        balance = await get_account_balance(db, acc.id)
        if acc.account_code.startswith("USR-PTS-"):
            total_points_liability_usd += balance
        elif acc.account_code.startswith("MER-RCV-"):
            total_merchant_receivables_usd += balance
        elif acc.account_code.startswith("MER-PAY-"):
            total_merchant_payables_usd += balance
        elif acc.account_code == "REV-CLEARING-FEE":
            total_clearing_rev += balance
        elif acc.account_code == "REV-REDEMPTION-FEE":
            total_redemption_rev += balance

    net_discrepancy = abs(total_debits - total_credits)
    is_balanced = len(unbalanced_tx_ids) == 0 and net_discrepancy < Decimal("0.00001")

    return {
        "is_balanced": is_balanced,
        "total_debits": total_debits.quantize(Decimal("0.0001")),
        "total_credits": total_credits.quantize(Decimal("0.0001")),
        "net_discrepancy": net_discrepancy.quantize(Decimal("0.0001")),
        "total_transactions_count": len(txs),
        "total_points_in_circulation": int(total_points_liability_usd * POINTS_PER_DOLLAR),
        "total_points_liability_usd": total_points_liability_usd.quantize(Decimal("0.0001")),
        "total_merchant_receivables_usd": total_merchant_receivables_usd.quantize(Decimal("0.0001")),
        "total_merchant_payables_usd": total_merchant_payables_usd.quantize(Decimal("0.0001")),
        "total_platform_clearing_revenue_usd": total_clearing_rev.quantize(Decimal("0.0001")),
        "total_platform_redemption_revenue_usd": total_redemption_rev.quantize(Decimal("0.0001")),
        "total_platform_revenue_usd": (total_clearing_rev + total_redemption_rev).quantize(Decimal("0.0001")),
        "unbalanced_transactions": unbalanced_tx_ids,
    }
