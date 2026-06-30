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

      <Kart style={{ padding: 0 }}>
        <BasitTablo
          basliklar={['Ad Soyad', 'Pozisyon', 'Aylık Maaş']}
          satirlar={liste}
          render={(p) => (
            <tr key={p.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
              <td style={{ padding: '10px 16px', fontWeight: 500 }}>{p.ad_soyad}</td>
              <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{p.pozisyon || '—'}</td>
              <td style={{ padding: '10px 16px' }}>{p.aylik_maas != null ? paraFormat(p.aylik_maas) : '—'}</td>
            </tr>
          )}
        />
      </Kart>
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
            basliklar={['Taksit No', 'Vade', 'Tutar', 'Durum']}
            satirlar={seciliPlan.taksitler}
            render={(t) => (
              <tr key={t.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                <td style={{ padding: '8px 16px' }}>{t.taksit_no}</td>
                <td style={{ padding: '8px 16px' }}>{t.vade_tarihi}</td>
                <td style={{ padding: '8px 16px' }}>{paraFormat(t.tutar)}</td>
                <td style={{ padding: '8px 16px' }}><Etiket ton={t.odendi_mi ? 'yesil' : 'amber'}>{t.odendi_mi ? 'Ödendi' : 'Bekliyor'}</Etiket></td>
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

      <Kart style={{ padding: 0 }}>
        <BasitTablo
          basliklar={['Seri No ID', 'Kiracı', 'Aylık Kira', 'Durum']}
          satirlar={liste}
          render={(k) => (
            <tr key={k.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
              <td style={{ padding: '10px 16px' }}>{k.stok_seri_no_id}</td>
              <td style={{ padding: '10px 16px' }}>{k.kiraci_cari_id}</td>
              <td style={{ padding: '10px 16px' }}>{paraFormat(k.aylik_kira_tutari, k.para_birimi)}</td>
              <td style={{ padding: '10px 16px' }}><Etiket ton={k.durum === 'AKTIF' ? 'yesil' : 'notr'}>{k.durum}</Etiket></td>
            </tr>
          )}
        />
      </Kart>
    </div>
  );
}

// ============================================================== TAKSİTLİ SATIŞ (salt görüntüleme)
function TaksitSekmesi() {
  const [hata, setHata] = useState(null);
  const [vadesiGecenler, setVadesiGecenler] = useState([]);

  useEffect(() => {
    api.get('/taksitler/vadesi-gecenler').then((r) => setVadesiGecenler(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }, []);

  return (
    <div>
      <HataMesaji>{hata}</HataMesaji>
      <Kart style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', fontWeight: 600, fontSize: 13.5, borderBottom: '1px solid var(--kenarlik)' }}>
          Vadesi geçen taksitler
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

export default function FinansalTakipSayfasi() {
  const [sekme, setSekme] = useState('cek');

  return (
    <div>
      <SayfaBasligi baslik="Finansal takip" aciklama="Çek, leasing, taksitli satış, kiralama, bakım ve personel" />
      <Sekmeler sekmeler={SEKMELER} aktif={sekme} onDegistir={setSekme} />

      {sekme === 'cek' && <CekSekmesi />}
      {sekme === 'leasing' && <LeasingSekmesi />}
      {sekme === 'taksit' && <TaksitSekmesi />}
      {sekme === 'kiralama' && <KiralamaSekmesi />}
      {sekme === 'bakim' && <BakimSekmesi />}
      {sekme === 'personel' && <PersonelSekmesi />}
    </div>
  );
}
