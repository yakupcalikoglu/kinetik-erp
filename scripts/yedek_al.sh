#!/bin/bash
# ============================================================================
# Kinetik ERP - Sifrelenmis Otomatik Yedekleme Betigi
#
# Ne yapar:
#   1. PostgreSQL veritabaninin tam dump'ini alir (pg_dump)
#   2. Dump'i GPG ile simetrik sifreler (parola tabanli)
#   3. Sifrelenmis dosyayi private bir GitHub deposuna "Release asset"
#      olarak yukler (duz/sifrelenmemis veri ASLA git commit edilmez)
#   4. Yerel gecici dosyalari temizler, sadece son N gunu yerel saklar
#
# Gerekli ortam degiskenleri (.env veya sistem ortaminda tanimlanmali):
#   DATABASE_URL      - postgresql://kullanici:sifre@host:port/veritabani
#   GPG_PASSPHRASE    - yedek sifreleme parolasi (GUCLU ve ayri bir yerde
#                        saklanmali - bu parolayi kaybederseniz yedek
#                        GERI ALINAMAZ sekilde okunamaz hale gelir)
#   GITHUB_TOKEN      - "repo" yetkili bir GitHub Personal Access Token
#   GITHUB_REPO       - "kullanici-adi/kinetik-erp-yedekler" formatinda
#                        AYRI ve PRIVATE bir depo (kod deposundan farkli
#                        olmasi onerilir, boylece yedek erisim yetkisi
#                        kod erisim yetkisinden bagimsiz yonetilebilir)
#
# Kurulum (cron - her gun gece 03:00):
#   0 3 * * * /opt/kinetik-erp/scripts/yedek_al.sh >> /var/log/kinetik_yedek.log 2>&1
# ============================================================================
set -euo pipefail

YEDEK_DIZINI="${YEDEK_DIZINI:-/var/backups/kinetik-erp}"
SAKLAMA_GUNU="${SAKLAMA_GUNU:-7}"   # yerelde kac gunluk yedek tutulsun
TARIH=$(date +%Y-%m-%d_%H%M)
DUMP_DOSYASI="$YEDEK_DIZINI/kinetik_${TARIH}.sql"
SIFRELI_DOSYA="$DUMP_DOSYASI.gpg"

zorunlu_degiskenler=(DATABASE_URL GPG_PASSPHRASE GITHUB_TOKEN GITHUB_REPO)
for v in "${zorunlu_degiskenler[@]}"; do
  if [ -z "${!v:-}" ]; then
    echo "HATA: $v ortam degiskeni tanimli degil. Yedekleme durduruldu." >&2
    exit 1
  fi
done

mkdir -p "$YEDEK_DIZINI"

echo "[$(date)] Veritabani dump aliniyor..."
pg_dump "$DATABASE_URL" --format=plain --no-owner --no-privileges > "$DUMP_DOSYASI"

echo "[$(date)] Dump sifreleniyor (GPG, simetrik)..."
gpg --batch --yes --passphrase "$GPG_PASSPHRASE" \
    --cipher-algo AES256 --symmetric \
    --output "$SIFRELI_DOSYA" "$DUMP_DOSYASI"

# Sifrelenmemis dump'i HEMEN sil - diskte duz metin halinde asla kalmamali
rm -f "$DUMP_DOSYASI"
echo "[$(date)] Sifrelenmemis dump silindi, sadece .gpg dosyasi kaldi."

echo "[$(date)] GitHub Release olusturuluyor: yedek-${TARIH}..."
RELEASE_RESPONSE=$(curl -s -X POST \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$GITHUB_REPO/releases" \
  -d "{\"tag_name\":\"yedek-${TARIH}\",\"name\":\"Yedek ${TARIH}\",\"body\":\"Otomatik sifrelenmis veritabani yedegi.\",\"draft\":false,\"prerelease\":false}")

UPLOAD_URL=$(echo "$RELEASE_RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
url = data.get('upload_url', '')
print(url.split('{')[0] if url else '')
")

if [ -z "$UPLOAD_URL" ]; then
  echo "HATA: Release olusturulamadi. Yanit:" >&2
  echo "$RELEASE_RESPONSE" >&2
  exit 1
fi

echo "[$(date)] Sifrelenmis yedek yukleniyor..."
DOSYA_ADI=$(basename "$SIFRELI_DOSYA")
curl -s -X POST \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @"$SIFRELI_DOSYA" \
  "${UPLOAD_URL}?name=${DOSYA_ADI}" > /dev/null

echo "[$(date)] Yedek basariyla yuklendi: $GITHUB_REPO -> yedek-${TARIH}"

echo "[$(date)] ${SAKLAMA_GUNU} gunden eski yerel yedekler temizleniyor..."
find "$YEDEK_DIZINI" -name "kinetik_*.sql.gpg" -mtime "+${SAKLAMA_GUNU}" -delete

echo "[$(date)] Yedekleme tamamlandi."
