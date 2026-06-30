import { useEffect, useState } from 'react';
import { api, hataMesajiCikar } from '../api/client';
import {
  Kart, SayfaBasligi, Buton, Etiket, Alan, girdiStili, BosDurum, HataMesaji, paraFormat, Sekmeler,
} from '../components/Ortak';

const SEKMELER = [
  { deger: 'cek', etiket: 'Çek' },
  { deger: 'leasing', etiket: 'Leasing' },
  { deger: 'taksit', etiket: 'Taksitli Satış' },
  { deger: 'kiralama', etiket: 'Kiralama' },
  { deger: 'bakim', etiket: 'Bakım' },
  { deger: 'personel', etiket: 'Personel' },
  { deger: 'gider', etiket: 'Sabit Giderler' },
  { deger: 'borc', etiket: 'Ortak / Dış Borç' },
];

function BasitTablo({ basliklar, satirlar, render }) {
  if (satirlar.length === 0) return <BosDurum baslik="Kayıt bulunamadı" />;
  return (
    <table>
      <thead>
        <tr style={{ background: 'var(--zemin)' }}>
          {basliklar.map((b) => (
            <th key={b} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>{b}</th>
          ))}
        </tr>
      </thead>
      <tbody>{satirlar.map(render)}</tbody>
    </table>
  );
}

// ============================================================== ÇEK
const CEK_DURUM_TON = { PORTFOYDE: 'amber', CIRO_EDILDI: 'notr', TAHSIL_EDILDI: 'yesil', ODENDI: 'yesil', KARSILIKSIZ: 'kirmizi', IPTAL: 'kirmizi' };
const CEK_DURUM_METIN = { PORTFOYDE: 'Portföyde', CIRO_EDILDI: 'Ciro Edildi', TAHSIL_EDILDI: 'Tahsil Edildi', ODENDI: 'Ödendi', KARSILIKSIZ: 'Karşılıksız', IPTAL: 'İptal' };

function CekSekmesi() {
  const [cekler, setCekler] = useState([]);
  const [formAcik, setFormAcik] = useState(false);
  const [form, setForm] = useState({ tip: 'ALINAN', cek_no: '', banka_adi: '', cari_id: '', tutar: '', vade_tarihi: '', alinma_verilme_tarihi: '' });
  const [hata, setHata] = useState(null);

  function yukle() {
    api.get('/cekler').then((r) => setCekler(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }
  useEffect(yukle, []);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    try {
      await api.post('/cekler', { ...form, cari_id: form.cari_id ? Number(form.cari_id) : null, tutar: Number(form.tutar) });
      setFormAcik(false);
      yukle();
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function ciroEt(cekId) {
    const ciroEdilenCariId = window.prompt('Çekin ciro edileceği cari ID:');
    if (!ciroEdilenCariId) return;
    try {
      await api.put(`/cekler/${cekId}/durum`, { yeni_durum: 'CIRO_EDILDI', ciro_edilen_cari_id: Number(ciroEdilenCariId) });
      yukle();
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Buton onClick={() => setFormAcik((a) => !a)}>{formAcik ? 'Kapat' : '+ Yeni çek'}</Buton>
      </div>
      <HataMesaji>{hata}</HataMesaji>

      {formAcik && (
        <Kart style={{ marginBottom: 16 }}>
          <form onSubmit={kaydet} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Alan etiket="Tip">
              <select value={form.tip} onChange={(e) => setForm((f) => ({ ...f, tip: e.target.value }))} style={girdiStili}>
                <option value="ALINAN">Alınan</option>
                <option value="VERILEN">Verilen</option>
              </select>
            </Alan>
            <Alan etiket="Çek no">
              <input value={form.cek_no} onChange={(e) => setForm((f) => ({ ...f, cek_no: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Banka">
              <input value={form.banka_adi} onChange={(e) => setForm((f) => ({ ...f, banka_adi: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Cari ID">
              <input type="number" value={form.cari_id} onChange={(e) => setForm((f) => ({ ...f, cari_id: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Tutar (TL)">
              <input required type="number" step="0.01" value={form.tutar} onChange={(e) => setForm((f) => ({ ...f, tutar: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Vade tarihi">
              <input required type="date" value={form.vade_tarihi} onChange={(e) => setForm((f) => ({ ...f, vade_tarihi: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Alınma/verilme tarihi">
              <input required type="date" value={form.alinma_verilme_tarihi} onChange={(e) => setForm((f) => ({ ...f, alinma_verilme_tarihi: e.target.value }))} style={girdiStili} />
            </Alan>
            <div style={{ alignSelf: 'end' }}><Buton type="submit">Kaydet</Buton></div>
          </form>
        </Kart>
      )}

      <Kart style={{ padding: 0 }}>
        <BasitTablo
          basliklar={['Çek No', 'Tip', 'Banka', 'Tutar', 'Vade', 'Durum', 'İşlem']}
          satirlar={cekler}
          render={(c) => (
            <tr key={c.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
              <td style={{ padding: '10px 16px' }}>{c.cek_no || '—'}</td>
              <td style={{ padding: '10px 16px' }}>{c.tip === 'ALINAN' ? 'Alınan' : 'Verilen'}</td>
              <td style={{ padding: '10px 16px' }}>{c.banka_adi || '—'}</td>
              <td style={{ padding: '10px 16px' }}>{paraFormat(c.tutar)}</td>
              <td style={{ padding: '10px 16px' }}>{c.vade_tarihi}</td>
              <td style={{ padding: '10px 16px' }}><Etiket ton={CEK_DURUM_TON[c.durum]}>{CEK_DURUM_METIN[c.durum]}</Etiket></td>
              <td style={{ padding: '10px 16px' }}>
                {c.durum === 'PORTFOYDE' && (
                  <button onClick={() => ciroEt(c.id)} style={{ background: 'none', border: 'none', color: 'var(--lacivert)', fontSize: 13 }}>Ciro et</button>
                )}
              </td>
            </tr>
          )}
        />
      </Kart>
    </div>
  );
}

// ============================================================== PERSONEL
function PersonelSekmesi() {
  const [liste, setListe] = useState([]);
  const [formAcik, setFormAcik] = useState(false);
  const [form, setForm] = useState({ ad_soyad: '', pozisyon: '', aylik_maas: '' });
  const [hata, setHata] = useState(null);
  const [seciliPersonel, setSeciliPersonel] = useState(null);
  const [odemeler, setOdemeler] = useState(null);
  const [odemeForm, setOdemeForm] = useState({ donem: new Date().toISOString().slice(0, 10), tip: 'MAAS', tutar: '' });

  function yukle() {
    api.get('/personel').then((r) => setListe(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }
  useEffect(yukle, []);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    try {
      await api.post('/personel', { ...form, aylik_maas: form.aylik_maas ? Number(form.aylik_maas) : null });
      setFormAcik(false);
      yukle();
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function odemeleriGoster(personelId) {
    try {
      const { data } = await api.get(`/personel/${personelId}/odemeler`);
      setSeciliPersonel(personelId);
      setOdemeler(data);
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function odemeEkle(e) {
    e.preventDefault();
    try {
      await api.post(`/personel-odemeleri?personel_id=${seciliPersonel}`, { ...odemeForm, tutar: Number(odemeForm.tutar) });
      odemeleriGoster(seciliPersonel);
      setOdemeForm({ donem: new Date().toISOString().slice(0, 10), tip: 'MAAS', tutar: '' });
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function ode(odemeId) {
    try {
      await api.put(`/personel-odemeleri/${odemeId}/ode`, { odeme_tarihi: new Date().toISOString().slice(0, 10) });
      odemeleriGoster(seciliPersonel);
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Buton onClick={() => setFormAcik((a) => !a)}>{formAcik ? 'Kapat' : '+ Yeni personel'}</Buton>
      </div>
      <HataMesaji>{hata}</HataMesaji>

      {formAcik && (
        <Kart style={{ marginBottom: 16 }}>
          <form onSubmit={kaydet} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Alan etiket="Ad Soyad">
              <input required value={form.ad_soyad} onChange={(e) => setForm((f) => ({ ...f, ad_soyad: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Pozisyon">
              <input value={form.pozisyon} onChange={(e) => setForm((f) => ({ ...f, pozisyon: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Aylık maaş (TL)">
              <input type="number" step="0.01" value={form.aylik_maas} onChange={(e) => setForm((f) => ({ ...f, aylik_maas: e.target.value }))} style={girdiStili} />
            </Alan>
            <div style={{ alignSelf: 'end' }}><Buton type="submit">Kaydet</Buton></div>
          </form>
        </Kart>
      )}

      <Kart style={{ padding: 0, marginBottom: 16 }}>
        <BasitTablo
          basliklar={['Ad Soyad', 'Pozisyon', 'Aylık Maaş', '']}
          satirlar={liste}
          render={(p) => (
            <tr key={p.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
              <td style={{ padding: '10px 16px', fontWeight: 500 }}>{p.ad_soyad}</td>
              <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{p.pozisyon || '—'}</td>
              <td style={{ padding: '10px 16px' }}>{p.aylik_maas != null ? paraFormat(p.aylik_maas) : '—'}</td>
              <td style={{ padding: '10px 16px' }}>
                <button onClick={() => odemeleriGoster(p.id)} style={{ background: 'none', border: 'none', color: 'var(--lacivert)', fontSize: 13 }}>
                  Ödemeler
                </button>
              </td>
            </tr>
          )}
        />
      </Kart>

      {seciliPersonel && (
        <Kart>
          <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 12 }}>
            Personel #{seciliPersonel} — ödeme geçmişi
          </div>

          <form onSubmit={odemeEkle} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 10, marginBottom: 14 }}>
            <Alan etiket="Dönem">
              <input required type="date" value={odemeForm.donem} onChange={(e) => setOdemeForm((f) => ({ ...f, donem: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Tip">
              <select value={odemeForm.tip} onChange={(e) => setOdemeForm((f) => ({ ...f, tip: e.target.value }))} style={girdiStili}>
                <option value="MAAS">Maaş</option>
                <option value="AVANS">Avans</option>
                <option value="PRIM">Prim</option>
                <option value="SGK">SGK</option>
                <option value="DIGER">Diğer</option>
              </select>
            </Alan>
            <Alan etiket="Tutar">
              <input required type="number" step="0.01" value={odemeForm.tutar} onChange={(e) => setOdemeForm((f) => ({ ...f, tutar: e.target.value }))} style={girdiStili} />
            </Alan>
            <div style={{ alignSelf: 'end' }}><Buton type="submit">Tahakkuk ettir</Buton></div>
          </form>

          {odemeler && (
            <BasitTablo
              basliklar={['Dönem', 'Tip', 'Tutar', 'Durum', '']}
              satirlar={odemeler}
              render={(o) => (
                <tr key={o.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                  <td style={{ padding: '8px 0' }}>{o.donem}</td>
                  <td style={{ padding: '8px 0' }}>{o.tip}</td>
                  <td style={{ padding: '8px 0' }}>{paraFormat(o.tutar)}</td>
                  <td style={{ padding: '8px 0' }}><Etiket ton={o.odendi_mi ? 'yesil' : 'amber'}>{o.odendi_mi ? 'Ödendi' : 'Bekliyor'}</Etiket></td>
                  <td style={{ padding: '8px 0' }}>
                    {!o.odendi_mi && (
                      <button onClick={() => ode(o.id)} style={{ background: 'none', border: 'none', color: 'var(--lacivert)', fontSize: 13 }}>Öde</button>
                    )}
                  </td>
                </tr>
              )}
            />
          )}
        </Kart>
      )}
    </div>
  );
}

// ============================================================== BAKIM
function BakimSekmesi() {
  const [liste, setListe] = useState([]);
  const [formAcik, setFormAcik] = useState(false);
  const [form, setForm] = useState({ stok_seri_no_id: '', tarih: new Date().toISOString().slice(0, 10), tip: 'GIDER', aciklama: '', tutar: '' });
  const [hata, setHata] = useState(null);

  function yukle() {
    api.get('/bakim-kayitlari').then((r) => setListe(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }
  useEffect(yukle, []);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    try {
      await api.post('/bakim-kayitlari', { ...form, stok_seri_no_id: Number(form.stok_seri_no_id), tutar: Number(form.tutar) });
      setFormAcik(false);
      yukle();
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Buton onClick={() => setFormAcik((a) => !a)}>{formAcik ? 'Kapat' : '+ Yeni bakım kaydı'}</Buton>
      </div>
      <HataMesaji>{hata}</HataMesaji>

      {formAcik && (
        <Kart style={{ marginBottom: 16 }}>
          <form onSubmit={kaydet} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Alan etiket="Stok seri no ID">
              <input required type="number" value={form.stok_seri_no_id} onChange={(e) => setForm((f) => ({ ...f, stok_seri_no_id: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Tarih">
              <input required type="date" value={form.tarih} onChange={(e) => setForm((f) => ({ ...f, tarih: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Tip">
              <select value={form.tip} onChange={(e) => setForm((f) => ({ ...f, tip: e.target.value }))} style={girdiStili}>
                <option value="GIDER">Gider</option>
                <option value="GELIR">Gelir</option>
              </select>
            </Alan>
            <Alan etiket="Açıklama">
              <input value={form.aciklama} onChange={(e) => setForm((f) => ({ ...f, aciklama: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Tutar (TL)">
              <input required type="number" step="0.01" value={form.tutar} onChange={(e) => setForm((f) => ({ ...f, tutar: e.target.value }))} style={girdiStili} />
            </Alan>
            <div style={{ alignSelf: 'end' }}><Buton type="submit">Kaydet</Buton></div>
          </form>
        </Kart>
      )}

      <Kart style={{ padding: 0 }}>
        <BasitTablo
          basliklar={['Seri No ID', 'Tarih', 'Tip', 'Açıklama', 'Tutar']}
          satirlar={liste}
          render={(b) => (
            <tr key={b.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
              <td style={{ padding: '10px 16px' }}>{b.stok_seri_no_id}</td>
              <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{b.tarih}</td>
              <td style={{ padding: '10px 16px' }}><Etiket ton={b.tip === 'GELIR' ? 'yesil' : 'kirmizi'}>{b.tip === 'GELIR' ? 'Gelir' : 'Gider'}</Etiket></td>
              <td style={{ padding: '10px 16px' }}>{b.aciklama || '—'}</td>
              <td style={{ padding: '10px 16px', fontWeight: 500 }}>{paraFormat(b.tutar)}</td>
            </tr>
          )}
        />
      </Kart>
    </div>
  );
}

// ============================================================== LEASING (salt görüntüleme - olusturma siparis baglantili)
function LeasingSekmesi() {
  const [liste, setListe] = useState([]);
  const [hata, setHata] = useState(null);
  const [seciliPlan, setSeciliPlan] = useState(null);

  useEffect(() => {
    api.get('/leasing-sozlesmeleri').then((r) => setListe(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }, []);

  async function planiGoster(id) {
    try {
      const { data } = await api.get(`/leasing-sozlesmeleri/${id}/odeme-plani`);
      setSeciliPlan({ id, taksitler: data });
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function odemeYap(odemeId) {
    try {
      await api.put(`/leasing-odemeleri/${odemeId}/ode`, { odeme_tarihi: new Date().toISOString().slice(0, 10) });
      planiGoster(seciliPlan.id);
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  return (
    <div>
      <HataMesaji>{hata}</HataMesaji>
      <Kart style={{ padding: 0, marginBottom: 16 }}>
        <BasitTablo
          basliklar={['Sözleşme No', 'Toplam Tutar', 'Taksit Sayısı', '']}
          satirlar={liste}
          render={(l) => (
            <tr key={l.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
              <td style={{ padding: '10px 16px', fontWeight: 500 }}>{l.sozlesme_no || `#${l.id}`}</td>
              <td style={{ padding: '10px 16px' }}>{paraFormat(l.toplam_tutar, l.para_birimi)}</td>
              <td style={{ padding: '10px 16px' }}>{l.taksit_sayisi}</td>
              <td style={{ padding: '10px 16px' }}>
                <button onClick={() => planiGoster(l.id)} style={{ background: 'none', border: 'none', color: 'var(--lacivert)', fontSize: 13 }}>
                  Ödeme planını gör
                </button>
              </td>
            </tr>
          )}
        />
      </Kart>

      {seciliPlan && (
        <Kart style={{ padding: 0 }}>
          <div style={{ padding: '12px 16px', fontWeight: 600, fontSize: 13.5, borderBottom: '1px solid var(--kenarlik)' }}>
            Ödeme planı (sözleşme #{seciliPlan.id})
          </div>
          <BasitTablo
            basliklar={['Taksit No', 'Vade', 'Tutar', 'Durum', '']}
            satirlar={seciliPlan.taksitler}
            render={(t) => (
              <tr key={t.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                <td style={{ padding: '8px 16px' }}>{t.taksit_no}</td>
                <td style={{ padding: '8px 16px' }}>{t.vade_tarihi}</td>
                <td style={{ padding: '8px 16px' }}>{paraFormat(t.tutar)}</td>
                <td style={{ padding: '8px 16px' }}><Etiket ton={t.odendi_mi ? 'yesil' : 'amber'}>{t.odendi_mi ? 'Ödendi' : 'Bekliyor'}</Etiket></td>
                <td style={{ padding: '8px 16px' }}>
                  {!t.odendi_mi && (
                    <button onClick={() => odemeYap(t.id)} style={{ background: 'none', border: 'none', color: 'var(--lacivert)', fontSize: 13 }}>Öde</button>
                  )}
                </td>
              </tr>
            )}
          />
        </Kart>
      )}
    </div>
  );
}

// ============================================================== KİRALAMA
function KiralamaSekmesi() {
  const [liste, setListe] = useState([]);
  const [formAcik, setFormAcik] = useState(false);
  const [form, setForm] = useState({ stok_seri_no_id: '', kiraci_cari_id: '', baslangic_tarihi: new Date().toISOString().slice(0, 10), aylik_kira_tutari: '', para_birimi: 'TRY' });
  const [hata, setHata] = useState(null);
  const [seciliSozlesme, setSeciliSozlesme] = useState(null);
  const [odemeler, setOdemeler] = useState(null);
  const [odemeForm, setOdemeForm] = useState({ donem_basi: '', donem_sonu: '', tutar: '' });

  function yukle() {
    api.get('/kiralama-sozlesmeleri').then((r) => setListe(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }
  useEffect(yukle, []);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    try {
      await api.post('/kiralama-sozlesmeleri', {
        ...form,
        stok_seri_no_id: Number(form.stok_seri_no_id),
        kiraci_cari_id: Number(form.kiraci_cari_id),
        aylik_kira_tutari: Number(form.aylik_kira_tutari),
      });
      setFormAcik(false);
      yukle();
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function odemeleriGoster(sozlesmeId) {
    try {
      const { data } = await api.get(`/kiralama-sozlesmeleri/${sozlesmeId}/odemeler`);
      setSeciliSozlesme(sozlesmeId);
      setOdemeler(data);
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function odemeEkle(e) {
    e.preventDefault();
    try {
      await api.post(`/kiralama-sozlesmeleri/${seciliSozlesme}/odemeler`, odemeForm);
      odemeleriGoster(seciliSozlesme);
      setOdemeForm({ donem_basi: '', donem_sonu: '', tutar: '' });
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function tahsilEt(odemeId) {
    try {
      await api.put(`/kiralama-odemeleri/${odemeId}/tahsil-et`, { odeme_tarihi: new Date().toISOString().slice(0, 10) });
      odemeleriGoster(seciliSozlesme);
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Buton onClick={() => setFormAcik((a) => !a)}>{formAcik ? 'Kapat' : '+ Yeni kiralama'}</Buton>
      </div>
      <HataMesaji>{hata}</HataMesaji>

      {formAcik && (
        <Kart style={{ marginBottom: 16 }}>
          <form onSubmit={kaydet} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Alan etiket="Stok seri no ID">
              <input required type="number" value={form.stok_seri_no_id} onChange={(e) => setForm((f) => ({ ...f, stok_seri_no_id: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Kiracı cari ID">
              <input required type="number" value={form.kiraci_cari_id} onChange={(e) => setForm((f) => ({ ...f, kiraci_cari_id: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Başlangıç tarihi">
              <input required type="date" value={form.baslangic_tarihi} onChange={(e) => setForm((f) => ({ ...f, baslangic_tarihi: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Aylık kira tutarı">
              <input required type="number" step="0.01" value={form.aylik_kira_tutari} onChange={(e) => setForm((f) => ({ ...f, aylik_kira_tutari: e.target.value }))} style={girdiStili} />
            </Alan>
            <div style={{ alignSelf: 'end' }}><Buton type="submit">Kaydet</Buton></div>
          </form>
        </Kart>
      )}

      <Kart style={{ padding: 0, marginBottom: 16 }}>
        <BasitTablo
          basliklar={['Seri No ID', 'Kiracı', 'Aylık Kira', 'Durum', '']}
          satirlar={liste}
          render={(k) => (
            <tr key={k.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
              <td style={{ padding: '10px 16px' }}>{k.stok_seri_no_id}</td>
              <td style={{ padding: '10px 16px' }}>{k.kiraci_cari_id}</td>
              <td style={{ padding: '10px 16px' }}>{paraFormat(k.aylik_kira_tutari, k.para_birimi)}</td>
              <td style={{ padding: '10px 16px' }}><Etiket ton={k.durum === 'AKTIF' ? 'yesil' : 'notr'}>{k.durum}</Etiket></td>
              <td style={{ padding: '10px 16px' }}>
                <button onClick={() => odemeleriGoster(k.id)} style={{ background: 'none', border: 'none', color: 'var(--lacivert)', fontSize: 13 }}>
                  Ödemeler
                </button>
              </td>
            </tr>
          )}
        />
      </Kart>

      {seciliSozlesme && (
        <Kart>
          <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 12 }}>
            Sözleşme #{seciliSozlesme} — kira ödemeleri
          </div>

          <form onSubmit={odemeEkle} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 10, marginBottom: 14 }}>
            <Alan etiket="Dönem başı">
              <input required type="date" value={odemeForm.donem_basi} onChange={(e) => setOdemeForm((f) => ({ ...f, donem_basi: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Dönem sonu">
              <input required type="date" value={odemeForm.donem_sonu} onChange={(e) => setOdemeForm((f) => ({ ...f, donem_sonu: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Tutar">
              <input required type="number" step="0.01" value={odemeForm.tutar} onChange={(e) => setOdemeForm((f) => ({ ...f, tutar: e.target.value }))} style={girdiStili} />
            </Alan>
            <div style={{ alignSelf: 'end' }}><Buton type="submit">Dönem ekle</Buton></div>
          </form>

          {odemeler && (
            <BasitTablo
              basliklar={['Dönem', 'Tutar', 'Durum', '']}
              satirlar={odemeler}
              render={(o) => (
                <tr key={o.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                  <td style={{ padding: '8px 0' }}>{o.donem_basi} → {o.donem_sonu}</td>
                  <td style={{ padding: '8px 0' }}>{paraFormat(o.tutar)}</td>
                  <td style={{ padding: '8px 0' }}><Etiket ton={o.odendi_mi ? 'yesil' : 'amber'}>{o.odendi_mi ? 'Tahsil Edildi' : 'Bekliyor'}</Etiket></td>
                  <td style={{ padding: '8px 0' }}>
                    {!o.odendi_mi && (
                      <button onClick={() => tahsilEt(o.id)} style={{ background: 'none', border: 'none', color: 'var(--lacivert)', fontSize: 13 }}>Tahsil et</button>
                    )}
                  </td>
                </tr>
              )}
            />
          )}
        </Kart>
      )}
    </div>
  );
}

// ============================================================== TAKSİTLİ SATIŞ
function TaksitSekmesi() {
  const [hata, setHata] = useState(null);
  const [vadesiGecenler, setVadesiGecenler] = useState([]);
  const [formAcik, setFormAcik] = useState(false);
  const [form, setForm] = useState({
    musteri_cari_id: '', stok_seri_no_id: '', toplam_tutar: '', pesinat: '0',
    taksit_sayisi: 6, baslangic_tarihi: new Date().toISOString().slice(0, 10),
  });
  const [olusanPlan, setOlusanPlan] = useState(null);
  const [taksitler, setTaksitler] = useState(null);

  function vadesiGecenleriYukle() {
    api.get('/taksitler/vadesi-gecenler').then((r) => setVadesiGecenler(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }
  useEffect(vadesiGecenleriYukle, []);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    try {
      const { data } = await api.post('/taksitli-satis-planlari', {
        ...form,
        para_birimi: 'TRY',
        musteri_cari_id: Number(form.musteri_cari_id),
        stok_seri_no_id: form.stok_seri_no_id ? Number(form.stok_seri_no_id) : null,
        toplam_tutar: Number(form.toplam_tutar),
        pesinat: Number(form.pesinat),
        taksit_sayisi: Number(form.taksit_sayisi),
      });
      setOlusanPlan(data);
      const { data: taksitVerisi } = await api.get(`/taksitli-satis-planlari/${data.id}/taksitler`);
      setTaksitler(taksitVerisi);
      setFormAcik(false);
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function tahsilEt(taksitId) {
    try {
      await api.put(`/taksit-detay/${taksitId}/tahsil-et`, { odeme_tarihi: new Date().toISOString().slice(0, 10) });
      const { data } = await api.get(`/taksitli-satis-planlari/${olusanPlan.id}/taksitler`);
      setTaksitler(data);
      vadesiGecenleriYukle();
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Buton onClick={() => setFormAcik((a) => !a)}>{formAcik ? 'Kapat' : '+ Yeni taksitli satış'}</Buton>
      </div>
      <HataMesaji>{hata}</HataMesaji>

      {formAcik && (
        <Kart style={{ marginBottom: 16 }}>
          <form onSubmit={kaydet} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Alan etiket="Müşteri cari ID">
              <input required type="number" value={form.musteri_cari_id} onChange={(e) => setForm((f) => ({ ...f, musteri_cari_id: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Stok seri no ID (opsiyonel)">
              <input type="number" value={form.stok_seri_no_id} onChange={(e) => setForm((f) => ({ ...f, stok_seri_no_id: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Toplam tutar (TL)">
              <input required type="number" step="0.01" value={form.toplam_tutar} onChange={(e) => setForm((f) => ({ ...f, toplam_tutar: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Peşinat (TL)">
              <input type="number" step="0.01" value={form.pesinat} onChange={(e) => setForm((f) => ({ ...f, pesinat: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Taksit sayısı">
              <input required type="number" min="1" value={form.taksit_sayisi} onChange={(e) => setForm((f) => ({ ...f, taksit_sayisi: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Başlangıç tarihi">
              <input required type="date" value={form.baslangic_tarihi} onChange={(e) => setForm((f) => ({ ...f, baslangic_tarihi: e.target.value }))} style={girdiStili} />
            </Alan>
            <div style={{ alignSelf: 'end' }}><Buton type="submit">Plan oluştur</Buton></div>
          </form>
        </Kart>
      )}

      {taksitler && (
        <Kart style={{ padding: 0, marginBottom: 16 }}>
          <div style={{ padding: '12px 16px', fontWeight: 600, fontSize: 13.5, borderBottom: '1px solid var(--kenarlik)' }}>
            Plan #{olusanPlan.id} — oluşturulan taksitler
          </div>
          <BasitTablo
            basliklar={['Taksit No', 'Vade', 'Tutar', 'Durum', '']}
            satirlar={taksitler}
            render={(t) => (
              <tr key={t.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                <td style={{ padding: '8px 16px' }}>{t.taksit_no}</td>
                <td style={{ padding: '8px 16px' }}>{t.vade_tarihi}</td>
                <td style={{ padding: '8px 16px' }}>{paraFormat(t.tutar)}</td>
                <td style={{ padding: '8px 16px' }}><Etiket ton={t.odendi_mi ? 'yesil' : 'amber'}>{t.odendi_mi ? 'Tahsil Edildi' : 'Bekliyor'}</Etiket></td>
                <td style={{ padding: '8px 16px' }}>
                  {!t.odendi_mi && (
                    <button onClick={() => tahsilEt(t.id)} style={{ background: 'none', border: 'none', color: 'var(--lacivert)', fontSize: 13 }}>Tahsil et</button>
                  )}
                </td>
              </tr>
            )}
          />
        </Kart>
      )}

      <Kart style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', fontWeight: 600, fontSize: 13.5, borderBottom: '1px solid var(--kenarlik)' }}>
          Vadesi geçen taksitler (tüm planlar)
        </div>
        <BasitTablo
          basliklar={['Taksit No', 'Vade', 'Tutar']}
          satirlar={vadesiGecenler}
          render={(t) => (
            <tr key={t.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
              <td style={{ padding: '10px 16px' }}>{t.taksit_no}</td>
              <td style={{ padding: '10px 16px', color: 'var(--kirmizi)' }}>{t.vade_tarihi}</td>
              <td style={{ padding: '10px 16px', fontWeight: 500 }}>{paraFormat(t.tutar)}</td>
            </tr>
          )}
        />
      </Kart>
    </div>
  );
}

// ============================================================== SABİT GİDERLER
function SabitGiderSekmesi() {
  const [liste, setListe] = useState([]);
  const [kategoriler, setKategoriler] = useState([]);
  const [formAcik, setFormAcik] = useState(false);
  const [form, setForm] = useState({ kategori_id: '', donem: new Date().toISOString().slice(0, 10), tutar: '', aciklama: '' });
  const [hata, setHata] = useState(null);

  function yukle() {
    api.get('/sabit-giderler').then((r) => setListe(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }
  useEffect(() => {
    yukle();
    api.get('/sabit-gider-kategorileri').then((r) => setKategoriler(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }, []);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    try {
      await api.post('/sabit-giderler', { ...form, kategori_id: Number(form.kategori_id), tutar: Number(form.tutar) });
      setFormAcik(false);
      yukle();
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function ode(giderId) {
    try {
      await api.put(`/sabit-giderler/${giderId}/ode`, { odeme_tarihi: new Date().toISOString().slice(0, 10) });
      yukle();
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  const kategoriAdi = (id) => kategoriler.find((k) => k.id === id)?.ad || '—';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Buton onClick={() => setFormAcik((a) => !a)}>{formAcik ? 'Kapat' : '+ Yeni gider'}</Buton>
      </div>
      <HataMesaji>{hata}</HataMesaji>

      {formAcik && (
        <Kart style={{ marginBottom: 16 }}>
          <form onSubmit={kaydet} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
            <Alan etiket="Kategori">
              <select required value={form.kategori_id} onChange={(e) => setForm((f) => ({ ...f, kategori_id: e.target.value }))} style={girdiStili}>
                <option value="">Seçin...</option>
                {kategoriler.map((k) => <option key={k.id} value={k.id}>{k.ad}</option>)}
              </select>
            </Alan>
            <Alan etiket="Dönem">
              <input required type="date" value={form.donem} onChange={(e) => setForm((f) => ({ ...f, donem: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Tutar (TL)">
              <input required type="number" step="0.01" value={form.tutar} onChange={(e) => setForm((f) => ({ ...f, tutar: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Açıklama">
              <input value={form.aciklama} onChange={(e) => setForm((f) => ({ ...f, aciklama: e.target.value }))} style={girdiStili} />
            </Alan>
            <div style={{ alignSelf: 'end' }}><Buton type="submit">Kaydet</Buton></div>
          </form>
        </Kart>
      )}

      <Kart style={{ padding: 0 }}>
        <BasitTablo
          basliklar={['Kategori', 'Dönem', 'Tutar', 'Açıklama', 'Durum', '']}
          satirlar={liste}
          render={(g) => (
            <tr key={g.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
              <td style={{ padding: '10px 16px', fontWeight: 500 }}>{kategoriAdi(g.kategori_id)}</td>
              <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{g.donem}</td>
              <td style={{ padding: '10px 16px' }}>{paraFormat(g.tutar)}</td>
              <td style={{ padding: '10px 16px' }}>{g.aciklama || '—'}</td>
              <td style={{ padding: '10px 16px' }}><Etiket ton={g.odendi_mi ? 'yesil' : 'amber'}>{g.odendi_mi ? 'Ödendi' : 'Bekliyor'}</Etiket></td>
              <td style={{ padding: '10px 16px' }}>
                {!g.odendi_mi && (
                  <button onClick={() => ode(g.id)} style={{ background: 'none', border: 'none', color: 'var(--lacivert)', fontSize: 13 }}>Öde</button>
                )}
              </td>
            </tr>
          )}
        />
      </Kart>
    </div>
  );
}

// ============================================================== ORTAK / DIŞ BORÇ
const BORC_TIP_METIN = { ORTAKTAN_ALINAN: 'Ortaktan Alınan', DISARIDAN_ALINAN: 'Dışarıdan Alınan', ORTAGA_VERILEN: 'Ortağa Verilen' };

function BorcSekmesi() {
  const [liste, setListe] = useState([]);
  const [formAcik, setFormAcik] = useState(false);
  const [form, setForm] = useState({ tip: 'ORTAKTAN_ALINAN', cari_id: '', tutar: '', para_birimi: 'TRY', alinma_tarihi: new Date().toISOString().slice(0, 10) });
  const [hata, setHata] = useState(null);
  const [bakiyeler, setBakiyeler] = useState({});

  function yukle() {
    api.get('/borclar').then((r) => setListe(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }
  useEffect(yukle, []);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    try {
      await api.post('/borclar', { ...form, cari_id: Number(form.cari_id), tutar: Number(form.tutar) });
      setFormAcik(false);
      yukle();
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function bakiyeyiGetir(borcId) {
    try {
      const { data } = await api.get(`/borclar/${borcId}/bakiye`);
      setBakiyeler((b) => ({ ...b, [borcId]: data }));
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function odemeEkle(borcId) {
    const tutar = window.prompt('Ödeme tutarı (TL):');
    if (!tutar) return;
    try {
      await api.post(`/borclar/${borcId}/odeme`, { tarih: new Date().toISOString().slice(0, 10), tutar: Number(tutar) });
      bakiyeyiGetir(borcId);
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Buton onClick={() => setFormAcik((a) => !a)}>{formAcik ? 'Kapat' : '+ Yeni borç kaydı'}</Buton>
      </div>
      <HataMesaji>{hata}</HataMesaji>

      {formAcik && (
        <Kart style={{ marginBottom: 16 }}>
          <form onSubmit={kaydet} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
            <Alan etiket="Tip">
              <select value={form.tip} onChange={(e) => setForm((f) => ({ ...f, tip: e.target.value }))} style={girdiStili}>
                <option value="ORTAKTAN_ALINAN">Ortaktan Alınan</option>
                <option value="DISARIDAN_ALINAN">Dışarıdan Alınan</option>
                <option value="ORTAGA_VERILEN">Ortağa Verilen</option>
              </select>
            </Alan>
            <Alan etiket="Cari ID">
              <input required type="number" value={form.cari_id} onChange={(e) => setForm((f) => ({ ...f, cari_id: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Tutar">
              <input required type="number" step="0.01" value={form.tutar} onChange={(e) => setForm((f) => ({ ...f, tutar: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Alınma tarihi">
              <input required type="date" value={form.alinma_tarihi} onChange={(e) => setForm((f) => ({ ...f, alinma_tarihi: e.target.value }))} style={girdiStili} />
            </Alan>
            <div style={{ alignSelf: 'end' }}><Buton type="submit">Kaydet</Buton></div>
          </form>
        </Kart>
      )}

      <Kart style={{ padding: 0 }}>
        <BasitTablo
          basliklar={['Tip', 'Cari ID', 'Toplam Borç', 'Kalan Bakiye', '']}
          satirlar={liste}
          render={(b) => (
            <tr key={b.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
              <td style={{ padding: '10px 16px' }}>{BORC_TIP_METIN[b.tip]}</td>
              <td style={{ padding: '10px 16px' }}>{b.cari_id}</td>
              <td style={{ padding: '10px 16px' }}>{paraFormat(b.tutar, b.para_birimi)}</td>
              <td style={{ padding: '10px 16px', fontWeight: 500 }}>
                {bakiyeler[b.id] ? paraFormat(bakiyeler[b.id].kalan_bakiye, b.para_birimi)
                  : <button onClick={() => bakiyeyiGetir(b.id)} style={{ background: 'none', border: 'none', color: 'var(--lacivert)', fontSize: 13 }}>Göster</button>}
              </td>
              <td style={{ padding: '10px 16px' }}>
                <button onClick={() => odemeEkle(b.id)} style={{ background: 'none', border: 'none', color: 'var(--lacivert)', fontSize: 13 }}>Ödeme ekle</button>
              </td>
            </tr>
          )}
        />
      </Kart>
    </div>
  );
}

export default function FinansalTakipSayfasi() {
  const [sekme, setSekme] = useState('cek');

  return (
    <div>
      <SayfaBasligi baslik="Finansal takip" aciklama="Çek, leasing, taksitli satış, kiralama, bakım, personel, sabit giderler ve borçlar" />
      <Sekmeler sekmeler={SEKMELER} aktif={sekme} onDegistir={setSekme} />

      {sekme === 'cek' && <CekSekmesi />}
      {sekme === 'leasing' && <LeasingSekmesi />}
      {sekme === 'taksit' && <TaksitSekmesi />}
      {sekme === 'kiralama' && <KiralamaSekmesi />}
      {sekme === 'bakim' && <BakimSekmesi />}
      {sekme === 'personel' && <PersonelSekmesi />}
      {sekme === 'gider' && <SabitGiderSekmesi />}
      {sekme === 'borc' && <BorcSekmesi />}
    </div>
  );
}
