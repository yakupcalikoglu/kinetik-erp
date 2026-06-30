"""
Mukellef sorgu servisi.

Gercek ortamda burada Uyumsoft'un mukellef sorgu API'sine HTTP istegi atilir
(API anahtari .env dosyasindan okunur). Su an icin, gercek bir Uyumsoft
sozlesmesi/API anahtari olmadigi icin sabit ornek verilerle calisan bir
mock servis yaziyoruz. Gercek entegrasyon zamani geldiginde sadece
`sorgula()` fonksiyonunun govdesi degisecek, cagiran kod (router) hic
degismeyecek.
"""

_ORNEK_MUKELLEF_VERITABANI = {
    "1234567890": {
        "unvan": "Aktaş Forklift ve İş Makinaları Tic. Ltd. Şti.",
        "vergi_dairesi": "Osmangazi V.D.",
        "adres": "Organize Sanayi Bölgesi 3. Cadde No:8, Bursa",
        "telefon": "+90 224 444 22 11",
    },
}


def sorgula(vergi_no: str) -> dict:
    """
    Vergi no ile mukellef bilgisi dondurur.
    Gercek entegrasyonda: Uyumsoft API'sine cagri yapilir, timeout/hata
    durumlari yakalanir, sonuc bu ayni sozluk formatina cevrilir.
    """
    kayit = _ORNEK_MUKELLEF_VERITABANI.get(vergi_no.strip())
    if kayit is None:
        return {
            "bulundu": False,
            "mesaj": "Bu vergi numarasına ait kayıt bulunamadı. "
                     "Yurt dışı tedarikçiler için bu normaldir; bilgileri elle girin."
        }
    return {"bulundu": True, **kayit}
