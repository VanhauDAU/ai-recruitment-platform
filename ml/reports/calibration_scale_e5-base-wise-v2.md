# Dò mốc thang điểm cho `e5-base-wise-v2` trên tập hiệu chỉnh

321 cặp có nhãn của 14 tin, chấm bằng công thức đầy đủ của sản phẩm. Tạo bằng `ml/scripts/calibrate_scale.py`.

| Mốc | Toàn văn | Chức danh | Kappa | Spearman | NDCG@5 | Nhãn 0: trung vị | cao nhất | từ 50 | Điểm trung bình theo nhãn 0→4 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| low = nhãn 0, high = P75 | 0.171 – 0.744 | 0.559 – 0.835 | 0,813 | 0,836 | 0,936 | 5 | 66 | 1 | 10 / 28 / 69 / 79 / 89 |
| low = nhãn 0, high = P90 | 0.171 – 0.766 | 0.559 – 0.846 | 0,821 | 0,836 | 0,936 | 5 | 66 | 1 | 10 / 27 / 68 / 78 / 88 |
| low = giữa nhãn 0 và 1, high = P75 | 0.269 – 0.744 | 0.588 – 0.835 | 0,811 | 0,821 | 0,936 | 1 | 65 | 1 | 7 / 23 / 67 / 77 / 88 |
| low = giữa nhãn 0 và 1, high = P90 | 0.269 – 0.766 | 0.588 – 0.846 | 0,820 | 0,821 | 0,936 | 1 | 64 | 1 | 7 / 22 / 66 / 77 / 87 |
| low = nhãn 1, high = P75 | 0.367 – 0.744 | 0.618 – 0.835 | 0,819 | 0,804 | 0,936 | 0 | 63 | 1 | 5 / 18 / 65 / 76 / 87 |
| low = nhãn 1, high = P90 | 0.367 – 0.766 | 0.618 – 0.846 | 0,812 | 0,803 | 0,936 | 0 | 62 | 1 | 5 / 18 / 64 / 75 / 86 |

Chọn: **low = nhãn 0, high = P90** (kappa cao nhất; không phương án nào giữ được điều kiện "không cặp nhãn 0 nào từ 50 điểm").

    'e5-base-wise-v2': Calibration(document=(0.171, 0.766), title=(0.559, 0.846), ...)
