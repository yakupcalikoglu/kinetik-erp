import { useEffect, useState, Fragment } from 'react';
import { useLocation } from 'react-router-dom';
import { api, hataMesajiCikar, ozelOnayIste, ozelAlert, geriAlBildirimGoster } from '../api/client';
import {
  Kart, SayfaBasligi, Buton, Alan, girdiStili, Etiket, BosDurum, HataMesaji, paraFormat, eylemChipStili, ParaGirdisi,
  DahaFazlaMenu,
} from '../components/Ortak';
import * as XLSX from 'xlsx';
import AramaliSecici from '../components/AramaliSecici';
import { excelIndir } from '../utils/disaAktarma';

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
      if (typeof av === 'string') return yon === 'asc' ? av.localeCompare(bv, 'tr') : bv.localeCompare(av, 'tr');
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

const KATEGORI_METIN = {
  ARAC: 'Araç', GAYRIMENKUL: 'Gayrimenkul', OFIS_EKIPMANI: 'Ofis Ekipmanı', DIGER: 'Diğer',
  EKIPMAN: 'Ekipman (Stok)',
};

const DURUM_METIN = {
  KULLANIMDA: 'Kullanımda', KIRADA: 'Kirada', BOSTA: 'Boşta', SATILDI: 'Satıldı', HURDA: 'Hurda',
  DEPODA: 'Depoda', ANTREPODA: 'Antrepoda', YOLDA: 'Yolda', GUMRUKTE: 'Gümrükte', BAKIMDA: 'Bakımda',
};

const DURUM_TON = {
  KULLANIMDA: 'yesil', KIRADA: 'amber', BOSTA: 'notr', SATILDI: 'notr', HURDA: 'kirmizi',
  DEPODA: 'yesil', ANTREPODA: 'yesil', YOLDA: 'amber', GUMRUKTE: 'amber', BAKIMDA: 'kirmizi',
};

function bosDemirbasFormu() {
  return {
    kategori: 'ARAC', ad: '', tanimlayici_no: '', konum: '', durum: 'KULLANIMDA',
    kiraci_cari_id: '', maliyet_orijinal: '', para_birimi: 'TRY', kur: '1',
    alim_tarihi: new Date().toISOString().slice(0, 10), amortisman_orani: '', notlar: '',
  };
}

function DemirbasFormu({ duzenlenen, cariler, onKaydedildi, onVazgec }) {
  const duzenlemeModu = !!duzenlenen;
  const [form, setForm] = useState(() => duzenlenen
    ? {
        kategori: duzenlenen.kategori, ad: duzenlenen.ad, tanimlayici_no: duzenlenen.tanimlayici_no || '',
        konum: duzenlenen.konum || '', durum: duzenlenen.durum, kiraci_cari_id: duzenlenen.kiraci_cari_id || '',
        maliyet_try: String(duzenlenen.maliyet_try), alim_tarihi: duzenlenen.alim_tarihi || '',
        amortisman_orani: duzenlenen.amortisman_orani != null ? String(duzenlenen.amortisman_orani) : '',
        notlar: duzenlenen.notlar || '', sifre: '',
      }
    : bosDemirbasFormu()
  );
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => {
    if (duzenlemeModu || form.para_birimi === 'TRY') return;
    api.get(`/kur/${form.para_birimi}`).then((r) => setForm((f) => ({ ...f, kur: r.data.kur }))).catch(() => {});
  }, [form.para_birimi]); // eslint-disable-line

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      if (duzenlemeModu) {
        await api.put(`/demirbaslar/${duzenlenen.id}`, {
          sifre: form.sifre, kategori: form.kategori, ad: form.ad,
          tanimlayici_no: form.tanimlayici_no || null, konum: form.konum || null,
          durum: form.durum, kiraci_cari_id: form.kiraci_cari_id ? Number(form.kiraci_cari_id) : null,
          maliyet_try: Number(form.maliyet_try), alim_tarihi: form.alim_tarihi || null,
          amortisman_orani: form.amortisman_orani ? Number(form.amortisman_orani) : null,
          notlar: form.notlar || null,
        });
      } else {
        await api.post('/demirbaslar', {
          kategori: form.kategori, ad: form.ad,
          tanimlayici_no: form.tanimlayici_no || null, konum: form.konum || null,
          durum: form.durum, kiraci_cari_id: form.kiraci_cari_id ? Number(form.kiraci_cari_id) : null,
          maliyet_orijinal: Number(form.maliyet_orijinal), para_birimi: form.para_birimi, kur: Number(form.kur || 1),
          alim_tarihi: form.alim_tarihi || null, amortisman_orani: form.amortisman_orani ? Number(form.amortisman_orani) : null,
          notlar: form.notlar || null,
        });
      }
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
        <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 14 }}>
          {duzenlemeModu ? `Demirbaşı düzenle — ${duzenlenen.ad}` : 'Yeni Demirbaş'}
        </div>
        <HataMesaji>{hata}</HataMesaji>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
          <Alan etiket="Kategori">
            <select value={form.kategori} onChange={(e) => setForm((f) => ({ ...f, kategori: e.target.value }))} style={girdiStili}>
              <option value="ARAC">Araç</option>
              <option value="GAYRIMENKUL">Gayrimenkul</option>
              <option value="OFIS_EKIPMANI">Ofis Ekipmanı</option>
              <option value="DIGER">Diğer</option>
            </select>
          </Alan>
          <Alan etiket="Ad / Tanım">
            <input required value={form.ad} onChange={(e) => setForm((f) => ({ ...f, ad: e.target.value }))} placeholder="Örn: Ford Transit, Merkez Ofis" style={girdiStili} />
          </Alan>
          <Alan etiket="Tanımlayıcı No (plaka/tapu no vb.)">
            <input value={form.tanimlayici_no} onChange={(e) => setForm((f) => ({ ...f, tanimlayici_no: e.target.value }))} style={girdiStili} />
          </Alan>
          <Alan etiket="Konum / Adres">
            <input value={form.konum} onChange={(e) => setForm((f) => ({ ...f, konum: e.target.value }))} style={girdiStili} />
          </Alan>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
          <Alan etiket="Durum">
            <select value={form.durum} onChange={(e) => setForm((f) => ({ ...f, durum: e.target.value }))} style={girdiStili}>
              <option value="KULLANIMDA">Kullanımda</option>
              <option value="KIRADA">Kirada</option>
              <option value="BOSTA">Boşta</option>
            </select>
          </Alan>
          {form.durum === 'KIRADA' && (
            <Alan etiket="Kiracı (cari)">
              <AramaliSecici secenekler={cariler} deger={form.kiraci_cari_id} onDegistir={(v) => setForm((f) => ({ ...f, kiraci_cari_id: v }))} etiketFn={(c) => c.unvan} />
            </Alan>
          )}
          <Alan etiket="Alım tarihi">
            <input type="date" value={form.alim_tarihi} onChange={(e) => setForm((f) => ({ ...f, alim_tarihi: e.target.value }))} style={girdiStili} />
          </Alan>
          <Alan etiket="Yıllık amortisman oranı (%, opsiyonel)">
            <input type="number" step="0.1" placeholder="Örn: 20" value={form.amortisman_orani} onChange={(e) => setForm((f) => ({ ...f, amortisman_orani: e.target.value }))} style={girdiStili} />
          </Alan>
          {duzenlemeModu ? (
            <Alan etiket="Maliyet (TL)">
              <ParaGirdisi required value={form.maliyet_try} onChange={(v) => setForm((f) => ({ ...f, maliyet_try: v }))} />
            </Alan>
          ) : (
            <>
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
                <Alan etiket="Kur">
                  <input type="number" step="0.0001" value={form.kur} onChange={(e) => setForm((f) => ({ ...f, kur: e.target.value }))} style={girdiStili} />
                </Alan>
              )}
            </>
          )}
        </div>
        <Alan etiket="Notlar">
          <input value={form.notlar} onChange={(e) => setForm((f) => ({ ...f, notlar: e.target.value }))} style={girdiStili} />
        </Alan>
        {duzenlemeModu && (
          <Alan etiket="Şifreniz (onay için zorunlu)">
            <input required type="password" value={form.sifre} onChange={(e) => setForm((f) => ({ ...f, sifre: e.target.value }))} style={girdiStili} placeholder="Giriş şifreniz" />
          </Alan>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : duzenlemeModu ? 'Değişiklikleri kaydet' : 'Kaydet'}</Buton>
          <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
        </div>
      </form>
    </Kart>
  );
}

function DemirbasSatisFormu({ demirbas, onKaydedildi, onVazgec }) {
  const [form, setForm] = useState({ satis_fiyati_try: '0', odeme_yontemi: 'NAKIT', banka_hesap_id: '', aciklama: '' });
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
      const tutar = Number(form.satis_fiyati_try || 0);
      await api.put(`/demirbaslar/${demirbas.id}/satis`, {
        satis_fiyati_try: tutar,
        odeme_yontemi: tutar > 0 ? form.odeme_yontemi : null,
        banka_hesap_id: tutar > 0 && form.odeme_yontemi === 'BANKA' ? Number(form.banka_hesap_id) : null,
        aciklama: form.aciklama || null,
      });
      onKaydedildi();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  const karZarar = Number(form.satis_fiyati_try || 0) - Number(demirbas.maliyet_try);

  return (
    <tr>
      <td colSpan={8} style={{ padding: 0 }}>
        <div style={{ padding: 16, background: 'var(--zemin)' }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>{demirbas.ad} — Sat / Elden Çıkar</div>
          <HataMesaji>{hata}</HataMesaji>
          <form onSubmit={kaydet} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 160 }}>
              <Alan etiket="Satış tutarı (TL, 0 olabilir)">
                <ParaGirdisi value={form.satis_fiyati_try} onChange={(v) => setForm((f) => ({ ...f, satis_fiyati_try: v }))} />
              </Alan>
            </div>
            {Number(form.satis_fiyati_try) > 0 && (
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
            <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'İşleniyor...' : 'Satışı Onayla'}</Buton>
            <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
          </form>
          <div style={{ marginTop: 10, fontSize: 12.5, color: karZarar >= 0 ? 'var(--yesil)' : 'var(--kirmizi)' }}>
            Maliyet {paraFormat(demirbas.maliyet_try)} — bu satış {paraFormat(Math.abs(karZarar))} {karZarar >= 0 ? 'kâr' : 'zarar'} olarak kaydedilecek.
          </div>
        </div>
      </td>
    </tr>
  );
}

function useCariler() {
  const [cariler, setCariler] = useState([]);
  useEffect(() => {
    api.get('/cariler').then((r) => setCariler(r.data)).catch(() => {});
  }, []);
  return cariler;
}

const DEMIRBAS_ALAN_ESLESTIRME = {
  kategori: ['kategori', 'tur', 'category'],
  ad: ['ad', 'tanim', 'ürün adı', 'urun adi', 'name'],
  tanimlayici_no: ['tanimlayici no', 'plaka', 'tapu no', 'seri no', 'plaka/tapu no'],
  konum: ['konum', 'adres', 'sube'],
  maliyet_try: ['maliyet', 'maliyet (tl)', 'tutar', 'fiyat'],
  alim_tarihi: ['alim tarihi', 'tarih', 'alış tarihi'],
};

function normallestirBaslik(s) {
  return (s || '').toString().trim().toLocaleLowerCase('tr');
}

function demirbasSutunEslestir(basliklar) {
  const harita = {};
  for (const [alan, adaylar] of Object.entries(DEMIRBAS_ALAN_ESLESTIRME)) {
    const bulunan = basliklar.find((b) => adaylar.includes(normallestirBaslik(b)));
    if (bulunan) harita[alan] = bulunan;
  }
  return harita;
}

function DemirbasIceAktarPaneli({ onKapat, onTamamlandi }) {
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
        const harita = demirbasSutunEslestir(basliklar);
        if (!harita.ad) {
          setHata("Ad/Tanım sütunu bulunamadı. Excel dosyasında bu bilgiyi içeren bir sütun olmalı (örn. 'Ad').");
          return;
        }
        const donusturulmus = veri
          .map((satir) => ({
            kategori: harita.kategori ? String(satir[harita.kategori] || 'DIGER').trim().toUpperCase() : 'DIGER',
            ad: harita.ad ? String(satir[harita.ad] || '').trim() : '',
            tanimlayici_no: harita.tanimlayici_no ? String(satir[harita.tanimlayici_no] || '').trim() : '',
            konum: harita.konum ? String(satir[harita.konum] || '').trim() : '',
            maliyet_try: harita.maliyet_try ? Number(satir[harita.maliyet_try] || 0) : 0,
            alim_tarihi: null,
          }))
          .filter((s) => s.ad);
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
      const { data } = await api.post('/demirbaslar/toplu-ice-aktar', { satirlar });
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
        <div style={{ fontSize: 14.5, fontWeight: 600 }}>Excel'den Demirbaş İçe Aktar</div>
        <Buton variant="ikincil" onClick={onKapat}>Kapat</Buton>
      </div>
      <HataMesaji>{hata}</HataMesaji>
      <div style={{ fontSize: 12.5, color: 'var(--metin-ikincil)', marginBottom: 12 }}>
        Excel dosyanızda (herhangi bir sütun sırasıyla): <strong>Ad</strong> (zorunlu), Kategori, Tanımlayıcı No, Konum, Maliyet bulunabilir.
        Maliyet, TL cinsinden kabul edilir — döviz cinsinden girmek isterseniz "Yeni Demirbaş" formunu kullanın.
        {' '}
        <button
          type="button"
          onClick={() => excelIndir(
            [{ 'Ad': 'Örnek Forklift', 'Kategori': 'Araç', 'Tanımlayıcı No': '34 ABC 123', 'Konum': 'Merkez Depo', 'Maliyet': 250000, 'Alım Tarihi': '2026-01-15' }],
            'demirbas_sablon', 'Demirbaş Şablonu',
          )}
          style={{ background: 'none', border: 'none', color: 'var(--lacivert)', textDecoration: 'underline', cursor: 'pointer', fontSize: 12.5, padding: 0 }}
        >
          Örnek şablon indir
        </button>
      </div>
      <input type="file" accept=".xlsx,.xls" onChange={dosyaSecildi} style={{ marginBottom: 16 }} />
      {satirlar.length > 0 && !sonuc && (
        <>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{satirlar.length} satır bulundu — önizleme (ilk 10):</div>
          <table style={{ marginBottom: 16 }}>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                {['Kategori', 'Ad', 'Tanımlayıcı No', 'Konum', 'Maliyet (TL)'].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 12, color: 'var(--metin-ikincil)' }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {satirlar.slice(0, 10).map((s, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                  <td style={{ padding: '6px 10px' }}>{KATEGORI_METIN[s.kategori] || s.kategori}</td>
                  <td style={{ padding: '6px 10px' }}>{s.ad}</td>
                  <td style={{ padding: '6px 10px' }}>{s.tanimlayici_no || '—'}</td>
                  <td style={{ padding: '6px 10px' }}>{s.konum || '—'}</td>
                  <td style={{ padding: '6px 10px' }}>{paraFormat(s.maliyet_try)}</td>
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
                {sonuc.hatali_satirlar.map((h) => <li key={h.satir_no}>Satır {h.satir_no} ({h.ad}): {h.hata}</li>)}
              </ul>
            </div>
          )}
          <Buton onClick={onTamamlandi}>Kapat ve listeyi yenile</Buton>
        </div>
      )}
    </Kart>
  );
}

export default function OzMalSayfasi() {
  const [demirbaslar, setDemirbaslar] = useState([]);
  const [ekipmanlar, setEkipmanlar] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(null);
  const [formAcik, setFormAcik] = useState(false);
  const [duzenlenen, setDuzenlenen] = useState(null);
  const [satisAcikId, setSatisAcikId] = useState(null);
  const location = useLocation();
  const [aramaMetni, setAramaMetni] = useState(new URLSearchParams(location.search).get('ara') || '');
  const [iceAktarAcik, setIceAktarAcik] = useState(false);
  const siralama = useSiralama();
  const cariler = useCariler();

  const [stokKartlari, setStokKartlari] = useState([]);

  function yukle() {
    setYukleniyor(true);
    Promise.all([
      api.get('/demirbaslar'),
      api.get('/stok-seri-no', { params: { sahiplik_tipi: 'OZ_MAL' } }),
      api.get('/stok-kartlari'),
    ])
      .then(([d, e, k]) => { setDemirbaslar(d.data); setEkipmanlar(e.data); setStokKartlari(k.data); })
      .catch((err) => setHata(hataMesajiCikar(err)))
      .finally(() => setYukleniyor(false));
  }
  useEffect(yukle, []);

  const birlesikListe = [
    ...demirbaslar.map((d) => ({
      kaynak: 'DEMIRBAS', id: d.id, kategori: d.kategori, ad: d.ad,
      tanimlayici: d.tanimlayici_no, konum: d.konum, durum: d.durum,
      kiraci_unvan: d.kiraci_unvan, maliyet_try: Number(d.maliyet_try),
      maliyet_orijinal: d.maliyet_orijinal != null ? Number(d.maliyet_orijinal) : null,
      para_birimi: d.para_birimi || 'TRY',
      guncel_deger_try: d.guncel_deger_try != null ? Number(d.guncel_deger_try) : null,
      amortisman_orani: d.amortisman_orani,
      ham: d,
    })),
    ...ekipmanlar.map((u) => {
      const kart = stokKartlari.find((k) => k.id === u.stok_karti_id);
      return {
        kaynak: 'EKIPMAN', id: u.id, kategori: 'EKIPMAN', ad: kart ? `${kart.marka} ${kart.model}` : u.seri_no,
        tanimlayici: u.seri_no, konum: null, durum: u.durum,
        kiraci_unvan: null, maliyet_try: Number(u.toplam_maliyet_try || 0),
        ham: u,
      };
    }),
  ];

  const gosterilecekler = aramaMetni
    ? birlesikListe.filter((k) => `${k.ad} ${k.tanimlayici || ''}`.toLowerCase().includes(aramaMetni.toLowerCase()))
    : birlesikListe;

  const toplamDeger = birlesikListe
    .filter((k) => k.durum !== 'SATILDI' && k.durum !== 'HURDA')
    .reduce((acc, k) => acc + (k.kaynak === 'DEMIRBAS' ? (k.guncel_deger_try ?? k.maliyet_try) : k.maliyet_try), 0);

  function excelIndirYap() {
    const veri = birlesikListe.map((k) => ({
      'Kaynak': k.kaynak === 'EKIPMAN' ? 'Stok (Ekipman)' : 'Demirbaş',
      'Kategori': KATEGORI_METIN[k.kategori] || k.kategori,
      'Ad / Tanım': k.ad,
      'Tanımlayıcı No': k.tanimlayici || '',
      'Durum': DURUM_METIN[k.durum] || k.durum,
      'Kirada/Konum': k.kiraci_unvan || k.konum || '',
      'Maliyet (TL)': k.maliyet_try,
    }));
    excelIndir(veri, 'oz_mal_demirbas_listesi', 'Öz Mal');
  }

  function yeniAc() {
    setDuzenlenen(null);
    setFormAcik(true);
  }
  async function duzenle(kayit) {
    if (kayit.kaynak === 'EKIPMAN') {
      await ozelAlert("Bu bir ekipman kaydı (Stok modülünden geliyor) — düzenlemek için Stok sayfasını kullanın.");
      return;
    }
    setDuzenlenen(kayit.ham);
    setFormAcik(true);
  }
  async function satisiGeriAl(kayit) {
    if (!(await ozelOnayIste(`${kayit.ad} için satışı geri almak istediğinize emin misiniz? Kasaya/Bankaya işlenen tutar silinecek.`))) return;
    try {
      await api.put(`/demirbaslar/${kayit.id}/satisi-geri-al`);
      yukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  async function sil(kayit) {
    if (kayit.kaynak === 'EKIPMAN') {
      await ozelAlert("Bu bir ekipman kaydı (Stok modülünden geliyor) — silmek için Stok sayfasını kullanın.");
      return;
    }
    if (!(await ozelOnayIste(`${kayit.ad} demirbaşını silmek istediğinize emin misiniz?`))) return;
    try {
      await api.delete(`/demirbaslar/${kayit.id}`);
      yukle();
      geriAlBildirimGoster(`"${kayit.ad}" silindi.`, async () => {
        await api.put(`/demirbaslar/${kayit.id}/geri-getir`);
        yukle();
      });
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  return (
    <div>
      <SayfaBasligi
        baslik="Öz Mal / Demirbaş"
        aciklama="Şirket araçları, gayrimenkul, ofis ekipmanı ve kendi kullanımımız/kiralamamız için ayırdığımız ürünler — tek ekrandan takip"
        eylem={!formAcik && (
          <div style={{ display: 'flex', gap: 8 }}>
            <DahaFazlaMenu ogeler={[
              { etiket: 'Excel İndir', onClick: excelIndirYap },
              { etiket: "Excel'den İçe Aktar", onClick: () => setIceAktarAcik((a) => !a) },
            ]} />
            <Buton onClick={yeniAc}>+ Yeni Demirbaş</Buton>
          </div>
        )}
      />
      <HataMesaji>{hata}</HataMesaji>

      {iceAktarAcik && (
        <DemirbasIceAktarPaneli
          onKapat={() => setIceAktarAcik(false)}
          onTamamlandi={() => { setIceAktarAcik(false); yukle(); }}
        />
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Kart style={{ flex: '1 1 200px' }}>
          <div style={{ fontSize: 11.5, color: 'var(--metin-ikincil)', marginBottom: 4 }}>Toplam değer (elde bulunan)</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{paraFormat(toplamDeger)}</div>
        </Kart>
        <Kart style={{ flex: '1 1 200px' }}>
          <div style={{ fontSize: 11.5, color: 'var(--metin-ikincil)', marginBottom: 4 }}>Kalem sayısı</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{birlesikListe.length}</div>
        </Kart>
        <Kart style={{ flex: '1 1 200px' }}>
          <div style={{ fontSize: 11.5, color: 'var(--metin-ikincil)', marginBottom: 4 }}>Kirada olan</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{birlesikListe.filter((k) => k.durum === 'KIRADA').length}</div>
        </Kart>
      </div>

      {formAcik && (
        <DemirbasFormu
          duzenlenen={duzenlenen}
          cariler={cariler}
          onKaydedildi={() => { setFormAcik(false); setDuzenlenen(null); yukle(); }}
          onVazgec={() => { setFormAcik(false); setDuzenlenen(null); }}
        />
      )}

      <Kart style={{ padding: 0 }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--kenarlik)' }}>
          <input
            value={aramaMetni}
            onChange={(e) => setAramaMetni(e.target.value)}
            placeholder="Ad, plaka, tapu no ile ara..."
            style={{ ...girdiStili, maxWidth: 320 }}
          />
        </div>

        {yukleniyor ? (
          <div style={{ padding: 20, color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
        ) : gosterilecekler.length === 0 ? (
          <BosDurum baslik="Kayıt bulunamadı" aciklama="Yukarıdan yeni bir demirbaş ekleyin, ya da Stok sayfasından 'Öz Mal Ekle' ile ekipman kaydedin." />
        ) : (
          <table>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                <SiraliBaslik alanAdi="kategori" siralama={siralama}>Kategori</SiraliBaslik>
                <SiraliBaslik alanAdi="ad" siralama={siralama}>Ad / Tanım</SiraliBaslik>
                <SiraliBaslik alanAdi="tanimlayici" siralama={siralama}>Tanımlayıcı No</SiraliBaslik>
                <SiraliBaslik alanAdi="durum" siralama={siralama}>Durum</SiraliBaslik>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>Kirada/Konum</th>
                <SiraliBaslik alanAdi="maliyet_try" siralama={siralama}>Maliyet</SiraliBaslik>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>Güncel Değer</th>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>Kaynak</th>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {siralama.sirala(gosterilecekler, (item, alan) => item[alan]).map((k) => (
                <Fragment key={`${k.kaynak}-${k.id}`}>
                  <tr style={{ borderTop: '1px solid var(--kenarlik)' }}>
                    <td style={{ padding: '12px 16px', color: 'var(--metin-ikincil)' }}>{KATEGORI_METIN[k.kategori] || k.kategori}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 500 }}>{k.ad}</td>
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', color: 'var(--metin-ikincil)' }}>{k.tanimlayici || '—'}</td>
                    <td style={{ padding: '12px 16px' }}><Etiket ton={DURUM_TON[k.durum] || 'notr'}>{DURUM_METIN[k.durum] || k.durum}</Etiket></td>
                    <td style={{ padding: '12px 16px', color: 'var(--metin-ikincil)' }}>{k.kiraci_unvan || k.konum || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {paraFormat(k.maliyet_try)}
                      {k.para_birimi && k.para_birimi !== 'TRY' && k.maliyet_orijinal != null && (
                        <div style={{ fontSize: 11, color: 'var(--metin-ikincil)' }}>
                          ({paraFormat(k.maliyet_orijinal, k.para_birimi)} girildi)
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {k.kaynak === 'DEMIRBAS' ? (
                        <>
                          {paraFormat(k.guncel_deger_try ?? k.maliyet_try)}
                          {k.amortisman_orani > 0 && (
                            <div style={{ fontSize: 11, color: 'var(--metin-ikincil)' }}>(yıllık %{k.amortisman_orani} amortisman)</div>
                          )}
                        </>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Etiket ton={k.kaynak === 'EKIPMAN' ? 'amber' : 'notr'}>{k.kaynak === 'EKIPMAN' ? 'Stok (Ekipman)' : 'Demirbaş'}</Etiket>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => duzenle(k)} style={eylemChipStili('lacivert')}>Düzenle</button>
                        {k.kaynak === 'DEMIRBAS' && k.durum !== 'SATILDI' && k.durum !== 'HURDA' && (
                          <button onClick={() => setSatisAcikId(k.id)} style={eylemChipStili('yesil')}>Sat</button>
                        )}
                        {k.kaynak === 'DEMIRBAS' && k.durum === 'SATILDI' ? (
                          <button onClick={() => satisiGeriAl(k)} style={eylemChipStili('kirmizi')}>Satışı Geri Al</button>
                        ) : (
                          <button onClick={() => sil(k)} style={eylemChipStili('kirmizi')}>Sil</button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {satisAcikId === k.id && k.kaynak === 'DEMIRBAS' && (
                    <DemirbasSatisFormu
                      demirbas={k.ham}
                      onKaydedildi={() => { setSatisAcikId(null); yukle(); }}
                      onVazgec={() => setSatisAcikId(null)}
                    />
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
