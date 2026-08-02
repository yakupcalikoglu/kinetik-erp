import { useEffect, useState, Fragment } from 'react';
import * as XLSX from 'xlsx';
import { api, hataMesajiCikar } from '../api/client';

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
import {
  Kart, SayfaBasligi, Buton, Alan, girdiStili, Etiket, BosDurum, HataMesaji,
  eylemChipStili, BIRIM_SECENEKLERI, paraFormat,
} from '../components/Ortak';

function bosForm() {
  return { marka: '', model: '', birim: 'ADET', birim_agirlik_kg: '', aciklama: '', mense_ulke: '', gtip_kodu: '', standart_alt_metin: '' };
}

const ALAN_ESLESTIRME = {
  marka: ['marka', 'brand', 'üretici'],
  model: ['model', 'ürün adı', 'urun adi', 'ürün', 'urun'],
  birim: ['birim', 'unit'],
  mense_ulke: ['menşei', 'mense', 'menşei ülke', 'mense ulke', 'origin'],
  gtip_kodu: ['gtip', 'gtip kodu', 'gtip no', 'hs kodu', 'hs code'],
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
        if (!harita.marka && !harita.model) {
          setHata("Marka veya Model sütunu bulunamadı. Excel dosyasında bu bilgiyi içeren en az bir sütun olmalı (örn. 'Marka', 'Model').");
          return;
        }
        const donusturulmus = veri
          .map((satir) => ({
            marka: harita.marka ? String(satir[harita.marka] || '').trim() : '',
            model: harita.model ? String(satir[harita.model] || '').trim() : '',
            birim: harita.birim ? String(satir[harita.birim] || 'ADET').trim().toUpperCase() : 'ADET',
            mense_ulke: harita.mense_ulke ? String(satir[harita.mense_ulke] || '').trim() : '',
            gtip_kodu: harita.gtip_kodu ? String(satir[harita.gtip_kodu] || '').trim() : '',
          }))
          .filter((s) => s.marka || s.model);
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
      const { data } = await api.post('/stok-kartlari/toplu-ice-aktar', {
        satirlar: satirlar.map((s) => ({
          marka: s.marka || null,
          model: s.model || null,
          birim: s.birim || 'ADET',
          mense_ulke: s.mense_ulke || null,
          gtip_kodu: s.gtip_kodu || null,
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
        <div style={{ fontSize: 14.5, fontWeight: 600 }}>Excel'den Ürün Tanımı İçe Aktar</div>
        <Buton variant="ikincil" onClick={onKapat}>Kapat</Buton>
      </div>
      <HataMesaji>{hata}</HataMesaji>

      <div style={{ fontSize: 12.5, color: 'var(--metin-ikincil)', marginBottom: 12 }}>
        Excel dosyanızda (herhangi bir sütun sırasıyla) şunlar bulunabilir: <strong>Marka</strong>, <strong>Model</strong> (en az biri zorunlu),
        Birim, Menşei Ülke, GTİP Kodu. Akınsoft Wolvox gibi başka bir sistemden Excel'e aktardığınız ürün listesini doğrudan yükleyebilirsiniz.
      </div>

      <input type="file" accept=".xlsx,.xls" onChange={dosyaSecildi} style={{ marginBottom: 16 }} />

      {satirlar.length > 0 && !sonuc && (
        <>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{satirlar.length} satır bulundu — önizleme (ilk 10):</div>
          <table style={{ marginBottom: 16 }}>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                {['Marka', 'Model', 'Birim', 'Menşei', 'GTİP'].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 12, color: 'var(--metin-ikincil)' }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {satirlar.slice(0, 10).map((s, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                  <td style={{ padding: '6px 10px' }}>{s.marka || '—'}</td>
                  <td style={{ padding: '6px 10px' }}>{s.model || '—'}</td>
                  <td style={{ padding: '6px 10px' }}>{s.birim}</td>
                  <td style={{ padding: '6px 10px' }}>{s.mense_ulke || '—'}</td>
                  <td style={{ padding: '6px 10px' }}>{s.gtip_kodu || '—'}</td>
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
                  <li key={h.satir_no}>Satır {h.satir_no} ({h.marka} {h.model}): {h.hata}</li>
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

const URUN360_DURUM_METIN = {
  DEPODA: 'Depoda', SIPARISTE: 'Siparişte', YOLDA: 'Yolda', GUMRUKTE: 'Gümrükte',
  ANTREPODA: 'Antrepoda', SATILDI: 'Satıldı', KIRADA: 'Kirada', BAKIMDA: 'Bakımda', HURDA: 'Hurda',
};

function tarihFormatUrun360(iso) {
  if (!iso || typeof iso !== 'string' || !iso.includes('-')) return iso || '—';
  const [yil, ay, gun] = iso.slice(0, 10).split('-');
  return `${gun}/${ay}/${yil}`;
}

function Urun360Paneli({ kart, onKapat }) {
  const [ozet, setOzet] = useState(null);
  const [hata, setHata] = useState(null);

  useEffect(() => {
    api.get(`/stok-kartlari/${kart.id}/ozet`).then((r) => setOzet(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }, [kart.id]);

  return (
    <Kart style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{kart.marka} {kart.model} — Ürün Performansı</div>
        <Buton variant="ikincil" onClick={onKapat}>Kapat</Buton>
      </div>
      <HataMesaji>{hata}</HataMesaji>
      {!ozet ? (
        <div style={{ color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--metin-ikincil)' }}>Toplam Adet (bugüne kadar)</div>
              <div style={{ fontSize: 19, fontWeight: 700 }}>{ozet.toplam_adet}</div>
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--metin-ikincil)' }}>Satılan Adet</div>
              <div style={{ fontSize: 19, fontWeight: 700 }}>{ozet.toplam_satis_adedi}</div>
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--metin-ikincil)' }}>Toplam Kâr/Zarar</div>
              <div style={{ fontSize: 19, fontWeight: 700, color: Number(ozet.toplam_kar_zarar_try) >= 0 ? 'var(--yesil)' : 'var(--kirmizi)' }}>
                {paraFormat(ozet.toplam_kar_zarar_try)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--metin-ikincil)' }}>Ortalama Kâr Marjı</div>
              <div style={{ fontSize: 19, fontWeight: 700 }}>
                {ozet.ortalama_kar_marji_yuzde != null ? `%${Number(ozet.ortalama_kar_marji_yuzde).toFixed(1)}` : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--metin-ikincil)' }}>Bakım (Net)</div>
              <div style={{ fontSize: 19, fontWeight: 700 }}>{paraFormat(ozet.bakim_geliri_toplam - ozet.bakim_gideri_toplam)}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {ozet.durum_dagilimi.map((d) => (
              <Etiket key={d.durum} ton={d.durum === 'SATILDI' ? 'yesil' : d.durum === 'KIRADA' ? 'amber' : d.durum === 'HURDA' ? 'kirmizi' : 'notr'}>
                {URUN360_DURUM_METIN[d.durum] || d.durum}: {d.adet}
              </Etiket>
            ))}
          </div>

          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Satış Geçmişi</div>
          {ozet.satislar.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--metin-soluk)' }}>Bu modelden henüz satış yapılmamış.</div>
          ) : (
            <table>
              <thead>
                <tr style={{ background: 'var(--zemin)' }}>
                  {['Seri No', 'Satış Tarihi', 'Müşteri', 'Satış Fiyatı', 'Maliyet', 'Kâr/Zarar'].map((b) => (
                    <th key={b} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 12, color: 'var(--metin-ikincil)' }}>{b}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ozet.satislar.map((s) => (
                  <tr key={s.seri_no} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                    <td style={{ padding: '6px 10px', fontFamily: 'var(--font-mono)' }}>{s.seri_no}</td>
                    <td style={{ padding: '6px 10px', color: 'var(--metin-ikincil)' }}>{tarihFormatUrun360(s.satis_tarihi)}</td>
                    <td style={{ padding: '6px 10px', color: 'var(--metin-ikincil)' }}>{s.musteri_unvan || '—'}</td>
                    <td style={{ padding: '6px 10px' }}>{s.satis_fiyati_try != null ? paraFormat(s.satis_fiyati_try) : '—'}</td>
                    <td style={{ padding: '6px 10px', color: 'var(--metin-ikincil)' }}>{paraFormat(s.toplam_maliyet_try)}</td>
                    <td style={{ padding: '6px 10px', fontWeight: 500, color: s.kar_zarar_try != null && Number(s.kar_zarar_try) >= 0 ? 'var(--yesil)' : 'var(--kirmizi)' }}>
                      {s.kar_zarar_try != null ? paraFormat(s.kar_zarar_try) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </Kart>
  );
}

function UrunTanimiFormu({ duzenlenenKart, onKaydedildi, onVazgec }) {
  const duzenlemeModu = !!duzenlenenKart;
  const [form, setForm] = useState(() => duzenlenenKart
    ? {
        marka: duzenlenenKart.marka || '',
        model: duzenlenenKart.model || '',
        birim: duzenlenenKart.birim || 'ADET',
        birim_agirlik_kg: duzenlenenKart.birim_agirlik_kg ?? '',
        aciklama: duzenlenenKart.aciklama || '',
        mense_ulke: duzenlenenKart.mense_ulke || '',
        gtip_kodu: duzenlenenKart.gtip_kodu || '',
        standart_alt_metin: duzenlenenKart.standart_alt_metin || '',
      }
    : bosForm()
  );
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [olusturulanId, setOlusturulanId] = useState(null);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      const govde = { ...form, birim_agirlik_kg: form.birim_agirlik_kg ? Number(form.birim_agirlik_kg) : null };
      if (duzenlemeModu) {
        await api.put(`/stok-kartlari/${duzenlenenKart.id}`, govde);
        onKaydedildi();
      } else {
        const { data } = await api.post('/stok-kartlari', govde);
        setOlusturulanId(data.id);
      }
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  if (olusturulanId) {
    return (
      <Kart style={{ marginBottom: 20, background: 'var(--yesil-acik)' }}>
        <div style={{ color: 'var(--yesil)', fontWeight: 600, marginBottom: 6 }}>
          Ürün tanımı oluşturuldu — ID: {olusturulanId}
        </div>
        <div style={{ fontSize: 13, color: 'var(--metin-ikincil)', marginBottom: 12 }}>
          Bu ID'yi sipariş oluştururken "Stok Kartı ID" alanına girin.
        </div>
        <Buton variant="ikincil" onClick={onKaydedildi}>Kapat</Buton>
      </Kart>
    );
  }

  return (
    <Kart style={{ marginBottom: 20 }}>
      <form onSubmit={kaydet}>
        <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 14 }}>
          {duzenlemeModu ? `Ürün tanımını düzenle — #${duzenlenenKart.id}` : 'Yeni ürün tanımı'}
        </div>
        <HataMesaji>{hata}</HataMesaji>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
          <Alan etiket="Marka">
            <input required value={form.marka} onChange={(e) => setForm((f) => ({ ...f, marka: e.target.value }))} style={girdiStili} />
          </Alan>
          <Alan etiket="Model">
            <input required value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} style={girdiStili} />
          </Alan>
          <Alan etiket="Birim">
            <select value={form.birim} onChange={(e) => setForm((f) => ({ ...f, birim: e.target.value }))} style={girdiStili}>
              {BIRIM_SECENEKLERI.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </Alan>
          <Alan etiket="Menşei ülke">
            <input value={form.mense_ulke} onChange={(e) => setForm((f) => ({ ...f, mense_ulke: e.target.value }))} placeholder="Çin" style={girdiStili} />
          </Alan>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Alan etiket="GTİP kodu">
            <input value={form.gtip_kodu} onChange={(e) => setForm((f) => ({ ...f, gtip_kodu: e.target.value }))} placeholder="8427.20" style={girdiStili} />
          </Alan>
          <Alan etiket="Birim ağırlık (kg) — opsiyonel, nakliye hesabında kullanılır">
            <input type="number" step="0.1" value={form.birim_agirlik_kg} onChange={(e) => setForm((f) => ({ ...f, birim_agirlik_kg: e.target.value }))} style={girdiStili} />
          </Alan>
        </div>
        <Alan etiket="Açıklama">
          <input value={form.aciklama} onChange={(e) => setForm((f) => ({ ...f, aciklama: e.target.value }))} style={girdiStili} />
        </Alan>
        <Alan etiket="Standart alt metin (opsiyonel) — Proforma/Fatura'da bu modelden kalem eklenince Notlar'a otomatik önerilir">
          <textarea
            value={form.standart_alt_metin}
            onChange={(e) => setForm((f) => ({ ...f, standart_alt_metin: e.target.value }))}
            style={{ ...girdiStili, minHeight: 70, resize: 'vertical', fontFamily: 'inherit' }}
            placeholder="Örn: Bu ürün 2 yıl garanti kapsamındadır. Teslimat X gün içinde yapılır."
          />
        </Alan>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <Buton type="submit" disabled={kaydediliyor}>
            {kaydediliyor ? 'Kaydediliyor...' : duzenlemeModu ? 'Değişiklikleri kaydet' : 'Ürün tanımı oluştur'}
          </Buton>
          <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
        </div>
      </form>
    </Kart>
  );
}

export default function UrunTanimlariSayfasi() {
  const [kartlar, setKartlar] = useState([]);
  const [envanterSayilari, setEnvanterSayilari] = useState({});
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(null);
  const [formAcik, setFormAcik] = useState(false);
  const [duzenlenenKart, setDuzenlenenKart] = useState(null);
  const [detayAcikId, setDetayAcikId] = useState(null);
  const [arama, setArama] = useState('');
  const [iceAktarAcik, setIceAktarAcik] = useState(false);
  const siralama = useSiralama();

  function kartlariYukle() {
    setYukleniyor(true);
    api.get('/stok-kartlari')
      .then((r) => setKartlar(r.data))
      .catch((e) => setHata(hataMesajiCikar(e)))
      .finally(() => setYukleniyor(false));
  }

  function envanterSayilariniYukle() {
    api.get('/stok-seri-no')
      .then((r) => {
        const harita = {};
        r.data.forEach((u) => {
          if (u.durum === 'SATILDI') return;
          harita[u.stok_karti_id] = (harita[u.stok_karti_id] || 0) + 1;
        });
        setEnvanterSayilari(harita);
      })
      .catch(() => {});
  }

  useEffect(() => {
    kartlariYukle();
    envanterSayilariniYukle();
  }, []);

  function yeniAc() {
    setDuzenlenenKart(null);
    setFormAcik(true);
  }

  function duzenle(kart) {
    setDuzenlenenKart(kart);
    setFormAcik(true);
  }

  function formuKapat() {
    setFormAcik(false);
    setDuzenlenenKart(null);
  }

  async function sil(kart) {
    if (!window.confirm(`${kart.marka} ${kart.model} ürün tanımını silmek istediğinize emin misiniz?`)) return;
    try {
      await api.delete(`/stok-kartlari/${kart.id}`);
      kartlariYukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  const gosterilecekler = arama
    ? kartlar.filter((k) => `${k.marka} ${k.model}`.toLowerCase().includes(arama.toLowerCase()))
    : kartlar;

  return (
    <div>
      <SayfaBasligi
        baslik="Ürün Tanımları"
        aciklama="Marka, model, birim ve gümrük bilgileri — fiziksel envanterden bağımsız ürün kataloğu"
        eylem={!formAcik && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Buton variant="ikincil" onClick={() => setIceAktarAcik((a) => !a)}>
              {iceAktarAcik ? 'İçe Aktarmayı Kapat' : "Excel'den İçe Aktar"}
            </Buton>
            <Buton onClick={yeniAc}>+ Yeni ürün tanımı</Buton>
          </div>
        )}
      />
      <HataMesaji>{hata}</HataMesaji>

      {iceAktarAcik && (
        <IceAktarPaneli
          onKapat={() => setIceAktarAcik(false)}
          onTamamlandi={() => { setIceAktarAcik(false); kartlariYukle(); envanterSayilariniYukle(); }}
        />
      )}

      {formAcik && (
        <UrunTanimiFormu
          duzenlenenKart={duzenlenenKart}
          onKaydedildi={() => { formuKapat(); kartlariYukle(); envanterSayilariniYukle(); }}
          onVazgec={formuKapat}
        />
      )}

      <Kart style={{ padding: 0 }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--kenarlik)' }}>
          <input
            value={arama}
            onChange={(e) => setArama(e.target.value)}
            placeholder="Marka/model ara..."
            style={{ ...girdiStili, maxWidth: 320 }}
          />
        </div>

        {yukleniyor ? (
          <div style={{ padding: 20, color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
        ) : gosterilecekler.length === 0 ? (
          <BosDurum baslik="Ürün tanımı bulunamadı" aciklama="Yukarıdan yeni bir ürün tanımı ekleyin." />
        ) : (
          <table>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                <SiraliBaslik alanAdi="id" siralama={siralama}>ID</SiraliBaslik>
                <SiraliBaslik alanAdi="marka" siralama={siralama}>Marka</SiraliBaslik>
                <SiraliBaslik alanAdi="model" siralama={siralama}>Model</SiraliBaslik>
                <SiraliBaslik alanAdi="birim" siralama={siralama}>Birim</SiraliBaslik>
                <SiraliBaslik alanAdi="_envanter" siralama={siralama}>Elde Bulunan (Satılmamış)</SiraliBaslik>
                <SiraliBaslik alanAdi="mense_ulke" siralama={siralama}>Menşei</SiraliBaslik>
                <SiraliBaslik alanAdi="gtip_kodu" siralama={siralama}>GTİP</SiraliBaslik>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {siralama.sirala(gosterilecekler, (item, alan) => (
                alan === '_envanter' ? (envanterSayilari[item.id] || 0) : item[alan]
              )).map((k) => (
                <Fragment key={k.id}>
                  <tr style={{ borderTop: '1px solid var(--kenarlik)' }}>
                    <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: 'var(--metin-ikincil)' }}>{k.id}</td>
                    <td style={{ padding: '10px 16px', fontWeight: 500 }}>{k.marka}</td>
                    <td style={{ padding: '10px 16px' }}>{k.model}</td>
                    <td style={{ padding: '10px 16px' }}>{k.birim}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <Etiket ton={envanterSayilari[k.id] > 0 ? 'yesil' : 'notr'}>
                        {envanterSayilari[k.id] || 0} {k.birim}
                      </Etiket>
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{k.mense_ulke || '—'}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{k.gtip_kodu || '—'}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setDetayAcikId((mevcut) => (mevcut === k.id ? null : k.id))} style={eylemChipStili('yesil')}>
                          {detayAcikId === k.id ? 'Kapat' : 'Detay'}
                        </button>
                        <button onClick={() => duzenle(k)} style={eylemChipStili('lacivert')}>Düzenle</button>
                        <button onClick={() => sil(k)} style={eylemChipStili('kirmizi')}>Sil</button>
                      </div>
                    </td>
                  </tr>
                  {detayAcikId === k.id && (
                    <tr>
                      <td colSpan={8} style={{ padding: '0 16px 12px' }}>
                        <Urun360Paneli kart={k} onKapat={() => setDetayAcikId(null)} />
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
