import { useEffect, useState, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { api, hataMesajiCikar } from '../api/client';
import {
  Kart, SayfaBasligi, Buton, Alan, girdiStili, Etiket, BosDurum, HataMesaji, paraFormat,
  eylemChipStili,
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

function MaliyetKalemiDuzenleFormu({ kalem, onKaydedildi, onVazgec }) {
  const [cariler, setCariler] = useState([]);
  const [form, setForm] = useState({
    tip: kalem.tip, tutar: kalem.tutar, para_birimi: kalem.para_birimi, kur: kalem.kur,
    tedarikci_cari_id: kalem.tedarikci_cari_id || '', belge_no: kalem.belge_no || '',
    tarih: kalem.tarih, aciklama: kalem.aciklama || '',
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
      await api.put(`/stok-seri-no/${kalem.stok_seri_no_id}/maliyet-kalemi/${kalem.id}`, {
        tip: form.tip,
        tutar: Number(form.tutar),
        para_birimi: form.para_birimi,
        kur: Number(form.kur),
        tedarikci_cari_id: form.tedarikci_cari_id ? Number(form.tedarikci_cari_id) : null,
        belge_no: form.belge_no || null,
        tarih: form.tarih,
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
                <input required type="number" step="0.01" value={form.tutar} onChange={(e) => setForm((f) => ({ ...f, tutar: e.target.value }))} style={girdiStili} />
              </Alan>
              <Alan etiket="Kur">
                <input required type="number" step="0.0001" value={form.kur} onChange={(e) => setForm((f) => ({ ...f, kur: e.target.value }))} style={girdiStili} />
              </Alan>
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

function MaliyetDetayi({ urun, onKapat }) {
  const [kalemler, setKalemler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(null);
  const [duzenlenenId, setDuzenlenenId] = useState(null);

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
                    onKaydedildi={() => { setDuzenlenenId(null); yukle(); }}
                    onVazgec={() => setDuzenlenenId(null)}
                  />
                );
              }
              return (
                <tr key={k.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                  <td style={{ padding: '8px 12px' }}><Etiket ton="notr">{MALIYET_TIP_METIN[k.tip] || k.tip}</Etiket></td>
                  <td style={{ padding: '8px 12px' }}>{paraFormat(k.tutar, k.para_birimi)}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 500 }}>{paraFormat(k.tutar_try)}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--metin-ikincil)' }}>{k.belge_no || '—'}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--metin-ikincil)' }}>{k.tarih}</td>
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
      <td colSpan={8} style={{ padding: 0 }}>
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
          {hata && <div style={{ marginTop: 8 }}><HataMesaji>{hata}</HataMesaji></div>}
        </div>
      </td>
    </tr>
  );
}

function UrunDuzenleFormu({ urun, stokKartlari, onKaydedildi, onVazgec }) {
  const [form, setForm] = useState({ seri_no: urun.seri_no, stok_karti_id: String(urun.stok_karti_id) });
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      await api.put(`/stok-seri-no/${urun.id}`, {
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
      <td colSpan={8} style={{ padding: 0 }}>
        <div style={{ padding: 16, background: 'var(--zemin)' }}>
          <form onSubmit={kaydet}>
            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>Ürünü düzenle</div>
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

export default function StokSayfasi() {
  const [tumUrunler, setTumUrunler] = useState([]);
  const [urunler, setUrunler] = useState([]);
  const [stokKartlari, setStokKartlari] = useState([]);
  const [durumFiltre, setDurumFiltre] = useState('');
  const [urunFiltre, setUrunFiltre] = useState('');
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(null);
  const [maliyetGosterilecekUrun, setMaliyetGosterilecekUrun] = useState(null);
  const [duzenlenenUrunId, setDuzenlenenUrunId] = useState(null);
  const [durumDegistirilenId, setDurumDegistirilenId] = useState(null);
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
  }, []);

  useEffect(() => {
    urunleriYukle();
  }, [durumFiltre, urunFiltre]); // eslint-disable-line

  function urunAdiGoster(stokKartiId) {
    const k = stokKartlari.find((x) => x.id === stokKartiId);
    return k ? `${k.marka} ${k.model}` : `#${stokKartiId}`;
  }

  const durumOzet = {};
  tumUrunler.forEach((u) => {
    durumOzet[u.durum] = (durumOzet[u.durum] || 0) + 1;
  });

  return (
    <div>
      <SayfaBasligi
        baslik="Stok"
        aciklama="Fiziksel envanter — konum/duruma göre gruplanmış ve filtrelenebilir"
        eylem={<Link to="/satis-yap"><Buton>+ Satış Yap</Buton></Link>}
      />
      <HataMesaji>{hata}</HataMesaji>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
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
        <div style={{ padding: 16, borderBottom: '1px solid var(--kenarlik)', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Alan etiket="Ürüne göre filtrele">
            <select value={urunFiltre} onChange={(e) => setUrunFiltre(e.target.value)} style={{ ...girdiStili, minWidth: 220 }}>
              <option value="">Tüm ürünler</option>
              {stokKartlari.map((k) => (
                <option key={k.id} value={k.id}>{k.marka} {k.model}</option>
              ))}
            </select>
          </Alan>
          {durumFiltre && (
            <Buton variant="ikincil" onClick={() => setDurumFiltre('')}>Durum filtresini temizle ({DURUM_METIN[durumFiltre]})</Buton>
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
                {['Seri No', 'Ürün', 'Durum', 'Toplam Maliyet', 'Satış Fiyatı', 'Kâr/Zarar', 'İşlem'].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {urunler.map((u) => {
                const karZarar = u.satis_fiyati_try != null ? u.satis_fiyati_try - u.toplam_maliyet_try : null;
                const satilabilir = u.durum === 'DEPODA' || u.durum === 'ANTREPODA';
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
                return (
                  <Fragment key={u.id}>
                    <tr style={{ borderTop: '1px solid var(--kenarlik)', background: seciliMi(u.id) ? 'var(--zemin)' : 'transparent' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <input type="checkbox" checked={seciliMi(u.id)} onChange={() => secimiDegistir(u.id)} />
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>{u.seri_no}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--metin-ikincil)' }}>{urunAdiGoster(u.stok_karti_id)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <Etiket ton={DURUM_ETIKET[u.durum]}>{DURUM_METIN[u.durum]}</Etiket>
                      </td>
                      <td style={{ padding: '12px 16px' }}>{paraFormat(u.toplam_maliyet_try)}</td>
                      <td style={{ padding: '12px 16px' }}>{u.satis_fiyati_try != null ? paraFormat(u.satis_fiyati_try) : '—'}</td>
                      <td style={{ padding: '12px 16px', color: karZarar == null ? 'var(--metin-soluk)' : karZarar >= 0 ? 'var(--yesil)' : 'var(--kirmizi)', fontWeight: 500 }}>
                        {karZarar != null ? paraFormat(karZarar) : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button onClick={() => setMaliyetGosterilecekUrun(u)} style={eylemChipStili('lacivert')}>Maliyet Detayı</button>
                          {satilabilir && (
                            <Link to={`/satis-yap?urun=${u.id}`}><button style={eylemChipStili('yesil')} type="button">Satış yap</button></Link>
                          )}
                          {u.durum !== 'SATILDI' && (
                            <button onClick={() => setDurumDegistirilenId(u.id)} style={eylemChipStili('amber')}>Durum Değiştir</button>
                          )}
                          <button onClick={() => setDuzenlenenUrunId(u.id)} style={eylemChipStili('lacivert')}>Düzenle</button>
                          {u.durum === 'SATILDI' ? (
                            <button onClick={() => satisiGeriAl(u)} style={eylemChipStili('kirmizi')}>Satışı Geri Al</button>
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
