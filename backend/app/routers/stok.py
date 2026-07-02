from sqlalchemy.exc import IntegrityError
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.session import get_db
from app.core.deps import aktif_sirket_id_getir, izin_gerektir
from app.models.stok import (StokKarti, StokSeriNo, StokMaliyetKalemi,
                              MALIYET_TIP_SUTUN_ESLEME, StokDurum)
from app.schemas.stok import (StokKartiOlusturIstegi, StokKartiYanit,
                               StokSeriNoYanit, StokDurumGuncelleIstegi,
                               MaliyetKalemiEkleIstegi, KarRaporuYanit)

router = APIRouter(tags=["Stok"])


@router.post("/stok-kartlari", response_model=StokKartiYanit,
             dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def stok_karti_olustur(
    istek: StokKartiOlusturIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    yeni = StokKarti(sirket_id=sirket_id, **istek.model_dump())
    db.add(yeni)
    db.commit()
    db.refresh(yeni)
    return yeni


@router.put("/stok-kartlari/{stok_karti_id}", response_model=StokKartiYanit,
            dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def stok_karti_guncelle(
    stok_karti_id: int,
    istek: StokKartiOlusturIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    kart = db.get(StokKarti, stok_karti_id)
    if kart is None or kart.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Stok kartı bulunamadı.")
    for alan, deger in istek.model_dump().items():
        setattr(kart, alan, deger)
    db.commit()
    db.refresh(kart)
    return kart


@router.delete("/stok-kartlari/{stok_karti_id}",
               dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def stok_karti_sil(
    stok_karti_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    kart = db.get(StokKarti, stok_karti_id)
    if kart is None or kart.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Stok kartı bulunamadı.")
    try:
        db.delete(kart)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Bu stok kartı sipariş veya stok kayıtlarında kullanıldığı için silinemiyor."
        )
    return {"silindi": True}
        durum=kayit.durum,
    )
