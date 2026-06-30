import { useEffect, useState } from 'react';
import { api, hataMesajiCikar } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Kart, SayfaBasligi, Buton, Alan, girdiStili, HataMesaji, BosDurum, Sekmeler, Etiket } from '../components/Ortak';

function SirketBilgileriSekmesi() {
  const { oturum } = useAuth();
  const sirketId = oturum?.aktifSirketId;
  const [form, setForm] = useState(null);
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [kaydedildi, setKaydedildi] = useState(false);
  const [logoDosyasi, setLogoDosyasi] = useState(null);

  useEffect(() => {
    if (!sirketId) return;
    api.get(`/sirketler/${sirketId}`).then((r) => setForm(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }, [sirketId]);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    setKaydedildi(false);
    try {
      const { unvan, vergi_dairesi, vergi_no, adres, telefon, email } = form;
      await api.put(`/sirketler/${sirketId}`, { unvan, vergi_dairesi, vergi_no, adres, telefon, email });

      if (logoDosyasi) {
        const veri = new FormData();
        veri.append('dosya', logoDosyasi);
        await api.post(`/sirketler/${sirketId}/logo`, veri, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      setKaydedildi(true);
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  if (!form) return <div style={{ color: 'var(--metin-soluk)' }}>Yükleniyor...</div>;

  return (
    <Kart>
      <form onSubmit={kaydet} style={{ maxWidth: 520 }}>
        <HataMesaji>{hata}</HataMesaji>
        <Alan etiket="Unvan">
          <input required value={form.unvan} onChange={(e) => setForm((f) => ({ ...f, unvan: e.target.value }))} style={girdiStili} />
        </Alan>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Alan etiket="Vergi dairesi">
              <input value={form.vergi_dairesi || ''} onChange={(e) => setForm((f) => ({ ...f, vergi_dairesi: e.target.value }))} style={girdiStili} />
            </Alan>
          </div>
          <div style={{ flex: 1 }}>
            <Alan etiket="Vergi no">
              <input value={form.vergi_no || ''} onChange={(e) => setForm((f) => ({ ...f, vergi_no: e.target.value }))} style={girdiStili} />
            </Alan>
          </div>
        </div>
        <Alan etiket="Adres">
          <input value={form.adres || ''} onChange={(e) => setForm((f) => ({ ...f, adres: e.target.value }))} style={girdiStili} />
        </Alan>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Alan etiket="Telefon">
              <input value={form.telefon || ''} onChange={(e) => setForm((f) => ({ ...f, telefon: e.target.value }))} style={girdiStili} />
            </Alan>
          </div>
          <div style={{ flex: 1 }}>
            <Alan etiket="E-posta">
              <input type="email" value={form.email || ''} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} style={girdiStili} />
            </Alan>
          </div>
        </div>
        <Alan etiket="Logo">
          <input type="file" accept="image/*" onChange={(e) => setLogoDosyasi(e.target.files?.[0] || null)} />
          {form.logo_dosya_yolu && <div style={{ fontSize: 12, color: 'var(--metin-soluk)', marginTop: 4 }}>Mevcut logo yüklü.</div>}
        </Alan>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : 'Kaydet'}</Buton>
          {kaydedildi && <span style={{ fontSize: 13, color: 'var(--yesil)' }}>Kaydedildi</span>}
        </div>
      </form>
    </Kart>
  );
}

function KullanicilarSekmesi() {
  const [kullanicilar, setKullanicilar] = useState([]);
  const [roller, setRoller] = useState([]);
  const [formAcik, setFormAcik] = useState(false);
  const [form, setForm] = useState({ ad_soyad: '', email: '', sifre: '', rol_id: '' });
  const [hata, setHata] = useState(null);

  function yukle() {
    api.get('/kullanicilar').then((r) => setKullanicilar(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
    api.get('/roller').then((r) => setRoller(r.data)).catch(() => {});
  }
  useEffect(yukle, []);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    try {
      await api.post('/kullanicilar', { ...form, rol_id: form.rol_id ? Number(form.rol_id) : null });
      setFormAcik(false);
      setForm({ ad_soyad: '', email: '', sifre: '', rol_id: '' });
      yukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Buton onClick={() => setFormAcik((a) => !a)}>{formAcik ? 'Kapat' : '+ Yeni kullanıcı'}</Buton>
      </div>
      <HataMesaji>{hata}</HataMesaji>

      {formAcik && (
        <Kart style={{ marginBottom: 16 }}>
          <form onSubmit={kaydet} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
            <Alan etiket="Ad Soyad">
              <input required value={form.ad_soyad} onChange={(e) => setForm((f) => ({ ...f, ad_soyad: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="E-posta">
              <input required type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Şifre">
              <input required type="password" value={form.sifre} onChange={(e) => setForm((f) => ({ ...f, sifre: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Rol">
              <select value={form.rol_id} onChange={(e) => setForm((f) => ({ ...f, rol_id: e.target.value }))} style={girdiStili}>
                <option value="">Seçin...</option>
                {roller.map((r) => <option key={r.id} value={r.id}>{r.ad}</option>)}
              </select>
            </Alan>
            <div style={{ gridColumn: '1 / -1' }}><Buton type="submit">Kullanıcıyı oluştur</Buton></div>
          </form>
        </Kart>
      )}

      <Kart style={{ padding: 0 }}>
        {kullanicilar.length === 0 ? (
          <BosDurum baslik="Henüz kullanıcı yok" />
        ) : (
          <table>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                {['Ad Soyad', 'E-posta', 'Roller', 'Durum'].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)' }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {kullanicilar.map((k) => (
                <tr key={k.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 500 }}>{k.ad_soyad}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{k.email}</td>
                  <td style={{ padding: '10px 16px' }}>{k.roller.join(', ') || '—'}</td>
                  <td style={{ padding: '10px 16px' }}><Etiket ton={k.aktif ? 'yesil' : 'kirmizi'}>{k.aktif ? 'Aktif' : 'Pasif'}</Etiket></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Kart>
    </div>
  );
}

function RolIzinleriSekmesi() {
  const [izinler, setIzinler] = useState([]);
  const [roller, setRoller] = useState([]);
  const [seciliRolId, setSeciliRolId] = useState(null);
  const [seciliIzinKodlari, setSeciliIzinKodlari] = useState(new Set());
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [kaydedildi, setKaydedildi] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/izinler'), api.get('/roller')])
      .then(([izinRes, rolRes]) => {
        setIzinler(izinRes.data);
        setRoller(rolRes.data);
      })
      .catch((err) => setHata(hataMesajiCikar(err)));
  }, []);

  function rolSec(rol) {
    setSeciliRolId(rol.id);
    setSeciliIzinKodlari(new Set(rol.izin_kodlari || []));
    setKaydedildi(false);
  }

  function izinDegistir(kod) {
    setSeciliIzinKodlari((mevcut) => {
      const yeni = new Set(mevcut);
      if (yeni.has(kod)) yeni.delete(kod); else yeni.add(kod);
      return yeni;
    });
  }

  async function kaydet() {
    setKaydediliyor(true);
    setHata(null);
    try {
      const izinIdleri = izinler.filter((i) => seciliIzinKodlari.has(i.kod)).map((i) => i.id);
      await api.put(`/roller/${seciliRolId}/izinler`, { izin_idleri: izinIdleri });
      setKaydedildi(true);
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  const modullereGoreGrupla = izinler.reduce((acc, izin) => {
    (acc[izin.modul] ||= []).push(izin);
    return acc;
  }, {});

  return (
    <div>
      <HataMesaji>{hata}</HataMesaji>

      <div style={{ display: 'flex', gap: 20 }}>
        <Kart style={{ width: 220, padding: 0, flexShrink: 0 }}>
          <div style={{ padding: '12px 16px', fontWeight: 600, fontSize: 13, borderBottom: '1px solid var(--kenarlik)' }}>
            Roller
          </div>
          {roller.length === 0 ? (
            <div style={{ padding: 16, color: 'var(--metin-soluk)', fontSize: 13 }}>Henüz rol yok</div>
          ) : (
            roller.map((rol) => (
              <button
                key={rol.id}
                onClick={() => rolSec(rol)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px',
                  background: seciliRolId === rol.id ? 'var(--zemin)' : 'transparent',
                  border: 'none', borderBottom: '1px solid var(--kenarlik)', fontSize: 13.5,
                  fontWeight: seciliRolId === rol.id ? 600 : 400,
                }}
              >
                {rol.ad}
              </button>
            ))
          )}
        </Kart>

        <Kart style={{ flex: 1 }}>
          {!seciliRolId ? (
            <BosDurum baslik="Bir rol seçin" aciklama="Soldaki listeden bir rol seçerek izinlerini düzenleyebilirsiniz." />
          ) : (
            <>
              {Object.entries(modullereGoreGrupla).map(([modul, modulIzinleri]) => (
                <div key={modul} style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--metin-ikincil)', marginBottom: 8, textTransform: 'uppercase' }}>
                    {modul}
                  </div>
                  {modulIzinleri.map((izin) => (
                    <label key={izin.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', fontSize: 13.5 }}>
                      <input
                        type="checkbox"
                        checked={seciliIzinKodlari.has(izin.kod)}
                        onChange={() => izinDegistir(izin.kod)}
                      />
                      <span>{izin.aciklama || izin.kod}</span>
                    </label>
                  ))}
                </div>
              ))}

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <Buton onClick={kaydet} disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : 'İzinleri kaydet'}</Buton>
                {kaydedildi && <span style={{ fontSize: 13, color: 'var(--yesil)' }}>Kaydedildi</span>}
              </div>
            </>
          )}
        </Kart>
      </div>
    </div>
  );
}

const YONETICI_SEKMELERI = [
  { deger: 'sirket', etiket: 'Şirket Bilgileri' },
  { deger: 'kullanicilar', etiket: 'Kullanıcılar' },
  { deger: 'roller', etiket: 'Rol / İzinler' },
];

export default function YoneticiPaneliSayfasi() {
  const [sekme, setSekme] = useState('sirket');

  return (
    <div>
      <SayfaBasligi
        baslik="Yönetici paneli"
        aciklama="Şirket bilgileri, kullanıcılar ve rol bazlı ekran izinleri"
      />
      <Sekmeler sekmeler={YONETICI_SEKMELERI} aktif={sekme} onDegistir={setSekme} />

      {sekme === 'sirket' && <SirketBilgileriSekmesi />}
      {sekme === 'kullanicilar' && <KullanicilarSekmesi />}
      {sekme === 'roller' && <RolIzinleriSekmesi />}
    </div>
  );
}
