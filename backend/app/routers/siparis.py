from decimal import Decimal
from datetime import date as date_cls
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.db.session import get_db
from app.core.deps import aktif_sirket_id_getir, izin_gerektir, aktif_kullanici_getir
from app.models.auth import Sirket, Kullanici
from app.models.stok import (Siparis, SiparisDetay, StokSeriNo, StokDurum,
                              SiparisDurum, StokKarti, StokMaliyetKalemi, MaliyetTip, SiparisOdeme)
from app.models.cari import CariHesap
from app.schemas.stok import (SiparisOlusturIstegi, SiparisGuncelleIstegi, SiparisYanit,
                               SiparisDurumGuncelleIstegi, TeslimAlIstegi,
                               SiparisOdemeOlusturIstegi, SiparisOdemeYanit, SiparisBakiyeYanit)
from app.services import siparis_pdf
from app.services.para_hareketi import para_hareketi_olustur

router = APIRouter(prefix="/siparisler", tags=["Sipariş"])


def _siparis_getir_veya_404(db: Session, siparis_id: int, sirket_id: int) -> Siparis:
    kayit = db.get(Siparis, siparis_id)
    if kayit is None or kayit.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sipariş bulunamadı.")
    return kayit


def _tedarikci_dogrula(db: Session, tedarikci_cari_id: int, sirket_id: int) -> None:
    cari = db.get(CariHesap, tedarikci_cari_id)
    if cari is None or cari.sirket_id != sirket_id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Tedarikçi cari kaydı bulunamadı (ID={tedarikci_cari_id})."
        )


def _urunleri_dogrula(db: Session, urunler: list, sirket_id: int) -> None:
    for urun in urunler:
        kart = db.get(StokKarti, urun.stok_karti_id)
        if kart is None or kart.sirket_id != sirket_id:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Stok kartı bulunamadı (ID={urun.stok_karti_id})."
            )


@router.post("", response_model=SiparisYanit,
             dependencies=[Depends(izin_gerektir("SIPARIS_DUZENLE"))])
def siparis_olustur(
    istek: SiparisOlusturIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    mevcut = db.execute(
        select(Siparis).where(Siparis.siparis_no == istek.siparis_no)
    ).scalar_one_or_none()
    if mevcut is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bu sipariş numarası zaten kullanılıyor.")

    _tedarikci_dogrula(db, istek.tedarikci_cari_id, sirket_id)
    _urunleri_dogrula(db, istek.urunler, sirket_id)

    yeni = Siparis(
        sirket_id=sirket_id,
        siparis_no=istek.siparis_no,
        tedarikci_cari_id=istek.tedarikci_cari_id,
        kaynak=istek.kaynak,
        siparis_tarihi=istek.siparis_tarihi,
        tahmini_teslim_tarihi=istek.tahmini_teslim_tarihi,
        para_birimi=istek.para_birimi,
        cikis_limani=istek.cikis_limani,
        varis_limani=istek.varis_limani,
        notlar=istek.notlar,
    )
    db.add(yeni)
    db.flush()

    for urun in istek.urunler:
        db.add(SiparisDetay(siparis_id=yeni.id, **urun.model_dump()))

    db.commit()
    db.refresh(yeni)
    return _siparis_detayli_getir(db, yeni.id)


def _siparis_detayli_getir(db: Session, siparis_id: int) -> Siparis:
    siparis = db.get(Siparis, siparis_id)
    siparis.urunler = list(db.execute(
        select(SiparisDetay).where(SiparisDetay.siparis_id == siparis.id)
    ).scalars())
    return siparis


@router.get("", response_model=list[SiparisYanit],
            dependencies=[Depends(izin_gerektir("SIPARIS_GORUNTULE"))])
def siparisleri_listele(
    durum: SiparisDurum | None = None,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    sorgu = select(Siparis).where(Siparis.sirket_id == sirket_id)
    if durum:
        sorgu = sorgu.where(Siparis.durum == durum)
    siparisler = list(db.execute(sorgu).scalars())
    for s in siparisler:
        s.urunler = list(db.execute(
            select(SiparisDetay).where(SiparisDetay.siparis_id == s.id)
        ).scalars())
    return siparisler


@router.get("/{siparis_id}", response_model=SiparisYanit,
            dependencies=[Depends(izin_gerektir("SIPARIS_GORUNTULE"))])
def siparis_getir(
    siparis_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    siparis = _siparis_getir_veya_404(db, siparis_id, sirket_id)
    siparis.urunler = list(db.execute(
        select(SiparisDetay).where(SiparisDetay.siparis_id == siparis.id)
    ).scalars())
    return siparis


@router.put("/{siparis_id}", response_model=SiparisYanit,
            dependencies=[Depends(izin_gerektir("SIPARIS_DUZENLE"))])
def siparis_guncelle(
    siparis_id: int,
    istek: SiparisGuncelleIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Bir siparisin tum bilgilerini ve urun satirlarini gunceller.
    Sadece TASLAK durumundaki siparisler duzenlenebilir; onaylanmis/
    teslim alinmis siparislerde stok kayitlari zaten olusmus olabilir,
    bu yuzden veri tutarliligini korumak icin duzenleme kapatilir.
    """
    siparis = _siparis_getir_veya_404(db, siparis_id, sirket_id)

    if siparis.durum != SiparisDurum.TASLAK:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Sadece taslak durumundaki siparişler düzenlenebilir."
        )

    if istek.siparis_no != siparis.siparis_no:
        cakisan = db.execute(
            select(Siparis).where(Siparis.siparis_no == istek.siparis_no, Siparis.id != siparis_id)
        ).scalar_one_or_none()
        if cakisan is not None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bu sipariş numarası zaten kullanılıyor.")

    _tedarikci_dogrula(db, istek.tedarikci_cari_id, sirket_id)
    _urunleri_dogrula(db, istek.urunler, sirket_id)

    siparis.siparis_no = istek.siparis_no
    siparis.tedarikci_cari_id = istek.tedarikci_cari_id
    siparis.kaynak = istek.kaynak
    siparis.siparis_tarihi = istek.siparis_tarihi
    siparis.tahmini_teslim_tarihi = istek.tahmini_teslim_tarihi
    siparis.para_birimi = istek.para_birimi
    siparis.cikis_limani = istek.cikis_limani
    siparis.varis_limani = istek.varis_limani
    siparis.notlar = istek.notlar

    eski_detaylar = db.execute(
        select(SiparisDetay).where(SiparisDetay.siparis_id == siparis.id)
    ).scalars()
    for eski in eski_detaylar:
        db.delete(eski)
    db.flush()

    for urun in istek.urunler:
        db.add(SiparisDetay(siparis_id=siparis.id, **urun.model_dump()))

    db.commit()
    db.refresh(siparis)
    return _siparis_detayli_getir(db, siparis.id)


@router.delete("/{siparis_id}",
               dependencies=[Depends(izin_gerektir("SIPARIS_DUZENLE"))])
def siparis_sil(
    siparis_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    TASLAK veya IPTAL durumundaki siparisler silinebilir. Onaylanmis/yolda/
    teslim alinmis siparislerde stok/mali kayitlar olusmus olabileceginden
    (ya da olusabileceginden) bunlar dogrudan silinemez - once IPTAL
    durumuna cekilmesi (durum guncelle endpoint'i), sonra silinmesi gerekir.
    """
    siparis = _siparis_getir_veya_404(db, siparis_id, sirket_id)

    if siparis.durum not in (SiparisDurum.TASLAK, SiparisDurum.IPTAL):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Sadece taslak veya iptal edilmiş siparişler silinebilir. "
            "Önce durumu 'İptal' olarak güncelleyin, sonra silin."
        )

    eski_detaylar = db.execute(
        select(SiparisDetay).where(SiparisDetay.siparis_id == siparis.id)
    ).scalars()
    for eski in eski_detaylar:
        db.delete(eski)

    db.delete(siparis)
    db.commit()
    return {"silindi": True}


@router.put("/{siparis_id}/durum", response_model=SiparisYanit,
            dependencies=[Depends(izin_gerektir("SIPARIS_DUZENLE"))])
def siparis_durum_guncelle(
    siparis_id: int,
    istek: SiparisDurumGuncelleIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    siparis = _siparis_getir_veya_404(db, siparis_id, sirket_id)
    siparis.durum = istek.durum
    db.commit()
    db.refresh(siparis)
    siparis.urunler = list(db.execute(
        select(SiparisDetay).where(SiparisDetay.siparis_id == siparis.id)
    ).scalars())
    return siparis


@router.post("/{siparis_id}/kopyala", response_model=SiparisYanit,
             dependencies=[Depends(izin_gerektir("SIPARIS_DUZENLE"))])
def siparis_kopyala(
    siparis_id: int,
    yeni_siparis_no: str,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """Eski siparisi referans alarak yeni bir TASLAK siparis olusturur."""
    kaynak = _siparis_getir_veya_404(db, siparis_id, sirket_id)
    kaynak_urunler = list(db.execute(
        select(SiparisDetay).where(SiparisDetay.siparis_id == kaynak.id)
    ).scalars())

    yeni = Siparis(
        sirket_id=sirket_id,
        siparis_no=yeni_siparis_no,
        tedarikci_cari_id=kaynak.tedarikci_cari_id,
        kaynak=kaynak.kaynak,
        kopya_kaynak_siparis_id=kaynak.id,
        siparis_tarihi=kaynak.siparis_tarihi,
        para_birimi=kaynak.para_birimi,
        cikis_limani=kaynak.cikis_limani,
        varis_limani=kaynak.varis_limani,
        durum=SiparisDurum.TASLAK,
    )
    db.add(yeni)
    db.flush()

    for u in kaynak_urunler:
        db.add(SiparisDetay(
            siparis_id=yeni.id,
            stok_karti_id=u.stok_karti_id,
            miktar=u.miktar,
            birim_fiyat=u.birim_fiyat,
            para_birimi=u.para_birimi,
            birim_agirlik_kg=u.birim_agirlik_kg,
            aciklama=u.aciklama,
        ))

    db.commit()
    return siparis_getir(yeni.id, sirket_id, db)


@router.post("/{siparis_id}/teslim-al", response_model=list[int],
             dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def siparis_teslim_al(
    siparis_id: int,
    istek: TeslimAlIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Siparis satirlarini gercek seri numarali stok kayitlarina donusturur.
    Her siparis_detay satiri icin miktar kadar degil, kullanicinin
    bildirdigi her gercek seri no icin BIR stok_seri_no kaydi acilir
    (forklift gibi tekil urunlerde miktar=2 ise 2 ayri seri no girilir).

    hedef_durum belirtilmisse (Depoda/Antrepoda/Gumrukte/Yolda) tum
    urunler DOGRUDAN o durumda acilir - kullanici mallarin fiilen nerede
    oldugunu kendisi secer. Belirtilmezse eski otomatik kural uygulanir
    (ithalat -> Gumrukte, yurtici -> Depoda).

    Donen deger: olusturulan stok_seri_no id'lerinin listesi.
    """
    siparis = _siparis_getir_veya_404(db, siparis_id, sirket_id)

    detay_id_seti = {u.siparis_detay_id for u in istek.urunler}
    detaylar = {
        d.id: d for d in db.execute(
            select(SiparisDetay).where(SiparisDetay.id.in_(detay_id_seti))
        ).scalars()
    }

    varsayilan_durum = StokDurum.GUMRUKTE if siparis.kaynak.value == "ITHALAT" else StokDurum.DEPODA
    kullanilacak_durum = istek.hedef_durum if istek.hedef_durum is not None else varsayilan_durum

    olusturulan_idler = []
    for urun in istek.urunler:
        detay = detaylar.get(urun.siparis_detay_id)
        if detay is None or detay.siparis_id != siparis.id:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"siparis_detay_id={urun.siparis_detay_id} bu siparişe ait değil."
            )

        # onemli: detay.birim_fiyat siparisin PARA BIRIMINDE (orn. USD) girilmis
        # olabilir - stok_seri_no.satinalma_maliyeti_try HER ZAMAN TL bekler.
        # Bu yuzden kur ile carpilarak TL karsiligina cevriliyor (TRY siparislerde
        # kur=1 varsayilan oldugu icin deger degismez).
        satinalma_maliyeti_try = detay.birim_fiyat * istek.kur

        yeni_stok = StokSeriNo(
            sirket_id=sirket_id,
            stok_karti_id=detay.stok_karti_id,
            seri_no=urun.seri_no,
            sasi_no=urun.sasi_no,
            uretim_yili=urun.uretim_yili,
            garanti_bitis_tarihi=urun.garanti_bitis_tarihi,
            barkod=urun.barkod,
            kaynak=siparis.kaynak,
            siparis_id=siparis.id,
            durum=kullanilacak_durum,
            tedarikci_cari_id=siparis.tedarikci_cari_id,
            satinalma_maliyeti_try=satinalma_maliyeti_try,
        )
        db.add(yeni_stok)
        db.flush()
        olusturulan_idler.append(yeni_stok.id)

        # Satinalma maliyetini de (nakliye/gumruk gibi) bir maliyet kalemi
        # olarak kaydediyoruz - boylece Stok sayfasindaki maliyet detayi
        # tablosunda satinalma da hem doviz hem TL karsiligiyla gorunur.
        db.add(StokMaliyetKalemi(
            stok_seri_no_id=yeni_stok.id,
            tip=MaliyetTip.SATINALMA,
            aciklama="Satınalma (Teslim Al)",
            tedarikci_cari_id=siparis.tedarikci_cari_id,
            para_birimi=siparis.para_birimi,
            tutar=detay.birim_fiyat,
            kur=istek.kur,
            tutar_try=satinalma_maliyeti_try,
            tarih=date_cls.today(),
        ))

    siparis.durum = SiparisDurum.TESLIM_ALINDI
    db.commit()
    return olusturulan_idler


@router.get("/{siparis_id}/pdf",
            dependencies=[Depends(izin_gerektir("SIPARIS_GORUNTULE"))])
def siparis_pdf_indir(
    siparis_id: int,
    nusha: str = Query("ic", pattern="^(ic|tedarikci)$"),
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Siparis formunu PDF olarak uretir. nusha=ic -> maliyet detayi dahil
    (sirket ici), nusha=tedarikci -> maliyet bolumu olmadan tedarikciye
    gonderilecek nusha.
    """
    siparis = _siparis_getir_veya_404(db, siparis_id, sirket_id)
    sirket = db.get(Sirket, sirket_id)
    tedarikci = db.get(CariHesap, siparis.tedarikci_cari_id)
    urun_satirlari = list(db.execute(
        select(SiparisDetay).where(SiparisDetay.siparis_id == siparis.id)
    ).scalars())

    urunler_pdf = []
    for u in urun_satirlari:
        kart = db.get(StokKarti, u.stok_karti_id)
        marka_model = f"{kart.marka} {kart.model}".strip() if kart else None
        urunler_pdf.append({
            "marka_model": marka_model,
            "seri_no": None,
            "miktar": u.miktar,
            "birim_fiyat": float(u.birim_fiyat),
        })

    veri = {
        "sirket_unvan": sirket.unvan, "sirket_adres": sirket.adres,
        "sirket_tel": sirket.telefon, "sirket_email": sirket.email,
        "sirket_vergi_no": sirket.vergi_no,
        "siparis_no": siparis.siparis_no, "siparis_tarihi": str(siparis.siparis_tarihi),
        "kaynak": "İTHALAT" if siparis.kaynak.value == "ITHALAT" else "YURTİÇİ ALIM",
        "durum": siparis.durum.value,
        "tedarikci_unvan": tedarikci.unvan if tedarikci else None,
        "tedarikci_vergi_no": tedarikci.vergi_no if tedarikci else None,
        "tedarikci_adres": tedarikci.adres if tedarikci else None,
        "tedarikci_tel": tedarikci.telefon if tedarikci else None,
        "cikis_limani": siparis.cikis_limani, "varis_limani": siparis.varis_limani,
        "para_birimi": siparis.para_birimi.value,
        "urunler": urunler_pdf,
        "notlar": siparis.notlar,
    }

    pdf_bytes = siparis_pdf.build_pdf(veri, ic_kullanim=(nusha == "ic"))
    dosya_adi = f"{siparis.siparis_no}_{nusha}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{dosya_adi}"'},
    )



# ============================================================== SİPARİŞ ÖDEMELERİ
# Bu bolum, siparisin (tedarikciye) avans/ara/kapama odemelerini takip eder.
# Stok maliyeti hesabindan BAGIMSIZDIR (teslim-al akisinda ayrica hesaplanir).

@router.post("/{siparis_id}/odemeler", response_model=SiparisOdemeYanit,
             dependencies=[Depends(izin_gerektir("SIPARIS_DUZENLE"))])
def siparis_odemesi_ekle(
    siparis_id: int,
    istek: SiparisOdemeOlusturIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    """
    Siparise (tedarikciye) avans/ara/kapama odemesi ekler. Bu odeme, stok
    maliyeti hesabina (satinalma_maliyeti_try) DOKUNMAZ - sadece nakit
    cikisini ve tedarikciye olan kalan bakiyeyi takip eder.
    """
    siparis = _siparis_getir_veya_404(db, siparis_id, sirket_id)

    yeni = SiparisOdeme(
        siparis_id=siparis_id, tarih=istek.tarih, tutar=istek.tutar, notlar=istek.notlar,
    )
    db.add(yeni)
    db.flush()

    para_hareketi_olustur(
        db, sirket_id, kullanici.id, "CIKIS", istek.tutar,
        istek.odeme_yontemi, istek.banka_hesap_id,
        aciklama=f"Sipariş ödemesi - {siparis.siparis_no}" + (f" ({istek.notlar})" if istek.notlar else ""),
        kaynak_tablo="SIPARIS_ODEME", kaynak_id=yeni.id, cari_id=siparis.tedarikci_cari_id,
        para_birimi=siparis.para_birimi.value, kur=istek.kur,
    )

    db.commit()
    db.refresh(yeni)
    return yeni


@router.get("/{siparis_id}/odemeler", response_model=list[SiparisOdemeYanit],
            dependencies=[Depends(izin_gerektir("SIPARIS_GORUNTULE"))])
def siparis_odemelerini_listele(
    siparis_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    _siparis_getir_veya_404(db, siparis_id, sirket_id)
    sorgu = select(SiparisOdeme).where(SiparisOdeme.siparis_id == siparis_id).order_by(SiparisOdeme.tarih.desc())
    return list(db.execute(sorgu).scalars())


@router.get("/{siparis_id}/bakiye", response_model=SiparisBakiyeYanit,
            dependencies=[Depends(izin_gerektir("SIPARIS_GORUNTULE"))])
def siparis_bakiyesi(
    siparis_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    siparis = _siparis_getir_veya_404(db, siparis_id, sirket_id)
    urunler = list(db.execute(select(SiparisDetay).where(SiparisDetay.siparis_id == siparis_id)).scalars())
    toplam_siparis_tutari = sum((u.miktar * u.birim_fiyat for u in urunler), Decimal("0"))
    toplam_odenen = db.execute(
        select(func.coalesce(func.sum(SiparisOdeme.tutar), 0)).where(SiparisOdeme.siparis_id == siparis_id)
    ).scalar_one()
    return SiparisBakiyeYanit(
        siparis_id=siparis_id, para_birimi=siparis.para_birimi,
        toplam_siparis_tutari=toplam_siparis_tutari, toplam_odenen=toplam_odenen,
        kalan_bakiye=toplam_siparis_tutari - toplam_odenen,
    )


@router.delete("/odemeler/{odeme_id}", dependencies=[Depends(izin_gerektir("SIPARIS_DUZENLE"))])
def siparis_odemesini_sil(
    odeme_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """Bir siparis odeme kaydini (yanlislikla girildiyse) siler ve olusturdugu Kasa/Banka hareketini de geri alir."""
    odeme = db.get(SiparisOdeme, odeme_id)
    if odeme is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ödeme kaydı bulunamadı.")
    siparis = db.get(Siparis, odeme.siparis_id)
    if siparis is None or siparis.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ödeme kaydı bulunamadı.")

    from app.models.banka import KasaHareketi, BankaHareketi
    for h in list(db.execute(
        select(KasaHareketi).where(KasaHareketi.kaynak_tablo == "SIPARIS_ODEME", KasaHareketi.kaynak_id == odeme_id)
    ).scalars()):
        db.delete(h)
    for h in list(db.execute(
        select(BankaHareketi).where(BankaHareketi.kaynak_tablo == "SIPARIS_ODEME", BankaHareketi.kaynak_id == odeme_id)
    ).scalars()):
        db.delete(h)

    db.delete(odeme)
    db.commit()
    return {"silindi": True}
