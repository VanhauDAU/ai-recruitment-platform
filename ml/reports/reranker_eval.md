# Cross-encoder trên cặp yêu cầu – câu CV thật

358 cặp có nhãn (`ml/reports/requirement_labels.md`): phần calibration 215 cặp để chọn ngưỡng,
phần validation 143 cặp để báo cáo. Tạo bằng `ml/scripts/evaluate_reranker.py`.

## Phần calibration

| Cách chấm | AUC đạt so với không đạt | AUC đạt so với còn lại | Average precision của "đạt" |
| --- | ---: | ---: | ---: |
| cross-encoder `req-ce-v1` | 0,975 | 0,939 | 0,815 |
| cross-encoder gốc (chưa huấn luyện) | 0,927 | 0,885 | 0,691 |
| bi-encoder `e5-base-zs-v1` (cosine) | 0,817 | 0,775 | 0,529 |
| bi-encoder `e5-base-wise-v1` (cosine) | 0,914 | 0,860 | 0,637 |

## Phần validation

| Cách chấm | AUC đạt so với không đạt | AUC đạt so với còn lại | Average precision của "đạt" |
| --- | ---: | ---: | ---: |
| cross-encoder `req-ce-v1` | 0,956 | 0,942 | 0,890 |
| cross-encoder gốc (chưa huấn luyện) | 0,909 | 0,885 | 0,734 |
| bi-encoder `e5-base-zs-v1` (cosine) | 0,802 | 0,769 | 0,632 |
| bi-encoder `e5-base-wise-v1` (cosine) | 0,924 | 0,884 | 0,763 |

## Ngưỡng của `req-ce-v1`

Chọn trên phần calibration: "đạt" từ 0,853 (ngưỡng thấp nhất có precision từ 0,85); "có liên quan" từ 0,063.

| Phần | Precision của "đạt" | Recall của "đạt" | Số cặp được phán "đạt" |
| --- | ---: | ---: | ---: |
| calibration | 0,867 | 0,591 | 30 |
| validation | 0,947 | 0,562 | 19 |

Bảng nhầm lẫn trên phần validation (hàng: nhãn, cột: mô hình phán):

| | không đạt | có liên quan | đạt |
| --- | ---: | ---: | ---: |
| unmet | 68 | 20 | 0 |
| partial | 11 | 11 | 1 |
| met | 1 | 13 | 18 |
