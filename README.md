# Kinetik ERP

İthalat yapan firmalar için ön muhasebe ve stok yönetim sistemi. Cari, stok
(seri numarası bazlı maliyet takibi), sipariş, banka/ana kasa, çek, leasing,
taksitli satış, kiralama, bakım, personel, sabit giderler, ortak/dış borç,
proforma/fatura ve raporlama modüllerini kapsar.

## Proje Yapısı

```
kinetik-erp/
  backend/          FastAPI tabanlı REST API (bu repodaki tek aktif bilesen)
    app/
      core/         Kimlik dogrulama, JWT, yetki kontrolu
      db/           Veritabani baglantisi
      models/       SQLAlchemy modelleri
      schemas/      Pydantic request/response semalari
      routers/      API endpoint'leri (modul bazli)
      services/     Dis servis entegrasyonlari (mukellef sorgu vb.)
    veritabani_semasi.sql   PostgreSQL semasi
    ornek_veri.sql          Test/demo verisi + izin tanimlari
  backups/          (gitignore'da - sifrelenmis yedekler buraya yerel olarak
                      duser, repoya commit edilmez)
```

## Güvenlik Notları

- `.env` dosyası ASLA commit edilmez (`.gitignore`'da). `JWT_SECRET_KEY` ve
  `DATABASE_URL` gibi sırlar yalnızca ortam değişkeni olarak verilir.
- Veritabanı yedekleri bu repoya **düz metin olarak hiçbir zaman** push
  edilmez — finansal veri (banka hareketleri, çek bilgileri, maaşlar) içerir.
  Bunun yerine `scripts/yedek_al.sh` ile şifrelenmiş (GPG) bir dump üretilir
  ve ayrı bir private GitHub Release'ine veya bulut depoya yüklenir.
- Geçmiş commit'lerde hassas veri kalmaması için, yanlışlıkla bir sır commit
  edilirse sadece o dosyayı silmek yetmez — `git filter-repo` ile geçmişten
  de temizlenmesi gerekir.

## Kurulum

`backend/README.md` dosyasına bakın.

## Otomatik Yedekleme

`scripts/yedek_al.sh` günlük cron ile çalıştırılacak şekilde tasarlandı.
Detaylar `scripts/README.md`'de.
