from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.session import get_db
from app.core.deps import aktif_sirket_id_getir, izin_gerektir
from app.models.stok import (Siparis, SiparisDetay, StokSeriNo, StokDurum,
                              SiparisDurum)
from app.schemas.stok import (SiparisOlusturIstegi, SiparisYanit,
                               SiparisDurumGuncelleIstegi, TeslimAlIstegi)

router = APIRouter(prefix="/siparisler", tags=["Sipariş"])


def _siparis_getir_veya_404(db: Session, siparis_id: int, sirket_id: int) -> Siparis:
    kayit = db.get(Siparis, siparis_id)
    if kayit is None or kayit.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sipariş bulunamadı.")
    return kayit


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
    db.flush()  # yeni.id'yi almak icin

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
    Donen deger: olusturulan stok_seri_no id'lerinin listesi.
    """
    siparis = _siparis_getir_veya_404(db, siparis_id, sirket_id)

    detay_id_seti = {u.siparis_detay_id for u in istek.urunler}
    detaylar = {
        d.id: d for d in db.execute(
            select(SiparisDetay).where(SiparisDetay.id.in_(detay_id_seti))
        ).scalars()
    }

    olusturulan_idler = []
    for urun in istek.urunler:
        detay = detaylar.get(urun.siparis_detay_id)
        if detay is None or detay.siparis_id != siparis.id:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"siparis_detay_id={urun.siparis_detay_id} bu siparişe ait değil."
            )

        # birim fiyati TRY'ye gerceklestirmiyoruz burada (kur entegrasyonu
        # ayri bir is); su an satinalma maliyetini siparis para biriminde
        # oldugu gibi kaydediyoruz, gercek ortamda kur tablosundan cevrim yapilir.
        yeni_stok = StokSeriNo(
            sirket_id=sirket_id,
            stok_karti_id=detay.stok_karti_id,
            seri_no=urun.seri_no,
            sasi_no=urun.sasi_no,
            uretim_yili=urun.uretim_yili,
            kaynak=siparis.kaynak,
            siparis_id=siparis.id,
            durum=StokDurum.GUMRUKTE if siparis.kaynak.value == "ITHALAT" else StokDurum.DEPODA,
            tedarikci_cari_id=siparis.tedarikci_cari_id,
            satinalma_maliyeti_try=detay.birim_fiyat,  # basitlestirilmis; kur cevrimi sonraki adim
        )
        db.add(yeni_stok)
        db.flush()
        olusturulan_idler.append(yeni_stok.id)

    siparis.durum = SiparisDurum.TESLIM_ALINDI
    db.commit()
    return olusturulan_idler
