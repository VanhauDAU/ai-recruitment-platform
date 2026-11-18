"""Dựng file Word danh sách biểu đồ tuần tự theo quy cách báo cáo ĐATN mẫu.

Chạy: ml/.venv/bin/python docs/01-phan-tich/so-do-tuan-tu/build_docx.py
Đầu vào: png/*.png (sinh bằng seqdraw), mo_ta.py. Đầu ra: Danh-sach-bieu-do-tuan-tu.docx
"""

import os
import struct
import sys
from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from mo_ta import DU_KIEN, NHOM, SO_DO  # noqa: E402

FONT = "Times New Roman"
CHUONG = 3  # số chương dùng cho chú thích hình/bảng (mục 3.2 của báo cáo)
CONTENT_W, CONTENT_H = 16.5, 21.5  # cm, vùng đặt hình


def set_font(run_or_style, size=None, bold=None, italic=None):
    f = run_or_style.font
    f.name = FONT
    if size:
        f.size = Pt(size)
    if bold is not None:
        f.bold = bold
    if italic is not None:
        f.italic = italic
    el = run_or_style.element if hasattr(run_or_style, "element") else run_or_style._element
    rpr = el.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.insert(0, rfonts)
    for k in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
        rfonts.set(qn(k), FONT)
    for k in ("w:asciiTheme", "w:hAnsiTheme", "w:cstheme", "w:eastAsiaTheme"):
        rfonts.attrib.pop(qn(k), None)


def add_field(paragraph, instr, cached="1", bold=None, italic=None):
    def r():
        run = paragraph.add_run()
        set_font(run, bold=bold, italic=italic)
        return run

    for kind in ("begin", None, "separate", "text", "end"):
        run = r()
        if kind is None:
            it = OxmlElement("w:instrText")
            it.set(qn("xml:space"), "preserve")
            it.text = f" {instr} "
            run._r.append(it)
        elif kind == "text":
            run.text = cached
        else:
            fc = OxmlElement("w:fldChar")
            fc.set(qn("w:fldCharType"), kind)
            run._r.append(fc)


def para(doc, text="", *, align=None, indent=True, bold=None, italic=None, size=None, style=None, keep_next=False):
    p = doc.add_paragraph(style=style)
    if align is not None:
        p.alignment = align
    if not indent:
        p.paragraph_format.first_line_indent = Cm(0)
    if keep_next:
        p.paragraph_format.keep_with_next = True
    if text:
        set_font(p.add_run(text), size=size, bold=bold, italic=italic)
    return p


def caption(doc, label, text, counter):
    p = doc.add_paragraph(style="Caption")
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.first_line_indent = Cm(0)
    if label == "Bảng":
        p.paragraph_format.keep_with_next = True
    set_font(p.add_run(f"{label} {CHUONG}."), bold=True, italic=True)
    add_field(p, f"SEQ {label} \\* ARABIC", str(counter), bold=True, italic=True)
    set_font(p.add_run(f" {text}"), bold=True, italic=True)


def shade(cell, fill="D9D9D9"):
    tcpr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    tcpr.append(shd)


def table(doc, header, rows, widths, size=11):
    t = doc.add_table(rows=1, cols=len(header))
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    data = [header] + rows
    for i, row in enumerate(data):
        cells = t.rows[0].cells if i == 0 else t.add_row().cells
        for j, val in enumerate(row):
            c = cells[j]
            c.width = Cm(widths[j])
            p = c.paragraphs[0]
            p.paragraph_format.first_line_indent = Cm(0)
            p.paragraph_format.line_spacing = 1.1
            p.paragraph_format.space_after = Pt(0)
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            if i == 0:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                shade(c)
            set_font(p.add_run(str(val)), size=size, bold=(i == 0))
    for row in t.rows:  # không tách một hàng sang hai trang
        cs = OxmlElement("w:cantSplit")
        row._tr.get_or_add_trPr().append(cs)
    # hàng tiêu đề lặp lại khi sang trang
    trpr = t.rows[0]._tr.get_or_add_trPr()
    th = OxmlElement("w:tblHeader")
    th.set(qn("w:val"), "true")
    trpr.append(th)
    return t


def png_size(path):
    with open(path, "rb") as f:
        head = f.read(24)
    return struct.unpack(">II", head[16:24])


def setup(doc):
    sec = doc.sections[0]
    sec.page_width, sec.page_height = Cm(21), Cm(29.7)
    sec.top_margin = sec.bottom_margin = Cm(2)
    sec.left_margin, sec.right_margin = Cm(3), Cm(1.5)

    st = doc.styles
    normal = st["Normal"]
    set_font(normal, size=13)
    pf = normal.paragraph_format
    pf.line_spacing = 1.3
    pf.first_line_indent = Cm(0.7)
    pf.space_after = Pt(4)
    pf.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY

    for name, size, center in (("Heading 1", 14, True), ("Heading 2", 13, False), ("Heading 3", 13, False)):
        s = st[name]
        set_font(s, size=size, bold=True, italic=False)
        s.font.color.rgb = None
        s.paragraph_format.first_line_indent = Cm(0)
        s.paragraph_format.space_before = Pt(12 if name != "Heading 3" else 8)
        s.paragraph_format.space_after = Pt(6)
        s.paragraph_format.keep_with_next = True
        s.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER if center else WD_ALIGN_PARAGRAPH.LEFT
        rpr = s.element.get_or_add_rPr()
        for c in rpr.findall(qn("w:color")):
            rpr.remove(c)

    cap = st["Caption"]
    set_font(cap, size=13, bold=True, italic=True)
    cap.font.color.rgb = None
    cap.paragraph_format.space_before = Pt(4)
    cap.paragraph_format.space_after = Pt(10)

    lb = st["List Bullet"]
    set_font(lb, size=13)
    lb.paragraph_format.first_line_indent = None

    hp = sec.header.paragraphs[0]
    hp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    hp.paragraph_format.first_line_indent = Cm(0)
    set_font(hp.add_run("Hệ thống ProCV – Danh sách biểu đồ tuần tự"), size=11, italic=True)
    fp = sec.footer.paragraphs[0]
    fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    fp.paragraph_format.first_line_indent = Cm(0)
    add_field(fp, "PAGE", "1")

    # Word cập nhật mục lục và danh mục hình khi mở tệp
    # (đặt đúng thứ tự phần tử theo lược đồ CT_Settings)
    if os.environ.get("NO_UPDATE_FIELDS"):
        return
    settings = doc.settings.element
    uf = OxmlElement("w:updateFields")
    uf.set(qn("w:val"), "true")
    after = ("hdrShapeDefaults", "footnotePr", "endnotePr", "compat", "docVars", "rsids", "mathPr",
             "attachedSchema", "themeFontLang", "clrSchemeMapping", "doNotIncludeSubdocsInStats",
             "doNotAutoCompressPictures", "forceUpgrade", "captions", "readModeInkLockDown", "smartTagType",
             "schemaLibrary", "shapeDefaults", "doNotEmbedSmartTags", "decimalSymbol", "listSeparator")
    nxt = next((c for c in settings if c.tag.split("}")[-1] in after), None)
    if nxt is None:
        settings.append(uf)
    else:
        nxt.addprevious(uf)


def build():
    doc = Document()
    setup(doc)
    stt = {d["file"]: i + 1 for i, d in enumerate(SO_DO)}

    # ---------- trang đầu ----------
    para(doc, "DANH SÁCH BIỂU ĐỒ TUẦN TỰ", align=WD_ALIGN_PARAGRAPH.CENTER, indent=False, bold=True, size=16)
    para(doc, "Hệ thống ProCV – nền tảng tạo CV, tuyển dụng và đối sánh CV–JD ứng dụng AI",
         align=WD_ALIGN_PARAGRAPH.CENTER, indent=False, italic=True)
    para(doc, "Bổ sung cho mục 3.2 Mô hình hóa yêu cầu của báo cáo đồ án tốt nghiệp",
         align=WD_ALIGN_PARAGRAPH.CENTER, indent=False, italic=True)

    para(doc, "MỤC LỤC", align=WD_ALIGN_PARAGRAPH.CENTER, indent=False, bold=True, size=14)
    add_field(para(doc, indent=False), 'TOC \\o "1-3" \\h \\z \\u', "Nhấn chuột phải, chọn Update Field để hiện mục lục.")
    para(doc, "DANH MỤC HÌNH ẢNH", align=WD_ALIGN_PARAGRAPH.CENTER, indent=False, bold=True, size=14)
    add_field(para(doc, indent=False), 'TOC \\h \\z \\c "Hình"', "Nhấn chuột phải, chọn Update Field để hiện danh mục hình.")
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    # ---------- 1. Giới thiệu ----------
    doc.add_heading("1. Giới thiệu và phạm vi", level=2)
    para(doc, "Tài liệu liệt kê đầy đủ các biểu đồ tuần tự cần đưa vào báo cáo, theo khung của báo cáo mẫu: "
              "mỗi nhóm chức năng ở mục 3.2.x gồm sơ đồ use case, bảng mô tả, bảng dòng chính, sơ đồ tuần tự "
              "và sơ đồ hoạt động. Mỗi biểu đồ ở đây ứng với một use case (hoặc một phần của use case) trong "
              "danh sách use case đã chốt tại docs/01-phan-tich/phan-tich-yeu-cau.md.")
    para(doc, "Luồng trong các biểu đồ được đối chiếu trực tiếp với mã nguồn nhánh dev ngày 18/11/2026: đường dẫn API, "
              "mã lỗi, trạng thái, hàng đợi Celery và quy tắc nghiệp vụ đều lấy từ mã đang chạy. Ba biểu đồ ghi "
              "“Dự kiến” mô tả chức năng thuộc phạm vi đồ án nhưng chưa làm (xếp hạng hồ sơ bằng AI, tìm kiếm hồ sơ "
              "ứng viên, gợi ý việc làm theo ngữ nghĩa); đường dẫn API của chúng là thiết kế đề xuất, dùng lại bộ máy "
              "đối sánh ngữ nghĩa đã có.")
    para(doc, "Mọi hình là ảnh PNG nền trắng, nét đen, độ phân giải cao (phóng to trong Word vẫn rõ). Chú thích hình "
              "dùng trường đánh số tự động; khi chép sang báo cáo, chọn toàn bộ rồi nhấn F9 để Word đánh lại số hình "
              "và bảng theo vị trí mới. Mã nguồn của từng hình nằm ở thư mục src/ (tệp .seq) và được vẽ lại bằng "
              "seqdraw.swift.")

    doc.add_heading("2. Quy ước ký hiệu", level=2)
    caption(doc, "Bảng", "Quy ước ký hiệu trong biểu đồ tuần tự", 1)
    table(doc, ["Ký hiệu", "Ý nghĩa"], [
        ["Hình người", "Tác nhân (actor): Khách, Ứng viên, Nhà tuyển dụng, Quản lý công ty, Quản trị viên"],
        ["Hình chữ nhật", "Thành phần phần mềm của hệ thống (giao diện, máy chủ API, mô hình AI)"],
        ["Hình trụ", "Kho dữ liệu: PostgreSQL (kèm pgvector), Redis"],
        ["Hình chữ nhật có hai vạch dọc", "Hàng đợi / worker xử lý nền (Celery)"],
        ["Hình chữ nhật viền đôi", "Hệ thống bên ngoài: Google OAuth, Gemini, dịch vụ SMS, ClamAV, VietQR"],
        ["Đường nét đứt dọc", "Đường đời (lifeline) của thành phần"],
        ["Mũi tên liền, đầu đặc", "Thông điệp gọi đồng bộ (yêu cầu HTTP, truy vấn CSDL, gọi hàm)"],
        ["Mũi tên liền, đầu mở", "Thông điệp bất đồng bộ (đưa việc vào hàng đợi, gửi email, thông báo)"],
        ["Mũi tên nét đứt, đầu mở", "Thông điệp trả về (phản hồi HTTP kèm mã trạng thái)"],
        ["Mũi tên quay về chính nó", "Xử lý nội bộ (kiểm tra, tính toán)"],
        ["Khung alt / else", "Các nhánh rẽ loại trừ nhau: luồng đúng và các luồng sai / ngoại lệ"],
        ["Khung opt", "Đoạn chỉ chạy khi điều kiện đúng"],
        ["Khung loop", "Đoạn lặp (thăm dò trạng thái, duyệt danh sách)"],
        ["Khung có nhãn (group)", "Nhóm các bước của một chức năng con"],
        ["Hình chữ nhật gập góc", "Ghi chú quy tắc nghiệp vụ"],
    ], [5.0, 11.5])

    doc.add_heading("3. Thành phần tham gia", level=2)
    caption(doc, "Bảng", "Thành phần tham gia trong các biểu đồ tuần tự", 2)
    table(doc, ["Thành phần", "Vai trò"], [
        ["Giao diện web (React)", "SPA ReactJS + Vite cho ba cổng: ứng viên, nhà tuyển dụng, quản trị"],
        ["Máy chủ API (Django REST)", "Xác thực JWT theo cổng, kiểm tra quyền, nghiệp vụ, ghi CSDL, đưa việc vào hàng đợi"],
        ["CSDL (PostgreSQL + pgvector)", "Dữ liệu nghiệp vụ; vector 768 chiều của CV và tin cho đối sánh ngữ nghĩa"],
        ["Bộ nhớ đệm (Redis)", "Token xác minh, đặt lại mật khẩu, state OAuth, bộ đếm đăng nhập sai, khử trùng lượt xem; broker của Celery"],
        ["Worker nền (Celery)", "Gửi email, xuất PDF, nhập CV, quét tệp, nhắc hạn hồ sơ"],
        ["AI Worker (ai-generation)", "Gọi Gemini để tạo nội dung tin tuyển dụng và nội dung CV mẫu"],
        ["ML Worker (ai-matching)", "Trích hồ sơ, mã hóa bằng mô hình e5-base chạy local, chấm điểm hybrid-v1"],
        ["Celery Beat", "Lập lịch tác vụ định kỳ (công bố quyết định, tự động từ chối, phục hồi việc treo)"],
        ["Hệ thống ngoài", "Google OAuth và reCAPTCHA, Gemini, dịch vụ SMS, ClamAV, VietQR, máy chủ SMTP"],
    ], [5.0, 11.5])

    # ---------- 4. Bảng tổng hợp ----------
    doc.add_heading("4. Bảng tổng hợp danh sách biểu đồ tuần tự", level=2)
    para(doc, f"Tổng cộng {len(SO_DO)} biểu đồ, trong đó {sum(d['tt'] == DU_KIEN for d in SO_DO)} biểu đồ dự kiến. "
              "Cột “Mục” là số mục trong phần 5 của tài liệu này.")
    caption(doc, "Bảng", "Danh sách biểu đồ tuần tự của hệ thống", 3)
    rows = []
    for gi, (g, _) in enumerate(NHOM, start=1):
        for k, d in enumerate([d for d in SO_DO if d["nhom"] == g], start=1):
            rows.append([stt[d["file"]], f"5.{gi}.{k}", d["ten"][0].upper() + d["ten"][1:], d["uc"], d["tac_nhan"], d["tt"]])
    table(doc, ["STT", "Mục", "Biểu đồ tuần tự chức năng", "Use case", "Tác nhân", "Trạng thái"],
          rows, [1.2, 1.3, 4.2, 4.5, 3.3, 2.0], size=10)

    # ---------- 5. Chi tiết ----------
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)
    doc.add_heading("5. Chi tiết từng biểu đồ tuần tự", level=2)
    hinh = 0
    bang = 3
    for gi, (g, ten_nhom) in enumerate(NHOM, start=1):
        h2 = doc.add_heading(f"5.{gi}. {ten_nhom}", level=2)
        h2.paragraph_format.page_break_before = gi > 1
        for k, d in enumerate([d for d in SO_DO if d["nhom"] == g], start=1):
            ten = d["ten"][0].upper() + d["ten"][1:]
            h3 = doc.add_heading(f"5.{gi}.{k}. {ten}" + (" (dự kiến)" if d["tt"] == DU_KIEN else ""), level=3)
            h3.paragraph_format.page_break_before = k > 1
            bang += 1
            caption(doc, "Bảng", f"Mô tả biểu đồ tuần tự chức năng {d['ten']}", bang)
            table(doc, ["Mục", "Nội dung"], [
                ["Use case", d["uc"]],
                ["Tác nhân", d["tac_nhan"]],
                ["Trạng thái", d["tt"] + (" (chưa có trong mã nguồn, API là thiết kế đề xuất)" if d["tt"] == DU_KIEN else " (khớp mã nguồn hiện tại)")],
                ["Mục đích", d["muc_dich"]],
                ["Điều kiện tiên quyết", d["dk"]],
            ], [4.0, 12.5])
            para(doc, "Luồng sự kiện chính:", indent=False, bold=True, keep_next=True).paragraph_format.space_before = Pt(8)
            for i, s in enumerate(d["chinh"], start=1):
                p = para(doc, indent=False)
                p.paragraph_format.left_indent = Cm(0.7)
                set_font(p.add_run(f"{i}. {s}"))
            para(doc, "Luồng thay thế và ngoại lệ:", indent=False, bold=True, keep_next=True)
            for s in d["ngoai_le"]:
                p = doc.add_paragraph(style="List Bullet")
                set_font(p.add_run(s))

            img = HERE / "png" / f"{d['file']}.png"
            w_px, h_px = png_size(img)
            w = min(CONTENT_W, CONTENT_H * w_px / h_px)
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.first_line_indent = Cm(0)
            p.paragraph_format.keep_with_next = True
            p.paragraph_format.page_break_before = True
            p.add_run().add_picture(str(img), width=Cm(w))
            hinh += 1
            caption(doc, "Hình", f"Sơ đồ tuần tự chức năng {d['ten']}", hinh)

    out = Path(os.environ.get("DOCX_OUT", HERE / "Danh-sach-bieu-do-tuan-tu.docx"))
    doc.save(out)
    print(out, hinh, "hình,", bang, "bảng")


if __name__ == "__main__":
    build()
