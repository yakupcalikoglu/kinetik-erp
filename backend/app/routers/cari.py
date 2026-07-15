import json
from sqlalchemy.exc import IntegrityError
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, func, case
from datetime import date

from app.db.session import get_db
from app.core.deps import aktif_sirket_id_getir, izin_gerektir, aktif_kullanici_getir
from app.models.auth import Kullanici
from app.models.cari import CariHesap, CariHareket
from app.models.denetim import DuzenlemeKaydi
from app.core.security import sifre_dogrula
from app.schemas.cari import (
    VergiNoSorguIstegi, VergiNoSorguYaniti, CariOlusturIstegi,
    CariGuncelleIstegi, CariYanit, CariHareketYanit, CariBakiyeYanit,
)
from app.services import uyumsoft_mock

router = APIRouter(prefix="/cariler", tags=["Cari"])


def _degisiklikleri_kaydet(db: Session, sirket_id: int, kullanici_id: int, tablo_adi: str, kayit_id: int, degisiklikler: dict) -> None:
    if not degisiklikler:
        return
    db.add(DuzenlemeKaydi(
        sirket_id=sirket_id, kullanici_id=kullanici_id, tablo_adi=tablo_adi,
        kayit_id=kayit_id, degisiklikler=json.dumps(degisiklikler, ensure_ascii=False, default=str),
    ))


@router.post("/vergi-no-sorgula", response_model=VergiNoSorguYaniti,
             dependencies=[Depends(izin_gerektir("CARI_DUZENLE"))])
def vergi_no_sorgula(istek: VergiNoSorguIstegi):
    """
    Mukellef sorgu servisini cagirir. Cari kaydi BU asamada olusturulmaz;
    kullanici donen bilgileri onayladiktan sonra POST /cariler cagrilir.
    """
    sonuc = uyumsoft_mock.sorgula(istek.vergi_no)
    return VergiNoSorguYaniti(**sonuc)


@router.get("", response_model=list[CariYanit],
            dependencies=[Depends(izin_gerektir("CARI_GORUNTULE"))])
def carileri_listele(
    tip: str | None = None,
    arama: str | None = None,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    sorgu = select(CariHesap).where(CariHesap.sirket_id == sirket_id)
    if tip:
        sorgu = sorgu.where(CariHesap.tip == tip)
    if arama:
        sorgu = sorgu.where(CariHesap.unvan.ilike(f"%{arama}%"))
    return list(db.execute(sorgu).scalars())


@router.post("", response_model=CariYanit,
             dependencies=[Depends(izin_gerektir("CARI_DUZENLE"))])
def cari_olustur(
    istek: CariOlusturIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    yeni = CariHesap(sirket_id=sirket_id, **istek.model_dump())
    db.add(yeni)
    db.commit()
    db.refresh(yeni)
    return yeni


@router.get("/{cari_id}", response_model=CariYanit,
            dependencies=[Depends(izin_gerektir("CARI_GORUNTULE"))])
def cari_getir(
    cari_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    cari = db.get(CariHesap, cari_id)
    if cari is None or cari.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cari kayıt bulunamadı.")
    return cari


@router.put("/{cari_id}", response_model=CariYanit,
            dependencies=[Depends(izin_gerektir("CARI_DUZENLE"))])
def cari_guncelle(
    cari_id: int,
    istek: CariGuncelleIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    """Bir cari kaydini duzenler. Sifre onayi zorunludur; degisiklikler denetim_kayitlari'na islenir."""
    if not sifre_dogrula(istek.sifre, kullanici.sifre_hash):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Şifre yanlış, düzenleme yapılamadı.")

    cari = db.get(CariHesap, cari_id)
    if cari is None or cari.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cari kayıt bulunamadı.")

    alan_adlari = {
        "unvan": "Unvan", "vergi_no": "Vergi No", "vergi_dairesi": "Vergi Dairesi",
        "adres": "Adres", "telefon": "Telefon", "email": "E-posta", "aktif": "Aktif",
    }
    degisiklikler = {}
    guncellenecekler = istek.model_dump(exclude_unset=True, exclude={"sifre"})
    for alan, yeni in guncellenecekler.items():
        eski = getattr(cari, alan)
        if str(eski) != str(yeni):
            degisiklikler[alan_adlari.get(alan, alan)] = {"eski": eski, "yeni": yeni}
        setattr(cari, alan, yeni)

    _degisiklikleri_kaydet(db, sirket_id, kullanici.id, "cari_hesaplar", cari.id, degisiklikler)

    db.commit()
    db.refresh(cari)
    return cari


@router.get("/{cari_id}/hareketler", response_model=list[CariHareketYanit],
            dependencies=[Depends(izin_gerektir("CARI_GORUNTULE"))])
def cari_hareketleri(
    cari_id: int,
    baslangic: date | None = None,
    bitis: date | None = None,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    cari = db.get(CariHesap, cari_id)
    if cari is None or cari.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cari kayıt bulunamadı.")

    sorgu = select(CariHareket).where(
        CariHareket.cari_id == cari_id,
        CariHareket.sirket_id == sirket_id,
    )
    if baslangic:
        sorgu = sorgu.where(CariHareket.tarih >= baslangic)
    if bitis:
        sorgu = sorgu.where(CariHareket.tarih <= bitis)
    sorgu = sorgu.order_by(CariHareket.tarih.desc())
    return list(db.execute(sorgu).scalars())


@router.get("/{cari_id}/bakiye", response_model=list[CariBakiyeYanit],
            dependencies=[Depends(izin_gerektir("CARI_GORUNTULE"))])
def cari_bakiye(
    cari_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    cari = db.get(CariHesap, cari_id)
    if cari is None or cari.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cari kayıt bulunamadı.")

    giris_ifadesi = func.sum(case((CariHareket.yon == "GIRIS", CariHareket.tutar), else_=0))
    cikis_ifadesi = func.sum(case((CariHareket.yon == "CIKIS", CariHareket.tutar), else_=0))

    sorgu = (
        select(
            CariHareket.para_birimi,
            giris_ifadesi.label("toplam_giris"),
            cikis_ifadesi.label("toplam_cikis"),
        )
        .where(CariHareket.cari_id == cari_id, CariHareket.sirket_id == sirket_id)
        .group_by(CariHareket.para_birimi)
    )
    sonuclar = db.execute(sorgu).all()
    return [
        CariBakiyeYanit(
            para_birimi=r.para_birimi,
            toplam_giris=r.toplam_giris or 0,
            toplam_cikis=r.toplam_cikis or 0,
            net_bakiye=(r.toplam_giris or 0) - (r.toplam_cikis or 0),
        )
        for r in sonuclar]


@router.delete("/{cari_id}",
               dependencies=[Depends(izin_gerektir("CARI_DUZENLE"))])
def cari_sil(
    cari_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    cari = db.get(CariHesap, cari_id)
    if cari is None or cari.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cari kayıt bulunamadı.")

    try:
        db.delete(cari)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Bu cari kayıt başka kayıtlarda (sipariş, çek, hareket vb.) kullanıldığı için silinemiyor."
        )
    return {"silindi": True}
