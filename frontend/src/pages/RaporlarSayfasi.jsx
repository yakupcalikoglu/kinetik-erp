import { useEffect, useState, Fragment } from 'react';
import { api, hataMesajiCikar } from '../api/client';
import {
  Kart, SayfaBasligi, Buton, Alan, girdiStili, HataMesaji, BosDurum, paraFormat, Etiket,
} from '../components/Ortak';

const HAREKET_TURLERI = [
  { deger: 'STOK_SATIS', etiket: 'Stok Satışı (peşin)' },
  { deger: 'TAKSIT', etiket: 'Taksitli Satış Tahsilatı' },
  { deger: 'KIRA_GELIRI', etiket: 'Kira Geliri' },
  { deger: 'AKREDITIF', etiket: 'Akreditif Ödemesi' },
  { deger: 'LEASING', etiket: 'Leasing Ödemesi' },
  { deger: 'CEK', etiket: 'Çek (Tahsilat/Ödeme)' },
  { deger: 'MAAS', etiket: 'Maaş' },
  { deger: 'SABIT_GIDER', etiket: 'Diğer Gider' },
  { deger: 'BORC_ODEME', etiket: 'Borç Ödeme' },
  { deger: 'BAKIM_GELIRI', etiket: 'Bakım Geliri' },
  { deger: 'BAKIM_GIDERI', etiket: 'Bakım Gideri' },
];

// ============================================================== GENEL BAKIŞ
function GenelBakisKarti() {
  const [ozet, setOzet] = useState(null);
  const [hata, setHata] = useState(null);

  useEffect(() => {
    api.get('/raporlar/genel-bakis').then((r) => setOzet(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }, []);

  if (hata) return <HataMesaji>{hata}</HataMesaji>;
  if (!ozet) return null;

  const kutular = [
    { baslik: 'Ana Kasa Bakiyesi (TL)', deger: paraFormat(ozet.ana_kasa_bakiye_try), renk: ozet.ana_kasa_bakiye_try >= 0 ? 'var(--yesil)' : 'var(--kirmizi)' },
    { baslik: '7 Gün İçinde Vadesi Gelen Çekler', deger: `${ozet.vadesi_yaklasan_cek_sayisi} adet · ${paraFormat(ozet.vadesi_yaklasan_cek_toplami)}`, renk: ozet.vadesi_yaklasan_cek_sayisi > 0 ? 'var(--amber)' : 'var(--metin-ikincil)' },
    { baslik: 'Vadesi Geçmiş Taksitler', deger: `${ozet.geciken_taksit_sayisi} adet · ${paraFormat(ozet.geciken_taksit_toplami)}`, renk: ozet.geciken_taksit_sayisi > 0 ? 'var(--kirmizi)' : 'var(--metin-ikincil)' },
    { baslik: 'Depodaki Ürün Sayısı', deger: `${ozet.depodaki_urun_sayisi} adet`, renk: 'var(--metin-birincil)' },
    { baslik: 'Aktif Kiralama Sayısı', deger: `${ozet.aktif_kiralama_sayisi} adet`, renk: 'var(--metin-birincil)' },
  ];

  return (
    <Kart style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 14 }}>Genel bakış</div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {kutular.map((k) => (
          <div key={k.baslik} style={{ flex: '1 1 180px', padding: '12px 14px', background: 'var(--zemin)', borderRadius: 10 }}>
            <div style={{ fontSize: 11.5, color: 'var(--metin-ikincil)', marginBottom: 6 }}>{k.baslik}</div>
            <div style={{ fontSize: 17, fontWeight: 600, color: k.renk }}>{k.deger}</div>
          </div>
        ))}
      </div>
    </Kart>
  );
}

// ============================================================== YAKLAŞAN VADELER
function paraBazliToplamGoster(satirlar) {
  if (!satirlar || satirlar.length === 0) return '—';
  const gruplar = {};
  satirlar.forEach((s) => {
    const pb = s.para_birimi || 'TRY';
    gruplar[pb] = (gruplar[pb] || 0) + Number(s.tutar);
  });
  return Object.entries(gruplar).map(([pb, tutar]) => paraFormat(tutar, pb)).join(' + ');
}

function YaklasanVadelerKarti() {
  const [gun, setGun] = useState(30);
  const [veri, setVeri] = useState(null);
  const [hata, setHata] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  function yukle() {
    setYukleniyor(true);
    api.get('/raporlar/yaklasan-vadeler', { params: { gun } })
      .then((r) => setVeri(r.data))
      .catch((e) => setHata(hataMesajiCikar(e)))
      .finally(() => setYukleniyor(false));
  }
  useEffect(yukle, [gun]); // eslint-disable-line

  return (
    <Kart style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600 }}>Yaklaşan vadeler</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[30, 60, 90].map((g) => (
            <button
              key={g}
              onClick={() => setGun(g)}
              style={{
                padding: '5px 12px', borderRadius: 7, fontSize: 12.5, cursor: 'pointer',
                border: gun === g ? '1.5px solid var(--lacivert)' : '1px solid var(--kenarlik)',
                background: gun === g ? 'var(--lacivert)' : 'white',
                color: gun === g ? 'white' : 'var(--metin-birincil)',
              }}
            >
              {g} gün
            </button>
          ))}
        </div>
      </div>
      <HataMesaji>{hata}</HataMesaji>

      {yukleniyor ? (
        <div style={{ color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--kirmizi)' }}>
              Yapılacak ödemeler — Toplam: {veri ? paraBazliToplamGoster(veri.odemeler) : '—'}
            </div>
            {!veri || veri.odemeler.length === 0 ? (
              <BosDurum baslik="Yaklaşan ödeme yok" />
            ) : (
              <table>
                <tbody>
                  {veri.odemeler.map((o, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                      <td style={{ padding: '6px 8px', color: 'var(--metin-ikincil)', fontSize: 12.5 }}>{o.tarih}</td>
                      <td style={{ padding: '6px 8px', fontSize: 12.5 }}>{o.aciklama}</td>
                      <td style={{ padding: '6px 8px', fontSize: 12.5, fontWeight: 500, textAlign: 'right' }}>{paraFormat(o.tutar, o.para_birimi)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--yesil)' }}>
              Yapılacak tahsilatlar — Toplam: {veri ? paraBazliToplamGoster(veri.tahsilatlar) : '—'}
            </div>
            {!veri || veri.tahsilatlar.length === 0 ? (
              <BosDurum baslik="Yaklaşan tahsilat yok" />
            ) : (
              <table>
                <tbody>
                  {veri.tahsilatlar.map((t, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                      <td style={{ padding: '6px 8px', color: 'var(--metin-ikincil)', fontSize: 12.5 }}>{t.tarih}</td>
                      <td style={{ padding: '6px 8px', fontSize: 12.5 }}>{t.aciklama}</td>
                      <td style={{ padding: '6px 8px', fontSize: 12.5, fontWeight: 500, textAlign: 'right' }}>{paraFormat(t.tutar, t.para_birimi)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </Kart>
  );
}

// ============================================================== HARCAMA TÜRLERİ ÖZETİ
function HarcamaTurleriOzetiKarti() {
  const [baslangic, setBaslangic] = useState('');
  const [bitis, setBitis] = useState('');
  const [liste, setListe] = useState(null);
  const [hata, setHata] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(false);

  function sorgula() {
    setYukleniyor(true);
    setHata(null);
    const params = {};
    if (baslangic) params.baslangic = baslangic;
    if (bitis) params.bitis = bitis;
    api.get('/raporlar/harcama-turleri-ozeti', { params })
      .then((r) => setListe(r.data))
      .catch((e) => setHata(hataMesajiCikar(e)))
      .finally(() => setYukleniyor(false));
  }
  useEffect(sorgula, []); // eslint-disable-line

  const genelToplam = liste ? liste.reduce((acc, s) => acc + Number(s.toplam_tutar_try), 0) : 0;

  return (
    <Kart style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 4 }}>Harcama Türlerine Göre Özet</div>
      <div style={{ fontSize: 12, color: 'var(--metin-ikincil)', marginBottom: 14 }}>
        Diğer Giderler'de girilen her harcama türü (Elektrik, Su, Kira, Nakliye vb.) için ayrı toplam
      </div>
      <HataMesaji>{hata}</HataMesaji>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' }}>
        <Alan etiket="Başlangıç tarihi (dönem)">
          <input type="date" value={baslangic} onChange={(e) => setBaslangic(e.target.value)} style={girdiStili} />
        </Alan>
        <Alan etiket="Bitiş tarihi (dönem)">
          <input type="date" value={bitis} onChange={(e) => setBitis(e.target.value)} style={girdiStili} />
        </Alan>
        <Buton onClick={sorgula} disabled={yukleniyor} style={{ marginBottom: 14 }}>{yukleniyor ? 'Sorgulanıyor...' : 'Sorgula'}</Buton>
      </div>

      {!liste ? (
        <div style={{ color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
      ) : liste.length === 0 ? (
        <BosDurum baslik="Bu tarih aralığında gider kaydı yok" />
      ) : (
        <>
          <table>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                {['Harcama Türü', 'Kayıt Sayısı', 'Toplam', 'Ödenen', 'Ödenmemiş'].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--metin-ikincil)' }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {liste.map((s) => (
                <tr key={s.kategori} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 500 }}>{s.kategori}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--metin-ikincil)' }}>{s.adet}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>{paraFormat(s.toplam_tutar_try)}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--yesil)' }}>{paraFormat(s.odenen_tutar_try)}</td>
                  <td style={{ padding: '8px 12px', color: Number(s.odenmemis_tutar_try) > 0 ? 'var(--kirmizi)' : 'var(--metin-ikincil)' }}>
                    {paraFormat(s.odenmemis_tutar_try)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, textAlign: 'right' }}>
            Genel toplam: {paraFormat(genelToplam)}
          </div>
        </>
      )}
    </Kart>
  );
}

// ============================================================== KÂR MARJI ANALİZİ
function KarMarjiKarti() {
  const [veri, setVeri] = useState(null);
  const [hata, setHata] = useState(null);

  useEffect(() => {
    api.get('/raporlar/kar-marji-analizi').then((r) => setVeri(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }, []);

  return (
    <Kart style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Ürün Bazında Kâr Marjı</div>
      <div style={{ fontSize: 12.5, color: 'var(--metin-ikincil)', marginBottom: 14 }}>
        Şimdiye kadar satılmış ürünlerin, ürün tanımına göre gruplanmış toplam kâr/zarar ve marj oranı
      </div>
      <HataMesaji>{hata}</HataMesaji>
      {!veri ? (
        <div style={{ color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
      ) : veri.length === 0 ? (
        <BosDurum baslik="Henüz satılmış ürün yok" />
      ) : (
        <table>
          <thead>
            <tr style={{ background: 'var(--zemin)' }}>
              {['Ürün', 'Adet Satıldı', 'Toplam Maliyet', 'Toplam Satış', 'Toplam Kâr', 'Kâr Marjı'].map((b) => (
                <th key={b} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>{b}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {veri.map((s) => (
              <tr key={s.stok_karti_id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                <td style={{ padding: '8px 12px', fontWeight: 500 }}>{s.urun_adi}</td>
                <td style={{ padding: '8px 12px' }}>{s.adet_satildi}</td>
                <td style={{ padding: '8px 12px' }}>{paraFormat(s.toplam_maliyet_try)}</td>
                <td style={{ padding: '8px 12px' }}>{paraFormat(s.toplam_satis_try)}</td>
                <td style={{ padding: '8px 12px', fontWeight: 600, color: s.toplam_kar_try >= 0 ? 'var(--yesil)' : 'var(--kirmizi)' }}>
                  {paraFormat(s.toplam_kar_try)}
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <Etiket ton={s.ortalama_kar_marji_yuzde >= 0 ? 'yesil' : 'kirmizi'}>%{s.ortalama_kar_marji_yuzde}</Etiket>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Kart>
  );
}

// ============================================================== DEPO ENVANTERİ
function DepoEnvanteriDetayi({ stokKartiId }) {
  const [urunler, setUrunler] = useState(null);
  const [hata, setHata] = useState(null);

  useEffect(() => {
    api.get('/stok-seri-no', { params: { stok_karti_id: stokKartiId, durum: 'DEPODA' } })
      .then((r) => setUrunler(r.data))
      .catch((e) => setHata(hataMesajiCikar(e)));
  }, [stokKartiId]);

  if (hata) return <div style={{ padding: '8px 16px', color: 'var(--kirmizi)', fontSize: 12.5 }}>{hata}</div>;
  if (!urunler) return <div style={{ padding: '8px 16px', color: 'var(--metin-soluk)', fontSize: 12.5 }}>Yükleniyor...</div>;

  return (
    <div style={{ padding: '8px 16px 14px', background: 'var(--zemin)' }}>
      <table style={{ width: '100%' }}>
        <thead>
          <tr>
            {['Seri No', 'Şasi No', 'Toplam Maliyet'].map((b) => (
              <th key={b} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 11.5, color: 'var(--metin-ikincil)' }}>{b}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {urunler.map((u) => (
            <tr key={u.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
              <td style={{ padding: '6px 10px', fontFamily: 'var(--font-mono)' }}>{u.seri_no}</td>
              <td style={{ padding: '6px 10px', color: 'var(--metin-ikincil)' }}>{u.sasi_no || '—'}</td>
              <td style={{ padding: '6px 10px' }}>{paraFormat(u.toplam_maliyet_try)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DepoEnvanteriKarti() {
  const [liste, setListe] = useState(null);
  const [hata, setHata] = useState(null);
  const [acikId, setAcikId] = useState(null);

  useEffect(() => {
    api.get('/raporlar/depo-envanteri').then((r) => setListe(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }, []);

  const genelToplam = liste ? liste.reduce((acc, g) => acc + Number(g.toplam_deger_try), 0) : 0;

  return (
    <Kart style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 14 }}>Depo envanteri (ürün türüne göre)</div>
      <div style={{ fontSize: 12, color: 'var(--metin-ikincil)', marginTop: -10, marginBottom: 14 }}>
        Bir satıra tıklayınca o ürün türüne ait seri numaralarını görebilirsiniz.
      </div>
      <HataMesaji>{hata}</HataMesaji>
      {!liste ? (
        <div style={{ color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
      ) : liste.length === 0 ? (
        <BosDurum baslik="Depoda ürün yok" />
      ) : (
        <>
          <table>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                {['Ürün', 'Adet', 'Toplam Değer (TL)'].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--metin-ikincil)' }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {liste.map((g) => (
                <Fragment key={g.stok_karti_id}>
                  <tr
                    onClick={() => setAcikId((mevcut) => (mevcut === g.stok_karti_id ? null : g.stok_karti_id))}
                    style={{ borderTop: '1px solid var(--kenarlik)', cursor: 'pointer', background: acikId === g.stok_karti_id ? 'var(--zemin)' : 'transparent' }}
                  >
                    <td style={{ padding: '8px 12px' }}>
                      {g.marka} {g.model}
                      <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--lacivert)' }}>
                        {acikId === g.stok_karti_id ? '▲ detayı gizle' : '▼ detay göster'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px' }}>{g.adet} {g.birim || 'adet'}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 500 }}>{paraFormat(g.toplam_deger_try)}</td>
                  </tr>
                  {acikId === g.stok_karti_id && (
                    <tr>
                      <td colSpan={3} style={{ padding: 0 }}>
                        <DepoEnvanteriDetayi stokKartiId={g.stok_karti_id} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, textAlign: 'right' }}>
            Genel toplam: {paraFormat(genelToplam)}
          </div>
        </>
      )}
    </Kart>
  );
}

// ============================================================== AKTİF KİRALAMALAR
function AktifKiralamalarKarti() {
  const [liste, setListe] = useState(null);
  const [hata, setHata] = useState(null);

  useEffect(() => {
    api.get('/raporlar/aktif-kiralamalar').then((r) => setListe(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }, []);

  return (
    <Kart style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 14 }}>Aktif kiralamalar</div>
      <HataMesaji>{hata}</HataMesaji>
      {!liste ? (
        <div style={{ color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
      ) : liste.length === 0 ? (
        <BosDurum baslik="Aktif kiralama yok" />
      ) : (
        <table>
          <thead>
            <tr style={{ background: 'var(--zemin)' }}>
              {['Ürün', 'Seri No', 'Kiracı', 'Aylık Kira'].map((b) => (
                <th key={b} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--metin-ikincil)' }}>{b}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {liste.map((k) => (
              <tr key={k.stok_seri_no_id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                <td style={{ padding: '8px 12px' }}>{k.marka} {k.model}</td>
                <td style={{ padding: '8px 12px', color: 'var(--metin-ikincil)', fontFamily: 'var(--font-mono)' }}>{k.seri_no}</td>
                <td style={{ padding: '8px 12px' }}>{k.kiraci_unvan}</td>
                <td style={{ padding: '8px 12px', fontWeight: 500 }}>{paraFormat(k.aylik_kira_tutari, k.para_birimi)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Kart>
  );
}

// ============================================================== ANA KASA ÖZETİ (tarih aralıklı)
function AnaKasaOzetKarti() {
  const [baslangic, setBaslangic] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [bitis, setBitis] = useState(new Date().toISOString().slice(0, 10));
  const [ozet, setOzet] = useState(null);
  const [hata, setHata] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(false);

  async function sorgula() {
    setYukleniyor(true);
    setHata(null);
    try {
      const { data } = await api.get('/raporlar/ana-kasa-ozet', { params: { baslangic, bitis } });
      setOzet(data);
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setYukleniyor(false);
    }
  }
  useEffect(() => { sorgula(); }, []); // eslint-disable-line

  return (
    <Kart style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 14 }}>Ana kasa özeti (tarih aralığı — örn. "bu ay ne kadar giriş/çıkış oldu")</div>
      <HataMesaji>{hata}</HataMesaji>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 14, flexWrap: 'wrap' }}>
        <Alan etiket="Başlangıç">
          <input type="date" value={baslangic} onChange={(e) => setBaslangic(e.target.value)} style={girdiStili} />
        </Alan>
        <Alan etiket="Bitiş">
          <input type="date" value={bitis} onChange={(e) => setBitis(e.target.value)} style={girdiStili} />
        </Alan>
        <Buton onClick={sorgula} disabled={yukleniyor} style={{ marginBottom: 14 }}>{yukleniyor ? 'Sorgulanıyor...' : 'Sorgula'}</Buton>
      </div>
      {ozet && (
        <div style={{ display: 'flex', gap: 20 }}>
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--metin-ikincil)' }}>Toplam Giriş</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--yesil)' }}>{paraFormat(ozet.toplam_giris)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--metin-ikincil)' }}>Toplam Çıkış</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--kirmizi)' }}>{paraFormat(ozet.toplam_cikis)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--metin-ikincil)' }}>Net</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: ozet.net_bakiye >= 0 ? 'var(--yesil)' : 'var(--kirmizi)' }}>{paraFormat(ozet.net_bakiye)}</div>
          </div>
        </div>
      )}
    </Kart>
  );
}

// ============================================================== HAREKET TÜRÜ RAPORU
function HareketTuruRaporu() {
  const [tur, setTur] = useState('STOK_SATIS');
  const [baslangic, setBaslangic] = useState('');
  const [bitis, setBitis] = useState('');
  const [sonuc, setSonuc] = useState(null);
  const [hata, setHata] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(false);

  async function sorgula() {
    setYukleniyor(true);
    setHata(null);
    try {
      const params = { tur };
      if (baslangic) params.baslangic = baslangic;
      if (bitis) params.bitis = bitis;
      const { data } = await api.get('/raporlar/hareket-turu', { params });
      setSonuc(data);
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setYukleniyor(false);
    }
  }

  return (
    <Kart style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 16 }}>Hareket türüne göre rapor</div>
      <div style={{ fontSize: 12.5, color: 'var(--metin-ikincil)', marginTop: -10, marginBottom: 14 }}>
        Örn: "Bu ay ne satış yaptım?" için "Stok Satışı" veya "Taksitli Satış Tahsilatı" seçip bu ayın tarihlerini gir.
      </div>
      <HataMesaji>{hata}</HataMesaji>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 220 }}>
          <Alan etiket="Hareket türü">
            <select value={tur} onChange={(e) => setTur(e.target.value)} style={girdiStili}>
              {HAREKET_TURLERI.map((t) => <option key={t.deger} value={t.deger}>{t.etiket}</option>)}
            </select>
          </Alan>
        </div>
        <div>
          <Alan etiket="Başlangıç tarihi">
            <input type="date" value={baslangic} onChange={(e) => setBaslangic(e.target.value)} style={girdiStili} />
          </Alan>
        </div>
        <div>
          <Alan etiket="Bitiş tarihi">
            <input type="date" value={bitis} onChange={(e) => setBitis(e.target.value)} style={girdiStili} />
          </Alan>
        </div>
        <Buton onClick={sorgula} disabled={yukleniyor} style={{ marginBottom: 14 }}>
          {yukleniyor ? 'Sorgulanıyor...' : 'Sorgula'}
        </Buton>
      </div>

      {sonuc && (
        sonuc.satirlar.length === 0 ? (
          <BosDurum baslik="Bu türde/tarih aralığında kayıt bulunamadı" />
        ) : (
          <>
            <div style={{ fontSize: 13, color: 'var(--metin-ikincil)', marginBottom: 10 }}>
              {sonuc.adet} kayıt · Toplam: <strong>{paraFormat(sonuc.toplam_tutar)}</strong>
            </div>
            <table>
              <thead>
                <tr style={{ background: 'var(--zemin)' }}>
                  {['Tarih', 'Açıklama', 'Tutar'].map((b) => (
                    <th key={b} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--metin-ikincil)' }}>{b}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sonuc.satirlar.map((s, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                    <td style={{ padding: '8px 12px' }}>{s.tarih}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--metin-ikincil)' }}>{s.aciklama || '—'}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 500 }}>{paraFormat(s.tutar)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )
      )}
    </Kart>
  );
}

// ============================================================== SERİ NO RAPORU
function SeriNoRaporu() {
  const [seriNo, setSeriNo] = useState('');
  const [sonuc, setSonuc] = useState(null);
  const [hata, setHata] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(false);

  async function sorgula() {
    if (!seriNo.trim()) return;
    setYukleniyor(true);
    setHata(null);
    setSonuc(null);
    try {
      const { data } = await api.get('/raporlar/seri-no', { params: { seri_no: seriNo } });
      setSonuc(data);
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setYukleniyor(false);
    }
  }

  return (
    <Kart style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 16 }}>Ürüne göre rapor (seri numarası)</div>
      <HataMesaji>{hata}</HataMesaji>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={seriNo}
          onChange={(e) => setSeriNo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sorgula()}
          placeholder="Örn: HC2026-00451"
          style={{ ...girdiStili, maxWidth: 280 }}
        />
        <Buton onClick={sorgula} disabled={yukleniyor}>{yukleniyor ? 'Aranıyor...' : 'Ara'}</Buton>
      </div>

      {sonuc && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13.5 }}>
          <div><span style={{ color: 'var(--metin-ikincil)' }}>Marka / Model:</span> {sonuc.marka} {sonuc.model}</div>
          <div><span style={{ color: 'var(--metin-ikincil)' }}>Durum:</span> {sonuc.durum}</div>
          <div><span style={{ color: 'var(--metin-ikincil)' }}>Toplam maliyet:</span> {paraFormat(sonuc.toplam_maliyet_try)}</div>
          <div><span style={{ color: 'var(--metin-ikincil)' }}>Satış fiyatı:</span> {sonuc.satis_fiyati_try != null ? paraFormat(sonuc.satis_fiyati_try) : '—'}</div>
          <div>
            <span style={{ color: 'var(--metin-ikincil)' }}>Kâr/Zarar:</span>{' '}
            <strong style={{ color: sonuc.kar_zarar_try >= 0 ? 'var(--yesil)' : 'var(--kirmizi)' }}>
              {sonuc.kar_zarar_try != null ? paraFormat(sonuc.kar_zarar_try) : '—'}
            </strong>
          </div>
          <div><span style={{ color: 'var(--metin-ikincil)' }}>Bakım geliri / gideri:</span> {paraFormat(sonuc.bakim_geliri_toplam)} / {paraFormat(sonuc.bakim_gideri_toplam)}</div>
        </div>
      )}
    </Kart>
  );
}

// ============================================================== CARİ RAPORU
function CariRaporu() {
  const [cariler, setCariler] = useState([]);
  const [cariId, setCariId] = useState('');
  const [baslangic, setBaslangic] = useState('');
  const [bitis, setBitis] = useState('');
  const [sonuc, setSonuc] = useState(null);
  const [hata, setHata] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(false);

  useEffect(() => {
    api.get('/cariler').then((r) => setCariler(r.data)).catch(() => {});
  }, []);

  async function sorgula() {
    if (!cariId) return;
    setYukleniyor(true);
    setHata(null);
    setSonuc(null);
    try {
      const params = { cari_id: cariId };
      if (baslangic) params.baslangic = baslangic;
      if (bitis) params.bitis = bitis;
      const { data } = await api.get('/raporlar/cari', { params });
      setSonuc(data);
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setYukleniyor(false);
    }
  }

  const toplam = sonuc ? sonuc.reduce((t, s) => t + Number(s.tutar), 0) : 0;

  return (
    <Kart>
      <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 16 }}>Müşteriye / cariye göre rapor</div>
      <HataMesaji>{hata}</HataMesaji>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 220 }}>
          <Alan etiket="Cari">
            <select value={cariId} onChange={(e) => setCariId(e.target.value)} style={girdiStili}>
              <option value="">Seçin...</option>
              {cariler.map((c) => <option key={c.id} value={c.id}>{c.unvan}</option>)}
            </select>
          </Alan>
        </div>
        <div>
          <Alan etiket="Başlangıç tarihi">
            <input type="date" value={baslangic} onChange={(e) => setBaslangic(e.target.value)} style={girdiStili} />
          </Alan>
        </div>
        <div>
          <Alan etiket="Bitiş tarihi">
            <input type="date" value={bitis} onChange={(e) => setBitis(e.target.value)} style={girdiStili} />
          </Alan>
        </div>
        <Buton onClick={sorgula} disabled={yukleniyor || !cariId} style={{ marginBottom: 14 }}>
          {yukleniyor ? 'Sorgulanıyor...' : 'Sorgula'}
        </Buton>
      </div>

      {sonuc && (
        sonuc.length === 0 ? (
          <BosDurum baslik="Bu cari için kayıt bulunamadı" />
        ) : (
          <>
            <div style={{ fontSize: 13, color: 'var(--metin-ikincil)', marginBottom: 10 }}>
              {sonuc.length} kayıt · Net: <strong style={{ color: toplam >= 0 ? 'var(--yesil)' : 'var(--kirmizi)' }}>{paraFormat(toplam)}</strong>
            </div>
            <table>
              <thead>
                <tr style={{ background: 'var(--zemin)' }}>
                  {['Tarih', 'Yön', 'Açıklama', 'Tutar'].map((b) => (
                    <th key={b} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--metin-ikincil)' }}>{b}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sonuc.map((s, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                    <td style={{ padding: '8px 12px' }}>{s.tarih}</td>
                    <td style={{ padding: '8px 12px' }}>{s.tur === 'GIRIS' ? 'Giriş' : 'Çıkış'}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--metin-ikincil)' }}>{s.aciklama || '—'}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 500, color: Number(s.tutar) >= 0 ? 'var(--yesil)' : 'var(--kirmizi)' }}>
                      {paraFormat(s.tutar)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )
      )}
    </Kart>
  );
}

export default function RaporlarSayfasi() {
  return (
    <div>
      <SayfaBasligi baslik="Raporlar" aciklama="Genel bakış, yaklaşan vadeler, envanter, hareket türü, ürün ve cari bazlı raporlar" />
      <GenelBakisKarti />
      <KarMarjiKarti />
      <HarcamaTurleriOzetiKarti />
      <YaklasanVadelerKarti />
      <AnaKasaOzetKarti />
      <DepoEnvanteriKarti />
      <AktifKiralamalarKarti />
      <HareketTuruRaporu />
      <SeriNoRaporu />
      <CariRaporu />
    </div>
  );
}
