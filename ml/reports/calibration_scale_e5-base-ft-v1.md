# Dò mốc thang điểm cho `e5-base-ft-v1` trên tập hiệu chỉnh

321 cặp có nhãn của 14 tin, chấm bằng công thức đầy đủ của sản phẩm. Tạo bằng `ml/scripts/calibrate_scale.py`.

| Mốc | Toàn văn | Chức danh | Kappa | Spearman | NDCG@5 | Nhãn 0: trung vị | cao nhất | từ 50 | Điểm trung bình theo nhãn 0→4 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| low = nhãn 0, high = P75 | 0.132 – 0.717 | 0.338 – 0.804 | 0,822 | 0,840 | 0,955 | 6 | 63 | 1 | 9 / 27 / 68 / 78 / 88 |
| low = nhãn 0, high = P90 | 0.132 – 0.809 | 0.338 – 0.84 | 0,826 | 0,838 | 0,955 | 5 | 61 | 1 | 9 / 26 / 66 / 76 / 85 |
| low = giữa nhãn 0 và 1, high = P75 | 0.243 – 0.717 | 0.392 – 0.804 | 0,828 | 0,831 | 0,942 | 1 | 61 | 1 | 6 / 22 / 66 / 77 / 86 |
| low = giữa nhãn 0 và 1, high = P90 | 0.243 – 0.809 | 0.392 – 0.84 | 0,811 | 0,830 | 0,938 | 1 | 58 | 1 | 6 / 21 / 63 / 74 / 83 |
| low = nhãn 1, high = P75 | 0.354 – 0.717 | 0.446 – 0.804 | 0,808 | 0,814 | 0,936 | 0 | 54 | 1 | 4 / 17 / 63 / 75 / 84 |
| low = nhãn 1, high = P90 | 0.354 – 0.809 | 0.446 – 0.84 | 0,791 | 0,813 | 0,935 | 0 | 49 | 0 | 4 / 16 / 60 / 73 / 80 |

Chọn: **low = nhãn 1, high = P90** (kappa cao nhất trong các phương án giữ được điều kiện của nhãn 0).

    'e5-base-ft-v1': Calibration(document=(0.354, 0.809), title=(0.446, 0.84), ...)
