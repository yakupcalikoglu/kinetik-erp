import { useEffect, useState, Fragment } from 'react';
import { api, hataMesajiCikar } from '../api/client';
import {
  Kart, SayfaBasligi, Buton, Etiket, Alan, girdiStili, BosDurum, HataMesaji, paraFormat, Sekmeler, eylemChipStili,
  OtomatikTamamlamaGirdisi,
} from '../components/Ortak';

// Sekmeler mantiksal 4 gruba ayrildi - hangi sekmenin nerede oldugunu
// bulmayi kolaylastirmak icin (once tek bir duz liste halindeydi).
const SEKME_GRUPLARI = [
  {
    baslik: 'Satış & Tahsilat',
    aciklama: 'Müşteriden gelir toplama',
    sekmeler: [
      { deger: 'taksit', etiket: 'Taksitli Satış' },
      { deger: 'kiralama', etiket: 'Kiralama' },
    ],
  },
  {
    baslik: 'Tedarik & Ödeme',
    aciklama: 'Yurt dışı alım ödemeleri',
    sekmeler: [
      { deger: 'akreditif', etiket: 'Akreditif' },
      { deger: 'leasing', etiket: 'Leasing' },
    ],
  },
  {
    baslik: 'İşletme Giderleri',
    aciklama: 'Personel ve diğer giderler',
    sekmeler: [
      { deger: 'personel', etiket: 'Personel' },
      { deger: 'gider', etiket: 'Diğer Giderler' },
      { deger: 'bakim', etiket: 'Bakım' },
    ],
  },
  {
    baslik: 'Nakit Araçları',
    aciklama: 'Çek ve ortak/dış borç',
    sekmeler: [
      { deger: 'cek', etiket: 'Çek' },
      { deger: 'borc', etiket: 'Ortak / Dış Borç' },
    ],
  },
];

function GruplananSekmeler({ aktif, onDegistir }) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
      {SEKME_GRUPLARI.map((grup) => (
        <div
          key={grup.baslik}
          style={{
            flex: '1 1 200px', minWidth: 200, padding: '10px 12px', borderRadius: 10,
            border: '1px solid var(--kenarlik)', background: 'var(--zemin)',
          }}
        >
          <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--metin-ikincil)', marginBottom: 2 }}>
            {grup.baslik}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--metin-soluk)', marginBottom: 8 }}>
            {grup.aciklama}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {grup.sekmeler.map((s) => (
              <button
                key={s.deger}
                onClick={() => onDegistir(s.deger)}
                style={{
                  padding: '6px 10px', borderRadius: 7, fontSize: 12.5, cursor: 'pointer',
                  border: aktif === s.deger ? '1.5px solid var(--lacivert)' : '1px solid var(--kenarlik)',
                  background: aktif === s.deger ? 'var(--lacivert)' : 'white',
                  color: aktif === s.deger ? 'white' : 'var(--metin-birincil)',
                  fontWeight: aktif === s.deger ? 600 : 400,
                }}
              >
                {s.etiket}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

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

// Cari ID -> unvan haritasi. Cari ID gorunen her yerde isim de gosterebilmek icin
// carileri bir kere cekip id bazli bir haritaya donusturuyoruz.
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

function useCariler() {
  const [cariler, setCariler] = useState([]);
  useEffect(() => {
    api.get('/cariler').then((r) => setCariler(r.data)).catch(() => {});
  }, []);
  return cariler;
}

function useUrunSecenekleri() {
  const [urunler, setUrunler] = useState([]);
  const [kartlar, setKartlar] = useState([]);
  useEffect(() => {
    api.get('/stok-seri-no').then((r) => setUrunler(r.data)).catch(() => {});
    api.get('/stok-kartlari').then((r) => setKartlar(r.data)).catch(() => {});
  }, []);
  return urunler.map((u) => {
    const kart = kartlar.find((k) => k.id === u.stok_karti_id);
    return { ...u, etiket: kart ? `${u.seri_no} — ${kart.marka} ${kart.model}` : u.seri_no };
  });
}

function useHarcamaTurleri() {
  const [turler, setTurler] = useState([]);
  useEffect(() => {
    api.get('/harcama-turleri').then((r) => {
      const adlar = r.data.map((t) => t.ad);
      // "Diğer" her zaman listede olsun - kullanıcı özel bir tür tanımlamamış
      // olsa bile bir kaçış seçeneği olarak garanti edilir.
      setTurler(adlar.includes('Diğer') ? adlar : [...adlar, 'Diğer']);
    }).catch(() => setTurler(['Diğer']));
  }, []);
  return turler;
}

// "Yeni ekle" formlarinda (henuz odeme yapilmamis asamada) dovizli tutarin
// yaklasik TL karsiligini gostermek icin kullanilir. Sadece bilgi amaclidir,
// hicbir yere kaydedilmez - gercek TL karsiligi asil odeme anindaki kurla
// belirlenir (OdemeFormu).
function DovizKarsiligiGosterge({ tutar, paraBirimi }) {
  const [kur, setKur] = useState('1');
  useEffect(() => {
    if (!paraBirimi || paraBirimi === 'TRY') return;
    api.get(`/kur/${paraBirimi}`).then((r) => setKur(r.data.kur)).catch(() => {});
  }, [paraBirimi]);

  if (!paraBirimi || paraBirimi === 'TRY') return null;
  const tl = tutar ? Number(tutar) * (Number(kur) || 0) : null;

  return (
    <Alan etiket={`${paraBirimi} için TL kuru (yaklaşık, bilgi amaçlı)`}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="number" step="0.0001" value={kur} onChange={(e) => setKur(e.target.value)} style={{ ...girdiStili, width: 100 }} />
        {tl != null && <span style={{ fontSize: 12.5, color: 'var(--metin-ikincil)', whiteSpace: 'nowrap' }}>≈ {paraFormat(tl)}</span>}
      </div>
    </Alan>
  );
}

function cariGoster(id, harita) {
  if (id === null || id === undefined || id === '') return '—';
  const unvan = harita[id];
  return unvan ? `#${id} — ${unvan}` : `#${id}`;
}

// ============================================================== ORTAK ÖDEME FORMU
// Nakit/Banka secimi, banka secilince hesap dropdown'i, dovizse kur girme +
// TL karsiligi onizlemesi. Cek/Personel/SabitGider/Borc/Kiralama/Taksit
// sekmelerindeki TUM odeme/tahsilat islemlerinde ortak kullanilir.
function OdemeFormu({ tutar: tutarProp, paraBirimi = 'TRY', aksiyonMetni = 'Ödemeyi tamamla', onOde, onVazgec, tutarDuzenlenebilir = false, tutarEtiketi = 'Tahsil edilecek tutar (TL)' }) {
  const [bankaHesaplari, setBankaHesaplari] = useState([]);
  const [yontem, setYontem] = useState('NAKIT');
  const [bankaHesapId, setBankaHesapId] = useState('');
  const [kur, setKur] = useState('1');
  const [tarih, setTarih] = useState(new Date().toISOString().slice(0, 10));
  const [tutarDuzenlenmis, setTutarDuzenlenmis] = useState(String(tutarProp));
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => {
    api.get('/banka-bakiyeleri').then((r) => setBankaHesaplari(r.data)).catch(() => {});
    if (paraBirimi !== 'TRY') {
      api.get(`/kur/${paraBirimi}`).then((r) => setKur(r.data.kur)).catch(() => {});
    }
  }, []); // eslint-disable-line

  const dovizli = paraBirimi !== 'TRY';
  const tutarHesap = tutarDuzenlenebilir ? tutarDuzenlenmis : tutarProp;
  const tlKarsiligi = dovizli && tutarHesap ? (Number(tutarHesap) * (Number(kur) || 0)) : null;

  async function gonder(e) {
    e.preventDefault();
    setHata(null);
    if (yontem === 'BANKA' && !bankaHesapId) {
      setHata('Lütfen banka hesabı seçin.');
      return;
    }
    if (tutarDuzenlenebilir && (!tutarDuzenlenmis || Number(tutarDuzenlenmis) <= 0)) {
      setHata('Lütfen geçerli bir tutar girin.');
      return;
    }
    setKaydediliyor(true);
    try {
      await onOde({
        odeme_tarihi: tarih,
        odeme_yontemi: yontem,
        banka_hesap_id: yontem === 'BANKA' ? Number(bankaHesapId) : null,
        kur: dovizli ? Number(kur) : null,
        ...(tutarDuzenlenebilir ? { tutar: Number(tutarDuzenlenmis) } : {}),
      });
    } catch (err) {
      setHata(hataMesajiCikar(err));
      setKaydediliyor(false);
    }
  }

  return (
    <div style={{ padding: 14, background: 'var(--zemin)', border: '1px solid var(--kenarlik)', borderRadius: 8, marginTop: 8 }}>
      <form onSubmit={gonder}>
        <HataMesaji>{hata}</HataMesaji>
        {tutarDuzenlenebilir && (
          <div style={{ marginBottom: 10, maxWidth: 220 }}>
            <Alan etiket={tutarEtiketi}>
              <input required type="number" step="0.01" value={tutarDuzenlenmis} onChange={(e) => setTutarDuzenlenmis(e.target.value)} style={girdiStili} />
            </Alan>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: dovizli ? (yontem === 'BANKA' ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr') : '1fr 1fr', gap: 10 }}>
          <Alan etiket="Ödeme yöntemi">
            <select value={yontem} onChange={(e) => setYontem(e.target.value)} style={girdiStili}>
              <option value="NAKIT">Nakit (Ana Kasa)</option>
              <option value="BANKA">Banka</option>
            </select>
          </Alan>
          {yontem === 'BANKA' && (
            <Alan etiket="Banka hesabı">
              <select required value={bankaHesapId} onChange={(e) => setBankaHesapId(e.target.value)} style={girdiStili}>
                <option value="">Seçin...</option>
                {bankaHesaplari.map((h) => (
                  <option key={h.banka_hesap_id} value={h.banka_hesap_id}>
                    {h.banka_adi} — {h.hesap_adi || h.para_birimi} ({h.para_birimi})
                  </option>
                ))}
              </select>
            </Alan>
          )}
          {dovizli && (
            <Alan etiket={`${paraBirimi} için TL kuru (otomatik, elle değiştirilebilir)`}>
              <input required type="number" step="0.0001" value={kur} onChange={(e) => setKur(e.target.value)} style={girdiStili} />
            </Alan>
          )}
          <Alan etiket="Tarih">
            <input required type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} style={girdiStili} />
          </Alan>
        </div>
        {tlKarsiligi != null && (
          <div style={{ fontSize: 12.5, color: 'var(--metin-ikincil)', marginTop: 6 }}>
            TL karşılığı: <strong>{paraFormat(tlKarsiligi)}</strong>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : aksiyonMetni}</Buton>
          <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
        </div>
      </form>
    </div>
  );
}

// ============================================================== ÇEK
const CEK_DURUM_TON = { PORTFOYDE: 'amber', CIRO_EDILDI: 'notr', TAHSIL_EDILDI: 'yesil', ODENDI: 'yesil', KARSILIKSIZ: 'kirmizi', IPTAL: 'kirmizi' };
const CEK_DURUM_METIN = { PORTFOYDE: 'Portföyde', CIRO_EDILDI: 'Ciro Edildi', TAHSIL_EDILDI: 'Tahsil Edildi', ODENDI: 'Ödendi', KARSILIKSIZ: 'Karşılıksız', IPTAL: 'İptal' };

function CekSekmesi() {
  const [cekler, setCekler] = useState([]);
  const [formAcik, setFormAcik] = useState(false);
  const [form, setForm] = useState({ tip: 'ALINAN', cek_no: '', banka_adi: '', cari_id: '', tutar: '', para_birimi: 'TRY', vade_tarihi: '', alinma_verilme_tarihi: '' });
  const [hata, setHata] = useState(null);
  const [odemeAcikCekId, setOdemeAcikCekId] = useState(null);
  const cariHaritasi = useCariHaritasi();
  const cariler = useCariler();

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

  async function odemeyiTamamla(cek, secim) {
    await api.put(`/cekler/${cek.id}/durum`, {
      yeni_durum: cek.tip === 'ALINAN' ? 'TAHSIL_EDILDI' : 'ODENDI',
      ...secim,
    });
    setOdemeAcikCekId(null);
    yukle();
  }

  async function cekDurumunuGeriAl(cekId) {
    if (!window.confirm('Bu çekin durumunu "Portföyde"ye geri almak istediğinize emin misiniz? Oluşan Kasa/Banka hareketi silinecek.')) return;
    try {
      await api.put(`/cekler/${cekId}/durumu-geri-al`);
      yukle();
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function cekSil(cekId) {
    if (!window.confirm('Bu çeki silmek istediğinize emin misiniz?')) return;
    try {
      await api.delete(`/cekler/${cekId}`);
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
            <Alan etiket="Cari (opsiyonel)">
              <select value={form.cari_id} onChange={(e) => setForm((f) => ({ ...f, cari_id: e.target.value }))} style={girdiStili}>
                <option value="">Seçin...</option>
                {cariler.map((c) => <option key={c.id} value={c.id}>{c.unvan}</option>)}
              </select>
            </Alan>
            <Alan etiket="Tutar">
              <input required type="number" step="0.01" value={form.tutar} onChange={(e) => setForm((f) => ({ ...f, tutar: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Para birimi">
              <select value={form.para_birimi} onChange={(e) => setForm((f) => ({ ...f, para_birimi: e.target.value }))} style={girdiStili}>
                <option value="TRY">TRY</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </Alan>
            <DovizKarsiligiGosterge tutar={form.tutar} paraBirimi={form.para_birimi} />
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
        {cekler.length === 0 ? <BosDurum baslik="Kayıt bulunamadı" /> : (
          <table>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                {['Çek No', 'Tip', 'Banka', 'Cari', 'Tutar', 'Vade', 'Durum', 'İşlem'].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cekler.map((c) => (
                <Fragment key={c.id}>
                  <tr style={{ borderTop: '1px solid var(--kenarlik)' }}>
                    <td style={{ padding: '10px 16px' }}>{c.cek_no || '—'}</td>
                    <td style={{ padding: '10px 16px' }}>{c.tip === 'ALINAN' ? 'Alınan' : 'Verilen'}</td>
                    <td style={{ padding: '10px 16px' }}>{c.banka_adi || '—'}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{cariGoster(c.cari_id, cariHaritasi)}</td>
                    <td style={{ padding: '10px 16px' }}>{paraFormat(c.tutar, c.para_birimi)}</td>
                    <td style={{ padding: '10px 16px' }}>{c.vade_tarihi}</td>
                    <td style={{ padding: '10px 16px' }}><Etiket ton={CEK_DURUM_TON[c.durum]}>{CEK_DURUM_METIN[c.durum]}</Etiket></td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {c.durum === 'PORTFOYDE' && (
                          <>
                            <button onClick={() => ciroEt(c.id)} style={eylemChipStili('lacivert')}>Ciro et</button>
                            <button
                              onClick={() => setOdemeAcikCekId((mevcut) => (mevcut === c.id ? null : c.id))}
                              style={eylemChipStili('yesil')}
                            >
                              {odemeAcikCekId === c.id ? 'Kapat' : (c.tip === 'ALINAN' ? 'Tahsil et' : 'Öde')}
                            </button>
                            <button onClick={() => cekSil(c.id)} style={eylemChipStili('kirmizi')}>Sil</button>
                          </>
                        )}
                        {(c.durum === 'TAHSIL_EDILDI' || c.durum === 'ODENDI') && (
                          <button onClick={() => cekDurumunuGeriAl(c.id)} style={eylemChipStili('kirmizi')}>Geri Al</button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {odemeAcikCekId === c.id && (
                    <tr>
                      <td colSpan={8} style={{ padding: '0 16px 12px' }}>
                        <OdemeFormu
                          tutar={c.tutar}
                          paraBirimi={c.para_birimi}
                          aksiyonMetni={c.tip === 'ALINAN' ? 'Tahsilatı tamamla' : 'Ödemeyi tamamla'}
                          onOde={(secim) => odemeyiTamamla(c, secim)}
                          onVazgec={() => setOdemeAcikCekId(null)}
                        />
                      </td>
                    </tr>
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
        kur: akreditif.para_birimi !== 'TRY' ? Number(form.kur) : null,
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
            <div style={{ display: 'grid', gridTemplateColumns: akreditif.para_birimi !== 'TRY' ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr', gap: 12 }}>
              <Alan etiket="Ödeme yöntemi">
                <select value={form.odeme_yontemi} onChange={(e) => setForm((f) => ({ ...f, odeme_yontemi: e.target.value }))} style={girdiStili}>
                  <option value="BANKA">Banka</option>
                  <option value="NAKIT">Nakit (Ana Kasa)</option>
                </select>
              </Alan>
              {form.odeme_yontemi === 'BANKA' && (
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
              )}
              {akreditif.para_birimi !== 'TRY' && (
                <Alan etiket={`${akreditif.para_birimi} için TL kuru (otomatik, elle değiştirilebilir)`}>
                  <input required type="number" step="0.0001" value={form.kur} onChange={(e) => setForm((f) => ({ ...f, kur: e.target.value }))} style={girdiStili} />
                </Alan>
              )}
              <Alan etiket="Ödeme tarihi">
                <input required type="date" value={form.odeme_tarihi} onChange={(e) => setForm((f) => ({ ...f, odeme_tarihi: e.target.value }))} style={girdiStili} />
              </Alan>
            </div>
            {akreditif.para_birimi !== 'TRY' && form.kur && (
              <div style={{ fontSize: 12.5, color: 'var(--metin-ikincil)', marginTop: 6 }}>
                TL karşılığı: <strong>{paraFormat(Number(kalem.tutar) * (Number(form.kur) || 0))}</strong>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
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
    tip: kalem.tip, aciklama: kalem.aciklama || '', tutar: kalem.tutar, vade_tarihi: kalem.vade_tarihi, sifre: '',
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
              <Alan etiket="Şifreniz (onay için zorunlu)">
                <input required type="password" value={form.sifre} onChange={(e) => setForm((f) => ({ ...f, sifre: e.target.value }))} style={girdiStili} placeholder="Giriş şifreniz" />
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
        kur: akreditif.para_birimi !== 'TRY' ? Number(form.kur) : null,
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
            <div style={{ display: 'grid', gridTemplateColumns: akreditif.para_birimi !== 'TRY' ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr', gap: 10 }}>
              <Alan etiket="Ödeme yöntemi">
                <select value={form.odeme_yontemi} onChange={(e) => setForm((f) => ({ ...f, odeme_yontemi: e.target.value }))} style={girdiStili}>
                  <option value="BANKA">Banka</option>
                  <option value="NAKIT">Nakit (Ana Kasa)</option>
                </select>
              </Alan>
              {form.odeme_yontemi === 'BANKA' && (
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
              )}
              {akreditif.para_birimi !== 'TRY' && (
                <Alan etiket="Kur">
                  <input required type="number" step="0.0001" value={form.kur} onChange={(e) => setForm((f) => ({ ...f, kur: e.target.value }))} style={girdiStili} />
                </Alan>
              )}
              <Alan etiket="Ödeme tarihi">
                <input required type="date" value={form.odeme_tarihi} onChange={(e) => setForm((f) => ({ ...f, odeme_tarihi: e.target.value }))} style={girdiStili} />
              </Alan>
            </div>
            {akreditif.para_birimi !== 'TRY' && form.kur && (
              <div style={{ fontSize: 12.5, color: 'var(--metin-ikincil)', marginTop: 6 }}>
                TL karşılığı: <strong>{paraFormat(Number(taksit.tutar) * (Number(form.kur) || 0))}</strong>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
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
            <DovizKarsiligiGosterge tutar={form.tutar} paraBirimi={form.para_birimi} />
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
  const [odemeAcikId, setOdemeAcikId] = useState(null);

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

  async function odemeyiTamamla(odeme, secim) {
    await api.put(`/personel-odemeleri/${odeme.id}/ode`, secim);
    setOdemeAcikId(null);
    odemeleriGoster(seciliPersonel);
  }

  async function odemeGeriAl(odemeId) {
    if (!window.confirm('Bu ödemeyi geri almak istediğinize emin misiniz? Oluşan Kasa/Banka hareketi silinecek.')) return;
    try {
      await api.put(`/personel-odemeleri/${odemeId}/odemeyi-geri-al`);
      odemeleriGoster(seciliPersonel);
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function odemeSil(odemeId) {
    if (!window.confirm('Bu tahakkuk kaydını silmek istediğinize emin misiniz?')) return;
    try {
      await api.delete(`/personel-odemeleri/${odemeId}`);
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
            odemeler.length === 0 ? <BosDurum baslik="Kayıt bulunamadı" /> : (
              <table>
                <thead>
                  <tr style={{ background: 'var(--zemin)' }}>
                    {['Dönem', 'Tip', 'Tutar', 'Durum', ''].map((b) => (
                      <th key={b} style={{ textAlign: 'left', padding: '8px 0', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>{b}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {odemeler.map((o) => (
                    <Fragment key={o.id}>
                      <tr style={{ borderTop: '1px solid var(--kenarlik)' }}>
                        <td style={{ padding: '8px 0' }}>{o.donem}</td>
                        <td style={{ padding: '8px 0' }}>{o.tip}</td>
                        <td style={{ padding: '8px 0' }}>{paraFormat(o.tutar)}</td>
                        <td style={{ padding: '8px 0' }}><Etiket ton={o.odendi_mi ? 'yesil' : 'amber'}>{o.odendi_mi ? 'Ödendi' : 'Bekliyor'}</Etiket></td>
                        <td style={{ padding: '8px 0' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {o.odendi_mi ? (
                              <button onClick={() => odemeGeriAl(o.id)} style={eylemChipStili('kirmizi')}>Geri Al</button>
                            ) : (
                              <>
                                <button
                                  onClick={() => setOdemeAcikId((mevcut) => (mevcut === o.id ? null : o.id))}
                                  style={eylemChipStili('lacivert')}
                                >
                                  {odemeAcikId === o.id ? 'Kapat' : 'Öde'}
                                </button>
                                <button onClick={() => odemeSil(o.id)} style={eylemChipStili('kirmizi')}>Sil</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {odemeAcikId === o.id && (
                        <tr>
                          <td colSpan={5} style={{ padding: '0 0 10px' }}>
                            <OdemeFormu
                              tutar={o.tutar}
                              paraBirimi="TRY"
                              onOde={(secim) => odemeyiTamamla(o, secim)}
                              onVazgec={() => setOdemeAcikId(null)}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            )
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
  const urunSecenekleri = useUrunSecenekleri();
  const cariler = useCariler();
  const [formAcik, setFormAcik] = useState(false);
  const [form, setForm] = useState({
    stok_seri_no_id: '', tarih: new Date().toISOString().slice(0, 10), tip: 'GIDER', aciklama: '', ilgili_cari_id: '', tutar: '',
    para_birimi: 'TRY', kur: '1', odeme_yontemi: 'NAKIT', banka_hesap_id: '',
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
        ilgili_cari_id: form.ilgili_cari_id ? Number(form.ilgili_cari_id) : null,
        tutar: Number(form.tutar),
        banka_hesap_id: form.odeme_yontemi === 'BANKA' ? Number(form.banka_hesap_id) : null,
        kur: form.odeme_yontemi === 'NAKIT' && form.para_birimi !== 'TRY' ? Number(form.kur) : null,
      });
      setFormAcik(false);
      yukle();
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function sil(bakimId) {
    if (!window.confirm('Bu bakım kaydını silmek istediğinize emin misiniz? Oluşan Kasa/Banka hareketi bu işlemle silinmez.')) return;
    try {
      await api.delete(`/bakim-kayitlari/${bakimId}`);
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
            <Alan etiket="Ürün">
              <select required value={form.stok_seri_no_id} onChange={(e) => setForm((f) => ({ ...f, stok_seri_no_id: e.target.value }))} style={girdiStili}>
                <option value="">Seçin...</option>
                {urunSecenekleri.map((u) => <option key={u.id} value={u.id}>{u.etiket}</option>)}
              </select>
            </Alan>
            <Alan etiket="İlgili cari (opsiyonel)">
              <select value={form.ilgili_cari_id} onChange={(e) => setForm((f) => ({ ...f, ilgili_cari_id: e.target.value }))} style={girdiStili}>
                <option value="">Seçin...</option>
                {cariler.map((c) => <option key={c.id} value={c.id}>{c.unvan}</option>)}
              </select>
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
            <Alan etiket="Tutar">
              <input required type="number" step="0.01" value={form.tutar} onChange={(e) => setForm((f) => ({ ...f, tutar: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Para birimi">
              <select value={form.para_birimi} onChange={(e) => setForm((f) => ({ ...f, para_birimi: e.target.value }))} style={girdiStili}>
                <option value="TRY">TRY</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </Alan>
            <Alan etiket="Ödeme yöntemi">
              <select value={form.odeme_yontemi} onChange={(e) => setForm((f) => ({ ...f, odeme_yontemi: e.target.value }))} style={girdiStili}>
                <option value="NAKIT">Nakit</option>
                <option value="BANKA">Banka</option>
              </select>
            </Alan>
            {form.odeme_yontemi === 'BANKA' ? (
              <Alan etiket="Banka hesabı">
                <select required value={form.banka_hesap_id} onChange={(e) => setForm((f) => ({ ...f, banka_hesap_id: e.target.value }))} style={girdiStili}>
                  <option value="">Seçin...</option>
                  {bankaHesaplari.map((h) => (
                    <option key={h.banka_hesap_id} value={h.banka_hesap_id}>{h.banka_adi} — {h.hesap_adi || h.para_birimi}</option>
                  ))}
                </select>
              </Alan>
            ) : form.para_birimi !== 'TRY' && (
              <Alan etiket={`${form.para_birimi} için TL kuru (otomatik, elle değiştirilebilir)`}>
                <input required type="number" step="0.0001" value={form.kur} onChange={(e) => setForm((f) => ({ ...f, kur: e.target.value }))} style={girdiStili} />
              </Alan>
            )}
            <div style={{ alignSelf: 'end' }}><Buton type="submit">Kaydet</Buton></div>
          </form>
        </Kart>
      )}

      <Kart style={{ padding: 0 }}>
        <BasitTablo
          basliklar={['Ürün', 'İlgili Cari', 'Tarih', 'Tip', 'Açıklama', 'Tutar', '']}
          satirlar={liste}
          render={(b) => (
            <tr key={b.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
              <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{b.urun_adi ? `${b.urun_adi} (${b.urun_seri_no})` : (b.urun_seri_no || `#${b.stok_seri_no_id}`)}</td>
              <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{b.ilgili_cari_unvan || '—'}</td>
              <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{b.tarih}</td>
              <td style={{ padding: '10px 16px' }}><Etiket ton={b.tip === 'GELIR' ? 'yesil' : 'kirmizi'}>{b.tip === 'GELIR' ? 'Gelir' : 'Gider'}</Etiket></td>
              <td style={{ padding: '10px 16px' }}>{b.aciklama || '—'}</td>
              <td style={{ padding: '10px 16px', fontWeight: 500 }}>{paraFormat(b.tutar)}</td>
              <td style={{ padding: '10px 16px' }}>
                <button onClick={() => sil(b.id)} style={eylemChipStili('kirmizi')}>Sil</button>
              </td>
            </tr>
          )}
        />
      </Kart>
    </div>
  );
}

// ============================================================== LEASING
function useUrunTanimlari() {
  const [kartlar, setKartlar] = useState([]);
  useEffect(() => {
    api.get('/stok-kartlari').then((r) => setKartlar(r.data)).catch(() => {});
  }, []);
  return kartlar;
}

function bosLeasingKalemi() {
  return { stok_karti_id: '', miktar: 1, birim_fiyat: '' };
}

function bosLeasingFormu() {
  return {
    sozlesme_no: '', leasing_firmasi_cari_id: '', para_birimi: 'TRY',
    taksit_sayisi: 12, baslangic_tarihi: new Date().toISOString().slice(0, 10),
    kalemler: [bosLeasingKalemi()],
  };
}

function LeasingSekmesi() {
  const [liste, setListe] = useState([]);
  const cariler = useCariler();
  const urunTanimlari = useUrunTanimlari();
  const [hata, setHata] = useState(null);
  const [seciliPlan, setSeciliPlan] = useState(null);
  const [formAcik, setFormAcik] = useState(false);
  const [form, setForm] = useState(bosLeasingFormu());
  const [odemeAcikTaksitId, setOdemeAcikTaksitId] = useState(null);

  function yukle() {
    api.get('/leasing-sozlesmeleri').then((r) => setListe(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }
  useEffect(yukle, []);

  function kalemGuncelle(i, alan, deger) {
    setForm((f) => ({
      ...f,
      kalemler: f.kalemler.map((k, idx) => (idx === i ? { ...k, [alan]: deger } : k)),
    }));
  }
  function kalemEkle() {
    setForm((f) => ({ ...f, kalemler: [...f.kalemler, bosLeasingKalemi()] }));
  }
  function kalemSil(i) {
    setForm((f) => ({ ...f, kalemler: f.kalemler.filter((_, idx) => idx !== i) }));
  }

  const formToplamTutar = form.kalemler.reduce((acc, k) => acc + (Number(k.miktar) || 0) * (Number(k.birim_fiyat) || 0), 0);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    if (form.kalemler.some((k) => !k.stok_karti_id || !k.birim_fiyat)) {
      setHata('Lütfen her kalem için ürün ve birim fiyat girin.');
      return;
    }
    try {
      await api.post('/leasing-sozlesmeleri', {
        sozlesme_no: form.sozlesme_no,
        leasing_firmasi_cari_id: Number(form.leasing_firmasi_cari_id),
        para_birimi: form.para_birimi,
        taksit_sayisi: Number(form.taksit_sayisi),
        baslangic_tarihi: form.baslangic_tarihi,
        kalemler: form.kalemler.map((k) => ({
          stok_karti_id: Number(k.stok_karti_id), miktar: Number(k.miktar), birim_fiyat: Number(k.birim_fiyat),
        })),
      });
      setFormAcik(false);
      setForm(bosLeasingFormu());
      yukle();
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function sozlesmeSil(id) {
    if (!window.confirm('Bu leasing sözleşmesini silmek istediğinize emin misiniz?')) return;
    try {
      await api.delete(`/leasing-sozlesmeleri/${id}`);
      if (seciliPlan?.id === id) setSeciliPlan(null);
      yukle();
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function planiGoster(id) {
    try {
      const { data } = await api.get(`/leasing-sozlesmeleri/${id}/odeme-plani`);
      setSeciliPlan({ id, taksitler: data });
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function odemeyiTamamla(odeme, secim) {
    await api.put(`/leasing-odemeleri/${odeme.id}/ode`, secim);
    setOdemeAcikTaksitId(null);
    planiGoster(seciliPlan.id);
  }

  async function odemeyiGeriAl(odemeId) {
    if (!window.confirm('Bu ödemeyi geri almak istediğinize emin misiniz? Oluşan Kasa/Banka hareketi silinecek.')) return;
    try {
      await api.put(`/leasing-odemeleri/${odemeId}/odemeyi-geri-al`);
      planiGoster(seciliPlan.id);
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  const seciliSozlesme = liste.find((l) => l.id === seciliPlan?.id);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Buton onClick={() => setFormAcik((a) => !a)}>{formAcik ? 'Kapat' : '+ Yeni leasing sözleşmesi'}</Buton>
      </div>
      <HataMesaji>{hata}</HataMesaji>

      {formAcik && (
        <Kart style={{ marginBottom: 16 }}>
          <form onSubmit={kaydet}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <Alan etiket="Sözleşme no">
                <input required value={form.sozlesme_no} onChange={(e) => setForm((f) => ({ ...f, sozlesme_no: e.target.value }))} style={girdiStili} />
              </Alan>
              <Alan etiket="Leasing şirketi (cari)">
                <select required value={form.leasing_firmasi_cari_id} onChange={(e) => setForm((f) => ({ ...f, leasing_firmasi_cari_id: e.target.value }))} style={girdiStili}>
                  <option value="">Seçin...</option>
                  {cariler.map((c) => <option key={c.id} value={c.id}>{c.unvan}</option>)}
                </select>
              </Alan>
              <Alan etiket="Para birimi">
                <select value={form.para_birimi} onChange={(e) => setForm((f) => ({ ...f, para_birimi: e.target.value }))} style={girdiStili}>
                  <option value="TRY">TRY</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </Alan>
              <Alan etiket="Taksit sayısı">
                <input required type="number" min="1" value={form.taksit_sayisi} onChange={(e) => setForm((f) => ({ ...f, taksit_sayisi: e.target.value }))} style={girdiStili} />
              </Alan>
              <Alan etiket="Başlangıç tarihi">
                <input required type="date" value={form.baslangic_tarihi} onChange={(e) => setForm((f) => ({ ...f, baslangic_tarihi: e.target.value }))} style={girdiStili} />
              </Alan>
            </div>

            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Ürün kalemleri (birden fazla ürün türü ekleyebilirsiniz)</div>
            <table style={{ width: '100%', marginBottom: 8 }}>
              <thead>
                <tr style={{ background: 'var(--zemin)' }}>
                  {['Ürün', 'Adet', 'Birim Fiyat', 'Satır Toplamı', ''].map((b) => (
                    <th key={b} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 12, color: 'var(--metin-ikincil)' }}>{b}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {form.kalemler.map((k, i) => {
                  const satirToplam = (Number(k.miktar) || 0) * (Number(k.birim_fiyat) || 0);
                  return (
                    <tr key={i} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                      <td style={{ padding: 6 }}>
                        <select required value={k.stok_karti_id} onChange={(e) => kalemGuncelle(i, 'stok_karti_id', e.target.value)} style={girdiStili}>
                          <option value="">Seçin...</option>
                          {urunTanimlari.map((u) => <option key={u.id} value={u.id}>{u.marka} {u.model}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: 6 }}>
                        <input required type="number" min="1" value={k.miktar} onChange={(e) => kalemGuncelle(i, 'miktar', e.target.value)} style={{ ...girdiStili, width: 80 }} />
                      </td>
                      <td style={{ padding: 6 }}>
                        <input required type="number" step="0.01" value={k.birim_fiyat} onChange={(e) => kalemGuncelle(i, 'birim_fiyat', e.target.value)} style={{ ...girdiStili, width: 130 }} />
                      </td>
                      <td style={{ padding: 6, fontSize: 13, fontWeight: 500 }}>{paraFormat(satirToplam, form.para_birimi)}</td>
                      <td style={{ padding: 6 }}>
                        {form.kalemler.length > 1 && (
                          <button type="button" onClick={() => kalemSil(i)} style={eylemChipStili('kirmizi')}>Sil</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <button type="button" onClick={kalemEkle} style={eylemChipStili('lacivert')}>+ Kalem ekle</button>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                Genel toplam: {paraFormat(formToplamTutar, form.para_birimi)}
              </div>
            </div>
            <DovizKarsiligiGosterge tutar={formToplamTutar} paraBirimi={form.para_birimi} />

            <div style={{ marginTop: 12 }}><Buton type="submit">Sözleşmeyi oluştur</Buton></div>
          </form>
        </Kart>
      )}

      <Kart style={{ padding: 0, marginBottom: 16 }}>
        <BasitTablo
          basliklar={['Sözleşme No', 'Leasing Firması', 'Ürünler', 'Toplam Tutar', 'Taksit Sayısı', 'İşlem']}
          satirlar={liste}
          render={(l) => (
            <tr key={l.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
              <td style={{ padding: '10px 16px', fontWeight: 500 }}>{l.sozlesme_no || `#${l.id}`}</td>
              <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{l.leasing_firmasi_unvan || `#${l.leasing_firmasi_cari_id}`}</td>
              <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>
                {(l.kalemler || []).map((k) => `${k.miktar}x ${k.urun_adi || '#' + k.stok_karti_id}`).join(', ') || '—'}
              </td>
              <td style={{ padding: '10px 16px' }}>{paraFormat(l.toplam_tutar, l.para_birimi)}</td>
              <td style={{ padding: '10px 16px' }}>{l.taksit_sayisi}</td>
              <td style={{ padding: '10px 16px' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => planiGoster(l.id)} style={eylemChipStili('lacivert')}>
                    Ödeme planını gör
                  </button>
                  <button onClick={() => sozlesmeSil(l.id)} style={eylemChipStili('kirmizi')}>Sil</button>
                </div>
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
          <table>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                {['Taksit No', 'Vade', 'Tutar', 'Durum', ''].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '8px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {seciliPlan.taksitler.map((t) => (
                <Fragment key={t.id}>
                  <tr style={{ borderTop: '1px solid var(--kenarlik)' }}>
                    <td style={{ padding: '8px 16px' }}>{t.taksit_no}</td>
                    <td style={{ padding: '8px 16px' }}>{t.vade_tarihi}</td>
                    <td style={{ padding: '8px 16px' }}>{paraFormat(t.tutar, seciliSozlesme?.para_birimi)}</td>
                    <td style={{ padding: '8px 16px' }}><Etiket ton={t.odendi_mi ? 'yesil' : 'amber'}>{t.odendi_mi ? 'Ödendi' : 'Bekliyor'}</Etiket></td>
                    <td style={{ padding: '8px 16px' }}>
                      {t.odendi_mi ? (
                        <button onClick={() => odemeyiGeriAl(t.id)} style={eylemChipStili('kirmizi')}>Geri Al</button>
                      ) : (
                        <button
                          onClick={() => setOdemeAcikTaksitId((mevcut) => (mevcut === t.id ? null : t.id))}
                          style={eylemChipStili('lacivert')}
                        >
                          {odemeAcikTaksitId === t.id ? 'Kapat' : 'Öde'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {odemeAcikTaksitId === t.id && (
                    <tr>
                      <td colSpan={5} style={{ padding: '0 16px 10px' }}>
                        <OdemeFormu
                          tutar={t.tutar}
                          paraBirimi={seciliSozlesme?.para_birimi || 'TRY'}
                          aksiyonMetni="Taksidi öde"
                          onOde={(secim) => odemeyiTamamla(t, secim)}
                          onVazgec={() => setOdemeAcikTaksitId(null)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </Kart>
      )}
    </div>
  );
}

// ============================================================== KİRALAMA
function bosKiralamaKalemi() {
  return { stok_karti_id: '', miktar: 1, birim_fiyat: '' };
}

function bosKiralamaFormu() {
  return {
    kiraci_cari_id: '', baslangic_tarihi: new Date().toISOString().slice(0, 10),
    bitis_tarihi: '', para_birimi: 'TRY', depozito: '',
    kalemler: [bosKiralamaKalemi()],
  };
}

function KiralamaSekmesi() {
  const [liste, setListe] = useState([]);
  const [formAcik, setFormAcik] = useState(false);
  const [duzenlenenSozlesme, setDuzenlenenSozlesme] = useState(null);
  const [form, setForm] = useState(bosKiralamaFormu());
  const [hata, setHata] = useState(null);
  const cariHaritasi = useCariHaritasi();
  const cariler = useCariler();
  const urunTanimlari = useUrunTanimlari();
  const [seciliSozlesme, setSeciliSozlesme] = useState(null);
  const [odemeler, setOdemeler] = useState(null);
  const [odemeForm, setOdemeForm] = useState({ donem_basi: '', donem_sonu: '', tutar: '' });
  const [odemeAcikId, setOdemeAcikId] = useState(null);

  function yukle() {
    api.get('/kiralama-sozlesmeleri').then((r) => setListe(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }
  useEffect(yukle, []);

  function kalemGuncelle(i, alan, deger) {
    setForm((f) => ({ ...f, kalemler: f.kalemler.map((k, idx) => (idx === i ? { ...k, [alan]: deger } : k)) }));
  }
  function kalemEkle() {
    setForm((f) => ({ ...f, kalemler: [...f.kalemler, bosKiralamaKalemi()] }));
  }
  function kalemSil(i) {
    setForm((f) => ({ ...f, kalemler: f.kalemler.filter((_, idx) => idx !== i) }));
  }

  const formAylikToplam = form.kalemler.reduce((acc, k) => acc + (Number(k.miktar) || 0) * (Number(k.birim_fiyat) || 0), 0);

  function duzenlemeyeBasla(sozlesme) {
    setDuzenlenenSozlesme(sozlesme);
    setForm({
      kiraci_cari_id: String(sozlesme.kiraci_cari_id),
      baslangic_tarihi: sozlesme.baslangic_tarihi,
      bitis_tarihi: sozlesme.bitis_tarihi || '',
      para_birimi: sozlesme.para_birimi,
      depozito: sozlesme.depozito || '',
      kalemler: (sozlesme.kalemler || []).length > 0
        ? sozlesme.kalemler.map((k) => ({ stok_karti_id: String(k.stok_karti_id), miktar: k.miktar, birim_fiyat: k.birim_fiyat }))
        : [bosKiralamaKalemi()],
      sifre: '',
    });
    setFormAcik(true);
  }

  function formuKapat() {
    setFormAcik(false);
    setDuzenlenenSozlesme(null);
    setForm(bosKiralamaFormu());
  }

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    if (form.kalemler.some((k) => !k.stok_karti_id || !k.birim_fiyat)) {
      setHata('Lütfen her kalem için ürün ve birim fiyat girin.');
      return;
    }
    try {
      const govde = {
        kiraci_cari_id: Number(form.kiraci_cari_id),
        baslangic_tarihi: form.baslangic_tarihi,
        bitis_tarihi: form.bitis_tarihi || null,
        para_birimi: form.para_birimi,
        depozito: form.depozito ? Number(form.depozito) : 0,
        kalemler: form.kalemler.map((k) => ({
          stok_karti_id: Number(k.stok_karti_id), miktar: Number(k.miktar), birim_fiyat: Number(k.birim_fiyat),
        })),
      };
      if (duzenlenenSozlesme) {
        await api.put(`/kiralama-sozlesmeleri/${duzenlenenSozlesme.id}`, { ...govde, sifre: form.sifre });
      } else {
        await api.post('/kiralama-sozlesmeleri', govde);
      }
      formuKapat();
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

  async function odemeyiTamamla(odeme, secim) {
    await api.put(`/kiralama-odemeleri/${odeme.id}/tahsil-et`, secim);
    setOdemeAcikId(null);
    odemeleriGoster(seciliSozlesme);
  }

  async function tahsilatiGeriAl(odemeId) {
    if (!window.confirm('Bu tahsilatı geri almak istediğinize emin misiniz? Oluşan Kasa/Banka hareketi silinecek.')) return;
    try {
      await api.put(`/kiralama-odemeleri/${odemeId}/tahsilati-geri-al`);
      odemeleriGoster(seciliSozlesme);
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  const aktifSozlesme = liste.find((l) => l.id === seciliSozlesme);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Buton onClick={() => (formAcik ? formuKapat() : setFormAcik(true))}>{formAcik ? 'Kapat' : '+ Yeni kiralama'}</Buton>
      </div>
      <HataMesaji>{hata}</HataMesaji>

      {formAcik && (
        <Kart style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>
            {duzenlenenSozlesme ? 'Sözleşmeyi düzenle' : 'Yeni kiralama'}
          </div>
          {duzenlenenSozlesme && (
            <div style={{ fontSize: 12.5, color: 'var(--metin-ikincil)', marginBottom: 12 }}>
              Not: Bu değişiklikler geçmişte oluşturulmuş dönem ödemelerini etkilemez, sadece sözleşme bilgisini ve ileride eklenecek dönemlerin referans değerini günceller.
            </div>
          )}
          <form onSubmit={kaydet}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <Alan etiket="Kiracı">
                <select required value={form.kiraci_cari_id} onChange={(e) => setForm((f) => ({ ...f, kiraci_cari_id: e.target.value }))} style={girdiStili}>
                  <option value="">Seçin...</option>
                  {cariler.map((c) => <option key={c.id} value={c.id}>{c.unvan}</option>)}
                </select>
              </Alan>
              <Alan etiket="Başlangıç tarihi">
                <input required type="date" value={form.baslangic_tarihi} onChange={(e) => setForm((f) => ({ ...f, baslangic_tarihi: e.target.value }))} style={girdiStili} />
              </Alan>
              <Alan etiket="Para birimi">
                <select value={form.para_birimi} onChange={(e) => setForm((f) => ({ ...f, para_birimi: e.target.value }))} style={girdiStili}>
                  <option value="TRY">TRY</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </Alan>
              <Alan etiket="Depozito (opsiyonel)">
                <input type="number" step="0.01" value={form.depozito} onChange={(e) => setForm((f) => ({ ...f, depozito: e.target.value }))} style={girdiStili} />
              </Alan>
            </div>

            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Ürün kalemleri (aylık kira, birden fazla ürün türü ekleyebilirsiniz)</div>
            <table style={{ width: '100%', marginBottom: 8 }}>
              <thead>
                <tr style={{ background: 'var(--zemin)' }}>
                  {['Ürün', 'Adet', 'Aylık Birim Fiyat', 'Satır Toplamı', ''].map((b) => (
                    <th key={b} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 12, color: 'var(--metin-ikincil)' }}>{b}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {form.kalemler.map((k, i) => {
                  const satirToplam = (Number(k.miktar) || 0) * (Number(k.birim_fiyat) || 0);
                  return (
                    <tr key={i} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                      <td style={{ padding: 6 }}>
                        <select required value={k.stok_karti_id} onChange={(e) => kalemGuncelle(i, 'stok_karti_id', e.target.value)} style={girdiStili}>
                          <option value="">Seçin...</option>
                          {urunTanimlari.map((u) => <option key={u.id} value={u.id}>{u.marka} {u.model}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: 6 }}>
                        <input required type="number" min="1" value={k.miktar} onChange={(e) => kalemGuncelle(i, 'miktar', e.target.value)} style={{ ...girdiStili, width: 80 }} />
                      </td>
                      <td style={{ padding: 6 }}>
                        <input required type="number" step="0.01" value={k.birim_fiyat} onChange={(e) => kalemGuncelle(i, 'birim_fiyat', e.target.value)} style={{ ...girdiStili, width: 130 }} />
                      </td>
                      <td style={{ padding: 6, fontSize: 13, fontWeight: 500 }}>{paraFormat(satirToplam, form.para_birimi)}</td>
                      <td style={{ padding: 6 }}>
                        {form.kalemler.length > 1 && (
                          <button type="button" onClick={() => kalemSil(i)} style={eylemChipStili('kirmizi')}>Sil</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <button type="button" onClick={kalemEkle} style={eylemChipStili('lacivert')}>+ Kalem ekle</button>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                Aylık toplam: {paraFormat(formAylikToplam, form.para_birimi)}
              </div>
            </div>
            <DovizKarsiligiGosterge tutar={formAylikToplam} paraBirimi={form.para_birimi} />

            {duzenlenenSozlesme && (
              <Alan etiket="Şifreniz (onay için zorunlu)">
                <input required type="password" value={form.sifre || ''} onChange={(e) => setForm((f) => ({ ...f, sifre: e.target.value }))} style={{ ...girdiStili, maxWidth: 260 }} placeholder="Giriş şifreniz" />
              </Alan>
            )}

            <div style={{ marginTop: 12 }}><Buton type="submit">{duzenlenenSozlesme ? 'Değişiklikleri kaydet' : 'Kaydet'}</Buton></div>
          </form>
        </Kart>
      )}

      <Kart style={{ padding: 0, marginBottom: 16 }}>
        <BasitTablo
          basliklar={['Ürünler', 'Kiracı', 'Aylık Kira', 'Durum', '']}
          satirlar={liste}
          render={(k) => (
            <tr key={k.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
              <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>
                {(k.kalemler || []).map((kl) => `${kl.miktar}x ${kl.urun_adi || '#' + kl.stok_karti_id}`).join(', ') || '—'}
              </td>
              <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{k.kiraci_unvan || cariGoster(k.kiraci_cari_id, cariHaritasi)}</td>
              <td style={{ padding: '10px 16px' }}>{paraFormat(k.aylik_kira_tutari, k.para_birimi)}</td>
              <td style={{ padding: '10px 16px' }}><Etiket ton={k.durum === 'AKTIF' ? 'yesil' : 'notr'}>{k.durum}</Etiket></td>
              <td style={{ padding: '10px 16px' }}>
                <button onClick={() => duzenlemeyeBasla(k)} style={eylemChipStili('lacivert')}>Düzenle</button>
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
            odemeler.length === 0 ? <BosDurum baslik="Kayıt bulunamadı" /> : (
              <table>
                <thead>
                  <tr style={{ background: 'var(--zemin)' }}>
                    {['Dönem', 'Tutar', 'Durum', ''].map((b) => (
                      <th key={b} style={{ textAlign: 'left', padding: '8px 0', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>{b}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {odemeler.map((o) => (
                    <Fragment key={o.id}>
                      <tr style={{ borderTop: '1px solid var(--kenarlik)' }}>
                        <td style={{ padding: '8px 0' }}>{o.donem_basi} → {o.donem_sonu}</td>
                        <td style={{ padding: '8px 0' }}>{paraFormat(o.tutar, aktifSozlesme?.para_birimi)}</td>
                        <td style={{ padding: '8px 0' }}><Etiket ton={o.odendi_mi ? 'yesil' : 'amber'}>{o.odendi_mi ? 'Tahsil Edildi' : 'Bekliyor'}</Etiket></td>
                        <td style={{ padding: '8px 0' }}>
                          {o.odendi_mi ? (
                            <button onClick={() => tahsilatiGeriAl(o.id)} style={eylemChipStili('kirmizi')}>Geri Al</button>
                          ) : (
                            <button
                              onClick={() => setOdemeAcikId((mevcut) => (mevcut === o.id ? null : o.id))}
                              style={eylemChipStili('lacivert')}
                            >
                              {odemeAcikId === o.id ? 'Kapat' : 'Tahsil et'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {odemeAcikId === o.id && (
                        <tr>
                          <td colSpan={4} style={{ padding: '0 0 10px' }}>
                            <OdemeFormu
                              tutar={o.tutar}
                              paraBirimi={aktifSozlesme?.para_birimi || 'TRY'}
                              aksiyonMetni="Tahsilatı tamamla"
                              onOde={(secim) => odemeyiTamamla(o, secim)}
                              onVazgec={() => setOdemeAcikId(null)}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            )
          )}
        </Kart>
      )}
    </div>
  );
}

// ============================================================== TAKSİTLİ SATIŞ
function bosTaksitKalemi() {
  return { stok_karti_id: '', miktar: 1, birim_fiyat: '' };
}

function TaksitSekmesi() {
  const [hata, setHata] = useState(null);
  const cariler = useCariler();
  const urunTanimlari = useUrunTanimlari();
  const [vadesiGecenler, setVadesiGecenler] = useState([]);
  const [formAcik, setFormAcik] = useState(false);
  const [form, setForm] = useState({
    musteri_cari_id: '', pesinat: '0',
    taksit_sayisi: 6, baslangic_tarihi: new Date().toISOString().slice(0, 10),
    kalemler: [bosTaksitKalemi()],
  });
  const [olusanPlan, setOlusanPlan] = useState(null);
  const [taksitler, setTaksitler] = useState(null);
  const [odemeAcikTaksitId, setOdemeAcikTaksitId] = useState(null);

  function vadesiGecenleriYukle() {
    api.get('/taksitler/vadesi-gecenler').then((r) => setVadesiGecenler(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }
  useEffect(vadesiGecenleriYukle, []);

  function kalemGuncelle(i, alan, deger) {
    setForm((f) => ({ ...f, kalemler: f.kalemler.map((k, idx) => (idx === i ? { ...k, [alan]: deger } : k)) }));
  }
  function kalemEkle() {
    setForm((f) => ({ ...f, kalemler: [...f.kalemler, bosTaksitKalemi()] }));
  }
  function kalemSil(i) {
    setForm((f) => ({ ...f, kalemler: f.kalemler.filter((_, idx) => idx !== i) }));
  }

  const formToplamTutar = form.kalemler.reduce((acc, k) => acc + (Number(k.miktar) || 0) * (Number(k.birim_fiyat) || 0), 0);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    if (form.kalemler.some((k) => !k.stok_karti_id || !k.birim_fiyat)) {
      setHata('Lütfen her kalem için ürün ve birim fiyat girin.');
      return;
    }
    try {
      const { data } = await api.post('/taksitli-satis-planlari', {
        musteri_cari_id: Number(form.musteri_cari_id),
        para_birimi: 'TRY',
        pesinat: Number(form.pesinat),
        taksit_sayisi: Number(form.taksit_sayisi),
        baslangic_tarihi: form.baslangic_tarihi,
        kalemler: form.kalemler.map((k) => ({
          stok_karti_id: Number(k.stok_karti_id), miktar: Number(k.miktar), birim_fiyat: Number(k.birim_fiyat),
        })),
      });
      setOlusanPlan(data);
      const { data: taksitVerisi } = await api.get(`/taksitli-satis-planlari/${data.id}/taksitler`);
      setTaksitler(taksitVerisi);
      setFormAcik(false);
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function odemeyiTamamla(taksit, secim) {
    const { data: sonuc } = await api.put(`/taksit-detay/${taksit.id}/tahsil-et`, secim);
    setOdemeAcikTaksitId(null);
    const { data } = await api.get(`/taksitli-satis-planlari/${olusanPlan.id}/taksitler`);
    setTaksitler(data);
    vadesiGecenleriYukle();
    if (sonuc.guncellenen_taksitler.length > 1) {
      window.alert(`Ödeme, taksit ${sonuc.guncellenen_taksitler[0].taksit_no}'dan ${sonuc.guncellenen_taksitler[sonuc.guncellenen_taksitler.length - 1].taksit_no}'a kadar ${sonuc.guncellenen_taksitler.length} takside otomatik olarak uygulandı.`);
    }
    if (sonuc.fazla_odeme_var_mi) {
      window.alert(`Dikkat: Tüm taksitler kapandı ve ${paraFormat(sonuc.fazla_odeme_tutari)} fazla ödeme oldu. Bu fazlalık hiçbir taksite işlenmedi, lütfen kontrol edin.`);
    }
  }

  async function tahsilatiGeriAl(taksitId) {
    if (!window.confirm('Bu tahsilatı geri almak istediğinize emin misiniz? Oluşan Kasa/Banka hareketi silinecek. Bu ödeme başka taksitlere de yansımışsa, onlar da birlikte geri alınacaktır.')) return;
    try {
      const { data: sonuc } = await api.put(`/taksit-detay/${taksitId}/tahsilati-geri-al`);
      const { data } = await api.get(`/taksitli-satis-planlari/${olusanPlan.id}/taksitler`);
      setTaksitler(data);
      vadesiGecenleriYukle();
      if (sonuc.etkilenen_taksit_sayisi > 1) {
        window.alert(`${sonuc.etkilenen_taksit_sayisi} taksit birlikte geri alındı (aynı ödemeyle ilişkiliydiler).`);
      }
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
          <form onSubmit={kaydet}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <Alan etiket="Müşteri">
                <select required value={form.musteri_cari_id} onChange={(e) => setForm((f) => ({ ...f, musteri_cari_id: e.target.value }))} style={girdiStili}>
                  <option value="">Seçin...</option>
                  {cariler.map((c) => <option key={c.id} value={c.id}>{c.unvan}</option>)}
                </select>
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
            </div>

            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Ürün kalemleri (birden fazla ürün türü ekleyebilirsiniz)</div>
            <table style={{ width: '100%', marginBottom: 8 }}>
              <thead>
                <tr style={{ background: 'var(--zemin)' }}>
                  {['Ürün', 'Adet', 'Birim Fiyat', 'Satır Toplamı', ''].map((b) => (
                    <th key={b} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 12, color: 'var(--metin-ikincil)' }}>{b}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {form.kalemler.map((k, i) => {
                  const satirToplam = (Number(k.miktar) || 0) * (Number(k.birim_fiyat) || 0);
                  return (
                    <tr key={i} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                      <td style={{ padding: 6 }}>
                        <select required value={k.stok_karti_id} onChange={(e) => kalemGuncelle(i, 'stok_karti_id', e.target.value)} style={girdiStili}>
                          <option value="">Seçin...</option>
                          {urunTanimlari.map((u) => <option key={u.id} value={u.id}>{u.marka} {u.model}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: 6 }}>
                        <input required type="number" min="1" value={k.miktar} onChange={(e) => kalemGuncelle(i, 'miktar', e.target.value)} style={{ ...girdiStili, width: 80 }} />
                      </td>
                      <td style={{ padding: 6 }}>
                        <input required type="number" step="0.01" value={k.birim_fiyat} onChange={(e) => kalemGuncelle(i, 'birim_fiyat', e.target.value)} style={{ ...girdiStili, width: 130 }} />
                      </td>
                      <td style={{ padding: 6, fontSize: 13, fontWeight: 500 }}>{paraFormat(satirToplam)}</td>
                      <td style={{ padding: 6 }}>
                        {form.kalemler.length > 1 && (
                          <button type="button" onClick={() => kalemSil(i)} style={eylemChipStili('kirmizi')}>Sil</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <button type="button" onClick={kalemEkle} style={eylemChipStili('lacivert')}>+ Kalem ekle</button>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                Toplam tutar: {paraFormat(formToplamTutar)} {form.pesinat ? `(Peşinat sonrası: ${paraFormat(formToplamTutar - Number(form.pesinat || 0))})` : ''}
              </div>
            </div>

            <Buton type="submit">Plan oluştur</Buton>
          </form>
        </Kart>
      )}

      {taksitler && (
        <Kart style={{ padding: 0, marginBottom: 16 }}>
          <div style={{ padding: '12px 16px', fontWeight: 600, fontSize: 13.5, borderBottom: '1px solid var(--kenarlik)' }}>
            Plan #{olusanPlan.id} — {olusanPlan.musteri_unvan || 'Müşteri'}
            {(olusanPlan.kalemler || []).length > 0 && ` — ${olusanPlan.kalemler.map((k) => `${k.miktar}x ${k.urun_adi || '#' + k.stok_karti_id}`).join(', ')}`}
          </div>
          <table>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                {['Taksit No', 'Vade', 'Tutar', 'Kalan Bakiye', 'Durum', ''].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '8px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {taksitler.map((t) => {
                const kalanBakiye = t.tutar - (t.odenen_tutar || 0);
                const kismenOdendi = !t.odendi_mi && Number(t.odenen_tutar || 0) > 0;
                return (
                  <Fragment key={t.id}>
                    <tr style={{ borderTop: '1px solid var(--kenarlik)' }}>
                      <td style={{ padding: '8px 16px' }}>{t.taksit_no}</td>
                      <td style={{ padding: '8px 16px' }}>{t.vade_tarihi}</td>
                      <td style={{ padding: '8px 16px' }}>{paraFormat(t.tutar)}</td>
                      <td style={{ padding: '8px 16px', color: kismenOdendi ? 'var(--kirmizi)' : 'var(--metin-ikincil)' }}>
                        {t.odendi_mi ? '—' : paraFormat(kalanBakiye)}
                      </td>
                      <td style={{ padding: '8px 16px' }}>
                        <Etiket ton={t.odendi_mi ? 'yesil' : kismenOdendi ? 'amber' : 'notr'}>
                          {t.odendi_mi ? 'Tahsil Edildi' : kismenOdendi ? 'Kısmen Ödendi' : 'Bekliyor'}
                        </Etiket>
                      </td>
                      <td style={{ padding: '8px 16px' }}>
                        {t.odendi_mi ? (
                          <button onClick={() => tahsilatiGeriAl(t.id)} style={eylemChipStili('kirmizi')}>Geri Al</button>
                        ) : (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => setOdemeAcikTaksitId((mevcut) => (mevcut === t.id ? null : t.id))}
                              style={eylemChipStili('lacivert')}
                            >
                              {odemeAcikTaksitId === t.id ? 'Kapat' : 'Tahsil et'}
                            </button>
                            {kismenOdendi && (
                              <button onClick={() => tahsilatiGeriAl(t.id)} style={eylemChipStili('kirmizi')}>Geri Al</button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                    {odemeAcikTaksitId === t.id && (
                      <tr>
                        <td colSpan={6} style={{ padding: '0 16px 10px' }}>
                          <OdemeFormu
                            tutar={kalanBakiye}
                            paraBirimi="TRY"
                            aksiyonMetni="Tahsilatı tamamla"
                            tutarDuzenlenebilir
                            tutarEtiketi={`Tahsil edilecek tutar (TL) — kalan bakiye: ${paraFormat(kalanBakiye)}`}
                            onOde={(secim) => odemeyiTamamla(t, secim)}
                            onVazgec={() => setOdemeAcikTaksitId(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </Kart>
      )}

      <Kart style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', fontWeight: 600, fontSize: 13.5, borderBottom: '1px solid var(--kenarlik)' }}>
          Vadesi geçen taksitler (tüm planlar)
        </div>
        <BasitTablo
          basliklar={['Müşteri', 'Ürün', 'Taksit No', 'Vade', 'Tutar']}
          satirlar={vadesiGecenler}
          render={(t) => (
            <tr key={t.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
              <td style={{ padding: '10px 16px' }}>{t.musteri_unvan || '—'}</td>
              <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{t.urun_seri_no || '—'}</td>
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
const MALIYET_TIPLERI_STOK = {
  NAKLIYE: 'Nakliye', GUMRUK: 'Gümrük', ANTREPO: 'Antrepo', MILLILESTIRME: 'Millileştirme',
  LEASING: 'Leasing', DIGER: 'Diğer',
};

function bosSabitGiderFormu() {
  return { kategori: '', donem: new Date().toISOString().slice(0, 10), tutar: '', para_birimi: 'TRY', kur: '1', aciklama: '', sifre: '' };
}

function GiderSipariseDagitPaneli({ gider, onTamam, onVazgec }) {
  const [siparisler, setSiparisler] = useState([]);
  const [siparisId, setSiparisId] = useState('');
  const [urunSayisi, setUrunSayisi] = useState(null);
  const [maliyetTipi, setMaliyetTipi] = useState('DIGER');
  const [yontem, setYontem] = useState('ESIT');
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => {
    api.get('/siparisler').then((r) => setSiparisler(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!siparisId) { setUrunSayisi(null); return; }
    api.get('/stok-seri-no', { params: { siparis_id: siparisId } })
      .then((r) => setUrunSayisi(r.data.length))
      .catch(() => setUrunSayisi(null));
  }, [siparisId]);

  async function dagit() {
    if (!siparisId) { setHata('Lütfen bir sipariş seçin.'); return; }
    setHata(null);
    setKaydediliyor(true);
    try {
      const { data: urunler } = await api.get('/stok-seri-no', { params: { siparis_id: siparisId } });
      if (urunler.length === 0) {
        setHata('Bu siparişe ait teslim alınmış ürün bulunamadı.');
        setKaydediliyor(false);
        return;
      }
      await api.post('/stok-seri-no/toplu-maliyet-dagit', {
        stok_seri_no_idleri: urunler.map((u) => u.id),
        tip: maliyetTipi,
        aciklama: gider.kategori ? `${gider.kategori} (Diğer Giderler'den dağıtıldı)` : "Diğer Giderler'den dağıtıldı",
        para_birimi: gider.para_birimi,
        toplam_tutar: Number(gider.tutar),
        kur: Number(gider.kur),
        tarih: gider.donem,
        yontem,
      });
      onTamam();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  return (
    <div style={{ padding: 14, background: 'var(--zemin)', borderRadius: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
        "{gider.kategori}" giderini ({paraFormat(gider.tutar, gider.para_birimi)}) bir siparişin ürünlerine maliyet olarak dağıt
      </div>
      <HataMesaji>{hata}</HataMesaji>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <Alan etiket="Sipariş">
          <select value={siparisId} onChange={(e) => setSiparisId(e.target.value)} style={girdiStili}>
            <option value="">Seçin...</option>
            {siparisler.map((s) => <option key={s.id} value={s.id}>{s.siparis_no}</option>)}
          </select>
          {siparisId && urunSayisi != null && (
            <div style={{ fontSize: 12, color: 'var(--metin-ikincil)', marginTop: 4 }}>
              Bu siparişte teslim alınmış {urunSayisi} ürün bulundu, tutar aralarında dağıtılacak.
            </div>
          )}
        </Alan>
        <Alan etiket="Maliyet tipi">
          <select value={maliyetTipi} onChange={(e) => setMaliyetTipi(e.target.value)} style={girdiStili}>
            {Object.entries(MALIYET_TIPLERI_STOK).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Alan>
        <Alan etiket="Dağıtım yöntemi">
          <select value={yontem} onChange={(e) => setYontem(e.target.value)} style={girdiStili}>
            <option value="ESIT">Eşit dağıt</option>
            <option value="AGIRLIKLI">Satınalma maliyetine göre ağırlıklı dağıt</option>
          </select>
        </Alan>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <Buton onClick={dagit} disabled={kaydediliyor || !siparisId}>{kaydediliyor ? 'Dağıtılıyor...' : 'Dağıt ve Kaydet'}</Buton>
        <Buton variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
      </div>
    </div>
  );
}

function SabitGiderSekmesi() {
  const [liste, setListe] = useState([]);
  const harcamaTurleri = useHarcamaTurleri();
  const [formAcik, setFormAcik] = useState(false);
  const [duzenlenenGider, setDuzenlenenGider] = useState(null);
  const [form, setForm] = useState(bosSabitGiderFormu());
  const [hata, setHata] = useState(null);
  const [odemeAcikId, setOdemeAcikId] = useState(null);
  const [dagitimAcikId, setDagitimAcikId] = useState(null);

  function yukle() {
    api.get('/sabit-giderler').then((r) => setListe(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }
  useEffect(yukle, []);

  useEffect(() => {
    if (form.para_birimi !== 'TRY') {
      api.get(`/kur/${form.para_birimi}`).then((r) => setForm((f) => ({ ...f, kur: String(r.data.kur) }))).catch(() => {});
    }
  }, [form.para_birimi]);

  function duzenlemeyeBasla(g) {
    setDuzenlenenGider(g);
    setForm({ kategori: g.kategori || '', donem: g.donem, tutar: String(g.tutar), para_birimi: g.para_birimi, kur: String(g.kur), aciklama: g.aciklama || '', sifre: '' });
    setFormAcik(true);
  }

  function formuKapat() {
    setFormAcik(false);
    setDuzenlenenGider(null);
    setForm(bosSabitGiderFormu());
  }

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    try {
      if (duzenlenenGider) {
        await api.put(`/sabit-giderler/${duzenlenenGider.id}`, {
          sifre: form.sifre, kategori: form.kategori, donem: form.donem,
          tutar: Number(form.tutar), para_birimi: form.para_birimi, kur: Number(form.kur), aciklama: form.aciklama,
        });
      } else {
        await api.post('/sabit-giderler', {
          kategori: form.kategori, donem: form.donem, tutar: Number(form.tutar),
          para_birimi: form.para_birimi, kur: Number(form.kur), aciklama: form.aciklama,
        });
      }
      formuKapat();
      yukle();
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function odemeyiTamamla(gider, secim) {
    await api.put(`/sabit-giderler/${gider.id}/ode`, secim);
    setOdemeAcikId(null);
    yukle();
  }

  async function odemeyiGeriAl(giderId) {
    if (!window.confirm('Bu ödemeyi geri almak istediğinize emin misiniz? Oluşan Kasa/Banka hareketi silinecek.')) return;
    try {
      await api.put(`/sabit-giderler/${giderId}/odemeyi-geri-al`);
      yukle();
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function sil(giderId) {
    if (!window.confirm('Bu gider kaydını silmek istediğinize emin misiniz?')) return;
    try {
      await api.delete(`/sabit-giderler/${giderId}`);
      yukle();
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Buton onClick={() => (formAcik ? formuKapat() : setFormAcik(true))}>{formAcik ? 'Kapat' : '+ Yeni gider'}</Buton>
      </div>
      <HataMesaji>{hata}</HataMesaji>

      {formAcik && (
        <Kart style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
            {duzenlenenGider ? 'Gideri düzenle' : 'Yeni gider'}
          </div>
          <form onSubmit={kaydet} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 12 }}>
            <Alan etiket="Kategori">
              <OtomatikTamamlamaGirdisi
                value={form.kategori}
                onChange={(v) => setForm((f) => ({ ...f, kategori: v }))}
                secenekler={harcamaTurleri}
                listeId="harcama-turleri-sabit-gider-kategori"
                placeholder="Yazmaya başlayın veya listeden seçin"
              />
            </Alan>
            <Alan etiket="Dönem">
              <input required type="date" value={form.donem} onChange={(e) => setForm((f) => ({ ...f, donem: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Para birimi">
              <select value={form.para_birimi} onChange={(e) => setForm((f) => ({ ...f, para_birimi: e.target.value }))} style={girdiStili}>
                <option value="TRY">TRY</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </Alan>
            <Alan etiket="Tutar">
              <input required type="number" step="0.01" value={form.tutar} onChange={(e) => setForm((f) => ({ ...f, tutar: e.target.value }))} style={girdiStili} />
            </Alan>
            {form.para_birimi !== 'TRY' ? (
              <Alan etiket={`Kur (${form.para_birimi} → TL)`}>
                <input type="number" step="0.0001" value={form.kur} onChange={(e) => setForm((f) => ({ ...f, kur: e.target.value }))} style={girdiStili} />
              </Alan>
            ) : <div />}
            <Alan etiket="Açıklama">
              <OtomatikTamamlamaGirdisi
                value={form.aciklama}
                onChange={(v) => setForm((f) => ({ ...f, aciklama: v }))}
                secenekler={harcamaTurleri}
                listeId="harcama-turleri-sabit-gider"
                placeholder="Yazmaya başlayın veya listeden seçin"
              />
            </Alan>
            {duzenlenenGider && (
              <Alan etiket="Şifreniz (onay için zorunlu)">
                <input required type="password" value={form.sifre} onChange={(e) => setForm((f) => ({ ...f, sifre: e.target.value }))} style={girdiStili} placeholder="Giriş şifreniz" />
              </Alan>
            )}
            <div style={{ alignSelf: 'end' }}>
              <Buton type="submit">{duzenlenenGider ? 'Değişiklikleri kaydet' : 'Kaydet'}</Buton>
            </div>
          </form>
        </Kart>
      )}

      <Kart style={{ padding: 0 }}>
        {liste.length === 0 ? <BosDurum baslik="Kayıt bulunamadı" /> : (
          <table>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                {['Kategori', 'Dönem', 'Tutar', 'TL Karşılığı', 'Açıklama', 'Durum', ''].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {liste.map((g) => (
                <Fragment key={g.id}>
                  <tr style={{ borderTop: '1px solid var(--kenarlik)' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 500 }}>{g.kategori || '—'}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{g.donem}</td>
                    <td style={{ padding: '10px 16px' }}>{paraFormat(g.tutar, g.para_birimi)}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{g.para_birimi !== 'TRY' ? paraFormat(g.tutar_try) : '—'}</td>
                    <td style={{ padding: '10px 16px' }}>{g.aciklama || '—'}</td>
                    <td style={{ padding: '10px 16px' }}><Etiket ton={g.odendi_mi ? 'yesil' : 'amber'}>{g.odendi_mi ? 'Ödendi' : 'Bekliyor'}</Etiket></td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {g.odendi_mi ? (
                          <button onClick={() => odemeyiGeriAl(g.id)} style={eylemChipStili('kirmizi')}>Geri Al</button>
                        ) : (
                          <>
                            <button onClick={() => duzenlemeyeBasla(g)} style={eylemChipStili('notr')}>Düzenle</button>
                            <button
                              onClick={() => setOdemeAcikId((mevcut) => (mevcut === g.id ? null : g.id))}
                              style={eylemChipStili('lacivert')}
                            >
                              {odemeAcikId === g.id ? 'Kapat' : 'Öde'}
                            </button>
                            <button
                              onClick={() => setDagitimAcikId((mevcut) => (mevcut === g.id ? null : g.id))}
                              style={eylemChipStili('amber')}
                            >
                              {dagitimAcikId === g.id ? 'Kapat' : 'Siparişe Dağıt'}
                            </button>
                            <button onClick={() => sil(g.id)} style={eylemChipStili('kirmizi')}>Sil</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {odemeAcikId === g.id && (
                    <tr>
                      <td colSpan={7} style={{ padding: '0 16px 10px' }}>
                        <OdemeFormu
                          tutar={g.tutar_try}
                          paraBirimi="TRY"
                          onOde={(secim) => odemeyiTamamla(g, secim)}
                          onVazgec={() => setOdemeAcikId(null)}
                        />
                      </td>
                    </tr>
                  )}
                  {dagitimAcikId === g.id && (
                    <tr>
                      <td colSpan={7} style={{ padding: '0 16px 10px' }}>
                        <GiderSipariseDagitPaneli
                          gider={g}
                          onTamam={() => setDagitimAcikId(null)}
                          onVazgec={() => setDagitimAcikId(null)}
                        />
                      </td>
                    </tr>
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

// ============================================================== ORTAK / DIŞ BORÇ
const BORC_TIP_METIN = { ORTAKTAN_ALINAN: 'Ortaktan Alınan', DISARIDAN_ALINAN: 'Dışarıdan Alınan', ORTAGA_VERILEN: 'Ortağa Verilen' };

function BorcSekmesi() {
  const [liste, setListe] = useState([]);
  const [formAcik, setFormAcik] = useState(false);
  const [form, setForm] = useState({ tip: 'ORTAKTAN_ALINAN', cari_id: '', tutar: '', para_birimi: 'TRY', alinma_tarihi: new Date().toISOString().slice(0, 10) });
  const [hata, setHata] = useState(null);
  const [bakiyeler, setBakiyeler] = useState({});
  const cariHaritasi = useCariHaritasi();
  const cariler = useCariler();
  const [odemeAcikId, setOdemeAcikId] = useState(null);
  const [odemeTutari, setOdemeTutari] = useState('');

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

  async function odemeyiTamamla(borc, secim) {
    if (!odemeTutari || Number(odemeTutari) <= 0) {
      throw new Error('Lütfen geçerli bir ödeme tutarı girin.');
    }
    await api.post(`/borclar/${borc.id}/odeme`, { tarih: secim.odeme_tarihi, tutar: Number(odemeTutari), ...secim });
    setOdemeAcikId(null);
    setOdemeTutari('');
    bakiyeyiGetir(borc.id);
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
            <Alan etiket="Cari">
              <select required value={form.cari_id} onChange={(e) => setForm((f) => ({ ...f, cari_id: e.target.value }))} style={girdiStili}>
                <option value="">Seçin...</option>
                {cariler.map((c) => <option key={c.id} value={c.id}>{c.unvan}</option>)}
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
            <DovizKarsiligiGosterge tutar={form.tutar} paraBirimi={form.para_birimi} />
            <Alan etiket="Alınma tarihi">
              <input required type="date" value={form.alinma_tarihi} onChange={(e) => setForm((f) => ({ ...f, alinma_tarihi: e.target.value }))} style={girdiStili} />
            </Alan>
            <div style={{ alignSelf: 'end' }}><Buton type="submit">Kaydet</Buton></div>
          </form>
        </Kart>
      )}

      <Kart style={{ padding: 0 }}>
        {liste.length === 0 ? <BosDurum baslik="Kayıt bulunamadı" /> : (
          <table>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                {['Tip', 'Cari', 'Toplam Borç', 'Kalan Bakiye', ''].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {liste.map((b) => (
                <Fragment key={b.id}>
                  <tr style={{ borderTop: '1px solid var(--kenarlik)' }}>
                    <td style={{ padding: '10px 16px' }}>{BORC_TIP_METIN[b.tip]}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{cariGoster(b.cari_id, cariHaritasi)}</td>
                    <td style={{ padding: '10px 16px' }}>{paraFormat(b.tutar, b.para_birimi)}</td>
                    <td style={{ padding: '10px 16px', fontWeight: 500 }}>
                      {bakiyeler[b.id] ? paraFormat(bakiyeler[b.id].kalan_bakiye, b.para_birimi)
                        : <button onClick={() => bakiyeyiGetir(b.id)} style={eylemChipStili('lacivert')}>Göster</button>}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <button
                        onClick={() => { setOdemeAcikId((mevcut) => (mevcut === b.id ? null : b.id)); setOdemeTutari(''); }}
                        style={eylemChipStili('lacivert')}
                      >
                        {odemeAcikId === b.id ? 'Kapat' : 'Ödeme ekle'}
                      </button>
                    </td>
                  </tr>
                  {odemeAcikId === b.id && (
                    <tr>
                      <td colSpan={5} style={{ padding: '0 16px 10px' }}>
                        <div style={{ marginBottom: 8 }}>
                          <Alan etiket="Ödeme tutarı">
                            <input
                              type="number" step="0.01" value={odemeTutari}
                              onChange={(e) => setOdemeTutari(e.target.value)}
                              style={{ ...girdiStili, maxWidth: 200 }}
                            />
                          </Alan>
                        </div>
                        <OdemeFormu
                          tutar={odemeTutari}
                          paraBirimi={b.para_birimi}
                          aksiyonMetni="Ödemeyi tamamla"
                          onOde={(secim) => odemeyiTamamla(b, secim)}
                          onVazgec={() => setOdemeAcikId(null)}
                        />
                      </td>
                    </tr>
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

export default function FinansalTakipSayfasi() {
  const [sekme, setSekme] = useState('taksit');

  return (
    <div>
      <SayfaBasligi baslik="Finansal takip" aciklama="Çek, leasing, taksitli satış, kiralama, bakım, personel, diğer giderler ve borçlar" />
      <GruplananSekmeler aktif={sekme} onDegistir={setSekme} />

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
