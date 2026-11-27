# Hiệu chỉnh `e5-base-wise-v2` trên tập hiệu chỉnh có nhãn

321 cặp của 14 tin không có trong dữ liệu huấn luyện; nhãn 0–4 theo rubric.
Tạo bằng `ml/scripts/calibrate_labeled.py`.

| Phép so | Spearman với nhãn | AUC (nhãn 3–4 so với 0–1) | `low` (trung vị nhãn 0) | `high` (phân vị 90 nhãn 3–4) |
| --- | ---: | ---: | ---: | ---: |
| Toàn văn | 0,806 | 0,950 | 0,171 | 0,766 |
| Chức danh | 0,706 | 0,916 | 0,559 | 0,846 |

## Cosine trung vị theo nhãn

| Phép so | Nhãn 0 | Nhãn 1 | Nhãn 2 | Nhãn 3 | Nhãn 4 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Toàn văn | 0,171 | 0,367 | 0,664 | 0,673 | 0,669 |
| Chức danh | 0,559 | 0,618 | 0,765 | 0,804 | 0,817 |

Mục cho `CALIBRATIONS` (`backend/apps/matching/domain/calibration.py`):

    'e5-base-wise-v2': Calibration(document=(0.171, 0.766), title=(0.559, 0.846), ...)
