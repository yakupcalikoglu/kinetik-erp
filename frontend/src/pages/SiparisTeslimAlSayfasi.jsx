import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, hataMesajiCikar } from '../api/client';
import { Kart, SayfaBasligi, Buton, Alan, girdiStili, HataMesaji } from '../components/Ortak';

const HEDEF_DURUM_METIN = {
  DEPODA: 'Depoda',
  ANTREPODA: 'Antrepoda',
  GUMRUKTE: 'Gümrükte',
  YOLDA: 'Yolda',
};

export default function SiparisTeslimAlSayfasi() {
  const { siparisId } = useParams();
  const navigate = useNavigate();
  const [siparis, setSiparis] = useState(null);
  const [satirlar, setSatirlar] = useState([]);
  const [hedefDurum, setHedefDurum] = useState('');
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [tamamlandi, setTamamlandi] = useState(null);

  useEffect(() => {
    api.get(`/siparisler/${siparisId}`)
      .then((res) => {
        setSiparis(res.data);
        setHedefDurum(res.data.kaynak === 'ITHALAT' ? 'GUMRUKTE' : 'DEPODA');
        // Her urun satiri icin miktar kadar seri no girisi olustur
        const acilanSatirlar = [];
        for (const urun of res.data.urunler) {
          for (let i = 0; i < urun.miktar; i++) {
            acilanSatirlar.push({
              siparis_detay_id: urun.id,
              seri_no: '',
              sasi_no: '',
              uretim_yili: '',
              garanti_bitis_tarihi: '',
              barkod: '',
            });
          }
        }
        setSatirlar(acilanSatirlar);
      })
      .catch((err) => setHata(hataMesajiCikar(err)));
  }, [siparisId]);

  function satirGuncelle(index, alan, deger) {
    setSatirlar((liste) => liste.map((s, i) => (i === index ? { ...s, [alan]: deger } : s)));
  }

  async function teslimAl(e) {
    e.preventDefault();
    setHata(null);

    if (satirlar.some((s) => !s.seri_no.trim())) {
      setHata('Her ürün için seri numarası girilmelidir.');
      return;
    }

    setKaydediliyor(true);
    try {
      const { data } = await api.post(`/siparisler/${siparisId}/teslim-al`, {
        hedef_durum: hedefDurum,
        urunler: satirlar.map((s) => ({
          siparis_detay_id: s.siparis_detay_id,
          seri_no: s.seri_no,
          sasi_no: s.sasi_no || null,
          uretim_yili: s.uretim_yili ? Number(s.uretim_yili) : null,
          garanti_bitis_tarihi: s.garanti_bitis_tarihi || null,
          barkod: s.barkod || null,
        })),
      });
      setTamamlandi(data);
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  if (!siparis) {
    return <HataMesaji>{hata}</HataMesaji>;
  }

  if (tamamlandi) {
    return (
      <div>
        <SayfaBasligi baslik="Teslim alma tamamlandı" />
        <Kart style={{ background: 'var(--yesil-acik)' }}>
          <div style={{ color: 'var(--yesil)', fontWeight: 600, marginBottom: 8 }}>
            {tamamlandi.length} adet ürün "{HEDEF_DURUM_METIN[hedefDurum]}" durumunda stoğa eklendi.
          </div>
          <div style={{ fontSize: 13, color: 'var(--metin-ikincil)', marginBottom: 14 }}>
            Oluşturulan stok kayıt ID'leri: {tamamlandi.join(', ')}
          </div>
          <Buton onClick={() => navigate('/stok')}>Stok ekranına git</Buton>
        </Kart>
      </div>
    );
  }

  return (
    <div>
      <SayfaBasligi
        baslik={`Teslim al — ${siparis.siparis_no}`}
        aciklama="Her ürün için gerçek seri numarasını girin; ürünler stok kaydına dönüştürülecek"
      />
      <form onSubmit={teslimAl}>
        <HataMesaji>{hata}</HataMesaji>

        <Kart style={{ marginBottom: 16 }}>
          <div style={{ maxWidth: 320 }}>
            <Alan etiket="Bu ürünler şu anda fiilen nerede? (hepsi bu durumda stoğa girecek)">
              <select value={hedefDurum} onChange={(e) => setHedefDurum(e.target.value)} style={girdiStili}>
                {Object.entries(HEDEF_DURUM_METIN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Alan>
          </div>
        </Kart>

        <Kart style={{ padding: 0 }}>
          <table>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                {['#', 'Sipariş Satırı', 'Seri No', 'Şasi No', 'Üretim Yılı', 'Garanti Bitiş', 'Barkod'].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)' }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {satirlar.map((s, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                  <td style={{ padding: '10px 16px' }}>{i + 1}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>Stok Kartı #{
                    siparis.urunler.find((u) => u.id === s.siparis_detay_id)?.stok_karti_id
                  }</td>
                  <td style={{ padding: 8 }}>
                    <input required value={s.seri_no} onChange={(e) => satirGuncelle(i, 'seri_no', e.target.value)}
                      placeholder="HC2026-00451" style={{ ...girdiStili, width: 160 }} />
                  </td>
                  <td style={{ padding: 8 }}>
                    <input value={s.sasi_no} onChange={(e) => satirGuncelle(i, 'sasi_no', e.target.value)}
                      style={{ ...girdiStili, width: 140 }} />
                  </td>
                  <td style={{ padding: 8 }}>
                    <input type="number" value={s.uretim_yili} onChange={(e) => satirGuncelle(i, 'uretim_yili', e.target.value)}
                      style={{ ...girdiStili, width: 90 }} />
                  </td>
                  <td style={{ padding: 8 }}>
                    <input type="date" value={s.garanti_bitis_tarihi} onChange={(e) => satirGuncelle(i, 'garanti_bitis_tarihi', e.target.value)}
                      style={{ ...girdiStili, width: 140 }} />
                  </td>
                  <td style={{ padding: 8 }}>
                    <input value={s.barkod} onChange={(e) => satirGuncelle(i, 'barkod', e.target.value)}
                      style={{ ...girdiStili, width: 130 }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Kart>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : 'Teslim alındı olarak işaretle'}</Buton>
          <Buton type="button" variant="ikincil" onClick={() => navigate('/siparisler')}>Vazgeç</Buton>
        </div>
      </form>
    </div>
  );
}
