# Hiệu chỉnh `e5-base-ft-v1` trên tập hiệu chỉnh có nhãn

321 cặp của 14 tin không có trong dữ liệu huấn luyện; nhãn 0–4 theo rubric.
Tạo bằng `ml/scripts/calibrate_labeled.py`.

| Phép so | Spearman với nhãn | AUC (nhãn 3–4 so với 0–1) | `low` (trung vị nhãn 0) | `high` (phân vị 90 nhãn 3–4) |
| --- | ---: | ---: | ---: | ---: |
| Toàn văn | 0,743 | 0,925 | 0,132 | 0,809 |
| Chức danh | 0,723 | 0,916 | 0,338 | 0,840 |

## Cosine trung vị theo nhãn

| Phép so | Nhãn 0 | Nhãn 1 | Nhãn 2 | Nhãn 3 | Nhãn 4 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Toàn văn | 0,132 | 0,354 | 0,620 | 0,643 | 0,605 |
| Chức danh | 0,338 | 0,446 | 0,661 | 0,734 | 0,775 |

Mục cho `CALIBRATIONS` (`backend/apps/matching/domain/calibration.py`):

    'e5-base-ft-v1': Calibration(document=(0.132, 0.809), title=(0.338, 0.840), ...)
