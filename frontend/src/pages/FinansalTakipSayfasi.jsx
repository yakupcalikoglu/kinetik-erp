import { useEffect, useState, Fragment } from 'react';
import { api, hataMesajiCikar } from '../api/client';
import {
  Kart, SayfaBasligi, Buton, Etiket, Alan, girdiStili, BosDurum, HataMesaji, paraFormat, Sekmeler, eylemChipStili,
  OtomatikTamamlamaGirdisi,
} from '../components/Ortak';

const SEKMELER = [
  { deger: 'cek', etiket: 'Çek' },
  { deger: 'akreditif', etiket: 'Akreditif' },
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

function useCariHaritasi() {
  const [harita, setHarita] = useState({});
  useEffect(() => {
    api.get('/cariler')
      .then((r) => {
        const h = {};
        r.data.forEach((c) => { h[c.id] = c.unvan; });
        setHarita(h);
      })
      .catch(() => {});
  }, []);
  return harita;
}

function useHarcamaTurleri() {
  const [turler, setTurler] = useState([]);
  useEffect(() => {
    api.get('/harcama-turleri').then((r) => setTurler(r.data.map((t) => t.ad))).catch(() => {});
  }, []);
  return turler;
}

function cariGoster(id, harita) {
  if (id === null || id === undefined || id === '') return '—';
  const unvan = harita[id];
  return unvan ? `#${id} — ${unvan}` : `#${id}`;
}

async function odemeYontemiSor(paraBirimi = 'TRY') {
  const yanit = window.prompt('Ödeme yöntemi? "nakit" yazın ya da banka hesap ID girin:', 'nakit');
  if (yanit === null || yanit.trim() === '') return null;
  const temiz = yanit.trim().toLowerCase();

  if (temiz === 'nakit' || temiz === 'n') {
    if (paraBirimi === 'TRY') {
      return { odeme_yontemi: 'NAKIT', banka_hesap_id: null };
    }
    let onerilenKur = '';
    try {
      const { data } = await api.get(`/kur/${paraBirimi}`);
      onerilenKur = data.kur;
    } catch (e) { /* kur alinamadi, kullanici elle girecek */ }
    const girilenKur = window.prompt(
      `${paraBirimi} nakit ödeme — TL karşılığı için güncel kur (gerekirse değiştirin):`,
      onerilenKur
    );
    if (!girilenKur || Number.isNaN(Number(girilenKur))) {
      window.alert('Geçerli bir kur girmediniz, işlem iptal edildi.');
      return null;
    }
    return { odeme_yontemi: 'NAKIT', banka_hesap_id: null, kur: Number(girilenKur) };
  }

  const bankaId = Number(temiz);
  if (!bankaId || Number.isNaN(bankaId)) {
    window.alert('Geçersiz giriş. "nakit" yazın veya geçerli bir banka hesap ID girin.');
    return null;
  }
  return { odeme_yontemi: 'BANKA', banka_hesap_id: bankaId };
}

// ============================================================== ÇEK
const CEK_DURUM_TON = { PORTFOYDE: 'amber', CIRO_EDILDI: 'notr', TAHSIL_EDILDI: 'yesil', ODENDI: 'yesil', KARSILIKSIZ: 'kirmizi', IPTAL: 'kirmizi' };
const CEK_DURUM_METIN = { PORTFOYDE: 'Portföyde', CIRO_EDILDI: 'Ciro Edildi', TAHSIL_EDILDI: 'Tahsil Edildi', ODENDI: 'Ödendi', KARSILIKSIZ: 'Karşılıksız', IPTAL: 'İptal' };

function CekSekmesi() {
  const [cekler, setCekler] = useState([]);
  const [formAcik, setFormAcik] = useState(false);
  const [form, setForm] = useState({ tip: 'ALINAN', cek_no: '', banka_adi: '', cari_id: '', tutar: '', vade_tarihi: '', alinma_verilme_tarihi: '' });
  const [hata, setHata] = useState(null);
  const cariHaritasi = useCariHaritasi();

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

  async function tahsilEtVeyaOde(cek) {
    const secim = await odemeYontemiSor(cek.para_birimi);
    if (!secim) return;
    try {
      await api.put(`/cekler/${cek.id}/durum`, {
        yeni_durum: cek.tip === 'ALINAN' ? 'TAHSIL_EDILDI' : 'ODENDI',
        ...secim,
      });
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
          basliklar={['Çek No', 'Tip', 'Banka', 'Cari', 'Tutar', 'Vade', 'Durum', 'İşlem']}
          satirlar={cekler}
          render={(c) => (
            <tr key={c.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
              <td style={{ padding: '10px 16px' }}>{c.cek_no || '—'}</td>
              <td style={{ padding: '10px 16px' }}>{c.tip === 'ALINAN' ? 'Alınan' : 'Verilen'}</td>
              <td style={{ padding: '10px 16px' }}>{c.banka_adi || '—'}</td>
              <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{cariGoster(c.cari_id, cariHaritasi)}</td>
              <td style={{ padding: '10px 16px' }}>{paraFormat(c.tutar)}</td>
              <td style={{ padding: '10px 16px' }}>{c.vade_tarihi}</td>
              <td style={{ padding: '10px 16px' }}><Etiket ton={CEK_DURUM_TON[c.durum]}>{CEK_DURUM_METIN[c.durum]}</Etiket></td>
              <td style={{ padding: '10px 16px' }}>
                {c.durum === 'PORTFOYDE' && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => ciroEt(c.id)} style={eylemChipStili('lacivert')}>Ciro et</button>
                    <button onClick={() => tahsilEtVeyaOde(c)} style={eylemChipStili('yesil')}>
                      {c.tip === 'ALINAN' ? 'Tahsil et' : 'Öde'}
                    </button>
                  </div>
                )}
              </td>
            </tr>
          )}
        />
      </Kart>
    </div>
  );
}

// ============================================================== AKREDİTİF
const AKREDITIF_DURUM_TON = { ACIK: 'amber', KISMI_ODENDI: 'amber', KAPANDI: 'yesil', IPTAL: 'kirmizi' };
const AKREDITIF_DURUM_METIN = { ACIK: 'Açık', KISMI_ODENDI: 'Kısmi Ödendi', KAPANDI: 'Kapandı', IPTAL: 'İptal' };
const AKREDITIF_KALEM_TIP_METIN = { ODEME: 'Ödeme', KOMISYON: 'Komisyon', MASRAF: 'Masraf' };

function MaliyetDagitimFormu({ akreditif, onKapat, onTamamlandi }) {
  const [urunler, setUrunler] = useState([]);
  const [seciliUrunIdleri, setSeciliUrunIdleri] = useState([]);
  const [yontem, setYontem] = useState('ESIT');
  const [kur, setKur] = useState('1');
  const [gecmis, setGecmis] = useState([]);
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  function gecmisiYukle() {
    api.get(`/akreditifler/${akreditif.id}/maliyet-dagitimlari`).then((r) => setGecmis(r.data)).catch(() => {});
  }

  useEffect(() => {
    api.get(`/akreditifler/${akreditif.id}/urun-secenekleri`)
      .then((r) => {
        setUrunler(r.data);
        setSeciliUrunIdleri(r.data.map((u) => u.stok_seri_no_id));
      })
      .catch((e) => setHata(hataMesajiCikar(e)));
    gecmisiYukle();
    if (akreditif.para_birimi !== 'TRY') {
      api.get(`/kur/${akreditif.para_birimi}`).then((r) => setKur(r.data.kur)).catch(() => {});
    }
  }, [akreditif.id]); // eslint-disable-line

  function urunSecimDegistir(id) {
    setSeciliUrunIdleri((mevcut) => (mevcut.includes(id) ? mevcut.filter((x) => x !== id) : [...mevcut, id]));
  }

  async function dagit(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      const { data } = await api.post(`/akreditifler/${akreditif.id}/maliyet-dagit`, {
        yontem, kur: Number(kur), stok_seri_no_idleri: seciliUrunIdleri,
      });
      window.alert(`${data.dagitilan_urun_sayisi} ürüne toplam ${paraFormat(data.toplam_dagitilan_try)} dağıtıldı.`);
      gecmisiYukle();
      onTamamlandi();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  async function geriAl(dagitimId) {
    if (!window.confirm('Bu dağıtımı geri almak istediğinize emin misiniz? Tutar, ürünün maliyetinden düşülecek.')) return;
    try {
      await api.delete(`/akreditif-maliyet-dagitimlari/${dagitimId}`);
      gecmisiYukle();
      onTamamlandi();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  return (
    <Kart style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600 }}>Komisyon/masrafı ürünlere dağıt</div>
        <Buton variant="ikincil" onClick={onKapat}>Kapat</Buton>
      </div>
      <HataMesaji>{hata}</HataMesaji>

      <form onSubmit={dagit}>
        <div style={{ display: 'grid', gridTemplateColumns: akreditif.para_birimi !== 'TRY' ? '1fr 1fr' : '1fr', gap: 12, marginBottom: 14 }}>
          <Alan etiket="Dağıtım yöntemi">
            <select value={yontem} onChange={(e) => setYontem(e.target.value)} style={girdiStili}>
              <option value="ESIT">Eşit (ürün adedine göre)</option>
              <option value="AGIRLIKLI">Ağırlıklı (satınalma maliyetine göre)</option>
            </select>
          </Alan>
          {akreditif.para_birimi !== 'TRY' && (
            <Alan etiket={`${akreditif.para_birimi} için TL kuru (otomatik, elle değiştirilebilir)`}>
              <input type="number" step="0.0001" value={kur} onChange={(e) => setKur(e.target.value)} style={girdiStili} />
            </Alan>
          )}
        </div>

        <div style={{ marginBottom: 6, fontSize: 12.5, color: 'var(--metin-ikincil)' }}>
          Dağıtılacak ürünler (varsayılan: tümü seçili)
        </div>
        <div style={{ border: '1px solid var(--kenarlik)', borderRadius: 7, maxHeight: 220, overflowY: 'auto', marginBottom: 14 }}>
          {urunler.length === 0 ? (
            <div style={{ padding: 14, color: 'var(--metin-soluk)', fontSize: 13 }}>Bu siparişe ait ürün bulunamadı.</div>
          ) : (
            urunler.map((u) => (
              <label key={u.stok_seri_no_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--kenarlik)', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={seciliUrunIdleri.includes(u.stok_seri_no_id)}
                  onChange={() => urunSecimDegistir(u.stok_seri_no_id)}
                />
                <span style={{ fontFamily: 'var(--font-mono)' }}>{u.seri_no}</span>
                <span style={{ color: 'var(--metin-ikincil)', marginLeft: 'auto' }}>
                  Satınalma: {u.satinalma_maliyeti_try != null ? paraFormat(u.satinalma_maliyeti_try) : '—'}
                  {u.mevcut_diger_maliyet_try ? ` · Mevcut diğer maliyet: ${paraFormat(u.mevcut_diger_maliyet_try)}` : ''}
                </span>
              </label>
            ))
          )}
        </div>

        <Buton type="submit" disabled={kaydediliyor || seciliUrunIdleri.length === 0}>
          {kaydediliyor ? 'Dağıtılıyor...' : 'Dağıt'}
        </Buton>
      </form>

      {gecmis.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Dağıtım geçmişi</div>
          <table>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                {['Ürün', 'Yöntem', 'Kur', 'Tutar (TL)', 'Tarih', ''].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--metin-ikincil)' }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gecmis.map((g) => (
                <tr key={g.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                  <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)' }}>{g.seri_no || `#${g.stok_seri_no_id}`}</td>
                  <td style={{ padding: '8px 12px' }}>{g.yontem === 'ESIT' ? 'Eşit' : 'Ağırlıklı'}</td>
                  <td style={{ padding: '8px 12px' }}>{g.kur ?? '—'}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 500 }}>{paraFormat(g.tutar_try)}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--metin-ikincil)' }}>{g.olusturma_tarihi ? g.olusturma_tarihi.slice(0, 10) : '—'}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <button onClick={() => geriAl(g.id)} style={eylemChipStili('kirmizi')}>Geri Al</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Kart>
  );
}

function AkreditifKalemOdemeFormu({ kalem, akreditif, onKaydedildi, onVazgec }) {
  const [bankaHesaplari, setBankaHesaplari] = useState([]);
  const [form, setForm] = useState({
    odeme_yontemi: 'BANKA', banka_hesap_id: '', odeme_tarihi: new Date().toISOString().slice(0, 10), kur: '1',
  });
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => {
    api.get('/banka-bakiyeleri').then((r) => setBankaHesaplari(r.data)).catch(() => {});
    if (akreditif.para_birimi !== 'TRY') {
      api.get(`/kur/${akreditif.para_birimi}`).then((r) => setForm((f) => ({ ...f, kur: r.data.kur }))).catch(() => {});
    }
  }, []); // eslint-disable-line

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      await api.put(`/akreditif-kalemleri/${kalem.id}/ode`, {
        odeme_tarihi: form.odeme_tarihi,
        odeme_yontemi: form.odeme_yontemi,
        banka_hesap_id: form.odeme_yontemi === 'BANKA' ? Number(form.banka_hesap_id) : null,
        kur: form.odeme_yontemi === 'NAKIT' && akreditif.para_birimi !== 'TRY' ? Number(form.kur) : null,
      });
      onKaydedildi();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  return (
    <tr>
      <td colSpan={6} style={{ padding: 0 }}>
        <div style={{ padding: 16, background: 'var(--zemin)' }}>
          <form onSubmit={kaydet}>
            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>
              Kalemi öde — {paraFormat(kalem.tutar, akreditif.para_birimi)}
            </div>
            <HataMesaji>{hata}</HataMesaji>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
              <Alan etiket="Ödeme yöntemi">
                <select value={form.odeme_yontemi} onChange={(e) => setForm((f) => ({ ...f, odeme_yontemi: e.target.value }))} style={girdiStili}>
                  <option value="BANKA">Banka</option>
                  <option value="NAKIT">Nakit (Ana Kasa)</option>
                </select>
              </Alan>
              {form.odeme_yontemi === 'BANKA' ? (
                <Alan etiket="Banka hesabı">
                  <select required value={form.banka_hesap_id} onChange={(e) => setForm((f) => ({ ...f, banka_hesap_id: e.target.value }))} style={girdiStili}>
                    <option value="">Seçin...</option>
                    {bankaHesaplari.map((h) => (
                      <option key={h.banka_hesap_id} value={h.banka_hesap_id}>
                        {h.banka_adi} — {h.hesap_adi || h.para_birimi} ({h.para_birimi})
                      </option>
                    ))}
                  </select>
                </Alan>
              ) : akreditif.para_birimi !== 'TRY' && (
                <Alan etiket={`${akreditif.para_birimi} için TL kuru (otomatik, elle değiştirilebilir)`}>
                  <input required type="number" step="0.0001" value={form.kur} onChange={(e) => setForm((f) => ({ ...f, kur: e.target.value }))} style={girdiStili} />
                </Alan>
              )}
              <Alan etiket="Ödeme tarihi">
                <input required type="date" value={form.odeme_tarihi} onChange={(e) => setForm((f) => ({ ...f, odeme_tarihi: e.target.value }))} style={girdiStili} />
              </Alan>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : 'Ödemeyi tamamla'}</Buton>
              <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
            </div>
          </form>
        </div>
      </td>
    </tr>
  );
}

function AkreditifKalemDuzenleFormu({ kalem, onKaydedildi, onVazgec }) {
  const [form, setForm] = useState({
    tip: kalem.tip, aciklama: kalem.aciklama || '', tutar: kalem.tutar, vade_tarihi: kalem.vade_tarihi,
  });
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      await api.put(`/akreditif-kalemleri/${kalem.id}`, { ...form, tutar: Number(form.tutar) });
      onKaydedildi();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  return (
    <tr>
      <td colSpan={6} style={{ padding: 0 }}>
        <div style={{ padding: 16, background: 'var(--zemin)' }}>
          <form onSubmit={kaydet}>
            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>Kalemi düzenle</div>
            <HataMesaji>{hata}</HataMesaji>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
              <Alan etiket="Tip">
                <select value={form.tip} onChange={(e) => setForm((f) => ({ ...f, tip: e.target.value }))} style={girdiStili}>
                  <option value="ODEME">Ödeme</option>
                  <option value="KOMISYON">Komisyon</option>
                  <option value="MASRAF">Masraf</option>
                </select>
              </Alan>
              <Alan etiket="Açıklama">
                <input value={form.aciklama} onChange={(e) => setForm((f) => ({ ...f, aciklama: e.target.value }))} style={girdiStili} />
              </Alan>
              <Alan etiket="Tutar">
                <input required type="number" step="0.01" value={form.tutar} onChange={(e) => setForm((f) => ({ ...f, tutar: e.target.value }))} style={girdiStili} />
              </Alan>
              <Alan etiket="Vade tarihi">
                <input required type="date" value={form.vade_tarihi} onChange={(e) => setForm((f) => ({ ...f, vade_tarihi: e.target.value }))} style={girdiStili} />
              </Alan>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : 'Değişiklikleri kaydet'}</Buton>
              <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
            </div>
          </form>
        </div>
      </td>
    </tr>
  );
}

function TaksitDuzenleFormu({ taksit, onKaydedildi, onVazgec }) {
  const [form, setForm] = useState({ vade_tarihi: taksit.vade_tarihi, tutar: taksit.tutar });
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      await api.put(`/akreditif-kalem-taksitleri/${taksit.id}`, { ...form, tutar: Number(form.tutar) });
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
          <form onSubmit={kaydet}>
            <HataMesaji>{hata}</HataMesaji>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Alan etiket="Vade tarihi">
                <input required type="date" value={form.vade_tarihi} onChange={(e) => setForm((f) => ({ ...f, vade_tarihi: e.target.value }))} style={girdiStili} />
              </Alan>
              <Alan etiket="Tutar">
                <input required type="number" step="0.01" value={form.tutar} onChange={(e) => setForm((f) => ({ ...f, tutar: e.target.value }))} style={girdiStili} />
              </Alan>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : 'Kaydet'}</Buton>
              <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
            </div>
          </form>
        </div>
      </td>
    </tr>
  );
}

function TaksitOdemeFormu({ taksit, akreditif, onKaydedildi, onVazgec }) {
  const [bankaHesaplari, setBankaHesaplari] = useState([]);
  const [form, setForm] = useState({
    odeme_yontemi: 'BANKA', banka_hesap_id: '', odeme_tarihi: new Date().toISOString().slice(0, 10), kur: '1',
  });
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => {
    api.get('/banka-bakiyeleri').then((r) => setBankaHesaplari(r.data)).catch(() => {});
    if (akreditif.para_birimi !== 'TRY') {
      api.get(`/kur/${akreditif.para_birimi}`).then((r) => setForm((f) => ({ ...f, kur: r.data.kur }))).catch(() => {});
    }
  }, []); // eslint-disable-line

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      await api.put(`/akreditif-kalem-taksitleri/${taksit.id}/ode`, {
        odeme_tarihi: form.odeme_tarihi,
        odeme_yontemi: form.odeme_yontemi,
        banka_hesap_id: form.odeme_yontemi === 'BANKA' ? Number(form.banka_hesap_id) : null,
        kur: form.odeme_yontemi === 'NAKIT' && akreditif.para_birimi !== 'TRY' ? Number(form.kur) : null,
      });
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
          <form onSubmit={kaydet}>
            <HataMesaji>{hata}</HataMesaji>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <Alan etiket="Ödeme yöntemi">
                <select value={form.odeme_yontemi} onChange={(e) => setForm((f) => ({ ...f, odeme_yontemi: e.target.value }))} style={girdiStili}>
                  <option value="BANKA">Banka</option>
                  <option value="NAKIT">Nakit (Ana Kasa)</option>
                </select>
              </Alan>
              {form.odeme_yontemi === 'BANKA' ? (
                <Alan etiket="Banka hesabı">
                  <select required value={form.banka_hesap_id} onChange={(e) => setForm((f) => ({ ...f, banka_hesap_id: e.target.value }))} style={girdiStili}>
                    <option value="">Seçin...</option>
                    {bankaHesaplari.map((h) => (
                      <option key={h.banka_hesap_id} value={h.banka_hesap_id}>
                        {h.banka_adi} — {h.hesap_adi || h.para_birimi} ({h.para_birimi})
                      </option>
                    ))}
                  </select>
                </Alan>
              ) : akreditif.para_birimi !== 'TRY' && (
                <Alan etiket="Kur">
                  <input required type="number" step="0.0001" value={form.kur} onChange={(e) => setForm((f) => ({ ...f, kur: e.target.value }))} style={girdiStili} />
                </Alan>
              )}
              <Alan etiket="Ödeme tarihi">
                <input required type="date" value={form.odeme_tarihi} onChange={(e) => setForm((f) => ({ ...f, odeme_tarihi: e.target.value }))} style={girdiStili} />
              </Alan>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : 'Taksidi öde'}</Buton>
              <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
            </div>
          </form>
        </div>
      </td>
    </tr>
  );
}

function TaksitlendirFormu({ kalem, onTamamlandi, onVazgec }) {
  const [form, setForm] = useState({ taksit_sayisi: 3, ek_ucret: '0', ilk_vade_tarihi: new Date().toISOString().slice(0, 10) });
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      await api.post(`/akreditif-kalemleri/${kalem.id}/taksitlendir`, {
        taksit_sayisi: Number(form.taksit_sayisi),
        ek_ucret: Number(form.ek_ucret || 0),
        ilk_vade_tarihi: form.ilk_vade_tarihi,
      });
      onTamamlandi();
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
          <form onSubmit={kaydet}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              Taksitlendir — finansman sıkıntısında ek ücret karşılığında böl
            </div>
            <HataMesaji>{hata}</HataMesaji>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <Alan etiket="Taksit sayısı">
                <input required type="number" min="2" value={form.taksit_sayisi} onChange={(e) => setForm((f) => ({ ...f, taksit_sayisi: e.target.value }))} style={girdiStili} />
              </Alan>
              <Alan etiket="Ek ücret (taksitlendirme bedeli)">
                <input type="number" step="0.01" value={form.ek_ucret} onChange={(e) => setForm((f) => ({ ...f, ek_ucret: e.target.value }))} style={girdiStili} />
              </Alan>
              <Alan etiket="İlk taksit vade tarihi">
                <input required type="date" value={form.ilk_vade_tarihi} onChange={(e) => setForm((f) => ({ ...f, ilk_vade_tarihi: e.target.value }))} style={girdiStili} />
              </Alan>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Oluşturuluyor...' : 'Taksitlendir'}</Buton>
              <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
            </div>
          </form>
        </div>
      </td>
    </tr>
  );
}

function KalemTaksitPaneli({ kalem, akreditif, onKapat }) {
  const [taksitler, setTaksitler] = useState(null);
  const [taksitlendirFormuAcik, setTaksitlendirFormuAcik] = useState(false);
  const [odemeYapilacakTaksitId, setOdemeYapilacakTaksitId] = useState(null);
  const [duzenlenenTaksitId, setDuzenlenenTaksitId] = useState(null);
  const [hata, setHata] = useState(null);

  async function taksitiSil(taksitId) {
    if (!window.confirm('Bu taksidi silmek istediğinize emin misiniz?')) return;
    try {
      await api.delete(`/akreditif-kalem-taksitleri/${taksitId}`);
      yukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  async function taksitOdemesiniGeriAl(taksitId) {
    if (!window.confirm('Bu taksidin ödemesini geri almak istediğinize emin misiniz? Oluşan Kasa/Banka hareketi silinecek.')) return;
    try {
      await api.put(`/akreditif-kalem-taksitleri/${taksitId}/odemeyi-geri-al`);
      yukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  function yukle() {
    api.get(`/akreditif-kalemleri/${kalem.id}/taksitler`)
      .then((r) => setTaksitler(r.data))
      .catch((e) => setHata(hataMesajiCikar(e)));
  }
  useEffect(yukle, [kalem.id]); // eslint-disable-line

  return (
    <tr>
      <td colSpan={6} style={{ padding: 0 }}>
        <div style={{ padding: 14, background: 'var(--zemin)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Taksitler — {kalem.aciklama || AKREDITIF_KALEM_TIP_METIN[kalem.tip]}</div>
            <Buton variant="ikincil" onClick={onKapat}>Kapat</Buton>
          </div>
          <HataMesaji>{hata}</HataMesaji>

          {taksitler === null ? (
            <div style={{ color: 'var(--metin-soluk)', fontSize: 13 }}>Yükleniyor...</div>
          ) : taksitler.length === 0 ? (
            taksitlendirFormuAcik ? (
              <table><tbody>
                <TaksitlendirFormu kalem={kalem} onTamamlandi={() => { setTaksitlendirFormuAcik(false); yukle(); }} onVazgec={() => setTaksitlendirFormuAcik(false)} />
              </tbody></table>
            ) : (
              <div>
                <div style={{ fontSize: 13, color: 'var(--metin-ikincil)', marginBottom: 10 }}>Bu kalem henüz taksitlendirilmemiş.</div>
                <Buton onClick={() => setTaksitlendirFormuAcik(true)}>Taksitlendir</Buton>
              </div>
            )
          ) : (
            <table>
              <thead>
                <tr style={{ background: 'white' }}>
                  {['Taksit No', 'Vade', 'Tutar', 'Durum'].map((b) => (
                    <th key={b} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 12, color: 'var(--metin-ikincil)' }}>{b}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {taksitler.map((t) => {
                  if (duzenlenenTaksitId === t.id) {
                    return (
                      <TaksitDuzenleFormu
                        key={t.id}
                        taksit={t}
                        onKaydedildi={() => { setDuzenlenenTaksitId(null); yukle(); }}
                        onVazgec={() => setDuzenlenenTaksitId(null)}
                      />
                    );
                  }
                  return (
                    <Fragment key={t.id}>
                      <tr style={{ borderTop: '1px solid var(--kenarlik)' }}>
                        <td style={{ padding: '8px 10px' }}>{t.taksit_no}</td>
                        <td style={{ padding: '8px 10px' }}>{t.vade_tarihi}</td>
                        <td style={{ padding: '8px 10px' }}>{paraFormat(t.tutar, akreditif.para_birimi)}</td>
                        <td style={{ padding: '8px 10px' }}>
                          {t.odendi_mi ? (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <Etiket ton="yesil">Ödendi</Etiket>
                              <button onClick={() => taksitOdemesiniGeriAl(t.id)} style={eylemChipStili('kirmizi')}>Ödemeyi Geri Al</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                onClick={() => setOdemeYapilacakTaksitId((mevcut) => (mevcut === t.id ? null : t.id))}
                                style={eylemChipStili('lacivert')}
                              >
                                {odemeYapilacakTaksitId === t.id ? 'Kapat' : 'Öde'}
                              </button>
                              <button onClick={() => setDuzenlenenTaksitId(t.id)} style={eylemChipStili('lacivert')}>Düzenle</button>
                              <button onClick={() => taksitiSil(t.id)} style={eylemChipStili('kirmizi')}>Sil</button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {odemeYapilacakTaksitId === t.id && (
                        <TaksitOdemeFormu
                          taksit={t}
                          akreditif={akreditif}
                          onKaydedildi={() => { setOdemeYapilacakTaksitId(null); yukle(); }}
                          onVazgec={() => setOdemeYapilacakTaksitId(null)}
                        />
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </td>
    </tr>
  );
}

function AkreditifSekmesi() {
  const [liste, setListe] = useState([]);
  const [siparisler, setSiparisler] = useState([]);
  const [bankaHesaplari, setBankaHesaplari] = useState([]);
  const [formAcik, setFormAcik] = useState(false);
  const [duzenlenenAkreditif, setDuzenlenenAkreditif] = useState(null);
  const [form, setForm] = useState({
    siparis_id: '', banka_hesap_id: '', akreditif_no: '', tip: 'VADELI',
    para_birimi: 'USD', tutar: '', acilis_tarihi: new Date().toISOString().slice(0, 10),
    vade_tarihi: '', notlar: '',
  });
  const [hata, setHata] = useState(null);
  const [seciliAkreditif, setSeciliAkreditif] = useState(null);
  const [kalemler, setKalemler] = useState(null);
  const [kalemForm, setKalemForm] = useState({ tip: 'ODEME', aciklama: '', tutar: '', vade_tarihi: new Date().toISOString().slice(0, 10) });
  const [dagitimFormuAcik, setDagitimFormuAcik] = useState(false);
  const [odemeYapilacakKalemId, setOdemeYapilacakKalemId] = useState(null);
  const [taksitPaneliAcikKalemId, setTaksitPaneliAcikKalemId] = useState(null);
  const [duzenlenenKalemId, setDuzenlenenKalemId] = useState(null);

  function yukle() {
    api.get('/akreditifler').then((r) => setListe(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }
  useEffect(() => {
    yukle();
    api.get('/siparisler').then((r) => setSiparisler(r.data)).catch(() => {});
    api.get('/banka-hesaplari').then((r) => setBankaHesaplari(r.data)).catch(() => {});
  }, []);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    try {
      const govde = {
        ...form,
        siparis_id: Number(form.siparis_id),
        banka_hesap_id: Number(form.banka_hesap_id),
        tutar: Number(form.tutar),
        vade_tarihi: form.vade_tarihi || null,
      };
      if (duzenlenenAkreditif) {
        await api.put(`/akreditifler/${duzenlenenAkreditif.id}`, govde);
      } else {
        await api.post('/akreditifler', govde);
      }
      setFormAcik(false);
      setDuzenlenenAkreditif(null);
      yukle();
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  function duzenle(a) {
    setDuzenlenenAkreditif(a);
    setForm({
      siparis_id: String(a.siparis_id),
      banka_hesap_id: String(a.banka_hesap_id),
      akreditif_no: a.akreditif_no || '',
      tip: a.tip,
      para_birimi: a.para_birimi,
      tutar: a.tutar,
      acilis_tarihi: a.acilis_tarihi,
      vade_tarihi: a.vade_tarihi || '',
      notlar: a.notlar || '',
    });
    setFormAcik(true);
  }

  function formuKapat() {
    setFormAcik(false);
    setDuzenlenenAkreditif(null);
    setForm({
      siparis_id: '', banka_hesap_id: '', akreditif_no: '', tip: 'VADELI',
      para_birimi: 'USD', tutar: '', acilis_tarihi: new Date().toISOString().slice(0, 10),
      vade_tarihi: '', notlar: '',
    });
  }

  async function akreditifiSil(a) {
    if (!window.confirm(`${a.akreditif_no || '#' + a.id} akreditifini silmek istediğinize emin misiniz?`)) return;
    try {
      await api.delete(`/akreditifler/${a.id}`);
      yukle();
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function kalemleriGoster(akreditifId) {
    try {
      const { data } = await api.get(`/akreditifler/${akreditifId}`);
      setSeciliAkreditif(data);
      setKalemler(data.kalemler);
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function kalemEkle(e) {
    e.preventDefault();
    try {
      await api.post(`/akreditifler/${seciliAkreditif.id}/kalem`, { ...kalemForm, tutar: Number(kalemForm.tutar) });
      kalemleriGoster(seciliAkreditif.id);
      setKalemForm({ tip: 'ODEME', aciklama: '', tutar: '', vade_tarihi: new Date().toISOString().slice(0, 10) });
      yukle();
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function kalemiSil(kalemId) {
    if (!window.confirm('Bu kalemi silmek istediğinize emin misiniz?')) return;
    try {
      await api.delete(`/akreditif-kalemleri/${kalemId}`);
      kalemleriGoster(seciliAkreditif.id);
      yukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  async function kalemOdemesiniGeriAl(kalemId) {
    if (!window.confirm('Bu kalemin ödemesini geri almak istediğinize emin misiniz? Oluşan Kasa/Banka hareketi silinecek.')) return;
    try {
      await api.put(`/akreditif-kalemleri/${kalemId}/odemeyi-geri-al`);
      kalemleriGoster(seciliAkreditif.id);
      yukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  function siparisEtiketi(id) {
    const s = siparisler.find((x) => x.id === id);
    return s ? s.siparis_no : `#${id}`;
  }

  function bankaEtiketi(id) {
    const b = bankaHesaplari.find((x) => x.id === id);
    return b ? `${b.banka_adi} — ${b.hesap_adi || b.para_birimi}` : `#${id}`;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Buton onClick={() => (formAcik ? formuKapat() : setFormAcik(true))}>{formAcik ? 'Kapat' : '+ Yeni akreditif'}</Buton>
      </div>
      <HataMesaji>{hata}</HataMesaji>

      {formAcik && (
        <Kart style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 14 }}>
            {duzenlenenAkreditif ? `Akreditifi düzenle — ${duzenlenenAkreditif.akreditif_no || '#' + duzenlenenAkreditif.id}` : 'Yeni akreditif'}
          </div>
          <form onSubmit={kaydet} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Alan etiket="Sipariş">
              <select required value={form.siparis_id} onChange={(e) => setForm((f) => ({ ...f, siparis_id: e.target.value }))} style={girdiStili}>
                <option value="">Seçiniz...</option>
                {siparisler.map((s) => <option key={s.id} value={s.id}>{s.siparis_no}</option>)}
              </select>
            </Alan>
            <Alan etiket="Banka hesabı">
              <select required value={form.banka_hesap_id} onChange={(e) => setForm((f) => ({ ...f, banka_hesap_id: e.target.value }))} style={girdiStili}>
                <option value="">Seçiniz...</option>
                {bankaHesaplari.map((b) => (
                  <option key={b.id} value={b.id}>{b.banka_adi} — {b.hesap_adi || b.para_birimi}</option>
                ))}
              </select>
            </Alan>
            <Alan etiket="Akreditif no">
              <input value={form.akreditif_no} onChange={(e) => setForm((f) => ({ ...f, akreditif_no: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Tip">
              <select value={form.tip} onChange={(e) => setForm((f) => ({ ...f, tip: e.target.value }))} style={girdiStili}>
                <option value="GORULDUGUNDE">Görüldüğünde</option>
                <option value="VADELI">Vadeli</option>
              </select>
            </Alan>
            <Alan etiket="Para birimi">
              <select value={form.para_birimi} onChange={(e) => setForm((f) => ({ ...f, para_birimi: e.target.value }))} style={girdiStili}>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="TRY">TRY</option>
              </select>
            </Alan>
            <Alan etiket="Tutar">
              <input required type="number" step="0.01" value={form.tutar} onChange={(e) => setForm((f) => ({ ...f, tutar: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Açılış tarihi">
              <input required type="date" value={form.acilis_tarihi} onChange={(e) => setForm((f) => ({ ...f, acilis_tarihi: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Vade / son geçerlilik tarihi">
              <input type="date" value={form.vade_tarihi} onChange={(e) => setForm((f) => ({ ...f, vade_tarihi: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Notlar">
              <input value={form.notlar} onChange={(e) => setForm((f) => ({ ...f, notlar: e.target.value }))} style={girdiStili} />
            </Alan>
            <div style={{ alignSelf: 'end' }}>
              <Buton type="submit">{duzenlenenAkreditif ? 'Değişiklikleri kaydet' : 'Kaydet'}</Buton>
            </div>
          </form>
        </Kart>
      )}

      <Kart style={{ padding: 0, marginBottom: 16 }}>
        <BasitTablo
          basliklar={['Akreditif No', 'Sipariş', 'Banka', 'Tutar', 'Açılış', 'Vade', 'Durum', 'İşlem']}
          satirlar={liste}
          render={(a) => (
            <tr key={a.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
              <td style={{ padding: '10px 16px', fontWeight: 500 }}>{a.akreditif_no || `#${a.id}`}</td>
              <td style={{ padding: '10px 16px' }}>{siparisEtiketi(a.siparis_id)}</td>
              <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{bankaEtiketi(a.banka_hesap_id)}</td>
              <td style={{ padding: '10px 16px' }}>{paraFormat(a.tutar, a.para_birimi)}</td>
              <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{a.acilis_tarihi}</td>
              <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{a.vade_tarihi || '—'}</td>
              <td style={{ padding: '10px 16px' }}><Etiket ton={AKREDITIF_DURUM_TON[a.durum]}>{AKREDITIF_DURUM_METIN[a.durum]}</Etiket></td>
              <td style={{ padding: '10px 16px' }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button onClick={() => kalemleriGoster(a.id)} style={eylemChipStili('lacivert')}>Kalemler</button>
                  <button onClick={() => duzenle(a)} style={eylemChipStili('lacivert')}>Düzenle</button>
                  <button onClick={() => akreditifiSil(a)} style={eylemChipStili('kirmizi')}>Sil</button>
                </div>
              </td>
            </tr>
          )}
        />
      </Kart>

      {seciliAkreditif && (
        <Kart>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>
              {seciliAkreditif.akreditif_no || `Akreditif #${seciliAkreditif.id}`} — ödeme/komisyon kalemleri
            </div>
            <button onClick={() => setDagitimFormuAcik((a) => !a)} style={eylemChipStili('lacivert')}>
              {dagitimFormuAcik ? 'Dağıtım formunu kapat' : 'Komisyon/masrafı ürünlere dağıt'}
            </button>
          </div>

          {dagitimFormuAcik && (
            <MaliyetDagitimFormu
              akreditif={seciliAkreditif}
              onKapat={() => setDagitimFormuAcik(false)}
              onTamamlandi={() => kalemleriGoster(seciliAkreditif.id)}
            />
          )}

          <form onSubmit={kalemEkle} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 10, marginBottom: 14 }}>
            <Alan etiket="Tip">
              <select value={kalemForm.tip} onChange={(e) => setKalemForm((f) => ({ ...f, tip: e.target.value }))} style={girdiStili}>
                <option value="ODEME">Ödeme</option>
                <option value="KOMISYON">Komisyon</option>
                <option value="MASRAF">Masraf</option>
              </select>
            </Alan>
            <Alan etiket="Açıklama">
              <input value={kalemForm.aciklama} onChange={(e) => setKalemForm((f) => ({ ...f, aciklama: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Tutar">
              <input required type="number" step="0.01" value={kalemForm.tutar} onChange={(e) => setKalemForm((f) => ({ ...f, tutar: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Vade tarihi">
              <input required type="date" value={kalemForm.vade_tarihi} onChange={(e) => setKalemForm((f) => ({ ...f, vade_tarihi: e.target.value }))} style={girdiStili} />
            </Alan>
            <div style={{ alignSelf: 'end' }}><Buton type="submit">Ekle</Buton></div>
          </form>

          {kalemler && (
            kalemler.length === 0 ? <BosDurum baslik="Henüz kalem eklenmedi" /> : (
              <table>
                <thead>
                  <tr style={{ background: 'var(--zemin)' }}>
                    {['Tip', 'Açıklama', 'Tutar', 'Vade', 'Durum', ''].map((b) => (
                      <th key={b} style={{ textAlign: 'left', padding: '8px 0', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>{b}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {kalemler.map((k) => {
                    if (duzenlenenKalemId === k.id) {
                      return (
                        <AkreditifKalemDuzenleFormu
                          key={k.id}
                          kalem={k}
                          onKaydedildi={() => { setDuzenlenenKalemId(null); kalemleriGoster(seciliAkreditif.id); }}
                          onVazgec={() => setDuzenlenenKalemId(null)}
                        />
                      );
                    }
                    return (
                      <Fragment key={k.id}>
                        <tr style={{ borderTop: '1px solid var(--kenarlik)' }}>
                          <td style={{ padding: '8px 0' }}>{AKREDITIF_KALEM_TIP_METIN[k.tip]}</td>
                          <td style={{ padding: '8px 0' }}>{k.aciklama || '—'}</td>
                          <td style={{ padding: '8px 0' }}>{paraFormat(k.tutar, seciliAkreditif.para_birimi)}</td>
                          <td style={{ padding: '8px 0' }}>{k.vade_tarihi}</td>
                          <td style={{ padding: '8px 0' }}><Etiket ton={k.odendi_mi ? 'yesil' : 'amber'}>{k.odendi_mi ? 'Ödendi' : 'Bekliyor'}</Etiket></td>
                          <td style={{ padding: '8px 0' }}>
                            {k.odendi_mi ? (
                              <button onClick={() => kalemOdemesiniGeriAl(k.id)} style={eylemChipStili('kirmizi')}>Ödemeyi Geri Al</button>
                            ) : (
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                <button
                                  onClick={() => setOdemeYapilacakKalemId((mevcut) => (mevcut === k.id ? null : k.id))}
                                  style={eylemChipStili('lacivert')}
                                >
                                  {odemeYapilacakKalemId === k.id ? 'Kapat' : 'Öde'}
                                </button>
                                <button
                                  onClick={() => setTaksitPaneliAcikKalemId((mevcut) => (mevcut === k.id ? null : k.id))}
                                  style={eylemChipStili('amber')}
                                >
                                  {taksitPaneliAcikKalemId === k.id ? 'Kapat' : 'Taksitler'}
                                </button>
                                <button onClick={() => setDuzenlenenKalemId(k.id)} style={eylemChipStili('lacivert')}>Düzenle</button>
                                <button onClick={() => kalemiSil(k.id)} style={eylemChipStili('kirmizi')}>Sil</button>
                              </div>
                            )}
                          </td>
                        </tr>
                        {odemeYapilacakKalemId === k.id && (
                          <AkreditifKalemOdemeFormu
                            kalem={k}
                            akreditif={seciliAkreditif}
                            onKaydedildi={() => { setOdemeYapilacakKalemId(null); kalemleriGoster(seciliAkreditif.id); yukle(); }}
                            onVazgec={() => setOdemeYapilacakKalemId(null)}
                          />
                        )}
                        {taksitPaneliAcikKalemId === k.id && (
                          <KalemTaksitPaneli
                            kalem={k}
                            akreditif={seciliAkreditif}
                            onKapat={() => setTaksitPaneliAcikKalemId(null)}
                          />
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            )
          )}
        </Kart>
      )}
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
    const secim = odemeYontemiSor();
    if (!secim) return;
    try {
      await api.put(`/personel-odemeleri/${odemeId}/ode`, { odeme_tarihi: new Date().toISOString().slice(0, 10), ...secim });
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
                <button onClick={() => odemeleriGoster(p.id)} style={eylemChipStili('lacivert')}>
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
                      <button onClick={() => ode(o.id)} style={eylemChipStili('lacivert')}>Öde</button>
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
  const [bankaHesaplari, setBankaHesaplari] = useState([]);
  const harcamaTurleri = useHarcamaTurleri();
  const [formAcik, setFormAcik] = useState(false);
  const [form, setForm] = useState({
    stok_seri_no_id: '', tarih: new Date().toISOString().slice(0, 10), tip: 'GIDER', aciklama: '', tutar: '',
    odeme_yontemi: 'NAKIT', banka_hesap_id: '',
  });
  const [hata, setHata] = useState(null);

  function yukle() {
    api.get('/bakim-kayitlari').then((r) => setListe(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }
  useEffect(() => {
    yukle();
    api.get('/banka-bakiyeleri').then((r) => setBankaHesaplari(r.data)).catch(() => {});
  }, []);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    try {
      await api.post('/bakim-kayitlari', {
        ...form,
        stok_seri_no_id: Number(form.stok_seri_no_id),
        tutar: Number(form.tutar),
        banka_hesap_id: form.odeme_yontemi === 'BANKA' ? Number(form.banka_hesap_id) : null,
      });
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
              <OtomatikTamamlamaGirdisi
                value={form.aciklama}
                onChange={(v) => setForm((f) => ({ ...f, aciklama: v }))}
                secenekler={harcamaTurleri}
                listeId="harcama-turleri-bakim"
                placeholder="Yazmaya başlayın veya listeden seçin"
              />
            </Alan>
            <Alan etiket="Tutar (TL)">
              <input required type="number" step="0.01" value={form.tutar} onChange={(e) => setForm((f) => ({ ...f, tutar: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Ödeme yöntemi">
              <select value={form.odeme_yontemi} onChange={(e) => setForm((f) => ({ ...f, odeme_yontemi: e.target.value }))} style={girdiStili}>
                <option value="NAKIT">Nakit</option>
                <option value="BANKA">Banka</option>
              </select>
            </Alan>
            {form.odeme_yontemi === 'BANKA' && (
              <Alan etiket="Banka hesabı">
                <select required value={form.banka_hesap_id} onChange={(e) => setForm((f) => ({ ...f, banka_hesap_id: e.target.value }))} style={girdiStili}>
                  <option value="">Seçin...</option>
                  {bankaHesaplari.map((h) => (
                    <option key={h.banka_hesap_id} value={h.banka_hesap_id}>{h.banka_adi} — {h.hesap_adi || h.para_birimi}</option>
                  ))}
                </select>
              </Alan>
            )}
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

// ============================================================== LEASING
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
    const sozlesme = liste.find((l) => l.id === seciliPlan.id);
    const secim = await odemeYontemiSor(sozlesme ? sozlesme.para_birimi : 'TRY');
    if (!secim) return;
    try {
      await api.put(`/leasing-odemeleri/${odemeId}/ode`, { odeme_tarihi: new Date().toISOString().slice(0, 10), ...secim });
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
                <button onClick={() => planiGoster(l.id)} style={eylemChipStili('lacivert')}>
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
                    <button onClick={() => odemeYap(t.id)} style={eylemChipStili('lacivert')}>Öde</button>
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
  const cariHaritasi = useCariHaritasi();
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
    const sozlesme = liste.find((l) => l.id === seciliSozlesme);
    const secim = await odemeYontemiSor(sozlesme ? sozlesme.para_birimi : 'TRY');
    if (!secim) return;
    try {
      await api.put(`/kiralama-odemeleri/${odemeId}/tahsil-et`, { odeme_tarihi: new Date().toISOString().slice(0, 10), ...secim });
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
              <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{cariGoster(k.kiraci_cari_id, cariHaritasi)}</td>
              <td style={{ padding: '10px 16px' }}>{paraFormat(k.aylik_kira_tutari, k.para_birimi)}</td>
              <td style={{ padding: '10px 16px' }}><Etiket ton={k.durum === 'AKTIF' ? 'yesil' : 'notr'}>{k.durum}</Etiket></td>
              <td style={{ padding: '10px 16px' }}>
                <button onClick={() => odemeleriGoster(k.id)} style={eylemChipStili('lacivert')}>
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
                      <button onClick={() => tahsilEt(o.id)} style={eylemChipStili('lacivert')}>Tahsil et</button>
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
    const secim = await odemeYontemiSor(olusanPlan ? olusanPlan.para_birimi : 'TRY');
    if (!secim) return;
    try {
      await api.put(`/taksit-detay/${taksitId}/tahsil-et`, { odeme_tarihi: new Date().toISOString().slice(0, 10), ...secim });
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
                    <button onClick={() => tahsilEt(t.id)} style={eylemChipStili('lacivert')}>Tahsil et</button>
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
  const harcamaTurleri = useHarcamaTurleri();
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
    const secim = odemeYontemiSor();
    if (!secim) return;
    try {
      await api.put(`/sabit-giderler/${giderId}/ode`, { odeme_tarihi: new Date().toISOString().slice(0, 10), ...secim });
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
              <OtomatikTamamlamaGirdisi
                value={form.aciklama}
                onChange={(v) => setForm((f) => ({ ...f, aciklama: v }))}
                secenekler={harcamaTurleri}
                listeId="harcama-turleri-sabit-gider"
                placeholder="Yazmaya başlayın veya listeden seçin"
              />
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
                  <button onClick={() => ode(g.id)} style={eylemChipStili('lacivert')}>Öde</button>
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
  const cariHaritasi = useCariHaritasi();

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
    const tutar = window.prompt('Ödeme tutarı:');
    if (!tutar) return;
    const borc = liste.find((b) => b.id === borcId);
    const secim = await odemeYontemiSor(borc ? borc.para_birimi : 'TRY');
    if (!secim) return;
    try {
      await api.post(`/borclar/${borcId}/odeme`, { tarih: new Date().toISOString().slice(0, 10), tutar: Number(tutar), ...secim });
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
              <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{cariGoster(b.cari_id, cariHaritasi)}</td>
              <td style={{ padding: '10px 16px' }}>{paraFormat(b.tutar, b.para_birimi)}</td>
              <td style={{ padding: '10px 16px', fontWeight: 500 }}>
                {bakiyeler[b.id] ? paraFormat(bakiyeler[b.id].kalan_bakiye, b.para_birimi)
                  : <button onClick={() => bakiyeyiGetir(b.id)} style={eylemChipStili('lacivert')}>Göster</button>}
              </td>
              <td style={{ padding: '10px 16px' }}>
                <button onClick={() => odemeEkle(b.id)} style={eylemChipStili('lacivert')}>Ödeme ekle</button>
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
      {sekme === 'akreditif' && <AkreditifSekmesi />}
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
