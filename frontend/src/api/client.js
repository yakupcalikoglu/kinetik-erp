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
