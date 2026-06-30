import { useEffect, useState } from 'react';
import { api, hataMesajiCikar } from '../api/client';
import { Kart, SayfaBasligi, Buton, HataMesaji, BosDurum } from '../components/Ortak';

export default function YoneticiPaneliSayfasi() {
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
      <SayfaBasligi
        baslik="Yönetici paneli"
        aciklama="Rollere göre hangi ekranların görüntülenebileceğini belirleyin"
      />
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
