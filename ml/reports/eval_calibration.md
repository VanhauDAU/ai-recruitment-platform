# Công thức trên tập hiệu chỉnh: có và không có cross-encoder

321 cặp có nhãn, bi-encoder `e5-base-wise-v1`. Tạo bằng `ml/scripts/evaluate_calibration.py`.

| Cấu hình | Kappa | Spearman | NDCG@5 | Nhãn 0: trung vị | cao nhất | từ 50 | Điểm trung bình theo nhãn 0→4 | Tiêu chí kỹ năng: Spearman với nhãn |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| không có cross-encoder | 0,832 | 0,842 | 0,935 | 5 | 63 | 1 | 9 / 26 / 67 / 77 / 87 | 0,773 |
| có cross-encoder `req-ce-v1` | 0,825 | 0,842 | 0,933 | 6 | 63 | 1 | 10 / 28 / 68 / 78 / 88 | 0,773 |
| cross-encoder, thêm độ phủ yêu cầu vào mức liên quan | 0,828 | 0,835 | 0,937 | 8 | 57 | 1 | 11 / 28 / 65 / 75 / 83 | 0,773 |
| cross-encoder, không dùng để nhận kỹ năng | 0,832 | 0,842 | 0,935 | 5 | 63 | 1 | 9 / 26 / 67 / 77 / 87 | 0,773 |
