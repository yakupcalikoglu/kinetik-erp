import { useState } from 'react';
import { api, hataMesajiCikar } from '../api/client';
import { Kart, SayfaBasligi, Buton, Alan, girdiStili, HataMesaji } from '../components/Ortak';

function bosKalem() {
  return { aciklama: '', miktar: 1, birim_fiyat: '', kdv_orani: 20 };
}

export default function ProformaFaturaSayfasi() {
  const [form, setForm] = useState({
    proforma_no: '', cari_id: '', tarih: new Date().toISOString().slice(0, 10), para_birimi: 'TRY', notlar: '',
  });
  const [kalemler, setKalemler] = useState([bosKalem()]);
  const [olusanProforma, setOlusanProforma] = useState(null);
  const [faturaNo, setFaturaNo] = useState('');
  const [olusanFatura, setOlusanFatura] = useState(null);
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  function kalemGuncelle(i, alan, deger) {
    setKalemler((liste) => liste.map((k, idx) => (idx === i ? { ...k, [alan]: deger } : k)));
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
          aciklama: k.aciklama, miktar: Number(k.miktar), birim_fiyat: Number(k.birim_fiyat), kdv_orani: Number(k.kdv_orani),
        })),
      });
      setOlusanProforma(data);
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
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
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
              <Alan etiket="Cari ID">
                <input required type="number" value={form.cari_id} onChange={(e) => setForm((f) => ({ ...f, cari_id: e.target.value }))} style={girdiStili} />
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
                  {['Açıklama', 'Miktar', 'Birim Fiyat', 'KDV %'].map((b) => (
                    <th key={b} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--metin-ikincil)' }}>{b}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {kalemler.map((k, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                    <td style={{ padding: 8 }}>
                      <input required value={k.aciklama} onChange={(e) => kalemGuncelle(i, 'aciklama', e.target.value)} style={{ ...girdiStili, width: 280 }} />
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
          <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 12 }}>
            Proforma oluşturuldu: {olusanProforma.proforma_no}
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--metin-ikincil)', marginBottom: 16 }}>
            Genel toplam: <strong>{Number(olusanProforma.genel_toplam).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {olusanProforma.para_birimi}</strong>
            {' '}— Durum: {olusanProforma.durum}
          </div>

          {!olusanFatura ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ flex: 1, maxWidth: 240 }}>
                <Alan etiket="Fatura no">
                  <input value={faturaNo} onChange={(e) => setFaturaNo(e.target.value)} placeholder="FT-2026-001" style={girdiStili} />
                </Alan>
              </div>
              <Buton onClick={faturayaCevir} style={{ marginBottom: 14 }}>Faturaya çevir</Buton>
            </div>
          ) : (
            <div style={{ background: 'var(--yesil-acik)', color: 'var(--yesil)', padding: '12px 16px', borderRadius: 8, fontSize: 13.5 }}>
              Fatura oluşturuldu: <strong>{olusanFatura.fatura_no}</strong>
            </div>
          )}
        </Kart>
      )}
    </div>
  );
}
