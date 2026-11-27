# Hiệu chỉnh `e5-base-zs-v1` trên tập hiệu chỉnh có nhãn

321 cặp của 14 tin không có trong dữ liệu huấn luyện; nhãn 0–4 theo rubric.
Tạo bằng `ml/scripts/calibrate_labeled.py`.

| Phép so | Spearman với nhãn | AUC (nhãn 3–4 so với 0–1) | `low` (trung vị nhãn 0) | `high` (phân vị 90 nhãn 3–4) |
| --- | ---: | ---: | ---: | ---: |
| Toàn văn | 0,685 | 0,917 | 0,819 | 0,886 |
| Chức danh | 0,647 | 0,902 | 0,803 | 0,913 |

## Cosine trung vị theo nhãn

| Phép so | Nhãn 0 | Nhãn 1 | Nhãn 2 | Nhãn 3 | Nhãn 4 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Toàn văn | 0,819 | 0,826 | 0,859 | 0,861 | 0,869 |
| Chức danh | 0,803 | 0,817 | 0,859 | 0,875 | 0,887 |

Mục cho `CALIBRATIONS` (`backend/apps/matching/domain/calibration.py`):

    'e5-base-zs-v1': Calibration(document=(0.819, 0.886), title=(0.803, 0.913), ...)
