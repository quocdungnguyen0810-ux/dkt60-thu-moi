/**
 * Google Apps Script – nhận đăng ký từ web và ghi vào Google Sheet.
 * Cách dùng:
 *  1. Tạo Google Sheet mới > Tiện ích mở rộng > Apps Script > dán mã này.
 *  2. Triển khai > Ứng dụng web > Thực thi với tư cách: Tôi; Quyền truy cập: Bất kỳ ai.
 *  3. Chép URL vào CONFIG.endpoint trong config.js.
 */
const HEADERS = ["maDangKy","thoiGian","hoTen","chucDanh","donVi","nhom","sdt","email",
                 "thamDu","nguoiDiCung","anUong","noiDung","thamLuan","loiChuc"];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse(e.postData.contents);
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    if (sh.getLastRow() === 0) sh.appendRow(HEADERS);
    // Chống chèn công thức (formula injection)
    const row = HEADERS.map(k => {
      let v = String(d[k] ?? "").slice(0, 500);
      return /^[=+\-@]/.test(v) ? "'" + v : v;
    });
    sh.appendRow(row);
    return ContentService.createTextOutput("OK");
  } finally { lock.releaseLock(); }
}

