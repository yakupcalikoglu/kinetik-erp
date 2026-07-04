from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from dateutil.relativedelta import relativedelta

from app.db.session import get_db
from app.core.deps import aktif_sirket_id_getir, izin_gerektir, aktif_kullanici_getir
from app.models.auth import Kullanici
from app.models.finansal import (
    Cek, CekGecmis, CekDurum, CekTip,
    LeasingSozlesme, LeasingOdeme,
    TaksitliSatisPlani, TaksitDetay,
    KiralamaSozlesme, KiralamaOdeme,
    BakimKaydi, BakimTip,
)
from app.schemas.finansal import (
    CekOlusturIstegi, CekYanit, CekDurumGuncelleIstegi, CekGecmisYanit,
    LeasingOlusturIstegi, LeasingYanit, LeasingOdemeYanit, OdemeTahsilIstegi,
    TaksitliSatisOlusturIstegi, TaksitliSatisYanit, TaksitDetayYanit, TaksitTahsilIstegi,
    KiralamaOlusturIstegi, KiralamaYanit, KiralamaOdemeOlusturIstegi, KiralamaOdemeYanit,
    BakimOlusturIstegi, BakimYanit,
)
from app.services.para_hareketi import para_hareketi_olustur

router = APIRouter(tags=["Finansal Takip"])


# ============================================================================ ÇEK
@router.post("/cekler", response_model=CekYanit, dependencies=[Depends(izin_gerektir("CEK_DUZENLE"))])
def cek_olustur(istek: CekOlusturIstegi, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db)):
    yeni = Cek(sirket_id=sirket_id, **istek.model_dump())
    db.add(yeni)
    db.commit()
    db.refresh(yeni)
    return yeni


@router.get("/cekler", response_model=list[CekYanit], dependencies=[Depends(izin_gerektir("CEK_GORUNTULE"))])
def cekleri_listele(
    tip: str | None = None, durum: str | None = None,
    sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    sorgu = select(Cek).where(Cek.sirket_id == sirket_id)
    if tip:
        sorgu = sorgu.where(Cek.tip == tip)
    if durum:
        sorgu = sorgu.where(Cek.durum == durum)
    return list(db.execute(sorgu).scalars())


@router.put("/cekler/{cek_id}/durum", response_model=CekYanit, dependencies=[Depends(izin_gerektir("CEK_DUZENLE"))])
def cek_durum_guncelle(
    cek_id: int, istek: CekDurumGuncelleIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    """
    Durum TAHSIL_EDILDI (ALINAN cek bankaya tahsile verildi) veya ODENDI
    (VERILEN cek karsilandi) yapilirken odeme_yontemi zorunludur; bu durumda
    otomatik olarak Ana Kasa'ya veya secilen banka hesabina bir hareket acilir.
    """
    cek = db.get(Cek, cek_id)
    if cek is None or cek.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Çek bulunamadı.")

    if istek.yeni_durum == CekDurum.CIRO_EDILDI and istek.ciro_edilen_cari_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ciro işlemi için ciro_edilen_cari_id zorunludur.")

    para_hareketi_gereken_durumlar = (CekDurum.TAHSIL_EDILDI, CekDurum.ODENDI)
    if istek.yeni_durum in para_hareketi_gereken_durumlar and not istek.odeme_yontemi:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Bu durum güncellemesi için odeme_yontemi ('NAKIT' veya 'BANKA') zorunludur."
        )

    eski_durum = cek.durum
    cek.durum = istek.yeni_durum
    if istek.ciro_edilen_cari_id is not None:
        cek.ciro_edilen_cari_id = istek.ciro_edilen_cari_id
        from datetime import date
        cek.ciro_tarihi = date.today()

    if istek.yeni_durum in para_hareketi_gereken_durumlar:
        # ALINAN cek tahsil edilince GIRIS, VERILEN cek odenince CIKIS.
        yon = "GIRIS" if cek.tip == CekTip.ALINAN else "CIKIS"
        para_hareketi_olustur(
            db, sirket_id, kullanici.id, yon, cek.tutar,
            istek.odeme_yontemi, istek.banka_hesap_id,
            aciklama=f"Çek {cek.cek_no or ('#' + str(cek.id))} - {istek.yeni_durum.value}",
            kaynak_tablo="CEKLER", kaynak_id=cek.id, cari_id=cek.cari_id,
            para_birimi=cek.para_birimi.value, kur=istek.kur,
        )

    db.add(CekGecmis(
        cek_id=cek.id, tarih=cek.ciro_tarihi or cek.alinma_verilme_tarihi,
        eski_durum=eski_durum, yeni_durum=istek.yeni_durum,
        aciklama=istek.aciklama, olusturan_kullanici_id=kullanici.id,
    ))
    db.commit()
    db.refresh(cek)
    return cek


@router.get("/cekler/{cek_id}/gecmis", response_model=list[CekGecmisYanit],
            dependencies=[Depends(izin_gerektir("CEK_GORUNTULE"))])
def cek_gecmisi(cek_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db)):
    cek = db.get(Cek, cek_id)
    if cek is None or cek.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Çek bulunamadı.")
    sorgu = select(CekGecmis).where(CekGecmis.cek_id == cek_id).order_by(CekGecmis.id)
    return list(db.execute(sorgu).scalars())


# ========================================================================= LEASING
@router.post("/leasing-sozlesmeleri", response_model=LeasingYanit,
             dependencies=[Depends(izin_gerektir("LEASING_DUZENLE"))])
def leasing_olustur(
    istek: LeasingOlusturIstegi, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    """Sozlesme olusturulurken taksit_sayisi'na gore odeme plani OTOMATIK uretilir (esit taksitler)."""
    yeni = LeasingSozlesme(sirket_id=sirket_id, **istek.model_dump())
    db.add(yeni)
    db.flush()

    taksit_tutari = round(istek.toplam_tutar / istek.taksit_sayisi, 2)
    for i in range(1, istek.taksit_sayisi + 1):
        vade = istek.baslangic_tarihi + relativedelta(months=i)
        # son taksitte yuvarlama farkini kapat
        tutar = taksit_tutari
        if i == istek.taksit_sayisi:
            tutar = istek.toplam_tutar - taksit_tutari * (istek.taksit_sayisi - 1)
        db.add(LeasingOdeme(leasing_id=yeni.id, taksit_no=i, vade_tarihi=vade, tutar=tutar))

    db.commit()
    db.refresh(yeni)
    return yeni


@router.get("/leasing-sozlesmeleri", response_model=list[LeasingYanit],
            dependencies=[Depends(izin_gerektir("LEASING_GORUNTULE"))])
def leasing_listele(sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db)):
    sorgu = select(LeasingSozlesme).where(LeasingSozlesme.sirket_id == sirket_id)
    return list(db.execute(sorgu).scalars())


@router.get("/leasing-sozlesmeleri/{leasing_id}/odeme-plani", response_model=list[LeasingOdemeYanit],
            dependencies=[Depends(izin_gerektir("LEASING_GORUNTULE"))])
def leasing_odeme_plani(leasing_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db)):
    sozlesme = db.get(LeasingSozlesme, leasing_id)
    if sozlesme is None or sozlesme.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Leasing sözleşmesi bulunamadı.")
    sorgu = select(LeasingOdeme).where(LeasingOdeme.leasing_id == leasing_id).order_by(LeasingOdeme.taksit_no)
    return list(db.execute(sorgu).scalars())


@router.put("/leasing-odemeleri/{odeme_id}/ode", response_model=LeasingOdemeYanit,
            dependencies=[Depends(izin_gerektir("LEASING_DUZENLE"))])
def leasing_odeme_yap(
    odeme_id: int, istek: OdemeTahsilIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    odeme = db.get(LeasingOdeme, odeme_id)
    if odeme is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ödeme kaydı bulunamadı.")
    sozlesme = db.get(LeasingSozlesme, odeme.leasing_id)
    if sozlesme is None or sozlesme.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ödeme kaydı bulunamadı.")

    odeme.odendi_mi = True
    odeme.odeme_tarihi = istek.odeme_tarihi

    para_hareketi_olustur(
        db, sirket_id, kullanici.id, "CIKIS", odeme.tutar,
        istek.odeme_yontemi, istek.banka_hesap_id,
        aciklama=f"Leasing {sozlesme.sozlesme_no or ''} - Taksit {odeme.taksit_no}",
        kaynak_tablo="LEASING_ODEME", kaynak_id=odeme.id,
        cari_id=sozlesme.leasing_firmasi_cari_id,
        para_birimi=sozlesme.para_birimi.value, kur=istek.kur,
    )

    db.commit()
    db.refresh(odeme)
    return odeme


# =================================================================== TAKSİTLİ SATIŞ
@router.post("/taksitli-satis-planlari", response_model=TaksitliSatisYanit,
             dependencies=[Depends(izin_gerektir("TAKSIT_DUZENLE"))])
def taksitli_satis_olustur(
    istek: TaksitliSatisOlusturIstegi, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    """Plan olusturulunca (toplam_tutar - pesinat) taksit_sayisi'na bolunup taksit_detay OTOMATIK uretilir."""
    yeni = TaksitliSatisPlani(sirket_id=sirket_id, **istek.model_dump())
    db.add(yeni)
    db.flush()

    if istek.stok_seri_no_id:
        from app.models.stok import StokSeriNo, StokDurum
        urun = db.get(StokSeriNo, istek.stok_seri_no_id)
        if urun is not None and urun.sirket_id == sirket_id and urun.durum != StokDurum.SATILDI:
            urun.durum = StokDurum.SATILDI
            urun.musteri_cari_id = istek.musteri_cari_id
            urun.satis_fiyati_try = istek.toplam_tutar
            urun.satis_tarihi = istek.baslangic_tarihi

    kalan = istek.toplam_tutar - istek.pesinat
    taksit_tutari = round(kalan / istek.taksit_sayisi, 2)
    for i in range(1, istek.taksit_sayisi + 1):
        vade = istek.baslangic_tarihi + relativedelta(months=i)
        tutar = taksit_tutari
        if i == istek.taksit_sayisi:
            tutar = kalan - taksit_tutari * (istek.taksit_sayisi - 1)
        db.add(TaksitDetay(plan_id=yeni.id, taksit_no=i, vade_tarihi=vade, tutar=tutar))

    db.commit()
    db.refresh(yeni)
    return yeni


@router.get("/taksitli-satis-planlari/{plan_id}/taksitler", response_model=list[TaksitDetayYanit],
            dependencies=[Depends(izin_gerektir("TAKSIT_GORUNTULE"))])
def taksitleri_listele(plan_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db)):
    plan = db.get(TaksitliSatisPlani, plan_id)
    if plan is None or plan.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Taksit planı bulunamadı.")
    sorgu = select(TaksitDetay).where(TaksitDetay.plan_id == plan_id).order_by(TaksitDetay.taksit_no)
    return list(db.execute(sorgu).scalars())


@router.put("/taksit-detay/{taksit_id}/tahsil-et", response_model=TaksitDetayYanit,
            dependencies=[Depends(izin_gerektir("TAKSIT_DUZENLE"))])
def taksit_tahsil_et(
    taksit_id: int, istek: TaksitTahsilIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    taksit = db.get(TaksitDetay, taksit_id)
    if taksit is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Taksit bulunamadı.")
    plan = db.get(TaksitliSatisPlani, taksit.plan_id)
    if plan is None or plan.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Taksit bulunamadı.")

    taksit.odendi_mi = True
    taksit.odeme_tarihi = istek.odeme_tarihi
    taksit.tahsilat_kaynak_tablo = istek.tahsilat_kaynak_tablo
    taksit.tahsilat_kaynak_id = istek.tahsilat_kaynak_id

    para_hareketi_olustur(
        db, sirket_id, kullanici.id, "GIRIS", taksit.tutar,
        istek.odeme_yontemi, istek.banka_hesap_id,
        aciklama=f"Taksit {taksit.taksit_no} tahsilatı",
        kaynak_tablo="TAKSIT_DETAY", kaynak_id=taksit.id,
        cari_id=plan.musteri_cari_id,
        para_birimi=plan.para_birimi.value, kur=istek.kur,
    )

    db.commit()
    db.refresh(taksit)
    return taksit


@router.get("/taksitler/vadesi-gecenler", response_model=list[TaksitDetayYanit],
            dependencies=[Depends(izin_gerektir("TAKSIT_GORUNTULE"))])
def vadesi_gecen_taksitler(sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db)):
    from datetime import date
    sorgu = (
        select(TaksitDetay)
        .join(TaksitliSatisPlani, TaksitliSatisPlani.id == TaksitDetay.plan_id)
        .where(
            TaksitliSatisPlani.sirket_id == sirket_id,
            TaksitDetay.odendi_mi.is_(False),
            TaksitDetay.vade_tarihi < date.today(),
        )
    )
    return list(db.execute(sorgu).scalars())


# ===================================================================== KİRALAMA
@router.post("/kiralama-sozlesmeleri", response_model=KiralamaYanit,
             dependencies=[Depends(izin_gerektir("KIRALAMA_DUZENLE"))])
def kiralama_olustur(
    istek: KiralamaOlusturIstegi, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    yeni = KiralamaSozlesme(sirket_id=sirket_id, **istek.model_dump())
    db.add(yeni)
    db.commit()
    db.refresh(yeni)
    return yeni


@router.get("/kiralama-sozlesmeleri", response_model=list[KiralamaYanit],
            dependencies=[Depends(izin_gerektir("KIRALAMA_GORUNTULE"))])
def kiralamalari_listele(
    durum: str | None = None, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    sorgu = select(KiralamaSozlesme).where(KiralamaSozlesme.sirket_id == sirket_id)
    if durum:
        sorgu = sorgu.where(KiralamaSozlesme.durum == durum)
    return list(db.execute(sorgu).scalars())


@router.post("/kiralama-sozlesmeleri/{sozlesme_id}/odemeler", response_model=KiralamaOdemeYanit,
             dependencies=[Depends(izin_gerektir("KIRALAMA_DUZENLE"))])
def kiralama_odemesi_ekle(
    sozlesme_id: int, istek: KiralamaOdemeOlusturIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    sozlesme = db.get(KiralamaSozlesme, sozlesme_id)
    if sozlesme is None or sozlesme.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Kiralama sözleşmesi bulunamadı.")
    yeni = KiralamaOdeme(sozlesme_id=sozlesme_id, **istek.model_dump())
    db.add(yeni)
    db.commit()
    db.refresh(yeni)
    return yeni


@router.get("/kiralama-sozlesmeleri/{sozlesme_id}/odemeler", response_model=list[KiralamaOdemeYanit],
            dependencies=[Depends(izin_gerektir("KIRALAMA_GORUNTULE"))])
def kiralama_odemelerini_listele(
    sozlesme_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    sozlesme = db.get(KiralamaSozlesme, sozlesme_id)
    if sozlesme is None or sozlesme.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Kiralama sözleşmesi bulunamadı.")
    sorgu = select(KiralamaOdeme).where(KiralamaOdeme.sozlesme_id == sozlesme_id).order_by(KiralamaOdeme.donem_basi)
    return list(db.execute(sorgu).scalars())


@router.put("/kiralama-odemeleri/{odeme_id}/tahsil-et", response_model=KiralamaOdemeYanit,
            dependencies=[Depends(izin_gerektir("KIRALAMA_DUZENLE"))])
def kiralama_odemesi_tahsil_et(
    odeme_id: int, istek: OdemeTahsilIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    odeme = db.get(KiralamaOdeme, odeme_id)
    if odeme is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ödeme kaydı bulunamadı.")
    sozlesme = db.get(KiralamaSozlesme, odeme.sozlesme_id)
    if sozlesme is None or sozlesme.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ödeme kaydı bulunamadı.")

    odeme.odendi_mi = True
    odeme.odeme_tarihi = istek.odeme_tarihi

    para_hareketi_olustur(
        db, sirket_id, kullanici.id, "GIRIS", odeme.tutar,
        istek.odeme_yontemi, istek.banka_hesap_id,
        aciklama=f"Kira dönemi {odeme.donem_basi} - {odeme.donem_sonu}",
        kaynak_tablo="KIRALAMA_ODEME", kaynak_id=odeme.id,
        cari_id=sozlesme.kiraci_cari_id,
        para_birimi=sozlesme.para_birimi.value, kur=istek.kur,
    )

    db.commit()
    db.refresh(odeme)
    return odeme


# ========================================================================= BAKIM
@router.post("/bakim-kayitlari", response_model=BakimYanit, dependencies=[Depends(izin_gerektir("BAKIM_DUZENLE"))])
def bakim_kaydi_olustur(
    istek: BakimOlusturIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    """
    Bakim kaydi olusturulurken es zamanli olarak Kasa/Banka'ya da yansitilir.
    GELIR ise tahsilat (GIRIS), GIDER ise odeme (CIKIS) olarak islenir.
    """
    veri = istek.model_dump(exclude={"odeme_yontemi", "banka_hesap_id", "kur"})
    yeni = BakimKaydi(sirket_id=sirket_id, odendi_tahsil_edildi_mi=True, **veri)
    db.add(yeni)
    db.flush()

    yon = "GIRIS" if istek.tip == BakimTip.GELIR else "CIKIS"
    para_hareketi_olustur(
        db, sirket_id, kullanici.id, yon, istek.tutar,
        istek.odeme_yontemi, istek.banka_hesap_id,
        aciklama=istek.aciklama or f"Bakım {istek.tip.value}",
        kaynak_tablo="BAKIM_KAYDI", kaynak_id=yeni.id, cari_id=istek.ilgili_cari_id,
        para_birimi=istek.para_birimi.value, kur=istek.kur,
    )

    db.commit()
    db.refresh(yeni)
    return yeni


@router.get("/bakim-kayitlari", response_model=list[BakimYanit], dependencies=[Depends(izin_gerektir("BAKIM_GORUNTULE"))])
def bakim_kayitlarini_listele(
    stok_seri_no_id: int | None = None, tip: str | None = None,
    sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    sorgu = select(BakimKaydi).where(BakimKaydi.sirket_id == sirket_id)
    if stok_seri_no_id:
        sorgu = sorgu.where(BakimKaydi.stok_seri_no_id == stok_seri_no_id)
    if tip:
        sorgu = sorgu.where(BakimKaydi.tip == tip)
    return list(db.execute(sorgu).scalars())
