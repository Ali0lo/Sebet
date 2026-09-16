"""
Sebet User Database & Authentication Module (user_db.py)
--------------------------------------------------------
Provides persistent, thread-safe SQLite storage for users, cryptographic password
hashing with PBKDF2-HMAC-SHA256 and unique per-user salts, saved grocery baskets,
home locations, and loyalty points.
"""

import os
import json
import sqlite3
import hashlib
import secrets
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List, Tuple

# Database file located in the project root directory
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sebet_users.db")


def get_db_connection() -> sqlite3.Connection:
    """Returns a SQLite connection with Row factory enabled."""
    conn = sqlite3.connect(DB_PATH, timeout=10.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def _hash_password(password: str, salt: str) -> str:
    """Hashes a password using PBKDF2-HMAC-SHA256 with 100,000 iterations."""
    return hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100_000,
    ).hex()


def init_user_db():
    """Initializes the database schema and seeds initial demo accounts if empty."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        sebet_points INTEGER NOT NULL DEFAULT 0,
        membership_tier TEXT NOT NULL DEFAULT 'Sebet Platinum',
        saved_basket TEXT DEFAULT '[]',
        home_location TEXT DEFAULT '28 May m. / Dəmiryol Vağzalı',
        created_at TEXT NOT NULL,
        last_login TEXT
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS user_activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        details TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
    """)

    conn.commit()

    # Seed demo account if users table is empty
    cursor.execute("SELECT COUNT(*) as count FROM users")
    count = cursor.fetchone()["count"]
    if count == 0:
        demo_salt = secrets.token_hex(16)
        demo_hash = _hash_password("sebet2026", demo_salt)
        now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

        cursor.execute("""
        INSERT INTO users (
            username, full_name, phone, email, password_hash, salt,
            sebet_points, membership_tier, saved_basket, home_location, created_at, last_login
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            "demo",
            "Ali İskəndərli",
            "+994 50 123 45 67",
            "ali@sebet.az",
            demo_hash,
            demo_salt,
            100,
            "Sebet Platinum",
            "[]",
            "28 May m. / Dəmiryol Vağzalı",
            now_iso,
            now_iso,
        ))
        conn.commit()

    conn.close()


def normalize_identifier(identifier: str) -> str:
    """Normalizes phone or username for consistent lookup."""
    clean = str(identifier).strip().lower()
    # If it's a phone number with spaces or dashes, normalize digits
    if clean.startswith("+994") or (clean.startswith("0") and len(clean) >= 10) or clean.isdigit():
        digits_only = "".join(ch for ch in clean if ch.isdigit() or ch == "+")
        return digits_only
    return clean


def register_user(
    username: str,
    full_name: str,
    password: str,
    phone: str = "",
    email: str = "",
    home_location: str = "28 May m. / Dəmiryol Vağzalı",
    initial_points: int = 0,
) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
    """
    Registers a new user in the database.
    Returns: (success: bool, message: str, user_dict: Optional[Dict])
    """
    clean_uname = normalize_identifier(username)
    clean_name = full_name.strip()

    if not clean_uname or len(clean_uname) < 3:
        return False, "İstifadəçi adı və ya telefon ən azı 3 simvol olmalıdır.", None

    if not clean_name or len(clean_name) < 2:
        return False, "Zəhmət olmasa ad və soyadınızı tam daxil edin.", None

    if not password or len(password) < 4:
        return False, "Şifrə ən azı 4 simvoldan ibarət olmalıdır.", None

    conn = get_db_connection()
    cursor = conn.cursor()

    # Check if username already exists
    cursor.execute("SELECT id FROM users WHERE username = ?", (clean_uname,))
    if cursor.fetchone() is not None:
        conn.close()
        return False, f"'{clean_uname}' adına malik istifadəçi artıq qeydiyyatdan keçib. Daxil olun.", None

    salt = secrets.token_hex(16)
    pwd_hash = _hash_password(password, salt)
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    try:
        cursor.execute("""
        INSERT INTO users (
            username, full_name, phone, email, password_hash, salt,
            sebet_points, membership_tier, saved_basket, home_location, created_at, last_login
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            clean_uname,
            clean_name,
            phone.strip() or clean_uname,
            email.strip(),
            pwd_hash,
            salt,
            initial_points,
            "Sebet Platinum",
            "[]",
            home_location,
            now_iso,
            now_iso,
        ))
        new_id = cursor.lastrowid
        conn.commit()

        # Log activity
        cursor.execute("""
        INSERT INTO user_activity_logs (user_id, action, details, created_at)
        VALUES (?, ?, ?, ?)
        """, (new_id, "REGISTER", "Yeni hesab qeydiyyatı", now_iso))
        conn.commit()

        # Fetch created user
        cursor.execute("SELECT * FROM users WHERE id = ?", (new_id,))
        row = cursor.fetchone()
        user_dict = dict(row)
        # Never leak salt or password_hash
        user_dict.pop("password_hash", None)
        user_dict.pop("salt", None)
        conn.close()
        return True, "🎉 Qeydiyyat uğurla tamamlandı! Hesabınız hazırdır.", user_dict

    except Exception as ex:
        conn.close()
        return False, f"Qeydiyyat zamanı xəta baş verdi: {str(ex)}", None


def authenticate_user(username: str, password: str) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
    """
    Authenticates a user by username/phone and password.
    Returns: (success: bool, message: str, user_dict: Optional[Dict])
    """
    clean_uname = normalize_identifier(username)
    if not clean_uname or not password:
        return False, "Zəhmət olmasa istifadəçi adı və şifrəni daxil edin.", None

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM users WHERE username = ? OR phone = ? OR email = ?", (clean_uname, clean_uname, clean_uname))
    row = cursor.fetchone()

    if row is None:
        conn.close()
        return False, "Bu istifadəçi adı və ya telefon nömrəsi ilə qeydiyyat tapılmadı.", None

    stored_hash = row["password_hash"]
    stored_salt = row["salt"]
    computed_hash = _hash_password(password, stored_salt)

    if computed_hash != stored_hash:
        conn.close()
        return False, "Daxil edilmiş şifrə yanlışdır. Yenidən cəhd edin.", None

    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("UPDATE users SET last_login = ? WHERE id = ?", (now_iso, row["id"]))
    cursor.execute("""
    INSERT INTO user_activity_logs (user_id, action, details, created_at)
    VALUES (?, ?, ?, ?)
    """, (row["id"], "LOGIN", "Uğurlu daxil olma", now_iso))
    conn.commit()

    user_dict = dict(row)
    user_dict["last_login"] = now_iso
    user_dict.pop("password_hash", None)
    user_dict.pop("salt", None)
    conn.close()

    return True, f"Xoş gəldiniz, {user_dict['full_name']}!", user_dict


def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    """Fetches user record by ID, omitting secret hashes."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    d.pop("password_hash", None)
    d.pop("salt", None)
    return d


def update_user_points(user_id: int, points: int) -> bool:
    """Updates the user's loyalty points balance in the database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("UPDATE users SET sebet_points = ? WHERE id = ?", (int(points), user_id))
        conn.commit()
        conn.close()
        return True
    except Exception:
        conn.close()
        return False


def save_user_basket(user_id: int, basket_items: List[Dict[str, Any]], home_location: str = None) -> bool:
    """Saves user's grocery basket and home location to their persistent profile."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        basket_json = json.dumps(basket_items, ensure_ascii=False)
        if home_location:
            cursor.execute(
                "UPDATE users SET saved_basket = ?, home_location = ? WHERE id = ?",
                (basket_json, home_location, user_id),
            )
        else:
            cursor.execute("UPDATE users SET saved_basket = ? WHERE id = ?", (basket_json, user_id))
        conn.commit()
        conn.close()
        return True
    except Exception:
        conn.close()
        return False


def load_user_basket(user_id: int) -> Tuple[List[Dict[str, Any]], str]:
    """Loads saved grocery basket and home location for a user."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT saved_basket, home_location FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return [], "28 May m. / Dəmiryol Vağzalı"
    try:
        basket = json.loads(row["saved_basket"] or "[]")
    except Exception:
        basket = []
    loc = row["home_location"] or "28 May m. / Dəmiryol Vağzalı"
    return basket, loc


def get_all_users_summary() -> List[Dict[str, Any]]:
    """Returns a safe summary of all registered users (for database inspector)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT id, username, full_name, phone, sebet_points, membership_tier, home_location, created_at, last_login
    FROM users
    ORDER BY id ASC
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

