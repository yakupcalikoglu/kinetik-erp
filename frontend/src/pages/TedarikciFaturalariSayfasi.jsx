import { useEffect, useState, Fragment } from 'react';
import { api, hataMesajiCikar, ozelOnayIste } from '../api/client';
import { Kart, SayfaBasligi, Buton, Alan, girdiStili, HataMesaji, BosDurum, paraFormat, eylemChipStili, ParaGirdisi, TabloIskeleti, MALIYET_TIP_METIN, DahaFazlaMenu, useTarihGruplama, YilBasligi, AyBasligi, BelgeYoneticisi } from '../components/Ortak';
import { excelIndir } from '../utils/disaAktarma';
import AramaliSecici from '../components/AramaliSecici';

function DuzenleFaturaFormu({ fatura, onKaydedildi, onVazgec }) {
  const [form, setForm] = useState({
    fatura_no: fatura.fatura_no || '', tarih: fatura.tarih, tutar: String(fatura.tutar),
    para_birimi: fatura.para_birimi, aciklama: fatura.aciklama || '',
    varsayilan_maliyet_tipi: fatura.varsayilan_maliyet_tipi || 'DIGER', sifre: '',
  });
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      await api.put(`/tedarikci-faturalari/${fatura.id}`, {
        fatura_no: form.fatura_no || null,
        tarih: form.tarih,
        tutar: Number(form.tutar),
        para_birimi: form.para_birimi,
        aciklama: form.aciklama || null,
        varsayilan_maliyet_tipi: form.varsayilan_maliyet_tipi,
        sifre: form.sifre,
      });
      onKaydedildi();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  return (
    <Kart style={{ marginBottom: 16, borderLeft: '4px solid var(--amber)' }}>
      <form onSubmit={kaydet}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
          Fatura Düzenle — {fatura.tedarikci_unvan}
        </div>
        <HataMesaji>{hata}</HataMesaji>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Alan etiket="Fatura No">
            <input value={form.fatura_no} onChange={(e) => setForm((f) => ({ ...f, fatura_no: e.target.value }))} style={girdiStili} />
          </Alan>
          <Alan etiket="Tarih">
            <input required type="date" value={form.tarih} onChange={(e) => setForm((f) => ({ ...f, tarih: e.target.value }))} style={girdiStili} />
          </Alan>
          <Alan etiket="Tutar">
            <ParaGirdisi required value={form.tutar} onChange={(v) => setForm((f) => ({ ...f, tutar: v }))} />
          </Alan>
          <Alan etiket="Para Birimi">
            <select value={form.para_birimi} onChange={(e) => setForm((f) => ({ ...f, para_birimi: e.target.value }))} style={girdiStili}>
              <option value="TRY">TRY</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </Alan>
          <Alan etiket="Masraf Türü">
            <select value={form.varsayilan_maliyet_tipi} onChange={(e) => setForm((f) => ({ ...f, varsayilan_maliyet_tipi: e.target.value }))} style={girdiStili}>
              {Object.entries(MALIYET_TIP_METIN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Alan>
          <Alan etiket="Açıklama">
            <input value={form.aciklama} onChange={(e) => setForm((f) => ({ ...f, aciklama: e.target.value }))} style={girdiStili} />
          </Alan>
          <Alan etiket="Şifreniz (onay için zorunlu)">
            <input required type="password" value={form.sifre} onChange={(e) => setForm((f) => ({ ...f, sifre: e.target.value }))} style={girdiStili} />
          </Alan>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}</Buton>
          <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
        </div>
      </form>
    </Kart>
  );
}

function YeniFaturaFormu({ onKaydedildi, onVazgec }) {
  const [cariler, setCariler] = useState([]);
  const [form, setForm] = useState({
    tedarikci_cari_id: '', fatura_no: '', tarih: new Date().toISOString().slice(0, 10),
    tutar: '', para_birimi: 'TRY', aciklama: '', varsayilan_maliyet_tipi: 'DIGER',
  });
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => { api.get('/cariler').then((r) => setCariler(r.data)).catch(() => {}); }, []);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      await api.post('/tedarikci-faturalari', {
        tedarikci_cari_id: Number(form.tedarikci_cari_id),
        fatura_no: form.fatura_no || null,
        tarih: form.tarih,
        tutar: Number(form.tutar),
        para_birimi: form.para_birimi,
        aciklama: form.aciklama || null,
        varsayilan_maliyet_tipi: form.varsayilan_maliyet_tipi,
      });
      onKaydedildi();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  return (
    <Kart style={{ marginBottom: 16 }}>
      <form onSubmit={kaydet}>
        <HataMesaji>{hata}</HataMesaji>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Alan etiket="Firma (tedarikçi / hizmet sağlayıcı)">
            <select required value={form.tedarikci_cari_id} onChange={(e) => setForm((f) => ({ ...f, tedarikci_cari_id: e.target.value }))} style={girdiStili}>
              <option value="">Seçin...</option>
              {cariler.map((c) => <option key={c.id} value={c.id}>{c.unvan}</option>)}
            </select>
          </Alan>
          <Alan etiket="Fatura No">
            <input value={form.fatura_no} onChange={(e) => setForm((f) => ({ ...f, fatura_no: e.target.value }))} style={girdiStili} />
          </Alan>
          <Alan etiket="Tarih">
            <input required type="date" value={form.tarih} onChange={(e) => setForm((f) => ({ ...f, tarih: e.target.value }))} style={girdiStili} />
          </Alan>
          <Alan etiket="Tutar">
            <ParaGirdisi required value={form.tutar} onChange={(v) => setForm((f) => ({ ...f, tutar: v }))} />
          </Alan>
          <Alan etiket="Para Birimi">
            <select value={form.para_birimi} onChange={(e) => setForm((f) => ({ ...f, para_birimi: e.target.value }))} style={girdiStili}>
              <option value="TRY">TRY</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </Alan>
          <Alan etiket="Bu fatura hangi masraf türü? (navlun, antrepo, gümrük vb.)">
            <select value={form.varsayilan_maliyet_tipi} onChange={(e) => setForm((f) => ({ ...f, varsayilan_maliyet_tipi: e.target.value }))} style={girdiStili}>
              {Object.entries(MALIYET_TIP_METIN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Alan>
          <Alan etiket="Açıklama">
            <input value={form.aciklama} onChange={(e) => setForm((f) => ({ ...f, aciklama: e.target.value }))} style={girdiStili} />
          </Alan>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : 'Faturayı Kaydet'}</Buton>
          <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
        </div>
      </form>
    </Kart>
  );
}

function OdemeFormu({ fatura, kalanBakiye, onKaydedildi, onVazgec }) {
  const [siparisler, setSiparisler] = useState([]);
  const [bankaHesaplari, setBankaHesaplari] = useState([]);
  const [siparisUrunleri, setSiparisUrunleri] = useState(null);
  const [secilenUrunIdleri, setSecilenUrunIdleri] = useState(new Set());
  const [stokKartlari, setStokKartlari] = useState([]);
  const [cariler, setCariler] = useState([]);
  const [form, setForm] = useState({
    tutar: String(kalanBakiye), odeme_tarihi: new Date().toISOString().slice(0, 10),
    odeme_yontemi: 'BANKA', banka_hesap_id: '', kur: '1',
    dagitim_tipi: 'URUNLER', siparis_id: '', yontem: 'ORANSAL',
    maliyet_tipi: fatura.varsayilan_maliyet_tipi || 'DIGER', aciklama: '',
  });
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  function urunEtiketiOlustur(u) {
    const kart = stokKartlari.find((k) => k.id === u.stok_karti_id);
    const urunAdi = kart ? `${kart.marka} ${kart.model}` : '';
    let etiket = `${u.seri_no}${urunAdi ? ' — ' + urunAdi : ''}`;
    if (u.musteri_cari_id) {
      const musteri = cariler.find((c) => c.id === u.musteri_cari_id);
      etiket += ` — SATILDI (${musteri ? musteri.unvan : 'müşteri #' + u.musteri_cari_id})`;
    }
    return etiket;
  }

  useEffect(() => {
    api.get('/siparisler').then((r) => {
      const siralanmis = [...r.data].sort((a, b) => (b.siparis_tarihi || '').localeCompare(a.siparis_tarihi || ''));
      setSiparisler(siralanmis);
    }).catch(() => {});
    api.get('/banka-hesaplari').then((r) => setBankaHesaplari(r.data)).catch(() => {});
    api.get('/stok-kartlari').then((r) => setStokKartlari(r.data)).catch(() => {});
    api.get('/cariler').then((r) => setCariler(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (fatura.para_birimi === 'TRY') { setForm((f) => ({ ...f, kur: '1' })); return; }
    api.get(`/kur/${fatura.para_birimi}`).then((r) => setForm((f) => ({ ...f, kur: r.data.kur }))).catch(() => {});
  }, [fatura.para_birimi]);

  // Siparis sectiginde ürünler (checkbox'larla secilebilir hale gelsin
  // diye) her zaman cekilir - artik "URUN" moduna ozel degil, "URUNLER"
  // (secili birkacina/tumune dagitim) modu icin de gerekli. Hata ARTIK
  // sessizce yutulmuyor - kullanici "urunler gelmiyor" derken aslinda
  // BASARISIZ bir istegi fark edemiyordu.
  useEffect(() => {
    if (!form.siparis_id) { setSiparisUrunleri(null); setSecilenUrunIdleri(new Set()); return; }
    setHata(null);
    api.get('/stok-seri-no', { params: { siparis_id: form.siparis_id } }).then((r) => {
      setSiparisUrunleri(r.data);
      setSecilenUrunIdleri(new Set(r.data.map((u) => u.id))); // varsayilan: hepsi secili
    }).catch((e) => setHata(hataMesajiCikar(e)));
  }, [form.siparis_id]);

  function tumunuSecToggle(e) {
    if (e.target.checked) setSecilenUrunIdleri(new Set((siparisUrunleri || []).map((u) => u.id)));
    else setSecilenUrunIdleri(new Set());
  }
  function urunSecimDegistir(id) {
    setSecilenUrunIdleri((mevcut) => {
      const yeni = new Set(mevcut);
      if (yeni.has(id)) yeni.delete(id); else yeni.add(id);
      return yeni;
    });
  }

  const tumuSecili = siparisUrunleri && siparisUrunleri.length > 0 && secilenUrunIdleri.size === siparisUrunleri.length;

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    if (!form.siparis_id) { setHata('Lütfen bir sipariş seçin.'); return; }
    if (secilenUrunIdleri.size === 0) { setHata('En az bir ürün seçmelisiniz.'); return; }

    // Kaydetmeden ONCE - secili ILK urun icin, AYNI turde/tutarda daha
    // once girilmis bir kayit var mi SESSIZCE kontrol et. Bu sayfa da
    // "Tedarikci Faturalari" akisinin kendisi oldugu icin, ayni faturayi
    // yanlislikla iki kez odemek COK KOLAY unutulan bir durumdur.
    const ilkUrunId = Array.from(secilenUrunIdleri)[0];
    const kontrolTutarTry = fatura.para_birimi === 'TRY' ? Number(form.tutar) : Number(form.tutar) * Number(form.kur);
    if (ilkUrunId && kontrolTutarTry > 0) {
      try {
        const { data: cakisma } = await api.get(`/stok-seri-no/${ilkUrunId}/olasi-cakisma`, {
          params: { tip: form.maliyet_tipi, tutar_try: kontrolTutarTry },
        });
        if (cakisma.bulundu) {
          const mesaj = `Bu ürün(ler)e ${cakisma.tarih} tarihinde ${paraFormat(cakisma.tutar_try)} tutarında, `
            + `${cakisma.tedarikci_unvan ? `"${cakisma.tedarikci_unvan}" firmasından ` : ''}`
            + `benzer bir masraf zaten girilmiş görünüyor. Yine de devam etmek istediğinize emin misiniz? `
            + `(Aynı masrafı iki kez öderseniz ürün maliyeti şişer.)`;
          if (!(await ozelOnayIste(mesaj))) return;
        }
      } catch {
        // Kontrol basarisiz olursa (ag hatasi vb.) kullaniciyi ENGELLEMEDEN devam et.
      }
    }

    setKaydediliyor(true);
    try {
      await api.post(`/tedarikci-faturalari/${fatura.id}/ode`, {
        tutar: Number(form.tutar),
        odeme_tarihi: form.odeme_tarihi,
        odeme_yontemi: form.odeme_yontemi,
        banka_hesap_id: form.odeme_yontemi === 'BANKA' ? Number(form.banka_hesap_id) : null,
        kur: Number(form.kur),
        dagitim_tipi: 'URUNLER',
        stok_seri_no_idleri: Array.from(secilenUrunIdleri),
        yontem: form.yontem,
        maliyet_tipi: form.maliyet_tipi,
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
    <div style={{ padding: 14, background: 'var(--zemin)', borderRadius: 8, marginTop: 8 }}>
      <form onSubmit={kaydet}>
        <HataMesaji>{hata}</HataMesaji>
        <div style={{ fontSize: 12.5, color: 'var(--metin-ikincil)', marginBottom: 10 }}>
          Kalan bakiye: <strong>{paraFormat(kalanBakiye, fatura.para_birimi)}</strong>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
          <Alan etiket={`Ödenecek tutar (${fatura.para_birimi})`}>
            <ParaGirdisi required value={form.tutar} onChange={(v) => setForm((f) => ({ ...f, tutar: v }))} />
          </Alan>
          <Alan etiket="Ödeme tarihi">
            <input required type="date" value={form.odeme_tarihi} onChange={(e) => setForm((f) => ({ ...f, odeme_tarihi: e.target.value }))} style={girdiStili} />
          </Alan>
          <Alan etiket="Ödeme yöntemi">
            <select value={form.odeme_yontemi} onChange={(e) => setForm((f) => ({ ...f, odeme_yontemi: e.target.value }))} style={girdiStili}>
              <option value="BANKA">Banka</option>
              <option value="NAKIT">Kasa (Nakit)</option>
            </select>
          </Alan>
          {form.odeme_yontemi === 'BANKA' && (
            <Alan etiket="Banka hesabı">
              <select required value={form.banka_hesap_id} onChange={(e) => setForm((f) => ({ ...f, banka_hesap_id: e.target.value }))} style={girdiStili}>
                <option value="">Seçin...</option>
                {bankaHesaplari.map((h) => (
                  <option key={h.id} value={h.id}>{h.banka_adi} — {h.hesap_adi || h.para_birimi}</option>
                ))}
              </select>
            </Alan>
          )}
          {fatura.para_birimi !== 'TRY' && (
            <Alan etiket={`Kur (${fatura.para_birimi}/TRY) — otomatik, değiştirilebilir`}>
              <input required type="number" step="0.0001" value={form.kur} onChange={(e) => setForm((f) => ({ ...f, kur: e.target.value }))} style={girdiStili} />
            </Alan>
          )}
          <Alan etiket="Maliyet tipi">
            <select value={form.maliyet_tipi} onChange={(e) => setForm((f) => ({ ...f, maliyet_tipi: e.target.value }))} style={girdiStili}>
              {Object.entries(MALIYET_TIP_METIN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Alan>
          <Alan etiket="Sipariş">
            <AramaliSecici
              secenekler={siparisler}
              deger={form.siparis_id}
              onDegistir={(v) => setForm((f) => ({ ...f, siparis_id: v }))}
              etiketFn={(s) => s.siparis_no}
              bosMetin="Sipariş no yazarak arayın..."
            />
          </Alan>
          <Alan etiket="Açıklama (opsiyonel — örn. 'TSE ücreti', 'İlave gümrük vergisi')">
            <input value={form.aciklama} onChange={(e) => setForm((f) => ({ ...f, aciklama: e.target.value }))} style={girdiStili} />
          </Alan>
        </div>

        {form.siparis_id && (
          <div style={{ marginTop: 4, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--metin-ikincil)' }}>Bu masraf hangi ürün(ler)e yansısın?</span>
              {siparisUrunleri && siparisUrunleri.length > 0 && (
                <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={tumuSecili} onChange={tumunuSecToggle} /> Tümünü seç
                </label>
              )}
            </div>
            <div style={{ background: 'white', border: '1px solid var(--kenarlik)', borderRadius: 7, padding: '6px 12px', maxHeight: 180, overflowY: 'auto' }}>
              {siparisUrunleri === null ? (
                <div style={{ fontSize: 12.5, color: 'var(--metin-soluk)', padding: '6px 0' }}>Yükleniyor...</div>
              ) : siparisUrunleri.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--metin-soluk)', padding: '6px 0' }}>Bu siparişte teslim alınmış ürün yok.</div>
              ) : (
                siparisUrunleri.map((u) => (
                  <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 13, cursor: 'pointer' }}>
                    <input type="checkbox" checked={secilenUrunIdleri.has(u.id)} onChange={() => urunSecimDegistir(u.id)} />
                    {urunEtiketiOlustur(u)}
                  </label>
                ))
              )}
            </div>
          </div>
        )}

        {secilenUrunIdleri.size > 1 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--metin-ikincil)', marginBottom: 6 }}>Dağıtım yöntemi</div>
            <div style={{ display: 'flex', gap: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                <input type="radio" name={`tf-yontem-${fatura.id}`} checked={form.yontem === 'ORANSAL'} onChange={() => setForm((f) => ({ ...f, yontem: 'ORANSAL' }))} />
                Ürün fiyatına oranla
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                <input type="radio" name={`tf-yontem-${fatura.id}`} checked={form.yontem === 'ESIT'} onChange={() => setForm((f) => ({ ...f, yontem: 'ESIT' }))} />
                Eşit bölüştür
              </label>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : 'Ödemeyi Kaydet'}</Buton>
          <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
        </div>
      </form>
    </div>
  );
}

// Daha once yapilmis bir odemeyi (Geri Al + Tekrar Ode yerine) TEK ADIMDA
// duzeltmek icin. Odeme.stok_seri_no_idleri'nden (yeni eklenen alan) hangi
// siparise ait oldugunu COZUP, o siparisin urunlerini onceden secili
// olarak gosterir - OdemeFormu ile AYNI checkbox akisini kullanir.
function OdemeDuzenleFormu({ fatura, odeme, onKaydedildi, onVazgec }) {
  const [bankaHesaplari, setBankaHesaplari] = useState([]);
  const [stokKartlari, setStokKartlari] = useState([]);
  const [cariler, setCariler] = useState([]);
  const [siparisUrunleri, setSiparisUrunleri] = useState(null);
  const [secilenUrunIdleri, setSecilenUrunIdleri] = useState(new Set(odeme.stok_seri_no_idleri || []));
  const [form, setForm] = useState({
    tutar: String(odeme.tutar), odeme_tarihi: odeme.odeme_tarihi,
    odeme_yontemi: odeme.odeme_yontemi, banka_hesap_id: odeme.banka_hesap_id ? String(odeme.banka_hesap_id) : '',
    kur: String(odeme.kur), yontem: 'ORANSAL', maliyet_tipi: odeme.maliyet_tipi, aciklama: '', sifre: '',
  });
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  function urunEtiketiOlustur(u) {
    const kart = stokKartlari.find((k) => k.id === u.stok_karti_id);
    const urunAdi = kart ? `${kart.marka} ${kart.model}` : '';
    let etiket = `${u.seri_no}${urunAdi ? ' — ' + urunAdi : ''}`;
    if (u.musteri_cari_id) {
      const musteri = cariler.find((c) => c.id === u.musteri_cari_id);
      etiket += ` — SATILDI (${musteri ? musteri.unvan : 'müşteri #' + u.musteri_cari_id})`;
    }
    return etiket;
  }

  useEffect(() => {
    api.get('/banka-hesaplari').then((r) => setBankaHesaplari(r.data)).catch(() => {});
    api.get('/stok-kartlari').then((r) => setStokKartlari(r.data)).catch(() => {});
    api.get('/cariler').then((r) => setCariler(r.data)).catch(() => {});
  }, []);

  // Onceden secili urunlerden (odeme.stok_seri_no_idleri) BIRINI cekip,
  // hangi siparise ait oldugunu bulup, o siparisin TUM urunlerini getirir.
  useEffect(() => {
    const ilkUrunId = (odeme.stok_seri_no_idleri || [])[0];
    if (!ilkUrunId) { setSiparisUrunleri([]); return; }
    api.get(`/stok-seri-no/${ilkUrunId}`).then((r) => {
      const siparisId = r.data.siparis_id;
      if (!siparisId) { setSiparisUrunleri([]); return; }
      api.get('/stok-seri-no', { params: { siparis_id: siparisId } }).then((r2) => setSiparisUrunleri(r2.data)).catch(() => setSiparisUrunleri([]));
    }).catch(() => setSiparisUrunleri([]));
  }, [odeme.id]); // eslint-disable-line

  function tumunuSecToggle(e) {
    if (e.target.checked) setSecilenUrunIdleri(new Set((siparisUrunleri || []).map((u) => u.id)));
    else setSecilenUrunIdleri(new Set());
  }
  function urunSecimDegistir(id) {
    setSecilenUrunIdleri((mevcut) => {
      const yeni = new Set(mevcut);
      if (yeni.has(id)) yeni.delete(id); else yeni.add(id);
      return yeni;
    });
  }
  const tumuSecili = siparisUrunleri && siparisUrunleri.length > 0 && secilenUrunIdleri.size === siparisUrunleri.length;

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    if (secilenUrunIdleri.size === 0) { setHata('En az bir ürün seçmelisiniz.'); return; }
    setKaydediliyor(true);
    try {
      await api.put(`/tedarikci-faturalari/odemeler/${odeme.id}/duzenle`, {
        sifre: form.sifre,
        tutar: Number(form.tutar), odeme_tarihi: form.odeme_tarihi, odeme_yontemi: form.odeme_yontemi,
        banka_hesap_id: form.odeme_yontemi === 'BANKA' ? Number(form.banka_hesap_id) : null,
        kur: Number(form.kur), stok_seri_no_idleri: Array.from(secilenUrunIdleri),
        yontem: form.yontem, maliyet_tipi: form.maliyet_tipi, aciklama: form.aciklama || null,
      });
      onKaydedildi();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  return (
    <div style={{ padding: 14, background: 'var(--zemin)', borderRadius: 8, marginTop: 8, borderLeft: '4px solid var(--amber)' }}>
      <form onSubmit={kaydet}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Ödemeyi Düzenle</div>
        <HataMesaji>{hata}</HataMesaji>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          <Alan etiket={`Tutar (${fatura.para_birimi})`}>
            <ParaGirdisi required value={form.tutar} onChange={(v) => setForm((f) => ({ ...f, tutar: v }))} />
          </Alan>
          <Alan etiket="Ödeme tarihi">
            <input required type="date" value={form.odeme_tarihi} onChange={(e) => setForm((f) => ({ ...f, odeme_tarihi: e.target.value }))} style={girdiStili} />
          </Alan>
          <Alan etiket="Ödeme yöntemi">
            <select value={form.odeme_yontemi} onChange={(e) => setForm((f) => ({ ...f, odeme_yontemi: e.target.value }))} style={girdiStili}>
              <option value="BANKA">Banka</option>
              <option value="NAKIT">Kasa (Nakit)</option>
            </select>
          </Alan>
          {form.odeme_yontemi === 'BANKA' && (
            <Alan etiket="Banka hesabı">
              <select required value={form.banka_hesap_id} onChange={(e) => setForm((f) => ({ ...f, banka_hesap_id: e.target.value }))} style={girdiStili}>
                <option value="">Seçin...</option>
                {bankaHesaplari.map((h) => (
                  <option key={h.id} value={h.id}>{h.banka_adi} — {h.hesap_adi || h.para_birimi}</option>
                ))}
              </select>
            </Alan>
          )}
          {fatura.para_birimi !== 'TRY' && (
            <Alan etiket={`Kur (${fatura.para_birimi}/TRY)`}>
              <input required type="number" step="0.0001" value={form.kur} onChange={(e) => setForm((f) => ({ ...f, kur: e.target.value }))} style={girdiStili} />
            </Alan>
          )}
          <Alan etiket="Maliyet tipi">
            <select value={form.maliyet_tipi} onChange={(e) => setForm((f) => ({ ...f, maliyet_tipi: e.target.value }))} style={girdiStili}>
              {Object.entries(MALIYET_TIP_METIN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Alan>
          <Alan etiket="Açıklama (opsiyonel)">
            <input value={form.aciklama} onChange={(e) => setForm((f) => ({ ...f, aciklama: e.target.value }))} style={girdiStili} />
          </Alan>
        </div>

        <div style={{ marginTop: 4, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--metin-ikincil)' }}>Bu masraf hangi ürün(ler)e yansısın?</span>
            {siparisUrunleri && siparisUrunleri.length > 0 && (
              <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={tumuSecili} onChange={tumunuSecToggle} /> Tümünü seç
              </label>
            )}
          </div>
          <div style={{ background: 'white', border: '1px solid var(--kenarlik)', borderRadius: 7, padding: '6px 12px', maxHeight: 180, overflowY: 'auto' }}>
            {siparisUrunleri === null ? (
              <div style={{ fontSize: 12.5, color: 'var(--metin-soluk)', padding: '6px 0' }}>Yükleniyor...</div>
            ) : siparisUrunleri.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--metin-soluk)', padding: '6px 0' }}>Ürün bilgisi bulunamadı.</div>
            ) : (
              siparisUrunleri.map((u) => (
                <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={secilenUrunIdleri.has(u.id)} onChange={() => urunSecimDegistir(u.id)} />
                  {urunEtiketiOlustur(u)}
                </label>
              ))
            )}
          </div>
        </div>

        {secilenUrunIdleri.size > 1 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--metin-ikincil)', marginBottom: 6 }}>Dağıtım yöntemi</div>
            <div style={{ display: 'flex', gap: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                <input type="radio" name={`od-duzenle-yontem-${odeme.id}`} checked={form.yontem === 'ORANSAL'} onChange={() => setForm((f) => ({ ...f, yontem: 'ORANSAL' }))} />
                Ürün fiyatına oranla
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                <input type="radio" name={`od-duzenle-yontem-${odeme.id}`} checked={form.yontem === 'ESIT'} onChange={() => setForm((f) => ({ ...f, yontem: 'ESIT' }))} />
                Eşit bölüştür
              </label>
            </div>
          </div>
        )}

        <Alan etiket="Şifreniz (onay için zorunlu)">
          <input required type="password" value={form.sifre} onChange={(e) => setForm((f) => ({ ...f, sifre: e.target.value }))} style={girdiStili} />
        </Alan>

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}</Buton>
          <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
        </div>
      </form>
    </div>
  );
}

export default function TedarikciFaturalariSayfasi() {
  const [faturalar, setFaturalar] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(null);
  const [formAcik, setFormAcik] = useState(false);
  const [odemeAcikId, setOdemeAcikId] = useState(null);
  const [detayAcikId, setDetayAcikId] = useState(null);
  const [duzenleAcikOdemeId, setDuzenleAcikOdemeId] = useState(null);
  const [duzenleAcikId, setDuzenleAcikId] = useState(null);
  const [belgeAcikId, setBelgeAcikId] = useState(null);
  const [secilenIdler, setSecilenIdler] = useState(new Set());

  function yukle() {
    setYukleniyor(true);
    api.get('/tedarikci-faturalari')
      .then((r) => setFaturalar(r.data))
      .catch((e) => setHata(hataMesajiCikar(e)))
      .finally(() => setYukleniyor(false));
  }
  useEffect(yukle, []);

  async function sil(fatura) {
    if (!(await ozelOnayIste(`${fatura.fatura_no || '#' + fatura.id} numaralı faturayı silmek istediğinize emin misiniz?`))) return;
    try {
      await api.delete(`/tedarikci-faturalari/${fatura.id}`);
      yukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  async function odemeGeriAl(odeme) {
    if (!(await ozelOnayIste('Bu ödemeyi geri almak istediğinize emin misiniz? Oluşan Kasa/Banka hareketi VE ilgili ürüne yansıyan maliyet kalemi silinecek.'))) return;
    try {
      await api.put(`/tedarikci-faturalari/odemeler/${odeme.id}/geri-al`);
      yukle();
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
    if (!(await ozelOnayIste(`${secilenIdler.size} faturayı silmek istediğinize emin misiniz?`))) return;
    setHata(null);
    let basarili = 0;
    const basarisizlar = [];
    for (const id of secilenIdler) {
      try {
        await api.delete(`/tedarikci-faturalari/${id}`);
        basarili += 1;
      } catch (err) {
        basarisizlar.push(id);
      }
    }
    setSecilenIdler(new Set());
    yukle();
    if (basarisizlar.length > 0) {
      setHata(`${basarili} fatura silindi, ${basarisizlar.length} fatura silinemedi (muhtemelen ödemesi olan faturalar önce ödemeleri geri almanızı gerektirir).`);
    }
  }

  function secilenleriExceleAktar() {
    const secilenFaturalar = faturalar.filter((f) => secilenIdler.has(f.id));
    excelIndir(
      secilenFaturalar.map((f) => ({
        'Firma': f.tedarikci_unvan || '', 'Fatura No': f.fatura_no || '', 'Masraf Türü': MALIYET_TIP_METIN[f.varsayilan_maliyet_tipi] || f.varsayilan_maliyet_tipi,
        'Tarih': f.tarih, 'Tutar': Number(f.tutar), 'Ödenen': Number(f.toplam_odenen), 'Kalan': Number(f.kalan_bakiye), 'Para Birimi': f.para_birimi,
      })),
      'secilen_tedarikci_faturalari', 'Faturalar',
    );
  }

  const tarihGrup = useTarihGruplama(faturalar, 'tarih');

  return (
    <div>
      <SayfaBasligi
        baslik="Tedarikçi/Hizmet Faturaları"
        aciklama="Firmalardan gelen faturaları kaydedin; öderken hangi sipariş/ürüne maliyet olarak yansıyacağını seçin."
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Buton onClick={() => setFormAcik((a) => !a)}>{formAcik ? 'Kapat' : '+ Yeni Fatura'}</Buton>
      </div>
      <HataMesaji>{hata}</HataMesaji>
      {formAcik && <YeniFaturaFormu onKaydedildi={() => { setFormAcik(false); yukle(); }} onVazgec={() => setFormAcik(false)} />}

      {secilenIdler.size > 0 && (
        <Kart style={{ marginBottom: 12, background: 'var(--zemin)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px' }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{secilenIdler.size} fatura seçili</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Buton variant="ikincil" onClick={secilenleriExceleAktar}>Excel'e Aktar</Buton>
            <Buton variant="tehlike" onClick={topluSil}>Seçilenleri Sil</Buton>
            <Buton variant="ikincil" onClick={() => setSecilenIdler(new Set())}>Seçimi Temizle</Buton>
          </div>
        </Kart>
      )}

      <Kart style={{ padding: 0 }}>
        {yukleniyor ? (
          <TabloIskeleti sutunSayisi={6} />
        ) : faturalar.length === 0 ? (
          <BosDurum baslik="Henüz fatura kaydı yok" aciklama="Yukarıdan yeni bir fatura ekleyin." />
        ) : (
          <table>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                <th style={{ padding: '10px 16px', width: 32 }}>
                  <input
                    type="checkbox"
                    checked={faturalar.length > 0 && faturalar.every((f) => secilenIdler.has(f.id))}
                    onChange={(e) => {
                      if (e.target.checked) setSecilenIdler(new Set(faturalar.map((f) => f.id)));
                      else setSecilenIdler(new Set());
                    }}
                  />
                </th>
                {['Firma', 'Fatura No', 'İlişkili Sipariş(ler)', 'Masraf Türü', 'Tarih', 'Tutar', 'Ödenen', 'Kalan', 'İşlem'].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tarihGrup.yillar.map((yil) => (
                <Fragment key={yil}>
                  <tr>
                    <td colSpan={10} style={{ padding: 0 }}>
                      <YilBasligi
                        yil={yil}
                        kayitSayisi={Object.values(tarihGrup.gruplar[yil]).flat().length}
                        acik={tarihGrup.acikYillar.has(yil)}
                        onTikla={() => tarihGrup.yilAcKapat(yil)}
                      />
                    </td>
                  </tr>
                  {tarihGrup.acikYillar.has(yil) && Object.keys(tarihGrup.gruplar[yil]).sort().reverse().map((ayAnahtari) => (
                    <Fragment key={ayAnahtari}>
                      <tr>
                        <td colSpan={10} style={{ padding: 0 }}>
                          <AyBasligi
                            ayAnahtari={ayAnahtari}
                            kayitSayisi={tarihGrup.gruplar[yil][ayAnahtari].length}
                            acik={tarihGrup.acikAylar.has(ayAnahtari)}
                            onTikla={() => tarihGrup.ayAcKapat(ayAnahtari)}
                          />
                        </td>
                      </tr>
                      {tarihGrup.acikAylar.has(ayAnahtari) && tarihGrup.gruplar[yil][ayAnahtari].map((f) => (
                <Fragment key={f.id}>
                  <tr style={{ borderTop: '1px solid var(--kenarlik)', background: secilenIdler.has(f.id) ? 'var(--zemin)' : 'transparent' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <input type="checkbox" checked={secilenIdler.has(f.id)} onChange={() => satirSecimiDegistir(f.id)} />
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 500 }}>{f.tedarikci_unvan || `#${f.tedarikci_cari_id}`}</td>
                    <td style={{ padding: '12px 16px' }}>{f.fatura_no || '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12.5, color: 'var(--metin-ikincil)' }}>
                      {(() => {
                        const siparisNolar = [...new Set((f.odemeler || []).map((o) => o.siparis_no).filter(Boolean))];
                        return siparisNolar.length > 0 ? siparisNolar.join(', ') : '—';
                      })()}
                    </td>
                    <td style={{ padding: '12px 16px' }}>{MALIYET_TIP_METIN[f.varsayilan_maliyet_tipi] || f.varsayilan_maliyet_tipi}</td>
                    <td style={{ padding: '12px 16px' }}>{f.tarih}</td>
                    <td style={{ padding: '12px 16px' }}>{paraFormat(f.tutar, f.para_birimi)}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--yesil)' }}>{paraFormat(f.toplam_odenen, f.para_birimi)}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: Number(f.kalan_bakiye) > 0 ? 'var(--kirmizi)' : 'var(--yesil)' }}>
                      {paraFormat(f.kalan_bakiye, f.para_birimi)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {Number(f.kalan_bakiye) > 0 && (
                          <button onClick={() => setOdemeAcikId((m) => (m === f.id ? null : f.id))} style={eylemChipStili('yesil')}>
                            {odemeAcikId === f.id ? 'Kapat' : 'Öde'}
                          </button>
                        )}
                        <DahaFazlaMenu kompakt ogeler={[
                          { etiket: duzenleAcikId === f.id ? 'Düzenlemeyi Kapat' : 'Düzenle', onClick: () => setDuzenleAcikId((m) => (m === f.id ? null : f.id)) },
                          { etiket: detayAcikId === f.id ? 'Ödeme Geçmişini Kapat' : 'Ödeme Geçmişi', onClick: () => setDetayAcikId((m) => (m === f.id ? null : f.id)) },
                          { etiket: belgeAcikId === f.id ? 'Belgeleri Kapat' : 'Belgeler', onClick: () => setBelgeAcikId((m) => (m === f.id ? null : f.id)) },
                          { etiket: 'Sil', onClick: () => sil(f) },
                        ]} />
                      </div>
                    </td>
                  </tr>
                  {belgeAcikId === f.id && (
                    <tr>
                      <td colSpan={10} style={{ padding: '0 16px 12px' }}>
                        <BelgeYoneticisi kaynakTablo="TEDARIKCI_FATURA" kaynakId={f.id} />
                      </td>
                    </tr>
                  )}
                  {duzenleAcikId === f.id && (
                    <tr>
                      <td colSpan={10} style={{ padding: '0 16px 12px' }}>
                        <DuzenleFaturaFormu
                          fatura={f}
                          onKaydedildi={() => { setDuzenleAcikId(null); yukle(); }}
                          onVazgec={() => setDuzenleAcikId(null)}
                        />
                      </td>
                    </tr>
                  )}
                  {odemeAcikId === f.id && (
                    <tr>
                      <td colSpan={10} style={{ padding: '0 16px 12px' }}>
                        <OdemeFormu
                          fatura={f}
                          kalanBakiye={f.kalan_bakiye}
                          onKaydedildi={() => { setOdemeAcikId(null); yukle(); }}
                          onVazgec={() => setOdemeAcikId(null)}
                        />
                      </td>
                    </tr>
                  )}
                  {detayAcikId === f.id && (
                    <tr>
                      <td colSpan={10} style={{ padding: '0 16px 12px', background: 'var(--zemin)' }}>
                        {(!f.odemeler || f.odemeler.length === 0) ? (
                          <div style={{ fontSize: 12.5, color: 'var(--metin-soluk)', padding: '10px 0' }}>Henüz ödeme yapılmamış.</div>
                        ) : (
                          <table>
                            <thead>
                              <tr>
                                {['Tarih', 'Tutar', 'Yöntem', 'Dağıtım', 'Nereye', 'Maliyet Tipi', 'İşlem'].map((b) => (
                                  <th key={b} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11.5, color: 'var(--metin-ikincil)' }}>{b}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {f.odemeler.map((o) => (
                                <Fragment key={o.id}>
                                <tr style={{ borderTop: '1px solid var(--kenarlik)' }}>
                                  <td style={{ padding: '6px 8px', fontSize: 12.5 }}>{o.odeme_tarihi}</td>
                                  <td style={{ padding: '6px 8px', fontSize: 12.5 }}>{paraFormat(o.tutar, f.para_birimi)}</td>
                                  <td style={{ padding: '6px 8px', fontSize: 12.5 }}>{o.odeme_yontemi === 'BANKA' ? 'Banka' : 'Kasa'}</td>
                                  <td style={{ padding: '6px 8px', fontSize: 12.5 }}>
                                    {o.dagitim_tipi === 'SIPARIS' ? 'Sipariş (orantılı)' : o.dagitim_tipi === 'URUNLER' ? 'Seçili ürünler' : 'Tek ürün'}
                                  </td>
                                  <td style={{ padding: '6px 8px', fontSize: 12.5, fontWeight: 500 }}>
                                    {o.dagitim_tipi === 'SIPARIS' ? (o.siparis_no || `#${o.siparis_id}`)
                                      : o.dagitim_tipi === 'URUNLER' ? (o.siparis_no || '—')
                                      : (o.seri_no || `#${o.stok_seri_no_id}`)}
                                  </td>
                                  <td style={{ padding: '6px 8px', fontSize: 12.5 }}>{MALIYET_TIP_METIN[o.maliyet_tipi] || o.maliyet_tipi}</td>
                                  <td style={{ padding: '6px 8px', fontSize: 12.5 }}>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                      {o.dagitim_tipi === 'URUNLER' && (
                                        <button onClick={() => setDuzenleAcikOdemeId((m) => (m === o.id ? null : o.id))} style={eylemChipStili('lacivert')}>
                                          {duzenleAcikOdemeId === o.id ? 'Kapat' : 'Düzenle'}
                                        </button>
                                      )}
                                      <button onClick={() => odemeGeriAl(o)} style={eylemChipStili('kirmizi')}>Geri Al</button>
                                    </div>
                                  </td>
                                </tr>
                                {duzenleAcikOdemeId === o.id && (
                                  <tr>
                                    <td colSpan={7} style={{ padding: 0 }}>
                                      <OdemeDuzenleFormu
                                        fatura={f} odeme={o}
                                        onKaydedildi={() => { setDuzenleAcikOdemeId(null); yukle(); }}
                                        onVazgec={() => setDuzenleAcikOdemeId(null)}
                                      />
                                    </td>
                                  </tr>
                                )}
                                </Fragment>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
                    </Fragment>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </Kart>
    </div>
  );
}
