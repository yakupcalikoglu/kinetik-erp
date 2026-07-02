import { useEffect, useState } from 'react';
import { api, hataMesajiCikar } from '../api/client';
import {
  Kart, SayfaBasligi, Buton, Etiket, Alan, girdiStili, BosDurum, HataMesaji, paraFormat, Sekmeler, eylemChipStili,
} from '../components/Ortak';

const SEKMELER = [
  { deger: 'cek', etiket: 'Çek' },
  { deger: 'akreditif', etiket: 'Akreditif' },
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
  const [formAcik, setFormAcik] = useState(false);
  const [form, setForm] = useState({ tip: 'ALINAN', cek_no: '', banka_adi: '', cari_id: '', tutar: '', vade_tarihi: '', alinma_verilme_tarihi: '' });
  const [hata, setHata] = useState(null);
  const cariHaritasi = useCariHaritasi();

  function yukle() {
    api.get('/cekler').then((r) => setCekler(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }
  useEffect(yukle, []);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    try {
      await api.post('/cekler', { ...form, cari_id: form.cari_id ? Number(form.cari_id) : null, tutar: Number(form.tutar) });
      setFormAcik(false);
      yukle();
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function ciroEt(cekId) {
    const ciroEdilenCariId = window.prompt('Çekin ciro edileceği cari ID:');
    if (!ciroEdilenCariId) return;
    try {
      await api.put(`/cekler/${cekId}/durum`, { yeni_durum: 'CIRO_EDILDI', ciro_edilen_cari_id: Number(ciroEdilenCariId) });
      yukle();
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Buton onClick={() => setFormAcik((a) => !a)}>{formAcik ? 'Kapat' : '+ Yeni çek'}</Buton>
      </div>
      <HataMesaji>{hata}</HataMesaji>

      {formAcik && (
        <Kart style={{ marginBottom: 16 }}>
          <form onSubmit={kaydet} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Alan etiket="Tip">
              <select value={form.tip} onChange={(e) => setForm((f) => ({ ...f, tip: e.target.value }))} style={girdiStili}>
                <option value="ALINAN">Alınan</option>
                <option value="VERILEN">Verilen</option>
              </select>
            </Alan>
            <Alan etiket="Çek no">
              <input value={form.cek_no} onChange={(e) => setForm((f) => ({ ...f, cek_no:
