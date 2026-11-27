# Dò mốc thang điểm cho `e5-base-wise-v1` trên tập hiệu chỉnh

321 cặp có nhãn của 14 tin, chấm bằng công thức đầy đủ của sản phẩm. Tạo bằng `ml/scripts/calibrate_scale.py`.

| Mốc | Toàn văn | Chức danh | Kappa | Spearman | NDCG@5 | Nhãn 0: trung vị | cao nhất | từ 50 | Điểm trung bình theo nhãn 0→4 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| low = nhãn 0, high = P75 | 0.204 – 0.713 | 0.53 – 0.836 | 0,824 | 0,843 | 0,952 | 6 | 64 | 1 | 10 / 28 / 69 / 79 / 89 |
| low = nhãn 0, high = P90 | 0.204 – 0.772 | 0.53 – 0.851 | 0,832 | 0,842 | 0,935 | 5 | 63 | 1 | 9 / 26 / 67 / 77 / 87 |
| low = giữa nhãn 0 và 1, high = P75 | 0.289 – 0.713 | 0.564 – 0.836 | 0,829 | 0,829 | 0,939 | 1 | 62 | 1 | 7 / 23 / 67 / 77 / 88 |
| low = giữa nhãn 0 và 1, high = P90 | 0.289 – 0.772 | 0.564 – 0.851 | 0,821 | 0,827 | 0,938 | 1 | 61 | 1 | 7 / 21 / 65 / 75 / 86 |
| low = nhãn 1, high = P75 | 0.374 – 0.713 | 0.597 – 0.836 | 0,816 | 0,811 | 0,939 | 0 | 60 | 1 | 5 / 18 / 64 / 76 / 87 |
| low = nhãn 1, high = P90 | 0.374 – 0.772 | 0.597 – 0.851 | 0,815 | 0,810 | 0,935 | 0 | 56 | 1 | 5 / 17 / 62 / 74 / 84 |

Chọn: **low = nhãn 0, high = P90** (kappa cao nhất; không phương án nào giữ được điều kiện "không cặp nhãn 0 nào từ 50 điểm").

    'e5-base-wise-v1': Calibration(document=(0.204, 0.772), title=(0.53, 0.851), ...)
