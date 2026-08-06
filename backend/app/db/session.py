"""
Veritabani baglanti ayarlari.
Gercek ortamda DATABASE_URL ortam degiskeninden (.env) okunur.

NOT: DATABASE_URL, Supabase'in "Transaction Pooler" (port 6543, Supavisor)
adresini kullaniyorsa, NullPool ZORUNLUDUR - Supavisor kendi havuzunu
yonetir, SQLAlchemy'nin KENDI havuzunu da ustune eklemek (cifte havuzlama)
baglanti tukenmesine ("QueuePool limit... connection timed out", SQLAlchemy
hata kodu f405) yol acar. "Direct connection" (port 5432) kullaniliyorsa,
NullPool KULLANILMAMALI - normal havuzlama (asagidaki else dali) daha
performansli olur.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import NullPool

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://postgres:postgres@localhost:5432/ithalat_db"
)

# Transaction pooler (Supavisor, port 6543) kullaniliyorsa otomatik algila.
_TRANSACTION_POOLER_KULLANILIYOR = ":6543" in DATABASE_URL or "pooler.supabase.com" in DATABASE_URL

if _TRANSACTION_POOLER_KULLANILIYOR:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True, poolclass=NullPool)
else:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=15,
        pool_timeout=30,
        pool_recycle=1800,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency: her istek icin ayri bir DB session acar/kapatir."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
