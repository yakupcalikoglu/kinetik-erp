import { useEffect, useState } from 'react';
import { api, hataMesajiCikar } from '../api/client';
import { Kart, SayfaBasligi, Buton, Alan, girdiStili, HataMesaji, BosDurum, Etiket, paraFormat, eylemChipStili } from '../components/Ortak';

function bosKalem() {
  return { stok_karti_id: '', aciklama: '', miktar: 1, birim_fiyat: '', kdv_orani: 20 };
}

function useCariler() {
  const [cariler, setCariler] = useState([]);
  useEffect(() => {
    api.get('/cariler').then((r) => setCariler(r.data)).catch(() => {});
  }, []);
  return cariler;
}

function useStokKartlari() {
  const [kartlar, setKartlar] = useState([]);
  useEffect(() => {
    api.get('/stok-kartlari').then((r) => setKartlar(r.data)).catch(() => {});
  }, []);
  return kartlar;
}

const DURUM_TON = { TASLAK: 'notr', ONAYLANDI: 'amber', FATURALASTI: 'yesil' };
const DURUM_METIN = { TASLAK: 'Taslak', ONAYLANDI: 'Onaylandı', FATURALASTI: 'Faturalaştı' };

function GecmisProformalar({ cariler, yenidenYukleTetik, onGoruntule }) {
  const [liste, setListe] = useState([]);
  const [hata, setHata] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  function yukle() {
    setYukleniyor(true);
    api.get('/proforma-faturalar')
      .then((r) => setListe(r.data))
      .catch((e) => setHata(hataMesajiCikar(e)))
      .finally(() => setYukleniyor(false));
  }
  useEffect(yukle, [yenidenYukleTetik]); // eslint-disable-line

  function cariUnvani(id) {
    const c = cariler.find((x) => x.id === id);
    return c ? c.unvan : `#${id}`;
  }

  async function sil(proforma) {
    if (!window.confirm(`${proforma.proforma_no} numaralı proformayı silmek istediğinize emin misiniz?`)) return;
    try {
      await api.delete(`/proforma-faturalar/${proforma.id}`);
      yukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  return (
    <Kart style={{ padding: 0, marginTop: 20 }}>
      <div style={{ padding: '14px 16px', fontWeight: 600, fontSize: 14, borderBottom: '1px solid var(--kenarlik)' }}>
        Geçmiş proformalar
      </div>
      <HataMesaji>{hata}</HataMesaji>
      {yukleniyor ? (
        <div style={{ padding: 20, color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
      ) : liste.length === 0 ? (
        <BosDurum baslik="Henüz proforma oluşturulmadı" />
      ) : (
        <table>
          <thead>
            <tr style={{ background: 'var(--zemin)' }}>
              {['Proforma No', 'Cari', 'Tarih', 'Genel Toplam', 'Durum', 'İşlem'].map((b) => (
                <th key={b} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>{b}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {liste.map((p) => (
              <tr key={p.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                <td style={{ padding: '10px 16px', fontWeight: 500 }}>{p.proforma_no}</td>
                <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{cariUnvani(p.cari_id)}</td>
                <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{p.tarih}</td>
                <td style={{ padding: '10px 16px', fontWeight: 500 }}>{paraFormat(p.genel_toplam, p.para_birimi)}</td>
                <td style={{ padding: '10px 16px' }}><Etiket ton={DURUM_TON[p.durum]}>{DURUM_METIN[p.durum] || p.durum}</Etiket></td>
                <td style={{ padding: '10px 16px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => onGoruntule(p)} style={eylemChipStili('lacivert')}>Görüntüle</button>
                    {p.durum !== 'FATURALASTI' && (
                      <button onClick={() => sil(p)} style={eylemChipStili('kirmizi')}>Sil</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Kart>
  );
}

function GecmisFaturalar({ cariler, yenidenYukleTetik }) {
  const [liste, setListe] = useState([]);
  const [hata, setHata] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  function yukle() {
    setYukleniyor(true);
    api.get('/faturalar')
      .then((r) => setListe(r.data))
      .catch((e) => setHata(hataMesajiCikar(e)))
      .finally(() => setYukleniyor(false));
  }
  useEffect(yukle, [yenidenYukleTetik]); // eslint-disable-line

  function cariUnvani(id) {
    const c = cariler.find((x) => x.id === id);
    return c ? c.unvan : `#${id}`;
  }

  async function iptalEt(fatura) {
    if (!window.confirm(`${fatura.fatura_no} numaralı faturayı iptal etmek istediğinize emin misiniz? Bağlı proforma tekrar faturalaştırılabilir hale gelecek.`)) return;
    try {
      await api.delete(`/faturalar/${fatura.id}`);
      yukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  return (
    <Kart style={{ padding: 0, marginTop: 20 }}>
      <div style={{ padding: '14px 16px', fontWeight: 600, fontSize: 14, borderBottom: '1px solid var(--kenarlik)' }}>
        Faturalar
      </div>
      <HataMesaji>{hata}</HataMesaji>
      {yukleniyor ? (
        <div style={{ padding: 20, color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
      ) : liste.length === 0 ? (
        <BosDurum baslik="Henüz fatura oluşturulmadı" />
      ) : (
        <table>
          <thead>
            <tr style={{ background: 'var(--zemin)' }}>
              {['Fatura No', 'Cari', 'Tarih', 'Genel Toplam', 'İşlem'].map((b) => (
                <th key={b} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>{b}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {liste.map((f) => (
              <tr key={f.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                <td style={{ padding: '10px 16px', fontWeight: 500 }}>{f.fatura_no}</td>
                <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{cariUnvani(f.cari_id)}</td>
                <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{f.tarih}</td>
                <td style={{ padding: '10px 16px', fontWeight: 500 }}>{paraFormat(f.genel_toplam, f.para_birimi)}</td>
                <td style={{ padding: '10px 16px' }}>
                  <button onClick={() => iptalEt(f)} style={eylemChipStili('kirmizi')}>İptal Et</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Kart>
  );
}

export default function ProformaFaturaSayfasi() {
  const cariler = useCariler();
  const stokKartlari = useStokKartlari();
  const [form, setForm] = useState({
    proforma_no: '', cari_id: '', tarih: new Date().toISOString().slice(0, 10), para_birimi: 'TRY', notlar: '',
  });
  const [kalemler, setKalemler] = useState([bosKalem()]);

  useEffect(() => {
    api.get('/proforma-faturalar/sonraki-no')
      .then((r) => setForm((f) => (f.proforma_no ? f : { ...f, proforma_no: r.data.proforma_no })))
      .catch(() => {});
  }, []);
  const [olusanProforma, setOlusanProforma] = useState(null);
  const [faturaNo, setFaturaNo] = useState('');
  const [olusanFatura, setOlusanFatura] = useState(null);
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [gecmisYenidenYukleTetik, setGecmisYenidenYukleTetik] = useState(0);

  function kalemGuncelle(i, alan, deger) {
    setKalemler((liste) => liste.map((k, idx) => {
      if (idx !== i) return k;
      if (alan === 'stok_karti_id' && deger) {
        const kart = stokKartlari.find((s) => String(s.id) === String(deger));
        return {
          ...k,
          stok_karti_id: deger,
          aciklama: kart ? `${kart.marka} ${kart.model}` : k.aciklama,
        };
      }
      return { ...k, [alan]: deger };
    }));
  }

  const araToplam = kalemler.reduce((acc, k) => acc + (Number(k.miktar) || 0) * (Number(k.birim_fiyat) || 0), 0);
  const kdvToplam = kalemler.reduce((acc, k) => acc + (Number(k.miktar) || 0) * (Number(k.birim_fiyat) || 0) * ((Number(k.kdv_orani) || 0) / 100), 0);

  async function proformaOlustur(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      const { data } = await api.post('/proforma-faturalar', {
        ...form,
        cari_id: Number(form.cari_id),
        kalemler: kalemler.map((k) => ({
          stok_karti_id: k.stok_karti_id ? Number(k.stok_karti_id) : null,
          aciklama: k.aciklama, miktar: Number(k.miktar), birim_fiyat: Number(k.birim_fiyat), kdv_orani: Number(k.kdv_orani),
        })),
      });
      setOlusanProforma(data);
      setGecmisYenidenYukleTetik((t) => t + 1);
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  async function faturayaCevir() {
    if (!faturaNo.trim()) {
      setHata('Fatura numarası girin.');
      return;
    }
    setHata(null);
    try {
      const { data } = await api.post(`/proforma-faturalar/${olusanProforma.id}/faturaya-cevir`, null, {
        params: { fatura_no: faturaNo },
      });
      setOlusanFatura(data);
      setOlusanProforma((p) => ({ ...p, durum: 'FATURALASTI' }));
      setGecmisYenidenYukleTetik((t) => t + 1);
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  function yeniProformaBaslat() {
    setOlusanProforma(null);
    setOlusanFatura(null);
    setFaturaNo('');
    setForm({ proforma_no: '', cari_id: '', tarih: new Date().toISOString().slice(0, 10), para_birimi: 'TRY', notlar: '' });
    setKalemler([bosKalem()]);
    api.get('/proforma-faturalar/sonraki-no')
      .then((r) => setForm((f) => ({ ...f, proforma_no: r.data.proforma_no })))
      .catch(() => {});
  }

  function gecmistenGoruntule(proforma) {
    setOlusanProforma(proforma);
    setOlusanFatura(null);
    setFaturaNo('');
  }

  return (
    <div>
      <SayfaBasligi baslik="Proforma / Fatura" aciklama="Proforma fatura oluştur, onaylandığında normal faturaya çevir" />
      <HataMesaji>{hata}</HataMesaji>

      {!olusanProforma ? (
        <form onSubmit={proformaOlustur}>
          <Kart style={{ marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <Alan etiket="Proforma no">
                <input required value={form.proforma_no} onChange={(e) => setForm((f) => ({ ...f, proforma_no: e.target.value }))}
                  placeholder="PRF-2026-001" style={girdiStili} />
              </Alan>
              <Alan etiket="Cari">
                <select required value={form.cari_id} onChange={(e) => setForm((f) => ({ ...f, cari_id: e.target.value }))} style={girdiStili}>
                  <option value="">Seçin...</option>
                  {cariler.map((c) => <option key={c.id} value={c.id}>{c.unvan}</option>)}
                </select>
              </Alan>
              <Alan etiket="Tarih">
                <input required type="date" value={form.tarih} onChange={(e) => setForm((f) => ({ ...f, tarih: e.target.value }))} style={girdiStili} />
              </Alan>
              <Alan etiket="Para birimi">
                <select value={form.para_birimi} onChange={(e) => setForm((f) => ({ ...f, para_birimi: e.target.value }))} style={girdiStili}>
                  <option value="TRY">TRY</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </Alan>
            </div>
          </Kart>

          <Kart style={{ marginBottom: 16, padding: 0 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--kenarlik)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600, fontSize: 14.5 }}>Kalemler</span>
              <Buton type="button" variant="ikincil" onClick={() => setKalemler((l) => [...l, bosKalem()])}>+ Kalem ekle</Buton>
            </div>
            <table>
              <thead>
                <tr style={{ background: 'var(--zemin)' }}>
                  {['Ürün (opsiyonel)', 'Açıklama', 'Miktar', 'Birim Fiyat', 'KDV %', ''].map((b) => (
                    <th key={b} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--metin-ikincil)' }}>{b}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {kalemler.map((k, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                    <td style={{ padding: 8 }}>
                      <select value={k.stok_karti_id} onChange={(e) => kalemGuncelle(i, 'stok_karti_id', e.target.value)} style={{ ...girdiStili, width: 200 }}>
                        <option value="">Seçin (ya da elle yazın)...</option>
                        {stokKartlari.map((s) => <option key={s.id} value={s.id}>{s.marka} {s.model}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: 8 }}>
                      <input required value={k.aciklama} onChange={(e) => kalemGuncelle(i, 'aciklama', e.target.value)} style={{ ...girdiStili, width: 220 }} />
                    </td>
                    <td style={{ padding: 8 }}>
                      <input type="number" min="1" value={k.miktar} onChange={(e) => kalemGuncelle(i, 'miktar', e.target.value)} style={{ ...girdiStili, width: 70 }} />
                    </td>
                    <td style={{ padding: 8 }}>
                      <input required type="number" step="0.01" value={k.birim_fiyat} onChange={(e) => kalemGuncelle(i, 'birim_fiyat', e.target.value)} style={{ ...girdiStili, width: 130 }} />
                    </td>
                    <td style={{ padding: 8 }}>
                      <input type="number" value={k.kdv_orani} onChange={(e) => kalemGuncelle(i, 'kdv_orani', e.target.value)} style={{ ...girdiStili, width: 70 }} />
                    </td>
                    <td style={{ padding: 8 }}>
                      {kalemler.length > 1 && (
                        <button type="button" onClick={() => setKalemler((l) => l.filter((_, idx) => idx !== i))} style={eylemChipStili('kirmizi')}>Sil</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--kenarlik)', textAlign: 'right', fontSize: 13.5 }}>
              <div>Ara toplam: {araToplam.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {form.para_birimi}</div>
              <div>KDV: {kdvToplam.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {form.para_birimi}</div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>Genel toplam: {(araToplam + kdvToplam).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {form.para_birimi}</div>
            </div>
          </Kart>

          <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Oluşturuluyor...' : 'Proforma oluştur'}</Buton>
        </form>
      ) : (
        <Kart>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 12 }}>
              Proforma: {olusanProforma.proforma_no}
            </div>
            <Buton variant="ikincil" onClick={yeniProformaBaslat}>+ Yeni proforma</Buton>
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--metin-ikincil)', marginBottom: 16 }}>
            Genel toplam: <strong>{Number(olusanProforma.genel_toplam).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {olusanProforma.para_birimi}</strong>
            {' '}— Durum: {DURUM_METIN[olusanProforma.durum] || olusanProforma.durum}
          </div>

          {olusanProforma.durum !== 'FATURALASTI' && !olusanFatura ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ flex: 1, maxWidth: 240 }}>
                <Alan etiket="Fatura no">
                  <input value={faturaNo} onChange={(e) => setFaturaNo(e.target.value)} placeholder="FT-2026-001" style={girdiStili} />
                </Alan>
              </div>
              <Buton onClick={faturayaCevir} style={{ marginBottom: 14 }}>Faturaya çevir</Buton>
            </div>
          ) : olusanFatura ? (
            <div style={{ background: 'var(--yesil-acik)', color: 'var(--yesil)', padding: '12px 16px', borderRadius: 8, fontSize: 13.5 }}>
              Fatura oluşturuldu: <strong>{olusanFatura.fatura_no}</strong>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--metin-soluk)' }}>Bu proforma zaten faturalaştırılmış.</div>
          )}
        </Kart>
      )}

      <GecmisProformalar cariler={cariler} yenidenYukleTetik={gecmisYenidenYukleTetik} onGoruntule={gecmistenGoruntule} />
      <GecmisFaturalar cariler={cariler} yenidenYukleTetik={gecmisYenidenYukleTetik} />
    </div>
  );
}
