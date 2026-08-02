from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.db.session import get_db
from app.core.deps import aktif_sirket_id_getir, izin_gerektir, aktif_kullanici_getir
from app.models.auth import Kullanici
from app.models.akreditif import Akreditif, AkreditifKalemi, AkreditifDurum, AkreditifKalemTip
from app.models.akreditif_maliyet import AkreditifMaliyetDagitimi
from app.models.akreditif_taksit import AkreditifKalemTaksiti
from app.models.stok import Siparis, StokSeriNo
from app.models.banka import BankaHesabi
import json
from app.models.denetim import DuzenlemeKaydi
from app.core.security import sifre_dogrula
from app.schemas.akreditif import (
    AkreditifOlusturIstegi, AkreditifYanit, AkreditifDurumGuncelleIstegi,
    AkreditifKalemEkleIstegi, AkreditifKalemOdeIstegi, AkreditifKalemDuzenleIstegi,
    AkreditifUrunSecenegi, AkreditifMaliyetDagitIstegi, AkreditifMaliyetDagitYaniti,
    AkreditifMaliyetDagitimSatiri,
    AkreditifKalemTaksitlendirIstegi, AkreditifKalemTaksitiYanit, AkreditifKalemTaksitOdeIstegi,
    AkreditifKalemTaksitiDuzenleIstegi,
)
from app.services.para_hareketi import para_hareketi_olustur


def _degisiklikleri_kaydet(db: Session, sirket_id: int, kullanici_id: int, tablo_adi: str, kayit_id: int, degisiklikler: dict) -> None:
    if not degisiklikler:
        return
    db.add(DuzenlemeKaydi(
        sirket_id=sirket_id, kullanici_id=kullanici_id, tablo_adi=tablo_adi,
        kayit_id=kayit_id, degisiklikler=json.dumps(degisiklikler, ensure_ascii=False, default=str),
    ))

router = APIRouter(prefix="/akreditifler", tags=["Akreditif"])

kalem_router = APIRouter(prefix="/akreditif-kalemleri", tags=["Akreditif"])

# Dagitim gecmisi kayitlarinin silinmesi (geri alma) icin ayri, kucuk bir router.
dagitim_router = APIRouter(prefix="/akreditif-maliyet-dagitimlari", tags=["Akreditif"])

# Kalem taksit odemeleri icin ayri, kucuk bir router.
taksit_router = APIRouter(prefix="/akreditif-kalem-taksitleri", tags=["Akreditif"])


def _akreditif_getir_veya_404(db: Session, akreditif_id: int, sirket_id: int) -> Akreditif:
    kayit = db.get(Akreditif, akreditif_id)
    if kayit is None or kayit.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Akreditif bulunamadı.")
    return kayit


def _toplam_odenen_hesapla(db: Session, akreditif_id: int) -> Decimal:
    """
    Bir akreditif icin GERCEKTEN odenmis toplam tutari hesaplar. Bir
    kalem taksitlendirilmisse, o kalemin odenen kismi taksitlerin
    (odendi_mi=True olanlarin) toplamidir - kalem.odendi_mi SADECE tum
    taksitler odendiginde True olur, bu yuzden kismi odenmis bir kalemin
    katkisini bu sekilde dogru yakalariz.
    """
    toplam = Decimal("0")
    kalemler = list(db.execute(select(AkreditifKalemi).where(AkreditifKalemi.akreditif_id == akreditif_id)).scalars())
    for k in kalemler:
        taksitler = list(db.execute(select(AkreditifKalemTaksiti).where(AkreditifKalemTaksiti.kalem_id == k.id)).scalars())
        if taksitler:
            toplam += sum((t.tutar for t in taksitler if t.odendi_mi), Decimal("0"))
        else:
            toplam += k.odenen_tutar or Decimal("0")
    return toplam


def _detayli_getir(db: Session, akreditif_id: int) -> Akreditif:
    akreditif = db.get(Akreditif, akreditif_id)
    akreditif.kalemler = list(db.execute(
        select(AkreditifKalemi).where(AkreditifKalemi.akreditif_id == akreditif.id)
    ).scalars())
    akreditif.toplam_odenen = _toplam_odenen_hesapla(db, akreditif_id)
    akreditif.kalan_bakiye = akreditif.tutar - akreditif.toplam_odenen
    # Kendi kendini duzelten kontrol: gecmiste yanlis hesaplanmis/kalmis bir
    # durum varsa (orn. eski hatali mantiktan kalma "Kapandi"), her
    # goruntulemede gercek tutara gore otomatik duzeltilir.
    eski_durum = akreditif.durum
    _durumu_yeniden_hesapla(db, akreditif)
    if akreditif.durum != eski_durum:
        db.commit()
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
        kalemler = list(db.execute(
            select(AkreditifKalemi).where(AkreditifKalemi.akreditif_id == akreditif_id)
        ).scalars())
        kalem_idleri = [k.id for k in kalemler]

        if kalem_idleri:
            for taksit in list(db.execute(
                select(AkreditifKalemTaksiti).where(AkreditifKalemTaksiti.kalem_id.in_(kalem_idleri))
            ).scalars()):
                db.delete(taksit)
            db.flush()

        for dagitim in list(db.execute(
            select(AkreditifMaliyetDagitimi).where(AkreditifMaliyetDagitimi.akreditif_id == akreditif_id)
        ).scalars()):
            db.delete(dagitim)
        db.flush()

        for kalem in kalemler:
            db.delete(kalem)
        db.flush()

        db.delete(akreditif)
        db.commit()
    except IntegrityError as e:
        db.rollback()
        detay = str(getattr(e, "orig", e))
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Bu akreditif başka kayıtlarda kullanıldığı için silinemiyor. Teknik detay: {detay}"
        )
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
    degisiklik_var = False
    for a in akreditifler:
        a.kalemler = list(db.execute(
            select(AkreditifKalemi).where(AkreditifKalemi.akreditif_id == a.id)
        ).scalars())
        a.toplam_odenen = _toplam_odenen_hesapla(db, a.id)
        a.kalan_bakiye = a.tutar - a.toplam_odenen
        eski_durum = a.durum
        _durumu_yeniden_hesapla(db, a)
        if a.durum != eski_durum:
            degisiklik_var = True
    if degisiklik_var:
        db.commit()
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
    """
    Akreditifin durumunu, o ana kadar EKLENMIS kalemlerin hepsinin odenip
    odenmedigine gore DEGIL, akreditifin KENDI toplam tutarina (akreditif.tutar)
    gore hesaplar. Boylece henuz tum kalemleri girilmemis ya da kismen
    odenmis bir akreditif yanlislikla "Kapandi" olarak isaretlenmez -
    sadece GERCEKTEN tutarin tamami odendiginde kapanir.
    """
    if akreditif.durum == AkreditifDurum.IPTAL:
        return
    toplam_odenen = _toplam_odenen_hesapla(db, akreditif.id)
    if akreditif.tutar > 0 and toplam_odenen >= akreditif.tutar:
        akreditif.durum = AkreditifDurum.KAPANDI
    elif toplam_odenen > 0:
        akreditif.durum = AkreditifDurum.KISMI_ODENDI
    else:
        akreditif.durum = AkreditifDurum.ACIK


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

    if kalem.odendi_mi:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bu kalem zaten tamamen ödenmiş.")

    kalan = kalem.tutar - (kalem.odenen_tutar or Decimal("0"))
    if istek.tutar <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ödeme tutarı sıfırdan büyük olmalıdır.")
    if istek.tutar > kalan:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Girilen tutar ({istek.tutar}), bu kalemden kalan bakiyeyi ({kalan}) aşıyor."
        )

    kalem.odenen_tutar = (kalem.odenen_tutar or Decimal("0")) + istek.tutar
    if kalem.odenen_tutar >= kalem.tutar:
        kalem.odendi_mi = True
        kalem.odeme_tarihi = istek.odeme_tarihi

    para_hareketi_olustur(
        db, sirket_id, kullanici.id, "CIKIS", istek.tutar,
        istek.odeme_yontemi, istek.banka_hesap_id,
        aciklama=f"Akreditif {akreditif.akreditif_no or ''} - {kalem.tip.value}" + (" (kısmi ödeme)" if not kalem.odendi_mi else ""),
        kaynak_tablo="AKREDITIF_KALEMI", kaynak_id=kalem.id,
        para_birimi=akreditif.para_birimi, kur=istek.kur,
    )

    _durumu_yeniden_hesapla(db, akreditif)
    db.commit()
    return {"odendi": True}


@router.get("/{akreditif_id}/urun-secenekleri", response_model=list[AkreditifUrunSecenegi],
            dependencies=[Depends(izin_gerektir("AKREDITIF_GORUNTULE"))])
def akreditif_urun_secenekleri(
    akreditif_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    from app.models.stok import StokKarti
    akreditif = _akreditif_getir_veya_404(db, akreditif_id, sirket_id)
    urunler = list(db.execute(
        select(StokSeriNo).where(StokSeriNo.siparis_id == akreditif.siparis_id, StokSeriNo.sirket_id == sirket_id)
    ).scalars())
    kart_haritasi = {
        k.id: f"{k.marka} {k.model}".strip() for k in db.execute(
            select(StokKarti).where(StokKarti.sirket_id == sirket_id)
        ).scalars()
    }
    return [
        AkreditifUrunSecenegi(
            stok_seri_no_id=u.id, seri_no=u.seri_no, stok_karti_id=u.stok_karti_id,
            urun_adi=kart_haritasi.get(u.stok_karti_id),
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


@kalem_router.post("/{kalem_id}/taksitlendir", response_model=list[AkreditifKalemTaksitiYanit],
                    dependencies=[Depends(izin_gerektir("AKREDITIF_DUZENLE"))])
def akreditif_kalemi_taksitlendir(
    kalem_id: int,
    istek: AkreditifKalemTaksitlendirIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    kalem = db.get(AkreditifKalemi, kalem_id)
    if kalem is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Akreditif kalemi bulunamadı.")
    akreditif = db.get(Akreditif, kalem.akreditif_id)
    if akreditif is None or akreditif.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Akreditif kalemi bulunamadı.")
    if kalem.odendi_mi:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bu kalem zaten ödenmiş, taksitlendirilemez.")

    mevcut_taksitler = list(db.execute(
        select(AkreditifKalemTaksiti).where(AkreditifKalemTaksiti.kalem_id == kalem_id)
    ).scalars())
    if mevcut_taksitler:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bu kalem zaten taksitlendirilmiş.")

    from dateutil.relativedelta import relativedelta
    toplam = kalem.tutar + istek.ek_ucret
    taksit_tutari = round(toplam / istek.taksit_sayisi, 2)

    olusturulanlar = []
    for i in range(1, istek.taksit_sayisi + 1):
        vade = istek.ilk_vade_tarihi + relativedelta(months=i - 1)
        tutar = taksit_tutari
        if i == istek.taksit_sayisi:
            tutar = toplam - taksit_tutari * (istek.taksit_sayisi - 1)
        yeni = AkreditifKalemTaksiti(kalem_id=kalem_id, taksit_no=i, vade_tarihi=vade, tutar=tutar)
        db.add(yeni)
        olusturulanlar.append(yeni)

    db.commit()
    for t in olusturulanlar:
        db.refresh(t)
    return olusturulanlar


@kalem_router.get("/{kalem_id}/taksitler", response_model=list[AkreditifKalemTaksitiYanit],
                   dependencies=[Depends(izin_gerektir("AKREDITIF_GORUNTULE"))])
def akreditif_kalem_taksitlerini_listele(
    kalem_id: int,
    db: Session = Depends(get_db),
):
    sorgu = (
        select(AkreditifKalemTaksiti)
        .where(AkreditifKalemTaksiti.kalem_id == kalem_id)
        .order_by(AkreditifKalemTaksiti.taksit_no)
    )
    return list(db.execute(sorgu).scalars())


@taksit_router.put("/{taksit_id}/ode", response_model=AkreditifKalemTaksitiYanit,
                    dependencies=[Depends(izin_gerektir("AKREDITIF_DUZENLE"))])
def akreditif_kalem_taksiti_ode(
    taksit_id: int,
    istek: AkreditifKalemTaksitOdeIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    taksit = db.get(AkreditifKalemTaksiti, taksit_id)
    if taksit is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Taksit bulunamadı.")

    kalem = db.get(AkreditifKalemi, taksit.kalem_id)
    if kalem is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Taksit bulunamadı.")
    akreditif = db.get(Akreditif, kalem.akreditif_id)
    if akreditif is None or akreditif.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Taksit bulunamadı.")

    taksit.odendi_mi = True
    taksit.odeme_tarihi = istek.odeme_tarihi

    para_hareketi_olustur(
        db, sirket_id, kullanici.id, "CIKIS", taksit.tutar,
        istek.odeme_yontemi, istek.banka_hesap_id,
        aciklama=f"Akreditif {akreditif.akreditif_no or ''} - Taksit {taksit.taksit_no} ({kalem.tip.value})",
        kaynak_tablo="AKREDITIF_KALEM_TAKSIT", kaynak_id=taksit.id,
        para_birimi=akreditif.para_birimi, kur=istek.kur,
    )

    tum_taksitler = list(db.execute(
        select(AkreditifKalemTaksiti).where(AkreditifKalemTaksiti.kalem_id == kalem.id)
    ).scalars())
    if all(t.odendi_mi for t in tum_taksitler):
        kalem.odendi_mi = True
        kalem.odeme_tarihi = istek.odeme_tarihi

    # Her taksit odemesinde (kalem henuz tam kapanmamis olsa bile) akreditifin
    # genel durumunu (Acik/Kismi Odendi/Kapandi) yeniden hesapla - artik bu,
    # akreditifin KENDI toplam tutarina kiyasla yapiliyor (bkz. _durumu_yeniden_hesapla).
    _durumu_yeniden_hesapla(db, akreditif)

    db.commit()
    db.refresh(taksit)
    return taksit


@kalem_router.put("/{kalem_id}", response_model=AkreditifYanit,
                   dependencies=[Depends(izin_gerektir("AKREDITIF_DUZENLE"))])
def akreditif_kalemi_duzenle(
    kalem_id: int,
    istek: AkreditifKalemDuzenleIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    """Yanlis girilmis bir maliyet kalemini duzeltir. Sifre onayi zorunludur; degisiklikler denetim_kayitlari'na islenir."""
    if not sifre_dogrula(istek.sifre, kullanici.sifre_hash):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Şifre yanlış, düzenleme yapılamadı.")

    kalem = db.get(AkreditifKalemi, kalem_id)
    if kalem is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Akreditif kalemi bulunamadı.")
    akreditif = db.get(Akreditif, kalem.akreditif_id)
    if akreditif is None or akreditif.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Akreditif kalemi bulunamadı.")
    if kalem.odendi_mi:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ödenmiş bir kalem düzenlenemez.")

    taksit_var_mi = db.execute(
        select(AkreditifKalemTaksiti).where(AkreditifKalemTaksiti.kalem_id == kalem_id)
    ).first()
    if taksit_var_mi is not None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Taksitlendirilmiş bir kalem düzenlenemez; önce taksitleri silin."
        )

    alan_adlari = {"tip": "Tip", "aciklama": "Açıklama", "tutar": "Tutar", "vade_tarihi": "Vade Tarihi"}
    yeni_degerler = {"tip": istek.tip, "aciklama": istek.aciklama, "tutar": istek.tutar, "vade_tarihi": istek.vade_tarihi}
    degisiklikler = {}
    for alan, etiket in alan_adlari.items():
        eski = getattr(kalem, alan)
        yeni = yeni_degerler[alan]
        eski_metin = eski.value if hasattr(eski, "value") else eski
        yeni_metin = yeni.value if hasattr(yeni, "value") else yeni
        if str(eski_metin) != str(yeni_metin):
            degisiklikler[etiket] = {"eski": eski_metin, "yeni": yeni_metin}
        setattr(kalem, alan, yeni)

    _degisiklikleri_kaydet(db, sirket_id, kullanici.id, "akreditif_kalemleri", kalem.id, degisiklikler)

    db.commit()
    return _detayli_getir(db, akreditif.id)


@kalem_router.delete("/{kalem_id}", dependencies=[Depends(izin_gerektir("AKREDITIF_DUZENLE"))])
def akreditif_kalemi_sil(
    kalem_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    kalem = db.get(AkreditifKalemi, kalem_id)
    if kalem is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Akreditif kalemi bulunamadı.")
    akreditif = db.get(Akreditif, kalem.akreditif_id)
    if akreditif is None or akreditif.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Akreditif kalemi bulunamadı.")
    if kalem.odendi_mi:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ödenmiş bir kalem silinemez.")

    taksitler = list(db.execute(
        select(AkreditifKalemTaksiti).where(AkreditifKalemTaksiti.kalem_id == kalem_id)
    ).scalars())
    if any(t.odendi_mi for t in taksitler):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ödenmiş taksiti olan bir kalem silinemez.")
    for t in taksitler:
        db.delete(t)

    db.delete(kalem)
    db.commit()
    return {"silindi": True}


@taksit_router.put("/{taksit_id}", response_model=AkreditifKalemTaksitiYanit,
                    dependencies=[Depends(izin_gerektir("AKREDITIF_DUZENLE"))])
def akreditif_kalem_taksitini_duzenle(
    taksit_id: int,
    istek: AkreditifKalemTaksitiDuzenleIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    taksit = db.get(AkreditifKalemTaksiti, taksit_id)
    if taksit is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Taksit bulunamadı.")
    kalem = db.get(AkreditifKalemi, taksit.kalem_id)
    akreditif = db.get(Akreditif, kalem.akreditif_id) if kalem else None
    if akreditif is None or akreditif.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Taksit bulunamadı.")
    if taksit.odendi_mi:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ödenmiş bir taksit düzenlenemez.")

    taksit.vade_tarihi = istek.vade_tarihi
    taksit.tutar = istek.tutar
    db.commit()
    db.refresh(taksit)
    return taksit


@taksit_router.delete("/{taksit_id}", dependencies=[Depends(izin_gerektir("AKREDITIF_DUZENLE"))])
def akreditif_kalem_taksitini_sil(
    taksit_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    taksit = db.get(AkreditifKalemTaksiti, taksit_id)
    if taksit is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Taksit bulunamadı.")
    kalem = db.get(AkreditifKalemi, taksit.kalem_id)
    akreditif = db.get(Akreditif, kalem.akreditif_id) if kalem else None
    if akreditif is None or akreditif.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Taksit bulunamadı.")
    if taksit.odendi_mi:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ödenmiş bir taksit silinemez.")

    db.delete(taksit)
    db.commit()
    return {"silindi": True}


@kalem_router.put("/{kalem_id}/odemeyi-geri-al", dependencies=[Depends(izin_gerektir("AKREDITIF_DUZENLE"))])
def akreditif_kalemi_odemesini_geri_al(
    kalem_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    kalem = db.get(AkreditifKalemi, kalem_id)
    if kalem is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Akreditif kalemi bulunamadı.")
    akreditif = db.get(Akreditif, kalem.akreditif_id)
    if akreditif is None or akreditif.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Akreditif kalemi bulunamadı.")
    if not kalem.odendi_mi:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bu kalem zaten ödenmemiş durumda.")

    from app.models.banka import KasaHareketi, BankaHareketi
    for kasa_h in list(db.execute(
        select(KasaHareketi).where(KasaHareketi.kaynak_tablo == "AKREDITIF_KALEMI", KasaHareketi.kaynak_id == kalem_id)
    ).scalars()):
        db.delete(kasa_h)
    for banka_h in list(db.execute(
        select(BankaHareketi).where(BankaHareketi.kaynak_tablo == "AKREDITIF_KALEMI", BankaHareketi.kaynak_id == kalem_id)
    ).scalars()):
        db.delete(banka_h)

    kalem.odendi_mi = False
    kalem.odeme_tarihi = None
    _durumu_yeniden_hesapla(db, akreditif)

    db.commit()
    return {"geri_alindi": True}


@taksit_router.put("/{taksit_id}/odemeyi-geri-al", dependencies=[Depends(izin_gerektir("AKREDITIF_DUZENLE"))])
def akreditif_kalem_taksitinin_odemesini_geri_al(
    taksit_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    taksit = db.get(AkreditifKalemTaksiti, taksit_id)
    if taksit is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Taksit bulunamadı.")
    kalem = db.get(AkreditifKalemi, taksit.kalem_id)
    akreditif = db.get(Akreditif, kalem.akreditif_id) if kalem else None
    if akreditif is None or akreditif.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Taksit bulunamadı.")
    if not taksit.odendi_mi:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bu taksit zaten ödenmemiş durumda.")

    from app.models.banka import KasaHareketi, BankaHareketi
    for kasa_h in list(db.execute(
        select(KasaHareketi).where(KasaHareketi.kaynak_tablo == "AKREDITIF_KALEM_TAKSIT", KasaHareketi.kaynak_id == taksit_id)
    ).scalars()):
        db.delete(kasa_h)
    for banka_h in list(db.execute(
        select(BankaHareketi).where(BankaHareketi.kaynak_tablo == "AKREDITIF_KALEM_TAKSIT", BankaHareketi.kaynak_id == taksit_id)
    ).scalars()):
        db.delete(banka_h)

    taksit.odendi_mi = False
    taksit.odeme_tarihi = None

    if kalem.odendi_mi:
        kalem.odendi_mi = False
        kalem.odeme_tarihi = None
    _durumu_yeniden_hesapla(db, akreditif)

    db.commit()
    return {"geri_alindi": True}
