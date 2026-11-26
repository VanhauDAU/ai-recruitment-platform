# Cổng chất lượng kho CV huấn luyện

1073 CV sinh bằng `qwen2.5:7b` cho 70 tin ngoài tập vàng; 649 CV qua cổng (60%). Tạo bằng `ml/scripts/quality_gate.py`.

CV qua cổng theo mức khớp dự kiến: strong 346, partial 166, adjacent 137.

| Lý do bị loại | Số CV |
| --- | ---: |
| phần chữ thiếu kỹ năng đã chọn | 204 |
| gạch đầu dòng lặp ý | 170 |
| CV vị trí gần mang chức danh của tin neo | 50 |
| chữ dính, lẫn hai ngôn ngữ | 42 |
| chưa bổ sung ngoại ngữ và mục phụ | 1 |

## Đọc kiểm bằng mắt, lượt 1

Người làm đồ án đọc 40 CV rút ngẫu nhiên từ kho đã qua cổng lúc đó và ghi mọi lỗi nhìn thấy, kể cả
lỗi văn phong: 34 CV có ít nhất một lỗi (85%), 6 CV ổn
(`ml/labeling/train_cv_review_round1.md`). Từ các lỗi này cổng được thêm ba kiểm tra (chức danh của CV
vị trí gần, gạch đầu dòng lặp, chữ dính); 9 trong 34 CV có lỗi nay bị cổng loại. Các lỗi còn lại chủ
yếu là số liệu phóng đại, tự nhận quá tầm, chứng chỉ và giải thưởng đáng ngờ: đặc điểm của CV do mô
hình ngôn ngữ viết, cổng không lọc được.

## Đọc kiểm bằng mắt, lượt 2

Đọc 40 CV khác, rút từ kho sau ba kiểm tra thêm, chia hai mức lỗi: 11 CV lỗi nặng
(27.5%), 24 CV lỗi nhẹ, 5 CV ổn
(`ml/labeling/train_cv_review_round2.md`). Lỗi nặng theo ghi chú của người đọc: lẫn ngôn ngữ hoặc
chữ hỏng (7 CV, trong đó 4 CV chỉ hỏng ở mục Hoạt động, Giải thưởng, Sở thích), lặp ý giữa các việc
(2 CV), sai mức khớp hoặc nội dung trái nghề (2 CV). Xử lý: bỏ ba mục phụ khỏi văn bản huấn luyện,
hạ ngưỡng lặp, thêm kiểm tra cụm tiếng Anh giữa câu tiếng Việt; 2 trong 11 CV lỗi nặng nay bị
cổng loại. Phần còn lại (chữ hỏng không theo mẫu, chức danh vô nghĩa, sai mức khớp) cổng không bắt
được; ước khoảng 15% CV của kho còn lỗi nặng, trong đó khoảng 5% là sai nhãn yếu.
