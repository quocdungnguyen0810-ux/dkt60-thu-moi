"""Cập nhật giấy mời bản cứng (.docx): đổi Thư ký BTC, thêm số tài khoản, chèn mã QR.

Không ghi đè bản gốc: tạo file mới *_QR.docx. Thao tác trực tiếp trên XML để giữ nguyên
toàn bộ định dạng, ảnh nền, header của bản gốc.
"""
from __future__ import annotations

import logging
import re
import shutil
import sys
import zipfile
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger("sua_giay_moi")

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "Giay_moi_60_nam_DKT_KGN_gap_doi3.docx"
DST = ROOT / "Giay_moi_60_nam_DKT_KGN_gap_doi3_QR.docx"
QR_PNG = ROOT / "web_thu_moi" / "qr" / "qr_xac_nhan_tham_du.png"
SHORT_LINK = "is.gd/dkt60utc"

QR_SIZE_EMU = 756000  # 2,1 cm
RID = "rId90"
MEDIA = "word/media/image_qr.png"

RPR = '<w:rPr><w:i/><w:color w:val="0000CC"/><w:sz w:val="18"/></w:rPr>'
RPR_B = '<w:rPr><w:b/><w:bCs/><w:i/><w:color w:val="0000CC"/><w:sz w:val="18"/></w:rPr>'


def thay(xml: str, cu: str, moi: str, so_lan: int = 1) -> str:
    """Thay chuỗi và bắt buộc phải tìm thấy đúng số lần (tránh sửa nhầm âm thầm)."""
    n = xml.count(cu)
    if n != so_lan:
        raise ValueError(f"Mong đợi {so_lan} lần, thấy {n} lần: {cu[:60]!r}")
    return xml.replace(cu, moi)


def run_qr_noi() -> str:
    """Run chứa ảnh QR nổi (anchor), canh phải ô, không làm thay đổi chiều cao dòng/trang."""
    return (
        '<w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" '
        'relativeHeight="251659264" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">'
        '<wp:simplePos x="0" y="0"/>'
        '<wp:positionH relativeFrom="column"><wp:align>right</wp:align></wp:positionH>'
        '<wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV>'
        f'<wp:extent cx="{QR_SIZE_EMU}" cy="{QR_SIZE_EMU}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>'
        '<wp:wrapNone/><wp:docPr id="90" name="QR xac nhan tham du" descr="Mã QR xác nhận tham dự"/>'
        '<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>'
        '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
        '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        '<pic:nvPicPr><pic:cNvPr id="90" name="qr.png"/><pic:cNvPicPr/></pic:nvPicPr>'
        f'<pic:blipFill><a:blip r:embed="{RID}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
        f'<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{QR_SIZE_EMU}" cy="{QR_SIZE_EMU}"/></a:xfrm>'
        '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic>'
        '</wp:anchor></w:drawing></w:r>'
    )


def gian_cot_phai(xml: str, he_so: float = 0.3) -> str:
    """Thu nhỏ khoảng cách sau đoạn (w:after >= 60) trong cột chương trình để vừa 1 trang."""
    i = xml.index("CHƯƠNG TRÌNH")
    phan = re.sub(
        r'w:after="(\d+)"',
        lambda m: f'w:after="{round(int(m.group(1)) * he_so)}"' if int(m.group(1)) >= 60 else m.group(0),
        xml[i:],
    )
    return xml[:i] + phan

def dong_tai_khoan() -> str:
    return (
        '<w:p><w:pPr><w:spacing w:after="60"/></w:pPr>'
        f'<w:r>{RPR}<w:t xml:space="preserve">      Số tài khoản: 862804 – Ngân hàng Quốc tế VIB (Nguyễn Hải Hà)</w:t></w:r></w:p>'
    )


def main() -> None:
    for p in (SRC, QR_PNG):
        if not p.exists():
            sys.exit(f"Thiếu file: {p}")

    with zipfile.ZipFile(SRC) as zin:
        doc = zin.read("word/document.xml").decode("utf-8")
        rels = zin.read("word/_rels/document.xml.rels").decode("utf-8")
        ctypes = zin.read("[Content_Types].xml").decode("utf-8")

        # 1) Thư ký BTC: Trần Thị Thu Hiền (0983821677) -> Nguyễn Hải Hà (0812422324)
        doc = thay(doc, "<w:t>Trần Thị Thu Hi</w:t>", "<w:t>Nguyễn Hải Hà</w:t>")
        doc = thay(doc, '<w:t xml:space="preserve">ền </w:t>', '<w:t xml:space="preserve"> </w:t>')
        doc = thay(doc, "<w:t>0983821677</w:t>", "<w:t>0812422324</w:t>")

        # 2) Thêm dòng số tài khoản sau dòng Thư ký (cuối ô cuối của bảng)
        anchor = "<w:t>)</w:t></w:r></w:p></w:tc></w:tr></w:tbl>"
        doc = thay(doc, anchor, "<w:t>)</w:t></w:r></w:p>" + dong_tai_khoan() + "</w:tc></w:tr></w:tbl>")

        # 3) Link rút gọn vào dòng xác nhận + QR nổi ở đầu khối liên hệ
        doc = thay(doc, ", vui lòng xác nhận tham dự theo mã QR</w:t>",
                   f", vui lòng xác nhận tham dự theo mã QR hoặc truy cập {SHORT_LINK}</w:t>")
        dau_lh = '<w:r><w:rPr><w:b/><w:bCs/><w:i/><w:color w:val="0000CC"/><w:sz w:val="18"/></w:rPr><w:t>Mọi thông tin cần thiết'
        doc = thay(doc, dau_lh, run_qr_noi() + dau_lh)
        doc = gian_cot_phai(doc)
        doc = thay(doc, '<w:trHeight w:val="10370"/>', '<w:trHeight w:val="10100"/>')  # chừa lề an toàn, tránh tràn trang thừa
        # 4) Quan hệ ảnh + content type
        rels = thay(
            rels, "</Relationships>",
            f'<Relationship Id="{RID}" Type="http://schemas.openxmlformats.org/officeDocument/2006/'
            f'relationships/image" Target="media/image_qr.png"/></Relationships>',
        )
        if 'Extension="png"' not in ctypes:
            ctypes = thay(ctypes, "<Override", '<Default Extension="png" ContentType="image/png"/><Override')

        with zipfile.ZipFile(DST, "w", zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)
                if item.filename == "word/document.xml":
                    data = doc.encode("utf-8")
                elif item.filename == "word/_rels/document.xml.rels":
                    data = rels.encode("utf-8")
                elif item.filename == "[Content_Types].xml":
                    data = ctypes.encode("utf-8")
                zout.writestr(item, data)
            zout.write(QR_PNG, MEDIA)
    log.info("Đã tạo %s", DST)


if __name__ == "__main__":
    main()
