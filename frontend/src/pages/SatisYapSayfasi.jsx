import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api, hataMesajiCikar, ozelOnayIste } from '../api/client';
import { Kart, SayfaBasligi, Buton, Alan, girdiStili, HataMesaji, paraFormat, Sekmeler, eylemChipStili, Etiket } from '../components/Ortak';
import AramaliSecici from '../components/AramaliSecici';

const ODEME_TIPLERI = [
  { deger: 'PESIN_NAKIT', etiket: 'Nakit' },
  { deger: 'PESIN_HAVALE', etiket: 'Havale/EFT' },
  { deger: 'PESIN_KART', etiket: 'Kredi Kartı' },
  { deger: 'TAKSITLI', etiket: 'Taksitli' },
  { deger: 'LEASINGLI', etiket: 'Leasing' },
  { deger: 'CEK', etiket: 'Çek' },
];

const ODEME_TIPI_ACIKLAMA = {
  PESIN_NAKIT: 'Tutar elden alınır, Ana Kasa\'ya işlenir.',
  PESIN_HAVALE: 'Tutar seçtiğiniz banka hesabına yatar.',
  PESIN_KART: 'Tutar POS\'unuzun bağlı olduğu banka hesabına yatar.',
  TAKSITLI: 'Müşteri, belirlediğiniz sayıda taksitle öder.',
  LEASINGLI: 'Leasing şirketi peşin mi ödedi, yoksa taksitleri biz mi takip edeceğiz — aşağıdan seçin.',
  CEK: 'Müşteriden çek alınır, vadesinde tahsil edilir.',
};

function MusteriOzetiPaneli({ musteriCariId }) {
  const [ozet, setOzet] = useState(null);
  const [hata, setHata] = useState(null);

  useEffect(() => {
    if (!musteriCariId) { setOzet(null); return; }
    api.get(`/cariler/${musteriCariId}/musteri-ozeti`).then((r) => setOzet(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }, [musteriCariId]);

  if (!musteriCariId) return null;

  return (
    <Kart style={{ marginBottom: 16, background: 'var(--zemin)' }}>
      <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>
        {ozet ? ozet.unvan : ''} — Geçmiş İş Özeti
      </div>
      <HataMesaji>{hata}</HataMesaji>
      {!ozet ? (
        <div style={{ fontSize: 12.5, color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
      ) : ozet.toplam_satis_sayisi === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--metin-soluk)' }}>Bu müşteriye daha önce satış yapılmamış.</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 24, marginBottom: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--metin-ikincil)' }}>Toplam Satış</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{ozet.toplam_satis_sayisi}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--metin-ikincil)' }}>Toplam Satış Tutarı</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{paraFormat(ozet.toplam_satis_tutari_try)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--metin-ikincil)' }}>Güncel Alacağımız</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: Number(ozet.guncel_alacak_try) > 0 ? 'var(--kirmizi)' : 'var(--yesil)' }}>
                {paraFormat(ozet.guncel_alacak_try)}
              </div>
            </div>
          </div>
          {ozet.son_satislar.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--metin-ikincil)' }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Son satışlar:</div>
              {ozet.son_satislar.map((s) => (
                <div key={s.seri_no} style={{ marginBottom: 2 }}>
                  <Etiket ton="notr">{s.tarih}</Etiket> {s.urun_adi} ({s.seri_no}) — {paraFormat(s.tutar_try)}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Kart>
  );
}

export default function SatisYapSayfasi() {
  const [searchParams] = useSearchParams();
  const onSeciliUrunId = searchParams.get('urun');

  const [urunler, setUrunler] = useState([]);
  const [stokKartlari, setStokKartlari] = useState([]);
  const [cariler, setCariler] = useState([]);
  const [bankaHesaplari, setBankaHesaplari] = useState([]);
  const [urunId, setUrunId] = useState(onSeciliUrunId || '');
  const [musteriCariId, setMusteriCariId] = useState('');
  const [odemeTipi, setOdemeTipi] = useState('PESIN_NAKIT');
  const [leasingAltTip, setLeasingAltTip] = useState('PESIN'); // 'PESIN' | 'TAKSITLI' - sadece odemeTipi === 'LEASINGLI' iken kullanilir
  const [tutar, setTutar] = useState('');
  const [tarih, setTarih] = useState(new Date().toISOString().slice(0, 10));
  const [bankaHesapId, setBankaHesapId] = useState('');
  const [taksitSayisi, setTaksitSayisi] = useState(3);
  const [pesinat, setPesinat] = useState('0');
  const [tutarParaBirimi, setTutarParaBirimi] = useState('TRY');
  const [tutarKur, setTutarKur] = useState('1');
  const [cekNo, setCekNo] = useState('');
  const [cekBankaAdi, setCekBankaAdi] = useState('');
  const [cekVadeTarihi, setCekVadeTarihi] = useState('');
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [tamamlandi, setTamamlandi] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/stok-seri-no', { params: { durum: 'DEPODA' } }),
      api.get('/stok-seri-no', { params: { durum: 'ANTREPODA' } }),
    ]).then(([depoRes, antrepoRes]) => {
      setUrunler([...depoRes.data, ...antrepoRes.data]);
    }).catch((e) => setHata(hataMesajiCikar(e)));
    api.get('/stok-kartlari').then((r) => setStokKartlari(r.data)).catch(() => {});
    api.get('/cariler').then((r) => setCariler(r.data)).catch(() => {});
    api.get('/banka-bakiyeleri').then((r) => setBankaHesaplari(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (tutarParaBirimi !== 'TRY') {
      api.get(`/kur/${tutarParaBirimi}`).then((r) => setTutarKur(String(r.data.kur))).catch(() => {});
    }
  }, [tutarParaBirimi]);

  function urunEtiketi(u) {
    const kart = stokKartlari.find((k) => k.id === u.stok_karti_id);
    const ad = kart ? `${kart.marka} ${kart.model}` : null;
    return `${u.seri_no}${ad ? ' — ' + ad : ''} — Maliyet: ${paraFormat(u.toplam_maliyet_try)}`;
  }

  const seciliUrun = urunler.find((u) => String(u.id) === String(urunId));
  const tutarTRY = tutarParaBirimi === 'TRY' ? Number(tutar || 0) : Number(tutar || 0) * Number(tutarKur || 1);
  const leasingTaksitli = odemeTipi === 'LEASINGLI' && leasingAltTip === 'TAKSITLI';
  const taksitliBenzeri = odemeTipi === 'TAKSITLI' || leasingTaksitli;
  const bankaGerekli = odemeTipi === 'PESIN_HAVALE' || odemeTipi === 'PESIN_KART' || (odemeTipi === 'LEASINGLI' && leasingAltTip === 'PESIN');

  async function satisiTamamla(e) {
    e.preventDefault();
    setHata(null);

    if (!urunId) { setHata('Lütfen satılacak ürünü seçin.'); return; }
    if (!musteriCariId) { setHata('Lütfen müşteriyi seçin.'); return; }
    if (!tutar || Number(tutar) <= 0) { setHata('Lütfen geçerli bir tutar girin.'); return; }

    // BANKA ile odemede, hesabin BAKIYESININ NE OLACAGINI ONCEDEN GOSTERIP
    // ONAY ISTIYORUZ - "25.000 USD'lik satisi 47,54 kurla islerken TL
    // tutari yanlislikla USD sanildi" gibi hatalar, islem TAMAMLANMADAN
    // ONCE gozle fark edilebilsin diye (sonradan avlamak yerine).
    if (bankaGerekli && bankaHesapId) {
      const secilenHesap = bankaHesaplari.find((h) => String(h.banka_hesap_id) === String(bankaHesapId));
      if (secilenHesap) {
        const eskiBakiye = Number(secilenHesap.bakiye || 0);
        const hesapPB = secilenHesap.para_birimi;
        const islenecekTutar = hesapPB === tutarParaBirimi ? Number(tutar) : tutarTRY;
        const yeniBakiye = eskiBakiye + islenecekTutar;
        const oranAsiriMi = eskiBakiye !== 0 && Math.abs(yeniBakiye / eskiBakiye) > 5;
        const uyariBasligi = oranAsiriMi
          ? `⚠️ DİKKAT: Bu işlem bakiyeyi ${Math.abs(yeniBakiye / eskiBakiye).toFixed(1)} KAT değiştiriyor — bir hata olabilir!\n\n`
          : '';
        const onayMetni = `${uyariBasligi}${secilenHesap.banka_adi} (${hesapPB}) hesabı:\n${paraFormat(eskiBakiye, hesapPB)} → ${paraFormat(yeniBakiye, hesapPB)}\n\nOnaylıyor musunuz?`;
        if (!(await ozelOnayIste(onayMetni))) return;
      }
    }

    setKaydediliyor(true);
    try {
      if (odemeTipi === 'PESIN_NAKIT') {
        await api.post(`/stok-seri-no/${urunId}/satis`, {
          musteri_cari_id: Number(musteriCariId), satis_fiyati_try: tutarTRY,
          satis_tarihi: tarih, odeme_yontemi: 'NAKIT', banka_hesap_id: null,
        });
      } else if (bankaGerekli) {
        if (!bankaHesapId) { setHata('Lütfen paranın yatacağı banka hesabını seçin.'); setKaydediliyor(false); return; }
        // ONEMLI: Banka hesabina GERCEK ISLEM para biriminde/tutarinda
        // yazmasi icin, kullanicinin GIRDIGI ORIJINAL tutar+para birimini
        // (islem_tutari/islem_para_birimi) de gonderiyoruz - sadece
        // satis_fiyati_try (TL karsiligi) gondermek, hesap dovizliyse bu
        // TL rakaminin dogrudan doviz sanilip yazilmasina yol aciyordu.
        await api.post(`/stok-seri-no/${urunId}/satis`, {
          musteri_cari_id: Number(musteriCariId), satis_fiyati_try: tutarTRY,
          satis_tarihi: tarih, odeme_yontemi: 'BANKA', banka_hesap_id: Number(bankaHesapId),
          islem_para_birimi: tutarParaBirimi, islem_tutari: Number(tutar), kur: Number(tutarKur || 1),
        });
      } else if (taksitliBenzeri) {
        if (!seciliUrun) { setHata('Lütfen bir ürün seçin.'); setKaydediliyor(false); return; }
        await api.post('/taksitli-satis-planlari', {
          musteri_cari_id: Number(musteriCariId), pesinat: Number(pesinat || 0),
          taksit_sayisi: Number(taksitSayisi), baslangic_tarihi: tarih, para_birimi: 'TRY',
          kalemler: [{ stok_karti_id: seciliUrun.stok_karti_id, miktar: 1, birim_fiyat: tutarTRY }],
        });
        await api.put(`/stok-seri-no/${urunId}/durum`, {
          durum: 'SATILDI', musteri_cari_id: Number(musteriCariId),
          satis_fiyati_try: tutarTRY, satis_tarihi: tarih,
        });
      } else if (odemeTipi === 'CEK') {
        if (!cekVadeTarihi) { setHata('Lütfen çekin vade tarihini girin.'); setKaydediliyor(false); return; }
        // Once cek olusturulur (ID'sini almak icin), sonra urun SATILDI yapilip
        // cek ID'si urune baglanir - boylece cek silinirse/geri alinirsa urun
        // otomatik olarak Depoda'ya donebilir.
        const { data: yeniCek } = await api.post('/cekler', {
          tip: 'ALINAN', cek_no: cekNo || null, banka_adi: cekBankaAdi || null,
          cari_id: Number(musteriCariId), tutar: Number(tutar), para_birimi: tutarParaBirimi,
          vade_tarihi: cekVadeTarihi, alinma_verilme_tarihi: tarih,
        });
        await api.put(`/stok-seri-no/${urunId}/durum`, {
          durum: 'SATILDI', musteri_cari_id: Number(musteriCariId),
          satis_fiyati_try: tutarTRY, satis_tarihi: tarih,
        });
        await api.put(`/stok-seri-no/${urunId}/satis-cek-baglantisi`, { cek_id: yeniCek.id });
      }
      setTamamlandi(true);
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  if (tamamlandi) {
    return (
      <div>
        <SayfaBasligi baslik="Satış Yap" />
        <Kart style={{ background: 'var(--yesil-acik)' }}>
          <div style={{ color: 'var(--yesil)', fontWeight: 600, fontSize: 15, marginBottom: 8 }}>Satış tamamlandı</div>
          <div style={{ fontSize: 13.5, color: 'var(--metin-ikincil)', marginBottom: 16 }}>
            Ürün "Satıldı" olarak işaretlendi ve ilgili kayıt oluşturuldu.
            {odemeTipi === 'PESIN_NAKIT' && ' Yanlışlıkla yapıldıysa Stok sayfasından "Satışı Geri Al" ile düzeltebilirsiniz.'}
            {bankaGerekli && ' Yanlışlıkla yapıldıysa Stok sayfasından "Satışı Geri Al" ile düzeltebilirsiniz.'}
            {taksitliBenzeri && ' Yanlışlıkla yapıldıysa Finansal Takip → Taksitli Satış\'tan planı silerek ürünü geri alabilirsiniz.'}
            {odemeTipi === 'CEK' && ' Yanlışlıkla yapıldıysa Stok sayfasından "Satışı Geri Al" ile hem çek hem ürün geri alınır (çek henüz ciro/tahsil edilmediyse).'}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Buton onClick={() => window.location.reload()}>Yeni satış yap</Buton>
            <Link to="/stok"><Buton variant="ikincil">Stok sayfasına dön</Buton></Link>
          </div>
        </Kart>
      </div>
    );
  }

  return (
    <div>
      <SayfaBasligi baslik="Satış Yap" aciklama="Satış otomatik olarak Kasa/Banka/Çek/Taksit kayıtlarına işlenir" />
      <HataMesaji>{hata}</HataMesaji>

      <MusteriOzetiPaneli musteriCariId={musteriCariId} />

      <Kart>
        <form onSubmit={satisiTamamla}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Alan etiket="Ürün">
              <AramaliSecici
                secenekler={urunler}
                deger={urunId}
                onDegistir={setUrunId}
                etiketFn={urunEtiketi}
                bosMetin="Seri no veya ürün adı yazarak arayın..."
              />
              {urunler.length === 0 && (
                <div style={{ fontSize: 12.5, color: 'var(--metin-soluk)', marginTop: 4 }}>
                  Depoda veya Antrepoda ürün yok. Stok sayfasından bir ürünün durumunu güncelleyin.
                </div>
              )}
            </Alan>
            <Alan etiket="Müşteri">
              <AramaliSecici
                secenekler={cariler}
                deger={musteriCariId}
                onDegistir={setMusteriCariId}
                etiketFn={(c) => c.unvan}
                bosMetin="Müşteri adı yazarak arayın..."
              />
            </Alan>
          </div>

          <div style={{ marginTop: 16, marginBottom: 4 }}>
            <span style={{ display: 'block', fontSize: 12.5, color: 'var(--metin-ikincil)', marginBottom: 6 }}>Ödeme Türü</span>
            <Sekmeler sekmeler={ODEME_TIPLERI} aktif={odemeTipi} onDegistir={setOdemeTipi} />
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--metin-soluk)', marginTop: -12, marginBottom: 14 }}>
            {ODEME_TIPI_ACIKLAMA[odemeTipi]}
          </div>

          {odemeTipi === 'LEASINGLI' && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setLeasingAltTip('PESIN')}
                  style={eylemChipStili(leasingAltTip === 'PESIN' ? 'lacivert' : 'notr')}>
                  Peşin (banka - leasing firması tek seferde ödedi)
                </button>
                <button type="button" onClick={() => setLeasingAltTip('TAKSITLI')}
                  style={eylemChipStili(leasingAltTip === 'TAKSITLI' ? 'lacivert' : 'notr')}>
                  Taksitli (biz taksitleri takip edeceğiz)
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <Alan etiket={taksitliBenzeri ? 'Toplam Tutar' : 'Tutar'}>
              <div style={{ display: 'flex', gap: 6 }}>
                <input required type="number" step="0.01" value={tutar} onChange={(e) => setTutar(e.target.value)} style={{ ...girdiStili, flex: 1 }} />
                <select value={tutarParaBirimi} onChange={(e) => setTutarParaBirimi(e.target.value)} style={{ ...girdiStili, width: 80 }}>
                  <option value="TRY">TL</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              {tutarParaBirimi !== 'TRY' && tutar && (
                <div style={{ fontSize: 12, color: 'var(--metin-soluk)', marginTop: 4 }}>≈ {paraFormat(tutarTRY)}</div>
              )}
            </Alan>
            {tutarParaBirimi !== 'TRY' && (
              <Alan etiket={`Kur (${tutarParaBirimi} → TL) — otomatik, değiştirilebilir`}>
                <input type="number" step="0.0001" value={tutarKur} onChange={(e) => setTutarKur(e.target.value)} style={girdiStili} />
              </Alan>
            )}
            <Alan etiket="Tarih">
              <input required type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} style={girdiStili} />
            </Alan>

            {bankaGerekli && (
              <Alan etiket="Banka Hesabı">
                <select required value={bankaHesapId} onChange={(e) => setBankaHesapId(e.target.value)} style={girdiStili}>
                  <option value="">Seçin...</option>
                  {bankaHesaplari.map((h) => (
                    <option key={h.banka_hesap_id} value={h.banka_hesap_id}>{h.banka_adi} — {h.hesap_adi || h.para_birimi}</option>
                  ))}
                </select>
                {bankaHesapId && (() => {
                  const secilenHesap = bankaHesaplari.find((h) => String(h.banka_hesap_id) === String(bankaHesapId));
                  if (secilenHesap && secilenHesap.para_birimi !== tutarParaBirimi) {
                    return (
                      <div style={{ fontSize: 12, color: 'var(--amber)', marginTop: 4 }}>
                        ⚠ Bu hesap {secilenHesap.para_birimi} cinsinden, sen {tutarParaBirimi} girdin — sisteme doğru kurla dönüştürülerek yazılacak.
                      </div>
                    );
                  }
                  return null;
                })()}
              </Alan>
            )}

            {taksitliBenzeri && (
              <>
                <Alan etiket="Peşinat (TL)">
                  <input type="number" step="0.01" value={pesinat} onChange={(e) => setPesinat(e.target.value)} style={girdiStili} />
                </Alan>
                <Alan etiket="Taksit Sayısı">
                  <input required type="number" min="2" value={taksitSayisi} onChange={(e) => setTaksitSayisi(e.target.value)} style={girdiStili} />
                </Alan>
              </>
            )}

            {odemeTipi === 'CEK' && (
              <>
                <Alan etiket="Çek No">
                  <input value={cekNo} onChange={(e) => setCekNo(e.target.value)} style={girdiStili} />
                </Alan>
                <Alan etiket="Çekin Bankası">
                  <input value={cekBankaAdi} onChange={(e) => setCekBankaAdi(e.target.value)} style={girdiStili} />
                </Alan>
                <Alan etiket="Vade Tarihi">
                  <input required type="date" value={cekVadeTarihi} onChange={(e) => setCekVadeTarihi(e.target.value)} style={girdiStili} />
                </Alan>
              </>
            )}
          </div>

          {seciliUrun && tutar && (
            <div style={{
              marginTop: 4, marginBottom: 16, padding: 10, borderRadius: 7, background: 'var(--zemin)', fontSize: 13,
              color: tutarTRY - seciliUrun.toplam_maliyet_try >= 0 ? 'var(--yesil)' : 'var(--kirmizi)',
            }}>
              Tahmini kâr/zarar: {paraFormat(tutarTRY - seciliUrun.toplam_maliyet_try)}
              <span style={{ color: 'var(--metin-soluk)' }}> (maliyet: {paraFormat(seciliUrun.toplam_maliyet_try)})</span>
            </div>
          )}

          <Buton type="submit" disabled={kaydediliyor}>
            {kaydediliyor ? 'Kaydediliyor...' : 'Satışı Tamamla'}
          </Buton>
        </form>
      </Kart>
    </div>
  );
}
