import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, hataMesajiCikar } from '../api/client';
import { HataMesaji } from '../components/Ortak';
import BelgeSablonu from '../components/BelgeSablonu';

const API_TABAN_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function ProformaBelgeSayfasi() {
  const { proformaId } = useParams();
  const { oturum } = useAuth();

  const [proforma, setProforma] = useState(null);
  const [cari, setCari] = useState(null);
  const [notlar, setNotlar] = useState('');
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  function yukle() {
    api.get(`/proforma-faturalar/${proformaId}`)
      .then((r) => {
        setProforma(r.data);
        setNotlar(r.data.notlar || '');
        return api.get('/cariler').then((cr) => {
          const c = cr.data.find((x) => x.id === r.data.cari_id);
          setCari(c || null);
        });
      })
      .catch((err) => setHata(hataMesajiCikar(err)));
  }
  useEffect(yukle, [proformaId]); // eslint-disable-line

  async function notuKaydet() {
    setKaydediliyor(true);
    try {
      await api.put(`/proforma-faturalar/${proformaId}/notlar`, { notlar });
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  if (hata) return <div style={{ maxWidth: 800, margin: '20px auto' }}><HataMesaji>{hata}</HataMesaji></div>;
  if (!proforma) return <div style={{ padding: 20, color: '#888' }}>Yükleniyor...</div>;

  const sirketId = oturum?.aktifSirketId;
  const sirketAdi = oturum?.sirketler?.find((s) => s.id === sirketId)?.unvan || '';
  const logoUrl = sirketId ? `${API_TABAN_URL}/sirketler/${sirketId}/logo` : null;

  const kalemlerBaslangic = (proforma.kalemler || []).map((k) => ({
    aciklama: k.aciklama || '',
    miktar: k.miktar,
    birimFiyat: k.birim_fiyat,
    kdvOrani: k.kdv_orani,
  }));

  return (
    <BelgeSablonu
      geriYolu="/proforma-fatura"
      belgeBasligi="Proforma Fatura"
      belgeNo={proforma.proforma_no}
      tarih={proforma.tarih}
      sirketAdi={sirketAdi}
      logoUrl={logoUrl}
      karsiTarafBaslik="Müşteri"
      karsiTarafAdi={cari ? cari.unvan : `#${proforma.cari_id}`}
      ekBilgiler={[['Durum', proforma.durum === 'FATURALASTI' ? 'Faturalaştı' : proforma.durum === 'ONAYLANDI' ? 'Onaylandı' : 'Taslak']]}
      kalemlerBaslangic={kalemlerBaslangic}
      paraBirimi={proforma.para_birimi}
      notlar={notlar}
      notlarDegistir={setNotlar}
      notKaydediliyor={kaydediliyor}
      notuKaydet={notuKaydet}
      altYazi="Bu proforma teklif niteliğindedir, resmi fatura değildir. Kalem değişiklikleri sadece bu görünüm/yazdırma içindir."
    />
  );
}
