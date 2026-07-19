import { useEffect, useState, Fragment } from 'react';
import * as XLSX from 'xlsx';
import { api, hataMesajiCikar } from '../api/client';
import {
  Kart, SayfaBasligi, Buton, Etiket, Alan, girdiStili, BosDurum, HataMesaji, paraFormat, eylemChipStili,
} from '../components/Ortak';

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

function CariHareketleri({ cari, onKapat }) {
  const [hareketler, setHareketler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(null);
  const [acikDetayId, setAcikDetayId] = useState(null);

  useEffect(() => {
    setYukleniyor(true);
    api.get(`/cariler/${cari.id}/hareketler`)
      .then((r) => setHareketler(r.data))
      .catch((e) => setHata(hataMesajiCikar(e)))
      .finally(() => setYukleniyor(false));
  }, [cari.id]);

  function satiraTikla(h) {
    if (!h.kaynak_tablo || !h.kaynak_id) return;
    setAcikDetayId((mevcut) => (mevcut === h.id ? null : h.id));
  }

  return (
    <Kart style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{cari.unvan} — hareket geçmişi</div>
        <Buton variant="ikincil" onClick={onKapat}>Kapat</Buton>
      </div>
      <HataMesaji>{hata}</HataMesaji>

      {yukleniyor ? (
        <div style={{ padding: 20, color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
      ) : hareketler.length === 0 ? (
        <BosDurum baslik="Bu cari için hareket bulunamadı" />
      ) : (
        <table>
          <thead>
            <tr style={{ background: 'var(--zemin)' }}>
              {['Tarih', 'Yön', 'Tutar', 'TL Karşılığı', 'Açıklama'].map((b) => (
                <th key={b} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>{b}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hareketler.map((h) => {
              const tiklanabilir = !!(h.kaynak_tablo && h.kaynak_id);
              return (
                <Fragment key={h.id}>
                  <tr
                    onClick={() => satiraTikla(h)}
                    style={{
                      borderTop: '1px solid var(--kenarlik)',
                      cursor: tiklanabilir ? 'pointer' : 'default',
                      background: acikDetayId === h.id ? 'var(--zemin)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{tarihFormat(h.tarih)}</td>
                    <td style={{ padding: '10px 16px' }}>{HAREKET_YON_METIN[h.yon]}</td>
                    <td style={{ padding: '10px 16px', fontWeight: 500, color: h.yon === 'GIRIS' ? 'var(--yesil)' : 'var(--kirmizi)' }}>
                      {paraFormat(h.tutar, h.para_birimi)}
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>
                      {h.tutar_try_karsiligi != null ? paraFormat(h.tutar_try_karsiligi) : '—'}
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>
                      {h.aciklama || '—'}
                      {tiklanabilir && (
                        <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--lacivert)' }}>
                          {acikDetayId === h.id ? '▲ detayı gizle' : '▼ detay göster'}
                        </span>
                      )}
                    </td>
                  </tr>
                  {acikDetayId === h.id && (
                    <tr>
                      <td colSpan={5} style={{ padding: 0 }}>
                        <KaynakDetayi kaynakTablo={h.kaynak_tablo} kaynakId={h.kaynak_id} />
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
  );
}

export default function CarilerSayfasi() {
  const [cariler, setCariler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(null);
  const [formAcik, setFormAcik] = useState(false);
  const [duzenlenenCari, setDuzenlenenCari] = useState(null);
  const [arama, setArama] = useState('');
  const [seciliCari, setSeciliCari] = useState(null);
  const [iceAktarAcik, setIceAktarAcik] = useState(false);
  const siralama = useSiralama();

  function listeyiYukle() {
    setYukleniyor(true);
    api.get('/cariler', { params: arama ? { arama } : {} })
      .then((res) => setCariler(res.data))
      .catch((err) => setHata(hataMesajiCikar(err)))
      .finally(() => setYukleniyor(false));
  }

  useEffect(() => { listeyiYukle(); }, []); // eslint-disable-line

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
    if (!window.confirm(`${cari.unvan} adlı cariyi silmek istediğinize emin misiniz?`)) return;
    try {
      await api.delete(`/cariler/${cari.id}`);
      listeyiYukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  return (
    <div>
      <SayfaBasligi
        baslik="Cari hesaplar"
        aciklama="Müşteri, tedarikçi, personel ve ortak kayıtları"
        eylem={!formAcik && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Buton variant="ikincil" onClick={() => setIceAktarAcik((a) => !a)}>
              {iceAktarAcik ? 'İçe Aktarmayı Kapat' : "Excel'den İçe Aktar"}
            </Buton>
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
        <CariHareketleri cari={seciliCari} onKapat={() => setSeciliCari(null)} />
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
          <div style={{ padding: 20, color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
        ) : cariler.length === 0 ? (
          <BosDurum baslik="Henüz cari kaydı yok" aciklama="Yukarıdan yeni bir cari ekleyin." />
        ) : (
          <table>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
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
              {siralama.sirala(cariler, (item, alan) => item[alan]).map((c) => (
                <tr key={c.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 500 }}>{c.unvan}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <Etiket ton={TIP_ETIKET[c.tip]?.ton}>{TIP_ETIKET[c.tip]?.metin}</Etiket>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--metin-ikincil)' }}>{c.vergi_no || '—'}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--metin-ikincil)' }}>{c.telefon || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>{paraFormat(c.bakiye_try, 'TRY')}</td>
                  <td style={{ padding: '12px 16px' }}>{paraFormat(c.bakiye_usd, 'USD')}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setSeciliCari(c)} style={eylemChipStili('lacivert')}>Hareketler</button>
                      <button onClick={() => duzenle(c)} style={eylemChipStili('lacivert')}>Düzenle</button>
                      <button onClick={() => cariyiSil(c)} style={eylemChipStili('kirmizi')}>Sil</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Kart>
    </div>
  );
}
