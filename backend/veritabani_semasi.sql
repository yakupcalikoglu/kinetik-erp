-- ============================================================================
-- ITHALAT ON MUHASEBE VE STOK YONETIM SISTEMI
-- Veritabani Semasi (PostgreSQL 15+)
-- Coklu sirket (multi-tenant), coklu kullanici, coklu doviz destekli
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. ORTAK / YARDIMCI TIPLER
-- ----------------------------------------------------------------------------
CREATE TYPE para_birimi_t AS ENUM ('TRY','USD','EUR','ALTIN');
CREATE TYPE hareket_yon_t AS ENUM ('GIRIS','CIKIS'); -- genel para giris/cikis yonu
CREATE TYPE cari_tip_t AS ENUM ('MUSTERI','TEDARIKCI','PERSONEL','ORTAK','DIGER');

-- ============================================================================
-- 1. SIRKET, KULLANICI VE YETKI YONETIMI
-- ============================================================================

CREATE TABLE sirketler (
    id              BIGSERIAL PRIMARY KEY,
    unvan           VARCHAR(255) NOT NULL,
    vergi_dairesi   VARCHAR(100),
    vergi_no        VARCHAR(20),
    adres           TEXT,
    telefon         VARCHAR(50),
    email           VARCHAR(100),
    logo_dosya_yolu VARCHAR(500),
    aktif           BOOLEAN DEFAULT TRUE,
    olusturma_tarihi TIMESTAMP DEFAULT now()
);

CREATE TABLE kullanicilar (
    id              BIGSERIAL PRIMARY KEY,
    ad_soyad        VARCHAR(150) NOT NULL,
    email           VARCHAR(150) UNIQUE NOT NULL,
    sifre_hash      VARCHAR(255) NOT NULL,
    telefon         VARCHAR(50),
    aktif           BOOLEAN DEFAULT TRUE,
    son_giris       TIMESTAMP,
    olusturma_tarihi TIMESTAMP DEFAULT now()
);

-- Bir kullanici birden fazla sirkete erisebilir (coklu sirket yonetimi)
CREATE TABLE kullanici_sirket_erisim (
    id              BIGSERIAL PRIMARY KEY,
    kullanici_id    BIGINT NOT NULL REFERENCES kullanicilar(id),
    sirket_id       BIGINT NOT NULL REFERENCES sirketler(id),
    UNIQUE(kullanici_id, sirket_id)
);

-- Roller (Yonetici, Muhasebe, Depo, Satis, Sadece Goruntule, vs.)
CREATE TABLE roller (
    id              BIGSERIAL PRIMARY KEY,
    sirket_id       BIGINT REFERENCES sirketler(id), -- NULL ise tum sirketler icin global rol
    ad              VARCHAR(100) NOT NULL,
    aciklama        VARCHAR(255)
);

-- Sistemdeki her ekran/modul bir "izin" (permission) olarak tanimlanir
CREATE TABLE izinler (
    id              BIGSERIAL PRIMARY KEY,
    kod             VARCHAR(100) UNIQUE NOT NULL, -- ornek: 'STOK_GORUNTULE','BANKA_DUZENLE','RAPOR_GORUNTULE'
    modul           VARCHAR(100) NOT NULL,          -- ornek: 'STOK','BANKA','CARI','CEK','RAPOR'
    aciklama        VARCHAR(255)
);

CREATE TABLE rol_izinleri (
    rol_id          BIGINT NOT NULL REFERENCES roller(id) ON DELETE CASCADE,
    izin_id         BIGINT NOT NULL REFERENCES izinler(id) ON DELETE CASCADE,
    PRIMARY KEY (rol_id, izin_id)
);

CREATE TABLE kullanici_rolleri (
    kullanici_id    BIGINT NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE,
    rol_id          BIGINT NOT NULL REFERENCES roller(id) ON DELETE CASCADE,
    sirket_id       BIGINT NOT NULL REFERENCES sirketler(id),
    PRIMARY KEY (kullanici_id, rol_id, sirket_id)
);

-- Tum kritik islemlerin izlenebilirligi (kim, ne zaman, ne yapti)
CREATE TABLE islem_loglari (
    id              BIGSERIAL PRIMARY KEY,
    sirket_id       BIGINT REFERENCES sirketler(id),
    kullanici_id    BIGINT REFERENCES kullanicilar(id),
    tablo_adi       VARCHAR(100),
    kayit_id        BIGINT,
    islem_tipi      VARCHAR(20), -- INSERT/UPDATE/DELETE
    eski_deger      JSONB,
    yeni_deger      JSONB,
    tarih           TIMESTAMP DEFAULT now()
);

-- ============================================================================
-- 2. DOVIZ KURLARI
-- ============================================================================
CREATE TABLE doviz_kurlari (
    id              BIGSERIAL PRIMARY KEY,
    para_birimi     para_birimi_t NOT NULL, -- USD/EUR/ALTIN -> TRY karsiligi
    tarih           DATE NOT NULL,
    alis            NUMERIC(18,4) NOT NULL,
    satis           NUMERIC(18,4) NOT NULL,
    UNIQUE(para_birimi, tarih)
);

-- ============================================================================
-- 3. CARI HESAP YONETIMI
-- ============================================================================
CREATE TABLE cari_hesaplar (
    id              BIGSERIAL PRIMARY KEY,
    sirket_id       BIGINT NOT NULL REFERENCES sirketler(id),
    tip             cari_tip_t NOT NULL,
    unvan           VARCHAR(255) NOT NULL,
    vergi_no        VARCHAR(20),         -- TC kimlik no veya vergi no
    vergi_dairesi   VARCHAR(100),
    adres           TEXT,
    telefon         VARCHAR(50),
    email           VARCHAR(100),
    -- Vergi no sorgulandiginda GIB / e-Fatura mukellef sorgu servisinden
    -- otomatik doldurulan alanlar:
    otomatik_dolduruldu BOOLEAN DEFAULT FALSE,
    bakiye_try      NUMERIC(18,2) DEFAULT 0, -- guncel net bakiye (cache, hareketlerden hesaplanir)
    bakiye_usd      NUMERIC(18,2) DEFAULT 0,
    bakiye_eur      NUMERIC(18,2) DEFAULT 0,
    aktif           BOOLEAN DEFAULT TRUE,
    olusturma_tarihi TIMESTAMP DEFAULT now()
);

CREATE TABLE cari_hareketler (
    id              BIGSERIAL PRIMARY KEY,
    cari_id         BIGINT NOT NULL REFERENCES cari_hesaplar(id),
    sirket_id       BIGINT NOT NULL REFERENCES sirketler(id),
    tarih           DATE NOT NULL,
    aciklama        VARCHAR(500),
    yon             hareket_yon_t NOT NULL,  -- borc/alacak yerine giris/cikis ile genellestirildi
    para_birimi     para_birimi_t NOT NULL,
    tutar           NUMERIC(18,2) NOT NULL,
    tutar_try_karsiligi NUMERIC(18,2), -- raporlama icin TL karsiligi (kur ile)
    -- ilgili kaynak belge (siparis, fatura, odeme vs.) -- polimorfik referans
    kaynak_tablo    VARCHAR(50),  -- 'SIPARIS','FATURA','BANKA_HAREKETI','TAKSIT', vs.
    kaynak_id       BIGINT,
    olusturan_kullanici_id BIGINT REFERENCES kullanicilar(id),
    olusturma_tarihi TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_cari_hareket_cari ON cari_hareketler(cari_id);
CREATE INDEX idx_cari_hareket_tarih ON cari_hareketler(tarih);

-- ============================================================================
-- 4. STOK YONETIMI (SERI NUMARASI BAZLI)
-- ============================================================================
CREATE TABLE stok_kategorileri (
    id              BIGSERIAL PRIMARY KEY,
    sirket_id       BIGINT NOT NULL REFERENCES sirketler(id),
    ad              VARCHAR(150) NOT NULL  -- 'Forklift','Vinc','Yedek Parca' vs.
);

CREATE TABLE stok_kartlari (
    id              BIGSERIAL PRIMARY KEY,
    sirket_id       BIGINT NOT NULL REFERENCES sirketler(id),
    kategori_id     BIGINT REFERENCES stok_kategorileri(id),
    marka           VARCHAR(100),
    model           VARCHAR(150),
    aciklama        TEXT,
    birim           VARCHAR(20) DEFAULT 'ADET',
    birim_agirlik_kg NUMERIC(10,2), -- urunun tek birim agirligi (kg) - sevkiyat/navlun hesaplari icin
    olusturma_tarihi TIMESTAMP DEFAULT now()
);

-- Her fiziksel urun (forklift, is makinasi vb.) kendi seri numarasiyla
-- tek tek takip edilir; ithalat ya da yurtici alim olabilir.
CREATE TYPE stok_kaynak_t AS ENUM ('ITHALAT','YURTICI_ALIM');
CREATE TYPE stok_durum_t AS ENUM ('DEPODA','SIPARISTE','YOLDA','GUMRUKTE','ANTREPODA',
                                   'SATILDI','KIRADA','BAKIMDA','HURDA');

CREATE TABLE stok_seri_no (
    id              BIGSERIAL PRIMARY KEY,
    sirket_id       BIGINT NOT NULL REFERENCES sirketler(id),
    stok_karti_id   BIGINT NOT NULL REFERENCES stok_kartlari(id),
    seri_no         VARCHAR(100) UNIQUE NOT NULL,
    sasi_no         VARCHAR(100),
    uretim_yili     INT,
    kaynak          stok_kaynak_t NOT NULL,
    siparis_id      BIGINT, -- FK asagida siparisler tablosu tanimlandiktan sonra eklenir
    durum           stok_durum_t NOT NULL DEFAULT 'SIPARISTE',
    tedarikci_cari_id BIGINT REFERENCES cari_hesaplar(id),

    -- MALIYET BILESENLERI (her biri ayri para biriminde girilebilir, TRY karsiligi ile saklanir)
    satinalma_maliyeti_try   NUMERIC(18,2) DEFAULT 0,
    nakliye_maliyeti_try     NUMERIC(18,2) DEFAULT 0,
    gumruk_maliyeti_try      NUMERIC(18,2) DEFAULT 0,
    antrepo_maliyeti_try     NUMERIC(18,2) DEFAULT 0,
    millilestirme_maliyeti_try NUMERIC(18,2) DEFAULT 0,
    leasing_maliyeti_try     NUMERIC(18,2) DEFAULT 0,
    diger_maliyet_try        NUMERIC(18,2) DEFAULT 0,
    toplam_maliyet_try       NUMERIC(18,2) GENERATED ALWAYS AS (
        COALESCE(satinalma_maliyeti_try,0)+COALESCE(nakliye_maliyeti_try,0)+
        COALESCE(gumruk_maliyeti_try,0)+COALESCE(antrepo_maliyeti_try,0)+
        COALESCE(millilestirme_maliyeti_try,0)+COALESCE(leasing_maliyeti_try,0)+
        COALESCE(diger_maliyet_try,0)
    ) STORED,

    satis_fiyati_try         NUMERIC(18,2),
    satis_tarihi             DATE,
    musteri_cari_id          BIGINT REFERENCES cari_hesaplar(id),

    giris_tarihi             DATE,
    olusturma_tarihi         TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_stok_seri_durum ON stok_seri_no(durum);
CREATE INDEX idx_stok_seri_no_arama ON stok_seri_no(seri_no);

-- Maliyet kalemlerinin detay dokumu (yukaridaki ozet alanlarin alt kirilimi;
-- birden fazla fatura/odeme bir maliyet turune dahil olabilir)
CREATE TYPE maliyet_tip_t AS ENUM ('SATINALMA','NAKLIYE','GUMRUK','ANTREPO',
                                    'MILLILESTIRME','LEASING','DIGER');

CREATE TABLE stok_maliyet_kalemleri (
    id              BIGSERIAL PRIMARY KEY,
    stok_seri_no_id BIGINT NOT NULL REFERENCES stok_seri_no(id) ON DELETE CASCADE,
    tip             maliyet_tip_t NOT NULL,
    aciklama        VARCHAR(300),
    tedarikci_cari_id BIGINT REFERENCES cari_hesaplar(id),
    para_birimi     para_birimi_t NOT NULL,
    tutar           NUMERIC(18,2) NOT NULL,
    kur             NUMERIC(18,4) DEFAULT 1,
    tutar_try       NUMERIC(18,2) NOT NULL,
    belge_no        VARCHAR(100),
    tarih           DATE NOT NULL,
    odendi_mi       BOOLEAN DEFAULT FALSE
);

-- ============================================================================
-- 5. SIPARIS YONETIMI
-- ============================================================================
CREATE TYPE siparis_durum_t AS ENUM ('TASLAK','ONAYLANDI','YOLDA','GUMRUKTE',
                                       'TESLIM_ALINDI','TAMAMLANDI','IPTAL');

CREATE TABLE siparisler (
    id              BIGSERIAL PRIMARY KEY,
    sirket_id       BIGINT NOT NULL REFERENCES sirketler(id),
    siparis_no      VARCHAR(50) UNIQUE NOT NULL,
    tedarikci_cari_id BIGINT NOT NULL REFERENCES cari_hesaplar(id),
    kaynak          stok_kaynak_t NOT NULL,           -- ITHALAT / YURTICI_ALIM
    kopya_kaynak_siparis_id BIGINT REFERENCES siparisler(id), -- "eski siparisten kopyala" izi
    siparis_tarihi  DATE NOT NULL,
    tahmini_teslim_tarihi DATE,
    durum           siparis_durum_t DEFAULT 'TASLAK',
    para_birimi     para_birimi_t NOT NULL,
    -- Ithalat ozel alanlari (yurtici alimda bos kalabilir)
    cikis_limani    VARCHAR(150),
    varis_limani    VARCHAR(150),
    konsimento_no   VARCHAR(100),
    gumruk_beyanname_no VARCHAR(100),
    notlar          TEXT,
    olusturan_kullanici_id BIGINT REFERENCES kullanicilar(id),
    olusturma_tarihi TIMESTAMP DEFAULT now()
);

CREATE TABLE siparis_detay (
    id              BIGSERIAL PRIMARY KEY,
    siparis_id      BIGINT NOT NULL REFERENCES siparisler(id) ON DELETE CASCADE,
    stok_karti_id   BIGINT NOT NULL REFERENCES stok_kartlari(id),
    miktar          INT NOT NULL DEFAULT 1,
    birim_fiyat     NUMERIC(18,2) NOT NULL,
    para_birimi     para_birimi_t NOT NULL,
    birim_agirlik_kg NUMERIC(10,2), -- stok_kartlari'ndan kopyalanir, siparis ozelinde degistirilebilir
    aciklama        VARCHAR(300)
);

ALTER TABLE stok_seri_no ADD CONSTRAINT fk_stok_siparis
    FOREIGN KEY (siparis_id) REFERENCES siparisler(id);

-- ============================================================================
-- 6. BANKA HESAPLARI VE HAREKETLERI (coklu banka, coklu doviz)
-- ============================================================================
CREATE TABLE banka_hesaplari (
    id              BIGSERIAL PRIMARY KEY,
    sirket_id       BIGINT NOT NULL REFERENCES sirketler(id),
    banka_adi       VARCHAR(150) NOT NULL,
    sube            VARCHAR(100),
    hesap_adi       VARCHAR(150), -- 'Is Bankasi USD Hesabi' vs.
    iban            VARCHAR(50),
    para_birimi     para_birimi_t NOT NULL,
    guncel_bakiye   NUMERIC(18,2) DEFAULT 0, -- cache, hareketlerden hesaplanir
    aktif           BOOLEAN DEFAULT TRUE
);

CREATE TYPE banka_hareket_tip_t AS ENUM (
    'GIRIS','CIKIS','HESAPLAR_ARASI_TRANSFER','DOVIZ_ALIM','DOVIZ_SATIM'
);

CREATE TABLE banka_hareketleri (
    id              BIGSERIAL PRIMARY KEY,
    sirket_id       BIGINT NOT NULL REFERENCES sirketler(id),
    banka_hesap_id  BIGINT NOT NULL REFERENCES banka_hesaplari(id),
    tarih           DATE NOT NULL,
    tip             banka_hareket_tip_t NOT NULL,
    tutar           NUMERIC(18,2) NOT NULL, -- pozitif: giris, negatif: cikis (kayit kolayligi icin)
    aciklama        VARCHAR(500),
    -- Transfer / doviz cevirme islemleri icin karsi taraf hesap (ayni veya farkli banka)
    karsi_hesap_id  BIGINT REFERENCES banka_hesaplari(id),
    kullanilan_kur  NUMERIC(18,4),
    -- Bu hareket hangi kaynaktan dogdu (siparis odemesi, kira tahsilati, maas vb.)
    kaynak_tablo    VARCHAR(50),
    kaynak_id       BIGINT,
    cari_id         BIGINT REFERENCES cari_hesaplar(id),
    olusturan_kullanici_id BIGINT REFERENCES kullanicilar(id),
    olusturma_tarihi TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_banka_hareket_hesap ON banka_hareketleri(banka_hesap_id);
CREATE INDEX idx_banka_hareket_tarih ON banka_hareketleri(tarih);

-- ============================================================================
-- 7. ANA KASA (tum banka/odeme hareketlerinin netlestigi tek TL kasa)
-- ============================================================================
CREATE TABLE kasa_hareketleri (
    id              BIGSERIAL PRIMARY KEY,
    sirket_id       BIGINT NOT NULL REFERENCES sirketler(id),
    tarih           DATE NOT NULL,
    yon             hareket_yon_t NOT NULL,
    tutar_try       NUMERIC(18,2) NOT NULL,
    aciklama        VARCHAR(500),
    kaynak_tablo    VARCHAR(50),  -- 'BANKA_HAREKETI','CEK','TAKSIT', vs.
    kaynak_id       BIGINT,
    olusturan_kullanici_id BIGINT REFERENCES kullanicilar(id),
    olusturma_tarihi TIMESTAMP DEFAULT now()
);
-- Not: Ana kasa bakiyesi = SUM(GIRIS) - SUM(CIKIS); raporlama view'i asagida (bolum 14).

-- ============================================================================
-- 8. CEK YONETIMI (alinan / verilen / ciro edilen)
-- ============================================================================
CREATE TYPE cek_tip_t AS ENUM ('ALINAN','VERILEN');
CREATE TYPE cek_durum_t AS ENUM ('PORTFOYDE','CIRO_EDILDI','TAHSIL_EDILDI',
                                   'ODENDI','KARSILIKSIZ','IPTAL');

CREATE TABLE cekler (
    id              BIGSERIAL PRIMARY KEY,
    sirket_id       BIGINT NOT NULL REFERENCES sirketler(id),
    tip             cek_tip_t NOT NULL,
    cek_no          VARCHAR(50),
    banka_adi       VARCHAR(150),
    cari_id         BIGINT REFERENCES cari_hesaplar(id), -- kimden alindi / kime verildi
    tutar           NUMERIC(18,2) NOT NULL,
    para_birimi     para_birimi_t NOT NULL DEFAULT 'TRY',
    vade_tarihi     DATE NOT NULL,
    alinma_verilme_tarihi DATE NOT NULL,
    durum           cek_durum_t DEFAULT 'PORTFOYDE',
    -- ciro edilen cek baska bir cariye/tedarikciye devredilirse:
    ciro_edilen_cari_id BIGINT REFERENCES cari_hesaplar(id),
    ciro_tarihi     DATE,
    notlar          VARCHAR(500),
    olusturma_tarihi TIMESTAMP DEFAULT now()
);

CREATE TABLE cek_hareket_gecmisi (
    id              BIGSERIAL PRIMARY KEY,
    cek_id          BIGINT NOT NULL REFERENCES cekler(id) ON DELETE CASCADE,
    tarih           DATE NOT NULL,
    eski_durum      cek_durum_t,
    yeni_durum      cek_durum_t,
    aciklama        VARCHAR(300),
    olusturan_kullanici_id BIGINT REFERENCES kullanicilar(id)
);

-- ============================================================================
-- 9. LEASING SOZLESMELERI
-- ============================================================================
CREATE TABLE leasing_sozlesmeleri (
    id              BIGSERIAL PRIMARY KEY,
    sirket_id       BIGINT NOT NULL REFERENCES sirketler(id),
    leasing_firmasi_cari_id BIGINT NOT NULL REFERENCES cari_hesaplar(id),
    stok_seri_no_id BIGINT REFERENCES stok_seri_no(id), -- hangi urun icin
    sozlesme_no     VARCHAR(100),
    baslangic_tarihi DATE,
    toplam_tutar    NUMERIC(18,2),
    para_birimi     para_birimi_t NOT NULL,
    taksit_sayisi   INT,
    notlar          TEXT
);

CREATE TABLE leasing_odeme_plani (
    id              BIGSERIAL PRIMARY KEY,
    leasing_id      BIGINT NOT NULL REFERENCES leasing_sozlesmeleri(id) ON DELETE CASCADE,
    taksit_no       INT NOT NULL,
    vade_tarihi     DATE NOT NULL,
    tutar           NUMERIC(18,2) NOT NULL,
    odendi_mi       BOOLEAN DEFAULT FALSE,
    odeme_tarihi    DATE,
    banka_hareket_id BIGINT REFERENCES banka_hareketleri(id)
);

-- ============================================================================
-- 10. TAKSITLI SATISLAR (musteriye taksitle satilan urunler)
-- ============================================================================
CREATE TABLE taksitli_satis_planlari (
    id              BIGSERIAL PRIMARY KEY,
    sirket_id       BIGINT NOT NULL REFERENCES sirketler(id),
    musteri_cari_id BIGINT NOT NULL REFERENCES cari_hesaplar(id),
    stok_seri_no_id BIGINT REFERENCES stok_seri_no(id),
    toplam_tutar    NUMERIC(18,2) NOT NULL,
    para_birimi     para_birimi_t NOT NULL,
    pesinat         NUMERIC(18,2) DEFAULT 0,
    taksit_sayisi   INT NOT NULL,
    baslangic_tarihi DATE NOT NULL,
    notlar          TEXT
);

CREATE TABLE taksit_detay (
    id              BIGSERIAL PRIMARY KEY,
    plan_id         BIGINT NOT NULL REFERENCES taksitli_satis_planlari(id) ON DELETE CASCADE,
    taksit_no       INT NOT NULL,
    vade_tarihi     DATE NOT NULL,
    tutar           NUMERIC(18,2) NOT NULL,
    odendi_mi       BOOLEAN DEFAULT FALSE,
    odeme_tarihi    DATE,
    tahsilat_kaynak_tablo VARCHAR(50), -- 'BANKA_HAREKETI','KASA_HAREKETI','CEK'
    tahsilat_kaynak_id BIGINT
);

-- ============================================================================
-- 11. KIRALAMA YONETIMI (verilen kiralik urunler)
-- ============================================================================
CREATE TABLE kiralama_sozlesmeleri (
    id              BIGSERIAL PRIMARY KEY,
    sirket_id       BIGINT NOT NULL REFERENCES sirketler(id),
    stok_seri_no_id BIGINT NOT NULL REFERENCES stok_seri_no(id),
    kiraci_cari_id  BIGINT NOT NULL REFERENCES cari_hesaplar(id),
    baslangic_tarihi DATE NOT NULL,
    bitis_tarihi    DATE, -- bos ise suresiz / belirsiz sure
    aylik_kira_tutari NUMERIC(18,2) NOT NULL,
    para_birimi     para_birimi_t NOT NULL,
    depozito        NUMERIC(18,2) DEFAULT 0,
    durum           VARCHAR(20) DEFAULT 'AKTIF', -- AKTIF / TAMAMLANDI / IPTAL
    notlar          TEXT
);

CREATE TABLE kiralama_odemeleri (
    id              BIGSERIAL PRIMARY KEY,
    sozlesme_id     BIGINT NOT NULL REFERENCES kiralama_sozlesmeleri(id) ON DELETE CASCADE,
    donem_basi      DATE NOT NULL,
    donem_sonu      DATE NOT NULL,
    tutar           NUMERIC(18,2) NOT NULL,
    odendi_mi       BOOLEAN DEFAULT FALSE,
    odeme_tarihi    DATE,
    tahsilat_kaynak_tablo VARCHAR(50),
    tahsilat_kaynak_id BIGINT
);

-- ============================================================================
-- 12. BAKIM TAKIBI (satilan / oz mal urunlerin bakim gelir-gideri)
-- ============================================================================
CREATE TYPE bakim_tip_t AS ENUM ('GELIR','GIDER');

CREATE TABLE bakim_kayitlari (
    id              BIGSERIAL PRIMARY KEY,
    sirket_id       BIGINT NOT NULL REFERENCES sirketler(id),
    stok_seri_no_id BIGINT NOT NULL REFERENCES stok_seri_no(id),
    tarih           DATE NOT NULL,
    tip             bakim_tip_t NOT NULL,
    aciklama        VARCHAR(500),
    ilgili_cari_id  BIGINT REFERENCES cari_hesaplar(id), -- bakim yapan firma / musteri
    tutar           NUMERIC(18,2) NOT NULL,
    para_birimi     para_birimi_t NOT NULL DEFAULT 'TRY',
    odendi_tahsil_edildi_mi BOOLEAN DEFAULT FALSE
);

-- ============================================================================
-- 13. PERSONEL VE SABIT GIDERLER
-- ============================================================================
CREATE TABLE personel (
    id              BIGSERIAL PRIMARY KEY,
    sirket_id       BIGINT NOT NULL REFERENCES sirketler(id),
    ad_soyad        VARCHAR(150) NOT NULL,
    pozisyon        VARCHAR(100),
    aylik_maas      NUMERIC(18,2),
    ise_baslama_tarihi DATE,
    aktif           BOOLEAN DEFAULT TRUE
);

CREATE TYPE personel_odeme_tip_t AS ENUM ('MAAS','AVANS','PRIM','SGK','DIGER');

CREATE TABLE personel_odemeleri (
    id              BIGSERIAL PRIMARY KEY,
    personel_id     BIGINT NOT NULL REFERENCES personel(id),
    donem           DATE NOT NULL, -- ayin ilk gunu, hangi ay icin
    tip             personel_odeme_tip_t NOT NULL,
    tutar           NUMERIC(18,2) NOT NULL,
    odendi_mi       BOOLEAN DEFAULT FALSE,
    odeme_tarihi    DATE,
    aciklama        VARCHAR(300)
);

CREATE TABLE sabit_gider_kategorileri (
    id              BIGSERIAL PRIMARY KEY,
    ad              VARCHAR(100) NOT NULL -- 'Kira','Aidat','Elektrik','Su','Dogalgaz','Diger'
);

CREATE TABLE sabit_giderler (
    id              BIGSERIAL PRIMARY KEY,
    sirket_id       BIGINT NOT NULL REFERENCES sirketler(id),
    kategori_id     BIGINT NOT NULL REFERENCES sabit_gider_kategorileri(id),
    donem           DATE NOT NULL,
    tutar           NUMERIC(18,2) NOT NULL,
    odendi_mi       BOOLEAN DEFAULT FALSE,
    odeme_tarihi    DATE,
    aciklama        VARCHAR(300)
);

-- ============================================================================
-- 14. ORTAK VE DIS BORCLAR
-- ============================================================================
CREATE TYPE borc_tip_t AS ENUM ('ORTAKTAN_ALINAN','DISARIDAN_ALINAN','ORTAGA_VERILEN');

CREATE TABLE borclar (
    id              BIGSERIAL PRIMARY KEY,
    sirket_id       BIGINT NOT NULL REFERENCES sirketler(id),
    tip             borc_tip_t NOT NULL,
    cari_id         BIGINT NOT NULL REFERENCES cari_hesaplar(id), -- ortak veya dis kaynak cari karti
    tutar           NUMERIC(18,2) NOT NULL,
    para_birimi     para_birimi_t NOT NULL,
    faiz_orani      NUMERIC(6,3) DEFAULT 0,
    alinma_tarihi   DATE NOT NULL,
    vade_tarihi     DATE,
    notlar          TEXT
);

CREATE TABLE borc_odemeleri (
    id              BIGSERIAL PRIMARY KEY,
    borc_id         BIGINT NOT NULL REFERENCES borclar(id) ON DELETE CASCADE,
    tarih           DATE NOT NULL,
    tutar           NUMERIC(18,2) NOT NULL,
    aciklama        VARCHAR(300)
);

-- ============================================================================
-- 15. PROFORMA FATURA VE FATURA
-- ============================================================================
CREATE TABLE proforma_faturalar (
    id              BIGSERIAL PRIMARY KEY,
    sirket_id       BIGINT NOT NULL REFERENCES sirketler(id),
    proforma_no     VARCHAR(50) UNIQUE NOT NULL,
    cari_id         BIGINT NOT NULL REFERENCES cari_hesaplar(id),
    tarih           DATE NOT NULL,
    gecerlilik_tarihi DATE,
    para_birimi     para_birimi_t NOT NULL,
    ara_toplam      NUMERIC(18,2) NOT NULL,
    kdv_tutari      NUMERIC(18,2) DEFAULT 0,
    genel_toplam    NUMERIC(18,2) NOT NULL,
    durum           VARCHAR(20) DEFAULT 'BEKLEMEDE', -- BEKLEMEDE / FATURALASTI / IPTAL
    notlar          TEXT,
    olusturan_kullanici_id BIGINT REFERENCES kullanicilar(id),
    olusturma_tarihi TIMESTAMP DEFAULT now()
);

CREATE TABLE proforma_detay (
    id              BIGSERIAL PRIMARY KEY,
    proforma_id     BIGINT NOT NULL REFERENCES proforma_faturalar(id) ON DELETE CASCADE,
    stok_karti_id   BIGINT REFERENCES stok_kartlari(id),
    aciklama        VARCHAR(300),
    miktar          NUMERIC(18,2) NOT NULL DEFAULT 1,
    birim_fiyat     NUMERIC(18,2) NOT NULL,
    kdv_orani       NUMERIC(5,2) DEFAULT 20
);

CREATE TABLE faturalar (
    id              BIGSERIAL PRIMARY KEY,
    sirket_id       BIGINT NOT NULL REFERENCES sirketler(id),
    fatura_no       VARCHAR(50) UNIQUE NOT NULL,
    proforma_id     BIGINT REFERENCES proforma_faturalar(id), -- proformadan donusturulduyse referans
    cari_id         BIGINT NOT NULL REFERENCES cari_hesaplar(id),
    tarih           DATE NOT NULL,
    para_birimi     para_birimi_t NOT NULL,
    ara_toplam      NUMERIC(18,2) NOT NULL,
    kdv_tutari      NUMERIC(18,2) DEFAULT 0,
    genel_toplam    NUMERIC(18,2) NOT NULL,
    odeme_durumu    VARCHAR(20) DEFAULT 'ODENMEDI', -- ODENMEDI / KISMI_ODENDI / ODENDI
    notlar          TEXT,
    olusturan_kullanici_id BIGINT REFERENCES kullanicilar(id),
    olusturma_tarihi TIMESTAMP DEFAULT now()
);

CREATE TABLE fatura_detay (
    id              BIGSERIAL PRIMARY KEY,
    fatura_id       BIGINT NOT NULL REFERENCES faturalar(id) ON DELETE CASCADE,
    stok_karti_id   BIGINT REFERENCES stok_kartlari(id),
    stok_seri_no_id BIGINT REFERENCES stok_seri_no(id), -- forklift gibi tekil urunlerde seri no baglanir
    aciklama        VARCHAR(300),
    miktar          NUMERIC(18,2) NOT NULL DEFAULT 1,
    birim_fiyat     NUMERIC(18,2) NOT NULL,
    kdv_orani       NUMERIC(5,2) DEFAULT 20
);

-- ============================================================================
-- 16. RAPORLAMA ICIN YARDIMCI VIEW'LAR
-- ============================================================================

-- Ana kasa guncel bakiyesi
CREATE VIEW v_ana_kasa_bakiye AS
SELECT sirket_id,
       SUM(CASE WHEN yon='GIRIS' THEN tutar_try ELSE -tutar_try END) AS net_bakiye
FROM kasa_hareketleri
GROUP BY sirket_id;

-- Banka hesap bakiyeleri (para birimi bazinda)
CREATE VIEW v_banka_bakiyeleri AS
SELECT bh.sirket_id, bh.id AS banka_hesap_id, bh.banka_adi, bh.hesap_adi,
       bh.para_birimi,
       COALESCE(SUM(bk.tutar),0) AS bakiye
FROM banka_hesaplari bh
LEFT JOIN banka_hareketleri bk ON bk.banka_hesap_id = bh.id
GROUP BY bh.sirket_id, bh.id, bh.banka_adi, bh.hesap_adi, bh.para_birimi;

-- Seri numarasina gore tam maliyet ve kar raporu
CREATE VIEW v_seri_no_kar_raporu AS
SELECT s.sirket_id, s.seri_no, sk.marka, sk.model,
       s.satinalma_maliyeti_try, s.nakliye_maliyeti_try, s.gumruk_maliyeti_try,
       s.antrepo_maliyeti_try, s.millilestirme_maliyeti_try, s.leasing_maliyeti_try,
       s.diger_maliyet_try, s.toplam_maliyet_try,
       s.satis_fiyati_try,
       (s.satis_fiyati_try - s.toplam_maliyet_try) AS kar_zarar_try,
       s.durum
FROM stok_seri_no s
JOIN stok_kartlari sk ON sk.id = s.stok_karti_id;

-- Cariye gore hareket dokumu
CREATE VIEW v_cari_hareket_ozet AS
SELECT cari_id, sirket_id, para_birimi,
       SUM(CASE WHEN yon='GIRIS' THEN tutar ELSE 0 END) AS toplam_giris,
       SUM(CASE WHEN yon='CIKIS' THEN tutar ELSE 0 END) AS toplam_cikis,
       SUM(CASE WHEN yon='GIRIS' THEN tutar ELSE -tutar END) AS net_bakiye
FROM cari_hareketler
GROUP BY cari_id, sirket_id, para_birimi;

-- ============================================================================
-- NOT: Tum tablolarda 'sirket_id' alani coklu sirket / coklu sube ayrimini
-- saglar. Uygulama katmaninda her sorguya WHERE sirket_id = :aktif_sirket
-- filtresi otomatik eklenmelidir (row-level security ile de desteklenebilir).
-- ============================================================================
