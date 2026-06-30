import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, hataMesajiCikar } from '../api/client';
import { Kart, SayfaBasligi, Buton, Etiket, BosDurum, HataMesaji, paraFormat } from '../components/Ortak';

const DURUM_ETIKET = {
  TASLAK: 'notr', ONAYLANDI: 'amber', YOLDA: 'amber', GUMRUKTE: 'amber',
  TESLIM_ALINDI: 'yesil', TAMAMLANDI: 'yesil', IPTAL: 'kirmizi',
};

const DURUM_METIN = {
  TASLAK: 'Taslak', ONAYLANDI: 'Onaylandı', YOLDA: 'Yolda', GUMRUKTE: 'Gümrükte',
  TESLIM_ALINDI: 'Teslim Alındı', TAMAMLANDI: 'Tamamlandı', IPTAL: 'İptal',
};

export default function SiparislerSayfasi() {
  const location = useLocation();
  const [siparisler, setSiparisler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(null);
  const [bilgiMesaji, setBilgiMesaji] = useState(location.state?.yeniSiparisNo
    ? `${location.state.yeniSiparisNo} numaralı sipariş oluşturuldu.`
    : null);

  function listeyiYukle() {
    setYukleniyor(true);
    api.get('/siparisler')
      .then((res) => setSiparisler(res.data))
      .catch((err) => setHata(hataMesajiCikar(err)))
      .finally(() => setYukleniyor(false));
  }

  useEffect(() => { listeyiYukle(); }, []);

  async function durumDegistir(siparisId, yeniDurum) {
    try {
      await api.put(`/siparisler/${siparisId}/durum`, { durum: yeniDurum });
      listeyiYukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  async function pdfIndir(siparisId, siparisNo, nusha) {
    try {
      const { data } = await api.get(`/siparisler/${siparisId}/pdf`, {
        params: { nusha },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${siparisNo}_${nusha}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  async function kopyala(siparisId) {
    const yeniNo = window.prompt('Yeni sipariş numarası:');
    if (!yeniNo) return;
    try {
      await api.post(`/siparisler/${siparisId}/kopyala`, null, { params: { yeni_siparis_no: yeniNo } });
      setBilgiMesaji(`${yeniNo} numaralı yeni taslak oluşturuldu.`);
      listeyiYukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  return (
    <div>
      <SayfaBasligi
        baslik="Siparişler"
        aciklama="İthalat ve yurtiçi alım siparişleri"
        eylem={<Link to="/siparisler/yeni"><Buton>+ Yeni sipariş</Buton></Link>}
      />
      <HataMesaji>{hata}</HataMesaji>
      {bilgiMesaji && (
        <div style={{ background: 'var(--yesil-acik)', color: 'var(--yesil)', padding: '10px 14px', borderRadius: 7, fontSize: 13, marginBottom: 16 }}>
          {bilgiMesaji}
        </div>
      )}

      <Kart style={{ padding: 0 }}>
        {yukleniyor ? (
          <div style={{ padding: 20, color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
        ) : siparisler.length === 0 ? (
          <BosDurum baslik="Henüz sipariş yok" aciklama="Yukarıdan yeni bir sipariş oluşturun." />
        ) : (
          <table>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                {['Sipariş No', 'Kaynak', 'Tarih', 'Durum', 'Tutar', 'İşlem'].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {siparisler.map((s) => {
                const toplam = (s.urunler || []).reduce((acc, u) => acc + u.miktar * Number(u.birim_fiyat), 0);
                return (
                  <tr key={s.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 500 }}>{s.siparis_no}</td>
                    <td style={{ padding: '12px 16px' }}>{s.kaynak === 'ITHALAT' ? 'İthalat' : 'Yurtiçi Alım'}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--metin-ikincil)' }}>{s.siparis_tarihi}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <Etiket ton={DURUM_ETIKET[s.durum]}>{DURUM_METIN[s.durum]}</Etiket>
                    </td>
                    <td style={{ padding: '12px 16px' }}>{paraFormat(toplam, s.para_birimi)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {s.durum === 'TASLAK' && (
                          <button onClick={() => durumDegistir(s.id, 'ONAYLANDI')}
                            style={{ background: 'none', border: 'none', color: 'var(--lacivert)', fontSize: 13, fontWeight: 500 }}>
                            Onayla
                          </button>
                        )}
                        <button onClick={() => pdfIndir(s.id, s.siparis_no, 'ic')}
                          style={{ background: 'none', border: 'none', color: 'var(--lacivert)', fontSize: 13 }}>
                          PDF (şirket içi)
                        </button>
                        <button onClick={() => pdfIndir(s.id, s.siparis_no, 'tedarikci')}
                          style={{ background: 'none', border: 'none', color: 'var(--lacivert)', fontSize: 13 }}>
                          PDF (tedarikçi)
                        </button>
                        <button onClick={() => kopyala(s.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--metin-ikincil)', fontSize: 13 }}>
                          Kopyala
                        </button>
                      </div>
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
