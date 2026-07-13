import * as XLSX from 'xlsx';

// Bir veri dizisini (nesne listesi) .xlsx dosyasi olarak indirir.
// veriler: [{ 'Sütun Adı': değer, ... }, ...] - anahtarlar sutun basligi olur.
export function excelIndir(veriler, dosyaAdi = 'liste', sayfaAdi = 'Sayfa1') {
  const sayfa = XLSX.utils.json_to_sheet(veriler);
  const kitap = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(kitap, sayfa, sayfaAdi);
  XLSX.writeFile(kitap, `${dosyaAdi}.xlsx`);
}

// Verilen elementId'ye sahip DOM alanini yazdirir (digerlerini gizleyerek).
// Sayfada .no-print sinifi tasiyan elemanlar otomatik gizlenir (CSS ile).
export function alaniYazdir() {
  window.print();
}
