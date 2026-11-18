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
    corpus.py             nạp JD (Excel) và CV (JSON) thành văn bản, tách token
    extract_check.py      so pypdf và pypdfium2 trên 51 PDF
    baseline.py           TF-IDF và BM25, kiểm tra trên nhãn yếu
    build_gold_pairs.py   ghép 150 cặp tập vàng (BM25 + e5 + ngẫu nhiên), phiếu chấm
    label_server.py       trang chấm tập vàng trên máy (ghi thẳng gold_pairs.xlsx)
    export_profiles.py    xuất profile_json từ hệ thống (lệnh matching_export_dataset)
    check_profiles.py     đối chiếu profile_json với manifest, kiểm tra "không bịa"
    calibrate.py          AUC và mốc hiệu chuẩn cosine → điểm của từng phép so
    export_model.py       lưu mô hình vào models/<tên>/<phiên bản>/ cho ml-worker
  labeling/               tài liệu gán nhãn (commit)
    rubric.md             thang chấm 0–4 đã chốt
    gold_pairs.xlsx       phiếu chấm 150 cặp (tab Chấm), kèm nội dung JD và CV
    label_app.html        giao diện của trang chấm
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
    labels/gold_pool.json nguồn ghép cặp và phép chia validation/test (không xem khi chấm)
    profiles/             profile_json xuất từ hệ thống (*.jsonl)
  reports/                bảng số liệu (commit, đưa vào báo cáo)
  models/                 KHÔNG commit; mô hình cho ml-worker (mount /models), kèm model_card.json
```

Thư mục cho giai đoạn sau (tạo khi cần, khai báo thêm vào `paths.py`):
`data/pairs/` cặp huấn luyện.

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

Lưu ý khi trích xuất: `pypdf` tách rời dấu tiếng Việt (9% số từ ở CV tiếng Việt),
nên hệ thống đọc chữ PDF bằng `pypdfium2` (`reports/extract_check.md`). PDF TopCV
hai cột bị đảo thứ tự đọc và thiếu việc đang làm (rơi khi tạo trên TopCV), nên
đáp án số tháng của PDF chỉ tính các việc in trong tệp.

## Chấm tập vàng

```bash
ml/.venv/bin/python ml/scripts/label_server.py
```

Mở http://127.0.0.1:8765. Mỗi trang là một cặp: tin bên trái, CV bên phải, chọn
điểm 0–4 (phím `0`–`4`), ghi một dòng lý do, `U` đánh dấu không chắc, `Enter` lưu
và sang cặp chưa chấm kế tiếp. Nhãn ghi thẳng vào `labeling/gold_pairs.xlsx`;
lúc khởi động phiếu được sao lưu vào `data/labels/`. Đóng tệp trong Excel khi
chấm. Trang không hiện điểm hệ thống hay nguồn ghép cặp (chấm mù); phần "thấy
nguyên chữ" chỉ là tìm chữ giống hệt, kỹ năng tương đương người chấm tự xét.

## Thứ tự chạy

Tất cả chạy từ thư mục gốc repo bằng `ml/.venv/bin/python`. Các script nhập dữ
liệu cần Docker Compose đang chạy; mặc định chỉ chạy thử, thêm `--apply` để ghi.

1. `scripts/import_jd.py --apply --create-skills`: nhập tin tuyển dụng.
2. `scripts/generate_cvs.py`, rồi `scripts/enrich_cvs.py`: sinh CV (cần Ollama).
3. `scripts/import_cvs.py --apply`, rồi `--pdf-twins --apply`: đưa CV vào hệ
   thống, xuất PDF.
4. `scripts/smoke_mps.py`: kiểm tra môi trường huấn luyện.
5. `scripts/extract_check.py`, `scripts/baseline.py`: số liệu thư viện PDF và baseline.
6. `scripts/build_gold_pairs.py`: phiếu chấm tập vàng (cần mô hình e5 đã tải; không
   ghi đè phiếu đã có).
7. `scripts/export_profiles.py`, rồi `scripts/check_profiles.py`: kiểm tra trích xuất.
8. `scripts/export_model.py`: lưu mô hình cho ml-worker; `scripts/calibrate.py`: đo
   mốc hiệu chuẩn, chép vào `CALIBRATIONS` của backend khi đổi mô hình.

Các script chạy lại an toàn: bỏ qua phần đã có.
