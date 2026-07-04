"""
Odeme/tahsilat islemlerinde ortak kullanilan para hareketi olusturma servisi.
Bir odeme/tahsilat "NAKIT" secilirse Ana Kasa'ya, "BANKA" secilirse ilgili
banka hesabina bir hareket kaydi acar. Boylece cek/leasing/akreditif/taksit/
kiralama gibi modullerdeki her odeme/tahsilat islemi gercek nakit/banka
bakiyesine yansir.

para_birimi/kur parametreleri GERIYE DONUK UYUMLUDUR: cagiran taraf bu
parametreleri vermezse islem TRY kabul edilir (eski davranis degismez).
Bir modulun dovizli nakit odemesini dogru TL karsiligiyla kasaya
yazdirmak icin ilgili router'in para_birimi ve (TRY disi ise) kur
degerini bu fonksiyona iletmesi yeterlidir.
"""
from datetime import date
from decimal import Decimal
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.banka import BankaHesabi, BankaHareketi, BankaHareketTip, KasaHareketi, HareketYon


def para_hareketi_olustur(
    db: Session,
    sirket_id: int,
    kullanici_id: int,
    yon: str,  # "GIRIS" veya "CIKIS"
    tutar: Decimal,
    odeme_yontemi: str,  # "NAKIT" veya "BANKA"
    banka_hesap_id: int | None,
    aciklama: str,
    kaynak_tablo: str,
    kaynak_id: int,
    cari_id: int | None = None,
    para_birimi: str = "TRY",
    kur: Decimal | None = None,
) -> None:
    if odeme_yontemi not in ("NAKIT", "BANKA"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "odeme_yontemi 'NAKIT' veya 'BANKA' olmalıdır.")

    if odeme_yontemi == "BANKA":
        if banka_hesap_id is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Banka ile ödeme seçildiyse banka_hesap_id zorunludur.")
        hesap = db.get(BankaHesabi, banka_hesap_id)
        if hesap is None or hesap.sirket_id != sirket_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Banka hesabı bulunamadı (ID={banka_hesap_id}).")

        imzali_tutar = tutar if yon == "GIRIS" else -tutar
        db.add(BankaHareketi(
            sirket_id=sirket_id,
            banka_hesap_id=banka_hesap_id,
            tarih=date.today(),
            tip=BankaHareketTip.GIRIS if yon == "GIRIS" else BankaHareketTip.CIKIS,
            tutar=imzali_tutar,
            aciklama=aciklama,
            kaynak_tablo=kaynak_tablo,
            kaynak_id=kaynak_id,
            cari_id=cari_id,
            olusturan_kullanici_id=kullanici_id,
        ))
    else:
        if para_birimi == "TRY":
            tutar_try_karsiligi = tutar
        else:
            if kur is None:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    f"Nakit ödeme {para_birimi} cinsinden yapılıyor; TL karşılığı için kur zorunludur."
                )
            tutar_try_karsiligi = tutar * kur

        db.add(KasaHareketi(
            sirket_id=sirket_id,
            tarih=date.today(),
            yon=HareketYon.GIRIS if yon == "GIRIS" else HareketYon.CIKIS,
            para_birimi=para_birimi,
            tutar=tutar,
            tutar_try_karsiligi=tutar_try_karsiligi,
            aciklama=aciklama,
            kaynak_tablo=kaynak_tablo,
            kaynak_id=kaynak_id,
            olusturan_kullanici_id=kullanici_id,
        ))
