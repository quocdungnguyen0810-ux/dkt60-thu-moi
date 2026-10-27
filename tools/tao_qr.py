"""Tạo mã QR (PNG + SVG) để in lên thư mời.

Dùng: python tools/tao_qr.py [URL]
Mặc định mã hóa link rút gọn. Mức sửa lỗi H (30%) để in vẫn quét được khi bị bẩn/nhàu.
"""
from __future__ import annotations

import logging
import sys
from pathlib import Path

import segno

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger("tao_qr")

DEFAULT_URL = "https://is.gd/dkt60utc"
OUT_DIR = Path(__file__).resolve().parent.parent / "qr"
NAVY = "#0a2a8a"  # xanh theo thư mời


def tao_qr(url: str, ten: str) -> None:
    if not url.startswith(("http://", "https://")):
        raise ValueError(f"URL không hợp lệ: {url}")
    OUT_DIR.mkdir(exist_ok=True)
    qr = segno.make(url, error="h", micro=False)
    qr.save(OUT_DIR / f"{ten}.png", scale=30, border=4, dark=NAVY)  # ~1000 px, in 300 dpi ≈ 3 cm+
    qr.save(OUT_DIR / f"{ten}.svg", scale=10, border=4, dark=NAVY)  # vector, phóng to tùy ý
    log.info("Đã tạo %s.png/.svg cho %s", ten, url)


if __name__ == "__main__":
    tao_qr(sys.argv[1] if len(sys.argv) > 1 else DEFAULT_URL, "qr_xac_nhan_tham_du")
