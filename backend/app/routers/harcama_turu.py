from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.session import get_db
from app.models.harcama_turu import HarcamaTuru
from app.schemas.harcama_turu import HarcamaTuruOlusturIstegi, HarcamaTuruYanit

router = APIRouter(prefix="/harcama-turleri", tags=["Harcama Türleri"])


@router.get("", response_model=list[HarcamaTuruYanit])
def harcama_turlerini_listele(db: Session = Depends(get_db)):
    sorgu = select(HarcamaTuru).where(HarcamaTuru.aktif.is_(True)).order_by(HarcamaTuru.ad)
    return list(db.execute(sorgu).scalars())


@router.post("", response_model=HarcamaTuruYanit)
def harcama_turu_ekle(istek: HarcamaTuruOlusturIstegi, db: Session = Depends(get_db)):
    mevcut = db.execute(select(HarcamaTuru).where(HarcamaTuru.ad == istek.ad)).scalar_one_or_none()
    if mevcut is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bu harcama türü zaten mevcut.")
    yeni = HarcamaTuru(ad=istek.ad)
    db.add(yeni)
    db.commit()
    db.refresh(yeni)
    return yeni


@router.put("/{harcama_turu_id}", response_model=HarcamaTuruYanit)
def harcama_turu_guncelle(harcama_turu_id: int, istek: HarcamaTuruOlusturIstegi, db: Session = Depends(get_db)):
    kayit = db.get(HarcamaTuru, harcama_turu_id)
    if kayit is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Harcama türü bulunamadı.")
    kayit.ad = istek.ad
    db.commit()
    db.refresh(kayit)
    return kayit


@router.delete("/{harcama_turu_id}")
def harcama_turu_sil(harcama_turu_id: int, db: Session = Depends(get_db)):
    kayit = db.get(HarcamaTuru, harcama_turu_id)
    if kayit is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Harcama türü bulunamadı.")
    kayit.aktif = False
    db.commit()
    return {"silindi": True}
