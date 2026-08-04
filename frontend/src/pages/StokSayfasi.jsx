import { useEffect, useState, Fragment } from 'react';
import * as XLSX from 'xlsx';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AramaliSecici from '../components/AramaliSecici';

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
import { api, hataMesajiCikar } from '../api/client';
import { excelIndir } from '../utils/disaAktarma';

const API_TABAN_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
import {
  Kart, SayfaBasligi, Buton, Alan, girdiStili, Etiket, BosDurum, HataMesaji, paraFormat,
  eylemChipStili, ParaGirdisi,
} from '../components/Ortak';

const DURUM_ETIKET = {
  DEPODA: 'yesil', SIPARISTE: 'notr', YOLDA: 'amber', GUMRUKTE: 'amber',
  ANTREPODA: 'amber', SATILDI: 'notr', KIRADA: 'notr', BAKIMDA: 'kirmizi', HURDA: 'kirmizi',
};

const DURUM_METIN = {
  DEPODA: 'Depoda', SIPARISTE: 'Siparişte', YOLDA: 'Yolda', GUMRUKTE: 'Gümrükte',
  ANTREPODA: 'Antrepoda', SATILDI: 'Satıldı', KIRADA: 'Kirada', BAKIMDA: 'Bakımda', HURDA: 'Hurda',
};

const MALIYET_TIP_METIN = {
  SATINALMA: 'Satınalma', NAKLIYE: 'Nakliye', GUMRUK: 'Gümrük', ANTREPO: 'Antrepo',
  MILLILESTIRME: 'Millileştirme', LEASING: 'Leasing', DIGER: 'Diğer',
};

function MaliyetKalemiEkleFormu({ urun, onKaydedildi }) {
  const [cariler, setCariler] = useState([]);
  const [form, setForm] = useState({
    tip: 'NAKLIYE', tutar: '', para_birimi: 'TRY', kur: '1', referans_usd_kuru: '',
    tedarikci_cari_id: '', belge_no: '', tarih: new Date().toISOString().slice(0, 10), aciklama: '',
  });
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => {
    api.get('/cariler').then((r) => setCariler(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (form.para_birimi === 'TRY') {
      setForm((f) => ({ ...f, kur: '1' }));
      // TL kalemler icin, o gunku USD kurunu referans olarak otomatik cekiyoruz -
      // boylece bu TL tutarin USD karsiligi ileride CANLI kurla degil, o
      // gunku GERCEK kurla hesaplanabilir.
      api.get('/kur/USD').then((r) => setForm((f) => ({ ...f, referans_usd_kuru: r.data.kur }))).catch(() => {});
      return;
    }
    api.get(`/kur/${form.para_birimi}`).then((r) => setForm((f) => ({ ...f, kur: r.data.kur }))).catch(() => {});
  }, [form.para_birimi]); // eslint-disable-line

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      await api.post(`/stok-seri-no/${urun.id}/maliyet-kalemi`, {
        tip: form.tip,
        tutar: Number(form.tutar),
        para_birimi: form.para_birimi,
        kur: Number(form.kur),
        tedarikci_cari_id: form.tedarikci_cari_id ? Number(form.tedarikci_cari_id) : null,
        belge_no: form.belge_no || null,
        tarih: form.tarih,
        aciklama: form.aciklama || null,
        referans_usd_kuru: form.para_birimi === 'TRY' && form.referans_usd_kuru ? Number(form.referans_usd_kuru) : null,
      });
      setForm((f) => ({ ...f, tutar: '', belge_no: '', aciklama: '' }));
      onKaydedildi();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  return (
    <form onSubmit={kaydet} style={{ marginBottom: 16 }}>
      <HataMesaji>{hata}</HataMesaji>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
        <Alan etiket="Maliyet tipi">
          <select value={form.tip} onChange={(e) => setForm((f) => ({ ...f, tip: e.target.value }))} style={girdiStili}>
            {Object.entries(MALIYET_TIP_METIN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
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
        {form.para_birimi !== 'TRY' ? (
          <Alan etiket="Kur (otomatik, elle değiştirilebilir)">
            <input required type="number" step="0.0001" value={form.kur} onChange={(e) => setForm((f) => ({ ...f, kur: e.target.value }))} style={girdiStili} />
          </Alan>
        ) : (
          <Alan etiket="O günkü USD kuru (opsiyonel — USD karşılığını doğru hesaplamak için)">
            <input type="number" step="0.0001" value={form.referans_usd_kuru} onChange={(e) => setForm((f) => ({ ...f, referans_usd_kuru: e.target.value }))} style={girdiStili} />
          </Alan>
        )}
        <Alan etiket="Tedarikçi/firma (opsiyonel)">
          <select value={form.tedarikci_cari_id} onChange={(e) => setForm((f) => ({ ...f, tedarikci_cari_id: e.target.value }))} style={girdiStili}>
            <option value="">Seçin...</option>
            {cariler.map((c) => <option key={c.id} value={c.id}>{c.unvan}</option>)}
          </select>
        </Alan>
        <Alan etiket="Belge/fatura no">
          <input value={form.belge_no} onChange={(e) => setForm((f) => ({ ...f, belge_no: e.target.value }))} style={girdiStili} />
        </Alan>
        <Alan etiket="Tarih">
          <input required type="date" value={form.tarih} onChange={(e) => setForm((f) => ({ ...f, tarih: e.target.value }))} style={girdiStili} />
        </Alan>
        <Alan etiket="Açıklama">
          <input value={form.aciklama} onChange={(e) => setForm((f) => ({ ...f, aciklama: e.target.value }))} style={girdiStili} />
        </Alan>
      </div>
      <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : '+ Maliyet kalemi ekle'}</Buton>
    </form>
  );
}

function MaliyetKalemiDuzenleFormu({ kalem, urunId, onKaydedildi, onVazgec }) {
  const [cariler, setCariler] = useState([]);
  const [form, setForm] = useState({
    tip: kalem.tip, tutar: kalem.tutar, para_birimi: kalem.para_birimi, kur: kalem.kur,
    referans_usd_kuru: kalem.referans_usd_kuru || '',
    tedarikci_cari_id: kalem.tedarikci_cari_id || '', belge_no: kalem.belge_no || '',
    tarih: kalem.tarih, aciklama: kalem.aciklama || '', sifre: '',
  });
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => {
    api.get('/cariler').then((r) => setCariler(r.data)).catch(() => {});
  }, []);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      await api.put(`/stok-seri-no/${urunId}/maliyet-kalemi/${kalem.id}`, {
        sifre: form.sifre,
        tip: form.tip,
        tutar: Number(form.tutar),
        para_birimi: form.para_birimi,
        kur: Number(form.kur),
        tedarikci_cari_id: form.tedarikci_cari_id ? Number(form.tedarikci_cari_id) : null,
        belge_no: form.belge_no || null,
        tarih: form.tarih,
        aciklama: form.aciklama || null,
        referans_usd_kuru: form.para_birimi === 'TRY' && form.referans_usd_kuru ? Number(form.referans_usd_kuru) : null,
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
        <div style={{ padding: 14, background: 'var(--zemin)' }}>
          <form onSubmit={kaydet}>
            <HataMesaji>{hata}</HataMesaji>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
              <Alan etiket="Maliyet tipi">
                <select value={form.tip} onChange={(e) => setForm((f) => ({ ...f, tip: e.target.value }))} style={girdiStili}>
                  {Object.entries(MALIYET_TIP_METIN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
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
              <Alan etiket="Kur">
                <input required type="number" step="0.0001" value={form.kur} onChange={(e) => setForm((f) => ({ ...f, kur: e.target.value }))} style={girdiStili} />
              </Alan>
              {form.para_birimi === 'TRY' && (
                <Alan etiket="O günkü USD kuru (opsiyonel)">
                  <input type="number" step="0.0001" value={form.referans_usd_kuru} onChange={(e) => setForm((f) => ({ ...f, referans_usd_kuru: e.target.value }))} style={girdiStili} />
                </Alan>
              )}
              <Alan etiket="Tedarikçi/firma">
                <select value={form.tedarikci_cari_id} onChange={(e) => setForm((f) => ({ ...f, tedarikci_cari_id: e.target.value }))} style={girdiStili}>
                  <option value="">Seçin...</option>
                  {cariler.map((c) => <option key={c.id} value={c.id}>{c.unvan}</option>)}
                </select>
              </Alan>
              <Alan etiket="Belge/fatura no">
                <input value={form.belge_no} onChange={(e) => setForm((f) => ({ ...f, belge_no: e.target.value }))} style={girdiStili} />
              </Alan>
              <Alan etiket="Tarih">
                <input required type="date" value={form.tarih} onChange={(e) => setForm((f) => ({ ...f, tarih: e.target.value }))} style={girdiStili} />
              </Alan>
              <Alan etiket="Açıklama">
                <input value={form.aciklama} onChange={(e) => setForm((f) => ({ ...f, aciklama: e.target.value }))} style={girdiStili} />
              </Alan>
              <Alan etiket="Şifreniz (onay için zorunlu)">
                <input required type="password" value={form.sifre} onChange={(e) => setForm((f) => ({ ...f, sifre: e.target.value }))} style={girdiStili} placeholder="Giriş şifreniz" />
              </Alan>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : 'Değişiklikleri kaydet'}</Buton>
              <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
            </div>
          </form>
        </div>
      </td>
    </tr>
  );
}

function MaliyetDetayi({ urun, stokKartlari, onKapat }) {
  const [kalemler, setKalemler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(null);
  const [duzenlenenId, setDuzenlenenId] = useState(null);
  const [denemeSatisFiyati, setDenemeSatisFiyati] = useState('');

  function yukle() {
    setYukleniyor(true);
    api.get(`/stok-seri-no/${urun.id}/maliyet-kalemleri`)
      .then((r) => setKalemler(r.data))
      .catch((e) => setHata(hataMesajiCikar(e)))
      .finally(() => setYukleniyor(false));
  }
  useEffect(yukle, [urun.id]); // eslint-disable-line

  async function sil(kalemId) {
    if (!window.confirm('Bu maliyet kalemini silmek istediğinize emin misiniz? Ürünün toplam maliyeti buna göre azaltılacak.')) return;
    try {
      await api.delete(`/stok-seri-no/${urun.id}/maliyet-kalemi/${kalemId}`);
      yukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  // Kalemleri para birimine gore grupla, hem "kac USD/EUR harcandi" hem
  // "toplam TL karsiligi" gorunsun diye.
  const dovizToplamlari = {};
  kalemler.forEach((k) => {
    dovizToplamlari[k.para_birimi] = (dovizToplamlari[k.para_birimi] || 0) + Number(k.tutar);
  });
  const toplamMaliyetTry = urun.toplam_maliyet_try;
  const denemeKarZarar = denemeSatisFiyati ? Number(denemeSatisFiyati) - toplamMaliyetTry : null;
  const satinalmaKalemiVarMi = kalemler.some((k) => k.tip === 'SATINALMA');

  async function satinalmaKalemiEkle() {
    try {
      await api.post(`/stok-seri-no/${urun.id}/satinalma-kalemini-geriye-donuk-olustur`);
      yukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  return (
    <Kart style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600 }}>
          Maliyet detayı — {urun.seri_no}
          {(() => {
            const kart = stokKartlari?.find((k) => k.id === urun.stok_karti_id);
            return kart ? ` (${kart.marka} ${kart.model})` : '';
          })()}
        </div>
        <Buton variant="ikincil" onClick={onKapat}>Kapat</Buton>
      </div>
      <HataMesaji>{hata}</HataMesaji>

      {kalemler.length > 0 && (
        <div style={{
          display: 'flex', gap: 20, flexWrap: 'wrap', padding: '12px 16px', background: 'var(--zemin)',
          borderRadius: 8, marginBottom: 14, fontSize: 13,
        }}>
          {Object.entries(dovizToplamlari).filter(([pb]) => pb !== 'TRY').map(([pb, tutar]) => (
            <div key={pb}>
              <div style={{ color: 'var(--metin-ikincil)', fontSize: 11.5 }}>Toplam ({pb} girişleri)</div>
              <div style={{ fontWeight: 600 }}>{paraFormat(tutar, pb)}</div>
            </div>
          ))}
          <div>
            <div style={{ color: 'var(--metin-ikincil)', fontSize: 11.5 }}>Toplam maliyet (TL karşılığı)</div>
            <div style={{ fontWeight: 600 }}>{paraFormat(toplamMaliyetTry)}</div>
          </div>
          <div style={{ minWidth: 200 }}>
            <div style={{ color: 'var(--metin-ikincil)', fontSize: 11.5, marginBottom: 3 }}>Satış fiyatı dene (TL) — net kârlılığı gör</div>
            <ParaGirdisi
              value={denemeSatisFiyati}
              onChange={(v) => setDenemeSatisFiyati(v)}
              placeholder="Örn: 55000"
              style={{ width: 160 }}
            />
          </div>
          {denemeKarZarar != null && (
            <div>
              <div style={{ color: 'var(--metin-ikincil)', fontSize: 11.5 }}>Tahmini kâr/zarar</div>
              <div style={{ fontWeight: 600, color: denemeKarZarar >= 0 ? 'var(--yesil)' : 'var(--kirmizi)' }}>
                {paraFormat(denemeKarZarar)}
              </div>
            </div>
          )}
        </div>
      )}

      {!yukleniyor && !satinalmaKalemiVarMi && urun.satinalma_maliyeti_try > 0 && (
        <div style={{ marginBottom: 14, padding: '10px 14px', background: 'var(--sari-acik, #FFF7E0)', borderRadius: 8, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Bu ürünün satınalma maliyeti ({paraFormat(urun.satinalma_maliyeti_try)}) listede görünmüyor (eski kayıt).</span>
          <button onClick={satinalmaKalemiEkle} style={eylemChipStili('lacivert')}>Listeye Ekle</button>
        </div>
      )}

      <MaliyetKalemiEkleFormu urun={urun} onKaydedildi={yukle} />

      {yukleniyor ? (
        <div style={{ padding: 20, color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
      ) : kalemler.length === 0 ? (
        <BosDurum baslik="Henüz maliyet kalemi eklenmemiş" />
      ) : (
        <table>
          <thead>
            <tr style={{ background: 'var(--zemin)' }}>
              {['Tip', 'Tutar', 'TL Karşılığı', 'Belge No', 'Tarih', 'Açıklama', ''].map((b) => (
                <th key={b} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>{b}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {kalemler.map((k) => {
              if (duzenlenenId === k.id) {
                return (
                  <MaliyetKalemiDuzenleFormu
                    key={k.id}
                    kalem={k}
                    urunId={urun.id}
                    onKaydedildi={() => { setDuzenlenenId(null); yukle(); }}
                    onVazgec={() => setDuzenlenenId(null)}
                  />
                );
              }
              return (
                <tr key={k.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                  <td style={{ padding: '8px 12px' }}><Etiket ton="notr">{MALIYET_TIP_METIN[k.tip] || k.tip}</Etiket></td>
                  <td style={{ padding: '8px 12px' }}>{paraFormat(k.tutar, k.para_birimi)}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 500 }}>
                    {paraFormat(k.tutar_try)}
                    {k.para_birimi === 'TRY' && k.referans_usd_kuru > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--metin-soluk)', fontWeight: 400 }}>
                        ≈ {paraFormat(k.tutar_try / k.referans_usd_kuru, 'USD')} (o günkü kur: {k.referans_usd_kuru})
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--metin-ikincil)' }}>{k.belge_no || '—'}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--metin-ikincil)' }}>{tarihFormat(k.tarih)}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--metin-ikincil)' }}>{k.aciklama || '—'}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setDuzenlenenId(k.id)} style={eylemChipStili('lacivert')}>Düzenle</button>
                      <button onClick={() => sil(k.id)} style={eylemChipStili('kirmizi')}>Sil</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Kart>
  );
}

function DurumDegistirFormu({ urun, onKaydedildi, onVazgec }) {
  const [yeniDurum, setYeniDurum] = useState(urun.durum);
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      await api.put(`/stok-seri-no/${urun.id}/durum`, { durum: yeniDurum });
      onKaydedildi();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  return (
    <tr>
      <td colSpan={10} style={{ padding: 0 }}>
        <div style={{ padding: 16, background: 'var(--zemin)' }}>
          <form onSubmit={kaydet} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ flex: 1, maxWidth: 220 }}>
              <Alan etiket="Yeni durum">
                <select value={yeniDurum} onChange={(e) => setYeniDurum(e.target.value)} style={girdiStili}>
                  {Object.entries(DURUM_METIN).filter(([k]) => k !== 'SATILDI').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Alan>
            </div>
            <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : 'Durumu güncelle'}</Buton>
            <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
          </form>
          {yeniDurum === 'KIRADA' && (
            <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--amber-acik, #fdf0d5)', borderRadius: 7, fontSize: 12.5 }}>
              ⚠ Bu, sadece ürünün durum etiketini değiştirir — <strong>kime kiralandığını sisteme kaydetmez</strong>.
              Kiracıyı ve aylık kira tutarını kaydetmek için{' '}
              <Link to="/finansal?sekme=kiralama" style={{ color: 'var(--lacivert)', fontWeight: 600 }}>
                Finansal Takip → Kiralama'dan bu ürünü seçerek bir sözleşme oluşturun
              </Link>.
            </div>
          )}
          {urun.durum === 'KIRADA' && yeniDurum !== 'KIRADA' && (
            <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--kirmizi-acik, #fde2e2)', borderRadius: 7, fontSize: 12.5 }}>
              ⚠ Bu ürün aktif bir kiralama sözleşmesine bağlı olabilir. Sadece durumu değiştirirsen sözleşme
              "Aktif" olarak kalmaya devam eder — tutarsızlık oluşur. Önce{' '}
              <Link to="/finansal?sekme=kiralama" style={{ color: 'var(--kirmizi)', fontWeight: 600 }}>
                Finansal Takip → Kiralama'dan bu ürünün sözleşmesini "Sonlandır"
              </Link>
              , kalan/eksik ay için tahsilat yapıp öyle kapat — ürün otomatik olarak "Depoda"ya dönecektir.
            </div>
          )}
          {hata && <div style={{ marginTop: 8 }}><HataMesaji>{hata}</HataMesaji></div>}
        </div>
      </td>
    </tr>
  );
}

function OzMalIlkKayitFormu({ stokKartlari, onKaydedildi, onVazgec }) {
  const [form, setForm] = useState({
    stok_karti_id: '', seri_no: '', sasi_no: '', uretim_yili: '',
    durum: 'DEPODA', maliyet_orijinal: '', para_birimi: 'TRY', kur: '1', aciklama: '',
  });
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => {
    if (form.para_birimi !== 'TRY') {
      api.get(`/kur/${form.para_birimi}`).then((r) => setForm((f) => ({ ...f, kur: String(r.data.kur) }))).catch(() => {});
    } else {
      setForm((f) => ({ ...f, kur: '1' }));
    }
  }, [form.para_birimi]);

  const tlKarsiligi = form.maliyet_orijinal ? Number(form.maliyet_orijinal) * Number(form.kur || 1) : null;

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      await api.post('/stok-seri-no/oz-mal-ilk-kayit', {
        stok_karti_id: Number(form.stok_karti_id),
        seri_no: form.seri_no,
        sasi_no: form.sasi_no || null,
        uretim_yili: form.uretim_yili ? Number(form.uretim_yili) : null,
        durum: form.durum,
        maliyet_orijinal: Number(form.maliyet_orijinal),
        para_birimi: form.para_birimi,
        kur: Number(form.kur || 1),
        aciklama: form.aciklama || null,
      });
      onKaydedildi();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  return (
    <Kart style={{ marginBottom: 20 }}>
      <form onSubmit={kaydet}>
        <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 6 }}>Öz Mal — İlk Kayıt</div>
        <div style={{ fontSize: 12.5, color: 'var(--metin-ikincil)', marginBottom: 14 }}>
          Geçmişte alınmış, elinizde zaten bulunan ürünler için. Kasa/Banka'ya hiçbir hareket yansımaz —
          sadece maliyeti kayıt altına alır ki ileride satıldığında/hurdaya çıkarıldığında kâr/zarar hesaplanabilsin.
        </div>
        <HataMesaji>{hata}</HataMesaji>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
          <Alan etiket="Ürün tanımı">
            <select required value={form.stok_karti_id} onChange={(e) => setForm((f) => ({ ...f, stok_karti_id: e.target.value }))} style={girdiStili}>
              <option value="">Seçin...</option>
              {stokKartlari.map((k) => <option key={k.id} value={k.id}>{k.marka} {k.model}</option>)}
            </select>
          </Alan>
          <Alan etiket="Seri no">
            <input required value={form.seri_no} onChange={(e) => setForm((f) => ({ ...f, seri_no: e.target.value }))} style={girdiStili} />
          </Alan>
          <Alan etiket="Şasi no (opsiyonel)">
            <input value={form.sasi_no} onChange={(e) => setForm((f) => ({ ...f, sasi_no: e.target.value }))} style={girdiStili} />
          </Alan>
          <Alan etiket="Üretim yılı (opsiyonel)">
            <input type="number" value={form.uretim_yili} onChange={(e) => setForm((f) => ({ ...f, uretim_yili: e.target.value }))} style={girdiStili} />
          </Alan>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Alan etiket="Mevcut durum">
            <select value={form.durum} onChange={(e) => setForm((f) => ({ ...f, durum: e.target.value }))} style={girdiStili}>
              {Object.entries(DURUM_METIN).filter(([k]) => !['SATILDI', 'HURDA', 'SIPARISTE'].includes(k)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Alan>
          <Alan etiket="Maliyet">
            <div style={{ display: 'flex', gap: 6 }}>
              <ParaGirdisi required value={form.maliyet_orijinal} onChange={(v) => setForm((f) => ({ ...f, maliyet_orijinal: v }))} style={{ flex: 1 }} />
              <select value={form.para_birimi} onChange={(e) => setForm((f) => ({ ...f, para_birimi: e.target.value }))} style={{ ...girdiStili, width: 90 }}>
                <option value="TRY">TL</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </Alan>
          {form.para_birimi !== 'TRY' && (
            <Alan etiket={`Kur (${form.para_birimi} → TL) — otomatik, değiştirilebilir`}>
              <input type="number" step="0.0001" value={form.kur} onChange={(e) => setForm((f) => ({ ...f, kur: e.target.value }))} style={girdiStili} />
            </Alan>
          )}
          <Alan etiket="Not (opsiyonel)">
            <input value={form.aciklama} onChange={(e) => setForm((f) => ({ ...f, aciklama: e.target.value }))} style={girdiStili} />
          </Alan>
        </div>
        {tlKarsiligi != null && form.para_birimi !== 'TRY' && (
          <div style={{ fontSize: 12.5, color: 'var(--metin-ikincil)', marginBottom: 10 }}>
            TL karşılığı ≈ {paraFormat(tlKarsiligi)}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : 'Öz Mal olarak kaydet'}</Buton>
          <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
        </div>
      </form>
    </Kart>
  );
}

function HurdayaCikarFormu({ urun, onKaydedildi, onVazgec }) {
  const [form, setForm] = useState({ hurda_bedeli_try: '0', odeme_yontemi: 'NAKIT', banka_hesap_id: '', aciklama: '' });
  const [bankaHesaplari, setBankaHesaplari] = useState([]);
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => {
    api.get('/banka-bakiyeleri').then((r) => setBankaHesaplari(r.data)).catch(() => {});
  }, []);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      const bedel = Number(form.hurda_bedeli_try || 0);
      await api.put(`/stok-seri-no/${urun.id}/hurdaya-cikar`, {
        hurda_bedeli_try: bedel,
        odeme_yontemi: bedel > 0 ? form.odeme_yontemi : null,
        banka_hesap_id: bedel > 0 && form.odeme_yontemi === 'BANKA' ? Number(form.banka_hesap_id) : null,
        aciklama: form.aciklama || null,
      });
      onKaydedildi();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  const beklenenZarar = urun.toplam_maliyet_try - Number(form.hurda_bedeli_try || 0);

  return (
    <tr>
      <td colSpan={10} style={{ padding: 0 }}>
        <div style={{ padding: 16, background: 'var(--kirmizi-acik, #fde2e2)' }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>{urun.seri_no} — Hurdaya Çıkar</div>
          <HataMesaji>{hata}</HataMesaji>
          <form onSubmit={kaydet} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 160 }}>
              <Alan etiket="Hurda bedeli (TL, 0 olabilir)">
                <ParaGirdisi value={form.hurda_bedeli_try} onChange={(v) => setForm((f) => ({ ...f, hurda_bedeli_try: v }))} />
              </Alan>
            </div>
            {Number(form.hurda_bedeli_try) > 0 && (
              <>
                <div style={{ minWidth: 140 }}>
                  <Alan etiket="Ödeme yöntemi">
                    <select value={form.odeme_yontemi} onChange={(e) => setForm((f) => ({ ...f, odeme_yontemi: e.target.value }))} style={girdiStili}>
                      <option value="NAKIT">Nakit (Ana Kasa)</option>
                      <option value="BANKA">Banka</option>
                    </select>
                  </Alan>
                </div>
                {form.odeme_yontemi === 'BANKA' && (
                  <div style={{ minWidth: 200 }}>
                    <Alan etiket="Banka hesabı">
                      <select required value={form.banka_hesap_id} onChange={(e) => setForm((f) => ({ ...f, banka_hesap_id: e.target.value }))} style={girdiStili}>
                        <option value="">Seçin...</option>
                        {bankaHesaplari.map((h) => <option key={h.banka_hesap_id} value={h.banka_hesap_id}>{h.banka_adi} — {h.hesap_adi || h.para_birimi}</option>)}
                      </select>
                    </Alan>
                  </div>
                )}
              </>
            )}
            <div style={{ minWidth: 180 }}>
              <Alan etiket="Not (opsiyonel)">
                <input value={form.aciklama} onChange={(e) => setForm((f) => ({ ...f, aciklama: e.target.value }))} style={girdiStili} />
              </Alan>
            </div>
            <Buton type="submit" variant="tehlike" disabled={kaydediliyor}>{kaydediliyor ? 'İşleniyor...' : 'Hurdaya Çıkar'}</Buton>
            <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
          </form>
          <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--kirmizi)' }}>
            Toplam maliyet {paraFormat(urun.toplam_maliyet_try)} — hurda bedeli düşülünce{' '}
            <strong>{paraFormat(beklenenZarar)} zarar</strong> olarak kaydedilecek.
          </div>
        </div>
      </td>
    </tr>
  );
}

function UrunDuzenleFormu({ urun, stokKartlari, onKaydedildi, onVazgec }) {
  const [form, setForm] = useState({ seri_no: urun.seri_no, stok_karti_id: String(urun.stok_karti_id), sifre: '' });
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      await api.put(`/stok-seri-no/${urun.id}`, {
        sifre: form.sifre,
        seri_no: form.seri_no,
        stok_karti_id: Number(form.stok_karti_id),
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
      <td colSpan={10} style={{ padding: 0 }}>
        <div style={{ padding: 16, background: 'var(--zemin)' }}>
          <form onSubmit={kaydet}>
            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>
              Ürünü düzenle — {urun.seri_no}
              {(() => {
                const kart = stokKartlari?.find((k) => k.id === urun.stok_karti_id);
                return kart ? ` (${kart.marka} ${kart.model})` : '';
              })()}
            </div>
            <HataMesaji>{hata}</HataMesaji>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Alan etiket="Seri no">
                <input required value={form.seri_no} onChange={(e) => setForm((f) => ({ ...f, seri_no: e.target.value }))} style={girdiStili} />
              </Alan>
              <Alan etiket="Ürün tanımı">
                <select required value={form.stok_karti_id} onChange={(e) => setForm((f) => ({ ...f, stok_karti_id: e.target.value }))} style={girdiStili}>
                  {stokKartlari.map((k) => <option key={k.id} value={k.id}>{k.marka} {k.model}</option>)}
                </select>
              </Alan>
              <Alan etiket="Şifreniz (onay için zorunlu)">
                <input required type="password" value={form.sifre} onChange={(e) => setForm((f) => ({ ...f, sifre: e.target.value }))} style={girdiStili} placeholder="Giriş şifreniz" />
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

const STOK_SERI_ALAN_ESLESTIRME = {
  seri_no: ['seri no', 'seri_no', 'serial', 'serino'],
  marka: ['marka', 'brand'],
  model: ['model'],
  sasi_no: ['şasi no', 'sasi no', 'sasi_no', 'chassis'],
  uretim_yili: ['üretim yılı', 'uretim yili', 'yil', 'year'],
  satinalma_maliyeti_try: ['satınalma maliyeti', 'satinalma maliyeti', 'maliyet', 'birim fiyat', 'fiyat'],
  sahiplik_tipi: ['sahiplik tipi', 'sahiplik_tipi', 'tip'],
};

function stokSeriNormallestir(s) {
  return (s || '').toString().trim().toLocaleLowerCase('tr');
}

function stokSeriSutunEslestir(basliklar) {
  const harita = {};
  for (const [alan, adaylar] of Object.entries(STOK_SERI_ALAN_ESLESTIRME)) {
    const bulunan = basliklar.find((b) => adaylar.includes(stokSeriNormallestir(b)));
    if (bulunan) harita[alan] = bulunan;
  }
  return harita;
}

function StokSeriNoIceAktarPaneli({ onKapat, onTamamlandi }) {
  const [satirlar, setSatirlar] = useState([]);
  const [hata, setHata] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [sonuc, setSonuc] = useState(null);

  function dosyaSecildi(e) {
    const dosya = e.target.files?.[0];
    if (!dosya) return;
    setHata(null);
    setSonuc(null);
    setSatirlar([]);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const kitap = XLSX.read(evt.target.result, { type: 'array' });
        const sayfa = kitap.Sheets[kitap.SheetNames[0]];
        const veri = XLSX.utils.sheet_to_json(sayfa, { defval: '' });
        if (veri.length === 0) { setHata('Dosyada veri bulunamadı.'); return; }
        const basliklar = Object.keys(veri[0]);
        const harita = stokSeriSutunEslestir(basliklar);
        if (!harita.seri_no || !harita.marka || !harita.model) {
          setHata("Seri No, Marka ve Model sütunları zorunludur - dosyanızda bunları bulamadım.");
          return;
        }
        const donusturulmus = veri
          .map((satir) => ({
            seri_no: String(satir[harita.seri_no] || '').trim(),
            marka: String(satir[harita.marka] || '').trim(),
            model: String(satir[harita.model] || '').trim(),
            sasi_no: harita.sasi_no ? String(satir[harita.sasi_no] || '').trim() || null : null,
            uretim_yili: harita.uretim_yili ? Number(satir[harita.uretim_yili] || 0) || null : null,
            satinalma_maliyeti_try: harita.satinalma_maliyeti_try ? Number(satir[harita.satinalma_maliyeti_try] || 0) : 0,
            sahiplik_tipi: harita.sahiplik_tipi
              ? (stokSeriNormallestir(satir[harita.sahiplik_tipi]).includes('öz') || stokSeriNormallestir(satir[harita.sahiplik_tipi]).includes('oz') ? 'OZ_MAL' : 'TICARI')
              : 'TICARI',
          }))
          .filter((s) => s.seri_no);
        setSatirlar(donusturulmus);
      } catch (err) {
        setHata('Dosya okunamadı. Geçerli bir Excel (.xlsx/.xls) dosyası olduğundan emin olun.');
      }
    };
    reader.readAsArrayBuffer(dosya);
  }

  async function iceAktar() {
    setYukleniyor(true);
    setHata(null);
    try {
      const { data } = await api.post('/stok-seri-no/toplu-ice-aktar', { satirlar });
      setSonuc(data);
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setYukleniyor(false);
    }
  }

  return (
    <Kart style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600 }}>Excel'den Stok (Seri No) İçe Aktar</div>
        <Buton variant="ikincil" onClick={onKapat}>Kapat</Buton>
      </div>
      <HataMesaji>{hata}</HataMesaji>
      <div style={{ fontSize: 12.5, color: 'var(--metin-ikincil)', marginBottom: 12 }}>
        Excel dosyanızda: <strong>Seri No, Marka, Model</strong> (hepsi zorunlu — Marka/Model, Ürün Tanımları'nda
        <strong> önceden kayıtlı</strong> bir ürünle eşleşmelidir), Şasi No, Üretim Yılı, Satınalma Maliyeti,
        Sahiplik Tipi bulunabilir. İçe aktarılan kayıtlar "Depoda" durumunda başlar, Kasa/Banka'ya hiçbir hareket yansımaz.
      </div>
      <input type="file" accept=".xlsx,.xls" onChange={dosyaSecildi} style={{ marginBottom: 16 }} />
      {satirlar.length > 0 && !sonuc && (
        <>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{satirlar.length} satır bulundu — önizleme (ilk 10):</div>
          <table style={{ marginBottom: 16 }}>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                {['Seri No', 'Marka', 'Model', 'Şasi No', 'Yıl', 'Maliyet (TL)', 'Sahiplik'].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 12, color: 'var(--metin-ikincil)' }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {satirlar.slice(0, 10).map((s, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                  <td style={{ padding: '6px 10px' }}>{s.seri_no}</td>
                  <td style={{ padding: '6px 10px' }}>{s.marka}</td>
                  <td style={{ padding: '6px 10px' }}>{s.model}</td>
                  <td style={{ padding: '6px 10px' }}>{s.sasi_no || '—'}</td>
                  <td style={{ padding: '6px 10px' }}>{s.uretim_yili || '—'}</td>
                  <td style={{ padding: '6px 10px' }}>{paraFormat(s.satinalma_maliyeti_try)}</td>
                  <td style={{ padding: '6px 10px' }}>{s.sahiplik_tipi === 'OZ_MAL' ? 'Öz Mal' : 'Ticari'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Buton onClick={iceAktar} disabled={yukleniyor}>{yukleniyor ? 'İçe aktarılıyor...' : `${satirlar.length} kaydı içe aktar`}</Buton>
        </>
      )}
      {sonuc && (
        <div style={{ marginTop: 12 }}>
          <div style={{ color: 'var(--yesil)', fontWeight: 600, marginBottom: 8 }}>✓ {sonuc.basarili_sayisi} kayıt başarıyla eklendi.</div>
          {sonuc.hatali_satirlar.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: 'var(--kirmizi)', fontWeight: 600, marginBottom: 6 }}>✗ {sonuc.hatali_satirlar.length} satırda hata oluştu:</div>
              <ul style={{ fontSize: 12.5, color: 'var(--metin-ikincil)' }}>
                {sonuc.hatali_satirlar.map((h) => <li key={h.satir_no}>Satır {h.satir_no} ({h.seri_no}): {h.hata}</li>)}
              </ul>
            </div>
          )}
          <Buton onClick={onTamamlandi}>Kapat ve listeyi yenile</Buton>
        </div>
      )}
    </Kart>
  );
}

export default function StokSayfasi() {
  const { oturum } = useAuth();
  const location = useLocation();
  const [seriNoArama, setSeriNoArama] = useState(new URLSearchParams(location.search).get('ara') || '');
  const [iceAktarAcik, setIceAktarAcik] = useState(false);
  const [usdKur, setUsdKur] = useState(null);
  const [tumUrunler, setTumUrunler] = useState([]);
  const [urunler, setUrunler] = useState([]);
  const [stokKartlari, setStokKartlari] = useState([]);
  const [siparisler, setSiparisler] = useState([]);
  const [durumFiltre, setDurumFiltre] = useState('');
  const [satilanlariGoster, setSatilanlariGoster] = useState(false);
  const [dovizMaliyetHaritasi, setDovizMaliyetHaritasi] = useState({});
  const [urunFiltre, setUrunFiltre] = useState('');
  const [siparisFiltre, setSiparisFiltre] = useState('');
  const [sahiplikFiltre, setSahiplikFiltre] = useState('TICARI');
  const [ozMalFormuAcik, setOzMalFormuAcik] = useState(false);
  const [hurdaAcikId, setHurdaAcikId] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(null);
  const [maliyetGosterilecekUrun, setMaliyetGosterilecekUrun] = useState(null);
  const [duzenlenenUrunId, setDuzenlenenUrunId] = useState(null);
  const [durumDegistirilenId, setDurumDegistirilenId] = useState(null);
  const [seciliIdler, setSeciliIdler] = useState([]);
  const [topluDurum, setTopluDurum] = useState('DEPODA');
  const [topluHata, setTopluHata] = useState(null);
  const siralama = useSiralama();
  const [topluIslemDevamEdiyor, setTopluIslemDevamEdiyor] = useState(false);
  const [topluMaliyetAcik, setTopluMaliyetAcik] = useState(false);
  const [topluMaliyetForm, setTopluMaliyetForm] = useState({
    tip: 'MILLILESTIRME', aciklama: '', para_birimi: 'USD', toplam_tutar: '', kur: '1',
    tarih: new Date().toISOString().slice(0, 10), yontem: 'ESIT',
  });

  useEffect(() => {
    if (topluMaliyetForm.para_birimi !== 'TRY') {
      api.get(`/kur/${topluMaliyetForm.para_birimi}`)
        .then((r) => setTopluMaliyetForm((f) => ({ ...f, kur: String(r.data.kur) })))
        .catch(() => {});
    }
  }, [topluMaliyetForm.para_birimi]);

  function seciliMi(id) {
    return seciliIdler.includes(id);
  }

  function secimiDegistir(id) {
    setSeciliIdler((mevcut) => (mevcut.includes(id) ? mevcut.filter((x) => x !== id) : [...mevcut, id]));
  }

  function tumunuSecVeyaKaldir() {
    if (seciliIdler.length === urunler.length) {
      setSeciliIdler([]);
    } else {
      setSeciliIdler(urunler.map((u) => u.id));
    }
  }

  async function topluMaliyetDagit() {
    setTopluHata(null);
    setTopluIslemDevamEdiyor(true);
    try {
      await api.post('/stok-seri-no/toplu-maliyet-dagit', {
        stok_seri_no_idleri: seciliIdler,
        tip: topluMaliyetForm.tip,
        aciklama: topluMaliyetForm.aciklama || null,
        para_birimi: topluMaliyetForm.para_birimi,
        toplam_tutar: Number(topluMaliyetForm.toplam_tutar),
        kur: Number(topluMaliyetForm.kur),
        tarih: topluMaliyetForm.tarih,
        yontem: topluMaliyetForm.yontem,
      });
      setSeciliIdler([]);
      setTopluMaliyetAcik(false);
      setTopluMaliyetForm((f) => ({ ...f, toplam_tutar: '', aciklama: '' }));
      tumUrunleriYukle();
      urunleriYukle();
    } catch (err) {
      setTopluHata(hataMesajiCikar(err));
    } finally {
      setTopluIslemDevamEdiyor(false);
    }
  }

  async function topluDurumGuncelle() {
    setTopluHata(null);
    setTopluIslemDevamEdiyor(true);
    try {
      await api.put('/stok-seri-no/toplu-durum-guncelle', {
        stok_seri_no_idleri: seciliIdler,
        durum: topluDurum,
      });
      setSeciliIdler([]);
      tumUrunleriYukle();
      urunleriYukle();
    } catch (err) {
      setTopluHata(hataMesajiCikar(err));
    } finally {
      setTopluIslemDevamEdiyor(false);
    }
  }

  async function urunuSil(urun) {
    if (!window.confirm(`${urun.seri_no} seri numaralı ürünü silmek istediğinize emin misiniz?`)) return;
    try {
      await api.delete(`/stok-seri-no/${urun.id}`);
      urunleriYukle();
      tumUrunleriYukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  async function satisiGeriAl(urun) {
    if (!window.confirm(`${urun.seri_no} seri numaralı ürünün satışını geri almak istediğinize emin misiniz? Ürün "Depoda" durumuna dönecek ve oluşan Kasa/Banka hareketi silinecek.`)) return;
    try {
      await api.put(`/stok-seri-no/${urun.id}/satisi-geri-al`);
      urunleriYukle();
      tumUrunleriYukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  function tumUrunleriYukle() {
    api.get('/stok-seri-no').then((r) => setTumUrunler(r.data)).catch(() => {});
  }

  function urunleriYukle() {
    setYukleniyor(true);
    const params = {};
    if (durumFiltre) params.durum = durumFiltre;
    if (urunFiltre) params.stok_karti_id = urunFiltre;
    if (siparisFiltre) params.siparis_id = siparisFiltre;
    if (sahiplikFiltre) params.sahiplik_tipi = sahiplikFiltre;
    api.get('/stok-seri-no', { params })
      .then((res) => setUrunler(res.data))
      .catch((err) => setHata(hataMesajiCikar(err)))
      .finally(() => setYukleniyor(false));
  }

  function stokKartlariniYukle() {
    api.get('/stok-kartlari').then((r) => setStokKartlari(r.data)).catch(() => {});
  }

  useEffect(() => {
    tumUrunleriYukle();
    stokKartlariniYukle();
    api.get('/siparisler').then((r) => setSiparisler(r.data)).catch(() => {});
    api.get('/kur/USD').then((r) => setUsdKur(Number(r.data.kur))).catch(() => {});
    api.get('/stok-seri-no/toplam-doviz-maliyet-haritasi').then((r) => setDovizMaliyetHaritasi(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    urunleriYukle();
  }, [durumFiltre, urunFiltre, siparisFiltre, sahiplikFiltre]); // eslint-disable-line

  function urunAdiGoster(stokKartiId) {
    const k = stokKartlari.find((x) => x.id === stokKartiId);
    return k ? `${k.marka} ${k.model}` : `#${stokKartiId}`;
  }

  function siparisNoGoster(siparisId) {
    if (!siparisId) return '—';
    const s = siparisler.find((x) => x.id === siparisId);
    return s ? s.siparis_no : `#${siparisId}`;
  }

  // Ayni siparise ait urunler ekranda yan yana gorunsun diye siparis_id'ye
  // gore grupluyoruz (siparissiz/manuel urunler en sona duser).
  function stokExcelIndir() {
    const veri = gruplananUrunler.map((u) => ({
      'Seri No': u.seri_no,
      'Ürün': urunAdiGoster(u.stok_karti_id),
      'Sipariş No': siparisNoGoster(u.siparis_id),
      'Durum': DURUM_METIN[u.durum] || u.durum,
      'Toplam Maliyet (TL)': Number(u.toplam_maliyet_try),
      'Toplam Maliyet (USD)': usdKur ? Number((u.toplam_maliyet_try / usdKur).toFixed(2)) : '',
      'Satış Fiyatı (TL)': u.satis_fiyati_try != null ? Number(u.satis_fiyati_try) : '',
    }));
    const dosyaAdi = durumFiltre ? `stok_${durumFiltre.toLowerCase()}` : 'stok_listesi';
    excelIndir(veri, dosyaAdi, 'Stok');
  }

  // Satilmis urunler, listeyi gereksiz kalabalik gostermesin diye
  // varsayilan olarak GIZLENIR - "Satilanlari da göster" acikca
  // isaretlenmedikce (ya da durum filtresi ozellikle "SATILDI" secilmedikce).
  const gruplananUrunler = [...urunler]
    .filter((u) => satilanlariGoster || durumFiltre === 'SATILDI' || u.durum !== 'SATILDI')
    .filter((u) => !seriNoArama || (u.seri_no || '').toLocaleLowerCase('tr').includes(seriNoArama.toLocaleLowerCase('tr')) || (u.sasi_no || '').toLocaleLowerCase('tr').includes(seriNoArama.toLocaleLowerCase('tr')))
    .sort((a, b) => {
      if (a.siparis_id === b.siparis_id) return a.id - b.id;
      if (a.siparis_id == null) return 1;
      if (b.siparis_id == null) return -1;
      return a.siparis_id - b.siparis_id;
    });

  const durumOzet = {};
  tumUrunler.forEach((u) => {
    durumOzet[u.durum] = (durumOzet[u.durum] || 0) + 1;
  });

  // Urun tanimi (stok karti) basina, stogumuza simdiye kadar girmis toplam
  // adet - "Uruna gore filtrele" listesinde ve maliyet detayinda gosterilir.
  const urunAdetOzet = {};
  tumUrunler.forEach((u) => {
    urunAdetOzet[u.stok_karti_id] = (urunAdetOzet[u.stok_karti_id] || 0) + 1;
  });

  return (
    <div>
      <style>{`
        .yazdirma-basligi { display: none; }
        @media print {
          .no-print { display: none !important; }
          button { display: none !important; }
          input[type="checkbox"] { display: none !important; }
          .yazdirma-basligi { display: flex !important; }
        }
      `}</style>

      <div className="yazdirma-basligi" style={{ alignItems: 'center', gap: 12, marginBottom: 16 }}>
        {oturum?.aktifSirketId && (
          <img
            src={`${API_TABAN_URL}/sirketler/${oturum.aktifSirketId}/logo`}
            alt="Logo"
            onError={(e) => { e.target.style.display = 'none'; }}
            style={{ maxHeight: 50, maxWidth: 130, objectFit: 'contain' }}
          />
        )}
        <div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>
            {oturum?.sirketler?.find((s) => s.id === oturum.aktifSirketId)?.unvan || ''}
          </div>
          <div style={{ fontSize: 13, color: '#555' }}>
            Stok Listesi{durumFiltre ? ` — ${DURUM_METIN[durumFiltre]}` : ''} — {new Date().toLocaleDateString('tr-TR')}
          </div>
        </div>
      </div>

      <SayfaBasligi
        baslik="Stok"
        aciklama="Fiziksel envanter — konum/duruma göre gruplanmış ve filtrelenebilir"
        eylem={
          <div className="no-print" style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => window.print()} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--kenarlik-koyu)', background: 'white', cursor: 'pointer' }}>
              Yazdır
            </button>
            <button onClick={stokExcelIndir} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--kenarlik-koyu)', background: 'white', cursor: 'pointer' }}>
              Excel İndir
            </button>
            <Buton variant="ikincil" onClick={() => setIceAktarAcik((a) => !a)}>
              {iceAktarAcik ? 'İçe Aktarmayı Kapat' : "Excel'den İçe Aktar"}
            </Buton>
            <Buton variant="ikincil" onClick={() => setOzMalFormuAcik((a) => !a)}>
              {ozMalFormuAcik ? 'Kapat' : '+ Öz Mal Ekle'}
            </Buton>
            <Link to="/satis-yap"><Buton>+ Satış Yap</Buton></Link>
          </div>
        }
      />
      <HataMesaji>{hata}</HataMesaji>

      {iceAktarAcik && (
        <StokSeriNoIceAktarPaneli
          onKapat={() => setIceAktarAcik(false)}
          onTamamlandi={() => { setIceAktarAcik(false); urunleriYukle(); tumUrunleriYukle(); }}
        />
      )}

      {ozMalFormuAcik && (
        <OzMalIlkKayitFormu
          stokKartlari={stokKartlari}
          onKaydedildi={() => { setOzMalFormuAcik(false); tumUrunleriYukle(); urunleriYukle(); }}
          onVazgec={() => setOzMalFormuAcik(false)}
        />
      )}

      <div className="no-print" style={{ marginBottom: 12 }}>
        <input
          value={seriNoArama}
          onChange={(e) => setSeriNoArama(e.target.value)}
          placeholder="Seri no / şasi no ile ara..."
          style={{ ...girdiStili, maxWidth: 320 }}
        />
      </div>
      <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[['TICARI', 'Ticari Mal'], ['OZ_MAL', 'Öz Mal'], ['', 'Tümü']].map(([deger, etiket]) => (
          <button
            key={deger || 'tumu'}
            onClick={() => setSahiplikFiltre(deger)}
            style={{
              padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
              border: sahiplikFiltre === deger ? '2px solid var(--lacivert)' : '1px solid var(--kenarlik)',
              background: sahiplikFiltre === deger ? 'var(--lacivert)' : 'white',
              color: sahiplikFiltre === deger ? 'white' : 'var(--metin-birincil)',
              fontWeight: sahiplikFiltre === deger ? 600 : 400,
            }}
          >
            {etiket}
          </button>
        ))}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginLeft: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={satilanlariGoster} onChange={(e) => setSatilanlariGoster(e.target.checked)} />
          Satılanları da göster
        </label>
      </div>

      <div className="no-print" style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {Object.entries(DURUM_METIN).map(([kod, etiket]) => (
          <button
            key={kod}
            onClick={() => setDurumFiltre((mevcut) => (mevcut === kod ? '' : kod))}
            style={{
              padding: '10px 16px', borderRadius: 9, border: durumFiltre === kod ? '2px solid var(--lacivert)' : '1px solid var(--kenarlik)',
              background: durumFiltre === kod ? 'var(--zemin)' : 'white', cursor: 'pointer', textAlign: 'left', minWidth: 110,
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--metin-ikincil)' }}>{etiket}</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{durumOzet[kod] || 0}</div>
          </button>
        ))}
      </div>

      {maliyetGosterilecekUrun && (
        <MaliyetDetayi
          urun={maliyetGosterilecekUrun}
          stokKartlari={stokKartlari}
          onKapat={() => { setMaliyetGosterilecekUrun(null); urunleriYukle(); }}
        />
      )}

      {seciliIdler.length > 0 && (
        <Kart style={{ marginBottom: 16, background: 'var(--lacivert)', color: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13.5, fontWeight: 500 }}>{seciliIdler.length} ürün seçildi</div>
            <Alan etiket="Yeni durum">
              <select value={topluDurum} onChange={(e) => setTopluDurum(e.target.value)} style={{ ...girdiStili, minWidth: 180 }}>
                {Object.entries(DURUM_METIN).filter(([k]) => k !== 'SATILDI').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Alan>
            <Buton onClick={topluDurumGuncelle} disabled={topluIslemDevamEdiyor} variant="ikincil">
              {topluIslemDevamEdiyor ? 'Güncelleniyor...' : 'Seçilenlerin durumunu güncelle'}
            </Buton>
            <Buton variant="ikincil" onClick={() => setTopluMaliyetAcik((a) => !a)}>
              {topluMaliyetAcik ? 'Maliyet formunu kapat' : 'Seçilenlere Maliyet Ekle (Dağıt)'}
            </Buton>
            <Buton variant="ikincil" onClick={() => setSeciliIdler([])}>Seçimi temizle</Buton>
          </div>
          {topluHata && <div style={{ marginTop: 8, fontSize: 13, color: '#ffd7d7' }}>{topluHata}</div>}

          {topluMaliyetAcik && (
            <div style={{ marginTop: 14, padding: 14, background: 'white', borderRadius: 8, color: 'var(--metin-birincil)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
                {seciliIdler.length} ürüne toplam bir maliyet ekle ve aralarında dağıt
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <Alan etiket="Maliyet tipi">
                  <select value={topluMaliyetForm.tip} onChange={(e) => setTopluMaliyetForm((f) => ({ ...f, tip: e.target.value }))} style={girdiStili}>
                    {Object.entries(MALIYET_TIP_METIN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Alan>
                <Alan etiket="Para birimi">
                  <select value={topluMaliyetForm.para_birimi} onChange={(e) => setTopluMaliyetForm((f) => ({ ...f, para_birimi: e.target.value }))} style={girdiStili}>
                    <option value="TRY">TRY</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </Alan>
                <Alan etiket="Toplam tutar">
                  <ParaGirdisi value={topluMaliyetForm.toplam_tutar} onChange={(v) => setTopluMaliyetForm((f) => ({ ...f, toplam_tutar: v }))} />
                </Alan>
                {topluMaliyetForm.para_birimi !== 'TRY' && (
                  <Alan etiket="Kur">
                    <input type="number" step="0.0001" value={topluMaliyetForm.kur} onChange={(e) => setTopluMaliyetForm((f) => ({ ...f, kur: e.target.value }))} style={girdiStili} />
                  </Alan>
                )}
                <Alan etiket="Tarih">
                  <input type="date" value={topluMaliyetForm.tarih} onChange={(e) => setTopluMaliyetForm((f) => ({ ...f, tarih: e.target.value }))} style={girdiStili} />
                </Alan>
                <Alan etiket="Dağıtım yöntemi">
                  <select value={topluMaliyetForm.yontem} onChange={(e) => setTopluMaliyetForm((f) => ({ ...f, yontem: e.target.value }))} style={girdiStili}>
                    <option value="ESIT">Eşit dağıt</option>
                    <option value="AGIRLIKLI">Satınalma maliyetine göre ağırlıklı dağıt</option>
                  </select>
                </Alan>
                <Alan etiket="Açıklama (opsiyonel)">
                  <input value={topluMaliyetForm.aciklama} onChange={(e) => setTopluMaliyetForm((f) => ({ ...f, aciklama: e.target.value }))} style={girdiStili} />
                </Alan>
              </div>
              <Buton onClick={topluMaliyetDagit} disabled={topluIslemDevamEdiyor || !topluMaliyetForm.toplam_tutar} style={{ marginTop: 10 }}>
                {topluIslemDevamEdiyor ? 'Dağıtılıyor...' : 'Dağıt ve Kaydet'}
              </Buton>
            </div>
          )}
        </Kart>
      )}

      <Kart style={{ padding: 0 }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--kenarlik)', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Alan etiket="Ürüne göre filtrele">
            <select value={urunFiltre} onChange={(e) => setUrunFiltre(e.target.value)} style={{ ...girdiStili, minWidth: 220 }}>
              <option value="">Tüm ürünler</option>
              {stokKartlari.map((k) => (
                <option key={k.id} value={k.id}>{k.marka} {k.model} ({urunAdetOzet[k.id] || 0} adet)</option>
              ))}
            </select>
          </Alan>
          <div style={{ minWidth: 220 }}>
            <Alan etiket="Siparişe göre filtrele">
              <AramaliSecici
                secenekler={siparisler}
                deger={siparisFiltre}
                onDegistir={setSiparisFiltre}
                etiketFn={(s) => s.siparis_no}
                bosMetin="Tümü / sipariş no yazarak arayın..."
              />
            </Alan>
          </div>
          {durumFiltre && (
            <Buton variant="ikincil" onClick={() => setDurumFiltre('')}>Durum filtresini temizle ({DURUM_METIN[durumFiltre]})</Buton>
          )}
          {siparisFiltre && (
            <Buton variant="ikincil" onClick={() => setSiparisFiltre('')}>Sipariş filtresini temizle</Buton>
          )}
        </div>

        {yukleniyor ? (
          <div style={{ padding: 20, color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
        ) : urunler.length === 0 ? (
          <BosDurum baslik="Bu filtrede ürün bulunamadı" />
        ) : (
          <table>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                <th style={{ padding: '10px 16px', width: 32 }}>
                  <input
                    type="checkbox"
                    checked={urunler.length > 0 && seciliIdler.length === urunler.length}
                    onChange={tumunuSecVeyaKaldir}
                  />
                </th>
                <SiraliBaslik alanAdi="seri_no" siralama={siralama}>Seri No</SiraliBaslik>
                <SiraliBaslik alanAdi="_urun_adi" siralama={siralama}>Ürün</SiraliBaslik>
                <SiraliBaslik alanAdi="_siparis_no" siralama={siralama}>Sipariş</SiraliBaslik>
                <SiraliBaslik alanAdi="durum" siralama={siralama}>Durum</SiraliBaslik>
                <SiraliBaslik alanAdi="sahiplik_tipi" siralama={siralama}>Sahiplik</SiraliBaslik>
                <SiraliBaslik alanAdi="toplam_maliyet_try" siralama={siralama}>Toplam Maliyet (TL)</SiraliBaslik>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>Toplam Maliyet (USD)</th>
                <SiraliBaslik alanAdi="satis_fiyati_try" siralama={siralama}>Satış Fiyatı (TL)</SiraliBaslik>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>Satış Fiyatı (USD)</th>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>Kâr/Zarar</th>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {siralama.sirala(gruplananUrunler, (item, alan) => {
                if (alan === '_urun_adi') return urunAdiGoster(item.stok_karti_id);
                if (alan === '_siparis_no') return siparisNoGoster(item.siparis_id);
                return item[alan];
              }).map((u, index) => {
                const karZarar = u.satis_fiyati_try != null ? u.satis_fiyati_try - u.toplam_maliyet_try : null;
                const satilabilir = u.durum === 'DEPODA' || u.durum === 'ANTREPODA';
                const oncekiUrun = gruplananUrunler[index - 1];
                const grupBasi = !siralama.alan && index > 0 && oncekiUrun && oncekiUrun.siparis_id !== u.siparis_id;
                if (durumDegistirilenId === u.id) {
                  return (
                    <DurumDegistirFormu
                      key={u.id}
                      urun={u}
                      onKaydedildi={() => { setDurumDegistirilenId(null); urunleriYukle(); tumUrunleriYukle(); }}
                      onVazgec={() => setDurumDegistirilenId(null)}
                    />
                  );
                }
                if (duzenlenenUrunId === u.id) {
                  return (
                    <UrunDuzenleFormu
                      key={u.id}
                      urun={u}
                      stokKartlari={stokKartlari}
                      onKaydedildi={() => { setDuzenlenenUrunId(null); urunleriYukle(); }}
                      onVazgec={() => setDuzenlenenUrunId(null)}
                    />
                  );
                }
                if (hurdaAcikId === u.id) {
                  return (
                    <HurdayaCikarFormu
                      key={u.id}
                      urun={u}
                      onKaydedildi={() => { setHurdaAcikId(null); urunleriYukle(); tumUrunleriYukle(); }}
                      onVazgec={() => setHurdaAcikId(null)}
                    />
                  );
                }
                return (
                  <Fragment key={u.id}>
                    <tr style={{
                      borderTop: grupBasi ? '3px solid var(--lacivert)' : '1px solid var(--kenarlik)',
                      background: seciliMi(u.id)
                        ? 'var(--zemin)'
                        : u.durum === 'SATILDI' ? 'var(--yesil-acik, #e3f5e9)'
                        : u.durum === 'KIRADA' ? 'var(--amber-acik, #fdf0d5)'
                        : 'transparent',
                    }}>
                      <td style={{ padding: '12px 16px' }}>
                        <input type="checkbox" checked={seciliMi(u.id)} onChange={() => secimiDegistir(u.id)} />
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>{u.seri_no}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--metin-ikincil)' }}>
                        {urunAdiGoster(u.stok_karti_id)}
                        <span style={{ fontSize: 11, color: 'var(--metin-soluk)', marginLeft: 6 }}>
                          (bu üründen toplam {urunAdetOzet[u.stok_karti_id] || 0} adet)
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--metin-ikincil)' }}>{siparisNoGoster(u.siparis_id)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <Etiket ton={DURUM_ETIKET[u.durum]}>{DURUM_METIN[u.durum]}</Etiket>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Etiket ton={u.sahiplik_tipi === 'OZ_MAL' ? 'amber' : 'notr'}>{u.sahiplik_tipi === 'OZ_MAL' ? 'Öz Mal' : 'Ticari'}</Etiket>
                      </td>
                      <td style={{ padding: '12px 16px' }}>{paraFormat(u.toplam_maliyet_try)}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--metin-ikincil)' }}>
                        {(() => {
                          const gercekUsd = dovizMaliyetHaritasi[String(u.id)]?.USD;
                          if (gercekUsd != null) return paraFormat(gercekUsd, 'USD');
                          if (usdKur) return <span title="Gerçek döviz kaydı yok — bugünkü kurla tahmini gösterim">~{paraFormat(u.toplam_maliyet_try / usdKur, 'USD')}</span>;
                          return '—';
                        })()}
                      </td>
                      <td style={{ padding: '12px 16px' }}>{u.satis_fiyati_try != null ? paraFormat(u.satis_fiyati_try) : '—'}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--metin-ikincil)' }}>
                        {u.satis_fiyati_try != null && usdKur ? paraFormat(u.satis_fiyati_try / usdKur, 'USD') : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', color: karZarar == null ? 'var(--metin-soluk)' : karZarar >= 0 ? 'var(--yesil)' : 'var(--kirmizi)', fontWeight: 500 }}>
                        {karZarar != null ? paraFormat(karZarar) : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button
                            onClick={() => {
                              setMaliyetGosterilecekUrun(u);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            style={eylemChipStili('lacivert')}
                          >
                            Maliyet Detayı
                          </button>
                          {satilabilir && (
                            <Link to={`/satis-yap?urun=${u.id}`}><button style={eylemChipStili('yesil')} type="button">Satış yap</button></Link>
                          )}
                          {u.durum !== 'SATILDI' && (
                            <button onClick={() => setDurumDegistirilenId(u.id)} style={eylemChipStili('amber')}>Durum Değiştir</button>
                          )}
                          <button onClick={() => setDuzenlenenUrunId(u.id)} style={eylemChipStili('lacivert')}>Düzenle</button>
                          {u.durum !== 'SATILDI' && u.durum !== 'HURDA' && (
                            <button onClick={() => setHurdaAcikId(u.id)} style={eylemChipStili('kirmizi')}>Hurdaya Çıkar</button>
                          )}
                          {(u.durum === 'SATILDI' || u.durum === 'HURDA') ? (
                            <button onClick={() => satisiGeriAl(u)} style={eylemChipStili('kirmizi')}>
                              {u.durum === 'HURDA' ? 'Hurdayı Geri Al' : 'Satışı Geri Al'}
                            </button>
                          ) : (
                            <button onClick={() => urunuSil(u)} style={eylemChipStili('kirmizi')}>Sil</button>
                          )}
                        </div>
                      </td>
                    </tr>
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
