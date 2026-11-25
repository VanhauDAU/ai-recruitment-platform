# ml/ — dữ liệu, huấn luyện và đánh giá đối sánh CV–JD

Phần chạy trên máy host (macOS, MPS), ngoài Django. Thuật toán và công thức:
[`docs/07-algorithms/thuat-toan-ai.md`](../docs/07-algorithms/thuat-toan-ai.md) mục 7.
Trạng thái từng giai đoạn: [tiến độ dự án](../docs/TIEN-DO-DU-AN.md#aiml-chạy-local);
nhật ký thực nghiệm theo ngày (số đo, quyết định, phát hiện):
[bản lưu trữ](../docs/archive/snapshot/tien-do-den-2026-11-26.md#đối-sánh-ngữ-nghĩa-cvjd-chạy-local-2026-11-15).

`requirements.txt` ghim cùng phiên bản `torch`, `sentence-transformers`,
`transformers` với `backend/requirements-ml.txt` (image `ml-worker`), để vector tính
lúc huấn luyện và lúc phục vụ khớp nhau. Đổi một bên thì đổi cả hai.

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
    build_gold_pairs.py   ghép cặp tập vàng (BM25 + e5 + ngẫu nhiên), phiếu chấm; --extend cho đợt 2
    agreement.py          so nhãn người với nhãn Claude trên các cặp kiểm chứng
    export_profiles.py    xuất profile_json từ hệ thống (lệnh matching_export_dataset)
    check_profiles.py     đối chiếu profile_json với manifest, kiểm tra "không bịa"
    calibrate.py          AUC và mốc hiệu chuẩn cosine → điểm của từng phép so
    export_model.py       lưu mô hình vào models/<tên>/<phiên bản>/ cho ml-worker
    fetch_public.py       tải dữ liệu và mô hình công khai, ghi nguồn vào data/public/SOURCES.md
    merge_gold_passes.py  gộp hai lượt gán nhãn độc lập của đợt 2 tập vàng
    evaluate.py           đo các phương án trên tập vàng (validation; test chỉ một lần)
    evaluate_recommendations.py  đo gợi ý việc làm CV → tin trên nhãn yếu
  labeling/               tài liệu gán nhãn (commit)
    rubric.md             thang chấm 0–4 đã chốt
    gold_pairs.xlsx       phiếu chấm 150 cặp (tab Chấm), kèm nội dung JD và CV
    gold_pairs_claude.xlsx  nhãn 150 cặp do Claude gán (annotator = claude)
    gold_pairs_2.xlsx     phiếu chấm mù của đợt 2 (cặp 151–300)
    gold_pairs_claude_2.xlsx  nhãn đợt 2, kèm nhãn của từng lượt gán
    gold_pairs_2_passes.json  nhãn và lý do của hai lượt gán độc lập, phần phân xử
    education_key.json    bậc học theo chữ in ở tên bằng của 100 CV (đáp án khi kiểm tra trích xuất PDF)
    audit_pairs.json      30 cặp kiểm chứng cố định (người chấm mù 5 cặp)
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
    eval/                 điểm từng cặp của mỗi lần đo (evaluate.py, *.jsonl)
    pairs/                cặp huấn luyện
    public/               dữ liệu công khai (VietJobs, resume-job-description-fit)
  reports/                bảng số liệu (commit, đưa vào báo cáo); tên = script sinh ra nó
    extract_check.md      pypdf và pypdfium2 trên 51 PDF          (extract_check.py)
    baseline_weak_labels.md  TF-IDF, BM25 trên nhãn yếu           (baseline.py)
    label_agreement.md, gold_batch2_agreement.md  đồng thuận nhãn (agreement.py, merge_gold_passes.py)
    check_profiles.md     trích xuất profile_json so với đáp án   (check_profiles.py)
    calibration_<mô hình>.md  AUC và mốc hiệu chuẩn               (calibrate.py)
    eval_validation.{md,json}  bảng đo trên validation            (evaluate.py)
    recommendations.{md,json}  đo gợi ý việc làm                  (evaluate_recommendations.py)
  models/                 KHÔNG commit; mô hình cho ml-worker (mount /models), kèm model_card.json
```

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

## Tập vàng

Nhãn 150 cặp do Claude gán theo `labeling/rubric.md` (kèm các quy tắc làm rõ A–D
do người làm đồ án chốt), lưu ở `labeling/gold_pairs_claude.xlsx`. Người làm đồ
án chấm mù 5 cặp trong `labeling/gold_pairs.xlsx` để kiểm tra sơ bộ;
`scripts/agreement.py` so hai bộ nhãn (`reports/label_agreement.md`, từ 10 cặp trở
lên thì tính thêm kappa). Công cụ chấm trên trình duyệt đã gỡ khi dừng chấm; cần
chấm thêm thì khôi phục từ lịch sử git (commit `feat(ml): local labeling page`).

Đợt 2 (20/11) thêm 15 tin, nâng tập vàng lên 30 tin / 300 cặp: validation 10 tin,
test 20 tin (phép chia ở `data/labels/gold_pool.json`). Mỗi cặp mới do hai lượt
Claude độc lập gán; hai lượt trùng 142/150 cặp, kappa 0,979
(`reports/gold_batch2_agreement.md`); 8 cặp lệch được phân xử theo các quy tắc
E1–E5 của rubric. `scripts/evaluate.py` đọc cả hai đợt.

## Thứ tự chạy

Tất cả chạy từ thư mục gốc repo bằng `ml/.venv/bin/python`. Các script nhập dữ
liệu cần Docker Compose đang chạy; mặc định chỉ chạy thử, thêm `--apply` để ghi.

1. `scripts/import_jd.py --apply --create-skills`: áp bảng gộp kỹ năng
   (thêm `--refresh-skills` sau khi sửa bảng gộp để đồng bộ lại kỹ năng của tin đã nhập)
   (`labeling/skill_merge.json`) rồi nhập tin tuyển dụng. Tin gán vào công ty demo
   không còn trong hệ thống được chia đều cho các công ty demo còn lại.
2. `scripts/generate_cvs.py`, rồi `scripts/enrich_cvs.py`: sinh CV (cần Ollama).
3. `scripts/import_cvs.py --apply`, rồi `--pdf-twins --apply`: đưa CV vào hệ
   thống, xuất PDF.
4. `scripts/smoke_mps.py`: kiểm tra môi trường huấn luyện.
5. `scripts/extract_check.py`, `scripts/baseline.py`: số liệu thư viện PDF và baseline.
6. `scripts/build_gold_pairs.py`: phiếu chấm tập vàng đợt 1 (cần mô hình e5 đã tải;
   không ghi đè phiếu đã có). `--extend` ghép đợt 2 (15 tin thêm) vào
   `labeling/gold_pairs_2.xlsx`. `scripts/merge_gold_passes.py` gộp hai lượt gán nhãn
   độc lập của đợt 2 (`labeling/gold_pairs_2_passes.json`) thành
   `labeling/gold_pairs_claude_2.xlsx` và báo cáo đồng thuận.
7. `scripts/export_profiles.py`, rồi `scripts/check_profiles.py`: kiểm tra trích xuất.
   Với PDF, đáp án chỉ gồm những gì thật sự in trong tệp (kỹ năng, ngoại ngữ, việc có
   ngày bắt đầu), và bậc học theo `labeling/education_key.json`.
8. `scripts/export_model.py`: lưu mô hình cho ml-worker; `scripts/calibrate.py`: đo
   mốc hiệu chuẩn, chép vào `CALIBRATIONS` của backend khi đổi mô hình.
9. `scripts/fetch_public.py`: tải dữ liệu công khai (VietJobs,
   resume-job-description-fit) vào `data/public/` và các mô hình gốc; ghi nguồn, mã
   commit, ngày tải vào `data/public/SOURCES.md`.
10. `scripts/evaluate.py`: đo các phương án trên tập vàng (TF-IDF, BM25, luật
    `profile-rule-v2`, bi-encoder, `hybrid`; `--ablation` đo thêm từng thay đổi của `hybrid-v2`) → `reports/eval_validation.md`. Các dòng
    của sản phẩm do lệnh `matching_evaluate` chạy trong container `ml-worker`, tức
    đúng mã đang phục vụ ứng viên. Phần test chỉ chạy một lần ở giai đoạn nghiệm
    thu (`--split test --final`).

11. `scripts/evaluate_recommendations.py`: đo gợi ý việc làm (CV → tin) trên nhãn yếu,
    so `semantic-v1` với luật `profile-rule-v2` và BM25 → `reports/recommendations.md`.

Các script chạy lại an toàn: bỏ qua phần đã có.

## Sau khi dựng lại DB local

`scripts/reset_local_db.sh` xóa mọi tin, CV và kỹ năng đã nhập. Chạy lại bước 1 và
bước 3 (dữ liệu nguồn vẫn ở `data/`), rồi
`docker compose exec backend python manage.py matching_backfill` để tính lại vector.
Mã tin trong hệ thống đổi, nên `data/jd/jd_import_map.json` được ghi lại.
