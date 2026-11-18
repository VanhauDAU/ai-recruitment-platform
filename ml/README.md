# ml/ — dữ liệu, huấn luyện và đánh giá đối sánh CV–JD

Phần chạy trên máy host (macOS, MPS), ngoài Django. Kế hoạch tổng và tiến độ:
`docs/TIEN-DO-DU-AN.md`, mục AI lõi.

## Cấu trúc

```text
ml/
  README.md
  requirements.txt        thư viện của ml/.venv (ghim phiên bản)
  scripts/
    paths.py              mọi đường dẫn dữ liệu, các script khác chỉ import từ đây
    smoke_mps.py          thử mã hóa + huấn luyện ngắn trên MPS
    import_jd.py          Excel tin tuyển dụng → hệ thống
    generate_cvs.py       sinh CV tổng hợp bằng Ollama từ tin đã nhập
    enrich_cvs.py         bổ sung ngoại ngữ, hoạt động, giải thưởng, sở thích
    import_cvs.py         CV tổng hợp → hệ thống; --pdf-twins xuất bản PDF
  labeling/               tài liệu gán nhãn (commit)
    rubric.md             thang chấm 0–4 đã chốt
    skill_merge.json      gộp kỹ năng trùng nghĩa khi nhập tin
  data/                   KHÔNG commit (.gitignore)
    jd/
      jd_input.xlsx       100 tin thật, người làm đồ án nhập tay
      jd_import_map.json  mã tin trong Excel → tin trong hệ thống
      new_skills_report.txt  kỹ năng mới phát sinh lúc nhập tin (tham khảo)
    cv/
      cv_inventory.xlsx   sổ theo dõi kho CV
      synthetic/          CV-001…CV-100.json + manifest.json (nhãn yếu)
      pdf/system/         15 PDF do hệ thống xuất (bản tải lên của CV tổng hợp)
      pdf/topcv/          36 PDF xuất từ TopCV, nhiều mẫu khác nhau
  models/                 KHÔNG commit; mô hình tải về và đã fine-tune
```

Thư mục cho giai đoạn sau (tạo khi cần, khai báo thêm vào `paths.py`):
`data/labels/` tập vàng và phiếu chấm, `data/pairs/` cặp huấn luyện,
`reports/` bảng số liệu đánh giá (commit để đưa vào báo cáo).

## Kho CV

Mã `CV-xxx` là khóa chung giữa JSON, PDF và `cv_inventory.xlsx`; cùng một mã có
thể có cả bản `pdf/system/` và `pdf/topcv/`. Nội dung mọi bản PDF đều lấy từ
`synthetic/CV-xxx.json`, nên nhãn của một mã dùng chung cho các bản của nó.

- **JSON:** dữ liệu gốc, có cấu trúc. Dùng cho huấn luyện và làm đáp án khi kiểm
  tra trích xuất.
- **`pdf/system/`:** PDF cùng bố cục hệ thống. Dùng để kiểm tra luồng CV tải lên.
- **`pdf/topcv/`:** PDF bố cục đa dạng (1–2 cột, tiếng Việt và tiếng Anh). Dùng để
  đo độ bền của phần trích xuất PDF. Không có ảnh và thông tin liên hệ thật:
  email `cv-xxx@synthetic.procv.test`, số điện thoại `0123 456 789`.

Lưu ý khi trích xuất: `pypdf` tách rời dấu tiếng Việt ở khoảng 40% số từ, nên phải
chuẩn hóa Unicode (NFC) và xử lý riêng trước khi so khớp.

## Thứ tự chạy

Tất cả chạy từ thư mục gốc repo bằng `ml/.venv/bin/python`. Các script nhập dữ
liệu cần Docker Compose đang chạy; mặc định chỉ chạy thử, thêm `--apply` để ghi.

1. `scripts/import_jd.py --apply --create-skills`: nhập tin tuyển dụng.
2. `scripts/generate_cvs.py`, rồi `scripts/enrich_cvs.py`: sinh CV (cần Ollama).
3. `scripts/import_cvs.py --apply`, rồi `--pdf-twins --apply`: đưa CV vào hệ
   thống, xuất PDF.
4. `scripts/smoke_mps.py`: kiểm tra môi trường huấn luyện.

Các script chạy lại an toàn: bỏ qua phần đã có.
