import { useEffect, useState, Fragment } from 'react';
import { api, hataMesajiCikar, ozelOnayIste, geriAlBildirimGoster } from '../../api/client';
import { Kart, Buton, Etiket, Alan, girdiStili, BosDurum, HataMesaji, paraFormat, eylemChipStili } from '../Ortak';
import { tarihFormat } from './Ortak';

function PosTaksitYatirFormu({ taksit, onKaydedildi, onVazgec }) {
  const [tarih, setTarih] = useState(new Date().toISOString().slice(0, 10));
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      await api.put(`/pos-taksit-detay/${taksit.id}/yatir`, { yatma_tarihi: tarih });
      onKaydedildi();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  return (
    <tr>
      <td colSpan={4} style={{ padding: 0 }}>
        <div style={{ padding: 12, background: 'white', border: '1px solid var(--kenarlik)', borderRadius: 7, margin: '4px 0' }}>
          <form onSubmit={kaydet} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <HataMesaji>{hata}</HataMesaji>
            <Alan etiket="Hesaba yattığı tarih">
              <input required type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} style={girdiStili} />
            </Alan>
            <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : 'Hesaba Yattı Olarak İşaretle'}</Buton>
            <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
          </form>
        </div>
      </td>
    </tr>
  );
}

function PosTaksitleriPaneli({ plan, onKapat }) {
  const [taksitler, setTaksitler] = useState(null);
  const [yatirAcikId, setYatirAcikId] = useState(null);
  const [hata, setHata] = useState(null);

  function yukle() {
    api.get(`/pos-taksit-planlari/${plan.id}/taksitler`).then((r) => setTaksitler(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }
  useEffect(yukle, [plan.id]); // eslint-disable-line

  async function geriAl(taksitId) {
    if (!(await ozelOnayIste('Bu taksidin hesaba yatma isaretini geri almak istediginize emin misiniz? Olusan Banka hareketi silinecek.'))) return;
    try {
      await api.put(`/pos-taksit-detay/${taksitId}/yatirmayi-geri-al`);
      yukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  return (
    <tr>
      <td colSpan={9} style={{ padding: 0 }}>
        <div style={{ padding: 14, background: 'var(--zemin)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              Taksitler — {plan.urun_adi || plan.urun_seri_no} ({plan.musteri_unvan || 'Müşteri'})
            </div>
            <Buton variant="ikincil" onClick={onKapat}>Kapat</Buton>
          </div>
          <HataMesaji>{hata}</HataMesaji>
          {taksitler === null ? (
            <div style={{ color: 'var(--metin-soluk)', fontSize: 13 }}>Yükleniyor...</div>
          ) : (
            <table>
              <thead>
                <tr style={{ background: 'white' }}>
                  {['Taksit No', 'Vade', 'Tutar', ''].map((b) => (
                    <th key={b} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 12, color: 'var(--metin-ikincil)' }}>{b}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {taksitler.map((t) => (
                  <Fragment key={t.id}>
                    <tr style={{ borderTop: '1px solid var(--kenarlik)' }}>
                      <td style={{ padding: '8px 10px' }}>{t.taksit_no}</td>
                      <td style={{ padding: '8px 10px' }}>{tarihFormat(t.vade_tarihi)}</td>
                      <td style={{ padding: '8px 10px' }}>{paraFormat(t.tutar)}</td>
                      <td style={{ padding: '8px 10px' }}>
                        {t.yatti_mi ? (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <Etiket ton="yesil">Hesaba Yattı ({tarihFormat(t.yatma_tarihi)})</Etiket>
                            <button onClick={() => geriAl(t.id)} style={eylemChipStili('kirmizi')}>Geri Al</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setYatirAcikId((mevcut) => (mevcut === t.id ? null : t.id))}
                            style={eylemChipStili('lacivert')}
                          >
                            {yatirAcikId === t.id ? 'Kapat' : 'Hesaba Yattı Olarak İşaretle'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {yatirAcikId === t.id && (
                      <PosTaksitYatirFormu
                        taksit={t}
                        onKaydedildi={() => { setYatirAcikId(null); yukle(); }}
                        onVazgec={() => setYatirAcikId(null)}
                      />
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function PosTaksitSekmesi() {
  const [liste, setListe] = useState([]);
  const [hata, setHata] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [acikPlanId, setAcikPlanId] = useState(null);

  function yukle() {
    setYukleniyor(true);
    api.get('/pos-taksit-planlari')
      .then((r) => setListe(r.data))
      .catch((e) => setHata(hataMesajiCikar(e)))
      .finally(() => setYukleniyor(false));
  }
  useEffect(yukle, []);

  async function planiSil(planId) {
    if (!(await ozelOnayIste('Bu plani silmek istediginize emin misiniz? Urun Depoda durumuna geri donecek.'))) return;
    try {
      await api.delete(`/pos-taksit-planlari/${planId}`);
      yukle();
      geriAlBildirimGoster('Kredi kartı taksit planı silindi.', async () => {
        await api.put(`/pos-taksit-planlari/${planId}/geri-getir`);
        yukle();
      });
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  return (
    <div>
      <div style={{ fontSize: 12.5, color: 'var(--metin-ikincil)', marginBottom: 14, padding: '10px 12px', background: 'var(--zemin)', borderRadius: 8 }}>
        Bu liste, müşterinin kredi kartıyla taksitli ödediği satışları gösterir. Satış anında tamamlanmış sayılır
        (müşteri size borçlu değil) — kart bankası tutarı size her ay parça parça yatırır. Her taksit gerçekten
        hesaba yattığında "Hesaba Yattı" ile işaretleyin.
      </div>
      <HataMesaji>{hata}</HataMesaji>
      <Kart style={{ padding: 0 }}>
        {yukleniyor ? (
          <div style={{ padding: 20, color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
        ) : liste.length === 0 ? (
          <BosDurum baslik="Henüz kredi kartı taksitli satış yok" aciklama="Satış Yap sayfasından 'Kredi Kartı → Taksitli' seçerek oluşturabilirsiniz." />
        ) : (
          <table>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                {['Ürün', 'Müşteri', 'Banka Hesabı', 'Toplam Tutar', 'Yatan', 'Kalan', 'Taksit Sayısı', 'Başlangıç', ''].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {liste.map((p) => (
                <Fragment key={p.id}>
                  <tr style={{ borderTop: '1px solid var(--kenarlik)' }}>
                    <td onClick={() => setAcikPlanId((m) => (m === p.id ? null : p.id))} style={{ padding: '10px 16px', fontWeight: 500, cursor: 'pointer' }}>
                      {p.urun_adi || p.urun_seri_no}
                      <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--lacivert)' }}>{acikPlanId === p.id ? '▲ kapat' : '▼ taksitler'}</span>
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{p.musteri_unvan || '—'}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{p.banka_adi || '—'}</td>
                    <td style={{ padding: '10px 16px' }}>{paraFormat(p.toplam_tutar)}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--yesil)' }}>{paraFormat(p.yatan_tutar)}</td>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: Number(p.kalan_tutar) > 0 ? 'var(--kirmizi)' : 'var(--yesil)' }}>
                      {paraFormat(p.kalan_tutar)}
                    </td>
                    <td style={{ padding: '10px 16px' }}>{p.taksit_sayisi}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{tarihFormat(p.baslangic_tarihi)}</td>
                    <td style={{ padding: '10px 16px' }}>
                      {Number(p.yatan_tutar) === 0 && (
                        <button onClick={() => planiSil(p.id)} style={eylemChipStili('kirmizi')}>Sil</button>
                      )}
                    </td>
                  </tr>
                  {acikPlanId === p.id && (
                    <PosTaksitleriPaneli plan={p} onKapat={() => setAcikPlanId(null)} />
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </Kart>
    </div>
  );
}
