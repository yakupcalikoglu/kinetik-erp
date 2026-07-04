import { useEffect, useState } from 'react';
import { api, hataMesajiCikar } from '../api/client';
import { Kart, SayfaBasligi, Buton, Alan, girdiStili, HataMesaji, eylemChipStili, BosDurum } from '../components/Ortak';

export default function HarcamaTurleriSayfasi() {
  const [liste, setListe] = useState([]);
  const [yeniAd, setYeniAd] = useState('');
  const [duzenlenenId, setDuzenlenenId] = useState(null);
  const [duzenlenenAd, setDuzenlenenAd] = useState('');
  const [hata, setHata] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  function yukle() {
    setYukleniyor(true);
    api.get('/harcama-turleri')
      .then((r) => setListe(r.data))
      .catch((e) => setHata(hataMesajiCikar(e)))
      .finally(() => setYukleniyor(false));
  }
  useEffect(yukle, []);

  async function ekle(e) {
    e.preventDefault();
    setHata(null);
    try {
      await api.post('/harcama-turleri', { ad: yeniAd });
      setYeniAd('');
      yukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  function duzenlemeyeBasla(kayit) {
    setDuzenlenenId(kayit.id);
    setDuzenlenenAd(kayit.ad);
  }

  async function guncelle(id) {
    setHata(null);
    try {
      await api.put(`/harcama-turleri/${id}`, { ad: duzenlenenAd });
      setDuzenlenenId(null);
      yukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  async function sil(kayit) {
    if (!window.confirm(`"${kayit.ad}" harcama türünü silmek istediğinize emin misiniz?`)) return;
    try {
      await api.delete(`/harcama-turleri/${kayit.id}`);
      yukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  return (
    <div>
      <SayfaBasligi
        baslik="Harcama Türleri"
        aciklama="Bakım, sabit gider ve diğer açıklama alanlarında otomatik tamamlama için kullanılan liste"
      />
      <HataMesaji>{hata}</HataMesaji>

      <Kart style={{ marginBottom: 16 }}>
        <form onSubmit={ekle} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <Alan etiket="Yeni harcama türü">
              <input required value={yeniAd} onChange={(e) => setYeniAd(e.target.value)} placeholder="Örn: Sigorta" style={girdiStili} />
            </Alan>
          </div>
          <Buton type="submit" style={{ marginBottom: 14 }}>+ Ekle</Buton>
        </form>
      </Kart>

      <Kart style={{ padding: 0 }}>
        {yukleniyor ? (
          <div style={{ padding: 20, color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
        ) : liste.length === 0 ? (
          <BosDurum baslik="Henüz harcama türü yok" />
        ) : (
          <table>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                {['Ad', 'İşlem'].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {liste.map((k) => (
                <tr key={k.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                  <td style={{ padding: '10px 16px' }}>
                    {duzenlenenId === k.id ? (
                      <input value={duzenlenenAd} onChange={(e) => setDuzenlenenAd(e.target.value)} style={girdiStili} />
                    ) : (
                      k.ad
                    )}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {duzenlenenId === k.id ? (
                        <>
                          <button onClick={() => guncelle(k.id)} style={eylemChipStili('yesil')}>Kaydet</button>
                          <button onClick={() => setDuzenlenenId(null)} style={eylemChipStili('notr')}>Vazgeç</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => duzenlemeyeBasla(k)} style={eylemChipStili('lacivert')}>Düzenle</button>
                          <button onClick={() => sil(k)} style={eylemChipStili('kirmizi')}>Sil</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Kart>
    </div>
  );
}
