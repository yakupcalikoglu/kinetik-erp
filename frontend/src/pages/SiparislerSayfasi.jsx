import { useEffect, useState, Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, hataMesajiCikar } from '../api/client';
import { Kart, SayfaBasligi, Buton, Alan, girdiStili, Etiket, BosDurum, HataMesaji, paraFormat, eylemChipStili } from '../components/Ortak';
import BelgeSablonu from '../components/BelgeSablonu';
import AramaliSecici from '../components/AramaliSecici';

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
function SiparisOdemeleriPaneli({ siparis, onKapat }) {
  const [bakiye, setBakiye] = useState(null);
  const [odemeler, setOdemeler] = useState(null);
  const [bankaHesaplari, setBankaHesaplari] = useState([]);
  const [formAcik, setFormAcik] = useState(false);
  const [form, setForm] = useState({
    tarih: new Date().toISOString().slice(0, 10), tutar: '', odeme_yontemi: 'NAKIT',
    banka_hesap_id: '', kur: '1', notlar: '',
  });
  const [hata, setHata] = useState(null);
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
    if (form.odeme_yontemi === 'BANKA' && !form.banka_hesap_id) {
      setHata('Lütfen banka hesabı seçin.');
      return;
    }
    setKaydediliyor(true);
    try {
      await api.post(`/siparisler/${siparis.id}/odemeler`, {
        tarih: form.tarih,
        tutar: Number(form.tutar),
        odeme_yontemi: form.odeme_yontemi,
        banka_hesap_id: form.odeme_yontemi === 'BANKA' ? Number(form.banka_hesap_id) : null,
        kur: kurGerekli ? Number(form.kur) : null,
        notlar: form.notlar || null,
      });
      setFormAcik(false);
      setForm((f) => ({ ...f, tutar: '', notlar: '' }));
      yukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  async function odemeyiSil(odemeId) {
    if (!window.confirm('Bu ödeme kaydını silmek istediğinize emin misiniz? Oluşan Kasa/Banka hareketi de silinecek.')) return;
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

      <div style={{ marginBottom: 12 }}>
        <Buton onClick={() => setFormAcik((a) => !a)}>{formAcik ? 'Kapat' : '+ Yeni ödeme ekle'}</Buton>
      </div>

      {formAcik && (
        <form onSubmit={odemeEkle} style={{ marginBottom: 16, padding: 12, background: 'white', border: '1px solid var(--kenarlik)', borderRadius: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: kurGerekli ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr', gap: 10 }}>
            <Alan etiket={`Tutar (${siparis.para_birimi})`}>
              <input required type="number" step="0.01" value={form.tutar} onChange={(e) => setForm((f) => ({ ...f, tutar: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Ödeme yöntemi">
              <select value={form.odeme_yontemi} onChange={(e) => setForm((f) => ({ ...f, odeme_yontemi: e.target.value }))} style={girdiStili}>
                <option value="NAKIT">Nakit (Ana Kasa)</option>
                <option value="BANKA">Banka</option>
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
                {['Tarih', 'Tutar', 'Not', ''].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--metin-ikincil)' }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {odemeler.map((o) => (
                <tr key={o.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                  <td style={{ padding: '8px 12px' }}>{o.tarih}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 500 }}>{paraFormat(o.tutar, siparis.para_birimi)}</td>
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

export default function SiparislerSayfasi() {
  const location = useLocation();
  const { oturum } = useAuth();
  const [siparisler, setSiparisler] = useState([]);
  const [stokKartlari, setStokKartlari] = useState([]);
  const [cariler, setCariler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(null);
  const [odemelerAcikSiparisId, setOdemelerAcikSiparisId] = useState(null);
  const [belgeAcik, setBelgeAcik] = useState(null); // { siparisId, nusha } | null
  const [durumDegistirAcikId, setDurumDegistirAcikId] = useState(null);
  const [icerikAcikId, setIcerikAcikId] = useState(null);
  const [belgeNotlari, setBelgeNotlari] = useState({}); // siparisId -> gecici not metni (sadece bu oturum icin)
  const [filtreTedarikciId, setFiltreTedarikciId] = useState('');
  const [filtreBaslangic, setFiltreBaslangic] = useState('');
  const [filtreBitis, setFiltreBitis] = useState('');
  const [filtreDurum, setFiltreDurum] = useState('');
  const [bilgiMesaji, setBilgiMesaji] = useState(
    location.state?.yeniSiparisNo
      ? location.state.guncellendiMi
        ? `${location.state.yeniSiparisNo} numaralı sipariş güncellendi.`
        : `${location.state.yeniSiparisNo} numaralı sipariş oluşturuldu.`
      : null
  );

  function listeyiYukle() {
    setYukleniyor(true);
    api.get('/siparisler')
      .then((res) => setSiparisler(res.data))
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
    if (!window.confirm(`${siparisNo} numaralı siparişi iptal etmek istediğinize emin misiniz? Bu işlem geri alınamaz.`)) return;
    await durumDegistir(siparisId, 'IPTAL');
    setBilgiMesaji(`${siparisNo} numaralı sipariş iptal edildi.`);
  }

  async function siparisiSil(siparisId, siparisNo) {
    if (!window.confirm(`${siparisNo} numaralı siparişi silmek istediğinize emin misiniz?`)) return;
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
    const yeniNo = window.prompt('Yeni sipariş numarası:');
    if (!yeniNo) return;
    try {
      await api.post(`/siparisler/${siparisId}/kopyala`, null, { params: { yeni_siparis_no: yeniNo } });
      setBilgiMesaji(`${yeniNo} numaralı yeni taslak oluşturuldu.`);
      listeyiYukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  const gosterilecekSiparisler = siparisler.filter((s) => {
    if (filtreTedarikciId && String(s.tedarikci_cari_id) !== String(filtreTedarikciId)) return false;
    if (filtreDurum && s.durum !== filtreDurum) return false;
    if (filtreBaslangic && s.siparis_tarihi < filtreBaslangic) return false;
    if (filtreBitis && s.siparis_tarihi > filtreBitis) return false;
    return true;
  });

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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
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
          <Alan etiket="Tarih başlangıcı">
            <input type="date" value={filtreBaslangic} onChange={(e) => setFiltreBaslangic(e.target.value)} style={girdiStili} />
          </Alan>
          <Alan etiket="Tarih bitişi">
            <input type="date" value={filtreBitis} onChange={(e) => setFiltreBitis(e.target.value)} style={girdiStili} />
          </Alan>
        </div>
      </Kart>

      <Kart style={{ padding: 0 }}>
        {yukleniyor ? (
          <div style={{ padding: 20, color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
        ) : gosterilecekSiparisler.length === 0 ? (
          <BosDurum baslik="Henüz sipariş yok" aciklama="Yukarıdan yeni bir sipariş oluşturun." />
        ) : (
          <table style={{ tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              <col style={{ width: '16%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '30%' }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                {['Sipariş No', 'Kaynak', 'Tarih', 'Durum', 'Tutar', 'İşlem'].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gosterilecekSiparisler.map((s) => {
                const toplam = (s.urunler || []).reduce((acc, u) => acc + u.miktar * Number(u.birim_fiyat), 0);
                const sonDurumda = SON_DURUMLAR.includes(s.durum);
                return (
                  <Fragment key={s.id}>
                    <tr style={{ borderTop: '1px solid var(--kenarlik)' }}>
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
                      <td style={{ padding: '12px 16px', color: 'var(--metin-ikincil)' }}>{s.siparis_tarihi}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <Etiket ton={DURUM_ETIKET[s.durum]}>{DURUM_METIN[s.durum]}</Etiket>
                      </td>
                      <td style={{ padding: '12px 16px' }}>{paraFormat(toplam, s.para_birimi)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {s.durum === 'TASLAK' && (
                            <>
                              <button onClick={() => durumDegistir(s.id, 'ONAYLANDI')} style={eylemChipStili('lacivert')}>
                                Onayla
                              </button>
                              <Link to={`/siparisler/${s.id}/duzenle`} style={eylemChipStili('lacivert')}>
                                Düzenle
                              </Link>
                              <button onClick={() => siparisiSil(s.id, s.siparis_no)} style={eylemChipStili('kirmizi')}>
                                Sil
                              </button>
                            </>
                          )}
                          {(s.durum === 'ONAYLANDI' || s.durum === 'YOLDA' || s.durum === 'GUMRUKTE') && (
                            <>
                              <Link to={`/siparisler/${s.id}/teslim-al`} style={eylemChipStili('yesil')}>
                                Teslim al
                              </Link>
                              <button
                                onClick={() => setDurumDegistirAcikId((mevcut) => (mevcut === s.id ? null : s.id))}
                                style={eylemChipStili('amber')}
                              >
                                {durumDegistirAcikId === s.id ? 'Kapat' : 'Durum Değiştir'}
                              </button>
                            </>
                          )}
                          {!sonDurumda && s.durum !== 'TASLAK' && (
                            <button onClick={() => siparisiIptalEt(s.id, s.siparis_no)} style={eylemChipStili('kirmizi')}>
                              İptal Et
                            </button>
                          )}
                          {s.durum === 'IPTAL' && (
                            <>
                              <button onClick={() => durumDegistir(s.id, 'ONAYLANDI')} style={eylemChipStili('yesil')}>
                                İptali Geri Al
                              </button>
                              <button onClick={() => siparisiSil(s.id, s.siparis_no)} style={eylemChipStili('kirmizi')}>
                                Sil
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => setOdemelerAcikSiparisId((mevcut) => (mevcut === s.id ? null : s.id))}
                            style={eylemChipStili('amber')}
                          >
                            {odemelerAcikSiparisId === s.id ? 'Ödemeleri Kapat' : 'Ödemeler'}
                          </button>
                          <button
                            onClick={() => setBelgeAcik((mevcut) => (mevcut?.siparisId === s.id && mevcut?.nusha === 'ic' ? null : { siparisId: s.id, nusha: 'ic' }))}
                            style={eylemChipStili('notr')}
                          >
                            Belge (şirket içi)
                          </button>
                          <button
                            onClick={() => setBelgeAcik((mevcut) => (mevcut?.siparisId === s.id && mevcut?.nusha === 'tedarikci' ? null : { siparisId: s.id, nusha: 'tedarikci' }))}
                            style={eylemChipStili('notr')}
                          >
                            Belge (tedarikçi)
                          </button>
                          <button onClick={() => pdfIndir(s.id, s.siparis_no, 'ic')} style={eylemChipStili('notr')}>
                            PDF (şirket içi)
                          </button>
                          <button onClick={() => pdfIndir(s.id, s.siparis_no, 'tedarikci')} style={eylemChipStili('notr')}>
                            PDF (tedarikçi)
                          </button>
                          <button onClick={() => kopyala(s.id)} style={eylemChipStili('notr')}>
                            Kopyala
                          </button>
                        </div>
                      </td>
                    </tr>
                    {odemelerAcikSiparisId === s.id && (
                      <tr>
                        <td colSpan={6} style={{ padding: 0 }}>
                          <SiparisOdemeleriPaneli siparis={s} onKapat={() => setOdemelerAcikSiparisId(null)} />
                        </td>
                      </tr>
                    )}
                    {icerikAcikId === s.id && (
                      <tr>
                        <td colSpan={6} style={{ padding: '12px 16px', background: 'var(--zemin)' }}>
                          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Sipariş içeriği</div>
                          {(s.urunler || []).length === 0 ? (
                            <div style={{ fontSize: 13, color: 'var(--metin-soluk)' }}>Bu siparişte ürün bulunamadı.</div>
                          ) : (
                            <table style={{ width: '100%' }}>
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
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                    {durumDegistirAcikId === s.id && (
                      <tr>
                        <td colSpan={6} style={{ padding: '12px 16px', background: 'var(--zemin)' }}>
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
                        <td colSpan={6} style={{ padding: '12px 16px', background: 'var(--zemin)' }}>
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
                              aciklama: urunAdi(u.stok_karti_id), miktar: u.miktar, birimFiyat: u.birim_fiyat, kdvOrani: 0,
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
      </Kart>
    </div>
  );
}
