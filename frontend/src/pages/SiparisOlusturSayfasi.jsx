import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, hataMesajiCikar } from '../api/client';
import { Kart, SayfaBasligi, Buton, Alan, girdiStili, HataMesaji } from '../components/Ortak';

function bosUrunSatiri() {
  return { stok_karti_id: '', miktar: 1, birim_fiyat: '', para_birimi: 'USD', birim_agirlik_kg: '', aciklama: '' };
}

export default function SiparisOlusturSayfasi() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    siparis_no: '',
    tedarikci_cari_id: '',
    kaynak: 'ITHALAT',
    siparis_tarihi: new Date().toISOString().slice(0, 10),
    tahmini_teslim_tarihi: '',
    para_birimi: 'USD',
    cikis_limani: '',
    varis_limani: '',
    notlar: '',
  });
  const [urunler, setUrunler] = useState([bosUrunSatiri()]);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [hata, setHata] = useState(null);

  function alaniGuncelle(alan, deger) {
    setForm((f) => ({ ...f, [alan]: deger }));
  }

  function urunGuncelle(index, alan, deger) {
    setUrunler((liste) => liste.map((u, i) => (i === index ? { ...u, [alan]: deger } : u)));
  }

  function urunEkle() {
    setUrunler((liste) => [...liste, bosUrunSatiri()]);
  }

  function urunSil(index) {
    setUrunler((liste) => liste.filter((_, i) => i !== index));
  }

  const genelToplam = urunler.reduce(
    (acc, u) => acc + (Number(u.miktar) || 0) * (Number(u.birim_fiyat) || 0),
    0
  );

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);

    if (urunler.some((u) => !u.stok_karti_id || !u.birim_fiyat)) {
      setHata('Her ürün satırında stok kartı ID ve birim fiyat girilmelidir.');
      return;
    }

    setKaydediliyor(true);
    try {
      const govde = {
        ...form,
        tedarikci_cari_id: Number(form.tedarikci_cari_id),
        tahmini_teslim_tarihi: form.tahmini_teslim_tarihi || null,
        urunler: urunler.map((u) => ({
          stok_karti_id: Number(u.stok_karti_id),
          miktar: Number(u.miktar),
          birim_fiyat: Number(u.birim_fiyat),
          para_birimi: u.para_birimi,
          birim_agirlik_kg: u.birim_agirlik_kg ? Number(u.birim_agirlik_kg) : null,
          aciklama: u.aciklama || null,
        })),
      };
      const { data } = await api.post('/siparisler', govde);
      navigate('/siparisler', { state: { yeniSiparisNo: data.siparis_no } });
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  return (
    <div>
      <SayfaBasligi baslik="Yeni sipariş" aciklama="İthalat veya yurtiçi alım siparişi oluştur" />

      <form onSubmit={kaydet}>
        <HataMesaji>{hata}</HataMesaji>

        <Kart style={{ marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <Alan etiket="Sipariş no">
              <input required value={form.siparis_no} onChange={(e) => alaniGuncelle('siparis_no', e.target.value)}
                placeholder="SP-2026-00150" style={girdiStili} />
            </Alan>
            <Alan etiket="Tedarikçi cari ID">
              <input required type="number" value={form.tedarikci_cari_id}
                onChange={(e) => alaniGuncelle('tedarikci_cari_id', e.target.value)} style={girdiStili} />
            </Alan>
            <Alan etiket="Kaynak">
              <select value={form.kaynak} onChange={(e) => alaniGuncelle('kaynak', e.target.value)} style={girdiStili}>
                <option value="ITHALAT">İthalat</option>
                <option value="YURTICI_ALIM">Yurtiçi Alım</option>
              </select>
            </Alan>
            <Alan etiket="Sipariş tarihi">
              <input required type="date" value={form.siparis_tarihi}
                onChange={(e) => alaniGuncelle('siparis_tarihi', e.target.value)} style={girdiStili} />
            </Alan>
            <Alan etiket="Tahmini teslim tarihi">
              <input type="date" value={form.tahmini_teslim_tarihi}
                onChange={(e) => alaniGuncelle('tahmini_teslim_tarihi', e.target.value)} style={girdiStili} />
            </Alan>
            <Alan etiket="Para birimi">
              <select value={form.para_birimi} onChange={(e) => alaniGuncelle('para_birimi', e.target.value)} style={girdiStili}>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="TRY">TRY</option>
              </select>
            </Alan>
            {form.kaynak === 'ITHALAT' && (
              <>
                <Alan etiket="Çıkış limanı">
                  <input value={form.cikis_limani} onChange={(e) => alaniGuncelle('cikis_limani', e.target.value)} style={girdiStili} />
                </Alan>
                <Alan etiket="Varış limanı">
                  <input value={form.varis_limani} onChange={(e) => alaniGuncelle('varis_limani', e.target.value)} style={girdiStili} />
                </Alan>
              </>
            )}
          </div>
        </Kart>

        <Kart style={{ marginBottom: 16, padding: 0 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--kenarlik)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: 14.5 }}>Ürünler</span>
            <Buton type="button" variant="ikincil" onClick={urunEkle}>+ Satır ekle</Buton>
          </div>

          <table>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                {['Stok Kartı ID', 'Miktar', 'Birim Fiyat', 'Birim Ağırlık (kg)', 'Açıklama', ''].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {urunler.map((u, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                  <td style={{ padding: 8 }}>
                    <input type="number" value={u.stok_karti_id} onChange={(e) => urunGuncelle(i, 'stok_karti_id', e.target.value)}
                      style={{ ...girdiStili, width: 100 }} />
                  </td>
                  <td style={{ padding: 8 }}>
                    <input type="number" min="1" value={u.miktar} onChange={(e) => urunGuncelle(i, 'miktar', e.target.value)}
                      style={{ ...girdiStili, width: 70 }} />
                  </td>
                  <td style={{ padding: 8 }}>
                    <input type="number" step="0.01" value={u.birim_fiyat} onChange={(e) => urunGuncelle(i, 'birim_fiyat', e.target.value)}
                      style={{ ...girdiStili, width: 120 }} />
                  </td>
                  <td style={{ padding: 8 }}>
                    <input type="number" step="0.1" value={u.birim_agirlik_kg} onChange={(e) => urunGuncelle(i, 'birim_agirlik_kg', e.target.value)}
                      style={{ ...girdiStili, width: 110 }} />
                  </td>
                  <td style={{ padding: 8 }}>
                    <input value={u.aciklama} onChange={(e) => urunGuncelle(i, 'aciklama', e.target.value)}
                      placeholder="Marka / model" style={{ ...girdiStili, width: 200 }} />
                  </td>
                  <td style={{ padding: 8 }}>
                    {urunler.length > 1 && (
                      <button type="button" onClick={() => urunSil(i)}
                        style={{ background: 'none', border: 'none', color: 'var(--kirmizi)', fontSize: 13 }}>
                        Sil
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--kenarlik)', textAlign: 'right', fontSize: 14 }}>
            Genel toplam: <strong>{genelToplam.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {form.para_birimi}</strong>
          </div>
        </Kart>

        <Kart style={{ marginBottom: 16 }}>
          <Alan etiket="Notlar">
            <input value={form.notlar} onChange={(e) => alaniGuncelle('notlar', e.target.value)} style={girdiStili} />
          </Alan>
        </Kart>

        <div style={{ display: 'flex', gap: 8 }}>
          <Buton type="submit" disabled={kaydediliyor}>
            {kaydediliyor ? 'Kaydediliyor...' : 'Siparişi oluştur'}
          </Buton>
          <Buton type="button" variant="ikincil" onClick={() => navigate('/siparisler')}>Vazgeç</Buton>
        </div>
      </form>
    </div>
  );
}
