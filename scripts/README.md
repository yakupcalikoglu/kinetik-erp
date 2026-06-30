# Yedekleme Kurulumu

## 1. Ayrı bir private "yedekler" deposu oluşturun

Kod deposundan (`kinetik-erp`) **ayrı** bir private repo açın, örneğin
`kinetik-erp-yedekler`. Ayrı tutmanın sebebi: kod deposuna erişimi olan
herkesin (örn. bir geliştirici) otomatik olarak banka/maaş verisine de
erişmesini istemezsiniz — bu iki yetki birbirinden bağımsız yönetilmeli.

## 2. GitHub Personal Access Token oluşturun

GitHub -> Settings -> Developer settings -> Personal access tokens ->
Fine-grained token. Sadece `kinetik-erp-yedekler` deposuna, sadece
**Contents: Read and write** ve **Releases** izniyle sınırlayın. Bu token'ı
sadece sunucudaki ortam değişkenlerinde saklayın, kimseyle paylaşmayın.

## 3. Sunucuda ortam değişkenlerini tanımlayın

`/etc/kinetik-erp-yedek.env` (örnek, kendi yolunuzu seçin, izinleri 600 yapın):

```bash
DATABASE_URL=postgresql://kullanici:sifre@localhost:5432/ithalat_db
GPG_PASSPHRASE=cok-guclu-ve-baska-hicbir-yerde-kullanilmayan-bir-parola
GITHUB_TOKEN=github_pat_xxxxxxxxxxxxx
GITHUB_REPO=kullanici-adi/kinetik-erp-yedekler
```

```bash
chmod 600 /etc/kinetik-erp-yedek.env
```

**GPG_PASSPHRASE'i ayrıca güvenli bir parola yöneticisinde de saklayın.**
Bu parolayı kaybederseniz, GitHub'daki yedekler kalır ama hiçbir zaman
şifresi çözülemez hale gelir.

## 4. Cron job kurun

```bash
crontab -e
```

Aşağıdaki satırı ekleyin (her gece saat 03:00'te çalışır):

```
0 3 * * * set -a && . /etc/kinetik-erp-yedek.env && set +a && /opt/kinetik-erp/scripts/yedek_al.sh >> /var/log/kinetik_yedek.log 2>&1
```

## 5. Test edin

Cron'u beklemeden manuel çalıştırarak doğrulayın:

```bash
set -a && source /etc/kinetik-erp-yedek.env && set +a
bash /opt/kinetik-erp/scripts/yedek_al.sh
```

GitHub'da `kinetik-erp-yedekler` deposunun Releases sekmesinde yeni bir
`yedek-TARİH` etiketi ve altında `.sql.gpg` dosyası görmelisiniz.

## Geri Yükleme

```bash
# GitHub'dan istediğiniz .sql.gpg dosyasını indirin, sonra:
export GPG_PASSPHRASE="..."
./geri_yukle.sh kinetik_2026-06-30_0300.sql.gpg postgresql://postgres:sifre@localhost:5432/test_kurtarma
```

## Neden bu yaklaşım?

- Şifrelenmemiş finansal veri **hiçbir zaman** disk üzerinde veya Git
  geçmişinde düz metin olarak kalmaz; `yedek_al.sh` dump'ı sifreledikten
  hemen sonra orijinal dosyayı siler.
- GPG simetrik şifreleme (AES256) ile parola tabanlı koruma sağlanır;
  parola sunucu dışında bir parola yöneticisinde de tutulmalı.
- GitHub Release asset'leri Git commit geçmişine girmez, bu nedenle
  "geçmiş commit'lerde iz kalır" riski burada geçerli değildir.
- Yedek deposu kod deposundan ayrı olduğu için erişim yetkileri bağımsız
  yönetilebilir.
