import json
from decimal import Decimal
from datetime import date as date_cls
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.db.session import get_db
from app.core.deps import aktif_sirket_id_getir, izin_gerektir, aktif_kullanici_getir
from app.models.auth import Sirket, Kullanici
from app.models.denetim import DuzenlemeKaydi
from app.core.security import sifre_dogrula
from app.models.stok import (Siparis, SiparisDetay, StokSeriNo, StokDurum,
                              SiparisDurum, StokKarti, StokMaliyetKalemi, MaliyetTip, SiparisOdeme,
                              GumrukBeyannamesi)
from app.models.cari import CariHesap
from app.schemas.stok import (SiparisOlusturIstegi, SiparisGuncelleIstegi, SiparisYanit,
                               SiparisDurumGuncelleIstegi, TeslimAlIstegi,
                               SiparisOdemeOlusturIstegi, SiparisOdemeYanit, SiparisBakiyeYanit,
                               GumrukBeyannamesiOlusturIstegi, GumrukBeyannamesiYanit)
from app.services import siparis_pdf
from app.services.para_hareketi import para_hareketi_olustur

router = APIRouter(prefix="/siparisler", tags=["Sipariş"])


def _degisiklikleri_kaydet(db: Session, sirket_id: int, kullanici_id: int, tablo_adi: str, kayit_id: int, degisiklikler: dict) -> None:
    if not degisiklikler:
        return
    db.add(DuzenlemeKaydi(
        sirket_id=sirket_id, kullanici_id=kullanici_id, tablo_adi=tablo_adi,
        kayit_id=kayit_id, degisiklikler=json.dumps(degisiklikler, ensure_ascii=False, default=str),
    ))


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


@router.get("/sonraki-no", dependencies=[Depends(izin_gerektir("SIPARIS_GORUNTULE"))])
def siparis_sonraki_no_getir(
    sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    """Bu yil icin bir sonraki siparis numarasini onerir (SP-YYYY-NNNNN formatinda)."""
    yil = date_cls.today().year
    sayac = db.execute(
        select(func.count()).select_from(Siparis).where(
            Siparis.sirket_id == sirket_id,
            func.extract("year", Siparis.siparis_tarihi) == yil,
        )
    ).scalar_one()
    return {"siparis_no": f"SP-{yil}-{sayac + 1:05d}"}


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
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    """
    Bir siparisin tum bilgilerini ve urun satirlarini gunceller. Sifre
    onayi zorunludur; degisiklikler denetim_kayitlari'na islenir.
    Sadece TASLAK durumundaki siparisler duzenlenebilir; onaylanmis/
    teslim alinmis siparislerde stok kayitlari zaten olusmus olabilir,
    bu yuzden veri tutarliligini korumak icin duzenleme kapatilir.
    """
    if not sifre_dogrula(istek.sifre, kullanici.sifre_hash):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Şifre yanlış, düzenleme yapılamadı.")

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

    alan_adlari = {
        "siparis_no": "Sipariş No", "tedarikci_cari_id": "Tedarikçi", "kaynak": "Kaynak",
        "siparis_tarihi": "Sipariş Tarihi", "tahmini_teslim_tarihi": "Tahmini Teslim Tarihi",
        "para_birimi": "Para Birimi", "cikis_limani": "Çıkış Limanı", "varis_limani": "Varış Limanı",
        "notlar": "Notlar",
    }
    yeni_degerler = {
        "siparis_no": istek.siparis_no, "tedarikci_cari_id": istek.tedarikci_cari_id, "kaynak": istek.kaynak,
        "siparis_tarihi": istek.siparis_tarihi, "tahmini_teslim_tarihi": istek.tahmini_teslim_tarihi,
        "para_birimi": istek.para_birimi, "cikis_limani": istek.cikis_limani,
        "varis_limani": istek.varis_limani, "notlar": istek.notlar,
    }
    degisiklikler = {}
    for alan, etiket in alan_adlari.items():
        eski = getattr(siparis, alan)
        yeni = yeni_degerler[alan]
        eski_metin = eski.value if hasattr(eski, "value") else eski
        yeni_metin = yeni.value if hasattr(yeni, "value") else yeni
        if str(eski_metin) != str(yeni_metin):
            degisiklikler[etiket] = {"eski": eski_metin, "yeni": yeni_metin}

    eski_urunler_ozet = ", ".join(
        f"{u.miktar}x #{u.stok_karti_id}@{u.birim_fiyat}"
        for u in db.execute(select(SiparisDetay).where(SiparisDetay.siparis_id == siparis.id)).scalars()
    )
    yeni_urunler_ozet = ", ".join(f"{u.miktar}x #{u.stok_karti_id}@{u.birim_fiyat}" for u in istek.urunler)
    if eski_urunler_ozet != yeni_urunler_ozet:
        degisiklikler["Ürünler"] = {"eski": eski_urunler_ozet, "yeni": yeni_urunler_ozet}

    _degisiklikleri_kaydet(db, sirket_id, kullanici.id, "siparisler", siparis.id, degisiklikler)

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
            kdv_orani=u.kdv_orani,
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
    from app.models.finansal import Cek, CekTip

    siparis = _siparis_getir_veya_404(db, siparis_id, sirket_id)

    if istek.odeme_yontemi not in ("NAKIT", "BANKA", "CEK", "LEASING"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "odeme_yontemi 'NAKIT', 'BANKA', 'CEK' veya 'LEASING' olmalıdır.")

    yeni = SiparisOdeme(
        siparis_id=siparis_id, tarih=istek.tarih, tutar=istek.tutar,
        odeme_yontemi=istek.odeme_yontemi, notlar=istek.notlar,
    )
    db.add(yeni)
    db.flush()

    if istek.odeme_yontemi == "CEK":
        if not istek.cek_vade_tarihi:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Çek ile ödeme için vade tarihi girilmelidir.")
        yeni_cek = Cek(
            sirket_id=sirket_id, tip=CekTip.VERILEN, cek_no=istek.cek_no,
            banka_adi=istek.cek_banka_adi, cari_id=siparis.tedarikci_cari_id,
            tutar=istek.tutar, para_birimi=siparis.para_birimi,
            vade_tarihi=istek.cek_vade_tarihi, alinma_verilme_tarihi=istek.tarih,
        )
        db.add(yeni_cek)
        db.flush()
        yeni.cek_id = yeni_cek.id
    elif istek.odeme_yontemi == "LEASING":
        # Sadece bilgi amacli kayit - gercek odemeyi leasing firmasi tedarikciye
        # dogrudan yaptigi icin burada Kasa/Banka/Cek hareketi OLUSTURULMAZ.
        pass
    else:
        para_hareketi_olustur(
            db, sirket_id, kullanici.id, "CIKIS", istek.tutar,
            istek.odeme_yontemi, istek.banka_hesap_id,
            aciklama=f"Sipariş ödemesi - {siparis.siparis_no}" + (f" ({istek.notlar})" if istek.notlar else ""),
            kaynak_tablo="SIPARIS_ODEME", kaynak_id=yeni.id, cari_id=siparis.tedarikci_cari_id,
            para_birimi=siparis.para_birimi.value, kur=istek.kur,
        )

    # Fazla odeme uyarisi - engellemiyoruz, sadece bilgilendiriyoruz (bazen
    # mesru olabilir, orn. fazla odemeyi bir sonraki siparise mahsup etmek).
    urunler = list(db.execute(select(SiparisDetay).where(SiparisDetay.siparis_id == siparis_id)).scalars())
    toplam_siparis_tutari = sum((u.miktar * u.birim_fiyat for u in urunler), Decimal("0"))
    toplam_odenen_simdi = db.execute(
        select(func.coalesce(func.sum(SiparisOdeme.tutar), 0)).where(SiparisOdeme.siparis_id == siparis_id)
    ).scalar_one()
    asim_uyarisi = None
    if toplam_siparis_tutari > 0 and toplam_odenen_simdi > toplam_siparis_tutari:
        asim = toplam_odenen_simdi - toplam_siparis_tutari
        asim_uyarisi = (
            f"Dikkat: toplam ödenen tutar, sipariş tutarını {asim:,.2f} {siparis.para_birimi.value} aşıyor. "
            f"Bu siparişe daha önce ödeme girilmiş olabilir, kontrol edin."
        )

    db.commit()
    db.refresh(yeni)
    yeni.asim_uyarisi = asim_uyarisi
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
    """
    ONEMLI: Bu siparisin odemesi Akreditif uzerinden yapilmis olabilir
    (SiparisOdeme uzerinden DEGIL) - akreditifli alimlarda tedarikciye
    odeme, akreditifin KENDI kalem/taksit odemeleri araciligiyla yapilir.
    Bu yuzden "toplam_odenen", SiparisOdeme TOPLAMI + bu siparise bagli
    TUM akreditiflerin toplam_odenen'i OLARAK hesaplanir - aksi halde
    akreditifli siparisler, gercekte odenmis olsa bile "Hic Odenmedi"
    gorunurdu.
    """
    from app.models.akreditif import Akreditif, AkreditifKalemi, AkreditifDurum
    from app.models.akreditif_taksit import AkreditifKalemTaksiti

    siparis = _siparis_getir_veya_404(db, siparis_id, sirket_id)
    urunler = list(db.execute(select(SiparisDetay).where(SiparisDetay.siparis_id == siparis_id)).scalars())
    toplam_siparis_tutari = sum((u.miktar * u.birim_fiyat for u in urunler), Decimal("0"))

    toplam_odenen = db.execute(
        select(func.coalesce(func.sum(SiparisOdeme.tutar), 0)).where(SiparisOdeme.siparis_id == siparis_id)
    ).scalar_one()

    akreditifler = list(db.execute(
        select(Akreditif).where(Akreditif.siparis_id == siparis_id, Akreditif.durum != AkreditifDurum.IPTAL)
    ).scalars())
    for ak in akreditifler:
        kalemler = list(db.execute(select(AkreditifKalemi).where(AkreditifKalemi.akreditif_id == ak.id)).scalars())
        for k in kalemler:
            taksitler = list(db.execute(select(AkreditifKalemTaksiti).where(AkreditifKalemTaksiti.kalem_id == k.id)).scalars())
            if taksitler:
                toplam_odenen += sum((t.tutar for t in taksitler if t.odendi_mi), Decimal("0"))
            else:
                toplam_odenen += k.odenen_tutar or Decimal("0")

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


# ============================================================== GÜMRÜK BEYANNAMELERİ
@router.post("/{siparis_id}/gumruk-beyannameleri", response_model=GumrukBeyannamesiYanit,
             dependencies=[Depends(izin_gerektir("SIPARIS_DUZENLE"))])
def gumruk_beyannamesi_ekle(
    siparis_id: int, istek: GumrukBeyannamesiOlusturIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    """Bir ithalat siparisine gumruk beyannamesi kaydi ekler (beyanname no, gumruk musaviri, tutar)."""
    _siparis_getir_veya_404(db, siparis_id, sirket_id)

    tutar_try = istek.tutar * istek.kur
    yeni = GumrukBeyannamesi(
        sirket_id=sirket_id, siparis_id=siparis_id,
        beyanname_no=istek.beyanname_no, beyanname_tarihi=istek.beyanname_tarihi,
        gumruk_musaviri_cari_id=istek.gumruk_musaviri_cari_id,
        tutar=istek.tutar, para_birimi=istek.para_birimi, kur=istek.kur,
        tutar_try=tutar_try, kdv_tutari=istek.kdv_tutari, notlar=istek.notlar,
    )
    db.add(yeni)
    db.commit()
    db.refresh(yeni)

    if yeni.gumruk_musaviri_cari_id:
        cari = db.get(CariHesap, yeni.gumruk_musaviri_cari_id)
        yeni.gumruk_musaviri_unvan = cari.unvan if cari else None
    return yeni


@router.get("/{siparis_id}/gumruk-beyannameleri", response_model=list[GumrukBeyannamesiYanit],
            dependencies=[Depends(izin_gerektir("SIPARIS_GORUNTULE"))])
def gumruk_beyannamelerini_listele(
    siparis_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    _siparis_getir_veya_404(db, siparis_id, sirket_id)
    sorgu = select(GumrukBeyannamesi).where(GumrukBeyannamesi.siparis_id == siparis_id).order_by(GumrukBeyannamesi.beyanname_tarihi.desc())
    sonuclar = list(db.execute(sorgu).scalars())

    cari_ids = [s.gumruk_musaviri_cari_id for s in sonuclar if s.gumruk_musaviri_cari_id]
    cari_haritasi = {}
    if cari_ids:
        cari_haritasi = {
            c.id: c.unvan for c in db.execute(select(CariHesap).where(CariHesap.id.in_(cari_ids))).scalars()
        }
    for s in sonuclar:
        s.gumruk_musaviri_unvan = cari_haritasi.get(s.gumruk_musaviri_cari_id)
    return sonuclar


@router.delete("/gumruk-beyannameleri/{beyanname_id}",
                dependencies=[Depends(izin_gerektir("SIPARIS_DUZENLE"))])
def gumruk_beyannamesi_sil(
    beyanname_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    kayit = db.get(GumrukBeyannamesi, beyanname_id)
    if kayit is None or kayit.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Gümrük beyannamesi bulunamadı.")
    db.delete(kayit)
    db.commit()
    return {"silindi": True}
