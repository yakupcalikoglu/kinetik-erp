"""
Tedarikci/Hizmet Faturalari modulu - router.

Is akisi:
1) Fatura GELDIGINDE kaydedilir (POST /tedarikci-faturalari) - HENUZ hangi
   siparise/urune yansiyacagi SECILMEZ, sadece "bu firmaya X tutarinda
   borcumuz var" bilgisi olusur.
2) Fatura ODENIRKEN (POST /tedarikci-faturalari/{id}/ode), kullanici:
   - Hangi banka/kasa hesabindan (odeme_yontemi + banka_hesap_id)
   - Hangi siparise (orantili dagitim, TUM urunlere satinalma maliyetine
     gore payla) YA DA hangi TEK urune (stok_seri_no_id, tamami)
   - Hangi maliyet TIPINDE (gumruk, navlun, TSE, KDV, diger vb.)
   sayilacagini secer. Bu, hem Kasa/Banka'dan CIKIS hareketi olusturur,
   hem de ilgili StokSeriNo kayit(lar)ina StokMaliyetKalemi ekler (ozet
   sutunlari da senkron guncellenir - stok.py'deki maliyet_kalemi_ekle
   ile AYNI mantik).
"""
from decimal import Decimal
from datetime import date as date_cls
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.session import get_db
from app.core.deps import aktif_sirket_id_getir, izin_gerektir, aktif_kullanici_getir
from app.models.auth import Kullanici
from app.models.cari import CariHesap
from app.models.tedarikci_fatura import TedarikciFaturasi, TedarikciFaturaOdemesi
from app.models.stok import StokSeriNo, StokMaliyetKalemi, MALIYET_TIP_SUTUN_ESLEME, MaliyetTip
from app.schemas.tedarikci_fatura import (
    TedarikciFaturaOlusturIstegi, TedarikciFaturaGuncelleIstegi,
    TedarikciFaturaOdemeIstegi, TedarikciFaturaYanit, TedarikciFaturaOdemeYanit,
)
from app.services.para_hareketi import para_hareketi_olustur
from app.core.security import sifre_dogrula

router = APIRouter(prefix="/tedarikci-faturalari", tags=["Tedarikçi Faturaları"])


def _toplam_odenen_hesapla(db: Session, fatura_id: int) -> Decimal:
    odemeler = list(db.execute(
        select(TedarikciFaturaOdemesi).where(TedarikciFaturaOdemesi.fatura_id == fatura_id)
    ).scalars())
    return sum((o.tutar for o in odemeler), Decimal("0"))


def _detayli_getir(db: Session, fatura: TedarikciFaturasi) -> TedarikciFaturasi:
    cari = db.get(CariHesap, fatura.tedarikci_cari_id)
    fatura.tedarikci_unvan = cari.unvan if cari else None
    fatura.odemeler = list(db.execute(
        select(TedarikciFaturaOdemesi).where(TedarikciFaturaOdemesi.fatura_id == fatura.id)
    ).scalars())
    fatura.toplam_odenen = sum((o.tutar for o in fatura.odemeler), Decimal("0"))
    fatura.kalan_bakiye = fatura.tutar - fatura.toplam_odenen
    return fatura


@router.get("", response_model=list[TedarikciFaturaYanit],
            dependencies=[Depends(izin_gerektir("FATURA_GORUNTULE"))])
def faturalari_listele(
    tedarikci_cari_id: int | None = None,
    sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    sorgu = select(TedarikciFaturasi).where(TedarikciFaturasi.sirket_id == sirket_id)
    if tedarikci_cari_id:
        sorgu = sorgu.where(TedarikciFaturasi.tedarikci_cari_id == tedarikci_cari_id)
    faturalar = list(db.execute(sorgu.order_by(TedarikciFaturasi.tarih.desc())).scalars())
    return [_detayli_getir(db, f) for f in faturalar]


@router.post("", response_model=TedarikciFaturaYanit,
             dependencies=[Depends(izin_gerektir("FATURA_DUZENLE"))])
def fatura_olustur(
    istek: TedarikciFaturaOlusturIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    tedarikci = db.get(CariHesap, istek.tedarikci_cari_id)
    if tedarikci is None or tedarikci.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Tedarikçi/firma bulunamadı.")
    yeni = TedarikciFaturasi(
        sirket_id=sirket_id, tedarikci_cari_id=istek.tedarikci_cari_id,
        fatura_no=istek.fatura_no, tarih=istek.tarih, tutar=istek.tutar,
        para_birimi=istek.para_birimi, aciklama=istek.aciklama,
    )
    db.add(yeni)
    db.commit()
    db.refresh(yeni)
    return _detayli_getir(db, yeni)


@router.get("/{fatura_id}", response_model=TedarikciFaturaYanit,
            dependencies=[Depends(izin_gerektir("FATURA_GORUNTULE"))])
def fatura_detay(fatura_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db)):
    fatura = db.get(TedarikciFaturasi, fatura_id)
    if fatura is None or fatura.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Fatura bulunamadı.")
    return _detayli_getir(db, fatura)


@router.put("/{fatura_id}", response_model=TedarikciFaturaYanit,
            dependencies=[Depends(izin_gerektir("FATURA_DUZENLE"))])
def fatura_guncelle(
    fatura_id: int, istek: TedarikciFaturaGuncelleIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    fatura = db.get(TedarikciFaturasi, fatura_id)
    if fatura is None or fatura.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Fatura bulunamadı.")
    if not sifre_dogrula(kullanici, istek.sifre):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Şifreniz yanlış.")
    for alan, deger in istek.model_dump(exclude={"sifre"}, exclude_unset=True).items():
        setattr(fatura, alan, deger)
    db.commit()
    db.refresh(fatura)
    return _detayli_getir(db, fatura)


@router.delete("/{fatura_id}", dependencies=[Depends(izin_gerektir("FATURA_DUZENLE"))])
def fatura_sil(fatura_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db)):
    fatura = db.get(TedarikciFaturasi, fatura_id)
    if fatura is None or fatura.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Fatura bulunamadı.")
    odeme_var_mi = db.execute(
        select(TedarikciFaturaOdemesi).where(TedarikciFaturaOdemesi.fatura_id == fatura_id)
    ).first()
    if odeme_var_mi is not None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Bu faturaya ait ödeme kayıtları var - önce ödemeleri geri alın."
        )
    db.delete(fatura)
    db.commit()
    return {"basarili": True}


@router.post("/{fatura_id}/ode", response_model=TedarikciFaturaOdemeYanit,
             dependencies=[Depends(izin_gerektir("FATURA_DUZENLE"))])
def fatura_ode(
    fatura_id: int,
    istek: TedarikciFaturaOdemeIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    fatura = db.get(TedarikciFaturasi, fatura_id)
    if fatura is None or fatura.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Fatura bulunamadı.")

    toplam_odenen = _toplam_odenen_hesapla(db, fatura_id)
    kalan = fatura.tutar - toplam_odenen
    if istek.tutar <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ödeme tutarı sıfırdan büyük olmalıdır.")
    if istek.tutar > kalan:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Girilen tutar ({istek.tutar}), kalan bakiyeyi ({kalan}) aşıyor."
        )
    if istek.dagitim_tipi not in ("SIPARIS", "URUN"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "dagitim_tipi 'SIPARIS' veya 'URUN' olmalıdır.")
    try:
        maliyet_tipi_enum = MaliyetTip(istek.maliyet_tipi)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Geçersiz maliyet tipi: {istek.maliyet_tipi}")

    tutar_try = istek.tutar * istek.kur if fatura.para_birimi != "TRY" else istek.tutar

    # ---- Once odeme kaydini olustur (ID almak icin flush) ----
    yeni_odeme = TedarikciFaturaOdemesi(
        fatura_id=fatura_id, tutar=istek.tutar, odeme_tarihi=istek.odeme_tarihi,
        odeme_yontemi=istek.odeme_yontemi, banka_hesap_id=istek.banka_hesap_id, kur=istek.kur,
        dagitim_tipi=istek.dagitim_tipi, siparis_id=istek.siparis_id, stok_seri_no_id=istek.stok_seri_no_id,
        maliyet_tipi=maliyet_tipi_enum,
    )
    db.add(yeni_odeme)
    db.flush()

    # ---- Dagitim: ilgili urun(ler)e StokMaliyetKalemi ekle ----
    if istek.dagitim_tipi == "URUN":
        if not istek.stok_seri_no_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "URUN dağıtımı için stok_seri_no_id zorunludur.")
        urun = db.get(StokSeriNo, istek.stok_seri_no_id)
        if urun is None or urun.sirket_id != sirket_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ürün bulunamadı.")
        _maliyet_kalemi_ekle_ve_ozet_guncelle(
            db, urun, maliyet_tipi_enum, istek.tutar, fatura.para_birimi, istek.kur, tutar_try,
            fatura.tedarikci_cari_id, fatura.fatura_no, istek.odeme_tarihi,
            istek.aciklama or f"Fatura ödemesi — {fatura.fatura_no or '#' + str(fatura.id)}",
            tedarikci_fatura_odeme_id=yeni_odeme.id,
        )
    else:
        if not istek.siparis_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "SIPARIS dağıtımı için siparis_id zorunludur.")
        urunler = list(db.execute(
            select(StokSeriNo).where(StokSeriNo.siparis_id == istek.siparis_id, StokSeriNo.sirket_id == sirket_id)
        ).scalars())
        if not urunler:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Bu siparişe ait ürün (seri no) bulunamadı; önce sipariş teslim alınmalı."
            )
        toplam_satinalma = sum((u.satinalma_maliyeti_try or 0) for u in urunler)
        if toplam_satinalma == 0:
            # Satinalma maliyeti girilmemisse, ESIT dagit (guvenli varsayilan).
            pay_try_liste = [(u, tutar_try / len(urunler)) for u in urunler]
        else:
            pay_try_liste = [(u, tutar_try * (u.satinalma_maliyeti_try or 0) / toplam_satinalma) for u in urunler]

        for urun, pay_try in pay_try_liste:
            # Her urunun kendi payi, faturanin KENDI para biriminde de
            # oranti korunarak hesaplanir (kayit tutarliligi icin).
            pay_orijinal = istek.tutar * (pay_try / tutar_try) if tutar_try else Decimal("0")
            _maliyet_kalemi_ekle_ve_ozet_guncelle(
                db, urun, maliyet_tipi_enum, pay_orijinal, fatura.para_birimi, istek.kur, pay_try,
                fatura.tedarikci_cari_id, fatura.fatura_no, istek.odeme_tarihi,
                istek.aciklama or f"Fatura ödemesi (sipariş dağıtımı) — {fatura.fatura_no or '#' + str(fatura.id)}",
                tedarikci_fatura_odeme_id=yeni_odeme.id,
            )

    # ---- Kasa/Banka hareketi ----
    tedarikci = db.get(CariHesap, fatura.tedarikci_cari_id)
    para_hareketi_olustur(
        db, sirket_id, kullanici.id, "CIKIS", istek.tutar,
        istek.odeme_yontemi, istek.banka_hesap_id,
        aciklama=f"Tedarikçi faturası — {tedarikci.unvan if tedarikci else ''} ({fatura.fatura_no or '#' + str(fatura.id)})",
        kaynak_tablo="TEDARIKCI_FATURA_ODEME", kaynak_id=yeni_odeme.id,
        para_birimi=fatura.para_birimi, kur=istek.kur if fatura.para_birimi != "TRY" else None,
    )

    db.commit()
    db.refresh(yeni_odeme)
    return yeni_odeme


def _maliyet_kalemi_ekle_ve_ozet_guncelle(
    db, urun: StokSeriNo, tip: MaliyetTip, tutar: Decimal, para_birimi: str, kur: Decimal, tutar_try: Decimal,
    tedarikci_cari_id: int, belge_no: str | None, tarih: date_cls, aciklama: str,
    tedarikci_fatura_odeme_id: int | None = None,
):
    """stok.py'deki maliyet_kalemi_ekle ile AYNI mantik: detay kayit +
    ozet sutun senkron guncelleme (nakliye_maliyeti_try vb.)."""
    yeni_kalem = StokMaliyetKalemi(
        stok_seri_no_id=urun.id, tip=tip, aciklama=aciklama,
        tedarikci_cari_id=tedarikci_cari_id, para_birimi=para_birimi,
        tutar=tutar, kur=kur, tutar_try=tutar_try, belge_no=belge_no, tarih=tarih,
        odendi_mi=True, tedarikci_fatura_odeme_id=tedarikci_fatura_odeme_id,
    )
    db.add(yeni_kalem)
    ozet_sutun = MALIYET_TIP_SUTUN_ESLEME[tip]
    mevcut_deger = getattr(urun, ozet_sutun) or 0
    setattr(urun, ozet_sutun, mevcut_deger + tutar_try)


@router.put("/odemeler/{odeme_id}/geri-al", dependencies=[Depends(izin_gerektir("FATURA_DUZENLE"))])
def odeme_geri_al(odeme_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db)):
    """
    Bir fatura odemesini geri alir: olusan Kasa/Banka hareketini VE
    ilgili urun(ler)e eklenmis StokMaliyetKalemi kayit(lar)ini siler,
    ozet sutunlari da geriye dogru duzeltir.
    """
    from app.models.finansal import KasaHareketi, BankaHareketi

    odeme = db.get(TedarikciFaturaOdemesi, odeme_id)
    if odeme is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ödeme bulunamadı.")
    fatura = db.get(TedarikciFaturasi, odeme.fatura_id)
    if fatura is None or fatura.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ödeme bulunamadı.")

    # StokMaliyetKalemi kayitlarini DOGRUDAN FK ile (tedarikci_fatura_odeme_id)
    # buluyoruz - KESIN eslestirme, belge_no/tarih tahminine dayanmaz.
    ilgili_kalemler = list(db.execute(
        select(StokMaliyetKalemi).where(StokMaliyetKalemi.tedarikci_fatura_odeme_id == odeme_id)
    ).scalars())
    for kalem in ilgili_kalemler:
        urun = db.get(StokSeriNo, kalem.stok_seri_no_id)
        if urun is not None:
            ozet_sutun = MALIYET_TIP_SUTUN_ESLEME[kalem.tip]
            mevcut_deger = getattr(urun, ozet_sutun) or 0
            setattr(urun, ozet_sutun, max(Decimal("0"), mevcut_deger - kalem.tutar_try))
        db.delete(kalem)

    # Kasa/Banka hareketini sil
    for Model in (KasaHareketi, BankaHareketi):
        hareket = db.execute(
            select(Model).where(Model.kaynak_tablo == "TEDARIKCI_FATURA_ODEME", Model.kaynak_id == odeme_id)
        ).scalar_one_or_none()
        if hareket is not None:
            db.delete(hareket)

    db.delete(odeme)
    db.commit()
    return {"basarili": True}
