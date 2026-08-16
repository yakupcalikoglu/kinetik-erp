import axios from 'axios';
// Backend adresi - gelistirme ortaminda .env dosyasindan, yoksa varsayilan localhost:8000
const API_TABAN_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
export const api = axios.create({
  baseURL: API_TABAN_URL,
});
// Modul seviyesinde tutulan, senkron erisilebilir oturum bilgisi.
// React effect'lerinin calisma sirasi (cocuk -> ebeveyn) yuzunden, bir
// sayfa component'i mount olur olmaz veri cekmeye baslayabilir; eger
// header'lar bir useEffect icinde set edilseydi, bu istek header'lar
// henuz yazilmadan gidebilirdi (race condition). Interceptor kullanarak
// her istekte BU degiskenden senkron okuruz, boylece sira sorunu olmaz.
let _aktifOturum = { token: null, sirketId: null };
export function apiYapilandir({ token, sirketId }) {
  _aktifOturum = { token, sirketId };
}
api.interceptors.request.use((config) => {
  if (_aktifOturum.token) {
    config.headers['Authorization'] = `Bearer ${_aktifOturum.token}`;
  }
  if (_aktifOturum.sirketId != null) {
    config.headers['X-Sirket-Id'] = String(_aktifOturum.sirketId);
  }
  return config;
});

// ---------------------------------------------------------------- Basari Bildirimi (Toast)
// client.js bir React bileseni degil, bu yuzden basit bir "yayinci/dinleyici"
// (pub-sub) deseniyle basarili islemleri React tarafina (Toast bileseni)
// bildiriyoruz. Sadece veri DEGISTIREN (POST/PUT/DELETE) istekler icin -
// GET (sadece okuma) istekleri kullaniciyi ilgilendirmez, bildirim gostermez.
const _basariDinleyicileri = new Set();
export function basariBildirimDinle(fn) {
  _basariDinleyicileri.add(fn);
  return () => _basariDinleyicileri.delete(fn);
}
function _basariBildir() {
  _basariDinleyicileri.forEach((fn) => fn());
}

api.interceptors.response.use((response) => {
  const yontem = response.config?.method?.toLowerCase();
  if (yontem === 'post' || yontem === 'put' || yontem === 'delete') {
    _basariBildir();
  }
  return response;
});

// ---------------------------------------------------------------- Geri Al Bildirimi (Toast)
// Bir kayit "yumusak silindiginde" (soft-delete), birkac saniye boyunca
// "Geri Al" secenegi sunan bir toast gostermek icin - ozelOnayIste ile
// AYNI pub-sub deseni, ama PROMISE BEKLEMEZ: silme islemi zaten backend'de
// TAMAMLANMIS durumda, "geri al" sadece opsiyonel bir kolayliktir. Sayfalar
// bunu, sil() fonksiyonlarinin SONUNDA cagirir:
//   await api.delete(`/cariler/${id}`);
//   geriAlBildirimGoster(`"${unvan}" silindi.`, async () => {
//     await api.put(`/cariler/${id}/geri-getir`); yukle();
//   });
const _geriAlDinleyicileri = new Set();
export function geriAlBildirimDinle(fn) {
  _geriAlDinleyicileri.add(fn);
  return () => _geriAlDinleyicileri.delete(fn);
}
export function geriAlBildirimGoster(mesaj, geriAlFn) {
  _geriAlDinleyicileri.forEach((fn) => fn({ mesaj, geriAlFn }));
}

// ---------------------------------------------------------------- Genel Yukleniyor Cubugu
// Sayfanin en ustunde ince bir "yukleniyor" cubugu gostermek icin, o an
// devam eden istek sayisini takip ediyoruz. Sayac > 0 iken cubuk gorunur.
let _aktifIstekSayisi = 0;
const _yuklemeDinleyicileri = new Set();
export function yuklemeDurumuDinle(fn) {
  _yuklemeDinleyicileri.add(fn);
  return () => _yuklemeDinleyicileri.delete(fn);
}
function _yuklemeDurumuBildir() {
  _yuklemeDinleyicileri.forEach((fn) => fn(_aktifIstekSayisi > 0));
}

api.interceptors.request.use((config) => {
  _aktifIstekSayisi += 1;
  _yuklemeDurumuBildir();
  return config;
});

function _istekBitti() {
  _aktifIstekSayisi = Math.max(0, _aktifIstekSayisi - 1);
  _yuklemeDurumuBildir();
}
api.interceptors.response.use(
  (response) => { _istekBitti(); return response; },
  (error) => { _istekBitti(); return Promise.reject(error); },
);

// ---------------------------------------------------------------- Ozel Onay Penceresi
// window.confirm() tarayicinin CIRKIN, sade native penceresini gosterir ve
// uygulamanin tasarimina uymaz. Bunun yerine, Promise tabanli bir sistem
// kurup React tarafinda (AnaDuzen.jsx) GUZEL bir onay penceresi gosteriyoruz.
// Kullanimi window.confirm ile AYNI ama ASENKRON:
//   if (!(await ozelOnayIste('Emin misiniz?'))) return;
let _onayCozucu = null;
const _onayIstegiDinleyicileri = new Set();
export function onayIstegiDinle(fn) {
  _onayIstegiDinleyicileri.add(fn);
  return () => _onayIstegiDinleyicileri.delete(fn);
}
export function ozelOnayIste(mesaj) {
  return new Promise((resolve) => {
    _onayCozucu = resolve;
    _onayIstegiDinleyicileri.forEach((fn) => fn(mesaj));
  });
}
export function _onayYaniti(sonuc) {
  if (_onayCozucu) {
    _onayCozucu(sonuc);
    _onayCozucu = null;
  }
}

// ---------------------------------------------------------------- Ozel Bilgi (Alert) Penceresi
// window.alert() yerine - kullanimi ayni ama ASENKRON: await ozelAlert('Kaydedildi.');
let _alertCozucu = null;
const _alertIstegiDinleyicileri = new Set();
export function alertIstegiDinle(fn) {
  _alertIstegiDinleyicileri.add(fn);
  return () => _alertIstegiDinleyicileri.delete(fn);
}
export function ozelAlert(mesaj) {
  return new Promise((resolve) => {
    _alertCozucu = resolve;
    _alertIstegiDinleyicileri.forEach((fn) => fn(mesaj));
  });
}
export function _alertYaniti() {
  if (_alertCozucu) {
    _alertCozucu();
    _alertCozucu = null;
  }
}

// ---------------------------------------------------------------- Ozel Metin Girisi (Prompt) Penceresi
// window.prompt() yerine - kullanimi ayni ama ASENKRON:
//   const deger = await ozelPrompt('Yeni sifre:'); if (!deger) return;
let _promptCozucu = null;
const _promptIstegiDinleyicileri = new Set();
export function promptIstegiDinle(fn) {
  _promptIstegiDinleyicileri.add(fn);
  return () => _promptIstegiDinleyicileri.delete(fn);
}
export function ozelPrompt(mesaj, varsayilanDeger = '') {
  return new Promise((resolve) => {
    _promptCozucu = resolve;
    _promptIstegiDinleyicileri.forEach((fn) => fn({ mesaj, varsayilanDeger }));
  });
}
export function _promptYaniti(deger) {
  if (_promptCozucu) {
    _promptCozucu(deger);
    _promptCozucu = null;
  }
}

// 401/403 durumunda kullanicinin anlamasini saglayacak ortak hata mesaji cikarici.
// Backend FastAPI hata formati genelde { "detail": "..." } seklindedir, ama
// pydantic validasyon hatalarinda detail bir DIZI/OBJE olabilir
// (orn. [{ "type": "...", "loc": [...], "msg": "..." }]). Bu durumda
// objeyi dogrudan React'e vermek "Objects are not valid as a React child"
// hatasiyla cokmeye yol acar - bu yuzden her zaman string'e ceviriyoruz.
//
// Pydantic validasyon hatalarinda "loc" alani, HANGI alanin sorunlu
// oldugunu gosterir (orn. ["body", "kalemler", 0, "birim_fiyat"]) - bunu
// mesaja EKLIYORUZ ki kullanici (ve biz) hatanin tam olarak nerede
// oldugunu ekrandan okuyabilsin, konsol/network sekmesine bakmaya gerek
// kalmasin.
function _pydanticHatasiniBicimlendir(d) {
  const mesaj = d.msg || 'Geçersiz değer';
  if (Array.isArray(d.loc) && d.loc.length > 0) {
    // ilk eleman genelde "body" - kullanici icin anlamli degil, atla
    const yol = d.loc.filter((p) => p !== 'body').join(' → ');
    return yol ? `${yol}: ${mesaj}` : mesaj;
  }
  return mesaj;
}
export function hataMesajiCikar(error) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => (d && typeof d === 'object' ? _pydanticHatasiniBicimlendir(d) : JSON.stringify(d))).join(' · ');
  }
  if (detail && typeof detail === 'object') {
    return _pydanticHatasiniBicimlendir(detail);
  }
  if (error?.message === 'Network Error') {
    return 'Sunucuya bağlanılamadı. Backend çalışıyor mu kontrol edin.';
  }
  return 'Bilinmeyen bir hata oluştu.';
}
