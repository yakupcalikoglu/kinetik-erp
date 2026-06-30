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

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency: her istek icin ayri bir DB session acar/kapatir."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
