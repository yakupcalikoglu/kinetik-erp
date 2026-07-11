import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, hataMesajiCikar } from '../api/client';
import { HataMesaji } from '../components/Ortak';
import BelgeSablonu from '../components/BelgeSablonu';

const API_TABAN_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function FaturaBelgeSayfasi() {
  const { faturaId } = useParams();
  const { oturum } = useAuth();

  const [fatura, setFatura] = useState(null);
  const [cari, setCari] = useState(null);
  const [notlar, setNotlar] = useState('');
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  function yukle() {
    api.get(`/faturalar/${faturaId}`)
      .then((r) => {
        setFatura(r.data);
        setNotlar(r.data.notlar || '');
        return api.get('/cariler').then((cr) => {
          const c = cr.data.find((x) => x.id === r.data.cari_id);
          setCari(c || null);
        });
      })
      .catch((err) => setHata(hataMesajiCikar(err)));
  }
  useEffect(yukle, [faturaId]); // eslint-disable-line

  async function notuKaydet() {
    setKaydediliyor(true);
    try {
      await api.put(`/faturalar/${faturaId}/notlar`, { notlar });
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  if (hata) return <div style={{ maxWidth: 800, margin: '20px auto' }}><HataMesaji>{hata}</HataMesaji></div>;
  if (!fatura) return <div style={{ padding: 20, color: '#888' }}>Yükleniyor...</div>;

  const sirketId = oturum?.aktifSirketId;
  const sirketAdi = oturum?.sirketler?.find((s) => s.id === sirketId)?.unvan || '';
  const logoUrl = sirketId ? `${API_TABAN_URL}/sirketler/${sirketId}/logo` : null;

  const kalemlerBaslangic = (fatura.kalemler || []).map((k) => ({
    aciklama: k.aciklama || '',
    miktar: k.miktar,
    birimFiyat: k.birim_fiyat,
    kdvOrani: k.kdv_orani,
  }));

  return (
    <BelgeSablonu
      geriYolu="/proforma-fatura"
      belgeBasligi="Fatura"
      belgeNo={fatura.fatura_no}
      tarih={fatura.tarih}
      sirketAdi={sirketAdi}
      logoUrl={logoUrl}
      karsiTarafBaslik="Müşteri"
      karsiTarafAdi={cari ? cari.unvan : `#${fatura.cari_id}`}
      ekBilgiler={[['Ödeme durumu', fatura.odeme_durumu === 'ODENDI' ? 'Ödendi' : 'Ödenmedi']]}
      kalemlerBaslangic={kalemlerBaslangic}
      paraBirimi={fatura.para_birimi}
      notlar={notlar}
      notlarDegistir={setNotlar}
      notKaydediliyor={kaydediliyor}
      notuKaydet={notuKaydet}
      altYazi="Kalem değişiklikleri sadece bu görünüm/yazdırma içindir."
    />
  );
}
