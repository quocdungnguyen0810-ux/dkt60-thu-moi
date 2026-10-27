/**
 * Google Apps Script – Đăng ký + Check-in sự kiện 60 năm Địa kỹ thuật.
 *
 * CHỨC NĂNG
 *  - doPost : nhận đăng ký từ trang web, ghi vào Sheet (chống trùng mã).
 *  - doGet  : API cho trang check-in (cần PIN nhân viên):
 *      action=lookup  &code=DKT60-XXXXXX      -> tra thông tin 1 đại biểu
 *      action=search  &q=tên/SĐT/mã           -> tìm tối đa 10 người (khi mất vé)
 *      action=checkin &code=...&soNguoi=..    -> cập nhật thông tin + TICK cột checkIn
 *      action=stats                            -> thống kê
 *
 * CÀI ĐẶT (làm 1 lần)
 *  1. Sheet NÊN TRỐNG hoặc dùng tab mới (xóa dòng thử cũ và tiêu đề cũ nếu có).
 *  2. Dán toàn bộ mã này vào Apps Script, ĐỔI CHECKIN_PIN bên dưới.
 *  3. Triển khai > Quản lý bản triển khai > (biểu tượng bút) > Phiên bản: "Phiên bản mới" > Triển khai.
 *     (Giữ nguyên URL /exec cũ. Quyền: Thực thi với tư cách TÔI; Ai có quyền truy cập: Bất kỳ ai.)
 *  4. Chạy hàm kiemTra() một lần để cấp quyền và tạo tiêu đề cột.
 */

const CHECKIN_PIN = "DOI-MA-NAY";           // <-- ĐỔI thành mã bí mật (>= 6 ký tự), chỉ phát cho cán bộ đón tiếp
const TZ = "Asia/Ho_Chi_Minh";

const REG_HEADERS = ["maDangKy", "thoiGian", "hoTen", "chucDanh", "donVi", "nhom", "sdt", "email",
                     "thamDu", "nguoiDiCung", "anUong", "noiDung", "thamLuan", "loiChuc"];
const CK_HEADERS = ["checkIn", "thoiGianCheckIn", "soNguoiThucTe", "ghiChuCheckIn"];
const ALL_HEADERS = REG_HEADERS.concat(CK_HEADERS);
const CODE_RE = /^DKT60-[A-Z2-9]{6}$/;
// Các trường cán bộ được phép chỉnh khi check-in
const EDITABLE = ["hoTen", "chucDanh", "donVi", "sdt", "anUong"];

/* ---------- tiện ích ---------- */
function sh_() { return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0]; }

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function safe_(v, max) {                      // chống chèn công thức (formula injection) + giới hạn độ dài
  v = String(v == null ? "" : v).slice(0, max || 500);
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

/** Đảm bảo đủ cột; trả về {tenCot: chỉSố(1..n)}. */
function cols_(sh) {
  if (sh.getLastRow() === 0) sh.appendRow(ALL_HEADERS);
  let headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  ALL_HEADERS.forEach(function (h) {
    if (headers.indexOf(h) < 0) {
      sh.getRange(1, headers.length + 1).setValue(h);
      headers.push(h);
      if (h === "checkIn" && sh.getLastRow() > 1)
        sh.getRange(2, headers.length, sh.getLastRow() - 1, 1).insertCheckboxes();
    }
  });
  const map = {};
  headers.forEach(function (h, i) { map[h] = i + 1; });
  return map;
}

function rowObj_(sh, map, r) {
  const vals = sh.getRange(r, 1, 1, sh.getLastColumn()).getValues()[0];
  const o = {};
  Object.keys(map).forEach(function (k) {
    let v = vals[map[k] - 1];
    if (v instanceof Date) v = Utilities.formatDate(v, TZ, "yyyy-MM-dd HH:mm:ss");
    o[k] = v;
  });
  o.checkIn = o.checkIn === true || String(o.checkIn).toUpperCase() === "TRUE";
  return o;
}

function findRow_(sh, map, code) {
  const n = sh.getLastRow() - 1;
  if (n < 1) return -1;
  const v = sh.getRange(2, map.maDangKy, n, 1).getValues();
  for (let i = 0; i < n; i++) if (String(v[i][0]).trim().toUpperCase() === code) return i + 2;
  return -1;
}

function pub_(o) {                             // dữ liệu trả về cho trang check-in
  return {
    maDangKy: o.maDangKy, hoTen: o.hoTen, chucDanh: o.chucDanh, donVi: o.donVi, nhom: o.nhom,
    sdt: o.sdt, email: o.email, thamDu: o.thamDu, nguoiDiCung: Number(o.nguoiDiCung) || 0,
    anUong: o.anUong, noiDung: o.noiDung, thamLuan: o.thamLuan,
    checkIn: o.checkIn, thoiGianCheckIn: o.thoiGianCheckIn,
    soNguoiThucTe: o.soNguoiThucTe === "" ? null : Number(o.soNguoiThucTe), ghiChuCheckIn: o.ghiChuCheckIn
  };
}

/* ---------- Đăng ký từ trang web ---------- */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const d = JSON.parse(e.postData.contents);
    const code = String(d.maDangKy || "").toUpperCase();
    if (!CODE_RE.test(code) && code.indexOf("TEST") < 0) return json_({ success: false, message: "Mã đăng ký không hợp lệ" });
    const sh = sh_(), map = cols_(sh);
    if (findRow_(sh, map, code) > 0) return json_({ success: true, message: "Đã có (bỏ qua trùng)" });
    const row = new Array(sh.getLastColumn()).fill("");
    REG_HEADERS.forEach(function (k) { row[map[k] - 1] = safe_(d[k], k === "loiChuc" ? 500 : 200); });
    row[map.maDangKy - 1] = code;
    const r = sh.getLastRow() + 1;
    sh.getRange(r, 1, 1, row.length).setValues([row]);
    sh.getRange(r, map.checkIn).insertCheckboxes().setValue(false);
    return json_({ success: true, message: "Đã lưu dữ liệu thành công" });
  } catch (err) {
    return json_({ success: false, message: String(err) });
  } finally { lock.releaseLock(); }
}

/* ---------- API check-in ---------- */
function doGet(e) {
  const p = e.parameter || {};
  if (!p.action) return json_({ ok: true, message: "Dịch vụ đăng ký 60 năm ĐKT đang hoạt động." });
  if (CHECKIN_PIN === "DOI-MA-NAY" || String(p.pin || "") !== CHECKIN_PIN)
    return json_({ ok: false, error: "PIN" });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = sh_(), map = cols_(sh);
    const code = String(p.code || "").trim().toUpperCase();

    if (p.action === "stats") {
      const n = sh.getLastRow() - 1; let dk = 0, du = 0, ci = 0, tt = 0;
      for (let r = 2; r < n + 2; r++) {
        const o = rowObj_(sh, map, r);
        if (o.thamDu === "Có") { dk++; du += 1 + (Number(o.nguoiDiCung) || 0); }
        if (o.checkIn) { ci++; tt += Number(o.soNguoiThucTe) || 0; }
      }
      return json_({ ok: true, dangKyCoMat: dk, tongNguoiDuKien: du, daCheckIn: ci, tongNguoiThucTe: tt });
    }

    if (p.action === "lookup") {
      if (!CODE_RE.test(code)) return json_({ ok: false, error: "Mã không hợp lệ" });
      const r = findRow_(sh, map, code);
      if (r < 0) return json_({ ok: false, error: "Không tìm thấy mã " + code });
      return json_({ ok: true, rec: pub_(rowObj_(sh, map, r)) });
    }

    if (p.action === "search") {
      const q = String(p.q || "").trim().toLowerCase();
      if (q.length < 2) return json_({ ok: false, error: "Nhập ít nhất 2 ký tự" });
      const out = []; const n = sh.getLastRow() - 1;
      for (let r = 2; r < n + 2 && out.length < 10; r++) {
        const o = rowObj_(sh, map, r);
        if ([o.hoTen, o.sdt, o.maDangKy, o.donVi].join("|").toLowerCase().indexOf(q) >= 0) out.push(pub_(o));
      }
      return json_({ ok: true, list: out });
    }

    if (p.action === "checkin") {
      if (!CODE_RE.test(code)) return json_({ ok: false, error: "Mã không hợp lệ" });
      const r = findRow_(sh, map, code);
      if (r < 0) return json_({ ok: false, error: "Không tìm thấy mã " + code });
      const cur = rowObj_(sh, map, r);
      if (cur.checkIn && p.force !== "1")
        return json_({ ok: false, already: true, rec: pub_(cur) });
      const so = Number(p.soNguoi);
      if (!Number.isInteger(so) || so < 0 || so > 50) return json_({ ok: false, error: "Số người phải từ 0 đến 50" });
      EDITABLE.forEach(function (k) {
        if (p[k] !== undefined && String(p[k]) !== String(cur[k])) sh.getRange(r, map[k]).setValue(safe_(p[k], 200));
      });
      sh.getRange(r, map.soNguoiThucTe).setValue(so);
      sh.getRange(r, map.ghiChuCheckIn).setValue(safe_(p.ghiChu, 300));
      if (!cur.checkIn) sh.getRange(r, map.thoiGianCheckIn).setValue(Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd HH:mm:ss"));
      sh.getRange(r, map.checkIn).insertCheckboxes().setValue(true);   // TICK ô check-in
      return json_({ ok: true, rec: pub_(rowObj_(sh, map, r)) });
    }
    return json_({ ok: false, error: "Hành động không hợp lệ" });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally { lock.releaseLock(); }
}

/** Chạy tay 1 lần để cấp quyền và tạo cột. */
function kiemTra() {
  const sh = sh_(); const map = cols_(sh);
  Logger.log("Các cột: " + JSON.stringify(map));
  if (CHECKIN_PIN === "DOI-MA-NAY") Logger.log("CẢNH BÁO: chưa đổi CHECKIN_PIN – API check-in đang bị khóa.");
}
