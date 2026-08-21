import { useEffect, useState } from 'react';
import { api, hataMesajiCikar, ozelOnayIste, ozelAlert, ozelPrompt } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Kart, SayfaBasligi, Buton, Alan, girdiStili, HataMesaji, BosDurum, Sekmeler, Etiket, eylemChipStili } from '../components/Ortak';

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

function KullaniciRolDuzenle({ kullanici, roller, onKaydedildi, onVazgec }) {
  const [rolId, setRolId] = useState('');
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      await api.put(`/kullanicilar/${kullanici.id}/rol`, { rol_id: Number(rolId) });
      onKaydedildi();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  return (
    <tr>
      <td colSpan={5} style={{ padding: 0 }}>
        <div style={{ padding: 14, background: 'var(--zemin)' }}>
          <form onSubmit={kaydet} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ flex: 1, maxWidth: 260 }}>
              <Alan etiket="Yeni rol">
                <select required value={rolId} onChange={(e) => setRolId(e.target.value)} style={girdiStili}>
                  <option value="">Seçin...</option>
                  {roller.map((r) => <option key={r.id} value={r.id}>{r.ad}</option>)}
                </select>
              </Alan>
            </div>
            <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : 'Rolü değiştir'}</Buton>
            <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
          </form>
          {hata && <div style={{ marginTop: 8 }}><HataMesaji>{hata}</HataMesaji></div>}
        </div>
      </td>
    </tr>
  );
}

function KullanicilarSekmesi() {
  const [kullanicilar, setKullanicilar] = useState([]);
  const [roller, setRoller] = useState([]);
  const [formAcik, setFormAcik] = useState(false);
  const [form, setForm] = useState({ ad_soyad: '', email: '', sifre: '', rol_id: '' });
  const [hata, setHata] = useState(null);
  const [rolDuzenlenenId, setRolDuzenlenenId] = useState(null);

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

  async function durumDegistir(kullanici) {
    const yeniDurum = !kullanici.aktif;
    const uyari = yeniDurum
      ? `${kullanici.ad_soyad} kullanıcısını tekrar aktif etmek istediğinize emin misiniz?`
      : `${kullanici.ad_soyad} kullanıcısını pasif yapmak istediğinize emin misiniz? Pasif kullanıcı sisteme giriş yapamaz.`;
    if (!(await ozelOnayIste(uyari))) return;
    try {
      await api.put(`/kullanicilar/${kullanici.id}/durum`, { aktif: yeniDurum });
      yukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  async function sifreSifirla(kullanici) {
    const yeniSifre = await ozelPrompt(`${kullanici.ad_soyad} için yeni şifre (en az 6 karakter):`);
    if (!yeniSifre) return;
    try {
      await api.put(`/kullanicilar/${kullanici.id}/sifre-sifirla`, { yeni_sifre: yeniSifre });
      await ozelAlert('Şifre güncellendi.');
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
                {['Ad Soyad', 'E-posta', 'Roller', 'Durum', 'İşlem'].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)' }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {kullanicilar.map((k) => {
                if (rolDuzenlenenId === k.id) {
                  return (
                    <KullaniciRolDuzenle
                      key={k.id}
                      kullanici={k}
                      roller={roller}
                      onKaydedildi={() => { setRolDuzenlenenId(null); yukle(); }}
                      onVazgec={() => setRolDuzenlenenId(null)}
                    />
                  );
                }
                return (
                  <tr key={k.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 500 }}>{k.ad_soyad}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{k.email}</td>
                    <td style={{ padding: '10px 16px' }}>{k.roller.join(', ') || '—'}</td>
                    <td style={{ padding: '10px 16px' }}><Etiket ton={k.aktif ? 'yesil' : 'kirmizi'}>{k.aktif ? 'Aktif' : 'Pasif'}</Etiket></td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button onClick={() => setRolDuzenlenenId(k.id)} style={eylemChipStili('lacivert')}>Rolü Değiştir</button>
                        <button onClick={() => sifreSifirla(k)} style={eylemChipStili('lacivert')}>Şifre Sıfırla</button>
                        <button onClick={() => durumDegistir(k)} style={eylemChipStili(k.aktif ? 'kirmizi' : 'yesil')}>
                          {k.aktif ? 'Pasif Yap' : 'Aktif Et'}
                        </button>
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

function RolIzinleriSekmesi() {
  const [izinler, setIzinler] = useState([]);
  const [roller, setRoller] = useState([]);
  const [seciliRolId, setSeciliRolId] = useState(null);
  const [seciliIzinKodlari, setSeciliIzinKodlari] = useState(new Set());
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [kaydedildi, setKaydedildi] = useState(false);
  const [yeniRolFormuAcik, setYeniRolFormuAcik] = useState(false);
  const [yeniRolAdi, setYeniRolAdi] = useState('');
  const [yeniRolAciklama, setYeniRolAciklama] = useState('');

  function yukle() {
    Promise.all([api.get('/izinler'), api.get('/roller')])
      .then(([izinRes, rolRes]) => {
        setIzinler(izinRes.data);
        setRoller(rolRes.data);
      })
      .catch((err) => setHata(hataMesajiCikar(err)));
  }
  useEffect(yukle, []);

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

  async function yeniRolEkle(e) {
    e.preventDefault();
    setHata(null);
    try {
      const { data } = await api.post('/roller', { ad: yeniRolAdi, aciklama: yeniRolAciklama || null });
      setYeniRolFormuAcik(false);
      setYeniRolAdi('');
      setYeniRolAciklama('');
      yukle();
      rolSec(data);
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  async function rolSil(rol) {
    if (!(await ozelOnayIste(`"${rol.ad}" rolünü silmek istediğinize emin misiniz?`))) return;
    try {
      await api.delete(`/roller/${rol.id}`);
      if (seciliRolId === rol.id) setSeciliRolId(null);
      yukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
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
        <Kart style={{ width: 240, padding: 0, flexShrink: 0 }}>
          <div style={{ padding: '12px 16px', fontWeight: 600, fontSize: 13, borderBottom: '1px solid var(--kenarlik)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Roller</span>
            <button onClick={() => setYeniRolFormuAcik((a) => !a)} style={{ ...eylemChipStili('lacivert'), fontSize: 11 }}>
              {yeniRolFormuAcik ? 'Kapat' : '+ Yeni'}
            </button>
          </div>

          {yeniRolFormuAcik && (
            <form onSubmit={yeniRolEkle} style={{ padding: 12, borderBottom: '1px solid var(--kenarlik)' }}>
              <Alan etiket="Rol adı">
                <input required value={yeniRolAdi} onChange={(e) => setYeniRolAdi(e.target.value)} style={girdiStili} />
              </Alan>
              <Alan etiket="Açıklama (opsiyonel)">
                <input value={yeniRolAciklama} onChange={(e) => setYeniRolAciklama(e.target.value)} style={girdiStili} />
              </Alan>
              <Buton type="submit" style={{ width: '100%' }}>Rolü oluştur</Buton>
            </form>
          )}

          {roller.length === 0 ? (
            <div style={{ padding: 16, color: 'var(--metin-soluk)', fontSize: 13 }}>Henüz rol yok</div>
          ) : (
            roller.map((rol) => (
              <div
                key={rol.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 16px', background: seciliRolId === rol.id ? 'var(--zemin)' : 'transparent',
                  borderBottom: '1px solid var(--kenarlik)',
                }}
              >
                <button
                  onClick={() => rolSec(rol)}
                  style={{
                    flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 13.5, fontWeight: seciliRolId === rol.id ? 600 : 400, padding: 0,
                  }}
                >
                  {rol.ad}
                </button>
                <button
                  onClick={() => rolSil(rol)}
                  title="Rolü sil"
                  style={{ background: 'none', border: 'none', color: 'var(--kirmizi)', cursor: 'pointer', fontSize: 12, padding: '2px 6px' }}
                >
                  Sil
                </button>
              </div>
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
  { deger: 'denetim', etiket: 'Düzenleme Geçmişi' },
  { deger: 'tehlikeli', etiket: 'Tehlikeli İşlemler' },
];

const TABLO_ADI_METIN = {
  banka_hareketleri: 'Banka Hareketi',
  kasa_hareketleri: 'Ana Kasa Hareketi',
  sabit_giderler: 'Diğer Gider',
  kiralama_sozlesmeleri: 'Kiralama Sözleşmesi',
  akreditif_kalemleri: 'Akreditif Kalemi',
  stok_seri_no: 'Stok Ürünü',
  stok_maliyet_kalemleri: 'Stok Maliyet Kalemi',
  cari_hesaplar: 'Cari Hesap',
  siparisler: 'Sipariş',
  cekler: 'Çek',
  personel: 'Personel',
  borclar: 'Ortak/Dış Borç',
};

function DuzenlemeGecmisiSekmesi() {
  const [liste, setListe] = useState([]);
  const [hata, setHata] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    api.get('/admin/duzenleme-gecmisi')
      .then((r) => setListe(r.data))
      .catch((e) => setHata(hataMesajiCikar(e)))
      .finally(() => setYukleniyor(false));
  }, []);

  function degisiklikleriGoster(metin) {
    if (!metin) return '—';
    try {
      const obj = JSON.parse(metin);
      return Object.entries(obj).map(([alan, deger]) => (
        `${alan}: "${deger.eski ?? '—'}" → "${deger.yeni ?? '—'}"`
      )).join('; ');
    } catch {
      return metin;
    }
  }

  const ISLEM_TIPI_METIN = { OLUSTURMA: 'Oluşturma', DUZENLEME: 'Düzenleme', SILME: 'Silme' };
  const ISLEM_TIPI_TON = { OLUSTURMA: 'yesil', DUZENLEME: 'amber', SILME: 'kirmizi' };

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--metin-ikincil)', marginBottom: 12 }}>
        Şifre onayı gerektiren düzenlemelerin ve (kayıt altına alınmış) oluşturma/silme işlemlerinin kaydı —
        kim, ne zaman, hangi kaydı, ne yaptı.
      </div>
      <HataMesaji>{hata}</HataMesaji>
      <Kart style={{ padding: 0 }}>
        {yukleniyor ? (
          <div style={{ padding: 20, color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
        ) : liste.length === 0 ? (
          <BosDurum baslik="Henüz şifre onaylı bir düzenleme yapılmamış" />
        ) : (
          <table>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                {['Tarih', 'Kullanıcı', 'İşlem', 'Tablo', 'Kayıt No', 'Değişiklikler'].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {liste.map((k) => (
                <tr key={k.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                  <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)', whiteSpace: 'nowrap' }}>
                    {k.tarih ? new Date(k.tarih).toLocaleString('tr-TR') : '—'}
                  </td>
                  <td style={{ padding: '10px 16px', fontWeight: 500 }}>{k.kullanici_adi}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <Etiket ton={ISLEM_TIPI_TON[k.islem_tipi] || 'notr'}>{ISLEM_TIPI_METIN[k.islem_tipi] || k.islem_tipi || 'Düzenleme'}</Etiket>
                  </td>
                  <td style={{ padding: '10px 16px' }}><Etiket ton="notr">{TABLO_ADI_METIN[k.tablo_adi] || k.tablo_adi}</Etiket></td>
                  <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>#{k.kayit_id}</td>

                  <td style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--metin-ikincil)' }}>{degisiklikleriGoster(k.degisiklikler)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Kart>
    </div>
  );
}

function AciklamalariYenidenUretKarti() {
  const [calisiyor, setCalisiyor] = useState(false);
  const [sonuc, setSonuc] = useState(null);
  const [hata, setHata] = useState(null);

  async function calistir() {
    if (!(await ozelOnayIste('Kiralama ve Taksitli Satış kaynaklı eski Kasa/Banka hareketlerinin açıklamaları, ürün/müşteri adı eklenerek yeniden yazılacak. Devam edilsin mi?'))) return;
    setHata(null);
    setSonuc(null);
    setCalisiyor(true);
    try {
      const { data } = await api.post('/admin/aciklamalari-yeniden-uret');
      setSonuc(data);
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setCalisiyor(false);
    }
  }

  return (
    <Kart style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 8 }}>
        Eski Açıklamaları Yeniden Üret
      </div>
      <div style={{ fontSize: 13, color: 'var(--metin-ikincil)', marginBottom: 14 }}>
        Kiralama ve Taksitli Satış tahsilatlarında, ürün adı eklenmeden önce oluşmuş Kasa/Banka
        hareketlerinin açıklamasını günceller (sadece metin değişir, tutar/tarih etkilenmez — güvenlidir).
      </div>
      <HataMesaji>{hata}</HataMesaji>
      {sonuc && (
        <div style={{ background: 'var(--yesil-acik)', color: 'var(--yesil)', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
          {sonuc.guncellenen_kayit} kaydın açıklaması güncellendi.
        </div>
      )}
      <Buton onClick={calistir} disabled={calisiyor}>{calisiyor ? 'Çalışıyor...' : 'Şimdi Çalıştır'}</Buton>
    </Kart>
  );
}

function GeriYuklemeKarti() {
  const [dosya, setDosya] = useState(null);
  const [onayMetni, setOnayMetni] = useState('');
  const [calisiyor, setCalisiyor] = useState(false);
  const [sonuc, setSonuc] = useState(null);
  const [hata, setHata] = useState(null);

  async function geriYukle() {
    if (!dosya) { setHata('Lütfen bir yedek dosyası (.json) seçin.'); return; }
    if (onayMetni !== 'EVET GERİ YÜKLE') {
      setHata('Devam etmek için kutuya tam olarak "EVET GERİ YÜKLE" yazmalısınız.');
      return;
    }
    if (!(await ozelOnayIste('Bu işlem, veritabanındaki TÜM MEVCUT veriyi silip, seçtiğiniz dosyadaki veriyle değiştirecek. Bu işlem GERİ ALINAMAZ. Emin misiniz?'))) return;
    setHata(null);
    setSonuc(null);
    setCalisiyor(true);
    try {
      const formData = new FormData();
      formData.append('dosya', dosya);
      formData.append('onay_metni', onayMetni);
      const { data } = await api.post('/yonetim/veritabani-geri-yukle', formData);
      setSonuc(data);
      setOnayMetni('');
      setDosya(null);
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setCalisiyor(false);
    }
  }

  return (
    <Kart style={{ borderLeft: '4px solid var(--kirmizi)', marginBottom: 16 }}>
      <div style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 8, color: 'var(--kirmizi)' }}>
        Yedekten Geri Yükle
      </div>
      <div style={{ fontSize: 13, color: 'var(--metin-ikincil)', marginBottom: 16 }}>
        "Veritabanını Yedekle" ile daha önce indirdiğiniz bir .json dosyasını seçin. Bu işlem, veritabanındaki
        <strong> tüm mevcut veriyi siler</strong> ve yerine bu dosyadaki veriyi yazar — bir felaket/yanlışlık
        durumunda (örn. "Test Verilerini Temizle" yanlışlıkla çalıştırılırsa) hızlıca eski duruma dönmek içindir.
        Bu işlem <strong>geri alınamaz</strong>.
      </div>
      <HataMesaji>{hata}</HataMesaji>
      {sonuc && (
        <div style={{ background: 'var(--yesil-acik)', color: 'var(--yesil)', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
          Geri yükleme tamamlandı. {sonuc.yuklenen_tablo_sayisi} tablo, toplam {sonuc.toplam_satir} satır yüklendi.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 480 }}>
        <Alan etiket="Yedek dosyası (.json)">
          <input type="file" accept=".json" onChange={(e) => setDosya(e.target.files[0] || null)} style={girdiStili} />
        </Alan>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <Alan etiket='Devam etmek için "EVET GERİ YÜKLE" yazın'>
              <input value={onayMetni} onChange={(e) => setOnayMetni(e.target.value)} style={girdiStili} />
            </Alan>
          </div>
          <button
            onClick={geriYukle}
            disabled={calisiyor}
            style={{
              padding: '10px 18px', borderRadius: 8, border: 'none', background: 'var(--kirmizi)', color: 'white',
              fontWeight: 600, cursor: calisiyor ? 'default' : 'pointer', marginBottom: 14,
            }}
          >
            {calisiyor ? 'Yükleniyor...' : 'Geri Yükle'}
          </button>
        </div>
      </div>
    </Kart>
  );
}

function TehlikeliIslemlerSekmesi() {
  const [onayMetni, setOnayMetni] = useState('');
  const [calisiyor, setCalisiyor] = useState(false);
  const [sonuc, setSonuc] = useState(null);
  const [hata, setHata] = useState(null);

  async function temizle() {
    if (onayMetni !== 'EVET SİL') {
      setHata('Devam etmek için kutuya tam olarak "EVET SİL" yazmalısınız.');
      return;
    }
    if (!(await ozelOnayIste('Bu işlem TÜM cari/sipariş/stok/finansal takip/kasa-banka verilerini KALICI olarak silecek. Emin misiniz?'))) return;
    setHata(null);
    setSonuc(null);
    setCalisiyor(true);
    try {
      const { data } = await api.post('/admin/test-verilerini-temizle', { onay_metni: onayMetni });
      setSonuc(data);
      setOnayMetni('');
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setCalisiyor(false);
    }
  }

  return (
    <div>
      <AciklamalariYenidenUretKarti />
      <GeriYuklemeKarti />
      <Kart style={{ borderLeft: '4px solid var(--kirmizi)' }}>
      <div style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 8, color: 'var(--kirmizi)' }}>
        Test Verilerini Temizle
      </div>
      <div style={{ fontSize: 13, color: 'var(--metin-ikincil)', marginBottom: 16 }}>
        Bu işlem <strong>geri alınamaz</strong>. Şunlar hariç her şey silinir: Şirket bilgisi, Kullanıcılar/Roller/İzinler,
        Ürün Tanımları, Banka Hesapları, Sabit Gider Kategorileri, Harcama Türleri.
        Silinenler: tüm Cariler, Siparişler, Stok, Akreditif/Leasing/Çek/Kiralama/Taksitli Satış/Bakım/Personel/Sabit Gider/Borç
        kayıtları, Proforma/Fatura, Kasa/Banka hareketleri, Virman geçmişi.
      </div>
      <HataMesaji>{hata}</HataMesaji>
      {sonuc && (
        <div style={{ background: 'var(--yesil-acik)', color: 'var(--yesil)', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
          Temizlik tamamlandı. Toplam {sonuc.toplam_silinen} kayıt silindi.
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', maxWidth: 480 }}>
        <div style={{ flex: 1 }}>
          <Alan etiket='Devam etmek için "EVET SİL" yazın'>
            <input value={onayMetni} onChange={(e) => setOnayMetni(e.target.value)} style={girdiStili} />
          </Alan>
        </div>
        <button
          onClick={temizle}
          disabled={calisiyor}
          style={{
            padding: '10px 18px', borderRadius: 8, border: 'none', background: 'var(--kirmizi)', color: 'white',
            fontWeight: 600, cursor: calisiyor ? 'default' : 'pointer', marginBottom: 14,
          }}
        >
          {calisiyor ? 'Siliniyor...' : 'Kalıcı Olarak Sil'}
        </button>
      </div>
    </Kart>
    </div>
  );
}

export default function YoneticiPaneliSayfasi() {
  const [sekme, setSekme] = useState('sirket');
  const [yedekIndiriliyor, setYedekIndiriliyor] = useState(false);
  const [yedekHata, setYedekHata] = useState(null);

  async function veritabaniniYedekle() {
    setYedekIndiriliyor(true);
    setYedekHata(null);
    try {
      const yanit = await api.get('/yonetim/veritabani-yedek', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([yanit.data]));
      const bugun = new Date().toISOString().slice(0, 10);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kinetik_erp_yedek_${bugun}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setYedekHata(hataMesajiCikar(err));
    } finally {
      setYedekIndiriliyor(false);
    }
  }

  return (
    <div>
      <SayfaBasligi
        baslik="Yönetici paneli"
        aciklama="Şirket bilgileri, kullanıcılar ve rol bazlı ekran izinleri"
        eylem={
          <Buton variant="ikincil" onClick={veritabaniniYedekle} disabled={yedekIndiriliyor}>
            {yedekIndiriliyor ? 'Hazırlanıyor...' : '💾 Veritabanını Yedekle'}
          </Buton>
        }
      />
      <HataMesaji>{yedekHata}</HataMesaji>
      <Sekmeler sekmeler={YONETICI_SEKMELERI} aktif={sekme} onDegistir={setSekme} />

      {sekme === 'sirket' && <SirketBilgileriSekmesi />}
      {sekme === 'kullanicilar' && <KullanicilarSekmesi />}
      {sekme === 'roller' && <RolIzinleriSekmesi />}
      {sekme === 'denetim' && <DuzenlemeGecmisiSekmesi />}
      {sekme === 'tehlikeli' && <TehlikeliIslemlerSekmesi />}
    </div>
  );
}
