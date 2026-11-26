# Cổng chất lượng kho CV huấn luyện

1073 CV sinh bằng `qwen2.5:7b` cho 70 tin ngoài tập vàng; 784 CV qua cổng (73%). Tạo bằng `ml/scripts/quality_gate.py`.

CV qua cổng theo mức khớp dự kiến: strong 411, partial 205, adjacent 168.

| Lý do bị loại | Số CV |
| --- | ---: |
| phần chữ thiếu kỹ năng đã chọn | 204 |
| CV vị trí gần mang chức danh của tin neo | 50 |
| gạch đầu dòng lặp nguyên văn | 33 |
| chữ dính, lẫn hai ngôn ngữ | 16 |
| chưa bổ sung ngoại ngữ và mục phụ | 1 |

## Đọc kiểm bằng mắt, lượt 1

Người làm đồ án đọc 40 CV rút ngẫu nhiên từ kho đã qua cổng lúc đó và ghi mọi lỗi nhìn thấy, kể cả
lỗi văn phong: 34 CV có ít nhất một lỗi (85%), 6 CV ổn
(`ml/labeling/train_cv_review_round1.md`). Từ các lỗi này cổng được thêm ba kiểm tra (chức danh của CV
vị trí gần, gạch đầu dòng lặp, chữ dính); 2 trong 34 CV có lỗi nay bị cổng loại. Các lỗi còn lại chủ
yếu là số liệu phóng đại, tự nhận quá tầm, chứng chỉ và giải thưởng đáng ngờ: đặc điểm của CV do mô
hình ngôn ngữ viết, cổng không lọc được.
