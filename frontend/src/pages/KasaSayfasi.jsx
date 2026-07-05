import { useEffect, useState, Fragment } from 'react';
import { api, hataMesajiCikar } from '../api/client';
import { Kart, SayfaBasligi, Buton, Alan, girdiStili, HataMesaji, paraFormat } from '../components/Ortak';

function KaynakDetayi({ kaynakTablo, kaynakId }) {
  const [detay, setDetay] = useState(null);
  const [hata, setHata] = useState(null);

  useEffect(() => {
    api.get(`/kaynak-detay/${kaynakTablo}/${kaynakId}`)
      .then((r) => setDetay(r.data))
      .catch((e) => setHata(hataMesajiCikar(e)));
  }, [kaynakTablo, kaynakId]);

  if (hata) return <div style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--kirmizi)' }}>{hata}</div>;
  if (!detay) return <div style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--metin-soluk)' }}>Yükleniyor...</div>;

  return (
    <div style={{ padding: '12px 16px', background: 'var(--zemin)', fontSize: 13 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{detay.baslik}</div>
      {detay.detaylar.map(([etiket, deger]) => (
        <div key={etiket} style={{ display: 'flex', gap: 8, color: 'var(--metin-ikincil)' }}>
          <span style={{ minWidth: 130 }}>{etiket}:</span>
          <span style={{ color: 'var(--metin-birincil)' }}>{deger}</span>
        </div>
      ))}
    </div>
  );
}

function YeniKasaHareketiFormu({ onKaydedildi, onVazgec }) {
  const [form, setForm] = useState({
    tarih: new Date().toISOString().slice(0, 10), yon: 'GIRIS', tutar: '', para_birimi: 'TRY',
    tutar_try_karsiligi: '', aciklama: '',
  });
  const [kurYukleniyor, setKurYukleniyor] = useState(false);
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => {
    if (form.para_birimi === 'TRY') {
      setForm((f) => ({ ...f, tutar_try_karsiligi: '' }));
      return;
    }
    if (form.para_birimi === 'ALTIN') return;
    setKurYukleniyor(true);
    api.get(`/kur/${form.para_birimi}`)
      .then((r) => {
        const kur = Number(r.data.kur);
        const tutarSayi = Number(form.tutar) || 0;
        setForm((f) => ({ ...f, tutar_try_karsiligi: (tutarSayi * kur).toFixed(2) }));
      })
      .catch(() => {})
      .finally(() => setKurYukleniyor(false));
  }, [form.para_birimi]); // eslint-disable-line

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      await api.post('/kasa-hareketleri', {
        ...form,
        tutar: Number(form.tutar),
        tutar_try_karsiligi: form.para_birimi === 'TRY' ? null : Number(form.tutar_try_karsiligi),
      });
      onKaydedildi();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  return (
    <Kart style={{ marginBottom: 16 }}>
      <form onSubmit={kaydet}>
        <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 14 }}>Yeni kasa hareketi</div>
        <HataMesaji>{hata}</HataMesaji>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
          <Alan etiket="Tarih">
            <input required type="date" value={form.tarih} onChange={(e) => setForm((f) => ({ ...f, tarih: e.target.value }))} style={girdiStili} />
          </Alan>
          <Alan etiket="Yön">
            <select value={form.yon} onChange={(e) => setForm((f) => ({ ...f, yon: e.target.value }))} style={girdiStili}>
              <option value="GIRIS">Giriş</option>
              <option value="CIKIS">Çıkış</option>
            </select>
          </Alan>
          <Alan etiket="Para birimi">
            <select value={form.para_birimi} onChange={(e) => setForm((f) => ({ ...f, para_birimi: e.target.value }))} style={girdiStili}>
              <option value="TRY">TRY</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="ALTIN">ALTIN</option>
            </select>
          </Alan>
          <Alan etiket="Tutar">
            <input required type="number" step="0.01" value={form.tutar} onChange={(e) => setForm((f) => ({ ...f, tutar: e.target.value }))} style={girdiStili} />
          </Alan>
          {form.para_birimi !== 'TRY' && (
            <Alan etiket={kurYukleniyor ? 'TL karşılığı (kur yükleniyor...)' : 'TL karşılığı (otomatik, elle değiştirilebilir)'}>
              <input required type="number" step="0.01" value={form.tutar_try_karsiligi} onChange={(e) => setForm((f) => ({ ...f, tutar_try_karsiligi: e.target.value }))} style={girdiStili} />
            </Alan>
          )}
          <Alan etiket="Açıklama">
            <input value={form.aciklama} onChange={(e) => setForm((f) => ({ ...f, aciklama: e.target.value }))} style={girdiStili} />
          </Alan>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : 'Hareketi kaydet'}</Buton>
          <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
        </div>
      </form>
    </Kart>
  );
}

export default function KasaSayfasi() {
  const [kasaBakiye, setKasaBakiye] = useState(null);
  const [kasaHareketleri, setKasaHareketleri] = useState([]);
  const [yonFiltre, setYonFiltre] = useState('');
  const [paraBirimiFiltre, setParaBirimiFiltre] = useState('');
  const [hata, setHata] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [formAcik, setFormAcik] = useState(false);
  const [acikDetayId, setAcikDetayId] = useState(null);

  function yukle() {
    setYukleniyor(true);
    Promise.all([
      api.get('/kasa-bakiye'),
      api.get('/kasa-hareketleri'),
    ])
      .then(([bakiyeRes, hareketRes]) => {
        setKasaBakiye(bakiyeRes.data);
        setKasaHareketleri(hareketRes.data);
      })
      .catch((err) => setHata(hataMesajiCikar(err)))
      .finally(() => setYukleniyor(false));
  }

  useEffect(yukle, []);

  function satiraTikla(h) {
    if (!h.kaynak_tablo || !h.kaynak_id) return;
    setAcikDetayId((mevcut) => (mevcut === h.id ? null : h.id));
  }

  let gosterilecekHareketler = kasaHareketleri;
  if (yonFiltre) gosterilecekHareketler = gosterilecekHareketler.filter((h) => h.yon === yonFiltre);
  if (paraBirimiFiltre) gosterilecekHareketler = gosterilecekHareketler.filter((h) => h.para_birimi === paraBirimiFiltre);

  return (
    <div>
      <SayfaBasligi baslik="Ana Kasa" aciklama="Nakit giriş/çıkış hareketleri (çoklu para birimi)" />
      <HataMesaji>{hata}</HataMesaji>

      {kasaBakiye && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          {kasaBakiye.bakiyeler.map((b) => (
            <Kart key={b.para_birimi} style={{ flex: '1 1 160px', background: 'var(--lacivert)', color: 'white' }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>{b.para_birimi} bakiyesi</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{paraFormat(b.net_bakiye, b.para_birimi)}</div>
            </Kart>
          ))}
          <Kart style={{ flex: '1 1 200px', background: 'var(--lacivert-koyu, #0f2340)', color: 'white' }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>Toplam (TL karşılığı)</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{paraFormat(kasaBakiye.net_bakiye_try_toplam)}</div>
          </Kart>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <Alan etiket="Yöne göre filtrele">
            <select value={yonFiltre} onChange={(e) => setYonFiltre(e.target.value)} style={{ ...girdiStili, minWidth: 150 }}>
              <option value="">Tümü</option>
              <option value="GIRIS">Giriş</option>
              <option value="CIKIS">Çıkış</option>
            </select>
          </Alan>
          <Alan etiket="Para birimine göre filtrele">
            <select value={paraBirimiFiltre} onChange={(e) => setParaBirimiFiltre(e.target.value)} style={{ ...girdiStili, minWidth: 150 }}>
              <option value="">Tümü</option>
              <option value="TRY">TRY</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="ALTIN">ALTIN</option>
            </select>
          </Alan>
        </div>
        <Buton onClick={() => setFormAcik((a) => !a)}>{formAcik ? 'Kapat' : '+ Yeni kasa hareketi'}</Buton>
      </div>

      {formAcik && (
        <YeniKasaHareketiFormu onKaydedildi={() => { setFormAcik(false); yukle(); }} onVazgec={() => setFormAcik(false)} />
      )}

      <Kart style={{ padding: 0 }}>
        {yukleniyor ? (
          <div style={{ padding: 20, color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
        ) : gosterilecekHareketler.length === 0 ? (
          <div style={{ padding: 20, color: 'var(--metin-soluk)' }}>Bu filtrede kasa hareketi yok.</div>
        ) : (
          <table>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                {['Tarih', 'Yön', 'Tutar', 'TL Karşılığı', 'Açıklama'].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gosterilecekHareketler.map((h) => {
                const tiklanabilir = !!(h.kaynak_tablo && h.kaynak_id);
                return (
                  <Fragment key={h.id}>
                    <tr
                      onClick={() => satiraTikla(h)}
                      style={{
                        borderTop: '1px solid var(--kenarlik)',
                        cursor: tiklanabilir ? 'pointer' : 'default',
                        background: acikDetayId === h.id ? 'var(--zemin)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{h.tarih}</td>
                      <td style={{ padding: '10px 16px' }}>{h.yon === 'GIRIS' ? 'Giriş' : 'Çıkış'}</td>
                      <td style={{ padding: '10px 16px', fontWeight: 500, color: h.yon === 'GIRIS' ? 'var(--yesil)' : 'var(--kirmizi)' }}>
                        {paraFormat(h.tutar, h.para_birimi)}
                      </td>
                      <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>
                        {h.tutar_try_karsiligi != null ? paraFormat(h.tutar_try_karsiligi) : '—'}
                      </td>
                      <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>
                        {h.aciklama || '—'}
                        {tiklanabilir && (
                          <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--lacivert)' }}>
                            {acikDetayId === h.id ? '▲ detayı gizle' : '▼ detay göster'}
                          </span>
                        )}
                      </td>
                    </tr>
                    {acikDetayId === h.id && (
                      <tr>
                        <td colSpan={5} style={{ padding: 0 }}>
                          <KaynakDetayi kaynakTablo={h.kaynak_tablo} kaynakId={h.kaynak_id} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </Kart>
    </div>
  );
}
