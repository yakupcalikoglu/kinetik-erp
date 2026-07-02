import { useEffect, useState } from 'react';
import { api, hataMesajiCikar } from '../api/client';
import {
  Kart, SayfaBasligi, Buton, Etiket, Alan, girdiStili, BosDurum, HataMesaji, paraFormat, Sekmeler, eylemChipStili,
} from '../components/Ortak';

const SEKMELER = [
  { deger: 'cek', etiket: 'Çek' },
  { deger: 'leasing', etiket: 'Leasing' },
  { deger: 'taksit', etiket: 'Taksitli Satış' },
  { deger: 'kiralama', etiket: 'Kiralama' },
  { deger: 'bakim', etiket: 'Bakım' },
  { deger: 'personel', etiket: 'Personel' },
  { deger: 'gider', etiket: 'Sabit Giderler' },
  { deger: 'borc', etiket: 'Ortak / Dış Borç' },
];

function BasitTablo({ basliklar, satirlar, render }) {
  if (satirlar.length === 0) return <BosDurum baslik="Kayıt bulunamadı" />;
  return (
    <table>
      <thead>
        <tr style={{ background: 'var(--zemin)' }}>
          {basliklar.map((b) => (
            <th key={b} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>{b}</th>
          ))}
        </tr>
      </thead>
      <tbody>{satirlar.map(render)}</tbody>
    </table>
  );
}

// Cari ID -> unvan haritasi. Cari ID gorunen her yerde isim de gosterebilmek icin
// carileri bir kere cekip id bazli bir haritaya donusturuyoruz.
function useCariHaritasi() {
  const [harita, setHarita] = useState({});
  useEffect(() => {
    api.get('/cariler')
      .then((r) => {
        const h = {};
        r.data.forEach((c) => { h[c.id] = c.unvan; });
        setHarita(h);
      })
      .catch(() => {});
  }, []);
  return harita;
}

function cariGoster(id, harita) {
  if (id === null || id === undefined || id === '') return '—';
  const unvan = harita[id];
  return unvan ? `#${id} — ${unvan}` : `#${id}`;
}

// ============================================================== ÇEK
const CEK_DURUM_TON = { PORTFOYDE: 'amber', CIRO_EDILDI: 'notr', TAHSIL_EDILDI: 'yesil', ODENDI: 'yesil', KARSILIKSIZ: 'kirmizi', IPTAL: 'kirmizi' };
const CEK_DURUM_METIN = { PORTFOYDE: 'Portföyde', CIRO_EDILDI: 'Ciro Edildi', TAHSIL_EDILDI: 'Tahsil Edildi', ODENDI: 'Ödendi', KARSILIKSIZ: 'Karşılıksız', IPTAL: 'İptal' };

function CekSekmesi() {
  const [cekler, setCekler] = useState([]);
