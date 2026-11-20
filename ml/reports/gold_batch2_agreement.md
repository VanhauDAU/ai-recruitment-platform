# Đợt 2 tập vàng: độ đồng thuận giữa hai lượt gán nhãn

150 cặp (15 tin × 10 CV), hai lượt gán độc lập, cùng là Claude và cùng rubric
(`ml/labeling/rubric.md`), mỗi lượt chỉ đọc nội dung tin và CV. Đây là độ nhất quán
của một kiểu người gán với chính nó, không thay cho kiểm chứng của người.
Tạo bằng `ml/scripts/merge_gold_passes.py`.

- Trùng tuyệt đối: 142/150 (95%).
- Lệch không quá 1 mức: 150/150 (100%).
- Kappa có trọng số bậc hai: 0,979.
- 8 cặp lệch do một lượt phân xử thứ ba (cũng là Claude) quyết định sau khi đọc lại cặp và lý do của hai lượt.

## Bảng nhầm lẫn (hàng: lượt A, cột: lượt B)

| A \ B | 0 | 1 | 2 | 3 | 4 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 0 | 48 | 0 | 0 | 0 | 0 |
| 1 | 0 | 65 | 1 | 0 | 0 |
| 2 | 0 | 4 | 15 | 1 | 0 |
| 3 | 0 | 0 | 0 | 3 | 0 |
| 4 | 0 | 0 | 0 | 2 | 11 |

## Nhãn cuối

Số cặp theo nhãn 0–4: 48, 67, 19, 4, 12.
