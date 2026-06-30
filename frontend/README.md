# Kinetik ERP - Web Arayüzü

React (Vite) tabanlı frontend. `kinetik-erp` backend API'sine bağlanır.

## Kurulum

```bash
npm install
cp .env.example .env
```

`.env` içindeki `VITE_API_URL` değerini backend'inizin adresine göre düzenleyin
(varsayılan: `http://localhost:8000`).

## Geliştirme ortamında çalıştırma

```bash
npm run dev
```

Tarayıcıda `http://localhost:5173` adresine gidin. Backend'in ayrıca
çalışıyor olması gerekir (`uvicorn app.main:app --reload`).

## Üretim derlemesi

```bash
npm run build
```

`dist/` klasörü, herhangi bir statik dosya sunucusunda (nginx, Caddy vb.)
yayınlanabilir.

## Proje yapısı

```
src/
  api/client.js          Axios istemcisi - JWT ve X-Sirket-Id header yönetimi
  context/AuthContext.jsx Oturum durumu (giriş/çıkış/şirket değiştirme)
  components/
    AnaDuzen.jsx          Kenar çubuğu + üst bar düzeni
    Ortak.jsx             Kart, buton, etiket, form alanı gibi ortak parçalar
  pages/
    GirisSayfasi.jsx
    GenelBakisSayfasi.jsx  Dashboard - /raporlar/genel-bakis
    CarilerSayfasi.jsx     Cari listesi + vergi no sorgulama ile yeni cari
    StokSayfasi.jsx        Seri no bazlı stok listesi
    SiparislerSayfasi.jsx
    BankaKasaSayfasi.jsx   Banka bakiyeleri + ana kasa net durumu
    RaporlarSayfasi.jsx    Hareket türü ve seri no raporları
```

## Test durumu

Bu arayüz, gerçek bir Chromium tarayıcısı (Playwright) ile gerçek backend'e
karşı uçtan uca test edildi:

- Giriş yapma → token alma → dashboard'a yönlendirme ✓
- Vergi no sorgulama → otomatik form doldurma → cari kaydetme ✓
- Stok listesi → maliyet/kâr-zarar hesaplarının doğru görüntülenmesi ✓
- Banka bakiyeleri ve ana kasa net bakiyesinin doğru ayrışması ✓
- Hareket türü ve seri no raporlarının doğru veri döndürmesi ✓

Geliştirme sırasında bir gerçek hata bulundu ve düzeltildi: React'in effect
çalışma sırası (önce çocuk, sonra ebeveyn component) nedeniyle, bir sayfa
component'i mount olur olmaz veri çekmeye başlıyor ve bu, kimlik doğrulama
header'ları henüz ayarlanmadan gidebiliyordu (401/422 hataları). Çözüm:
header'lar artık bir `useEffect` içinde değil, axios `request interceptor`
üzerinden her istekte senkron olarak okunuyor (`api/client.js`).

## Sonraki adımlar

- Sipariş oluşturma/teslim alma formu (şu an sadece listeleme var)
- Çek, Leasing, Taksitli Satış, Kiralama, Bakım, Personel, Proforma/Fatura
  ekranları (backend API'leri hazır, frontend ekranları henüz yok)
- Yönetici paneli (rol/izin atama ekranı)
- Sipariş PDF indirme butonu
