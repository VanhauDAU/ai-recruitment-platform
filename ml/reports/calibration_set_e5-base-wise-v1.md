# Hiệu chỉnh `e5-base-wise-v1` trên tập hiệu chỉnh có nhãn

321 cặp của 14 tin không có trong dữ liệu huấn luyện; nhãn 0–4 theo rubric.
Tạo bằng `ml/scripts/calibrate_labeled.py`.

| Phép so | Spearman với nhãn | AUC (nhãn 3–4 so với 0–1) | `low` (trung vị nhãn 0) | `high` (phân vị 90 nhãn 3–4) |
| --- | ---: | ---: | ---: | ---: |
| Toàn văn | 0,808 | 0,950 | 0,204 | 0,772 |
| Chức danh | 0,711 | 0,918 | 0,530 | 0,851 |

## Cosine trung vị theo nhãn

| Phép so | Nhãn 0 | Nhãn 1 | Nhãn 2 | Nhãn 3 | Nhãn 4 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Toàn văn | 0,204 | 0,374 | 0,638 | 0,661 | 0,651 |
| Chức danh | 0,530 | 0,597 | 0,731 | 0,798 | 0,816 |

Mục cho `CALIBRATIONS` (`backend/apps/matching/domain/calibration.py`):

    'e5-base-wise-v1': Calibration(document=(0.204, 0.772), title=(0.530, 0.851), ...)
