import { useEffect, useState, Fragment } from 'react';
import { api, hataMesajiCikar } from '../api/client';
import {
  Kart, SayfaBasligi, Buton, Alan, girdiStili, Etiket, BosDurum, HataMesaji, paraFormat, eylemChipStili,
} from '../components/Ortak';
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

function useCariler() {
  const [cariler, setCariler] = useState([]);
  useEffect(() => {
    api.get('/cariler').then((r) => setCariler(r.data)).catch(() => {});
  }, []);
  return cariler;
}

function bosParcaFormu() {
  return { ad: '', birim: 'ADET', birim_fiyat_try: '', min_stok_seviyesi: '0', notlar: '', sifre: '' };
}

function HareketlerPaneli({ parca, cariler, onKapat, onDegisti }) {
  const [hareketler, setHareketler] = useState(null);
  const [formAcik, setFormAcik] = useState(false);
  const [form, setForm] = useState({
    tarih: new Date().toISOString().slice(0, 10), yon: 'GIRIS', miktar: '',
    birim_fiyat: '', para_birimi: 'TRY', kur: '1', ilgili_cari_id: '', aciklama: '',
    odeme_yontemi: 'NAKIT', banka_hesap_id: '', ilgili_stok_seri_no_id: '',
  });
  const [bankaHesaplari, setBankaHesaplari] = useState([]);
  const [urunSecenekleri, setUrunSecenekleri] = useState([]);
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => {
    api.get('/banka-bakiyeleri').then((r) => setBankaHesaplari(r.data)).catch(() => {});
    Promise.all([api.get('/stok-seri-no'), api.get('/stok-kartlari')]).then(([u, k]) => {
      const kartHaritasi = {};
      k.data.forEach((kart) => { kartHaritasi[kart.id] = kart; });
      setUrunSecenekleri(u.data.map((urun) => {
        const kart = kartHaritasi[urun.stok_karti_id];
        return { ...urun, etiket: kart ? `${kart.marka} ${kart.model} (${urun.seri_no})` : urun.seri_no };
      }));
    }).catch(() => {});
  }, []);

  function yukle() {
    api.get(`/yedek-parcalar/${parca.id}/hareketler`).then((r) => setHareketler(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }
  useEffect(() => { yukle(); }, [parca.id]); // eslint-disable-line

  useEffect(() => {
    if (form.para_birimi !== 'TRY') {
      api.get(`/kur/${form.para_birimi}`).then((r) => setForm((f) => ({ ...f, kur: String(r.data.kur) }))).catch(() => {});
    }
  }, [form.para_birimi]);

  const tlKarsiligi = form.birim_fiyat && form.miktar ? Number(form.birim_fiyat) * Number(form.kur || 1) * Number(form.miktar) : null;

  async function ekle(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      const dolduruldu = !!form.birim_fiyat;
      await api.post(`/yedek-parcalar/${parca.id}/hareketler`, {
        tarih: form.tarih, yon: form.yon, miktar: Number(form.miktar),
        birim_fiyat_orijinal: form.birim_fiyat ? Number(form.birim_fiyat) : null,
        para_birimi: form.para_birimi, kur: Number(form.kur || 1),
        ilgili_cari_id: form.ilgili_cari_id ? Number(form.ilgili_cari_id) : null,
        aciklama: form.aciklama || null,
        odeme_yontemi: dolduruldu ? form.odeme_yontemi : null,
        banka_hesap_id: dolduruldu && form.odeme_yontemi === 'BANKA' ? Number(form.banka_hesap_id) : null,
        ilgili_stok_seri_no_id: form.ilgili_stok_seri_no_id ? Number(form.ilgili_stok_seri_no_id) : null,
      });
      setFormAcik(false);
      setForm({
        tarih: new Date().toISOString().slice(0, 10), yon: 'GIRIS', miktar: '', birim_fiyat: '',
        para_birimi: 'TRY', kur: '1', ilgili_cari_id: '', aciklama: '', odeme_yontemi: 'NAKIT', banka_hesap_id: '',
        ilgili_stok_seri_no_id: '',
      });
      yukle();
      onDegisti();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  async function sil(id) {
    if (!window.confirm('Bu hareketi silmek istediğinize emin misiniz? Stok miktarı ve varsa ilişkili Kasa/Banka hareketi geri alınacak.')) return;
    try {
      await api.delete(`/yedek-parcalar/hareketler/${id}`);
      yukle();
      onDegisti();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  return (
    <Kart style={{ margin: '8px 16px 16px', background: 'var(--zemin)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{parca.ad} — hareketler (mevcut: {parca.mevcut_miktar} {parca.birim})</div>
        <Buton variant="ikincil" onClick={onKapat}>Kapat</Buton>
      </div>
      <HataMesaji>{hata}</HataMesaji>

      <div style={{ marginBottom: 12 }}>
        <Buton onClick={() => setFormAcik((a) => !a)}>{formAcik ? 'Kapat' : '+ Hareket ekle'}</Buton>
      </div>

      {formAcik && (
        <form onSubmit={ekle} style={{ marginBottom: 16, padding: 12, background: 'white', border: '1px solid var(--kenarlik)', borderRadius: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Alan etiket="Yön">
              <select value={form.yon} onChange={(e) => setForm((f) => ({ ...f, yon: e.target.value }))} style={girdiStili}>
                <option value="GIRIS">Giriş (Satınalma)</option>
                <option value="CIKIS">Çıkış (Kullanım/Satış)</option>
              </select>
            </Alan>
            <Alan etiket="Tarih">
              <input required type="date" value={form.tarih} onChange={(e) => setForm((f) => ({ ...f, tarih: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket={`Miktar (${parca.birim})`}>
              <input required type="number" step="0.01" value={form.miktar} onChange={(e) => setForm((f) => ({ ...f, miktar: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket={form.yon === 'GIRIS' ? 'Alış fiyatı (opsiyonel — güncel fiyatı günceller)' : 'Satış fiyatı (opsiyonel — boşsa sadece kullanım/sarf sayılır)'}>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="number" step="0.01" value={form.birim_fiyat} onChange={(e) => setForm((f) => ({ ...f, birim_fiyat: e.target.value }))} style={{ ...girdiStili, flex: 1 }} />
                <select value={form.para_birimi} onChange={(e) => setForm((f) => ({ ...f, para_birimi: e.target.value }))} style={{ ...girdiStili, width: 80 }}>
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
            {tlKarsiligi != null && (
              <div style={{ fontSize: 12, color: 'var(--metin-ikincil)', alignSelf: 'end', paddingBottom: 8 }}>
                Toplam ≈ {paraFormat(tlKarsiligi)}
              </div>
            )}
            {form.birim_fiyat && (
              <>
                <Alan etiket={`Ödeme yöntemi (${form.yon === 'GIRIS' ? 'kasadan çıkar' : 'kasaya girer'})`}>
                  <select value={form.odeme_yontemi} onChange={(e) => setForm((f) => ({ ...f, odeme_yontemi: e.target.value }))} style={girdiStili}>
                    <option value="NAKIT">Nakit (Ana Kasa)</option>
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
              </>
            )}
            <Alan etiket="İlgili cari (opsiyonel)">
              <AramaliSecici secenekler={cariler} deger={form.ilgili_cari_id} onDegistir={(v) => setForm((f) => ({ ...f, ilgili_cari_id: v }))} etiketFn={(c) => c.unvan} />
            </Alan>
            <Alan etiket="İlgili ürün (opsiyonel — örn. garanti kapsamında hangi forklifte takıldı)">
              <AramaliSecici secenekler={urunSecenekleri} deger={form.ilgili_stok_seri_no_id} onDegistir={(v) => setForm((f) => ({ ...f, ilgili_stok_seri_no_id: v }))} etiketFn={(u) => u.etiket} />
            </Alan>
            <Alan etiket="Açıklama (örn. 'garanti kapsamında bedelsiz değişim')">
              <input value={form.aciklama} onChange={(e) => setForm((f) => ({ ...f, aciklama: e.target.value }))} style={girdiStili} />
            </Alan>
          </div>
          {!form.birim_fiyat && (
            <div style={{ fontSize: 12, color: 'var(--metin-ikincil)', marginTop: 8 }}>
              Fiyat girilmediği için bu hareket Kasa/Banka'ya yansımayacak — sadece stok miktarını değiştirecek.
            </div>
          )}
          <Buton type="submit" disabled={kaydediliyor} style={{ marginTop: 10 }}>{kaydediliyor ? 'Kaydediliyor...' : 'Kaydet'}</Buton>
        </form>
      )}

      {hareketler === null ? (
        <div style={{ color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
      ) : hareketler.length === 0 ? (
        <BosDurum baslik="Henüz hareket yok" />
      ) : (
        <table style={{ width: '100%', background: 'white' }}>
          <thead>
            <tr>
              {['Tarih', 'Yön', 'Miktar', 'Birim Fiyat', 'TL Karşılığı', 'Kâr', 'Ödeme', 'Cari', 'İlgili Ürün', 'Açıklama', ''].map((b) => (
                <th key={b} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--metin-ikincil)' }}>{b}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hareketler.map((h) => (
              <tr key={h.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                <td style={{ padding: '8px 12px' }}>{tarihFormat(h.tarih)}</td>
                <td style={{ padding: '8px 12px' }}>
                  <Etiket ton={h.yon === 'GIRIS' ? 'yesil' : 'kirmizi'}>{h.yon === 'GIRIS' ? 'Giriş' : 'Çıkış'}</Etiket>
                </td>
                <td style={{ padding: '8px 12px', fontWeight: 500 }}>{h.miktar} {parca.birim}</td>
                <td style={{ padding: '8px 12px', color: 'var(--metin-ikincil)' }}>
                  {h.birim_fiyat_orijinal != null ? paraFormat(h.birim_fiyat_orijinal, h.para_birimi) : '—'}
                </td>
                <td style={{ padding: '8px 12px', color: 'var(--metin-ikincil)' }}>
                  {h.para_birimi !== 'TRY' && h.birim_fiyat_try != null ? paraFormat(h.birim_fiyat_try) : (h.para_birimi === 'TRY' ? '—' : '—')}
                </td>
                <td style={{ padding: '8px 12px', fontWeight: 500, color: h.kar_try != null ? (Number(h.kar_try) >= 0 ? 'var(--yesil)' : 'var(--kirmizi)') : 'var(--metin-soluk)' }}>
                  {h.kar_try != null ? paraFormat(h.kar_try) : '—'}
                </td>
                <td style={{ padding: '8px 12px', color: 'var(--metin-ikincil)' }}>
                  {h.odeme_yontemi === 'NAKIT' ? 'Nakit' : h.odeme_yontemi === 'BANKA' ? 'Banka' : '—'}
                </td>
                <td style={{ padding: '8px 12px', color: 'var(--metin-ikincil)' }}>{h.ilgili_cari_unvan || '—'}</td>
                <td style={{ padding: '8px 12px', color: 'var(--metin-ikincil)' }}>{h.ilgili_urun_bilgisi || '—'}</td>
                <td style={{ padding: '8px 12px', color: 'var(--metin-ikincil)' }}>{h.aciklama || '—'}</td>
                <td style={{ padding: '8px 12px' }}>
                  <button onClick={() => sil(h.id)} style={eylemChipStili('kirmizi')}>Sil</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Kart>
  );
}

export default function YedekParcaSayfasi() {
  const [liste, setListe] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(null);
  const [formAcik, setFormAcik] = useState(false);
  const [duzenlenen, setDuzenlenen] = useState(null);
  const [form, setForm] = useState(bosParcaFormu());
  const [hareketAcikId, setHareketAcikId] = useState(null);
  const siralama = useSiralama();
  const cariler = useCariler();

  function yukle() {
    setYukleniyor(true);
    api.get('/yedek-parcalar')
      .then((r) => setListe(r.data))
      .catch((e) => setHata(hataMesajiCikar(e)))
      .finally(() => setYukleniyor(false));
  }
  useEffect(yukle, []);

  function yeniAc() {
    setDuzenlenen(null);
    setForm(bosParcaFormu());
    setFormAcik(true);
  }

  function duzenlemeyeBasla(p) {
    setDuzenlenen(p);
    setForm({
      ad: p.ad, birim: p.birim, birim_fiyat_try: String(p.birim_fiyat_try),
      min_stok_seviyesi: String(p.min_stok_seviyesi ?? 0), notlar: p.notlar || '', sifre: '',
    });
    setFormAcik(true);
  }

  function formuKapat() {
    setFormAcik(false);
    setDuzenlenen(null);
    setForm(bosParcaFormu());
  }

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    try {
      const govde = {
        ad: form.ad, birim: form.birim, birim_fiyat_try: Number(form.birim_fiyat_try || 0),
        min_stok_seviyesi: Number(form.min_stok_seviyesi || 0), notlar: form.notlar || null,
      };
      if (duzenlenen) {
        await api.put(`/yedek-parcalar/${duzenlenen.id}`, { ...govde, sifre: form.sifre });
      } else {
        await api.post('/yedek-parcalar', govde);
      }
      formuKapat();
      yukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  async function sil(p) {
    if (!window.confirm(`${p.ad} kaydını silmek istediğinize emin misiniz?`)) return;
    try {
      await api.delete(`/yedek-parcalar/${p.id}`);
      yukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  const toplamDeger = liste.reduce((acc, p) => acc + Number(p.mevcut_miktar) * Number(p.birim_fiyat_try), 0);
  const azalanlar = liste.filter((p) => p.min_stok_seviyesi != null && Number(p.mevcut_miktar) <= Number(p.min_stok_seviyesi));

  return (
    <div>
      <SayfaBasligi
        baslik="Yedek Parça / Sarf Malzeme"
        aciklama="Seri no'suz, adet/miktar bazında takip edilen küçük parçalar (lastik, akü, hidrolik yağ vb.)"
        eylem={!formAcik && <Buton onClick={yeniAc}>+ Yeni parça</Buton>}
      />
      <HataMesaji>{hata}</HataMesaji>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Kart style={{ flex: '1 1 200px' }}>
          <div style={{ fontSize: 11.5, color: 'var(--metin-ikincil)', marginBottom: 4 }}>Toplam stok değeri</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{paraFormat(toplamDeger)}</div>
        </Kart>
        <Kart style={{ flex: '1 1 200px' }}>
          <div style={{ fontSize: 11.5, color: 'var(--metin-ikincil)', marginBottom: 4 }}>Kalem sayısı</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{liste.length}</div>
        </Kart>
        {azalanlar.length > 0 && (
          <Kart style={{ flex: '1 1 200px', border: '1px solid var(--kirmizi)', background: 'var(--kirmizi-acik, #fde2e2)' }}>
            <div style={{ fontSize: 11.5, color: 'var(--kirmizi)', marginBottom: 4 }}>⚠ Min. seviyenin altında</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--kirmizi)' }}>{azalanlar.length} kalem</div>
          </Kart>
        )}
      </div>

      {formAcik && (
        <Kart style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{duzenlenen ? 'Parçayı düzenle' : 'Yeni parça'}</div>
          <form onSubmit={kaydet} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Alan etiket="Ad">
              <input required value={form.ad} onChange={(e) => setForm((f) => ({ ...f, ad: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Birim">
              <select value={form.birim} onChange={(e) => setForm((f) => ({ ...f, birim: e.target.value }))} style={girdiStili}>
                <option value="ADET">Adet</option>
                <option value="LITRE">Litre</option>
                <option value="KG">Kg</option>
                <option value="METRE">Metre</option>
                <option value="KUTU">Kutu</option>
              </select>
            </Alan>
            <Alan etiket="Birim fiyat (TL)">
              <input required type="number" step="0.01" value={form.birim_fiyat_try} onChange={(e) => setForm((f) => ({ ...f, birim_fiyat_try: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Min. stok seviyesi (uyarı için)">
              <input type="number" step="0.01" value={form.min_stok_seviyesi} onChange={(e) => setForm((f) => ({ ...f, min_stok_seviyesi: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Notlar">
              <input value={form.notlar} onChange={(e) => setForm((f) => ({ ...f, notlar: e.target.value }))} style={girdiStili} />
            </Alan>
            {duzenlenen && (
              <Alan etiket="Şifreniz (onay için zorunlu)">
                <input required type="password" value={form.sifre} onChange={(e) => setForm((f) => ({ ...f, sifre: e.target.value }))} style={girdiStili} placeholder="Giriş şifreniz" />
              </Alan>
            )}
            <div style={{ alignSelf: 'end', display: 'flex', gap: 8 }}>
              <Buton type="submit">{duzenlenen ? 'Değişiklikleri kaydet' : 'Kaydet'}</Buton>
              <Buton type="button" variant="ikincil" onClick={formuKapat}>Vazgeç</Buton>
            </div>
          </form>
        </Kart>
      )}

      <Kart style={{ padding: 0 }}>
        {yukleniyor ? (
          <div style={{ padding: 20, color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
        ) : liste.length === 0 ? (
          <BosDurum baslik="Henüz yedek parça/sarf malzeme kaydı yok" aciklama="Yukarıdan yeni bir parça ekleyin." />
        ) : (
          <table>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                <SiraliBaslik alanAdi="ad" siralama={siralama}>Ad</SiraliBaslik>
                <SiraliBaslik alanAdi="birim" siralama={siralama}>Birim</SiraliBaslik>
                <SiraliBaslik alanAdi="mevcut_miktar" siralama={siralama}>Mevcut Miktar</SiraliBaslik>
                <SiraliBaslik alanAdi="birim_fiyat_try" siralama={siralama}>Birim Fiyat</SiraliBaslik>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>Toplam Değer</th>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {siralama.sirala(liste, (item, alan) => item[alan]).map((p) => {
                const azaldi = p.min_stok_seviyesi != null && Number(p.mevcut_miktar) <= Number(p.min_stok_seviyesi);
                return (
                  <Fragment key={p.id}>
                    <tr style={{ borderTop: '1px solid var(--kenarlik)', background: azaldi ? 'var(--kirmizi-acik, #fde2e2)' : 'transparent' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                        {p.ad} {azaldi && <span title="Minimum stok seviyesinin altında" style={{ color: 'var(--kirmizi)' }}>⚠</span>}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--metin-ikincil)' }}>{p.birim}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 500, color: azaldi ? 'var(--kirmizi)' : 'inherit' }}>{p.mevcut_miktar}</td>
                      <td style={{ padding: '12px 16px' }}>{paraFormat(p.birim_fiyat_try)}</td>
                      <td style={{ padding: '12px 16px' }}>{paraFormat(Number(p.mevcut_miktar) * Number(p.birim_fiyat_try))}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => duzenlemeyeBasla(p)} style={eylemChipStili('notr')}>Düzenle</button>
                          <button
                            onClick={() => setHareketAcikId((mevcut) => (mevcut === p.id ? null : p.id))}
                            style={eylemChipStili('lacivert')}
                          >
                            {hareketAcikId === p.id ? 'Kapat' : 'Hareketler'}
                          </button>
                          <button onClick={() => sil(p)} style={eylemChipStili('kirmizi')}>Sil</button>
                        </div>
                      </td>
                    </tr>
                    {hareketAcikId === p.id && (
                      <tr>
                        <td colSpan={6} style={{ padding: 0 }}>
                          <HareketlerPaneli
                            parca={p}
                            cariler={cariler}
                            onKapat={() => setHareketAcikId(null)}
                            onDegisti={yukle}
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
