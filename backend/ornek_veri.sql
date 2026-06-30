-- Test/demo amacli ornek veri. Sifre hash'lerini kendi ortaminizda
-- app/core/security.py -> sifre_hashle() fonksiyonuyla uretmelisiniz.

INSERT INTO sirketler (unvan, vergi_no, adres, telefon, email) VALUES
('Örnek Makina İthalat A.Ş.', '1234567890', 'Bursa OSB', '+90 224 123 45 67', 'info@ornekmakina.com.tr');

-- sifre: test1234 (bcrypt hash - kendi ortaminizda yeniden uretin)
INSERT INTO kullanicilar (ad_soyad, email, sifre_hash) VALUES
('Test Yönetici', 'admin@ornekmakina.com.tr', '$2b$12$REPLACE_WITH_REAL_HASH');

INSERT INTO kullanici_sirket_erisim (kullanici_id, sirket_id) VALUES (1, 1);

INSERT INTO izinler (kod, modul, aciklama) VALUES
('SIRKET_YONET','SIRKET','Şirket bilgilerini yönetme'),
('STOK_GORUNTULE','STOK','Stok ekranını görüntüleme'),
('STOK_DUZENLE','STOK','Stok kaydı ekleme/düzenleme');

INSERT INTO roller (sirket_id, ad, aciklama) VALUES (1, 'Yönetici', 'Tam yetkili rol');
INSERT INTO rol_izinleri (rol_id, izin_id) SELECT 1, id FROM izinler;
INSERT INTO kullanici_rolleri (kullanici_id, rol_id, sirket_id) VALUES (1, 1, 1);

-- Yonetici paneli (rol/izin yonetimi) izni
INSERT INTO izinler (kod, modul, aciklama) VALUES
('KULLANICI_YONET','KULLANICI','Kullanıcı/rol/izin yönetimi')
ON CONFLICT (kod) DO NOTHING;

INSERT INTO rol_izinleri (rol_id, izin_id)
SELECT 1, id FROM izinler WHERE kod = 'KULLANICI_YONET'
ON CONFLICT DO NOTHING;
