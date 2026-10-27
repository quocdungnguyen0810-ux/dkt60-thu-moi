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
    $("#success").hidden = false;
    $("#success").scrollIntoView({ behavior: "smooth" });
  } catch (e) {
    console.error(e);
    err.textContent = "Gửi không thành công, vui lòng thử lại hoặc liên hệ ThS. Nguyễn Hải Hà (0812 422 324).";
    btn.disabled = false; btn.textContent = "Gửi xác nhận";
  }
});

