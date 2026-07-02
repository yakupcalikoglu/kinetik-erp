from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
 
from app.db.session import get_db
from app.core.deps import aktif_sirket_id_getir, izin_gerektir, aktif_kullanici_getir
from app.models.auth import Kullanici
from app.models.akreditif import Akreditif, AkreditifKalemi, AkreditifDurum
from app.models.stok import Siparis
from app.models.banka import BankaHesabi
from app.schemas.akreditif import (
    AkreditifOlusturIstegi, AkreditifYanit, AkreditifDurumGuncelleIstegi,
    AkreditifKalemEkleIstegi, AkreditifKalemOdeIstegi,
)
from app.services.para_hareketi import para_hareketi_olustur
 
router = APIRouter(prefix="/akreditifler", tags=["Akreditif"])
 
# Kalem odeme endpoint'i /akreditifler prefix'inin disinda,
# ayri bir router olarak tanimlaniyor (frontend /akreditif-kalemleri/{id}/ode cagiriyor).
kalem_router = APIRouter(prefix="/akreditif-kalemleri", tags=["Akreditif"])
 
 
def _akreditif_getir_veya_404(db: Session, akreditif_id: int, sirket_id: int) -> Akreditif:
    kayit = db.get(Akreditif, akreditif_id)
    if kayit is None or kayit.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Akreditif bulunamadı.")
    return kayit
 
 
def _detayli_getir(db: Session, akreditif_id: int) -> Akreditif:
    akreditif = db.get(Akreditif, akreditif_id)
    akreditif.kalemler = list(db.execute(
        select(AkreditifKalemi).where(AkreditifKalemi.akreditif_id == akreditif.id)
    ).scalars())
    return akreditif
 
 
@router.post("", response_model=AkreditifYanit,
             dependencies=[Depends(izin_gerektir("AKREDITIF_DUZENLE"))])
def akreditif_olustur(
    istek: AkreditifOlusturIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    siparis = db.get(Siparis, istek.siparis_id)
    if siparis is None or siparis.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Sipariş bulunamadı (ID={istek.siparis_id}).")
 
    banka = db.get(BankaHesabi, istek.banka_hesap_id)
    if banka is None or banka.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Banka hesabı bulunamadı (ID={istek.banka_hesap_id}).")
 
    yeni = Akreditif(sirket_id=sirket_id, **istek.model_dump())
    db.add(yeni)
    db.commit()
    db.refresh(yeni)
    return _detayli_getir(db, yeni.id)
 
 
@router.get("", response_model=list[AkreditifYanit],
            dependencies=[Depends(izin_gerektir("AKREDITIF_GORUNTULE"))])
def akreditifleri_listele(
    siparis_id: int | None = None,
    durum: AkreditifDurum | None = None,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    sorgu = select(Akreditif).where(Akreditif.sirket_id == sirket_id)
    if siparis_id:
        sorgu = sorgu.where(Akreditif.siparis_id == siparis_id)
    if durum:
        sorgu = sorgu.where(Akreditif.durum == durum)
    akreditifler = list(db.execute(sorgu).scalars())
    for a in akreditifler:
        a.kalemler = list(db.execute(
            select(AkreditifKalemi).where(AkreditifKalemi.akreditif_id == a.id)
        ).scalars())
    return akreditifler
 
 
@router.get("/{akreditif_id}", response_model=AkreditifYanit,
            dependencies=[Depends(izin_gerektir("AKREDITIF_GORUNTULE"))])
def akreditif_getir(
    akreditif_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    _akreditif_getir_veya_404(db, akreditif_id, sirket_id)
    return _detayli_getir(db, akreditif_id)
 
 
@router.put("/{akreditif_id}/durum", response_model=AkreditifYanit,
            dependencies=[Depends(izin_gerektir("AKREDITIF_DUZENLE"))])
def akreditif_durum_guncelle(
    akreditif_id: int,
    istek: AkreditifDurumGuncelleIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    akreditif = _akreditif_getir_veya_404(db, akreditif_id, sirket_id)
    akreditif.durum = istek.durum
    db.commit()
    return _detayli_getir(db, akreditif_id)
 
 
def _durumu_yeniden_hesapla(db: Session, akreditif: Akreditif) -> None:
    """Tum kalemler odendiyse KAPANDI, en az biri odendiyse KISMI_ODENDI yapar."""
    kalemler = list(db.execute(
        select(AkreditifKalemi).where(AkreditifKalemi.akreditif_id == akreditif.id)
    ).scalars())
    if not kalemler:
        return
    if all(k.odendi_mi for k in kalemler):
        akreditif.durum = AkreditifDurum.KAPANDI
    elif any(k.odendi_mi for k in kalemler):
        akreditif.durum = AkreditifDurum.KISMI_ODENDI
 
 
@router.post("/{akreditif_id}/kalem", response_model=AkreditifYanit,
             dependencies=[Depends(izin_gerektir("AKREDITIF_DUZENLE"))])
def akreditif_kalemi_ekle(
    akreditif_id: int,
    istek: AkreditifKalemEkleIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    akreditif = _akreditif_getir_veya_404(db, akreditif_id, sirket_id)
    yeni_kalem = AkreditifKalemi(akreditif_id=akreditif_id, **istek.model_dump())
    db.add(yeni_kalem)
    db.commit()
    return _detayli_getir(db, akreditif_id)
 
 
@kalem_router.put("/{kalem_id}/ode",
                   dependencies=[Depends(izin_gerektir("AKREDITIF_DUZENLE"))])
def akreditif_kalemi_ode(
    kalem_id: int,
    istek: AkreditifKalemOdeIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    kalem = db.get(AkreditifKalemi, kalem_id)
    if kalem is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Akreditif kalemi bulunamadı.")
 
    akreditif = db.get(Akreditif, kalem.akreditif_id)
    if akreditif is None or akreditif.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Akreditif kalemi bulunamadı.")
 
    kalem.odendi_mi = True
    kalem.odeme_tarihi = istek.odeme_tarihi
 
    para_hareketi_olustur(
        db, sirket_id, kullanici.id, "CIKIS", kalem.tutar,
        istek.odeme_yontemi, istek.banka_hesap_id,
        aciklama=f"Akreditif {akreditif.akreditif_no or ''} - {kalem.tip.value}",
        kaynak_tablo="AKREDITIF_KALEMI", kaynak_id=kalem.id,
    )
 
    _durumu_yeniden_hesapla(db, akreditif)
    db.commit()
    return {"odendi": True}
 
