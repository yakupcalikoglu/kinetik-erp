"""
Veritabani baglanti ayarlari.
Gercek ortamda DATABASE_URL ortam degiskeninden (.env) okunur.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://postgres:postgres@localhost:5432/ithalat_db"
)

# NOT: Varsayilan SQLAlchemy havuz boyutu (pool_size=5, max_overflow=10 ->
# toplam 15 baglanti) bazi sayfalarin (Dashboard, Finansal Takip vb.) acilis
# aninda PARALEL olarak COK SAYIDA istek yapmasi altinda YETERSIZ kaliyordu
# ("QueuePool limit ... connection timed out" - SQLAlchemy hata kodu f405).
# Havuzu buyutup, havuz dolduysa makul bir sure BEKLEMESINI (30sn, hemen
# hata vermek yerine) ve eski/olu baglantilari geri donusturmesini sagliyoruz.
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
