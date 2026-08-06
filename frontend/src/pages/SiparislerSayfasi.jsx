import { useEffect, useState, Fragment } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, hataMesajiCikar, ozelOnayIste, ozelPrompt } from '../api/client';
import { Kart, SayfaBasligi, Buton, Alan, girdiStili, Etiket, BosDurum, HataMesaji, paraFormat, eylemChipStili, ParaGirdisi, useKademelıGoster, DahaFazlaGosterButonu, DahaFazlaMenu, TabloIskeleti, MALIYET_TIP_METIN, ManuelMaliyetKalemiEkleFormu } from '../components/Ortak';
import { excelIndir } from '../utils/disaAktarma';
import BelgeSablonu from '../components/BelgeSablonu';
import AramaliSecici from '../components/AramaliSecici';

// ISO (yyyy-mm-dd) formatindaki bir tarihi gg/aa/yyyy olarak gosterir.
// Bos/gecersiz deger icin '-' doner. Sadece GORUNTULEME icin kullanilir,
// <input type="date"> alanlari (duzenleme) buna dokunmaz.
function tarihFormat(iso) {
  if (!iso || typeof iso !== 'string' || !iso.includes('-')) return iso || '—';
  const [yil, ay, gun] = iso.slice(0, 10).split('-');
  if (!yil || !ay || !gun) return iso;
  return `${gun}/${ay}/${yil}`;
}

function useSiralama() {
  const [alan, setAlan] = useState(null);
  const [yon, setYon] = useState('asc');
  function tikla(yeniAlan) {
    if (alan === yeniAlan) setYon((y) => (y === 'asc' ? 'desc' : 'asc'));
    else { setAlan(yeniAlan); setYon('asc'); }
  }
  function sirala(liste, degerFn) {
    if (!alan) return liste;
    return [...liste].sort((a, b) => {
      const av = degerFn(a, alan);
      const bv = degerFn(b, alan);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'string') {
        return yon === 'asc' ? av.localeCompare(bv, 'tr') : bv.localeCompare(av, 'tr');
      }
      return yon === 'asc' ? av - bv : bv - av;
    });
  }
  return { alan, yon, tikla, sirala };
}

function SiraliBaslik({ children, alanAdi, siralama, style }) {
  const aktif = siralama.alan === alanAdi;
  return (
    <th
      onClick={() => siralama.tikla(alanAdi)}
      style={{
        textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)',
        fontWeight: 500, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', ...style,
      }}
    >
      {children} {aktif ? (siralama.yon === 'asc' ? '▲' : '▼') : ''}
    </th>
  );
}

const API_TABAN_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const DURUM_ETIKET = {
  TASLAK: 'notr', ONAYLANDI: 'amber', YOLDA: 'amber', GUMRUKTE: 'amber',
  TESLIM_ALINDI: 'yesil', TAMAMLANDI: 'yesil', IPTAL: 'kirmizi',
};

const DURUM_METIN = {
  TASLAK: 'Taslak', ONAYLANDI: 'Onaylandı', YOLDA: 'Yolda', GUMRUKTE: 'Gümrükte',
  TESLIM_ALINDI: 'Teslim Alındı', TAMAMLANDI: 'Tamamlandı', IPTAL: 'İptal',
};

// Bu durumlar KESIN/SON durumlardir - artik hicbir islem yapilamaz.
const SON_DURUMLAR = ['TAMAMLANDI', 'IPTAL'];


// Siparise (tedarikciye) yapilan avans/ara/kapama odemelerini yonetir.
// Stok maliyeti hesabindan BAGIMSIZDIR - sadece nakit akisini/kalan bakiyeyi takip eder.
const SIPARIS_360_DURUM_METIN = {
  DEPODA: 'Depoda', SIPARISTE: 'Siparişte', YOLDA: 'Yolda', GUMRUKTE: 'Gümrükte',
  ANTREPODA: 'Antrepoda', SATILDI: 'Satıldı', KIRADA: 'Kirada', BAKIMDA: 'Bakımda', HURDA: 'Hurda',
};

function Siparis360Paneli({ siparis, onKapat }) {
  const [veri, setVeri] = useState(null);
  const [hata, setHata] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get(`/siparisler/${siparis.id}/odemeler`).catch(() => ({ data: [] })),
      api.get(`/siparisler/${siparis.id}/bakiye`).catch(() => ({ data: null })),
      api.get(`/siparisler/${siparis.id}/gumruk-beyannameleri`).catch(() => ({ data: [] })),
      api.get('/akreditifler', { params: { siparis_id: siparis.id } }).catch(() => ({ data: [] })),
      api.get('/stok-seri-no', { params: { siparis_id: siparis.id } }).catch(() => ({ data: [] })),
    ]).then(([odemeler, bakiye, gumruk, akreditifler, urunler]) => {
      setVeri({
        odemeler: odemeler.data, bakiye: bakiye.data, gumruk: gumruk.data,
        akreditifler: akreditifler.data, urunler: urunler.data,
      });
    }).catch((e) => setHata(hataMesajiCikar(e)));
  }, [siparis.id]);

  return (
    <Kart style={{ margin: '8px 16px 16px', background: 'var(--zemin)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{siparis.siparis_no} — Sipariş Detayı</div>
        <Buton variant="ikincil" onClick={onKapat}>Kapat</Buton>
      </div>
      <HataMesaji>{hata}</HataMesaji>
      {!veri ? (
        <div style={{ color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--metin-ikincil)' }}>Toplam Tutar</div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{veri.bakiye ? paraFormat(veri.bakiye.toplam_siparis_tutari, siparis.para_birimi) : '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--metin-ikincil)' }}>Ödenen</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--yesil)' }}>{veri.bakiye ? paraFormat(veri.bakiye.toplam_odenen, siparis.para_birimi) : '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--metin-ikincil)' }}>Kalan Bakiye</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--kirmizi)' }}>{veri.bakiye ? paraFormat(veri.bakiye.kalan_bakiye, siparis.para_birimi) : '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--metin-ikincil)' }}>Gümrük Beyannamesi</div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{veri.gumruk.length} adet</div>
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--metin-ikincil)' }}>Akreditif</div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{veri.akreditifler.length > 0 ? `${veri.akreditifler.length} adet` : 'Yok'}</div>
            </div>
          </div>

          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Ürünlerin Güncel Durumu</div>
          {veri.urunler.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--metin-soluk)', marginBottom: 16 }}>Henüz teslim alınmış/kaydedilmiş ürün yok.</div>
          ) : (
            <table style={{ marginBottom: 16 }}>
              <thead>
                <tr style={{ background: 'white' }}>
                  {['Seri No', 'Durum'].map((b) => (
                    <th key={b} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 12, color: 'var(--metin-ikincil)' }}>{b}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {veri.urunler.map((u) => (
                  <tr key={u.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                    <td style={{ padding: '6px 10px', fontFamily: 'var(--font-mono)' }}>{u.seri_no}</td>
                    <td style={{ padding: '6px 10px' }}>
                      <Etiket ton={u.durum === 'SATILDI' ? 'yesil' : u.durum === 'HURDA' ? 'kirmizi' : 'notr'}>
                        {SIPARIS_360_DURUM_METIN[u.durum] || u.durum}
                      </Etiket>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {veri.akreditifler.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>İlişkili Akreditif(ler)</div>
              <table>
                <thead>
                  <tr style={{ background: 'white' }}>
                    {['Akreditif No', 'Tutar', 'Durum'].map((b) => (
                      <th key={b} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 12, color: 'var(--metin-ikincil)' }}>{b}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {veri.akreditifler.map((ak) => (
                    <tr key={ak.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                      <td style={{ padding: '6px 10px' }}>{ak.akreditif_no || `#${ak.id}`}</td>
                      <td style={{ padding: '6px 10px' }}>{paraFormat(ak.tutar, ak.para_birimi)}</td>
                      <td style={{ padding: '6px 10px', color: 'var(--metin-ikincil)' }}>{ak.durum}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </Kart>
  );
}

function GumrukBeyannameleriPaneli({ siparis, cariler, onKapat }) {
  const [liste, setListe] = useState(null);
  const [formAcik, setFormAcik] = useState(false);
  const [form, setForm] = useState({
    beyanname_no: '', beyanname_tarihi: new Date().toISOString().slice(0, 10),
    gumruk_musaviri_cari_id: '', tutar: '', para_birimi: 'TRY', kur: '1', kdv_tutari: '', notlar: '',
  });
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  function yukle() {
    api.get(`/siparisler/${siparis.id}/gumruk-beyannameleri`).then((r) => setListe(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }
  useEffect(() => { yukle(); }, [siparis.id]); // eslint-disable-line

  useEffect(() => {
    if (form.para_birimi !== 'TRY') {
      api.get(`/kur/${form.para_birimi}`).then((r) => setForm((f) => ({ ...f, kur: String(r.data.kur) }))).catch(() => {});
    }
  }, [form.para_birimi]);

  async function ekle(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      await api.post(`/siparisler/${siparis.id}/gumruk-beyannameleri`, {
        beyanname_no: form.beyanname_no || null,
        beyanname_tarihi: form.beyanname_tarihi,
        gumruk_musaviri_cari_id: form.gumruk_musaviri_cari_id ? Number(form.gumruk_musaviri_cari_id) : null,
        tutar: Number(form.tutar),
        para_birimi: form.para_birimi,
        kur: Number(form.kur),
        kdv_tutari: form.kdv_tutari ? Number(form.kdv_tutari) : 0,
        notlar: form.notlar || null,
      });
      setFormAcik(false);
      setForm({ beyanname_no: '', beyanname_tarihi: new Date().toISOString().slice(0, 10), gumruk_musaviri_cari_id: '', tutar: '', para_birimi: 'TRY', kur: '1', kdv_tutari: '', notlar: '' });
      yukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  async function sil(id) {
    if (!(await ozelOnayIste('Bu gümrük beyannamesi kaydını silmek istediğinize emin misiniz?'))) return;
    try {
      await api.delete(`/siparisler/gumruk-beyannameleri/${id}`);
      yukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  return (
    <Kart style={{ margin: '8px 16px 16px', background: 'var(--zemin)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{siparis.siparis_no} — Gümrük beyannameleri</div>
        <Buton variant="ikincil" onClick={onKapat}>Kapat</Buton>
      </div>
      <HataMesaji>{hata}</HataMesaji>

      <div style={{ marginBottom: 12 }}>
        <Buton onClick={() => setFormAcik((a) => !a)}>{formAcik ? 'Kapat' : '+ Yeni beyanname ekle'}</Buton>
      </div>

      {formAcik && (
        <form onSubmit={ekle} style={{ marginBottom: 16, padding: 12, background: 'white', border: '1px solid var(--kenarlik)', borderRadius: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Alan etiket="Beyanname no">
              <input value={form.beyanname_no} onChange={(e) => setForm((f) => ({ ...f, beyanname_no: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Beyanname tarihi">
              <input required type="date" value={form.beyanname_tarihi} onChange={(e) => setForm((f) => ({ ...f, beyanname_tarihi: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Gümrük müşaviri (cari)">
              <select value={form.gumruk_musaviri_cari_id} onChange={(e) => setForm((f) => ({ ...f, gumruk_musaviri_cari_id: e.target.value }))} style={girdiStili}>
                <option value="">Yok</option>
                {(cariler || []).map((c) => <option key={c.id} value={c.id}>{c.unvan}</option>)}
              </select>
            </Alan>
            <Alan etiket="Para birimi">
              <select value={form.para_birimi} onChange={(e) => setForm((f) => ({ ...f, para_birimi: e.target.value }))} style={girdiStili}>
                <option value="TRY">TRY</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </Alan>
            <Alan etiket="Tutar">
              <ParaGirdisi required value={form.tutar} onChange={(v) => setForm((f) => ({ ...f, tutar: v }))} />
            </Alan>
            {form.para_birimi !== 'TRY' && (
              <Alan etiket={`Kur (${form.para_birimi} → TL)`}>
                <input type="number" step="0.0001" value={form.kur} onChange={(e) => setForm((f) => ({ ...f, kur: e.target.value }))} style={girdiStili} />
              </Alan>
            )}
            <Alan etiket="KDV tutarı (opsiyonel, TL — bu tutarın ne kadarı KDV, KDV Özeti raporuna otomatik yansır)">
              <ParaGirdisi value={form.kdv_tutari} onChange={(v) => setForm((f) => ({ ...f, kdv_tutari: v }))} />
            </Alan>
            <Alan etiket="Notlar">
              <input value={form.notlar} onChange={(e) => setForm((f) => ({ ...f, notlar: e.target.value }))} style={girdiStili} />
            </Alan>
          </div>
          <Buton type="submit" disabled={kaydediliyor} style={{ marginTop: 10 }}>{kaydediliyor ? 'Kaydediliyor...' : 'Kaydet'}</Buton>
        </form>
      )}

      {liste === null ? (
        <div style={{ color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
      ) : liste.length === 0 ? (
        <BosDurum baslik="Bu siparişe ait gümrük beyannamesi kaydı yok" />
      ) : (
        <table style={{ width: '100%', background: 'white' }}>
          <thead>
            <tr>
              {['Beyanname No', 'Tarih', 'Gümrük Müşaviri', 'Tutar', 'KDV', 'Notlar', ''].map((b) => (
                <th key={b} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--metin-ikincil)' }}>{b}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {liste.map((b) => (
              <tr key={b.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                <td style={{ padding: '8px 12px' }}>{b.beyanname_no || '—'}</td>
                <td style={{ padding: '8px 12px' }}>{b.beyanname_tarihi}</td>
                <td style={{ padding: '8px 12px', color: 'var(--metin-ikincil)' }}>{b.gumruk_musaviri_unvan || '—'}</td>
                <td style={{ padding: '8px 12px', fontWeight: 500 }}>{paraFormat(b.tutar, b.para_birimi)}</td>
                <td style={{ padding: '8px 12px', color: 'var(--metin-ikincil)' }}>{b.kdv_tutari > 0 ? paraFormat(b.kdv_tutari) : '—'}</td>
                <td style={{ padding: '8px 12px', color: 'var(--metin-ikincil)' }}>{b.notlar || '—'}</td>
                <td style={{ padding: '8px 12px' }}>
                  <button onClick={() => sil(b.id)} style={eylemChipStili('kirmizi')}>Sil</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Kart>
  );
}

function SiparisOdemeleriPaneli({ siparis, onKapat }) {
  const [bakiye, setBakiye] = useState(null);
  const [odemeler, setOdemeler] = useState(null);
  const [bankaHesaplari, setBankaHesaplari] = useState([]);
  const [formAcik, setFormAcik] = useState(false);
  const [form, setForm] = useState({
    tarih: new Date().toISOString().slice(0, 10), tutar: '', odeme_yontemi: 'NAKIT',
    banka_hesap_id: '', kur: '1', cek_no: '', cek_banka_adi: '', cek_vade_tarihi: '', notlar: '',
  });
  const [hata, setHata] = useState(null);
  const [uyari, setUyari] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  function yukle() {
    api.get(`/siparisler/${siparis.id}/bakiye`).then((r) => setBakiye(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
    api.get(`/siparisler/${siparis.id}/odemeler`).then((r) => setOdemeler(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }
  useEffect(() => {
    yukle();
    api.get('/banka-bakiyeleri').then((r) => setBankaHesaplari(r.data)).catch(() => {});
    if (siparis.para_birimi !== 'TRY') {
      api.get(`/kur/${siparis.para_birimi}`).then((r) => setForm((f) => ({ ...f, kur: r.data.kur }))).catch(() => {});
    }
  }, [siparis.id]); // eslint-disable-line

  const dovizli = siparis.para_birimi !== 'TRY';
  const kurGerekli = dovizli && form.odeme_yontemi === 'NAKIT';

  async function odemeEkle(e) {
    e.preventDefault();
    setHata(null);
    setUyari(null);
    if (form.odeme_yontemi === 'BANKA' && !form.banka_hesap_id) {
      setHata('Lütfen banka hesabı seçin.');
      return;
    }
    if (form.odeme_yontemi === 'CEK' && !form.cek_vade_tarihi) {
      setHata('Çek ile ödeme için vade tarihi girmelisiniz.');
      return;
    }
    setKaydediliyor(true);
    try {
      const { data } = await api.post(`/siparisler/${siparis.id}/odemeler`, {
        tarih: form.tarih,
        tutar: Number(form.tutar),
        odeme_yontemi: form.odeme_yontemi,
        banka_hesap_id: form.odeme_yontemi === 'BANKA' ? Number(form.banka_hesap_id) : null,
        kur: kurGerekli ? Number(form.kur) : null,
        cek_no: form.odeme_yontemi === 'CEK' ? (form.cek_no || null) : null,
        cek_banka_adi: form.odeme_yontemi === 'CEK' ? (form.cek_banka_adi || null) : null,
        cek_vade_tarihi: form.odeme_yontemi === 'CEK' ? form.cek_vade_tarihi : null,
        notlar: form.notlar || null,
      });
      setFormAcik(false);
      setForm((f) => ({ ...f, tutar: '', cek_no: '', cek_banka_adi: '', cek_vade_tarihi: '', notlar: '' }));
      if (data.asim_uyarisi) setUyari(data.asim_uyarisi);
      yukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  async function odemeyiSil(odemeId) {
    if (!(await ozelOnayIste('Bu ödeme kaydını silmek istediğinize emin misiniz? Oluşan Kasa/Banka hareketi de silinecek.'))) return;
    try {
      await api.delete(`/siparisler/odemeler/${odemeId}`);
      yukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  return (
    <Kart style={{ margin: '8px 16px 16px', background: 'var(--zemin)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{siparis.siparis_no} — Tedarikçi ödemeleri</div>
        <Buton variant="ikincil" onClick={onKapat}>Kapat</Buton>
      </div>
      <HataMesaji>{hata}</HataMesaji>
      {uyari && (
        <div style={{ background: 'var(--amber-acik, #fdf0d5)', color: '#8a5a00', padding: '10px 14px', borderRadius: 8, fontSize: 12.5, marginBottom: 12 }}>
          ⚠ {uyari}
        </div>
      )}

      {bakiye && (
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', padding: '10px 14px', background: 'white', borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
          <div>
            <div style={{ color: 'var(--metin-ikincil)', fontSize: 11.5 }}>Sipariş tutarı</div>
            <div style={{ fontWeight: 600 }}>{paraFormat(bakiye.toplam_siparis_tutari, bakiye.para_birimi)}</div>
          </div>
          <div>
            <div style={{ color: 'var(--metin-ikincil)', fontSize: 11.5 }}>Ödenen</div>
            <div style={{ fontWeight: 600, color: 'var(--yesil)' }}>{paraFormat(bakiye.toplam_odenen, bakiye.para_birimi)}</div>
          </div>
          <div>
            <div style={{ color: 'var(--metin-ikincil)', fontSize: 11.5 }}>Kalan bakiye</div>
            <div style={{ fontWeight: 600, color: bakiye.kalan_bakiye > 0 ? 'var(--kirmizi)' : 'var(--yesil)' }}>
              {paraFormat(bakiye.kalan_bakiye, bakiye.para_birimi)}
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Buton onClick={() => setFormAcik((a) => !a)}>{formAcik ? 'Kapat' : '+ Yeni ödeme ekle'}</Buton>
        <span style={{ fontSize: 11.5, color: 'var(--metin-ikincil)' }}>
          Akreditif ile ödüyorsanız bu formu değil, "Akreditif" panelini kullanın.
        </span>
      </div>

      {formAcik && (
        <form onSubmit={odemeEkle} style={{ marginBottom: 16, padding: 12, background: 'white', border: '1px solid var(--kenarlik)', borderRadius: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: kurGerekli ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr', gap: 10 }}>
            <Alan etiket={`Tutar (${siparis.para_birimi})`}>
              <ParaGirdisi required value={form.tutar} onChange={(v) => setForm((f) => ({ ...f, tutar: v }))} />
            </Alan>
            <Alan etiket="Ödeme yöntemi">
              <select value={form.odeme_yontemi} onChange={(e) => setForm((f) => ({ ...f, odeme_yontemi: e.target.value }))} style={girdiStili}>
                <option value="NAKIT">Nakit (Ana Kasa)</option>
                <option value="BANKA">Banka</option>
                <option value="CEK">Çek (verilen)</option>
                <option value="LEASING">Leasing (bilgi amaçlı)</option>
              </select>
            </Alan>
            {form.odeme_yontemi === 'BANKA' ? (
              <Alan etiket="Banka hesabı">
                <select required value={form.banka_hesap_id} onChange={(e) => setForm((f) => ({ ...f, banka_hesap_id: e.target.value }))} style={girdiStili}>
                  <option value="">Seçin...</option>
                  {bankaHesaplari.map((h) => (
                    <option key={h.banka_hesap_id} value={h.banka_hesap_id}>{h.banka_adi} — {h.hesap_adi || h.para_birimi} ({h.para_birimi})</option>
                  ))}
                </select>
              </Alan>
            ) : kurGerekli && (
              <Alan etiket={`${siparis.para_birimi} için TL kuru (otomatik, elle değiştirilebilir)`}>
                <input required type="number" step="0.0001" value={form.kur} onChange={(e) => setForm((f) => ({ ...f, kur: e.target.value }))} style={girdiStili} />
              </Alan>
            )}
            {form.odeme_yontemi === 'CEK' && (
              <>
                <Alan etiket="Çek no (opsiyonel)">
                  <input value={form.cek_no} onChange={(e) => setForm((f) => ({ ...f, cek_no: e.target.value }))} style={girdiStili} />
                </Alan>
                <Alan etiket="Çekin bankası (opsiyonel)">
                  <input value={form.cek_banka_adi} onChange={(e) => setForm((f) => ({ ...f, cek_banka_adi: e.target.value }))} style={girdiStili} />
                </Alan>
                <Alan etiket="Vade tarihi">
                  <input required type="date" value={form.cek_vade_tarihi} onChange={(e) => setForm((f) => ({ ...f, cek_vade_tarihi: e.target.value }))} style={girdiStili} />
                </Alan>
              </>
            )}
            {form.odeme_yontemi === 'LEASING' && (
              <div style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--metin-ikincil)', background: 'var(--zemin)', padding: '8px 10px', borderRadius: 6 }}>
                Bu kayıt sadece bilgi amaçlıdır — gerçek ödemeyi leasing firmanız tedarikçiye doğrudan yapar. Kasa/Banka'ya hiçbir hareket yansımaz.
              </div>
            )}
            <Alan etiket="Tarih">
              <input required type="date" value={form.tarih} onChange={(e) => setForm((f) => ({ ...f, tarih: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Not (opsiyonel)">
              <input value={form.notlar} onChange={(e) => setForm((f) => ({ ...f, notlar: e.target.value }))} placeholder="Örn: Avans, kapama ödemesi" style={girdiStili} />
            </Alan>
          </div>
          <div style={{ marginTop: 10 }}>
            <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : 'Ödemeyi kaydet'}</Buton>
          </div>
        </form>
      )}

      {odemeler && (
        odemeler.length === 0 ? <BosDurum baslik="Henüz ödeme yapılmadı" /> : (
          <table>
            <thead>
              <tr style={{ background: 'white' }}>
                {['Tarih', 'Tutar', 'Yöntem', 'Not', ''].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--metin-ikincil)' }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {odemeler.map((o) => (
                <tr key={o.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                  <td style={{ padding: '8px 12px' }}>{o.tarih}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 500 }}>{paraFormat(o.tutar, siparis.para_birimi)}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--metin-ikincil)' }}>
                    {{ NAKIT: 'Nakit', BANKA: 'Banka', CEK: 'Çek', LEASING: 'Leasing' }[o.odeme_yontemi] || '—'}
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--metin-ikincil)' }}>{o.notlar || '—'}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <button onClick={() => odemeyiSil(o.id)} style={eylemChipStili('kirmizi')}>Sil</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </Kart>
  );
}


const BEKLENEN_MALIYET_KATEGORILERI = [
  { anahtar: 'satinalma_maliyeti_try', tip: 'SATINALMA', ad: 'Satınalma (mal bedeli)' },
  { anahtar: 'nakliye_maliyeti_try', tip: 'NAKLIYE', ad: 'Nakliye / Navlun / Sigorta / İç Nakliye' },
  { anahtar: 'gumruk_maliyeti_try', tip: 'GUMRUK', ad: 'Gümrük Vergisi ve Masrafları' },
  { anahtar: 'antrepo_maliyeti_try', tip: 'ANTREPO', ad: 'Antrepo (Beyanname, İndirme, Ardiye)' },
];

// Bir siparisteki TUM urunlerin maliyet ozet sutunlarini TOPLAYIP, hangi
// kategorinin HENUZ HIC girilmedigini (toplam sifir) gosteren kontrol
// listesi - "hangi masraf unutulmus" sorusuna hizli bir bakista cevap verir.
// Herhangi bir kategoriye tiklaninca, onMaliyetEkle(tip) cagrilir - sayfa
// bunu kullanarak asagidaki "Maliyet Ekle" formunu o tip onceden secili
// olarak acar.
function MaliyetKontrolListesi({ urunler, onMaliyetEkle }) {
  const toplamlar = {};
  BEKLENEN_MALIYET_KATEGORILERI.forEach(({ anahtar }) => {
    toplamlar[anahtar] = urunler.reduce((acc, u) => acc + Number(u[anahtar] || 0), 0);
  });
  const eksikSayisi = BEKLENEN_MALIYET_KATEGORILERI.filter(({ anahtar }) => toplamlar[anahtar] === 0).length;

  return (
    <div style={{ padding: '10px 12px', background: eksikSayisi > 0 ? 'var(--amber-acik, #fdf0d5)' : 'var(--yesil-acik, #e3f5e9)', borderRadius: 8, marginBottom: 4 }}>
      <div style={{ fontWeight: 600, fontSize: 12.5, marginBottom: 6 }}>
        Maliyet Kalemi Kontrolü {eksikSayisi > 0 ? `— ${eksikSayisi} kalem eksik olabilir` : '— tüm kategoriler girilmiş'}
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12 }}>
        {BEKLENEN_MALIYET_KATEGORILERI.map(({ anahtar, tip, ad }) => (
          <div
            key={anahtar}
            onClick={() => onMaliyetEkle(tip)}
            title="Bu kalemi eklemek için tıklayın"
            style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}
          >
            <span>{toplamlar[anahtar] > 0 ? '✅' : '⚠️'}</span>
            <span style={{ color: 'var(--metin-ikincil)', textDecoration: toplamlar[anahtar] === 0 ? 'underline' : 'none' }}>{ad}</span>
            {toplamlar[anahtar] > 0 && <strong>({paraFormat(toplamlar[anahtar])})</strong>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SiparislerSayfasi() {
  const location = useLocation();
  const navigate = useNavigate();
  const { oturum } = useAuth();
  const [siparisler, setSiparisler] = useState([]);
  const [stokKartlari, setStokKartlari] = useState([]);
  const [cariler, setCariler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(null);
  const [odemelerAcikSiparisId, setOdemelerAcikSiparisId] = useState(null);
  const [gumrukAcikSiparisId, setGumrukAcikSiparisId] = useState(null);
  const [detay360AcikId, setDetay360AcikId] = useState(null);
  const [belgeAcik, setBelgeAcik] = useState(null); // { siparisId, nusha } | null
  const [durumDegistirAcikId, setDurumDegistirAcikId] = useState(null);
  const [icerikAcikId, setIcerikAcikId] = useState(null);
  const [belgeNotlari, setBelgeNotlari] = useState({}); // siparisId -> gecici not metni (sadece bu oturum icin)
  const siralama = useSiralama();
  const [filtreSiparisNo, setFiltreSiparisNo] = useState(new URLSearchParams(location.search).get('ara') || '');
  const [filtreTedarikciId, setFiltreTedarikciId] = useState('');
  const [filtreBaslangic, setFiltreBaslangic] = useState('');
  const [filtreBitis, setFiltreBitis] = useState('');
  const [filtreDurum, setFiltreDurum] = useState('');
  const [filtreOdemeDurumu, setFiltreOdemeDurumu] = useState('');
  const [bilgiMesaji, setBilgiMesaji] = useState(
    location.state?.yeniSiparisNo
      ? location.state.guncellendiMi
        ? `${location.state.yeniSiparisNo} numaralı sipariş güncellendi.`
        : `${location.state.yeniSiparisNo} numaralı sipariş oluşturuldu.`
      : null
  );

  const [bakiyeHaritasi, setBakiyeHaritasi] = useState({}); // siparisId -> {toplam_siparis_tutari, toplam_odenen, kalan_bakiye}
  const [akreditifHaritasi, setAkreditifHaritasi] = useState({}); // siparisId -> akreditif
  const [siparisUrunleriHaritasi, setSiparisUrunleriHaritasi] = useState({}); // siparisId -> StokSeriNo[]
  const [maliyetAcikUrunId, setMaliyetAcikUrunId] = useState(null);
  const [maliyetVarsayilanTip, setMaliyetVarsayilanTip] = useState('NAKLIYE');

  // Icerik acildiginda, o siparise ait TESLIM ALINMIS (StokSeriNo) urunleri
  // henuz cekilmediyse getir - "Maliyet Ekle" butonlari icin gerekli.
  useEffect(() => {
    if (icerikAcikId == null || siparisUrunleriHaritasi[icerikAcikId]) return;
    api.get('/stok-seri-no', { params: { siparis_id: icerikAcikId } })
      .then((r) => setSiparisUrunleriHaritasi((h) => ({ ...h, [icerikAcikId]: r.data })))
      .catch(() => {});
  }, [icerikAcikId]); // eslint-disable-line
  const [secilenIdler, setSecilenIdler] = useState(new Set());

  function listeyiYukle() {
    setYukleniyor(true);
    api.get('/siparisler')
      .then((res) => {
        setSiparisler(res.data);
        // Her siparis icin bakiye bilgisini paralel cek - liste tablosunda
        // "Odeme Durumu" sutunu icin (hangi siparis tam/kismi/hic odenmemis).
        Promise.all(
          res.data.map((s) => api.get(`/siparisler/${s.id}/bakiye`).then((r) => [s.id, r.data]).catch(() => [s.id, null]))
        ).then((sonuclar) => {
          const harita = {};
          sonuclar.forEach(([id, veri]) => { if (veri) harita[id] = veri; });
          setBakiyeHaritasi(harita);
        });
        // Akreditifle alinmis siparisler icin - sipariş içeriği panelinde
        // akreditifin vade/odeme bilgisini gostermek uzere TEK istekle
        // tum akreditifleri cekip siparis_id'ye gore grupluyoruz.
        api.get('/akreditifler').then((r) => {
          const akrHarita = {};
          (r.data || []).forEach((a) => { akrHarita[a.siparis_id] = a; });
          setAkreditifHaritasi(akrHarita);
        }).catch(() => {});
      })
      .catch((err) => setHata(hataMesajiCikar(err)))
      .finally(() => setYukleniyor(false));
  }

  useEffect(() => {
    listeyiYukle();
    api.get('/stok-kartlari').then((r) => setStokKartlari(r.data)).catch(() => {});
    api.get('/cariler').then((r) => setCariler(r.data)).catch(() => {});
  }, []);

  function urunAdi(stokKartiId) {
    const k = stokKartlari.find((x) => x.id === stokKartiId);
    return k ? `${k.marka} ${k.model}` : `#${stokKartiId}`;
  }

  function cariAdi(cariId) {
    const c = cariler.find((x) => x.id === cariId);
    return c ? c.unvan : `#${cariId}`;
  }

  async function durumDegistir(siparisId, yeniDurum) {
    try {
      await api.put(`/siparisler/${siparisId}/durum`, { durum: yeniDurum });
      listeyiYukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  async function siparisiIptalEt(siparisId, siparisNo) {
    if (!(await ozelOnayIste(`${siparisNo} numaralı siparişi iptal etmek istediğinize emin misiniz? Bu işlem geri alınamaz.`))) return;
    await durumDegistir(siparisId, 'IPTAL');
    setBilgiMesaji(`${siparisNo} numaralı sipariş iptal edildi.`);
  }

  function satirSecimiDegistir(id) {
    setSecilenIdler((s) => {
      const yeni = new Set(s);
      if (yeni.has(id)) yeni.delete(id); else yeni.add(id);
      return yeni;
    });
  }

  async function topluSil() {
    if (!(await ozelOnayIste(`${secilenIdler.size} siparişi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`))) return;
    setHata(null);
    let basarili = 0;
    const basarisizlar = [];
    for (const id of secilenIdler) {
      try {
        await api.delete(`/siparisler/${id}`);
        basarili += 1;
      } catch (err) {
        basarisizlar.push(id);
      }
    }
    setSecilenIdler(new Set());
    listeyiYukle();
    if (basarisizlar.length > 0) {
      setHata(`${basarili} sipariş silindi, ${basarisizlar.length} sipariş silinemedi (muhtemelen Taslak/İptal dışındaki siparişler silinemez).`);
    } else {
      setBilgiMesaji(`${basarili} sipariş silindi.`);
    }
  }

  function secilenleriExceleAktar() {
    const secilenSiparisler = siparisler.filter((s) => secilenIdler.has(s.id));
    excelIndir(
      secilenSiparisler.map((s) => {
        const toplam = (s.urunler || []).reduce((acc, u) => acc + u.miktar * Number(u.birim_fiyat), 0);
        return {
          'Sipariş No': s.siparis_no, 'Tedarikçi': cariAdi(s.tedarikci_cari_id),
          'Tarih': s.siparis_tarihi, 'Durum': DURUM_METIN[s.durum] || s.durum,
          'Tutar': toplam, 'Para Birimi': s.para_birimi,
        };
      }),
      'secilen_siparisler', 'Siparişler',
    );
  }

  async function siparisiSil(siparisId, siparisNo) {
    if (!(await ozelOnayIste(`${siparisNo} numaralı siparişi silmek istediğinize emin misiniz?`))) return;
    try {
      await api.delete(`/siparisler/${siparisId}`);
      setBilgiMesaji(`${siparisNo} numaralı sipariş silindi.`);
      listeyiYukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  async function pdfIndir(siparisId, siparisNo, nusha) {
    try {
      const { data } = await api.get(`/siparisler/${siparisId}/pdf`, {
        params: { nusha },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${siparisNo}_${nusha}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  async function kopyala(siparisId) {
    const yeniNo = await ozelPrompt('Yeni sipariş numarası:');
    if (!yeniNo) return;
    try {
      await api.post(`/siparisler/${siparisId}/kopyala`, null, { params: { yeni_siparis_no: yeniNo } });
      setBilgiMesaji(`${yeniNo} numaralı yeni taslak oluşturuldu.`);
      listeyiYukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  function siparisinOdemeDurumu(s) {
    const b = bakiyeHaritasi[s.id];
    if (!b) return null;
    if (Number(b.kalan_bakiye) <= 0) return 'TAM';
    if (Number(b.toplam_odenen) > 0) return 'KISMI';
    return 'HIC';
  }

  const gosterilecekSiparisler = siparisler.filter((s) => {
    if (filtreSiparisNo && !s.siparis_no.toLocaleLowerCase('tr').includes(filtreSiparisNo.toLocaleLowerCase('tr'))) return false;
    if (filtreTedarikciId && String(s.tedarikci_cari_id) !== String(filtreTedarikciId)) return false;
    if (filtreDurum && s.durum !== filtreDurum) return false;
    if (filtreOdemeDurumu && siparisinOdemeDurumu(s) !== filtreOdemeDurumu) return false;
    if (filtreBaslangic && s.siparis_tarihi < filtreBaslangic) return false;
    if (filtreBitis && s.siparis_tarihi > filtreBitis) return false;
    return true;
  });
  const siraliSiparisler = siralama.sirala(gosterilecekSiparisler, (item, alan) => {
    if (alan === '_toplam') return (item.urunler || []).reduce((acc, u) => acc + u.miktar * Number(u.birim_fiyat), 0);
    return item[alan];
  });
  const kademe = useKademelıGoster(siraliSiparisler, 50);

  return (
    <div>
      <SayfaBasligi
        baslik="Siparişler"
        aciklama="İthalat ve yurtiçi alım siparişleri"
        eylem={<Link to="/siparisler/yeni"><Buton>+ Yeni sipariş</Buton></Link>}
      />
      <HataMesaji>{hata}</HataMesaji>
      {bilgiMesaji && (
        <div style={{ background: 'var(--yesil-acik)', color: 'var(--yesil)', padding: '10px 14px', borderRadius: 7, fontSize: 13, marginBottom: 16 }}>
          {bilgiMesaji}
        </div>
      )}

      <Kart style={{ marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr', gap: 10 }}>
          <Alan etiket="Sipariş no'ya göre filtrele">
            <input value={filtreSiparisNo} onChange={(e) => setFiltreSiparisNo(e.target.value)} placeholder="Örn: 2026-002" style={girdiStili} />
          </Alan>
          <Alan etiket="Tedarikçiye göre filtrele">
            <AramaliSecici secenekler={cariler} deger={filtreTedarikciId} onDegistir={setFiltreTedarikciId} etiketFn={(c) => c.unvan} bosMetin="Tümü / yazarak arayın..." />
          </Alan>
          <Alan etiket="Duruma göre filtrele">
            <select value={filtreDurum} onChange={(e) => setFiltreDurum(e.target.value)} style={girdiStili}>
              <option value="">Tümü</option>
              <option value="TASLAK">Taslak</option>
              <option value="ONAYLANDI">Onaylandı</option>
              <option value="YOLDA">Yolda</option>
              <option value="GUMRUKTE">Gümrükte</option>
              <option value="TESLIM_ALINDI">Teslim Alındı</option>
              <option value="TAMAMLANDI">Tamamlandı</option>
              <option value="IPTAL">İptal</option>
            </select>
          </Alan>
          <Alan etiket="Ödeme durumuna göre filtrele">
            <select value={filtreOdemeDurumu} onChange={(e) => setFiltreOdemeDurumu(e.target.value)} style={girdiStili}>
              <option value="">Tümü</option>
              <option value="TAM">Tam Ödendi</option>
              <option value="KISMI">Kısmi Ödendi</option>
              <option value="HIC">Hiç Ödenmedi</option>
            </select>
          </Alan>
          <Alan etiket="Tarih başlangıcı">
            <input type="date" value={filtreBaslangic} onChange={(e) => setFiltreBaslangic(e.target.value)} style={girdiStili} />
          </Alan>
          <Alan etiket="Tarih bitişi">
            <input type="date" value={filtreBitis} onChange={(e) => setFiltreBitis(e.target.value)} style={girdiStili} />
          </Alan>
        </div>
      </Kart>

      {secilenIdler.size > 0 && (
        <Kart style={{ marginBottom: 12, background: 'var(--zemin)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px' }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{secilenIdler.size} sipariş seçili</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Buton variant="ikincil" onClick={secilenleriExceleAktar}>Excel'e Aktar</Buton>
            <Buton variant="tehlike" onClick={topluSil}>Seçilenleri Sil</Buton>
            <Buton variant="ikincil" onClick={() => setSecilenIdler(new Set())}>Seçimi Temizle</Buton>
          </div>
        </Kart>
      )}

      <Kart style={{ padding: 0 }}>
        {yukleniyor ? (
          <TabloIskeleti sutunSayisi={9} />
        ) : gosterilecekSiparisler.length === 0 ? (
          <BosDurum baslik="Henüz sipariş yok" aciklama="Yukarıdan yeni bir sipariş oluşturun." />
        ) : (
          <table style={{ tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              <col style={{ width: '3%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '19%' }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                <th style={{ padding: '10px 16px' }}>
                  <input
                    type="checkbox"
                    checked={kademe.gosterilecekler.length > 0 && kademe.gosterilecekler.every((s) => secilenIdler.has(s.id))}
                    onChange={(e) => {
                      if (e.target.checked) setSecilenIdler(new Set(kademe.gosterilecekler.map((s) => s.id)));
                      else setSecilenIdler(new Set());
                    }}
                  />
                </th>
                <SiraliBaslik alanAdi="siparis_no" siralama={siralama}>Sipariş No</SiraliBaslik>
                <SiraliBaslik alanAdi="kaynak" siralama={siralama}>Kaynak</SiraliBaslik>
                <SiraliBaslik alanAdi="siparis_tarihi" siralama={siralama}>Tarih</SiraliBaslik>
                <SiraliBaslik alanAdi="durum" siralama={siralama}>Durum</SiraliBaslik>
                <SiraliBaslik alanAdi="_toplam" siralama={siralama}>Tutar</SiraliBaslik>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>Ödenen</th>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>Kalan</th>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>Ödeme Durumu</th>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {kademe.gosterilecekler.map((s) => {
                const toplam = (s.urunler || []).reduce((acc, u) => acc + u.miktar * Number(u.birim_fiyat), 0);
                const sonDurumda = SON_DURUMLAR.includes(s.durum);
                return (
                  <Fragment key={s.id}>
                    <tr style={{ borderTop: '1px solid var(--kenarlik)', background: secilenIdler.has(s.id) ? 'var(--zemin)' : 'transparent' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <input type="checkbox" checked={secilenIdler.has(s.id)} onChange={() => satirSecimiDegistir(s.id)} />
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                        <button
                          onClick={() => setIcerikAcikId((mevcut) => (mevcut === s.id ? null : s.id))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500, fontSize: 'inherit', color: 'inherit' }}
                          title="Sipariş içeriğini göster/gizle"
                        >
                          <span style={{ fontSize: 11, color: 'var(--metin-ikincil)' }}>{icerikAcikId === s.id ? '▲' : '▼'}</span>
                          {s.siparis_no}
                        </button>
                      </td>
                      <td style={{ padding: '12px 16px' }}>{s.kaynak === 'ITHALAT' ? 'İthalat' : 'Yurtiçi Alım'}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--metin-ikincil)' }}>{tarihFormat(s.siparis_tarihi)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <Etiket ton={DURUM_ETIKET[s.durum]}>{DURUM_METIN[s.durum]}</Etiket>
                      </td>
                      <td style={{ padding: '12px 16px' }}>{paraFormat(toplam, s.para_birimi)}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--yesil)' }}>
                        {bakiyeHaritasi[s.id] ? paraFormat(bakiyeHaritasi[s.id].toplam_odenen, s.para_birimi) : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: bakiyeHaritasi[s.id] && Number(bakiyeHaritasi[s.id].kalan_bakiye) > 0 ? 'var(--kirmizi)' : 'var(--yesil)' }}>
                        {bakiyeHaritasi[s.id] ? paraFormat(bakiyeHaritasi[s.id].kalan_bakiye, s.para_birimi) : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {(() => {
                          const b = bakiyeHaritasi[s.id];
                          if (!b) return <span style={{ color: 'var(--metin-soluk)', fontSize: 12 }}>—</span>;
                          if (b.kalan_bakiye <= 0) return <Etiket ton="yesil">Tam Ödendi</Etiket>;
                          if (b.toplam_odenen > 0) return <Etiket ton="amber">Kısmi Ödendi</Etiket>;
                          return <Etiket ton="kirmizi">Hiç Ödenmedi</Etiket>;
                        })()}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          {(s.durum === 'ONAYLANDI' || s.durum === 'YOLDA' || s.durum === 'GUMRUKTE') && (
                            <Link to={`/siparisler/${s.id}/teslim-al`} style={eylemChipStili('yesil')}>
                              Teslim al
                            </Link>
                          )}
                          <DahaFazlaMenu kompakt ogeler={[
                            ...(s.durum === 'TASLAK' ? [
                              { etiket: 'Onayla', onClick: () => durumDegistir(s.id, 'ONAYLANDI') },
                              { etiket: 'Düzenle', onClick: () => navigate(`/siparisler/${s.id}/duzenle`) },
                              { etiket: 'Sil', onClick: () => siparisiSil(s.id, s.siparis_no) },
                            ] : []),
                            ...((s.durum === 'ONAYLANDI' || s.durum === 'YOLDA' || s.durum === 'GUMRUKTE') ? [
                              { etiket: 'Durum Değiştir', onClick: () => setDurumDegistirAcikId((mevcut) => (mevcut === s.id ? null : s.id)) },
                            ] : []),
                            ...(!sonDurumda && s.durum !== 'TASLAK' ? [
                              { etiket: 'İptal Et', onClick: () => siparisiIptalEt(s.id, s.siparis_no) },
                            ] : []),
                            ...(s.durum === 'IPTAL' ? [
                              { etiket: 'İptali Geri Al', onClick: () => durumDegistir(s.id, 'ONAYLANDI') },
                              { etiket: 'Sil', onClick: () => siparisiSil(s.id, s.siparis_no) },
                            ] : []),
                            { etiket: 'Sipariş Detayı', onClick: () => setDetay360AcikId((mevcut) => (mevcut === s.id ? null : s.id)) },
                            { etiket: 'Ödemeler', onClick: () => setOdemelerAcikSiparisId((mevcut) => (mevcut === s.id ? null : s.id)) },
                            ...(s.kaynak === 'ITHALAT' ? [
                              { etiket: 'Gümrük Beyannamesi', onClick: () => setGumrukAcikSiparisId((mevcut) => (mevcut === s.id ? null : s.id)) },
                            ] : []),
                            { etiket: 'Belge (şirket içi)', onClick: () => setBelgeAcik((mevcut) => (mevcut?.siparisId === s.id && mevcut?.nusha === 'ic' ? null : { siparisId: s.id, nusha: 'ic' })) },
                            { etiket: 'Belge (tedarikçi)', onClick: () => setBelgeAcik((mevcut) => (mevcut?.siparisId === s.id && mevcut?.nusha === 'tedarikci' ? null : { siparisId: s.id, nusha: 'tedarikci' })) },
                            { etiket: 'PDF (şirket içi)', onClick: () => pdfIndir(s.id, s.siparis_no, 'ic') },
                            { etiket: 'PDF (tedarikçi)', onClick: () => pdfIndir(s.id, s.siparis_no, 'tedarikci') },
                            { etiket: 'Kopyala', onClick: () => kopyala(s.id) },
                          ]} />
                        </div>
                      </td>
                    </tr>
                    {detay360AcikId === s.id && (
                      <tr>
                        <td colSpan={10} style={{ padding: 0 }}>
                          <Siparis360Paneli siparis={s} onKapat={() => setDetay360AcikId(null)} />
                        </td>
                      </tr>
                    )}
                    {odemelerAcikSiparisId === s.id && (
                      <tr>
                        <td colSpan={10} style={{ padding: 0 }}>
                          <SiparisOdemeleriPaneli siparis={s} onKapat={() => setOdemelerAcikSiparisId(null)} />
                        </td>
                      </tr>
                    )}
                    {gumrukAcikSiparisId === s.id && (
                      <tr>
                        <td colSpan={10} style={{ padding: 0 }}>
                          <GumrukBeyannameleriPaneli siparis={s} cariler={cariler} onKapat={() => setGumrukAcikSiparisId(null)} />
                        </td>
                      </tr>
                    )}
                    {icerikAcikId === s.id && (
                      <tr>
                        <td colSpan={10} style={{ padding: '12px 16px', background: 'var(--zemin)' }}>
                          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Sipariş içeriği</div>
                          {(s.urunler || []).length === 0 ? (
                            <div style={{ fontSize: 13, color: 'var(--metin-soluk)' }}>Bu siparişte ürün bulunamadı.</div>
                          ) : (
                            <table style={{ width: '100%', marginBottom: 12 }}>
                              <thead>
                                <tr>
                                  {['Ürün', 'Miktar', 'Birim Fiyat', 'Satır Toplamı', 'Açıklama'].map((b) => (
                                    <th key={b} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 12, color: 'var(--metin-ikincil)' }}>{b}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {s.urunler.map((u, i) => (
                                  <tr key={i} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                                    <td style={{ padding: '6px 8px' }}>{urunAdi(u.stok_karti_id)}</td>
                                    <td style={{ padding: '6px 8px' }}>{u.miktar}</td>
                                    <td style={{ padding: '6px 8px' }}>{paraFormat(u.birim_fiyat, u.para_birimi)}</td>
                                    <td style={{ padding: '6px 8px', fontWeight: 500 }}>{paraFormat(u.miktar * Number(u.birim_fiyat), u.para_birimi)}</td>
                                    <td style={{ padding: '6px 8px', color: 'var(--metin-ikincil)' }}>{u.aciklama || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr style={{ borderTop: '2px solid var(--kenarlik-koyu)' }}>
                                  <td colSpan={3} style={{ padding: '8px 8px', fontWeight: 600, textAlign: 'right' }}>Toplam:</td>
                                  <td style={{ padding: '8px 8px', fontWeight: 700 }}>{paraFormat(toplam, s.para_birimi)}</td>
                                  <td />
                                </tr>
                              </tfoot>
                            </table>
                          )}
                          {akreditifHaritasi[s.id] && (
                            <div style={{ padding: '10px 12px', background: 'white', border: '1px solid var(--kenarlik)', borderRadius: 8 }}>
                              <div style={{ fontWeight: 600, fontSize: 12.5, marginBottom: 6 }}>
                                💳 Akreditif ile alınmış — {akreditifHaritasi[s.id].akreditif_no || `#${akreditifHaritasi[s.id].id}`}
                              </div>
                              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--metin-ikincil)' }}>
                                <div>Akreditif Tutarı: <strong style={{ color: 'var(--metin-birincil)' }}>{paraFormat(akreditifHaritasi[s.id].tutar, akreditifHaritasi[s.id].para_birimi)}</strong></div>
                                <div>Ödenen: <strong style={{ color: 'var(--yesil)' }}>{paraFormat(akreditifHaritasi[s.id].toplam_odenen, akreditifHaritasi[s.id].para_birimi)}</strong></div>
                                <div>Kalan: <strong style={{ color: Number(akreditifHaritasi[s.id].kalan_bakiye) > 0 ? 'var(--kirmizi)' : 'var(--yesil)' }}>{paraFormat(akreditifHaritasi[s.id].kalan_bakiye, akreditifHaritasi[s.id].para_birimi)}</strong></div>
                                {akreditifHaritasi[s.id].vade_tarihi && (
                                  <div>Vade Tarihi: <strong style={{ color: 'var(--metin-birincil)' }}>{tarihFormat(akreditifHaritasi[s.id].vade_tarihi)}</strong></div>
                                )}
                                <div>Durum: <Etiket ton={akreditifHaritasi[s.id].durum === 'KAPANDI' ? 'yesil' : akreditifHaritasi[s.id].durum === 'IPTAL' ? 'kirmizi' : 'amber'}>{akreditifHaritasi[s.id].durum}</Etiket></div>
                              </div>
                            </div>
                          )}

                          {siparisUrunleriHaritasi[s.id] && siparisUrunleriHaritasi[s.id].length > 0 && (
                            <div style={{ marginTop: 12 }}>
                              <MaliyetKontrolListesi
                                urunler={siparisUrunleriHaritasi[s.id]}
                                onMaliyetEkle={(tip) => {
                                  setMaliyetVarsayilanTip(tip);
                                  setMaliyetAcikUrunId(siparisUrunleriHaritasi[s.id][0]?.id ?? null);
                                }}
                              />
                              <div style={{ fontWeight: 600, fontSize: 12.5, marginBottom: 6, marginTop: 14 }}>
                                Teslim Alınmış Ürünler — Maliyet Kalemi Ekle (manuel/istisnai giriş)
                              </div>
                              {siparisUrunleriHaritasi[s.id].map((u) => (
                                <div key={u.id} style={{ marginBottom: 6 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'white', border: '1px solid var(--kenarlik)', borderRadius: 6 }}>
                                    <span style={{ fontSize: 12.5 }}>
                                      {urunAdi(u.stok_karti_id)} — {u.seri_no} — Toplam maliyet: <strong>{paraFormat(u.toplam_maliyet_try)}</strong>
                                    </span>
                                    <button
                                      onClick={() => setMaliyetAcikUrunId((mevcut) => (mevcut === u.id ? null : u.id))}
                                      style={eylemChipStili('lacivert')}
                                    >
                                      {maliyetAcikUrunId === u.id ? 'Kapat' : 'Maliyet Ekle'}
                                    </button>
                                  </div>
                                  {maliyetAcikUrunId === u.id && (
                                    <ManuelMaliyetKalemiEkleFormu
                                      key={maliyetVarsayilanTip}
                                      urun={u}
                                      varsayilanTip={maliyetVarsayilanTip}
                                      onKaydedildi={() => {
                                        setMaliyetAcikUrunId(null);
                                        api.get('/stok-seri-no', { params: { siparis_id: s.id } })
                                          .then((r) => setSiparisUrunleriHaritasi((h) => ({ ...h, [s.id]: r.data })))
                                          .catch(() => {});
                                      }}
                                      onVazgec={() => setMaliyetAcikUrunId(null)}
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                    {durumDegistirAcikId === s.id && (
                      <tr>
                        <td colSpan={10} style={{ padding: '12px 16px', background: 'var(--zemin)' }}>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                            <div style={{ flex: 1, maxWidth: 220 }}>
                              <Alan etiket="Yeni durum">
                                <select id={`durum-select-${s.id}`} defaultValue={s.durum} style={girdiStili}>
                                  {['ONAYLANDI', 'YOLDA', 'GUMRUKTE'].map((d) => (
                                    <option key={d} value={d}>{DURUM_METIN[d]}</option>
                                  ))}
                                </select>
                              </Alan>
                            </div>
                            <Buton
                              onClick={() => {
                                const secim = document.getElementById(`durum-select-${s.id}`).value;
                                durumDegistir(s.id, secim);
                                setDurumDegistirAcikId(null);
                              }}
                            >
                              Durumu güncelle
                            </Buton>
                            <Buton variant="ikincil" onClick={() => setDurumDegistirAcikId(null)}>Vazgeç</Buton>
                          </div>
                        </td>
                      </tr>
                    )}
                    {belgeAcik?.siparisId === s.id && (
                      <tr>
                        <td colSpan={10} style={{ padding: '12px 16px', background: 'var(--zemin)' }}>
                          <BelgeSablonu
                            onKapat={() => setBelgeAcik(null)}
                            belgeBasligi={`Sipariş Formu${belgeAcik.nusha === 'tedarikci' ? ' (Tedarikçi Nüshası)' : ' (Şirket İçi)'}`}
                            belgeNo={s.siparis_no}
                            tarihBaslangic={s.siparis_tarihi}
                            sirketAdi={oturum?.sirketler?.find((sr) => sr.id === oturum.aktifSirketId)?.unvan || ''}
                            sirketId={oturum?.aktifSirketId}
                            logoUrl={oturum?.aktifSirketId ? `${API_TABAN_URL}/sirketler/${oturum.aktifSirketId}/logo` : null}
                            karsiTarafBaslik="Tedarikçi"
                            karsiTarafAdiBaslangic={cariAdi(s.tedarikci_cari_id)}
                            ekBilgiler={[
                              ['Kaynak', s.kaynak === 'ITHALAT' ? 'İthalat' : 'Yurtiçi Alım'],
                              ['Sipariş tarihi', s.siparis_tarihi],
                              ['Tahmini teslim', s.tahmini_teslim_tarihi || '—'],
                              ...(s.kaynak === 'ITHALAT' ? [['Çıkış limanı', s.cikis_limani || '—'], ['Varış limanı', s.varis_limani || '—']] : []),
                            ]}
                            kalemlerBaslangic={(s.urunler || []).map((u) => ({
                              aciklama: urunAdi(u.stok_karti_id), miktar: u.miktar, birimFiyat: u.birim_fiyat, kdvOrani: Number(u.kdv_orani || 0),
                            }))}
                            paraBirimi={s.para_birimi}
                            fiyatGoster={belgeAcik.nusha === 'ic'}
                            notlar={belgeNotlari[s.id] ?? (s.notlar || '')}
                            notlarDegistir={(v) => setBelgeNotlari((f) => ({ ...f, [s.id]: v }))}
                            altYazi="Bu belge üzerindeki not/kalem değişiklikleri sadece bu görünüm/yazdırma içindir, sipariş kaydını güncellemez."
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
        <DahaFazlaGosterButonu kademe={kademe} />
      </Kart>
    </div>
  );
}
