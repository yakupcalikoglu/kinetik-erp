import { useEffect, useState } from 'react';
import { api, hataMesajiCikar } from '../api/client';
import { Kart, SayfaBasligi, Buton, Alan, girdiStili, HataMesaji, Sekmeler } from '../components/Ortak';

const SEKMELER = [
  { deger: 'banka-banka', etiket: 'Banka → Banka' },
  { deger: 'banka-cari', etiket: 'Banka → Cari' },
  { deger: 'cari-cari', etiket: 'Cari → Cari' },
  { deger: 'urun-cari', etiket: 'Ürün → Cari' },
];

function BasariMesaji({ children }) {
  if (!children) return null;
  return (
    <div style={{ background: '#e3f5e9', color: '#1c7c4c', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
      {children}
    </div>
  );
}

function BankaBankaVirmani() {
  const [hesaplar, setHesaplar] = useState([]);
  const [form, setForm] = useState({
    banka_hesap_id: '', karsi_hesap_id: '', tarih: new Date().toISOString().slice(0, 10),
    tutar: '', kullanilan_kur: '1', aciklama: '',
  });
  const [hata, setHata] = useState(null);
  const [basari, setBasari] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => {
    api.get('/banka-bakiyeleri').then((r) => setHesaplar(r.data)).catch(() => {});
  }, []);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setBasari(null);
    setKaydediliyor(true);
    try {
      await api.post('/banka-hareketleri', {
        banka_hesap_id: Number(form.banka_hesap_id),
        karsi_hesap_id: Number(form.karsi_hesap_id),
        tarih: form.tarih,
        tip: 'HESAPLAR_ARASI_TRANSFER',
        tutar: -Math.abs(Number(form.tutar)),
        kullanilan_kur: Number(form.kullanilan_kur),
        aciklama: form.aciklama || null,
      });
      setBasari('Virman tamamlandı.');
      setForm((f) => ({ ...f, tutar: '', aciklama: '' }));
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  return (
    <Kart>
      <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 14 }}>Banka hesabından banka hesabına virman</div>
      <HataMesaji>{hata}</HataMesaji>
      <BasariMesaji>{basari}</BasariMesaji>
      <form onSubmit={kaydet} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Alan etiket="Kaynak hesap">
          <select required value={form.banka_hesap_id} onChange={(e) => setForm((f) => ({ ...f, banka_hesap_id: e.target.value }))} style={girdiStili}>
            <option value="">Seçin...</option>
            {hesaplar.map((h) => (
              <option key={h.banka_hesap_id} value={h.banka_hesap_id}>{h.banka_adi} — {h.hesap_adi || h.para_birimi}</option>
            ))}
          </select>
        </Alan>
        <Alan etiket="Hedef hesap">
          <select required value={form.karsi_hesap_id} onChange={(e) => setForm((f) => ({ ...f, karsi_hesap_id: e.target.value }))} style={girdiStili}>
            <option value="">Seçin...</option>
            {hesaplar.filter((h) => String(h.banka_hesap_id) !== form.banka_hesap_id).map((h) => (
              <option key={h.banka_hesap_id} value={h.banka_hesap_id}>{h.banka_adi} — {h.hesap_adi || h.para_birimi}</option>
            ))}
          </select>
        </Alan>
        <Alan etiket="Tarih">
          <input required type="date" value={form.tarih} onChange={(e) => setForm((f) => ({ ...f, tarih: e.target.value }))} style={girdiStili} />
        </Alan>
        <Alan etiket="Tutar (kaynak hesap para biriminde)">
          <input required type="number" step="0.01" value={form.tutar} onChange={(e) => setForm((f) => ({ ...f, tutar: e.target.value }))} style={girdiStili} />
        </Alan>
        <Alan etiket="Kullanılan kur (aynı para birimiyse 1)">
          <input required type="number" step="0.0001" value={form.kullanilan_kur} onChange={(e) => setForm((f) => ({ ...f, kullanilan_kur: e.target.value }))} style={girdiStili} />
        </Alan>
        <Alan etiket="Açıklama">
          <input value={form.aciklama} onChange={(e) => setForm((f) => ({ ...f, aciklama: e.target.value }))} style={girdiStili} />
        </Alan>
        <div style={{ alignSelf: 'end' }}>
          <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : 'Virmanı yap'}</Buton>
        </div>
      </form>
    </Kart>
  );
}

function BankaCariVirmani() {
  const [hesaplar, setHesaplar] = useState([]);
  const [cariler, setCariler] = useState([]);
  const [form, setForm] = useState({
    banka_hesap_id: '', cari_id: '', tip: 'CIKIS', tarih: new Date().toISOString().slice(0, 10),
    tutar: '', aciklama: '',
  });
  const [hata, setHata] = useState(null);
  const [basari, setBasari] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => {
    api.get('/banka-bakiyeleri').then((r) => setHesaplar(r.data)).catch(() => {});
    api.get('/cariler').then((r) => setCariler(r.data)).catch(() => {});
  }, []);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setBasari(null);
    setKaydediliyor(true);
    try {
      await api.post('/banka-hareketleri', {
        banka_hesap_id: Number(form.banka_hesap_id),
        cari_id: Number(form.cari_id),
        tarih: form.tarih,
        tip: form.tip,
        tutar: form.tip === 'CIKIS' ? -Math.abs(Number(form.tutar)) : Math.abs(Number(form.tutar)),
        aciklama: form.aciklama || null,
      });
      setBasari('Virman tamamlandı.');
      setForm((f) => ({ ...f, tutar: '', aciklama: '' }));
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  return (
    <Kart>
      <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 14 }}>Banka hesabı ile cari arasında virman</div>
      <HataMesaji>{hata}</HataMesaji>
      <BasariMesaji>{basari}</BasariMesaji>
      <form onSubmit={kaydet} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Alan etiket="Banka hesabı">
          <select required value={form.banka_hesap_id} onChange={(e) => setForm((f) => ({ ...f, banka_hesap_id: e.target.value }))} style={girdiStili}>
            <option value="">Seçin...</option>
            {hesaplar.map((h) => (
              <option key={h.banka_hesap_id} value={h.banka_hesap_id}>{h.banka_adi} — {h.hesap_adi || h.para_birimi}</option>
            ))}
          </select>
        </Alan>
        <Alan etiket="Cari">
          <select required value={form.cari_id} onChange={(e) => setForm((f) => ({ ...f, cari_id: e.target.value }))} style={girdiStili}>
            <option value="">Seçin...</option>
            {cariler.map((c) => <option key={c.id} value={c.id}>{c.unvan}</option>)}
          </select>
        </Alan>
        <Alan etiket="Yön">
          <select value={form.tip} onChange={(e) => setForm((f) => ({ ...f, tip: e.target.value }))} style={girdiStili}>
            <option value="CIKIS">Bankadan cariye ödeme (Çıkış)</option>
            <option value="GIRIS">Cariden bankaya tahsilat (Giriş)</option>
          </select>
        </Alan>
        <Alan etiket="Tarih">
          <input required type="date" value={form.tarih} onChange={(e) => setForm((f) => ({ ...f, tarih: e.target.value }))} style={girdiStili} />
        </Alan>
        <Alan etiket="Tutar">
          <input required type="number" step="0.01" value={form.tutar} onChange={(e) => setForm((f) => ({ ...f, tutar: e.target.value }))} style={girdiStili} />
        </Alan>
        <Alan etiket="Açıklama">
          <input value={form.aciklama} onChange={(e) => setForm((f) => ({ ...f, aciklama: e.target.value }))} style={girdiStili} />
        </Alan>
        <div style={{ alignSelf: 'end' }}>
          <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : 'Virmanı yap'}</Buton>
        </div>
      </form>
    </Kart>
  );
}

function CariCariVirmani() {
  const [cariler, setCariler] = useState([]);
  const [form, setForm] = useState({ kaynak_cari_id: '', hedef_cari_id: '', tutar: '', para_birimi: 'TRY', aciklama: '' });
  const [hata, setHata] = useState(null);
  const [basari, setBasari] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => {
    api.get('/cariler').then((r) => setCariler(r.data)).catch(() => {});
  }, []);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setBasari(null);
    setKaydediliyor(true);
    try {
      await api.post('/virman/cari-cariye', {
        kaynak_cari_id: Number(form.kaynak_cari_id),
        hedef_cari_id: Number(form.hedef_cari_id),
        tutar: Number(form.tutar),
        para_birimi: form.para_birimi,
        aciklama: form.aciklama || null,
      });
      setBasari('Borç devri tamamlandı.');
      setForm((f) => ({ ...f, tutar: '', aciklama: '' }));
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  return (
    <Kart>
      <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 6 }}>Cariden cariye borç devri</div>
      <div style={{ fontSize: 12.5, color: 'var(--metin-soluk)', marginBottom: 14 }}>
        Kaynak carinin borcu/alacağı, girilen tutar kadar hedef cariye taşınır.
      </div>
      <HataMesaji>{hata}</HataMesaji>
      <BasariMesaji>{basari}</BasariMesaji>
      <form onSubmit={kaydet} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Alan etiket="Kaynak cari (borcu devreden)">
          <select required value={form.kaynak_cari_id} onChange={(e) => setForm((f) => ({ ...f, kaynak_cari_id: e.target.value }))} style={girdiStili}>
            <option value="">Seçin...</option>
            {cariler.map((c) => <option key={c.id} value={c.id}>{c.unvan}</option>)}
          </select>
        </Alan>
        <Alan etiket="Hedef cari (borcu devralan)">
          <select required value={form.hedef_cari_id} onChange={(e) => setForm((f) => ({ ...f, hedef_cari_id: e.target.value }))} style={girdiStili}>
            <option value="">Seçin...</option>
            {cariler.filter((c) => String(c.id) !== form.kaynak_cari_id).map((c) => <option key={c.id} value={c.id}>{c.unvan}</option>)}
          </select>
        </Alan>
        <Alan etiket="Para birimi">
          <select value={form.para_birimi} onChange={(e) => setForm((f) => ({ ...f, para_birimi: e.target.value }))} style={girdiStili}>
            <option value="TRY">TRY</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="ALTIN">ALTIN</option>
          </select>
        </Alan>
        <Alan etiket="Tutar">
          <input required type="number" step="0.01" value={form.tutar} onChange={(e) => setForm((f) => ({ ...f, tutar: e.target.value }))} style={girdiStili} />
        </Alan>
        <Alan etiket="Açıklama">
          <input value={form.aciklama} onChange={(e) => setForm((f) => ({ ...f, aciklama: e.target.value }))} style={girdiStili} />
        </Alan>
        <div style={{ alignSelf: 'end' }}>
          <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : 'Devri yap'}</Buton>
        </div>
      </form>
    </Kart>
  );
}

function UrunCariVirmani() {
  const [urunler, setUrunler] = useState([]);
  const [cariler, setCariler] = useState([]);
  const [form, setForm] = useState({ stok_seri_no_id: '', hedef_cari_id: '', aciklama: '' });
  const [hata, setHata] = useState(null);
  const [basari, setBasari] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => {
    api.get('/stok-seri-no').then((r) => setUrunler(r.data)).catch(() => {});
    api.get('/cariler').then((r) => setCariler(r.data)).catch(() => {});
  }, []);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setBasari(null);
    setKaydediliyor(true);
    try {
      await api.post('/virman/urun-cariye', {
        stok_seri_no_id: Number(form.stok_seri_no_id),
        hedef_cari_id: Number(form.hedef_cari_id),
        aciklama: form.aciklama || null,
      });
      setBasari('Ürün sahiplik devri tamamlandı.');
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  return (
    <Kart>
      <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 6 }}>Ürün sahiplik/zimmet devri</div>
      <div style={{ fontSize: 12.5, color: 'var(--metin-soluk)', marginBottom: 14 }}>
        Konsinye veya zimmetli bir ürünün ilişkili olduğu cari değiştirilir; ürünün durumu ve maliyetleri etkilenmez.
      </div>
      <HataMesaji>{hata}</HataMesaji>
      <BasariMesaji>{basari}</BasariMesaji>
      <form onSubmit={kaydet} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Alan etiket="Ürün (seri no)">
          <select required value={form.stok_seri_no_id} onChange={(e) => setForm((f) => ({ ...f, stok_seri_no_id: e.target.value }))} style={girdiStili}>
            <option value="">Seçin...</option>
            {urunler.map((u) => <option key={u.id} value={u.id}>{u.seri_no}</option>)}
          </select>
        </Alan>
        <Alan etiket="Yeni sahip cari">
          <select required value={form.hedef_cari_id} onChange={(e) => setForm((f) => ({ ...f, hedef_cari_id: e.target.value }))} style={girdiStili}>
            <option value="">Seçin...</option>
            {cariler.map((c) => <option key={c.id} value={c.id}>{c.unvan}</option>)}
          </select>
        </Alan>
        <Alan etiket="Açıklama">
          <input value={form.aciklama} onChange={(e) => setForm((f) => ({ ...f, aciklama: e.target.value }))} style={girdiStili} />
        </Alan>
        <div style={{ alignSelf: 'end' }}>
          <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : 'Devri yap'}</Buton>
        </div>
      </form>
    </Kart>
  );
}

export default function VirmanSayfasi() {
  const [sekme, setSekme] = useState('banka-banka');

  return (
    <div>
      <SayfaBasligi baslik="Virman" aciklama="Banka, cari ve ürünler arasında para/sahiplik aktarımı" />
      <Sekmeler sekmeler={SEKMELER} aktif={sekme} onDegistir={setSekme} />

      {sekme === 'banka-banka' && <BankaBankaVirmani />}
      {sekme === 'banka-cari' && <BankaCariVirmani />}
      {sekme === 'cari-cari' && <CariCariVirmani />}
      {sekme === 'urun-cari' && <UrunCariVirmani />}
    </div>
  );
}
