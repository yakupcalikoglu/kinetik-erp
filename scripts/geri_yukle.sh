#!/bin/bash
# ============================================================================
# Kinetik ERP - Yedekten Geri Yukleme Betigi
#
# Kullanim:
#   ./geri_yukle.sh <sifrelenmis_dosya.sql.gpg> <hedef_veritabani_url>
#
# Ornek:
#   ./geri_yukle.sh kinetik_2026-06-30_0300.sql.gpg \
#       postgresql://postgres:sifre@localhost:5432/ithalat_db_kurtarma
#
# Onemli: Bu islem hedef veritabanina dogrudan yazar. Test ortaminda
# veya BOS bir veritabaninda calistirilmasi onerilir, mevcut veriyle
# karisikligi onlemek icin.
# ============================================================================
set -euo pipefail

if [ $# -ne 2 ]; then
  echo "Kullanim: $0 <sifrelenmis_dosya.sql.gpg> <hedef_veritabani_url>" >&2
  exit 1
fi

SIFRELI_DOSYA="$1"
HEDEF_DB_URL="$2"

if [ -z "${GPG_PASSPHRASE:-}" ]; then
  echo "HATA: GPG_PASSPHRASE ortam degiskeni tanimli degil." >&2
  exit 1
fi

GECICI_DOSYA=$(mktemp)
trap 'rm -f "$GECICI_DOSYA"' EXIT

echo "Yedek dosyasi sifre cozuluyor..."
gpg --batch --yes --passphrase "$GPG_PASSPHRASE" --decrypt "$SIFRELI_DOSYA" > "$GECICI_DOSYA"

echo "Hedef veritabanina geri yukleniyor: $HEDEF_DB_URL"
echo "Devam etmek istediginizden eminseniz EVET yazin:"
read -r ONAY
if [ "$ONAY" != "EVET" ]; then
  echo "Islem iptal edildi."
  exit 0
fi

psql "$HEDEF_DB_URL" < "$GECICI_DOSYA"
echo "Geri yukleme tamamlandi."
