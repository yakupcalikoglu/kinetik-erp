import { useEffect, useState } from 'react';
import { api, hataMesajiCikar } from '../api/client';
import {
  Kart, SayfaBasligi, Buton, Etiket, Alan, girdiStili, BosDurum, HataMesaji, paraFormat,
} from '../components/Ortak';

const TIP_ETIKET = {
  MUSTERI: { metin: 'Müşteri', ton: 'yesil' },
  TEDARIKCI: { metin: 'Tedarikçi', ton: 'amber' },
  PERSONEL: { metin: 'Personel', ton: 'notr' },
  ORTAK: { metin: 'Ortak', ton: 'notr' },
  DIGER: { metin: 'Diğer', ton: 'notr' },
};

function YeniCariFormu({ onKaydedildi, onVazgec }) {
  const [form, setForm] = useState({
    tip: 'TEDARIKCI', vergi_no: '', unvan: '', vergi_dairesi: '', adres: '', telefon: '', email: '',
  });
  const [sorgulaniyor, setSorgulaniyor] = useState(false);
  const [sorguSonucu, setSorguSonucu] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [hata, setHata] = useState(null);

  function alaniGuncelle(alan, deger) {
    setForm((f) => ({ ...f, [alan]: deger }));
  }

  async function vergiNoSorgula() {
    if (!form.vergi_no.trim()) return;
    setSorgulaniyor(true);
    setSorguSonucu(null);
    setHata(null);
    try {
      const { data } = await api.post('/cariler/vergi-no-sorgula', { vergi_no: form.vergi_no });
      setSorguSonucu(data);
      if (data.bulundu) {
        setForm((f) => ({
          ...f,
          unvan: data.unvan ?? f.unvan,
          vergi_dairesi: data.vergi_dairesi ?? f.vergi_dairesi,
          adres: data.adres ?? f.adres,
          telefon: data.telefon ?? f.telefon,
        }));
      }
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setSorgulaniyor(false);
    }
  }

  async function kaydet(e) {
    e.preventDefault();
    setKaydediliyor(true);
    setHata(null);
    try {
      await api.post('/cariler', { ...form, otomatik_dolduruldu: !!sorguSonucu?.bulundu });
      onKaydedildi();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  return (
    <Kart style={{ marginBottom: 20 }}>
      <form onSubmit={kaydet}>
        <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 16 }}>Yeni cari kartı</div>
        <HataMesaji>{hata}</HataMesaji>

        <Alan etiket="Cari tipi">
          <select value={form.tip} onChange={(e) => alaniGuncelle('tip', e.target.value)} style={girdiStili}>
            <option value="TEDARIKCI">Tedarikçi</option>
            <option value="MUSTERI">Müşteri</option>
            <option value="PERSONEL">Personel</option>
            <option value="ORTAK">Ortak</option>
            <option value="DIGER">Diğer</option>
          </select>
        </Alan>

        <Alan etiket="Vergi no / TC kimlik no">
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={form.vergi_no}
              onChange={(e) => alaniGuncelle('vergi_no', e.target.value)}
              placeholder="1234567890"
              style={girdiStili}
            />
            <Buton type="button" variant="ikincil" onClick={vergiNoSorgula} disabled={sorgulaniyor}>
              {sorgulaniyor ? 'Sorgulanıyor...' : 'Sorgula'}
            </Buton>
          </div>
          {sorguSonucu && (
            <div style={{ marginTop: 6 }}>
              {sorguSonucu.bulundu
                ? <Etiket ton="yesil">Bulundu — bilgiler otomatik dolduruldu</Etiket>
                : <Etiket ton="amber">Bulunamadı — bilgileri elle girin (yurt dışı tedarikçilerde normaldir)</Etiket>}
            </div>
          )}
        </Alan>

        <Alan etiket="Unvan">
          <input
            required
            value={form.unvan}
            onChange={(e) => alaniGuncelle('unvan', e.target.value)}
            style={girdiStili}
          />
        </Alan>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Alan etiket="Vergi dairesi">
              <input
                value={form.vergi_dairesi}
                onChange={(e) => alaniGuncelle('vergi_dairesi', e.target.value)}
                style={girdiStili}
              />
            </Alan>
          </div>
          <div style={{ flex: 1 }}>
            <Alan etiket="Telefon">
              <input
                value={form.telefon}
                onChange={(e) => alaniGuncelle('telefon', e.target.value)}
                style={girdiStili}
              />
            </Alan>
          </div>
        </div>

        <Alan etiket="Adres">
          <input
            value={form.adres}
            onChange={(e) => alaniGuncelle('adres', e.target.value)}
            style={girdiStili}
          />
        </Alan>

        <Alan etiket="E-posta">
          <input
            type="email"
            value={form.email}
            onChange={(e) => alaniGuncelle('email', e.target.value)}
            style={girdiStili}
          />
        </Alan>

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <Buton type="submit" disabled={kaydediliyor}>
            {kaydediliyor ? 'Kaydediliyor...' : 'Cariyi kaydet'}
          </Buton>
          <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
        </div>
      </form>
    </Kart>
  );
}

export default function CarilerSayfasi() {
  const [cariler, setCariler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(null);
  const [formAcik, setFormAcik] = useState(false);
  const [arama, setArama] = useState('');

  function listeyiYukle() {
    setYukleniyor(true);
    api.get('/cariler', { params: arama ? { arama } : {} })
      .then((res) => setCariler(res.data))
      .catch((err) => setHata(hataMesajiCikar(err)))
      .finally(() => setYukleniyor(false));
  }

  useEffect(() => { listeyiYukle(); }, []); // eslint-disable-line

  return (
    <div>
      <SayfaBasligi
        baslik="Cari hesaplar"
        aciklama="Müşteri, tedarikçi, personel ve ortak kayıtları"
        eylem={!formAcik && <Buton onClick={() => setFormAcik(true)}>+ Yeni cari</Buton>}
      />

      <HataMesaji>{hata}</HataMesaji>

      {formAcik && (
        <YeniCariFormu
          onKaydedildi={() => { setFormAcik(false); listeyiYukle(); }}
          onVazgec={() => setFormAcik(false)}
        />
      )}

      <Kart style={{ padding: 0 }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--kenarlik)' }}>
          <input
            value={arama}
            onChange={(e) => setArama(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && listeyiYukle()}
            placeholder="Unvana göre ara..."
            style={{ ...girdiStili, maxWidth: 320 }}
          />
        </div>

        {yukleniyor ? (
          <div style={{ padding: 20, color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
        ) : cariler.length === 0 ? (
          <BosDurum baslik="Henüz cari kaydı yok" aciklama="Yukarıdan yeni bir cari ekleyin." />
        ) : (
          <table>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                {['Unvan', 'Tip', 'Vergi No', 'Telefon', 'Bakiye (TL)', 'Bakiye (USD)'].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>
                    {b}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cariler.map((c) => (
                <tr key={c.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 500 }}>{c.unvan}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <Etiket ton={TIP_ETIKET[c.tip]?.ton}>{TIP_ETIKET[c.tip]?.metin}</Etiket>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--metin-ikincil)' }}>{c.vergi_no || '—'}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--metin-ikincil)' }}>{c.telefon || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>{paraFormat(c.bakiye_try, 'TRY')}</td>
                  <td style={{ padding: '12px 16px' }}>{paraFormat(c.bakiye_usd, 'USD')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Kart>
    </div>
  );
}
