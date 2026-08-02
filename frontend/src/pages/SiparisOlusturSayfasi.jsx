import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, hataMesajiCikar } from '../api/client';
import { Kart, SayfaBasligi, Buton, Alan, girdiStili, HataMesaji } from '../components/Ortak';
import AramaliSecici from '../components/AramaliSecici';

function bosUrunSatiri() {
  return { stok_karti_id: '', miktar: 1, birim_fiyat: '', para_birimi: 'USD', birim_agirlik_kg: '', kdv_orani: '20', aciklama: '' };
}

export default function SiparisOlusturSayfasi() {
  const navigate = useNavigate();
  const { siparisId } = useParams();
  const duzenlemeModu = !!siparisId;

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
    sifre: '',
  });
  const [urunler, setUrunler] = useState([bosUrunSatiri()]);
  const [tedarikciler, setTedarikciler] = useState([]);
  const [stokKartlari, setStokKartlari] = useState([]);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(duzenlemeModu);
  const [hata, setHata] = useState(null);

  useEffect(() => {
    api.get('/cariler', { params: { tip: 'TEDARIKCI' } })
      .then((res) => setTedarikciler(res.data))
      .catch(() => {});
    api.get('/stok-kartlari')
      .then((res) => setStokKartlari(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!duzenlemeModu) return;
    api.get(`/siparisler/${siparisId}`)
      .then((res) => {
        const s = res.data;
        setForm({
          siparis_no: s.siparis_no,
          tedarikci_cari_id: String(s.tedarikci_cari_id),
          kaynak: s.kaynak,
          siparis_tarihi: s.siparis_tarihi,
          tahmini_teslim_tarihi: s.tahmini_teslim_tarihi || '',
          para_birimi: s.para_birimi,
          cikis_limani: s.cikis_limani || '',
          varis_limani: s.varis_limani || '',
          notlar: s.notlar || '',
          sifre: '',
        });
        setUrunler(
          (s.urunler || []).map((u) => ({
            stok_karti_id: String(u.stok_karti_id),
            miktar: u.miktar,
            birim_fiyat: u.birim_fiyat,
            para_birimi: u.para_birimi,
            birim_agirlik_kg: u.birim_agirlik_kg ?? '',
            kdv_orani: u.kdv_orani != null ? String(u.kdv_orani) : '20',
            aciklama: u.aciklama ?? '',
          }))
        );
      })
      .catch((err) => setHata(hataMesajiCikar(err)))
      .finally(() => setYukleniyor(false));
  }, [siparisId, duzenlemeModu]);

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

    if (!form.tedarikci_cari_id) {
      setHata('Tedarikçi seçilmelidir.');
      return;
    }
    if (urunler.some((u) => !u.stok_karti_id || !u.birim_fiyat)) {
      setHata('Her ürün satırında stok kartı ve birim fiyat seçilmelidir.');
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
          kdv_orani: u.kdv_orani ? Number(u.kdv_orani) : 20,
          aciklama: u.aciklama || null,
        })),
      };

      if (duzenlemeModu) {
        await api.put(`/siparisler/${siparisId}`, govde);
        navigate('/siparisler', { state: { yeniSiparisNo: govde.siparis_no, guncellendiMi: true } });
      } else {
        delete govde.sifre;
        const { data } = await api.post('/siparisler', govde);
        navigate('/siparisler', { state: { yeniSiparisNo: data.siparis_no } });
      }
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  function stokKartiEtiketi(kart) {
    const parcalar = [kart.marka, kart.model].filter(Boolean);
    return `#${kart.id} — ${parcalar.join(' ') || 'İsimsiz'}`;
  }

  if (yukleniyor) {
    return <div style={{ padding: 20, color: 'var(--metin-soluk)' }}>Yükleniyor...</div>;
  }

  return (
    <div>
      <SayfaBasligi
        baslik={duzenlemeModu ? `Siparişi düzenle — ${form.siparis_no}` : 'Yeni sipariş'}
        aciklama="İthalat veya yurtiçi alım siparişi oluştur"
      />

      <form onSubmit={kaydet}>
        <HataMesaji>{hata}</HataMesaji>

        <Kart style={{ marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <Alan etiket="Sipariş no">
              <input required value={form.siparis_no} onChange={(e) => alaniGuncelle('siparis_no', e.target.value)}
                placeholder="SP-2026-00150" style={girdiStili} />
            </Alan>
            <Alan etiket="Tedarikçi">
              <AramaliSecici
                secenekler={tedarikciler}
                deger={form.tedarikci_cari_id}
                onDegistir={(v) => alaniGuncelle('tedarikci_cari_id', v)}
                etiketFn={(t) => t.unvan}
                bosMetin="Tedarikçi adı yazarak arayın..."
              />
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
                {['Stok Kartı', 'Miktar', 'Birim Fiyat', 'Birim Ağırlık (kg)', 'KDV %', 'Açıklama', ''].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {urunler.map((u, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                  <td style={{ padding: 8 }}>
                    <div style={{ width: 260 }}>
                      <AramaliSecici
                        secenekler={stokKartlari}
                        deger={u.stok_karti_id}
                        onDegistir={(v) => urunGuncelle(i, 'stok_karti_id', v)}
                        etiketFn={stokKartiEtiketi}
                        bosMetin="Ürün adı yazarak arayın..."
                      />
                    </div>
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
                    <input type="number" step="0.01" value={u.kdv_orani} onChange={(e) => urunGuncelle(i, 'kdv_orani', e.target.value)}
                      style={{ ...girdiStili, width: 70 }} title="Bu üründen indirilecek KDV oranı - KDV Özeti raporunda kullanılır" />
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
          {duzenlemeModu && (
            <Alan etiket="Şifreniz (onay için zorunlu)">
              <input required type="password" value={form.sifre} onChange={(e) => alaniGuncelle('sifre', e.target.value)}
                style={girdiStili} placeholder="Giriş şifreniz" />
            </Alan>
          )}
        </Kart>

        <div style={{ display: 'flex', gap: 8 }}>
          <Buton type="submit" disabled={kaydediliyor}>
            {kaydediliyor ? 'Kaydediliyor...' : duzenlemeModu ? 'Değişiklikleri kaydet' : 'Siparişi oluştur'}
          </Buton>
          <Buton type="button" variant="ikincil" onClick={() => navigate('/siparisler')}>Vazgeç</Buton>
        </div>
      </form>
    </div>
  );
}
