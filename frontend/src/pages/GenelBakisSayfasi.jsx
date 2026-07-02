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

const TUR_RENK = {
  CEK: { bg: '#e8edf7', renk: '#1e3a6e', etiket: 'Çek' },
  LEASING: { bg: '#f3e8fb', renk: '#7a2fa8', etiket: 'Leasing' },
  AKREDITIF: { bg: '#fdf1e3', renk: '#b5670a', etiket: 'Akreditif' },
  TAKSIT: { bg: '#e3f5e9', renk: '#1c7c4c', etiket: 'Taksit' },
  KIRA: { bg: '#e3f0fb', renk: '#0b5fa8', etiket: 'Kira' },
};

function TurEtiketi({ tur }) {
  const t = TUR_RENK[tur] || { bg: '#f1f2f4', renk: '#5a6472', etiket: tur };
  return (
    <span style={{
      background: t.bg, color: t.renk, borderRadius: 5, padding: '2px 8px',
      fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {t.etiket}
    </span>
  );
}

function VadeListesi({ baslik, satirlar, toplam, bosMesaj }) {
  const gosterilecekler = satirlar.slice(0, 5);
  return (
    <Kart style={{ flex: 1, padding: 0 }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--kenarlik)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: 13.5 }}>{baslik}</span>
        <span style={{ fontWeight: 600, fontSize: 13.5 }}>{paraFormat(toplam)}</span>
      </div>
      {satirlar.length === 0 ? (
        <div style={{ padding: '16px', color: 'var(--metin-soluk)', fontSize: 13 }}>{bosMesaj}</div>
      ) : (
        <div>
          {gosterilecekler.map((s, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 16px', borderTop: i > 0 ? '1px solid var(--kenarlik)' : 'none', gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <TurEtiketi tur={s.tur} />
                <span style={{ fontSize: 13, color: 'var(--metin-ikincil)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.aciklama}
                </span>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{paraFormat(s.tutar, s.para_birimi)}</div>
                <div style={{ fontSize: 11, color: 'var(--metin-soluk)' }}>{s.tarih}</div>
              </div>
            </div>
          ))}
          {satirlar.length > 5 && (
            <div style={{ padding: '8px 16px', fontSize: 12, color: 'var(--metin-soluk)', borderTop: '1px solid var(--kenarlik)' }}>
              + {satirlar.length - 5} kayıt daha
            </div>
          )}
        </div>
      )}
    </Kart>
  );
}

export default function GenelBakisSayfasi() {
  const [veri, setVeri] = useState(null);
  const [vadeler, setVadeler] = useState(null);
  const [hata, setHata] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/raporlar/genel-bakis'),
      api.get('/raporlar/yaklasan-vadeler', { params: { gun: 30 } }),
    ])
      .then(([genelRes, vadeRes]) => {
        setVeri(genelRes.data);
        setVadeler(vadeRes.data);
      })
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
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
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

          {vadeler && (
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              <VadeListesi
                baslik="Önümüzdeki 30 gün — Ödemeler"
                satirlar={vadeler.odemeler}
                toplam={vadeler.odemeler_toplam}
                bosMesaj="Önümüzdeki 30 günde vadesi gelen ödeme yok."
              />
              <VadeListesi
                baslik="Önümüzdeki 30 gün — Tahsilatlar"
                satirlar={vadeler.tahsilatlar}
                toplam={vadeler.tahsilatlar_toplam}
                bosMesaj="Önümüzdeki 30 günde vadesi gelen tahsilat yok."
              />
            </div>
          )}

          <Kart>
            <div style={{ fontSize: 12.5, color: 'var(--metin-soluk)' }}>{veri.banka_toplam_try_karsiligi_not}</div>
          </Kart>
        </>
      )}
    </div>
  );
}
