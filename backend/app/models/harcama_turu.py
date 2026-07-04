from sqlalchemy import Column, BigInteger, String, Boolean
from app.db.session import Base


class HarcamaTuru(Base):
    __tablename__ = "harcama_turleri"
    id = Column(BigInteger, primary_key=True)
    ad = Column(String(150), nullable=False, unique=True)
    aktif = Column(Boolean, default=True)
