from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.db.session import get_db
from app.core.deps import aktif_sirket_id_getir, izin_gerektir, aktif_kullanici_getir
from app.models.auth import Kullanici
from app.models.akreditif import Akreditif, AkreditifKalemi, AkreditifDurum, AkreditifKalemTip
from app.models.akreditif_maliyet import AkreditifMaliyetDagitimi
from app.models.stok import Siparis, StokSeriNo
from app.models.banka import BankaHesabi
from app.schemas.akreditif import (
    AkreditifOlusturIstegi, AkreditifYanit, AkreditifDurumGuncelleIstegi,
    AkreditifKalemEkleIstegi, AkreditifKalemOdeIstegi,
    AkreditifUrunSecenegi, AkreditifMaliyetDagitIstegi, AkreditifMaliyetDagitYaniti,
    AkreditifMaliyetDagitimSatiri,
)
from app.services.para_hareketi import para_hareketi_olustur

router = APIRouter(prefix="/akreditifler", tags=["Akreditif"])

kalem_router = APIRouter(prefix="/akreditif-kalemleri", tags=["Akreditif"])

dagitim_router = APIRouter(prefix="/akreditif-maliyet-dagitimlari", tags=["Akreditif"])


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


@router.put("/{akreditif_id}", response_model=AkreditifYanit,
            dependencies=[Depends(izin_gerektir("AKREDITIF_DUZENLE"))])
def akreditif_guncelle(
    akreditif_id: int,
    istek: AkreditifOlusturIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    akreditif = _akreditif_getir_veya_404(db, akreditif_id, sirket_id)

    siparis = db.get(Siparis, istek.siparis_id)
    if siparis is None or siparis.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Sipariş bulunamadı (ID={istek.siparis_id}).")

    banka = db.get(BankaHesabi, istek.banka_hesap_id)
    if banka is None or banka.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Banka hesabı bulunamadı (ID={istek.banka_hesap_id}).")

    for alan, deger in istek.model_dump().items():
        setattr(akreditif, alan, deger)
    db.commit()
    return _detayli_getir(db, akreditif_id)


@router.delete("/{akreditif_id}",
               dependencies=[Depends(izin_gerektir("AKREDITIF_DUZENLE"))])
def akreditif_sil(
    akreditif_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    akreditif = _akreditif_getir_veya_404(db, akreditif_id, sirket_id)
    try:
        for kalem in list(db.execute(
            select(AkreditifKalemi).where(AkreditifKalemi.akreditif_id == akreditif_id)
        ).scalars()):
            db.delete(kalem)
        db.delete(akreditif)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bu akreditif başka kayıtlarda kullanıldığı için silinemiyor.")
    return {"silindi": True}


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
        para_birimi=akreditif.para_birimi, kur=istek.kur,
    )

    _durumu_yeniden_hesapla(db, akreditif)
    db.commit()
    return {"odendi": True}


# --------------------------------------------------------- Maliyet Dağıtımı
@router.get("/{akreditif_id}/urun-secenekleri", response_model=list[AkreditifUrunSecenegi],
            dependencies=[Depends(izin_gerektir("AKREDITIF_GORUNTULE"))])
def akreditif_urun_secenekleri(
    akreditif_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    akreditif = _akreditif_getir_veya_404(db, akreditif_id, sirket_id)
    urunler = list(db.execute(
        select(StokSeriNo).where(StokSeriNo.siparis_id == akreditif.siparis_id, StokSeriNo.sirket_id == sirket_id)
    ).scalars())
    return [
        AkreditifUrunSecenegi(
            stok_seri_no_id=u.id, seri_no=u.seri_no,
            satinalma_maliyeti_try=u.satinalma_maliyeti_try,
            mevcut_diger_maliyet_try=u.diger_maliyet_try,
        )
        for u in urunler
    ]


@router.get("/{akreditif_id}/maliyet-dagitimlari", response_model=list[AkreditifMaliyetDagitimSatiri],
            dependencies=[Depends(izin_gerektir("AKREDITIF_GORUNTULE"))])
def akreditif_maliyet_dagitim_gecmisi(
    akreditif_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    _akreditif_getir_veya_404(db, akreditif_id, sirket_id)
    kayitlar = list(db.execute(
        select(AkreditifMaliyetDagitimi)
        .where(AkreditifMaliyetDagitimi.akreditif_id == akreditif_id)
        .order_by(AkreditifMaliyetDagitimi.olusturma_tarihi.desc())
    ).scalars())

    seri_no_haritasi = {
        u.id: u.seri_no for u in db.execute(
            select(StokSeriNo).where(StokSeriNo.sirket_id == sirket_id)
        ).scalars()
    }

    return [
        AkreditifMaliyetDagitimSatiri(
            id=k.id, stok_seri_no_id=k.stok_seri_no_id,
            seri_no=seri_no_haritasi.get(k.stok_seri_no_id),
            yontem=k.yontem, kur=k.kur, tutar_try=k.tutar_try,
            olusturma_tarihi=k.olusturma_tarihi,
        )
        for k in kayitlar
    ]


@router.post("/{akreditif_id}/maliyet-dagit", response_model=AkreditifMaliyetDagitYaniti,
             dependencies=[Depends(izin_gerektir("AKREDITIF_DUZENLE"))])
def akreditif_maliyet_dagit(
    akreditif_id: int,
    istek: AkreditifMaliyetDagitIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    akreditif = _akreditif_getir_veya_404(db, akreditif_id, sirket_id)

    kalemler = list(db.execute(
        select(AkreditifKalemi).where(
            AkreditifKalemi.akreditif_id == akreditif_id,
            AkreditifKalemi.tip.in_([AkreditifKalemTip.KOMISYON, AkreditifKalemTip.MASRAF]),
        )
    ).scalars())
    if not kalemler:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Dağıtılacak komisyon/masraf kalemi bulunamadı.")

    toplam_masraf = sum(k.tutar for k in kalemler)
    toplam_masraf_try = toplam_masraf if akreditif.para_birimi == "TRY" else toplam_masraf * istek.kur

    tum_urunler = list(db.execute(
        select(StokSeriNo).where(StokSeriNo.siparis_id == akreditif.siparis_id, StokSeriNo.sirket_id == sirket_id)
    ).scalars())
    if not tum_urunler:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Bu siparişe ait ürün (seri no) bulunamadı; önce sipariş teslim alınmalı."
        )

    if istek.stok_seri_no_idleri:
        urunler = [u for u in tum_urunler if u.id in istek.stok_seri_no_idleri]
        if not urunler:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Seçilen ürünler bu siparişe ait değil.")
    else:
        urunler = tum_urunler

    if istek.yontem == "ESIT":
        pay = toplam_masraf_try / len(urunler)
        for u in urunler:
            u.diger_maliyet_try = (u.diger_maliyet_try or 0) + pay
            db.add(AkreditifMaliyetDagitimi(
                akreditif_id=akreditif_id, stok_seri_no_id=u.id,
                yontem="ESIT", kur=istek.kur, tutar_try=pay,
            ))
    elif istek.yontem == "AGIRLIKLI":
        toplam_satinalma = sum(u.satinalma_maliyeti_try or 0 for u in urunler)
        if toplam_satinalma == 0:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Ürünlerin satınalma maliyeti girilmemiş, ağırlıklı dağıtım yapılamıyor."
            )
        for u in urunler:
            oran = (u.satinalma_maliyeti_try or 0) / toplam_satinalma
            pay = toplam_masraf_try * oran
            u.diger_maliyet_try = (u.diger_maliyet_try or 0) + pay
            db.add(AkreditifMaliyetDagitimi(
                akreditif_id=akreditif_id, stok_seri_no_id=u.id,
                yontem="AGIRLIKLI", kur=istek.kur, tutar_try=pay,
            ))
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "yontem 'ESIT' veya 'AGIRLIKLI' olmalıdır.")

    db.commit()
    return AkreditifMaliyetDagitYaniti(
        dagitilan_urun_sayisi=len(urunler), toplam_dagitilan_try=toplam_masraf_try,
    )


@dagitim_router.delete("/{dagitim_id}")
def akreditif_maliyet_dagitimi_geri_al(
    dagitim_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    kayit = db.get(AkreditifMaliyetDagitimi, dagitim_id)
    if kayit is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dağıtım kaydı bulunamadı.")

    urun = db.get(StokSeriNo, kayit.stok_seri_no_id)
    if urun is not None and urun.sirket_id == sirket_id:
        urun.diger_maliyet_try = max((urun.diger_maliyet_try or 0) - kayit.tutar_try, 0)

    db.delete(kayit)
    db.commit()
    return {"geri_alindi": True}
