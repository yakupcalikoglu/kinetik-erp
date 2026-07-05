import { useEffect, useState } from 'react';
import { api, hataMesajiCikar } from '../api/client';
import {
  Kart, SayfaBasligi, Buton, Alan, girdiStili, Etiket, BosDurum, HataMesaji, paraFormat,
  eylemChipStili, BIRIM_SECENEKLERI,
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

function bosStokKartiForm() {
  return { marka: '', model: '', birim: 'ADET', birim_agirlik_kg: '', aciklama: '', mense_ulke: '', gtip_kodu: '' };
}

function StokKartiFormu({ duzenlenenKart, onKaydedildi, onVazgec }) {
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
      }
    : bosStokKartiForm()
  );
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [olusturulanId, setOlusturulanId] = useState(null);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      const govde = {
        ...form,
        birim_agirlik_kg: form.birim_agirlik_kg ? Number(form.birim_agirlik_kg) : null,
      };
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
          Stok kartı oluşturuldu — ID: {olusturulanId}
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
          {duzenlemeModu ? `Stok kartını düzenle — #${duzenlenenKart.id}` : 'Yeni stok kartı'}
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
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <Buton type="submit" disabled={kaydediliyor}>
            {kaydediliyor ? 'Kaydediliyor...' : duzenlemeModu ? 'Değişiklikleri kaydet' : 'Stok kartı oluştur'}
          </Buton>
          <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
        </div>
      </form>
    </Kart>
  );
}

function SatisFormu({ urun, onKaydedildi, onVazgec }) {
  const [cariler, setCariler] = useState([]);
  const [bankaHesaplari, setBankaHesaplari] = useState([]);
  const [form, setForm] = useState({
    musteri_cari_id: '', satis_fiyati_try: '', satis_tarihi: new Date().toISOString().slice(0, 10),
    odeme_yontemi: 'NAKIT', banka_hesap_id: '',
  });
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => {
    api.get('/cariler').then((r) => setCariler(r.data)).catch(() => {});
    api.get('/banka-bakiyeleri').then((r) => setBankaHesaplari(r.data)).catch(() => {});
  }, []);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      await api.post(`/stok-seri-no/${urun.id}/satis`, {
        musteri_cari_id: Number(form.musteri_cari_id),
        satis_fiyati_try: Number(form.satis_fiyati_try),
        satis_tarihi: form.satis_tarihi,
        odeme_yontemi: form.odeme_yontemi,
        banka_hesap_id: form.odeme_yontemi === 'BANKA' ? Number(form.banka_hesap_id) : null,
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
        <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 14 }}>
          Satış yap — Seri No: {urun.seri_no}
        </div>
        <HataMesaji>{hata}</HataMesaji>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Alan etiket="Müşteri">
            <select required value={form.musteri_cari_id} onChange={(e) => setForm((f) => ({ ...f, musteri_cari_id: e.target.value }))} style={girdiStili}>
              <option value="">Seçin...</option>
              {cariler.map((c) => <option key={c.id} value={c.id}>{c.unvan}</option>)}
            </select>
          </Alan>
          <Alan etiket="Satış fiyatı (TL)">
            <input required type="number" step="0.01" value={form.satis_fiyati_try} onChange={(e) => setForm((f) => ({ ...f, satis_fiyati_try: e.target.value }))} style={girdiStili} />
          </Alan>
          <Alan etiket="Satış tarihi">
            <input required type="date" value={form.satis_tarihi} onChange={(e) => setForm((f) => ({ ...f, satis_tarihi: e.target.value }))} style={girdiStili} />
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
                {bankaHesaplari.map((h) => (
                  <option key={h.banka_hesap_id} value={h.banka_hesap_id}>{h.banka_adi} — {h.hesap_adi || h.para_birimi}</option>
                ))}
              </select>
            </Alan>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : 'Satışı tamamla'}</Buton>
          <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
        </div>
      </form>
    </Kart>
  );
}

function MaliyetKalemiEkleFormu({ urun, onKaydedildi }) {
  const [cariler, setCariler] = useState([]);
  const [form, setForm] = useState({
    tip: 'NAKLIYE', tutar: '', para_birimi: 'TRY', kur: '1',
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
          <input required type="number" step="0.01" value={form.tutar} onChange={(e) => setForm((f) => ({ ...f, tutar: e.target.value }))} style={girdiStili} />
        </Alan>
        {form.para_birimi !== 'TRY' && (
          <Alan etiket="Kur (otomatik, elle değiştirilebilir)">
            <input required type="number" step="0.0001" value={form.kur} onChange={(e) => setForm((f) => ({ ...f, kur: e.target.value }))} style={girdiStili} />
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

function MaliyetDetayi({ urun, onKapat }) {
  const [kalemler, setKalemler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(null);

  function yukle() {
    setYukleniyor(true);
    api.get(`/stok-seri-no/${urun.id}/maliyet-kalemleri`)
      .then((r) => setKalemler(r.data))
      .catch((e) => setHata(hataMesajiCikar(e)))
      .finally(() => setYukleniyor(false));
  }
  useEffect(yukle, [urun.id]); // eslint-disable-line

  return (
    <Kart style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600 }}>Maliyet detayı — Seri No: {urun.seri_no}</div>
        <Buton variant="ikincil" onClick={onKapat}>Kapat</Buton>
      </div>
      <HataMesaji>{hata}</HataMesaji>

      <MaliyetKalemiEkleFormu urun={urun} onKaydedildi={yukle} />

      {yukleniyor ? (
        <div style={{ padding: 20, color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
      ) : kalemler.length === 0 ? (
        <BosDurum baslik="Henüz maliyet kalemi eklenmemiş" />
      ) : (
        <table>
          <thead>
            <tr style={{ background: 'var(--zemin)' }}>
              {['Tip', 'Tutar', 'TL Karşılığı', 'Belge No', 'Tarih', 'Açıklama'].map((b) => (
                <th key={b} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>{b}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {kalemler.map((k) => (
              <tr key={k.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                <td style={{ padding: '8px 12px' }}><Etiket ton="notr">{MALIYET_TIP_METIN[k.tip] || k.tip}</Etiket></td>
                <td style={{ padding: '8px 12px' }}>{paraFormat(k.tutar, k.para_birimi)}</td>
                <td style={{ padding: '8px 12px', fontWeight: 500 }}>{paraFormat(k.tutar_try)}</td>
                <td style={{ padding: '8px 12px', color: 'var(--metin-ikincil)' }}>{k.belge_no || '—'}</td>
                <td style={{ padding: '8px 12px', color: 'var(--metin-ikincil)' }}>{k.tarih}</td>
                <td style={{ padding: '8px 12px', color: 'var(--metin-ikincil)' }}>{k.aciklama || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Kart>
  );
}

export default function StokSayfasi() {
  const [urunler, setUrunler] = useState([]);
  const [stokKartlari, setStokKartlari] = useState([]);
  const [depodakiSayilar, setDepodakiSayilar] = useState({});
  const [durumFiltre, setDurumFiltre] = useState('');
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(null);
  const [formAcik, setFormAcik] = useState(false);
  const [duzenlenenKart, setDuzenlenenKart] = useState(null);
  const [satisYapilacakUrun, setSatisYapilacakUrun] = useState(null);
  const [maliyetGosterilecekUrun, setMaliyetGosterilecekUrun] = useState(null);
  const [seciliIdler, setSeciliIdler] = useState([]);
  const [topluDurum, setTopluDurum] = useState('DEPODA');
  const [topluHata, setTopluHata] = useState(null);
  const [topluIslemDevamEdiyor, setTopluIslemDevamEdiyor] = useState(false);

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

  async function topluDurumGuncelle() {
    setTopluHata(null);
    setTopluIslemDevamEdiyor(true);
    try {
      await api.put('/stok-seri-no/toplu-durum-guncelle', {
        stok_seri_no_idleri: seciliIdler,
        durum: topluDurum,
      });
      setSeciliIdler([]);
      urunleriYukle();
      depodakiSayilariYukle();
    } catch (err) {
      setTopluHata(hataMesajiCikar(err));
    } finally {
      setTopluIslemDevamEdiyor(false);
    }
  }

  function urunleriYukle() {
    setYukleniyor(true);
    api.get('/stok-seri-no', { params: durumFiltre ? { durum: durumFiltre } : {} })
      .then((res) => setUrunler(res.data))
      .catch((err) => setHata(hataMesajiCikar(err)))
      .finally(() => setYukleniyor(false));
  }

  function stokKartlariniYukle() {
    api.get('/stok-kartlari').then((r) => setStokKartlari(r.data)).catch(() => {});
  }

  function depodakiSayilariYukle() {
    api.get('/stok-seri-no', { params: { durum: 'DEPODA' } })
      .then((r) => {
        const harita = {};
        r.data.forEach((u) => {
          harita[u.stok_karti_id] = (harita[u.stok_karti_id] || 0) + 1;
        });
        setDepodakiSayilar(harita);
      })
      .catch(() => {});
  }

  useEffect(() => {
    urunleriYukle();
    stokKartlariniYukle();
    depodakiSayilariYukle();
  }, [durumFiltre]);

  function yeniKartAc() {
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

  async function kartiSil(kart) {
    if (!window.confirm(`${kart.marka} ${kart.model} stok kartını silmek istediğinize emin misiniz?`)) return;
    try {
      await api.delete(`/stok-kartlari/${kart.id}`);
      stokKartlariniYukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  return (
    <div>
      <SayfaBasligi
        baslik="Stok"
        aciklama="Seri numarası bazlı ürün takibi ve maliyet dökümü"
        eylem={!formAcik && <Buton onClick={yeniKartAc}>+ Yeni stok kartı</Buton>}
      />
      <HataMesaji>{hata}</HataMesaji>

      {formAcik && (
        <StokKartiFormu
          duzenlenenKart={duzenlenenKart}
          onKaydedildi={() => { formuKapat(); stokKartlariniYukle(); depodakiSayilariYukle(); }}
          onVazgec={formuKapat}
        />
      )}

      {stokKartlari.length > 0 && (
        <Kart style={{ marginBottom: 16, padding: 0 }}>
          <div style={{ padding: '12px 16px', fontWeight: 600, fontSize: 13.5, borderBottom: '1px solid var(--kenarlik)' }}>
            Tanımlı stok kartları ({stokKartlari.length})
          </div>
          <table>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                {['ID', 'Marka', 'Model', 'Birim', 'Depodaki Adet', 'Menşei', 'GTİP', 'İşlem'].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '8px 16px', fontSize: 12, color: 'var(--metin-ikincil)' }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stokKartlari.map((sk) => (
                <tr key={sk.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                  <td style={{ padding: '8px 16px', fontFamily: 'var(--font-mono)' }}>{sk.id}</td>
                  <td style={{ padding: '8px 16px' }}>{sk.marka}</td>
                  <td style={{ padding: '8px 16px' }}>{sk.model}</td>
                  <td style={{ padding: '8px 16px' }}>{sk.birim}</td>
                  <td style={{ padding: '8px 16px', fontWeight: 600 }}>
                    <Etiket ton={depodakiSayilar[sk.id] > 0 ? 'yesil' : 'notr'}>
                      {depodakiSayilar[sk.id] || 0} {sk.birim}
                    </Etiket>
                  </td>
                  <td style={{ padding: '8px 16px' }}>{sk.mense_ulke || '—'}</td>
                  <td style={{ padding: '8px 16px' }}>{sk.gtip_kodu || '—'}</td>
                  <td style={{ padding: '8px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => duzenle(sk)} style={eylemChipStili('lacivert')}>Düzenle</button>
                      <button onClick={() => kartiSil(sk)} style={eylemChipStili('kirmizi')}>Sil</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Kart>
      )}

      {satisYapilacakUrun && (
        <SatisFormu
          urun={satisYapilacakUrun}
          onKaydedildi={() => { setSatisYapilacakUrun(null); urunleriYukle(); depodakiSayilariYukle(); }}
          onVazgec={() => setSatisYapilacakUrun(null)}
        />
      )}

      {maliyetGosterilecekUrun && (
        <MaliyetDetayi
          urun={maliyetGosterilecekUrun}
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
            <Buton variant="ikincil" onClick={() => setSeciliIdler([])}>Seçimi temizle</Buton>
          </div>
          {topluHata && <div style={{ marginTop: 8, fontSize: 13, color: '#ffd7d7' }}>{topluHata}</div>}
        </Kart>
      )}

      <Kart style={{ padding: 0 }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--kenarlik)' }}>
          <select value={durumFiltre} onChange={(e) => setDurumFiltre(e.target.value)} style={{ ...girdiStili, maxWidth: 220 }}>
            <option value="">Tüm durumlar</option>
            {Object.entries(DURUM_METIN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
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
                {['Seri No', 'Durum', 'Toplam Maliyet', 'Satış Fiyatı', 'Kâr/Zarar', 'İşlem'].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {urunler.map((u) => {
                const karZarar = u.satis_fiyati_try != null ? u.satis_fiyati_try - u.toplam_maliyet_try : null;
                const satilabilir = u.durum === 'DEPODA' || u.durum === 'ANTREPODA';
                return (
                  <tr key={u.id} style={{ borderTop: '1px solid var(--kenarlik)', background: seciliMi(u.id) ? 'var(--zemin)' : 'transparent' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <input type="checkbox" checked={seciliMi(u.id)} onChange={() => secimiDegistir(u.id)} />
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>{u.seri_no}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <Etiket ton={DURUM_ETIKET[u.durum]}>{DURUM_METIN[u.durum]}</Etiket>
                    </td>
                    <td style={{ padding: '12px 16px' }}>{paraFormat(u.toplam_maliyet_try)}</td>
                    <td style={{ padding: '12px 16px' }}>{u.satis_fiyati_try != null ? paraFormat(u.satis_fiyati_try) : '—'}</td>
                    <td style={{ padding: '12px 16px', color: karZarar == null ? 'var(--metin-soluk)' : karZarar >= 0 ? 'var(--yesil)' : 'var(--kirmizi)', fontWeight: 500 }}>
                      {karZarar != null ? paraFormat(karZarar) : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setMaliyetGosterilecekUrun(u)} style={eylemChipStili('lacivert')}>Maliyet Detayı</button>
                        {satilabilir && (
                          <button onClick={() => setSatisYapilacakUrun(u)} style={eylemChipStili('yesil')}>Satış yap</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Kart>
    </div>
  );
}
