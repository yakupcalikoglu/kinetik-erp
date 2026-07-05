import { useEffect, useState } from 'react';
import { api, hataMesajiCikar } from '../api/client';
import {
  Kart, SayfaBasligi, Buton, Alan, girdiStili, Etiket, BosDurum, HataMesaji,
  eylemChipStili, BIRIM_SECENEKLERI,
} from '../components/Ortak';

function bosForm() {
  return { marka: '', model: '', birim: 'ADET', birim_agirlik_kg: '', aciklama: '', mense_ulke: '', gtip_kodu: '' };
}

function UrunTanimiFormu({ duzenlenenKart, onKaydedildi, onVazgec }) {
  const duzenlemeModu = !!duzenlenenKart;
  const [form, setForm] = useState(() => duzenlenenKart
    ? {
        marka: duzenlenenKart.marka || '',
        model: duzenlenenKart.model || '',
        birim: duzenlenenKart.birim || 'ADET',
        birim_agirlik_kg: duzenlenenKart.birim_agirlik_kg ?? '',
        aciklama: duzenlenenKart.aciklama || '',
        mense_ulke: duzenlenenKart.mense_ulke || '',
        gtip_kodu: duzenlenenKart.gtip_kodu || '',
      }
    : bosForm()
  );
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [olusturulanId, setOlusturulanId] = useState(null);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      const govde = { ...form, birim_agirlik_kg: form.birim_agirlik_kg ? Number(form.birim_agirlik_kg) : null };
      if (duzenlemeModu) {
        await api.put(`/stok-kartlari/${duzenlenenKart.id}`, govde);
        onKaydedildi();
      } else {
        const { data } = await api.post('/stok-kartlari', govde);
        setOlusturulanId(data.id);
      }
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  if (olusturulanId) {
    return (
      <Kart style={{ marginBottom: 20, background: 'var(--yesil-acik)' }}>
        <div style={{ color: 'var(--yesil)', fontWeight: 600, marginBottom: 6 }}>
          Ürün tanımı oluşturuldu — ID: {olusturulanId}
        </div>
        <div style={{ fontSize: 13, color: 'var(--metin-ikincil)', marginBottom: 12 }}>
          Bu ID'yi sipariş oluştururken "Stok Kartı ID" alanına girin.
        </div>
        <Buton variant="ikincil" onClick={onKaydedildi}>Kapat</Buton>
      </Kart>
    );
  }

  return (
    <Kart style={{ marginBottom: 20 }}>
      <form onSubmit={kaydet}>
        <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 14 }}>
          {duzenlemeModu ? `Ürün tanımını düzenle — #${duzenlenenKart.id}` : 'Yeni ürün tanımı'}
        </div>
        <HataMesaji>{hata}</HataMesaji>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
          <Alan etiket="Marka">
            <input required value={form.marka} onChange={(e) => setForm((f) => ({ ...f, marka: e.target.value }))} style={girdiStili} />
          </Alan>
          <Alan etiket="Model">
            <input required value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} style={girdiStili} />
          </Alan>
          <Alan etiket="Birim">
            <select value={form.birim} onChange={(e) => setForm((f) => ({ ...f, birim: e.target.value }))} style={girdiStili}>
              {BIRIM_SECENEKLERI.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </Alan>
          <Alan etiket="Menşei ülke">
            <input value={form.mense_ulke} onChange={(e) => setForm((f) => ({ ...f, mense_ulke: e.target.value }))} placeholder="Çin" style={girdiStili} />
          </Alan>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Alan etiket="GTİP kodu">
            <input value={form.gtip_kodu} onChange={(e) => setForm((f) => ({ ...f, gtip_kodu: e.target.value }))} placeholder="8427.20" style={girdiStili} />
          </Alan>
          <Alan etiket="Birim ağırlık (kg) — opsiyonel, nakliye hesabında kullanılır">
            <input type="number" step="0.1" value={form.birim_agirlik_kg} onChange={(e) => setForm((f) => ({ ...f, birim_agirlik_kg: e.target.value }))} style={girdiStili} />
          </Alan>
        </div>
        <Alan etiket="Açıklama">
          <input value={form.aciklama} onChange={(e) => setForm((f) => ({ ...f, aciklama: e.target.value }))} style={girdiStili} />
        </Alan>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <Buton type="submit" disabled={kaydediliyor}>
            {kaydediliyor ? 'Kaydediliyor...' : duzenlemeModu ? 'Değişiklikleri kaydet' : 'Ürün tanımı oluştur'}
          </Buton>
          <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
        </div>
      </form>
    </Kart>
  );
}

export default function UrunTanimlariSayfasi() {
  const [kartlar, setKartlar] = useState([]);
  const [envanterSayilari, setEnvanterSayilari] = useState({});
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(null);
  const [formAcik, setFormAcik] = useState(false);
  const [duzenlenenKart, setDuzenlenenKart] = useState(null);
  const [arama, setArama] = useState('');

  function kartlariYukle() {
    setYukleniyor(true);
    api.get('/stok-kartlari')
      .then((r) => setKartlar(r.data))
      .catch((e) => setHata(hataMesajiCikar(e)))
      .finally(() => setYukleniyor(false));
  }

  function envanterSayilariniYukle() {
    api.get('/stok-seri-no')
      .then((r) => {
        const harita = {};
        r.data.forEach((u) => {
          if (u.durum === 'SATILDI') return;
          harita[u.stok_karti_id] = (harita[u.stok_karti_id] || 0) + 1;
        });
        setEnvanterSayilari(harita);
      })
      .catch(() => {});
  }

  useEffect(() => {
    kartlariYukle();
    envanterSayilariniYukle();
  }, []);

  function yeniAc() {
    setDuzenlenenKart(null);
    setFormAcik(true);
  }

  function duzenle(kart) {
    setDuzenlenenKart(kart);
    setFormAcik(true);
  }

  function formuKapat() {
    setFormAcik(false);
    setDuzenlenenKart(null);
  }

  async function sil(kart) {
    if (!window.confirm(`${kart.marka} ${kart.model} ürün tanımını silmek istediğinize emin misiniz?`)) return;
    try {
      await api.delete(`/stok-kartlari/${kart.id}`);
      kartlariYukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  const gosterilecekler = arama
    ? kartlar.filter((k) => `${k.marka} ${k.model}`.toLowerCase().includes(arama.toLowerCase()))
    : kartlar;

  return (
    <div>
      <SayfaBasligi
        baslik="Ürün Tanımları"
        aciklama="Marka, model, birim ve gümrük bilgileri — fiziksel envanterden bağımsız ürün kataloğu"
        eylem={!formAcik && <Buton onClick={yeniAc}>+ Yeni ürün tanımı</Buton>}
      />
      <HataMesaji>{hata}</HataMesaji>

      {formAcik && (
        <UrunTanimiFormu
          duzenlenenKart={duzenlenenKart}
          onKaydedildi={() => { formuKapat(); kartlariYukle(); envanterSayilariniYukle(); }}
          onVazgec={formuKapat}
        />
      )}

      <Kart style={{ padding: 0 }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--kenarlik)' }}>
          <input
            value={arama}
            onChange={(e) => setArama(e.target.value)}
            placeholder="Marka/model ara..."
            style={{ ...girdiStili, maxWidth: 320 }}
          />
        </div>

        {yukleniyor ? (
          <div style={{ padding: 20, color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
        ) : gosterilecekler.length === 0 ? (
          <BosDurum baslik="Ürün tanımı bulunamadı" aciklama="Yukarıdan yeni bir ürün tanımı ekleyin." />
        ) : (
          <table>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                {['ID', 'Marka', 'Model', 'Birim', 'Elde Bulunan (Satılmamış)', 'Menşei', 'GTİP', 'İşlem'].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gosterilecekler.map((k) => (
                <tr key={k.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: 'var(--metin-ikincil)' }}>{k.id}</td>
                  <td style={{ padding: '10px 16px', fontWeight: 500 }}>{k.marka}</td>
                  <td style={{ padding: '10px 16px' }}>{k.model}</td>
                  <td style={{ padding: '10px 16px' }}>{k.birim}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <Etiket ton={envanterSayilari[k.id] > 0 ? 'yesil' : 'notr'}>
                      {envanterSayilari[k.id] || 0} {k.birim}
                    </Etiket>
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{k.mense_ulke || '—'}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{k.gtip_kodu || '—'}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => duzenle(k)} style={eylemChipStili('lacivert')}>Düzenle</button>
                      <button onClick={() => sil(k)} style={eylemChipStili('kirmizi')}>Sil</button>
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
