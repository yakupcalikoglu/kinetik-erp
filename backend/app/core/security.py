"""
Sifre hashleme ve JWT token uretme/dogrulama islemleri.
"""
import os
import bcrypt
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "DEGISTIR-bu-deger-env-dosyasinda-saklanmali")
ALGORITHM = "HS256"
ACCESS_TOKEN_SURESI_DAKIKA = 60 * 12  # 12 saat


def sifre_hashle(duz_sifre: str) -> str:
    return bcrypt.hashpw(duz_sifre.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def sifre_dogrula(duz_sifre: str, hashlenmis: str) -> bool:
    return bcrypt.checkpw(duz_sifre.encode("utf-8"), hashlenmis.encode("utf-8"))


def token_olustur(kullanici_id: int, erisebildigi_sirketler: list[int]) -> str:
    simdi = datetime.now(timezone.utc)
    payload = {
        "sub": str(kullanici_id),
        "sirketler": erisebildigi_sirketler,
        "iat": simdi,
        "exp": simdi + timedelta(minutes=ACCESS_TOKEN_SURESI_DAKIKA),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def token_dogrula(token: str) -> dict | None:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None
