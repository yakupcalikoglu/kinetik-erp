import { useEffect, useState, Fragment } from 'react';
import { api, hataMesajiCikar } from '../api/client';
import {
  Kart, SayfaBasligi, Buton, Alan, girdiStili, Etiket, BosDurum, HataMesaji, paraFormat, eylemChipStili,
} from '../components/Ortak';
import AramaliSecici from '../components/AramaliSecici';

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
    alim_tarihi: new Date().toISOString().slice(0, 10), notlar: '',
  };
}

function DemirbasFormu({ duzenlenen, cariler, onKaydedildi, onVazgec }) {
  const duzenlemeModu = !!duzenlenen;
  const [form, setForm] = useState(() => duzenlenen
    ? {
        kategori: duzenlenen.kategori, ad: duzenlenen.ad, tanimlayici_no: duzenlenen.tanimlayici_no || '',
        konum: duzenlenen.konum || '', durum: duzenlenen.durum, kiraci_cari_id: duzenlenen.kiraci_cari_id || '',
        maliyet_try: String(duzenlenen.maliyet_try), alim_tarihi: duzenlenen.alim_tarihi || '',
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
          notlar: form.notlar || null,
        });
      } else {
        await api.post('/demirbaslar', {
          kategori: form.kategori, ad: form.ad,
          tanimlayici_no: form.tanimlayici_no || null, konum: form.konum || null,
          durum: form.durum, kiraci_cari_id: form.kiraci_cari_id ? Number(form.kiraci_cari_id) : null,
          maliyet_orijinal: Number(form.maliyet_orijinal), para_birimi: form.para_birimi, kur: Number(form.kur || 1),
          alim_tarihi: form.alim_tarihi || null, notlar: form.notlar || null,
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
          {duzenlemeModu ? (
            <Alan etiket="Maliyet (TL)">
              <input required type="number" step="0.01" value={form.maliyet_try} onChange={(e) => setForm((f) => ({ ...f, maliyet_try: e.target.value }))} style={girdiStili} />
            </Alan>
          ) : (
            <>
              <Alan etiket="Maliyet">
                <div style={{ display: 'flex', gap: 6 }}>
                  <input required type="number" step="0.01" value={form.maliyet_orijinal} onChange={(e) => setForm((f) => ({ ...f, maliyet_orijinal: e.target.value }))} style={{ ...girdiStili, flex: 1 }} />
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
                <input type="number" step="0.01" value={form.satis_fiyati_try} onChange={(e) => setForm((f) => ({ ...f, satis_fiyati_try: e.target.value }))} style={girdiStili} />
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

export default function OzMalSayfasi() {
  const [demirbaslar, setDemirbaslar] = useState([]);
  const [ekipmanlar, setEkipmanlar] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(null);
  const [formAcik, setFormAcik] = useState(false);
  const [duzenlenen, setDuzenlenen] = useState(null);
  const [satisAcikId, setSatisAcikId] = useState(null);
  const [aramaMetni, setAramaMetni] = useState('');
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

  const toplamDeger = birlesikListe.filter((k) => k.durum !== 'SATILDI' && k.durum !== 'HURDA').reduce((acc, k) => acc + k.maliyet_try, 0);

  function yeniAc() {
    setDuzenlenen(null);
    setFormAcik(true);
  }
  function duzenle(kayit) {
    if (kayit.kaynak === 'EKIPMAN') {
      window.alert("Bu bir ekipman kaydı (Stok modülünden geliyor) — düzenlemek için Stok sayfasını kullanın.");
      return;
    }
    setDuzenlenen(kayit.ham);
    setFormAcik(true);
  }
  async function sil(kayit) {
    if (kayit.kaynak === 'EKIPMAN') {
      window.alert("Bu bir ekipman kaydı (Stok modülünden geliyor) — silmek için Stok sayfasını kullanın.");
      return;
    }
    if (!window.confirm(`${kayit.ad} demirbaşını silmek istediğinize emin misiniz?`)) return;
    try {
      await api.delete(`/demirbaslar/${kayit.id}`);
      yukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  return (
    <div>
      <SayfaBasligi
        baslik="Öz Mal / Demirbaş"
        aciklama="Şirket araçları, gayrimenkul, ofis ekipmanı ve kendi kullanımımız/kiralamamız için ayırdığımız ürünler — tek ekrandan takip"
        eylem={!formAcik && <Buton onClick={yeniAc}>+ Yeni Demirbaş</Buton>}
      />
      <HataMesaji>{hata}</HataMesaji>

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
                    <td style={{ padding: '12px 16px' }}>{paraFormat(k.maliyet_try)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <Etiket ton={k.kaynak === 'EKIPMAN' ? 'amber' : 'notr'}>{k.kaynak === 'EKIPMAN' ? 'Stok (Ekipman)' : 'Demirbaş'}</Etiket>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => duzenle(k)} style={eylemChipStili('lacivert')}>Düzenle</button>
                        {k.kaynak === 'DEMIRBAS' && k.durum !== 'SATILDI' && k.durum !== 'HURDA' && (
                          <button onClick={() => setSatisAcikId(k.id)} style={eylemChipStili('yesil')}>Sat</button>
                        )}
                        <button onClick={() => sil(k)} style={eylemChipStili('kirmizi')}>Sil</button>
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
