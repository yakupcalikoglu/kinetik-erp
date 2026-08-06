import { useEffect, useState, Fragment } from 'react';
import * as XLSX from 'xlsx';
import { api, hataMesajiCikar, ozelOnayIste } from '../api/client';
import { excelIndir } from '../utils/disaAktarma';
import {
  Kart, SayfaBasligi, Buton, Etiket, Alan, girdiStili, BosDurum, HataMesaji, paraFormat, eylemChipStili, ParaGirdisi,
  useKademelıGoster, DahaFazlaGosterButonu, DahaFazlaMenu, TabloIskeleti,
} from '../components/Ortak';
import { useNavigate, useLocation } from 'react-router-dom';
import AramaliSecici from '../components/AramaliSecici';

// Herhangi bir listeyi bir sutuna gore tiklanabilir sekilde siralamak icin
// paylasilan kucuk yardimci - butun sayfalarda ayni sekilde kullanilir.
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

// Tiklanabilir, siralama okunu gosteren <th> basligi.
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

const TIP_ETIKET = {
  MUSTERI: { metin: 'Müşteri', ton: 'yesil' },
  TEDARIKCI: { metin: 'Tedarikçi', ton: 'amber' },
  PERSONEL: { metin: 'Personel', ton: 'notr' },
  ORTAK: { metin: 'Ortak', ton: 'notr' },
  DIGER: { metin: 'Diğer', ton: 'notr' },
};

function KaynakDetayi({ kaynakTablo, kaynakId }) {
  const [detay, setDetay] = useState(null);
  const [hata, setHata] = useState(null);

  useEffect(() => {
    api.get(`/kaynak-detay/${kaynakTablo}/${kaynakId}`)
      .then((r) => setDetay(r.data))
      .catch((e) => setHata(hataMesajiCikar(e)));
  }, [kaynakTablo, kaynakId]);

  if (hata) return <div style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--kirmizi)' }}>{hata}</div>;
  if (!detay) return <div style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--metin-soluk)' }}>Yükleniyor...</div>;

  return (
    <div style={{ padding: '12px 16px', background: 'var(--zemin)', fontSize: 13 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{detay.baslik}</div>
      {detay.detaylar.map(([etiket, deger]) => (
        <div key={etiket} style={{ display: 'flex', gap: 8, color: 'var(--metin-ikincil)' }}>
          <span style={{ minWidth: 130 }}>{etiket}:</span>
          <span style={{ color: 'var(--metin-birincil)' }}>{deger}</span>
        </div>
      ))}
    </div>
  );
}

const ALAN_ESLESTIRME = {
  unvan: ['unvan', 'firma adı', 'firma adi', 'ad soyad', 'adı', 'cari adı', 'cari adi', 'müşteri adı', 'tedarikçi adı', 'ünvan'],
  tip: ['tip', 'cari tipi', 'tür'],
  vergi_no: ['vergi no', 'vergi kimlik no', 'vkn', 'tc kimlik no', 'tc no', 'tckn'],
  vergi_dairesi: ['vergi dairesi'],
  telefon: ['telefon', 'tel', 'telefon no', 'cep telefonu', 'gsm'],
  adres: ['adres'],
  email: ['e-posta', 'email', 'e-mail', 'mail'],
};

function normallestir(s) {
  return (s || '').toString().trim().toLocaleLowerCase('tr');
}

function sutunEslestir(basliklar) {
  const harita = {};
  for (const [alan, adaylar] of Object.entries(ALAN_ESLESTIRME)) {
    const bulunan = basliklar.find((b) => adaylar.includes(normallestir(b)));
    if (bulunan) harita[alan] = bulunan;
  }
  return harita;
}

function IceAktarPaneli({ onKapat, onTamamlandi }) {
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
        if (veri.length === 0) {
          setHata('Dosyada veri bulunamadı.');
          return;
        }
        const basliklar = Object.keys(veri[0]);
        const harita = sutunEslestir(basliklar);
        if (!harita.unvan) {
          setHata("Unvan/Firma Adı sütunu bulunamadı. Excel dosyasında bu bilgiyi içeren bir sütun olmalı (örn. 'Unvan', 'Firma Adı', 'Cari Adı').");
          return;
        }
        const donusturulmus = veri
          .map((satir) => ({
            unvan: String(satir[harita.unvan] || '').trim(),
            tip: harita.tip ? String(satir[harita.tip] || 'DIGER').toUpperCase() : 'DIGER',
            vergi_no: harita.vergi_no ? String(satir[harita.vergi_no] || '').trim() : '',
            vergi_dairesi: harita.vergi_dairesi ? String(satir[harita.vergi_dairesi] || '').trim() : '',
            telefon: harita.telefon ? String(satir[harita.telefon] || '').trim() : '',
            adres: harita.adres ? String(satir[harita.adres] || '').trim() : '',
            email: harita.email ? String(satir[harita.email] || '').trim() : '',
          }))
          .filter((s) => s.unvan);
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
      const gecerliTipler = ['MUSTERI', 'TEDARIKCI', 'PERSONEL', 'ORTAK', 'DIGER'];
      const { data } = await api.post('/cariler/toplu-ice-aktar', {
        satirlar: satirlar.map((s) => ({
          tip: gecerliTipler.includes(s.tip) ? s.tip : 'DIGER',
          unvan: s.unvan,
          vergi_no: s.vergi_no || null,
          vergi_dairesi: s.vergi_dairesi || null,
          telefon: s.telefon || null,
          adres: s.adres || null,
          email: s.email || null,
        })),
      });
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
        <div style={{ fontSize: 14.5, fontWeight: 600 }}>Excel'den Cari İçe Aktar</div>
        <Buton variant="ikincil" onClick={onKapat}>Kapat</Buton>
      </div>
      <HataMesaji>{hata}</HataMesaji>

      <div style={{ fontSize: 12.5, color: 'var(--metin-ikincil)', marginBottom: 12 }}>
        Excel dosyanızda (herhangi bir sütun sırasıyla) şunlar bulunmalı: <strong>Unvan</strong> (zorunlu),
        Tip (Müşteri/Tedarikçi/Personel/Ortak — boşsa "Diğer" yapılır), Vergi No, Vergi Dairesi, Telefon, Adres, E-posta.
        Akınsoft Wolvox gibi başka bir sistemden Excel'e aktardığınız cari listesini doğrudan yükleyebilirsiniz.
        {' '}
        <button
          type="button"
          onClick={() => excelIndir(
            [{ 'Unvan': 'Örnek A.Ş.', 'Tip': 'Müşteri', 'Vergi No': '1234567890', 'Vergi Dairesi': 'Kadıköy', 'Telefon': '05551234567', 'Adres': 'Örnek Mah. No:1 İstanbul', 'E-posta': 'ornek@firma.com' }],
            'cari_sablon', 'Cari Şablonu',
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
                {['Unvan', 'Tip', 'Vergi No', 'Telefon'].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 12, color: 'var(--metin-ikincil)' }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {satirlar.slice(0, 10).map((s, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                  <td style={{ padding: '6px 10px' }}>{s.unvan}</td>
                  <td style={{ padding: '6px 10px' }}>{s.tip}</td>
                  <td style={{ padding: '6px 10px' }}>{s.vergi_no || '—'}</td>
                  <td style={{ padding: '6px 10px' }}>{s.telefon || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Buton onClick={iceAktar} disabled={yukleniyor}>{yukleniyor ? 'İçe aktarılıyor...' : `${satirlar.length} kaydı içe aktar`}</Buton>
        </>
      )}

      {sonuc && (
        <div style={{ marginTop: 12 }}>
          <div style={{ color: 'var(--yesil)', fontWeight: 600, marginBottom: 8 }}>
            ✓ {sonuc.basarili_sayisi} kayıt başarıyla eklendi.
          </div>
          {sonuc.hatali_satirlar.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: 'var(--kirmizi)', fontWeight: 600, marginBottom: 6 }}>
                ✗ {sonuc.hatali_satirlar.length} satırda hata oluştu:
              </div>
              <ul style={{ fontSize: 12.5, color: 'var(--metin-ikincil)' }}>
                {sonuc.hatali_satirlar.map((h) => (
                  <li key={h.satir_no}>Satır {h.satir_no} ({h.unvan}): {h.hata}</li>
                ))}
              </ul>
            </div>
          )}
          <Buton onClick={onTamamlandi}>Kapat ve listeyi yenile</Buton>
        </div>
      )}
    </Kart>
  );
}

function CariFormu({ duzenlenenCari, onKaydedildi, onVazgec }) {
  const duzenlemeModu = !!duzenlenenCari;
  const [form, setForm] = useState(() => duzenlenenCari
    ? {
        tip: duzenlenenCari.tip,
        vergi_no: duzenlenenCari.vergi_no || '',
        unvan: duzenlenenCari.unvan || '',
        vergi_dairesi: duzenlenenCari.vergi_dairesi || '',
        adres: duzenlenenCari.adres || '',
        telefon: duzenlenenCari.telefon || '',
        email: duzenlenenCari.email || '',
        sifre: '',
      }
    : { tip: 'TEDARIKCI', vergi_no: '', unvan: '', vergi_dairesi: '', adres: '', telefon: '', email: '' }
  );
  const [sorgulaniyor, setSorgulaniyor] = useState(false);
  const [sorguSonucu, setSorguSonucu] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [hata, setHata] = useState(null);

  function alaniGuncelle(alan, deger) {
    setForm((f) => ({ ...f, [alan]: deger }));
  }

  async function vergiNoSorgula() {
    if (!form.vergi_no.trim()) return;
    setSorgulaniyor(true);
    setSorguSonucu(null);
    setHata(null);
    try {
      const { data } = await api.post('/cariler/vergi-no-sorgula', { vergi_no: form.vergi_no });
      setSorguSonucu(data);
      if (data.bulundu) {
        setForm((f) => ({
          ...f,
          unvan: data.unvan ?? f.unvan,
          vergi_dairesi: data.vergi_dairesi ?? f.vergi_dairesi,
          adres: data.adres ?? f.adres,
          telefon: data.telefon ?? f.telefon,
        }));
      }
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setSorgulaniyor(false);
    }
  }

  async function kaydet(e) {
    e.preventDefault();
    setKaydediliyor(true);
    setHata(null);
    try {
      if (duzenlemeModu) {
        await api.put(`/cariler/${duzenlenenCari.id}`, form);
      } else {
        await api.post('/cariler', { ...form, otomatik_dolduruldu: !!sorguSonucu?.bulundu });
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
        <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 16 }}>
          {duzenlemeModu ? `Cariyi düzenle — ${duzenlenenCari.unvan}` : 'Yeni cari kartı'}
        </div>
        <HataMesaji>{hata}</HataMesaji>

        <Alan etiket="Cari tipi">
          <select value={form.tip} onChange={(e) => alaniGuncelle('tip', e.target.value)} style={girdiStili}>
            <option value="TEDARIKCI">Tedarikçi</option>
            <option value="MUSTERI">Müşteri</option>
            <option value="PERSONEL">Personel</option>
            <option value="ORTAK">Ortak</option>
            <option value="DIGER">Diğer</option>
          </select>
        </Alan>

        <Alan etiket="Vergi no / TC kimlik no">
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={form.vergi_no}
              onChange={(e) => alaniGuncelle('vergi_no', e.target.value)}
              placeholder="1234567890"
              style={girdiStili}
            />
            {!duzenlemeModu && (
              <Buton type="button" variant="ikincil" onClick={vergiNoSorgula} disabled={sorgulaniyor}>
                {sorgulaniyor ? 'Sorgulanıyor...' : 'Sorgula'}
              </Buton>
            )}
          </div>
          {sorguSonucu && (
            <div style={{ marginTop: 6 }}>
              {sorguSonucu.bulundu
                ? <Etiket ton="yesil">Bulundu — bilgiler otomatik dolduruldu</Etiket>
                : <Etiket ton="amber">Bulunamadı — bilgileri elle girin (yurt dışı tedarikçilerde normaldir)</Etiket>}
            </div>
          )}
        </Alan>

        <Alan etiket="Unvan">
          <input
            required
            value={form.unvan}
            onChange={(e) => alaniGuncelle('unvan', e.target.value)}
            style={girdiStili}
          />
        </Alan>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Alan etiket="Vergi dairesi">
              <input
                value={form.vergi_dairesi}
                onChange={(e) => alaniGuncelle('vergi_dairesi', e.target.value)}
                style={girdiStili}
              />
            </Alan>
          </div>
          <div style={{ flex: 1 }}>
            <Alan etiket="Telefon">
              <input
                value={form.telefon}
                onChange={(e) => alaniGuncelle('telefon', e.target.value)}
                style={girdiStili}
              />
            </Alan>
          </div>
        </div>

        <Alan etiket="Adres">
          <input
            value={form.adres}
            onChange={(e) => alaniGuncelle('adres', e.target.value)}
            style={girdiStili}
          />
        </Alan>

        <Alan etiket="E-posta">
          <input
            type="email"
            value={form.email}
            onChange={(e) => alaniGuncelle('email', e.target.value)}
            style={girdiStili}
          />
        </Alan>

        {duzenlemeModu && (
          <Alan etiket="Şifreniz (onay için zorunlu)">
            <input
              required
              type="password"
              value={form.sifre}
              onChange={(e) => alaniGuncelle('sifre', e.target.value)}
              style={girdiStili}
              placeholder="Giriş şifreniz"
            />
          </Alan>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <Buton type="submit" disabled={kaydediliyor}>
            {kaydediliyor ? 'Kaydediliyor...' : duzenlemeModu ? 'Değişiklikleri kaydet' : 'Cariyi kaydet'}
          </Buton>
          <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
        </div>
      </form>
    </Kart>
  );
}

const HAREKET_YON_METIN = { GIRIS: 'Giriş', CIKIS: 'Çıkış' };

const CARI_TIP_METIN = { MUSTERI: 'Müşteri', TEDARIKCI: 'Tedarikçi', DIGER: 'Diğer' };

function CariBilgileriKarti({ cari }) {
  return (
    <Kart style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>{cari.unvan}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, fontSize: 12.5 }}>
        <div>
          <div style={{ color: 'var(--metin-ikincil)', marginBottom: 2 }}>Tip</div>
          <div>{CARI_TIP_METIN[cari.tip] || cari.tip}</div>
        </div>
        <div>
          <div style={{ color: 'var(--metin-ikincil)', marginBottom: 2 }}>Vergi No</div>
          <div>{cari.vergi_no || '—'}</div>
        </div>
        <div>
          <div style={{ color: 'var(--metin-ikincil)', marginBottom: 2 }}>Vergi Dairesi</div>
          <div>{cari.vergi_dairesi || '—'}</div>
        </div>
        <div>
          <div style={{ color: 'var(--metin-ikincil)', marginBottom: 2 }}>Telefon</div>
          <div>{cari.telefon || '—'}</div>
        </div>
        <div>
          <div style={{ color: 'var(--metin-ikincil)', marginBottom: 2 }}>E-posta</div>
          <div>{cari.email || '—'}</div>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={{ color: 'var(--metin-ikincil)', marginBottom: 2 }}>Adres</div>
          <div>{cari.adres || '—'}</div>
        </div>
      </div>
    </Kart>
  );
}

function AlimMiniFormu({ cari, onTamamlandi, onVazgec }) {
  const [stokKartlari, setStokKartlari] = useState([]);
  const [form, setForm] = useState({
    siparis_no: '', stok_karti_id: '', miktar: 1, birim_fiyat: '', para_birimi: 'TRY',
    kaynak: 'YURTICI_ALIM', siparis_tarihi: new Date().toISOString().slice(0, 10),
  });
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => {
    api.get('/stok-kartlari').then((r) => setStokKartlari(r.data)).catch(() => {});
  }, []);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      await api.post('/siparisler', {
        siparis_no: form.siparis_no, tedarikci_cari_id: cari.id, kaynak: form.kaynak,
        siparis_tarihi: form.siparis_tarihi, para_birimi: form.para_birimi,
        urunler: [{
          stok_karti_id: Number(form.stok_karti_id), miktar: Number(form.miktar),
          birim_fiyat: Number(form.birim_fiyat), para_birimi: form.para_birimi,
        }],
      });
      onTamamlandi();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  return (
    <div style={{ padding: 14, background: 'var(--zemin)', borderRadius: 8, marginTop: 10 }}>
      <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>Yeni Alım (Sipariş) — {cari.unvan}</div>
      <HataMesaji>{hata}</HataMesaji>
      <form onSubmit={kaydet} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Alan etiket="Sipariş no">
          <input required value={form.siparis_no} onChange={(e) => setForm((f) => ({ ...f, siparis_no: e.target.value }))} placeholder="SIP-2026-001" style={girdiStili} />
        </Alan>
        <Alan etiket="Kaynak">
          <select value={form.kaynak} onChange={(e) => setForm((f) => ({ ...f, kaynak: e.target.value }))} style={girdiStili}>
            <option value="YURTICI_ALIM">Yurtiçi Alım</option>
            <option value="ITHALAT">İthalat</option>
          </select>
        </Alan>
        <Alan etiket="Ürün tanımı">
          <select required value={form.stok_karti_id} onChange={(e) => setForm((f) => ({ ...f, stok_karti_id: e.target.value }))} style={girdiStili}>
            <option value="">Seçin...</option>
            {stokKartlari.map((k) => <option key={k.id} value={k.id}>{k.marka} {k.model}</option>)}
          </select>
        </Alan>
        <Alan etiket="Miktar">
          <input required type="number" min="1" value={form.miktar} onChange={(e) => setForm((f) => ({ ...f, miktar: e.target.value }))} style={girdiStili} />
        </Alan>
        <Alan etiket="Birim fiyat">
          <div style={{ display: 'flex', gap: 6 }}>
            <ParaGirdisi required value={form.birim_fiyat} onChange={(v) => setForm((f) => ({ ...f, birim_fiyat: v }))} style={{ flex: 1 }} />
            <select value={form.para_birimi} onChange={(e) => setForm((f) => ({ ...f, para_birimi: e.target.value }))} style={{ ...girdiStili, width: 80 }}>
              <option value="TRY">TL</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
        </Alan>
        <Alan etiket="Sipariş tarihi">
          <input required type="date" value={form.siparis_tarihi} onChange={(e) => setForm((f) => ({ ...f, siparis_tarihi: e.target.value }))} style={girdiStili} />
        </Alan>
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
          <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : 'Siparişi Oluştur'}</Buton>
          <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
        </div>
      </form>
      <div style={{ fontSize: 11.5, color: 'var(--metin-ikincil)', marginTop: 8 }}>
        Not: Çok kalemli/karmaşık siparişler için Siparişler sayfasını kullanın. Teslim alma ve ödeme takibi de oradan yapılır.
      </div>
    </div>
  );
}

function CariOzetKarti({ cari, onKapat }) {
  const [ozet, setOzet] = useState(null);
  const [hata, setHata] = useState(null);
  const [detayAcik, setDetayAcik] = useState(false);

  useEffect(() => {
    api.get(`/cariler/${cari.id}/ozet`).then((r) => setOzet(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }, [cari.id]);

  if (hata) return <Kart style={{ marginBottom: 16 }}><HataMesaji>{hata}</HataMesaji></Kart>;

  return (
    <Kart style={{ marginBottom: 16, border: '1px solid var(--lacivert)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{cari.unvan} — Alacak/Borç Özeti</div>
        {onKapat && <Buton variant="ikincil" onClick={onKapat}>Kapat</Buton>}
      </div>
      {!ozet ? (
        <div style={{ color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 24, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--metin-ikincil)' }}>Toplam Alacağımız</div>
              <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--yesil)' }}>{paraFormat(ozet.toplam_alacak_try)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--metin-ikincil)' }}>Toplam Borcumuz</div>
              <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--kirmizi)' }}>{paraFormat(ozet.toplam_borc_try)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--metin-ikincil)' }}>Net</div>
              <div style={{ fontSize: 19, fontWeight: 700, color: Number(ozet.net_try) >= 0 ? 'var(--yesil)' : 'var(--kirmizi)' }}>
                {paraFormat(ozet.net_try)} {Number(ozet.net_try) >= 0 ? '(bize borçlu)' : '(biz borçluyuz)'}
              </div>
            </div>
          </div>
          <span onClick={() => setDetayAcik((a) => !a)} style={{ fontSize: 12.5, color: 'var(--lacivert)', cursor: 'pointer', textDecoration: 'underline' }}>
            {detayAcik ? 'Detayı gizle' : 'Kalem kalem detayı göster'}
          </span>
          {detayAcik && (
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--yesil)' }}>Alacaklar</div>
                {ozet.alacaklar.filter((a) => Number(a.tutar_try) > 0).length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--metin-soluk)' }}>Yok</div>
                ) : ozet.alacaklar.filter((a) => Number(a.tutar_try) > 0).map((a) => (
                  <div key={a.kategori} style={{ fontSize: 12.5, display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                    <span style={{ color: 'var(--metin-ikincil)' }}>{a.kategori}</span>
                    <span>{paraFormat(a.tutar_try)}</span>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--kirmizi)' }}>Borçlar</div>
                {ozet.borclar.filter((b) => Number(b.tutar_try) > 0).length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--metin-soluk)' }}>Yok</div>
                ) : ozet.borclar.filter((b) => Number(b.tutar_try) > 0).map((b) => (
                  <div key={b.kategori} style={{ fontSize: 12.5, display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                    <span style={{ color: 'var(--metin-ikincil)' }}>{b.kategori}</span>
                    <span>{paraFormat(b.tutar_try)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Kart>
  );
}

function SatisMiniFormu({ cari, onTamamlandi, onVazgec }) {
  const [stokKartlari, setStokKartlari] = useState([]);
  const [urunler, setUrunler] = useState([]);
  const [bankaHesaplari, setBankaHesaplari] = useState([]);
  const [form, setForm] = useState({
    stok_karti_id: '', stok_seri_no_id: '', satis_fiyati_try: '',
    tarih: new Date().toISOString().slice(0, 10), odeme_yontemi: 'NAKIT', banka_hesap_id: '',
  });
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => {
    api.get('/stok-kartlari').then((r) => setStokKartlari(r.data)).catch(() => {});
    api.get('/banka-bakiyeleri').then((r) => setBankaHesaplari(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.stok_karti_id) { setUrunler([]); return; }
    Promise.all([
      api.get('/stok-seri-no', { params: { durum: 'DEPODA', stok_karti_id: form.stok_karti_id } }),
      api.get('/stok-seri-no', { params: { durum: 'ANTREPODA', stok_karti_id: form.stok_karti_id } }),
    ]).then(([a, b]) => setUrunler([...a.data, ...b.data])).catch(() => {});
  }, [form.stok_karti_id]);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    if (!form.stok_seri_no_id) { setHata('Lütfen satılacak ürünü (seri no) seçin.'); return; }
    setKaydediliyor(true);
    try {
      await api.post(`/stok-seri-no/${form.stok_seri_no_id}/satis`, {
        musteri_cari_id: cari.id, satis_fiyati_try: Number(form.satis_fiyati_try),
        satis_tarihi: form.tarih, odeme_yontemi: form.odeme_yontemi,
        banka_hesap_id: form.odeme_yontemi === 'BANKA' ? Number(form.banka_hesap_id) : null,
      });
      onTamamlandi();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  return (
    <div style={{ padding: 14, background: 'var(--zemin)', borderRadius: 8, marginTop: 10 }}>
      <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>Yeni Satış — {cari.unvan}</div>
      <HataMesaji>{hata}</HataMesaji>
      <form onSubmit={kaydet} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Alan etiket="Ürün tanımı">
          <select required value={form.stok_karti_id} onChange={(e) => setForm((f) => ({ ...f, stok_karti_id: e.target.value, stok_seri_no_id: '' }))} style={girdiStili}>
            <option value="">Seçin...</option>
            {stokKartlari.map((k) => <option key={k.id} value={k.id}>{k.marka} {k.model}</option>)}
          </select>
        </Alan>
        <Alan etiket="Seri no (Depoda/Antrepoda)">
          <select required value={form.stok_seri_no_id} onChange={(e) => setForm((f) => ({ ...f, stok_seri_no_id: e.target.value }))} style={girdiStili}>
            <option value="">Seçin...</option>
            {urunler.map((u) => <option key={u.id} value={u.id}>{u.seri_no}</option>)}
          </select>
          {form.stok_karti_id && urunler.length === 0 && (
            <div style={{ fontSize: 11.5, color: 'var(--kirmizi)', marginTop: 4 }}>Bu ürün tanımından Depoda/Antrepoda hazır ürün yok.</div>
          )}
        </Alan>
        <Alan etiket="Satış fiyatı (TL)">
          <ParaGirdisi required value={form.satis_fiyati_try} onChange={(v) => setForm((f) => ({ ...f, satis_fiyati_try: v }))} />
        </Alan>
        <Alan etiket="Tarih">
          <input required type="date" value={form.tarih} onChange={(e) => setForm((f) => ({ ...f, tarih: e.target.value }))} style={girdiStili} />
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
              {bankaHesaplari.map((h) => <option key={h.banka_hesap_id} value={h.banka_hesap_id}>{h.banka_adi} — {h.hesap_adi || h.para_birimi}</option>)}
            </select>
          </Alan>
        )}
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
          <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : 'Satışı Kaydet'}</Buton>
          <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
        </div>
      </form>
      <div style={{ fontSize: 11.5, color: 'var(--metin-ikincil)', marginTop: 8 }}>
        Not: Taksitli/Çek/Leasing gibi ödeme türleri için Stok sayfasındaki "Satış Yap" ekranını kullanın.
      </div>
    </div>
  );
}

function KiralamaMiniFormu({ cari, onTamamlandi, onVazgec }) {
  const [stokKartlari, setStokKartlari] = useState([]);
  const [urunler, setUrunler] = useState([]);
  const [form, setForm] = useState({
    stok_karti_id: '', stok_seri_no_id: '', aylik_kira_tutari: '', para_birimi: 'TRY', referans_kur: '1',
    baslangic_tarihi: new Date().toISOString().slice(0, 10),
  });
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => {
    api.get('/stok-kartlari').then((r) => setStokKartlari(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (form.para_birimi === 'TRY') return;
    api.get(`/kur/${form.para_birimi}`).then((r) => setForm((f) => ({ ...f, referans_kur: String(r.data.kur) }))).catch(() => {});
  }, [form.para_birimi]); // eslint-disable-line

  useEffect(() => {
    if (!form.stok_karti_id) { setUrunler([]); return; }
    api.get('/stok-seri-no', { params: { stok_karti_id: form.stok_karti_id } }).then((r) => setUrunler(r.data)).catch(() => {});
  }, [form.stok_karti_id]);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    if (!form.stok_karti_id) { setHata('Lütfen bir ürün tanımı seçin.'); return; }
    setKaydediliyor(true);
    try {
      await api.post('/kiralama-sozlesmeleri', {
        kiraci_cari_id: cari.id, baslangic_tarihi: form.baslangic_tarihi, para_birimi: form.para_birimi,
        referans_kur: Number(form.referans_kur || 1), depozito: 0,
        kalemler: [{
          stok_karti_id: Number(form.stok_karti_id), miktar: 1, birim_fiyat: Number(form.aylik_kira_tutari),
          stok_seri_no_idleri: form.stok_seri_no_id ? [Number(form.stok_seri_no_id)] : [],
        }],
      });
      onTamamlandi();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  return (
    <div style={{ padding: 14, background: 'var(--zemin)', borderRadius: 8, marginTop: 10 }}>
      <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>Yeni Kiralama — {cari.unvan}</div>
      <HataMesaji>{hata}</HataMesaji>
      <form onSubmit={kaydet} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Alan etiket="Ürün tanımı">
          <select required value={form.stok_karti_id} onChange={(e) => setForm((f) => ({ ...f, stok_karti_id: e.target.value, stok_seri_no_id: '' }))} style={girdiStili}>
            <option value="">Seçin...</option>
            {stokKartlari.map((k) => <option key={k.id} value={k.id}>{k.marka} {k.model}</option>)}
          </select>
        </Alan>
        <Alan etiket="Seri no (opsiyonel — hangi ürün kirada)">
          <select value={form.stok_seri_no_id} onChange={(e) => setForm((f) => ({ ...f, stok_seri_no_id: e.target.value }))} style={girdiStili}>
            <option value="">Belirtilmesin</option>
            {urunler.map((u) => <option key={u.id} value={u.id}>{u.seri_no} ({u.durum})</option>)}
          </select>
        </Alan>
        <Alan etiket="Aylık kira tutarı">
          <div style={{ display: 'flex', gap: 6 }}>
            <ParaGirdisi required value={form.aylik_kira_tutari} onChange={(v) => setForm((f) => ({ ...f, aylik_kira_tutari: v }))} style={{ flex: 1 }} />
            <select value={form.para_birimi} onChange={(e) => setForm((f) => ({ ...f, para_birimi: e.target.value }))} style={{ ...girdiStili, width: 80 }}>
              <option value="TRY">TL</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
        </Alan>
        {form.para_birimi !== 'TRY' && (
          <Alan etiket={`Referans kur (${form.para_birimi} → TL)`}>
            <input type="number" step="0.0001" value={form.referans_kur} onChange={(e) => setForm((f) => ({ ...f, referans_kur: e.target.value }))} style={girdiStili} />
          </Alan>
        )}
        <Alan etiket="Başlangıç tarihi">
          <input required type="date" value={form.baslangic_tarihi} onChange={(e) => setForm((f) => ({ ...f, baslangic_tarihi: e.target.value }))} style={girdiStili} />
        </Alan>
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
          <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : 'Sözleşmeyi Oluştur'}</Buton>
          <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
        </div>
      </form>
    </div>
  );
}

function BakimMiniFormu({ cari, onTamamlandi, onVazgec }) {
  const [urunler, setUrunler] = useState([]);
  const [bankaHesaplari, setBankaHesaplari] = useState([]);
  const [form, setForm] = useState({
    stok_seri_no_id: '', tip: 'GELIR', tutar: '', tarih: new Date().toISOString().slice(0, 10),
    aciklama: '', odeme_yontemi: 'NAKIT', banka_hesap_id: '',
  });
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/stok-seri-no'), api.get('/stok-kartlari'), api.get('/banka-bakiyeleri')])
      .then(([u, k, b]) => {
        const kartHar = {};
        k.data.forEach((kart) => { kartHar[kart.id] = kart; });
        setUrunler(u.data.map((urun) => ({
          ...urun,
          etiket: kartHar[urun.stok_karti_id] ? `${kartHar[urun.stok_karti_id].marka} ${kartHar[urun.stok_karti_id].model} (${urun.seri_no})` : urun.seri_no,
        })));
        setBankaHesaplari(b.data);
      }).catch(() => {});
  }, []);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    if (!form.stok_seri_no_id) { setHata('Lütfen ürünü seçin.'); return; }
    setKaydediliyor(true);
    try {
      await api.post('/bakim-kayitlari', {
        stok_seri_no_id: Number(form.stok_seri_no_id), tarih: form.tarih, tip: form.tip,
        aciklama: form.aciklama || null, ilgili_cari_id: cari.id, tutar: Number(form.tutar),
        para_birimi: 'TRY', odeme_yontemi: form.odeme_yontemi,
        banka_hesap_id: form.odeme_yontemi === 'BANKA' ? Number(form.banka_hesap_id) : null,
      });
      onTamamlandi();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  return (
    <div style={{ padding: 14, background: 'var(--zemin)', borderRadius: 8, marginTop: 10 }}>
      <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>Yeni Bakım Kaydı — {cari.unvan}</div>
      <HataMesaji>{hata}</HataMesaji>
      <form onSubmit={kaydet} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Alan etiket="Ürün">
          <AramaliSecici secenekler={urunler} deger={form.stok_seri_no_id} onDegistir={(v) => setForm((f) => ({ ...f, stok_seri_no_id: v }))} etiketFn={(u) => u.etiket} />
        </Alan>
        <Alan etiket="Tip">
          <select value={form.tip} onChange={(e) => setForm((f) => ({ ...f, tip: e.target.value }))} style={girdiStili}>
            <option value="GELIR">Gelir (bizim aldığımız ücret)</option>
            <option value="GIDER">Gider (bizim ödediğimiz masraf)</option>
          </select>
        </Alan>
        <Alan etiket="Tutar (TL)">
          <ParaGirdisi required value={form.tutar} onChange={(v) => setForm((f) => ({ ...f, tutar: v }))} />
        </Alan>
        <Alan etiket="Tarih">
          <input required type="date" value={form.tarih} onChange={(e) => setForm((f) => ({ ...f, tarih: e.target.value }))} style={girdiStili} />
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
              {bankaHesaplari.map((h) => <option key={h.banka_hesap_id} value={h.banka_hesap_id}>{h.banka_adi} — {h.hesap_adi || h.para_birimi}</option>)}
            </select>
          </Alan>
        )}
        <Alan etiket="Açıklama">
          <input value={form.aciklama} onChange={(e) => setForm((f) => ({ ...f, aciklama: e.target.value }))} style={girdiStili} />
        </Alan>
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
          <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : 'Bakım Kaydını Ekle'}</Buton>
          <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
        </div>
      </form>
    </div>
  );
}

const HAREKET_TUR_METIN = { SATIS: 'Satış', KIRALAMA: 'Kiralama', BAKIM: 'Bakım', TAKSITLI_SATIS: 'Taksitli Satış', CEK: 'Çek', SIPARIS: 'Sipariş', TEDARIKCI_FATURA: 'Tedarikçi Faturası' };
const HAREKET_TUR_TON = { SATIS: 'yesil', KIRALAMA: 'amber', BAKIM: 'notr', TAKSITLI_SATIS: 'amber', CEK: 'notr', SIPARIS: 'notr', TEDARIKCI_FATURA: 'kirmizi' };

const CARI_HAREKET_YOL_HARITASI = {
  STOK_SATIS: '/stok',
  KIRALAMA_SOZLESME: '/finansal?sekme=kiralama',
  BAKIM_KAYDI: '/finansal?sekme=bakim',
  TAKSITLI_SATIS_PLANI: '/finansal?sekme=taksit',
  CEKLER: '/finansal?sekme=cek',
  SIPARIS: '/siparisler',
  TEDARIKCI_FATURA: '/tedarikci-faturalari',
};

function CariHareketleri({ cari, onKapat }) {
  const [hareketler, setHareketler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(null);
  const [yeniHareketTipi, setYeniHareketTipi] = useState(null);
  const navigate = useNavigate();

  function yukle() {
    setYukleniyor(true);
    api.get(`/cariler/${cari.id}/tum-hareketler`)
      .then((r) => setHareketler(r.data))
      .catch((e) => setHata(hataMesajiCikar(e)))
      .finally(() => setYukleniyor(false));
  }
  useEffect(yukle, [cari.id]); // eslint-disable-line

  function tamamlandi() {
    setYeniHareketTipi(null);
    yukle();
  }

  return (
    <Kart style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{cari.unvan} — hareket geçmişi</div>
        <Buton variant="ikincil" onClick={onKapat}>Kapat</Buton>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <button onClick={() => setYeniHareketTipi((t) => (t === 'ALIM' ? null : 'ALIM'))} style={eylemChipStili(yeniHareketTipi === 'ALIM' ? 'lacivert' : 'notr')}>+ Alım</button>
        <button onClick={() => setYeniHareketTipi((t) => (t === 'SATIS' ? null : 'SATIS'))} style={eylemChipStili(yeniHareketTipi === 'SATIS' ? 'lacivert' : 'notr')}>+ Satış</button>
        <button onClick={() => setYeniHareketTipi((t) => (t === 'KIRALAMA' ? null : 'KIRALAMA'))} style={eylemChipStili(yeniHareketTipi === 'KIRALAMA' ? 'lacivert' : 'notr')}>+ Kiralama</button>
        <button onClick={() => setYeniHareketTipi((t) => (t === 'BAKIM' ? null : 'BAKIM'))} style={eylemChipStili(yeniHareketTipi === 'BAKIM' ? 'lacivert' : 'notr')}>+ Bakım</button>
      </div>

      {yeniHareketTipi === 'ALIM' && <AlimMiniFormu cari={cari} onTamamlandi={tamamlandi} onVazgec={() => setYeniHareketTipi(null)} />}
      {yeniHareketTipi === 'SATIS' && <SatisMiniFormu cari={cari} onTamamlandi={tamamlandi} onVazgec={() => setYeniHareketTipi(null)} />}
      {yeniHareketTipi === 'KIRALAMA' && <KiralamaMiniFormu cari={cari} onTamamlandi={tamamlandi} onVazgec={() => setYeniHareketTipi(null)} />}
      {yeniHareketTipi === 'BAKIM' && <BakimMiniFormu cari={cari} onTamamlandi={tamamlandi} onVazgec={() => setYeniHareketTipi(null)} />}

      <div style={{ marginTop: 16 }}>
        <HataMesaji>{hata}</HataMesaji>
        {yukleniyor ? (
          <div style={{ padding: 20, color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
        ) : hareketler.length === 0 ? (
          <BosDurum baslik="Bu cari için henüz hareket bulunamadı" />
        ) : (
          <table>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                {['Tarih', 'Tür', 'Açıklama', 'Tutar (TL)', 'Durum'].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--metin-ikincil)' }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hareketler.map((h, i) => {
                const yol = CARI_HAREKET_YOL_HARITASI[h.kaynak_tablo];
                return (
                  <tr
                    key={i}
                    onClick={() => yol && navigate(yol)}
                    style={{ borderTop: '1px solid var(--kenarlik)', cursor: yol ? 'pointer' : 'default' }}
                    onMouseEnter={(e) => { if (yol) e.currentTarget.style.background = 'var(--zemin)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '8px 12px', color: 'var(--metin-ikincil)' }}>{tarihFormat(h.tarih)}</td>
                    <td style={{ padding: '8px 12px' }}><Etiket ton={HAREKET_TUR_TON[h.tur] || 'notr'}>{HAREKET_TUR_METIN[h.tur] || h.tur}</Etiket></td>
                    <td style={{ padding: '8px 12px' }}>{h.aciklama}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 500 }}>{h.tutar_try > 0 ? paraFormat(h.tutar_try) : '—'}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--metin-ikincil)' }}>{h.durum || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </Kart>
  );
}


export default function CarilerSayfasi() {
  const [cariler, setCariler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(null);
  const [formAcik, setFormAcik] = useState(false);
  const [duzenlenenCari, setDuzenlenenCari] = useState(null);
  const location = useLocation();
  const [arama, setArama] = useState(new URLSearchParams(location.search).get('ara') || '');
  const [filtreTip, setFiltreTip] = useState('');
  const [seciliCari, setSeciliCari] = useState(null);
  const [secilenIdler, setSecilenIdler] = useState(new Set());
  const [iceAktarAcik, setIceAktarAcik] = useState(false);
  const siralama = useSiralama();

  const [ozetHaritasi, setOzetHaritasi] = useState({});
  const [usdKur, setUsdKur] = useState(null);

  function listeyiYukle() {
    setYukleniyor(true);
    const params = {};
    if (arama) params.arama = arama;
    if (filtreTip) params.tip = filtreTip;
    api.get('/cariler', { params })
      .then((res) => setCariler(res.data))
      .catch((err) => setHata(hataMesajiCikar(err)))
      .finally(() => setYukleniyor(false));
  }

  useEffect(() => {
    listeyiYukle();
  }, [filtreTip]); // eslint-disable-line

  useEffect(() => {
    api.get('/cariler/ozet-listesi').then((r) => setOzetHaritasi(r.data)).catch(() => {});
    api.get('/kur/USD').then((r) => setUsdKur(Number(r.data.kur))).catch(() => {});
  }, []);

  function yeniCariAc() {
    setDuzenlenenCari(null);
    setFormAcik(true);
  }

  function duzenle(cari) {
    setDuzenlenenCari(cari);
    setFormAcik(true);
  }

  function formuKapat() {
    setFormAcik(false);
    setDuzenlenenCari(null);
  }

  async function cariyiSil(cari) {
    if (!(await ozelOnayIste(`${cari.unvan} adlı cariyi silmek istediğinize emin misiniz?`))) return;
    try {
      await api.delete(`/cariler/${cari.id}`);
      listeyiYukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  function satirSecimiDegistir(id) {
    setSecilenIdler((s) => {
      const yeni = new Set(s);
      if (yeni.has(id)) yeni.delete(id); else yeni.add(id);
      return yeni;
    });
  }

  async function topluSil() {
    if (!(await ozelOnayIste(`${secilenIdler.size} cariyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`))) return;
    setHata(null);
    const basarisizlar = [];
    for (const id of secilenIdler) {
      try {
        await api.delete(`/cariler/${id}`);
      } catch (err) {
        basarisizlar.push(id);
      }
    }
    setSecilenIdler(new Set());
    listeyiYukle();
    if (basarisizlar.length > 0) {
      setHata(`${basarisizlar.length} kayıt silinemedi (muhtemelen ilişkili hareketleri var).`);
    }
  }

  function secilenleriExceleAktar() {
    const secilenCariler = cariler.filter((c) => secilenIdler.has(c.id));
    excelIndir(
      secilenCariler.map((c) => ({
        'Unvan': c.unvan, 'Tip': CARI_TIP_METIN[c.tip] || c.tip, 'Vergi No': c.vergi_no || '',
        'Vergi Dairesi': c.vergi_dairesi || '', 'Telefon': c.telefon || '', 'E-posta': c.email || '',
        'Adres': c.adres || '', 'Bakiye (TL)': Number(ozetHaritasi[c.id] || 0),
      })),
      'secilen_cariler', 'Cariler',
    );
  }

  const siraliCariler = siralama.sirala(cariler, (item, alan) => (
    alan === 'bakiye_try' || alan === 'bakiye_usd' ? (ozetHaritasi[item.id] || 0) : item[alan]
  ));
  const kademe = useKademelıGoster(siraliCariler, 50);

  return (
    <div>
      <SayfaBasligi
        baslik="Cari hesaplar"
        aciklama="Müşteri, tedarikçi, personel ve ortak kayıtları"
        eylem={!formAcik && (
          <div style={{ display: 'flex', gap: 8 }}>
            <DahaFazlaMenu ogeler={[
              { etiket: 'Excel İndir', onClick: () => excelIndir(
                  cariler.map((c) => ({
                    'Unvan': c.unvan, 'Tip': CARI_TIP_METIN[c.tip] || c.tip, 'Vergi No': c.vergi_no || '',
                    'Vergi Dairesi': c.vergi_dairesi || '', 'Telefon': c.telefon || '', 'E-posta': c.email || '',
                    'Adres': c.adres || '', 'Bakiye (TL)': Number(ozetHaritasi[c.id] || 0),
                  })),
                  'cari_listesi', 'Cariler',
                ) },
              { etiket: "Excel'den İçe Aktar", onClick: () => setIceAktarAcik((a) => !a) },
            ]} />
            <Buton onClick={yeniCariAc}>+ Yeni cari</Buton>
          </div>
        )}
      />

      <HataMesaji>{hata}</HataMesaji>

      {iceAktarAcik && (
        <IceAktarPaneli
          onKapat={() => setIceAktarAcik(false)}
          onTamamlandi={() => { setIceAktarAcik(false); listeyiYukle(); }}
        />
      )}

      {formAcik && (
        <CariFormu
          duzenlenenCari={duzenlenenCari}
          onKaydedildi={() => { formuKapat(); listeyiYukle(); }}
          onVazgec={formuKapat}
        />
      )}

      {seciliCari && (
        <>
          <CariBilgileriKarti cari={seciliCari} />
          <CariOzetKarti cari={seciliCari} />
          <CariHareketleri cari={seciliCari} onKapat={() => setSeciliCari(null)} />
        </>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {[['', 'Tümü'], ['MUSTERI', 'Müşteri'], ['TEDARIKCI', 'Tedarikçi']].map(([deger, etiket]) => (
          <button
            key={deger}
            onClick={() => setFiltreTip(deger)}
            style={{
              padding: '7px 16px', borderRadius: 7, cursor: 'pointer', fontSize: 13,
              border: filtreTip === deger ? '2px solid var(--lacivert)' : '1px solid var(--kenarlik)',
              background: filtreTip === deger ? 'var(--lacivert)' : 'white',
              color: filtreTip === deger ? 'white' : 'var(--metin-birincil)',
              fontWeight: filtreTip === deger ? 600 : 400,
            }}
          >
            {etiket}
          </button>
        ))}
      </div>

      {secilenIdler.size > 0 && (
        <Kart style={{ marginBottom: 12, background: 'var(--zemin)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px' }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{secilenIdler.size} kayıt seçili</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Buton variant="ikincil" onClick={secilenleriExceleAktar}>Excel'e Aktar</Buton>
            <Buton variant="tehlike" onClick={topluSil}>Seçilenleri Sil</Buton>
            <Buton variant="ikincil" onClick={() => setSecilenIdler(new Set())}>Seçimi Temizle</Buton>
          </div>
        </Kart>
      )}

      <Kart style={{ padding: 0 }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--kenarlik)' }}>
          <input
            value={arama}
            onChange={(e) => setArama(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && listeyiYukle()}
            placeholder="Unvana göre ara..."
            style={{ ...girdiStili, maxWidth: 320 }}
          />
        </div>

        {yukleniyor ? (
          <TabloIskeleti sutunSayisi={7} />
        ) : cariler.length === 0 ? (
          <BosDurum baslik="Henüz cari kaydı yok" aciklama="Yukarıdan yeni bir cari ekleyin." />
        ) : (
          <table>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                <th style={{ padding: '10px 16px', width: 32 }}>
                  <input
                    type="checkbox"
                    checked={kademe.gosterilecekler.length > 0 && kademe.gosterilecekler.every((c) => secilenIdler.has(c.id))}
                    onChange={(e) => {
                      if (e.target.checked) setSecilenIdler(new Set(kademe.gosterilecekler.map((c) => c.id)));
                      else setSecilenIdler(new Set());
                    }}
                  />
                </th>
                <SiraliBaslik alanAdi="unvan" siralama={siralama}>Unvan</SiraliBaslik>
                <SiraliBaslik alanAdi="tip" siralama={siralama}>Tip</SiraliBaslik>
                <SiraliBaslik alanAdi="vergi_no" siralama={siralama}>Vergi No</SiraliBaslik>
                <SiraliBaslik alanAdi="telefon" siralama={siralama}>Telefon</SiraliBaslik>
                <SiraliBaslik alanAdi="bakiye_try" siralama={siralama}>Bakiye (TL)</SiraliBaslik>
                <SiraliBaslik alanAdi="bakiye_usd" siralama={siralama}>Bakiye (USD)</SiraliBaslik>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {kademe.gosterilecekler.map((c) => (
                <tr key={c.id} style={{ borderTop: '1px solid var(--kenarlik)', background: secilenIdler.has(c.id) ? 'var(--zemin)' : 'transparent' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <input type="checkbox" checked={secilenIdler.has(c.id)} onChange={() => satirSecimiDegistir(c.id)} />
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 500 }}>{c.unvan}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <Etiket ton={TIP_ETIKET[c.tip]?.ton}>{TIP_ETIKET[c.tip]?.metin}</Etiket>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--metin-ikincil)' }}>{c.vergi_no || '—'}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--metin-ikincil)' }}>{c.telefon || '—'}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 500, color: (ozetHaritasi[c.id] || 0) >= 0 ? 'var(--yesil)' : 'var(--kirmizi)' }}>
                    {paraFormat(ozetHaritasi[c.id] || 0, 'TRY')}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--metin-ikincil)' }}>
                    {usdKur ? paraFormat((ozetHaritasi[c.id] || 0) / usdKur, 'USD') : '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button onClick={() => setSeciliCari(c)} style={eylemChipStili('lacivert')}>Alacak/Borç</button>
                      <DahaFazlaMenu kompakt ogeler={[
                        { etiket: 'Düzenle', onClick: () => duzenle(c) },
                        { etiket: 'Sil', onClick: () => cariyiSil(c) },
                      ]} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <DahaFazlaGosterButonu kademe={kademe} />
      </Kart>
    </div>
  );
}
