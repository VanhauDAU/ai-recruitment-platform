# Hiệu chỉnh `e5-base-ft-v2` trên tập hiệu chỉnh có nhãn

321 cặp của 14 tin không có trong dữ liệu huấn luyện; nhãn 0–4 theo rubric.
Tạo bằng `ml/scripts/calibrate_labeled.py`.

| Phép so | Spearman với nhãn | AUC (nhãn 3–4 so với 0–1) | `low` (trung vị nhãn 0) | `high` (phân vị 90 nhãn 3–4) |
| --- | ---: | ---: | ---: | ---: |
| Toàn văn | 0,773 | 0,938 | 0,155 | 0,820 |
| Chức danh | 0,709 | 0,910 | 0,382 | 0,825 |

## Cosine trung vị theo nhãn

| Phép so | Nhãn 0 | Nhãn 1 | Nhãn 2 | Nhãn 3 | Nhãn 4 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Toàn văn | 0,155 | 0,383 | 0,675 | 0,687 | 0,645 |
| Chức danh | 0,382 | 0,488 | 0,690 | 0,755 | 0,778 |

Mục cho `CALIBRATIONS` (`backend/apps/matching/domain/calibration.py`):

    'e5-base-ft-v2': Calibration(document=(0.155, 0.820), title=(0.382, 0.825), ...)
