import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, hataMesajiCikar } from '../api/client';
import { Kart, SayfaBasligi, Buton, Etiket, BosDurum, HataMesaji, paraFormat, eylemChipStili } from '../components/Ortak';

const DURUM_ETIKET = {
  TASLAK: 'notr', ONAYLANDI: 'amber', YOLDA: 'amber', GUMRUKTE: 'amber',
  TESLIM_ALINDI: 'yesil', TAMAMLANDI: 'yesil', IPTAL: 'kirmizi',
};

const DURUM_METIN = {
  TASLAK: 'Taslak', ONAYLANDI: 'Onaylandı', YOLDA: 'Yolda', GUMRUKTE: 'Gümrükte',
  TESLIM_ALINDI: 'Teslim Alındı', TAMAMLANDI: 'Tamamlandı', IPTAL: 'İptal',
};

// Sadece kesinlesmis (Tamamlandi) veya iptal edilmis siparislerde
// Duzenle/Sil gizlenir - digerlerinde her zaman erisilebilir.
const DUZENLEME_KAPALI_DURUMLAR = ['TAMAMLANDI', 'IPTAL'];

export default function SiparislerSayfasi() {
  const location = useLocation();
  const [siparisler, setSiparisler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(null);
  const [bilgiMesaji, setBilgiMesaji] = useState(
    location.state?.yeniSiparisNo
      ? location.state.guncellendiMi
        ? `${location.state.yeniSiparisNo} numaralı sipariş güncellendi.`
        : `${location.state.yeniSiparisNo} numaralı sipariş oluşturuldu.`
      : null
  );

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

  async function siparisiSil(siparisId, siparisNo) {
    if (!window.confirm(`${siparisNo} numaralı siparişi silmek istediğinize emin misiniz?`)) return;
    try {
      await api.delete(`/siparisler/${siparisId}`);
      setBilgiMesaji(`${siparisNo} numaralı sipariş silindi.`);
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
                const duzenlenebilir = !DUZENLEME_KAPALI_DURUMLAR.includes(s.durum);
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
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {s.durum === 'TASLAK' && (
                          <button onClick={() => durumDegistir(s.id, 'ONAYLANDI')} style={eylemChipStili('lacivert')}>
                            Onayla
                          </button>
                        )}
                        {(s.durum === 'ONAYLANDI' || s.durum === 'YOLDA' || s.durum === 'GUMRUKTE') && (
                          <Link to={`/siparisler/${s.id}/teslim-al`} style={eylemChipStili('yesil')}>
                            Teslim al
                          </Link>
                        )}
                        {duzenlenebilir && (
                          <>
                            <Link to={`/siparisler/${s.id}/duzenle`} style={eylemChipStili('lacivert')}>
                              Düzenle
                            </Link>
                            <button onClick={() => siparisiSil(s.id, s.siparis_no)} style={eylemChipStili('kirmizi')}>
                              Sil
                            </button>
                          </>
                        )}
                        <button onClick={() => pdfIndir(s.id, s.siparis_no, 'ic')} style={eylemChipStili('notr')}>
                          PDF (şirket içi)
                        </button>
                        <button onClick={() => pdfIndir(s.id, s.siparis_no, 'tedarikci')} style={eylemChipStili('notr')}>
                          PDF (tedarikçi)
                        </button>
                        <button onClick={() => kopyala(s.id)} style={eylemChipStili('notr')}>
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
