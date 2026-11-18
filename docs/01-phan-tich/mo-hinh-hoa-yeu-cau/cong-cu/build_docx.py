"""Dựng file Word mục 3.2 Mô hình hóa yêu cầu theo khung báo cáo ĐATN mẫu.

Mỗi nhóm chức năng (thư mục NN-ten-nhom/) gồm: sơ đồ use case, bảng mô tả use case,
bảng dòng chính, rồi lần lượt sơ đồ tuần tự và sơ đồ hoạt động của từng chức năng.
Chạy qua cong-cu/build.sh (vẽ hình trước). Đầu ra: Mo-hinh-hoa-yeu-cau.docx
Biến môi trường: DOCX_OUT (đường dẫn đầu ra), NO_UPDATE_FIELDS=1 (không bắt Word cập nhật trường khi mở).
"""

import os
import re
import runpy
import struct
from pathlib import Path

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.section import WD_ORIENT, WD_SECTION
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt

ROOT = Path(__file__).resolve().parent.parent
FONT = "Times New Roman"
CHUONG = 3
CONTENT_W, CONTENT_H = 16.5, 21.5  # cm
counters = {"Hình": 0, "Bảng": 0}
state = {"fresh_page": False}  # vừa sang trang mới bằng ngắt section


def new_section(doc, landscape):
    sec = doc.add_section(WD_SECTION.NEW_PAGE)
    sec.orientation = WD_ORIENT.LANDSCAPE if landscape else WD_ORIENT.PORTRAIT
    sec.page_width, sec.page_height = (Cm(29.7), Cm(21)) if landscape else (Cm(21), Cm(29.7))
    sec.top_margin = sec.bottom_margin = Cm(2)
    sec.left_margin, sec.right_margin = Cm(3), Cm(1.5)
    state["fresh_page"] = True


def set_font(obj, size=None, bold=None, italic=None):
    f = obj.font
    f.name = FONT
    if size:
        f.size = Pt(size)
    if bold is not None:
        f.bold = bold
    if italic is not None:
        f.italic = italic
    el = obj.element if hasattr(obj, "element") else obj._element
    rpr = el.get_or_add_rPr()
    rf = rpr.find(qn("w:rFonts"))
    if rf is None:
        rf = OxmlElement("w:rFonts")
        rpr.insert(0, rf)
    for k in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
        rf.set(qn(k), FONT)
    for k in ("w:asciiTheme", "w:hAnsiTheme", "w:cstheme", "w:eastAsiaTheme"):
        rf.attrib.pop(qn(k), None)


def add_field(p, instr, cached, bold=None, italic=None):
    for kind in ("begin", "instr", "separate", "text", "end"):
        r = p.add_run()
        set_font(r, bold=bold, italic=italic)
        if kind == "instr":
            it = OxmlElement("w:instrText")
            it.set(qn("xml:space"), "preserve")
            it.text = f" {instr} "
            r._r.append(it)
        elif kind == "text":
            r.text = cached
        else:
            fc = OxmlElement("w:fldChar")
            fc.set(qn("w:fldCharType"), kind)
            r._r.append(fc)


def para(doc, text="", *, align=None, indent=True, bold=None, italic=None, size=None, keep_next=False):
    p = doc.add_paragraph()
    if align is not None:
        p.alignment = align
    if not indent:
        p.paragraph_format.first_line_indent = Cm(0)
    p.paragraph_format.keep_with_next = keep_next
    if text:
        set_font(p.add_run(text), size=size, bold=bold, italic=italic)
    return p


def caption(doc, label, text):
    counters[label] += 1
    p = doc.add_paragraph(style="Caption")
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.first_line_indent = Cm(0)
    p.paragraph_format.keep_with_next = label == "Bảng"
    set_font(p.add_run(f"{label} {CHUONG}."), bold=True, italic=True)
    add_field(p, f"SEQ {label} \\* ARABIC", str(counters[label]), bold=True, italic=True)
    set_font(p.add_run(f" {text}"), bold=True, italic=True)


def table(doc, header, rows, widths, size=11):
    t = doc.add_table(rows=1, cols=len(header))
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    for i, row in enumerate([header] + rows):
        cells = t.rows[0].cells if i == 0 else t.add_row().cells
        for j, val in enumerate(row):
            c = cells[j]
            c.width = Cm(widths[j])
            p = c.paragraphs[0]
            pf = p.paragraph_format
            pf.first_line_indent, pf.line_spacing, pf.space_after = Cm(0), 1.1, Pt(0)
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER if i == 0 or j == 0 and header[0] == "STT" else WD_ALIGN_PARAGRAPH.LEFT
            if i == 0:
                shd = OxmlElement("w:shd")
                for k, v in (("w:val", "clear"), ("w:color", "auto"), ("w:fill", "D9D9D9")):
                    shd.set(qn(k), v)
                c._tc.get_or_add_tcPr().append(shd)
            set_font(p.add_run(str(val)), size=size, bold=i == 0)
    for row in t.rows:
        row._tr.get_or_add_trPr().append(OxmlElement("w:cantSplit"))
    th = OxmlElement("w:tblHeader")
    th.set(qn("w:val"), "true")
    t.rows[0]._tr.get_or_add_trPr().append(th)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


def figure(doc, img, text, label_line=None, new_page=False):
    with open(img, "rb") as f:
        w_px, h_px = struct.unpack(">II", f.read(24)[16:24])
    landscape = new_page and w_px / h_px > 1.25  # hình rộng đặt trên trang ngang cho chữ đủ lớn
    if landscape:
        new_section(doc, True)
        new_page = False
    elif new_page and state["fresh_page"]:
        new_page = False
    state["fresh_page"] = False
    if label_line:
        p = para(doc, label_line, indent=False, keep_next=True)
        p.paragraph_format.page_break_before = new_page
    cw, ch = (25.2, 14.5) if landscape else (CONTENT_W, CONTENT_H)
    w = min(cw, ch * w_px / h_px)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.first_line_indent = Cm(0)
    p.paragraph_format.keep_with_next = True
    if new_page and not label_line:
        p.paragraph_format.page_break_before = True
    p.add_run().add_picture(str(img), width=Cm(w))
    caption(doc, "Hình", text)
    if landscape:
        new_section(doc, False)


def title_of(path):
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("title "):
            return line[6:].strip()
    raise ValueError(f"missing title in {path}")


def setup(doc):
    sec = doc.sections[0]
    sec.page_width, sec.page_height = Cm(21), Cm(29.7)
    sec.top_margin = sec.bottom_margin = Cm(2)
    sec.left_margin, sec.right_margin = Cm(3), Cm(1.5)
    st = doc.styles
    set_font(st["Normal"], size=13)
    pf = st["Normal"].paragraph_format
    pf.line_spacing, pf.first_line_indent, pf.space_after = 1.3, Cm(0.7), Pt(4)
    pf.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    for name, size, center in (("Heading 1", 14, True), ("Heading 2", 13, False), ("Heading 3", 13, False)):
        s = st[name]
        set_font(s, size=size, bold=True, italic=False)
        s.font.color.rgb = None
        f = s.paragraph_format
        f.first_line_indent, f.space_before, f.space_after, f.keep_with_next = Cm(0), Pt(12), Pt(6), True
        f.alignment = WD_ALIGN_PARAGRAPH.CENTER if center else WD_ALIGN_PARAGRAPH.LEFT
        rpr = s.element.get_or_add_rPr()
        for c in rpr.findall(qn("w:color")):
            rpr.remove(c)
    cap = st["Caption"]
    set_font(cap, size=13, bold=True, italic=True)
    cap.font.color.rgb = None
    cap.paragraph_format.space_before, cap.paragraph_format.space_after = Pt(4), Pt(10)

    hp = sec.header.paragraphs[0]
    hp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    hp.paragraph_format.first_line_indent = Cm(0)
    set_font(hp.add_run("Hệ thống ProCV – Mô hình hóa yêu cầu"), size=11, italic=True)
    fp = sec.footer.paragraphs[0]
    fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    fp.paragraph_format.first_line_indent = Cm(0)
    add_field(fp, "PAGE", "1")

    if os.environ.get("NO_UPDATE_FIELDS"):
        return
    settings = doc.settings.element
    uf = OxmlElement("w:updateFields")
    uf.set(qn("w:val"), "true")
    after = {"hdrShapeDefaults", "footnotePr", "endnotePr", "compat", "docVars", "rsids", "mathPr", "attachedSchema",
             "themeFontLang", "clrSchemeMapping", "doNotIncludeSubdocsInStats", "doNotAutoCompressPictures",
             "forceUpgrade", "captions", "readModeInkLockDown", "smartTagType", "schemaLibrary", "shapeDefaults",
             "doNotEmbedSmartTags", "decimalSymbol", "listSeparator"}
    nxt = next((c for c in settings if c.tag.split("}")[-1] in after), None)
    nxt.addprevious(uf) if nxt is not None else settings.append(uf)


def build():
    doc = Document()
    setup(doc)
    groups = sorted(p for p in ROOT.iterdir() if p.is_dir() and re.match(r"\d\d-", p.name) and (p / "noi_dung.py").exists())

    para(doc, "MÔ HÌNH HÓA YÊU CẦU", align=WD_ALIGN_PARAGRAPH.CENTER, indent=False, bold=True, size=16)
    para(doc, "Hệ thống ProCV – nền tảng tạo CV, tuyển dụng và đối sánh CV–JD ứng dụng AI",
         align=WD_ALIGN_PARAGRAPH.CENTER, indent=False, italic=True)
    for head, instr, hint in (("MỤC LỤC", 'TOC \\o "1-3" \\h \\z \\u', "mục lục"),
                              ("DANH MỤC BẢNG", 'TOC \\h \\z \\c "Bảng"', "danh mục bảng"),
                              ("DANH MỤC HÌNH ẢNH", 'TOC \\h \\z \\c "Hình"', "danh mục hình")):
        para(doc, head, align=WD_ALIGN_PARAGRAPH.CENTER, indent=False, bold=True, size=14)
        add_field(para(doc, indent=False), instr, f"Nhấn chuột phải, chọn Update Field để hiện {hint}.")
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    doc.add_heading("3.2. Mô hình hóa yêu cầu", level=2)
    para(doc, "Mục này mô hình hóa yêu cầu của hệ thống ProCV theo từng nhóm chức năng. Mỗi nhóm gồm sơ đồ use case, "
              "bảng mô tả use case, bảng dòng chính, sơ đồ tuần tự và sơ đồ hoạt động của các chức năng trong nhóm. "
              "Luồng trong các sơ đồ được đối chiếu với mã nguồn hiện tại; chức năng ghi “dự kiến” thuộc phạm vi đồ án "
              "nhưng chưa xây dựng. Use case viền đậm là chức năng AI chạy local do hệ thống tự xây dựng.")
    figure(doc, ROOT / "00-use-case-tong-quat" / "hinh" / "use-case-tong-quat.png", "Sơ đồ use case tổng quát",
           label_line="Sơ đồ use case tổng quát")
    caption(doc, "Bảng", "Các tác nhân của hệ thống")
    table(doc, ["Tác nhân", "Mô tả"], [
        ["Khách", "Người chưa đăng nhập: tìm việc, xem công ty, đăng ký, đăng nhập"],
        ["Người dùng", "Tác nhân trừu tượng, cha của Ứng viên, Nhà tuyển dụng, Quản trị viên"],
        ["Ứng viên", "Tài khoản cổng ứng viên: quản lý hồ sơ, CV, ứng tuyển, phân tích độ phù hợp"],
        ["Nhà tuyển dụng", "Tài khoản cổng NTD; người giữ vai trò quản lý công ty có thêm quyền quản lý thành viên"],
        ["Quản trị viên", "Admin thường và superuser: duyệt, hậu kiểm, quản lý tài khoản, mẫu CV, thống kê"],
        ["Hệ thống ngoài", "Google (OAuth, reCAPTCHA, Gemini), dịch vụ email, dịch vụ SMS, ClamAV, VietQR"],
        ["Tác vụ định kỳ", "Celery Beat: nhắc hạn, tự động từ chối, công bố quyết định, phục hồi việc treo"],
    ], [4.0, 12.5])

    for gi, g in enumerate(groups, start=1):
        nd = runpy.run_path(str(g / "noi_dung.py"))
        ten = nd["TEN"]
        h = doc.add_heading(f"3.2.{gi}. {ten[0].upper() + ten[1:]}", level=3)
        h.paragraph_format.page_break_before = not state["fresh_page"]
        state["fresh_page"] = False
        figure(doc, g / "hinh" / "use-case.png", f"Sơ đồ use case {ten}", label_line=f"Sơ đồ use case {ten}")
        caption(doc, "Bảng", f"Mô tả use case {ten}")
        table(doc, ["Tên Use Case", "Tác nhân", "Mục đích chính", "Điều kiện tiên quyết", "Kết quả mong đợi"],
              [list(r) for r in nd["MO_TA"]], [3.2, 2.6, 3.6, 3.6, 3.5], size=10.5)
        caption(doc, "Bảng", f"Dòng chính use case {ten}")
        table(doc, ["STT", "Use Case", "Thực hiện", "Hành động chính"],
              [[i, *r] for i, r in enumerate(nd["DONG_CHINH"], start=1)], [1.1, 4.0, 2.8, 8.6], size=10.5)
        for seq in sorted((g / "tuan-tu").glob("*.seq")):
            stem = seq.stem
            t_seq = title_of(seq)
            figure(doc, g / "hinh" / f"tuan-tu_{stem}.png", t_seq, label_line=t_seq, new_page=True)
            act = g / "hoat-dong" / f"{stem}.act"
            if act.exists():
                t_act = title_of(act)
                figure(doc, g / "hinh" / f"hoat-dong_{stem}.png", t_act, label_line=t_act, new_page=True)

    out = Path(os.environ.get("DOCX_OUT", ROOT / "Mo-hinh-hoa-yeu-cau.docx"))
    doc.save(out)
    print(out, counters["Hình"], "hình,", counters["Bảng"], "bảng,", len(groups), "nhóm")


if __name__ == "__main__":
    build()
