"use strict";
const C = window.CONFIG;
const $ = (s) => document.querySelector(s);
const STORE_KEY = "dkt60_registrations";

// ---- Đếm ngược ----
function tick() {
  const el = $("#countdown");
  const diff = new Date(C.eventDate) - new Date();
  if (diff <= 0) { el.textContent = "Chương trình đã diễn ra / đang diễn ra"; return; }
  const d = Math.floor(diff / 864e5), h = Math.floor(diff % 864e5 / 36e5),
        m = Math.floor(diff % 36e5 / 6e4), s = Math.floor(diff % 6e4 / 1e3);
  el.innerHTML = [[d, "Ngày"], [h, "Giờ"], [m, "Phút"], [s, "Giây"]]
    .map(([v, l]) => `<div><b>${v}</b>${l}</div>`).join("");
}
tick(); setInterval(tick, 1000);
$("#deadline").textContent = C.deadlineText;

// ---- Sao chép STK ----
$("#copyStk").addEventListener("click", async (e) => {
  try { await navigator.clipboard.writeText("862804"); e.target.textContent = "Đã chép ✓"; }
  catch { e.target.textContent = "862804"; }
});

// ---- Hiện/ẩn phần chi tiết theo lựa chọn tham dự ----
const form = $("#regForm");
form.addEventListener("change", () => {
  const v = form.thamDu.value;
  $("#attendBox").style.display = v === "Không" ? "none" : "";
});

// ---- Vé check-in: QR chỉ chứa mã đăng ký (không chứa dữ liệu cá nhân) ----
function renderTicket(rec) {
  const qr = qrcode(0, "H"); qr.addData(rec.maDangKy); qr.make();
  const n = qr.getModuleCount(), cell = 10, quiet = 4, qs = (n + quiet * 2) * cell;
  const W = 640, H = qs + 330;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
  g.strokeStyle = "#b98a3e"; g.lineWidth = 6; g.strokeRect(10, 10, W - 20, H - 20);
  g.textAlign = "center"; g.fillStyle = "#0000cc"; g.font = "bold 26px Arial";
  g.fillText("GIẤY XÁC NHẬN THAM DỰ", W / 2, 62);
  g.fillStyle = "#ff9900"; g.font = "bold 22px Arial";
  g.fillText("60 NĂM ĐỊA KỸ THUẬT · 1966 – 2026", W / 2, 96);
  g.fillStyle = "#0a2a8a"; g.font = "bold 28px Arial";
  g.fillText(rec.hoTen.slice(0, 34), W / 2, 150);
  g.font = "18px Arial"; g.fillText(rec.donVi.slice(0, 48), W / 2, 180);
  const ox = (W - qs) / 2, oy = 200;
  g.fillStyle = "#fff"; g.fillRect(ox, oy, qs, qs); g.fillStyle = "#0a2a8a";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
    if (qr.isDark(r, c)) g.fillRect(ox + (c + quiet) * cell, oy + (r + quiet) * cell, cell, cell);
  g.fillStyle = "#1d2733"; g.font = "bold 32px monospace";
  g.fillText(rec.maDangKy, W / 2, oy + qs + 45);
  g.font = "17px Arial";
  g.fillText("08:30 – 11:30, 18/11/2026 · Phòng 601, nhà A1, ĐH Giao thông vận tải", W / 2, oy + qs + 80);
  g.fillText("Xuất trình mã này tại bàn đón tiếp" + (rec.nguoiDiCung ? ` · Đi cùng: ${rec.nguoiDiCung} người` : ""), W / 2, oy + qs + 105);
  const url = cv.toDataURL("image/png");
  $("#qrTicket").innerHTML = `<img src="${url}" alt="Vé check-in ${rec.maDangKy}" style="max-width:320px;width:100%;border-radius:8px;border:1px solid #ccc">` +
    `<p><a class="btn" download="Ve_${rec.maDangKy}.png" href="${url}">Tải ảnh vé check-in</a></p>`;
}

// ---- Kiểm tra & gửi ----
const PHONE_RE = /^(0|\+84)\d{9,10}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let r = ""; const a = crypto.getRandomValues(new Uint8Array(6));
  a.forEach((x) => r += chars[x % chars.length]);
  return "DKT60-" + r;
}

function validate(f) {
  if (!f.hoTen.value.trim()) return "Vui lòng nhập họ và tên.";
  if (!f.donVi.value.trim()) return "Vui lòng nhập đơn vị công tác.";
  if (!f.nhom.value) return "Vui lòng chọn nhóm đại biểu.";
  if (!PHONE_RE.test(f.sdt.value.replace(/[\s.\-]/g, ""))) return "Số điện thoại không hợp lệ.";
  if (!EMAIL_RE.test(f.email.value.trim())) return "Email không hợp lệ.";
  if (!f.thamDu.value) return "Vui lòng chọn có/không tham dự.";
  const n = Number(f.nguoiDiCung.value || 0);
  if (!Number.isInteger(n) || n < 0 || n > 10) return "Số người đi cùng phải từ 0 đến 10.";
  if (!f.dongY.checked) return "Vui lòng đồng ý sử dụng thông tin để tiếp tục.";
  return "";
}

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const err = $("#err"); err.textContent = "";
  const msg = validate(form);
  if (msg) { err.textContent = msg; return; }

  const attending = form.thamDu.value === "Có";
  const rec = {
    maDangKy: genCode(),
    thoiGian: new Date().toISOString(),
    hoTen: form.hoTen.value.trim(),
    chucDanh: form.chucDanh.value.trim(),
    donVi: form.donVi.value.trim(),
    nhom: form.nhom.value,
    sdt: form.sdt.value.replace(/[\s.\-]/g, ""),
    email: form.email.value.trim(),
    thamDu: form.thamDu.value,
    nguoiDiCung: attending ? Number(form.nguoiDiCung.value || 0) : 0,
    anUong: attending ? form.anUong.value.trim() : "",
    noiDung: attending ? [...form.querySelectorAll("[name=noiDung]:checked")].map((x) => x.value).join("; ") : "",
    thamLuan: attending ? form.thamLuan.value.trim() : "",
    loiChuc: form.loiChuc.value.trim()
  };

  const btn = $("#submitBtn"); btn.disabled = true; btn.textContent = "Đang gửi...";
  try {
    if (C.endpoint) {
      // text/plain tránh preflight CORS với Apps Script
      await fetch(C.endpoint, { method: "POST", mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(rec) });
    } else {
      const all = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
      all.push(rec); localStorage.setItem(STORE_KEY, JSON.stringify(all));
    }
    form.hidden = true;
    $("#ticketCode").textContent = attending ? rec.maDangKy : rec.maDangKy + " (không tham dự)";
    if (attending) renderTicket(rec);
    $("#success").hidden = false;
    $("#success").scrollIntoView({ behavior: "smooth" });
  } catch (e) {
    console.error(e);
    err.textContent = "Gửi không thành công, vui lòng thử lại hoặc liên hệ ThS. Nguyễn Hải Hà (0812 422 324).";
    btn.disabled = false; btn.textContent = "Gửi xác nhận";
  }
});

