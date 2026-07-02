import { useEffect, useState } from 'react';
import { api, hataMesajiCikar } from '../api/client';
import { Kart, SayfaBasligi, Buton, Alan, girdiStili, Etiket, BosDurum, HataMesaji, paraFormat } from '../components/Ortak';

const DURUM_ETIKET = {
  DEPODA: 'yesil', SIPARISTE: 'notr', YOLDA: 'amber', GUMRUKTE: 'amber',
  ANTREPODA: 'amber', SATILDI: 'notr', KIRADA: 'notr', BAKIMDA: 'kirmizi', HURDA: 'kirmizi',
};

const DURUM_METIN = {
  DEPODA: 'Depoda', SIPARISTE: 'Siparişte', YOLDA: 'Yolda', GUMRUKTE: 'Gümrükte',
  ANTREPODA: 'Antrepoda', SATILDI: 'Satıldı', KIRADA: 'Kirada', BAKIMDA: 'Bakımda', HURDA: 'Hurda',
};

function YeniStokKartiFormu({ onKaydedildi, onVazgec }) {
  const [form, setForm] = useState({ marka: '', model: '', birim: 'ADET', birim_agirlik_kg: '', aciklama: '', mense_ulke: '', gtip_kodu: '' });
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [olusturulanId, setOlusturulanId] = useState(null);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      const { data } = await api.post('/stok-kartlari', {
        ...form,
        birim_agirlik_kg: form.birim_agirlik_kg ? Number(form.birim_agirlik_kg) : null,
      });
      setOlusturulanId(data.id);
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  if (olusturulanId) {
    return (
      <Kart style={{ marginBottom: 20, background: 'var(--yesil-acik)' }}>
        <div style={{ color: 'var(--yesil)', fontWeight: 600, marginBottom: 6 }}>
          Stok kartı oluşturuldu — ID: {olusturulanId}
        </div>
        <div style={{ fontSize: 13, color: 'var(--metin-ikincil)', marginBottom: 12 }}>
          Bu ID'yi sipariş oluştururken "Stok Kartı ID" alanına girin.
        </div>
        <Buton variant="ikincil" onClick={onKaydedildi}>Kapat</Buton>
      </Kart>
    );
  }

  return (
    <Kart style={{ marginBottom: 20 }}>
      <form onSubmit={kaydet}>
        <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 14 }}>Yeni stok kartı</div>
        <HataMesaji>{hata}</HataMesaji>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
          <Alan etiket="Marka">
            <input required value={form.marka} onChange={(e) => setForm((f) => ({ ...f, marka: e.target.value }))} style={girdiStili} />
          </Alan>
          <Alan etiket="Model">
            <input required value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} style={girdiStili} />
          </Alan>
          <Alan etiket="Birim">
            <input value={form.birim} onChange={(e) => setForm((f) => ({ ...f, birim: e.target.value }))} style={girdiStili} />
          </Alan>
          <Alan etiket="Birim ağırlık (kg)">
            <input type="number" step="0.1" value={form.birim_agirlik_kg} onChange={(e) => setForm((f) => ({ ...f, birim_agirlik_kg: e.target.value }))} style={girdiStili} />
          </Alan>
        </div>
        <Alan etiket="Açıklama">
          <input value={form.aciklama} onChange={(e) => setForm((f) => ({ ...f, aciklama: e.target.value }))} style={girdiStili} />
        </Alan>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : 'Stok kartı oluştur'}</Buton>
          <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
        </div>
      </form>
    </Kart>
  );
}

export default function StokSayfasi() {
  const [urunler, setUrunler] = useState([]);
  const [stokKartlari, setStokKartlari] = useState([]);
  const [durumFiltre, setDurumFiltre] = useState('');
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(null);
  const [formAcik, setFormAcik] = useState(false);

  function urunleriYukle() {
    setYukleniyor(true);
    api.get('/stok-seri-no', { params: durumFiltre ? { durum: durumFiltre } : {} })
      .then((res) => setUrunler(res.data))
      .catch((err) => setHata(hataMesajiCikar(err)))
      .finally(() => setYukleniyor(false));
  }

  useEffect(() => {
    urunleriYukle();
    api.get('/stok-kartlari').then((r) => setStokKartlari(r.data)).catch(() => {});
  }, [durumFiltre]);

  return (
    <div>
      <SayfaBasligi
        baslik="Stok"
        aciklama="Seri numarası bazlı ürün takibi ve maliyet dökümü"
        eylem={!formAcik && <Buton onClick={() => setFormAcik(true)}>+ Yeni stok kartı</Buton>}
      />
      <HataMesaji>{hata}</HataMesaji>

      {formAcik && (
        <YeniStokKartiFormu
          onKaydedildi={() => { setFormAcik(false); api.get('/stok-kartlari').then((r) => setStokKartlari(r.data)); }}
          onVazgec={() => setFormAcik(false)}
        />
      )}

      {stokKartlari.length > 0 && (
        <Kart style={{ marginBottom: 16, padding: 0 }}>
          <div style={{ padding: '12px 16px', fontWeight: 600, fontSize: 13.5, borderBottom: '1px solid var(--kenarlik)' }}>
            Tanımlı stok kartları ({stokKartlari.length})
          </div>
          <table>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                {['ID', 'Marka', 'Model', 'Birim Ağırlık'].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '8px 16px', fontSize: 12, color: 'var(--metin-ikincil)' }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stokKartlari.map((sk) => (
                <tr key={sk.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                  <td style={{ padding: '8px 16px', fontFamily: 'var(--font-mono)' }}>{sk.id}</td>
                  <td style={{ padding: '8px 16px' }}>{sk.marka}</td>
                  <td style={{ padding: '8px 16px' }}>{sk.model}</td>
                  <td style={{ padding: '8px 16px' }}>{sk.birim_agirlik_kg ? `${sk.birim_agirlik_kg} kg` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Kart>
      )}

      <Kart style={{ padding: 0 }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--kenarlik)' }}>
          <select value={durumFiltre} onChange={(e) => setDurumFiltre(e.target.value)} style={{ ...girdiStili, maxWidth: 220 }}>
            <option value="">Tüm durumlar</option>
            {Object.entries(DURUM_METIN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {yukleniyor ? (
          <div style={{ padding: 20, color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
        ) : urunler.length === 0 ? (
          <BosDurum baslik="Bu filtrede ürün bulunamadı" />
        ) : (
          <table>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                {['Seri No', 'Durum', 'Toplam Maliyet', 'Satış Fiyatı', 'Kâr/Zarar'].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {urunler.map((u) => {
                const karZarar = u.satis_fiyati_try != null ? u.satis_fiyati_try - u.toplam_maliyet_try : null;
                return (
                  <tr key={u.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>{u.seri_no}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <Etiket ton={DURUM_ETIKET[u.durum]}>{DURUM_METIN[u.durum]}</Etiket>
                    </td>
                    <td style={{ padding: '12px 16px' }}>{paraFormat(u.toplam_maliyet_try)}</td>
                    <td style={{ padding: '12px 16px' }}>{u.satis_fiyati_try != null ? paraFormat(u.satis_fiyati_try) : '—'}</td>
                    <td style={{ padding: '12px 16px', color: karZarar == null ? 'var(--metin-soluk)' : karZarar >= 0 ? 'var(--yesil)' : 'var(--kirmizi)', fontWeight: 500 }}>
                      {karZarar != null ? paraFormat(karZarar) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Kart>
    </div>
  );
}
