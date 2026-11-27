# Dò mốc thang điểm cho `e5-base-zs-v1` trên tập hiệu chỉnh

321 cặp có nhãn của 14 tin, chấm bằng công thức đầy đủ của sản phẩm. Tạo bằng `ml/scripts/calibrate_scale.py`.

| Mốc | Toàn văn | Chức danh | Kappa | Spearman | NDCG@5 | Nhãn 0: trung vị | cao nhất | từ 50 | Điểm trung bình theo nhãn 0→4 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| low = nhãn 0, high = P75 | 0.819 – 0.876 | 0.803 – 0.89 | 0,824 | 0,790 | 0,923 | 9 | 65 | 2 | 11 / 24 / 68 / 76 / 88 |
| low = nhãn 0, high = P90 | 0.819 – 0.886 | 0.803 – 0.913 | 0,828 | 0,792 | 0,908 | 7 | 61 | 1 | 10 / 22 / 64 / 72 / 84 |
| low = giữa nhãn 0 và 1, high = P75 | 0.823 – 0.876 | 0.81 – 0.89 | 0,829 | 0,788 | 0,913 | 7 | 64 | 2 | 10 / 23 / 67 / 75 / 87 |
| low = giữa nhãn 0 và 1, high = P90 | 0.823 – 0.886 | 0.81 – 0.913 | 0,832 | 0,789 | 0,902 | 5 | 60 | 1 | 8 / 20 / 63 / 71 / 83 |
| low = nhãn 1, high = P75 | 0.826 – 0.876 | 0.817 – 0.89 | 0,833 | 0,789 | 0,905 | 4 | 63 | 1 | 8 / 21 / 66 / 75 / 87 |
| low = nhãn 1, high = P90 | 0.826 – 0.886 | 0.817 – 0.913 | 0,823 | 0,790 | 0,899 | 3 | 58 | 1 | 7 / 19 / 61 / 71 / 82 |

Chọn: **low = nhãn 1, high = P75** (kappa cao nhất; không phương án nào giữ được điều kiện "không cặp nhãn 0 nào từ 50 điểm").

    'e5-base-zs-v1': Calibration(document=(0.826, 0.876), title=(0.817, 0.89), ...)
