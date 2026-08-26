import { useEffect, useState, Fragment } from 'react';
import { api, hataMesajiCikar, ozelOnayIste, ozelAlert } from '../../api/client';
import {
  Kart, Buton, Etiket, Alan, girdiStili, HataMesaji, paraFormat, eylemChipStili, ParaGirdisi, DahaFazlaMenu, BosDurum,
} from '../Ortak';
import AramaliSecici from '../AramaliSecici';
import { tarihFormat, useSiralama, useCariHaritasi, BasitTablo, DovizKarsiligiGosterge } from './Ortak';

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
      await ozelAlert(`${data.dagitilan_urun_sayisi} ürüne toplam ${paraFormat(data.toplam_dagitilan_try)} dağıtıldı.`);
      gecmisiYukle();
      onTamamlandi();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  async function geriAl(dagitimId) {
    if (!(await ozelOnayIste('Bu dağıtımı geri almak istediğinize emin misiniz? Tutar, ürünün maliyetinden düşülecek.'))) return;
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
                <span>
                  <span style={{ color: 'var(--metin-soluk)' }}>#{u.stok_seri_no_id}</span>{' '}
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{u.seri_no}</span>
                  {u.urun_adi && <span style={{ color: 'var(--metin-ikincil)' }}> — {u.urun_adi}</span>}
                </span>
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
  const kalanBakiye = Number(kalem.tutar) - Number(kalem.odenen_tutar || 0);
  const [odemeParaBirimi, setOdemeParaBirimi] = useState(akreditif.para_birimi);
  const [form, setForm] = useState({
    tutar: String(kalanBakiye), odeme_yontemi: 'BANKA', banka_hesap_id: '', odeme_tarihi: new Date().toISOString().slice(0, 10), kur: '1',
  });
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => {
    api.get('/banka-bakiyeleri').then((r) => setBankaHesaplari(r.data)).catch(() => {});
    if (akreditif.para_birimi !== 'TRY') {
      api.get(`/kur/${akreditif.para_birimi}`).then((r) => setForm((f) => ({ ...f, kur: r.data.kur }))).catch(() => {});
    }
  }, []); // eslint-disable-line

  const tlGiriliyor = odemeParaBirimi === 'TRY' && akreditif.para_birimi !== 'TRY';
  const gonderilecekTutar = tlGiriliyor
    ? (Number(form.tutar || 0) / Number(form.kur || 1))
    : Number(form.tutar || 0);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      await api.put(`/akreditif-kalemleri/${kalem.id}/ode`, {
        tutar: gonderilecekTutar,
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
              Kalemi öde — kalan bakiye: {paraFormat(kalanBakiye, akreditif.para_birimi)}
            </div>
            <HataMesaji>{hata}</HataMesaji>
            {akreditif.para_birimi !== 'TRY' && (
              <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--metin-ikincil)' }}>Tutarı hangi para biriminde giriyorsunuz?</span>
                {[akreditif.para_birimi, 'TRY'].map((pb) => (
                  <button
                    key={pb}
                    type="button"
                    onClick={() => setOdemeParaBirimi(pb)}
                    style={{
                      padding: '5px 14px', borderRadius: 6, fontSize: 12.5, cursor: 'pointer',
                      border: odemeParaBirimi === pb ? '1.5px solid var(--lacivert)' : '1px solid var(--kenarlik-koyu)',
                      background: odemeParaBirimi === pb ? 'var(--lacivert)' : 'white',
                      color: odemeParaBirimi === pb ? 'white' : 'var(--metin-birincil)',
                      fontWeight: odemeParaBirimi === pb ? 600 : 400,
                    }}
                  >
                    {pb === 'TRY' ? 'TL' : pb}
                  </button>
                ))}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: akreditif.para_birimi !== 'TRY' ? '1fr 1fr 1fr 1fr 1fr' : '1fr 1fr 1fr 1fr', gap: 12 }}>
              <Alan etiket={`Ödenecek tutar (${odemeParaBirimi === 'TRY' ? 'TL' : odemeParaBirimi}) — kısmi ödeme yapabilirsiniz`}>
                <ParaGirdisi required value={form.tutar} onChange={(v) => setForm((f) => ({ ...f, tutar: v }))} />
                {tlGiriliyor && (
                  <div style={{ fontSize: 11.5, color: 'var(--metin-ikincil)', marginTop: 4 }}>
                    ≈ {gonderilecekTutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {akreditif.para_birimi} karşılığı (kalemden bu kadar düşülecek)
                  </div>
                )}
              </Alan>
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
            {!tlGiriliyor && akreditif.para_birimi !== 'TRY' && form.kur && (
              <div style={{ fontSize: 12.5, color: 'var(--metin-ikincil)', marginTop: 6 }}>
                Girdiğiniz tutarın TL karşılığı: <strong>{paraFormat(Number(form.tutar || 0) * (Number(form.kur) || 0))}</strong>
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
                <ParaGirdisi required value={form.tutar} onChange={(v) => setForm((f) => ({ ...f, tutar: v }))} />
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
                <ParaGirdisi required value={form.tutar} onChange={(v) => setForm((f) => ({ ...f, tutar: v }))} />
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

function bosManuelTaksitSatiri(tarih) {
  return { vade_tarihi: tarih, tutar: '' };
}

function TaksitlendirFormu({ kalem, onTamamlandi, onVazgec }) {
  const [mod, setMod] = useState('ESIT');
  const [form, setForm] = useState({ taksit_sayisi: 3, ek_ucret: '0', ilk_vade_tarihi: new Date().toISOString().slice(0, 10) });
  const [manuelSatirlar, setManuelSatirlar] = useState([
    bosManuelTaksitSatiri(new Date().toISOString().slice(0, 10)),
    bosManuelTaksitSatiri(new Date().toISOString().slice(0, 10)),
  ]);
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  const toplamGerekenTutar = Number(kalem.tutar) + Number(form.ek_ucret || 0);
  const manuelToplam = manuelSatirlar.reduce((acc, s) => acc + (Number(s.tutar) || 0), 0);
  const manuelFark = Math.round((toplamGerekenTutar - manuelToplam) * 100) / 100;

  function manuelSatirGuncelle(i, alan, deger) {
    setManuelSatirlar((satirlar) => satirlar.map((s, idx) => (idx === i ? { ...s, [alan]: deger } : s)));
  }
  function manuelSatirEkle() {
    setManuelSatirlar((satirlar) => [...satirlar, bosManuelTaksitSatiri(new Date().toISOString().slice(0, 10))]);
  }
  function manuelSatirSil(i) {
    setManuelSatirlar((satirlar) => satirlar.filter((_, idx) => idx !== i));
  }

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    if (mod === 'MANUEL' && Math.abs(manuelFark) > 0.02) {
      setHata(`Taksitlerin toplamı, ödenecek toplam tutarla (${toplamGerekenTutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}) eşleşmiyor — fark: ${manuelFark.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}.`);
      return;
    }
    setKaydediliyor(true);
    try {
      if (mod === 'MANUEL') {
        await api.post(`/akreditif-kalemleri/${kalem.id}/taksitlendir`, {
          ek_ucret: Number(form.ek_ucret || 0),
          taksitler: manuelSatirlar.map((s) => ({ vade_tarihi: s.vade_tarihi, tutar: Number(s.tutar) })),
        });
      } else {
        await api.post(`/akreditif-kalemleri/${kalem.id}/taksitlendir`, {
          taksit_sayisi: Number(form.taksit_sayisi),
          ek_ucret: Number(form.ek_ucret || 0),
          ilk_vade_tarihi: form.ilk_vade_tarihi,
        });
      }
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

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[['ESIT', 'Eşit böl'], ['MANUEL', 'Her taksidi elle gir']].map(([deger, etiket]) => (
                <button
                  key={deger}
                  type="button"
                  onClick={() => setMod(deger)}
                  style={{
                    padding: '6px 14px', borderRadius: 6, fontSize: 12.5, cursor: 'pointer',
                    border: mod === deger ? '1.5px solid var(--lacivert)' : '1px solid var(--kenarlik-koyu)',
                    background: mod === deger ? 'var(--lacivert)' : 'white',
                    color: mod === deger ? 'white' : 'var(--metin-birincil)',
                    fontWeight: mod === deger ? 600 : 400,
                  }}
                >
                  {etiket}
                </button>
              ))}
            </div>

            <div style={{ marginBottom: 10 }}>
              <Alan etiket="Ek ücret (taksitlendirme bedeli)">
                <ParaGirdisi value={form.ek_ucret} onChange={(v) => setForm((f) => ({ ...f, ek_ucret: v }))} style={{ maxWidth: 220 }} />
              </Alan>
              <div style={{ fontSize: 12, color: 'var(--metin-ikincil)', marginTop: 2 }}>
                Toplam ödenecek (kalem tutarı + ek ücret): <strong>{toplamGerekenTutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</strong>
              </div>
            </div>

            {mod === 'ESIT' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Alan etiket="Taksit sayısı">
                  <input required type="number" min="2" value={form.taksit_sayisi} onChange={(e) => setForm((f) => ({ ...f, taksit_sayisi: e.target.value }))} style={girdiStili} />
                </Alan>
                <Alan etiket="İlk taksit vade tarihi">
                  <input required type="date" value={form.ilk_vade_tarihi} onChange={(e) => setForm((f) => ({ ...f, ilk_vade_tarihi: e.target.value }))} style={girdiStili} />
                </Alan>
              </div>
            ) : (
              <div>
                <table style={{ width: '100%', marginBottom: 8 }}>
                  <thead>
                    <tr style={{ background: 'var(--zemin)' }}>
                      {['Taksit No', 'Vade Tarihi', 'Tutar', ''].map((b) => (
                        <th key={b} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11.5, color: 'var(--metin-ikincil)' }}>{b}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {manuelSatirlar.map((s, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                        <td style={{ padding: 6, fontSize: 13 }}>{i + 1}</td>
                        <td style={{ padding: 6 }}>
                          <input required type="date" value={s.vade_tarihi} onChange={(e) => manuelSatirGuncelle(i, 'vade_tarihi', e.target.value)} style={girdiStili} />
                        </td>
                        <td style={{ padding: 6 }}>
                          <ParaGirdisi value={s.tutar} onChange={(v) => manuelSatirGuncelle(i, 'tutar', v)} style={{ width: 140 }} />
                        </td>
                        <td style={{ padding: 6 }}>
                          {manuelSatirlar.length > 2 && (
                            <button type="button" onClick={() => manuelSatirSil(i)} style={eylemChipStili('kirmizi')}>Sil</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button type="button" onClick={manuelSatirEkle} style={eylemChipStili('lacivert')}>+ Taksit ekle</button>
                <div style={{ fontSize: 12.5, marginTop: 8, color: Math.abs(manuelFark) > 0.02 ? 'var(--kirmizi)' : 'var(--yesil)' }}>
                  Girilen toplam: {manuelToplam.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  {Math.abs(manuelFark) > 0.02 && ` — fark: ${manuelFark.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`}
                  {Math.abs(manuelFark) <= 0.02 && ' — ✓ eşleşiyor'}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
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
    if (!(await ozelOnayIste('Bu taksidi silmek istediğinize emin misiniz?'))) return;
    try {
      await api.delete(`/akreditif-kalem-taksitleri/${taksitId}`);
      yukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  async function taksitOdemesiniGeriAl(taksitId) {
    if (!(await ozelOnayIste('Bu taksidin ödemesini geri almak istediğinize emin misiniz? Oluşan Kasa/Banka hareketi silinecek.'))) return;
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
                        <td style={{ padding: '8px 10px' }}>{tarihFormat(t.vade_tarihi)}</td>
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

export default function AkreditifSekmesi() {
  const [liste, setListe] = useState([]);
  const siralama = useSiralama();
  const cariHaritasi = useCariHaritasi();
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
  const [kalemOdemeParaBirimi, setKalemOdemeParaBirimi] = useState('DOVIZ');
  const [kalemKur, setKalemKur] = useState('1');

  useEffect(() => {
    if (seciliAkreditif && seciliAkreditif.para_birimi !== 'TRY') {
      api.get(`/kur/${seciliAkreditif.para_birimi}`).then((r) => setKalemKur(String(r.data.kur))).catch(() => {});
    }
  }, [seciliAkreditif?.id]); // eslint-disable-line
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
    if (!(await ozelOnayIste(`${a.akreditif_no || '#' + a.id} akreditifini silmek istediğinize emin misiniz?`))) return;
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
      const gonderilecekTutar = kalemOdemeParaBirimi === 'TRY'
        ? Number(kalemForm.tutar || 0) / Number(kalemKur || 1)
        : Number(kalemForm.tutar || 0);
      await api.post(`/akreditifler/${seciliAkreditif.id}/kalem`, { ...kalemForm, tutar: gonderilecekTutar });
      kalemleriGoster(seciliAkreditif.id);
      setKalemForm({ tip: 'ODEME', aciklama: '', tutar: '', vade_tarihi: new Date().toISOString().slice(0, 10) });
      yukle();
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function kalemiSil(kalemId) {
    if (!(await ozelOnayIste('Bu kalemi silmek istediğinize emin misiniz?'))) return;
    try {
      await api.delete(`/akreditif-kalemleri/${kalemId}`);
      kalemleriGoster(seciliAkreditif.id);
      yukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  async function kalemOdemesiniGeriAl(kalemId) {
    if (!(await ozelOnayIste('Bu kalemin ödemesini geri almak istediğinize emin misiniz? Oluşan Kasa/Banka hareketi silinecek.'))) return;
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
    if (!s) return `#${id}`;
    const tedarikciAdi = cariHaritasi[s.tedarikci_cari_id];
    return tedarikciAdi ? `${s.siparis_no} — ${tedarikciAdi}` : s.siparis_no;
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
              <AramaliSecici
                secenekler={siparisler}
                deger={form.siparis_id}
                onDegistir={(v) => {
                  const secilenSiparis = siparisler.find((s) => String(s.id) === String(v));
                  const toplamTutar = secilenSiparis
                    ? (secilenSiparis.urunler || []).reduce((acc, u) => acc + Number(u.miktar) * Number(u.birim_fiyat), 0)
                    : '';
                  setForm((f) => ({
                    ...f,
                    siparis_id: v,
                    tutar: secilenSiparis ? String(toplamTutar) : f.tutar,
                    para_birimi: secilenSiparis ? secilenSiparis.para_birimi : f.para_birimi,
                  }));
                }}
                etiketFn={(s) => s.siparis_no}
                bosMetin="Sipariş no yazarak arayın..."
              />
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
            <Alan etiket="Tutar (sipariş seçilince otomatik doldurulur, elle düzeltebilirsiniz)">
              <ParaGirdisi required value={form.tutar} onChange={(v) => setForm((f) => ({ ...f, tutar: v }))} />
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
          basliklar={[
            { etiket: 'Akreditif No', alan: 'akreditif_no' },
            { etiket: 'Sipariş', alan: '_siparis' },
            { etiket: 'Banka', alan: '_banka' },
            { etiket: 'Ödenecek Toplam', alan: 'tutar' },
            { etiket: 'Ödenen', alan: 'toplam_odenen' },
            { etiket: 'Kalan', alan: 'kalan_bakiye' },
            { etiket: 'Açılış', alan: 'acilis_tarihi' },
            { etiket: 'Vade', alan: 'vade_tarihi' },
            { etiket: 'Durum', alan: 'durum' },
            'İşlem',
          ]}
          siralama={siralama}
          satirlar={siralama.sirala(liste, (item, alan) => {
            if (alan === '_siparis') return siparisEtiketi(item.siparis_id);
            if (alan === '_banka') return bankaEtiketi(item.banka_hesap_id);
            return item[alan];
          })}
          render={(a) => (
            <tr key={a.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
              <td style={{ padding: '10px 16px', fontWeight: 500 }}>{a.akreditif_no || `#${a.id}`}</td>
              <td style={{ padding: '10px 16px' }}>{siparisEtiketi(a.siparis_id)}</td>
              <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{bankaEtiketi(a.banka_hesap_id)}</td>
              <td style={{ padding: '10px 16px' }}>{paraFormat(a.tutar, a.para_birimi)}</td>
              <td style={{ padding: '10px 16px', color: 'var(--yesil)' }}>{paraFormat(a.toplam_odenen, a.para_birimi)}</td>
              <td style={{ padding: '10px 16px', fontWeight: 600, color: Number(a.kalan_bakiye) > 0 ? 'var(--kirmizi)' : 'var(--yesil)' }}>
                {paraFormat(a.kalan_bakiye, a.para_birimi)}
              </td>
              <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{tarihFormat(a.acilis_tarihi)}</td>
              <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{a.vade_tarihi ? tarihFormat(a.vade_tarihi) : '—'}</td>
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

          {seciliAkreditif && seciliAkreditif.para_birimi !== 'TRY' && (
            <div style={{ marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--metin-ikincil)' }}>Tutarı hangi para biriminde giriyorsunuz?</span>
              {[['DOVIZ', seciliAkreditif.para_birimi], ['TRY', 'TL']].map(([deger, etiket]) => (
                <button
                  key={deger}
                  type="button"
                  onClick={() => setKalemOdemeParaBirimi(deger)}
                  style={{
                    padding: '5px 14px', borderRadius: 6, fontSize: 12.5, cursor: 'pointer',
                    border: kalemOdemeParaBirimi === deger ? '1.5px solid var(--lacivert)' : '1px solid var(--kenarlik-koyu)',
                    background: kalemOdemeParaBirimi === deger ? 'var(--lacivert)' : 'white',
                    color: kalemOdemeParaBirimi === deger ? 'white' : 'var(--metin-birincil)',
                    fontWeight: kalemOdemeParaBirimi === deger ? 600 : 400,
                  }}
                >
                  {etiket}
                </button>
              ))}
              {kalemOdemeParaBirimi === 'TRY' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--metin-ikincil)' }}>Kur ({seciliAkreditif.para_birimi} → TL):</span>
                  <input
                    type="number" step="0.0001" value={kalemKur}
                    onChange={(e) => setKalemKur(e.target.value)}
                    style={{ ...girdiStili, width: 100, padding: '5px 8px' }}
                  />
                </div>
              )}
            </div>
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
            <Alan etiket={`Tutar (${kalemOdemeParaBirimi === 'TRY' ? 'TL' : (seciliAkreditif?.para_birimi || '')})`}>
              <ParaGirdisi required value={kalemForm.tutar} onChange={(v) => setKalemForm((f) => ({ ...f, tutar: v }))} />
              {kalemOdemeParaBirimi === 'TRY' && kalemForm.tutar && (
                <div style={{ fontSize: 11, color: 'var(--metin-ikincil)', marginTop: 3 }}>
                  ≈ {(Number(kalemForm.tutar || 0) / Number(kalemKur || 1)).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {seciliAkreditif?.para_birimi}
                </div>
              )}
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
                          <td style={{ padding: '8px 0' }}>
                            {paraFormat(k.tutar, seciliAkreditif.para_birimi)}
                            {Number(k.odenen_tutar) > 0 && !k.odendi_mi && (
                              <div style={{ fontSize: 11, color: 'var(--metin-ikincil)' }}>
                                {paraFormat(k.odenen_tutar, seciliAkreditif.para_birimi)} ödendi
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '8px 0' }}>{k.vade_tarihi}</td>
                          <td style={{ padding: '8px 0' }}>
                            <Etiket ton={k.odendi_mi ? 'yesil' : Number(k.odenen_tutar) > 0 ? 'amber' : 'notr'}>
                              {k.odendi_mi ? 'Ödendi' : Number(k.odenen_tutar) > 0 ? 'Kısmi Ödendi' : 'Bekliyor'}
                            </Etiket>
                          </td>
                          <td style={{ padding: '8px 0' }}>
                            {k.odendi_mi ? (
                              <button onClick={() => kalemOdemesiniGeriAl(k.id)} style={eylemChipStili('kirmizi')}>Ödemeyi Geri Al</button>
                            ) : (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                <button
                                  onClick={() => setOdemeYapilacakKalemId((mevcut) => (mevcut === k.id ? null : k.id))}
                                  style={eylemChipStili('lacivert')}
                                >
                                  {odemeYapilacakKalemId === k.id ? 'Kapat' : 'Öde'}
                                </button>
                                <DahaFazlaMenu kompakt ogeler={[
                                  { etiket: 'Taksitler', onClick: () => setTaksitPaneliAcikKalemId((mevcut) => (mevcut === k.id ? null : k.id)) },
                                  { etiket: 'Düzenle', onClick: () => setDuzenlenenKalemId(k.id) },
                                  { etiket: 'Sil', onClick: () => kalemiSil(k.id) },
                                ]} />
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
