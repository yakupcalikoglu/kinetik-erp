# İthalat ERP Backend - Auth/Yetki Modülü

## Kurulum
```bash
pip install -r requirements.txt
cp .env.example .env   # DATABASE_URL ve JWT_SECRET_KEY degerlerini doldurun
```

Veritabanini olusturup `veritabani_semasi.sql` dosyasini yukleyin (proje kok
klasorunde, onceki adimda paylasilan SQL dosyasi).

## Calistirma
```bash
export DATABASE_URL=postgresql+psycopg2://kullanici:sifre@localhost:5432/ithalat_db
uvicorn app.main:app --reload
```

Tarayicidan http://localhost:8000/docs adresine giderek otomatik uretilen
Swagger arayuzunden tum endpoint'leri deneyebilirsiniz.

## Test edilen akislar
- POST /auth/login          -> JWT token uretimi
- GET  /auth/me             -> token dogrulama
- GET  /sirketler           -> kullanicinin erisebildigi sirketler
- POST /sirketler           -> izin kontrolu (SIRKET_YONET gerektirir)
- X-Sirket-Id header        -> yetkisiz sirkete erisim denemesi 403 doner
- Rolu/izni olmayan kullanici -> ilgili islemde 403 + acik hata mesaji doner

## Sonraki modul
Bu altyapi (auth + yetki + coklu sirket dogrulama) tum diger modullerin
(cari, stok, siparis, banka, vb.) ustune insa edilecek; her yeni router
ayni `aktif_sirket_id_getir` ve `izin_gerektir(...)` dependency'lerini
kullanacak, boylece guvenlik mantigi tek yerde kalir.
