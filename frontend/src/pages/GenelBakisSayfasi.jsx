import { useEffect, useState } from 'react';
import { api, hataMesajiCikar } from '../api/client';
import { Kart, SayfaBasligi, HataMesaji, paraFormat } from '../components/Ortak';

function MetrikKart({ etiket, deger, ton = 'notr' }) {
  const renkler = {
    notr: 'var(--metin-birincil)',
    yesil: 'var(--yesil)',
    kirmizi: 'var(--kirmizi)',
    amber: 'var(--amber)',
  };
  return (
    <Kart style={{ flex: 1 }}>
      <div style={{ fontSize: 12.5, color: 'var(--metin-ikincil)', marginBottom: 8 }}>{etiket}</div>
      <div style={{ fontSize: 26, fontWeight: 600, color: renkler[ton] }}>{deger}</div>
    </Kart>
  );
}

export default function GenelBakisSayfasi() {
  const [veri, setVeri] = useState(null);
  const [hata, setHata] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    api.get('/raporlar/genel-bakis')
      .then((res) => setVeri(res.data))
      .catch((err) => setHata(hataMesajiCikar(err)))
      .finally(() => setYukleniyor(false));
  }, []);

  return (
    <div>
      <SayfaBasligi baslik="Genel bakış" aciklama="Ana kasa, çek vadeleri ve stok durumunun özeti" />
      <HataMesaji>{hata}</HataMesaji>

      {yukleniyor && <div style={{ color: 'var(--metin-soluk)' }}>Yükleniyor...</div>}

      {veri && (
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <MetrikKart
              etiket="Ana kasa bakiyesi"
              deger={paraFormat(veri.ana_kasa_bakiye_try)}
              ton={veri.ana_kasa_bakiye_try >= 0 ? 'yesil' : 'kirmizi'}
            />
            <MetrikKart etiket="Depodaki ürün sayısı" deger={veri.depodaki_urun_sayisi} />
            <MetrikKart etiket="Aktif kiralama sayısı" deger={veri.aktif_kiralama_sayisi} />
          </div>

          <div style={{ display: 'flex', gap: 16 }}>
            <MetrikKart
              etiket="Vadesi yaklaşan çek (7 gün)"
              deger={`${veri.vadesi_yaklasan_cek_sayisi} adet · ${paraFormat(veri.vadesi_yaklasan_cek_toplami)}`}
              ton={veri.vadesi_yaklasan_cek_sayisi > 0 ? 'amber' : 'notr'}
            />
            <MetrikKart
              etiket="Geciken taksit"
              deger={`${veri.geciken_taksit_sayisi} adet · ${paraFormat(veri.geciken_taksit_toplami)}`}
              ton={veri.geciken_taksit_sayisi > 0 ? 'kirmizi' : 'notr'}
            />
          </div>

          <Kart style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12.5, color: 'var(--metin-soluk)' }}>{veri.banka_toplam_try_karsiligi_not}</div>
          </Kart>
        </>
      )}
    </div>
  );
}
