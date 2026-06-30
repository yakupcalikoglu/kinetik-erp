from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.session import get_db
from app.models.auth import Sirket
from app.core.deps import aktif_kullanici_getir, izin_gerektir
from app.schemas.auth import SirketOlusturIstegi, SirketOzet

router = APIRouter(prefix="/sirketler", tags=["Şirketler"])


@router.get("", response_model=list[SirketOzet])
def sirketleri_listele(
    kullanici=Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    """Kullanicinin erisebildigi tum sirketleri doner (sirket secim ekrani icin)."""
    from app.models.auth import KullaniciSirketErisim
    sorgu = (
        select(Sirket)
        .join(KullaniciSirketErisim, KullaniciSirketErisim.sirket_id == Sirket.id)
        .where(KullaniciSirketErisim.kullanici_id == kullanici.id)
    )
    return list(db.execute(sorgu).scalars())


@router.post("", response_model=SirketOzet, dependencies=[Depends(izin_gerektir("SIRKET_YONET"))])
def sirket_olustur(istek: SirketOlusturIstegi, db: Session = Depends(get_db)):
    yeni = Sirket(**istek.model_dump())
    db.add(yeni)
    db.commit()
    db.refresh(yeni)
    return yeni
