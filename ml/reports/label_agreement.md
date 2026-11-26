# Độ đồng thuận nhãn người – Claude (50/50 cặp kiểm chứng)

Quadratic weighted kappa: **0.915** (ngưỡng 0.7). Trùng tuyệt đối 78%,
lệch không quá 1 mức 98%. Tạo bằng `ml/scripts/agreement.py`.

Cặp kiểm chứng không rút hoàn toàn ngẫu nhiên: 20 cặp của đợt 2 được rút phân tầng theo nhãn
của Claude để đủ các mức 3–4. Người chấm không biết nhãn, điểm hệ thống hay cách rút.

Người làm đồ án chấm mù trên trang audit_blind.html, tự quyết định điểm và tự ghi lý do cho cả 50 cặp. Bảng tiêu chí trên trang được đánh dấu ở 5 cặp, các cặp còn lại chấm thẳng điểm kèm lý do. 5 cặp đã chấm ngày 18/11 giữ nhãn của lượt đó.

Bảng nhầm lẫn (hàng: người, cột: Claude):

| | 0 | 1 | 2 | 3 | 4 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 0 | 11 | 0 | 0 | 0 | 0 |
| 1 | 0 | 11 | 2 | 0 | 0 |
| 2 | 0 | 4 | 9 | 1 | 0 |
| 3 | 0 | 0 | 1 | 3 | 2 |
| 4 | 0 | 0 | 1 | 0 | 5 |

Cặp lệch từ 2 mức (1):

- #147 (JD-26, CV-034): người 4, Claude 2
