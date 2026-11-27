# Nhãn của tập hiệu chỉnh

321 cặp của 14 tin ngoài tập vàng, nhãn 0–4 do mô hình ngôn ngữ (Claude) gán
theo `ml/labeling/rubric.md`, không xem mức khớp dự kiến hay nguồn ghép cặp. Tạo bằng
`ml/scripts/build_calibration_pairs.py merge`.

Số cặp theo nhãn 0–4: 89, 118, 43, 29, 42.

## Nhãn yếu của máy sinh so với nhãn theo rubric

| Nhãn yếu | Số cặp | Nhãn 0 | Nhãn 1 | Nhãn 2 | Nhãn 3 | Nhãn 4 | Trung bình |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| strong | 71 | 0 | 1 | 21 | 16 | 33 | 3,14 |
| partial | 33 | 1 | 9 | 10 | 8 | 5 | 2,21 |
| CV của tin khác (same_group) | 60 | 5 | 43 | 5 | 4 | 3 | 1,28 |
| adjacent | 35 | 2 | 30 | 2 | 0 | 1 | 1,09 |
| CV của tin khác (similar) | 66 | 36 | 26 | 3 | 1 | 0 | 0,53 |
| CV của tin khác (random) | 56 | 45 | 9 | 2 | 0 | 0 | 0,23 |
