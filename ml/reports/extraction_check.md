# Kiểm tra trích xuất hồ sơ CV

Đối chiếu `profile_json` với nhãn của `manifest.json` và nội dung JSON gốc.
Số tháng kinh nghiệm tính là đúng khi lệch ≤ 3 tháng; với PDF, đáp án là
số tháng của các việc thật sự in trong tệp (PDF TopCV bị rơi việc đang làm khi tạo).
Học vấn: CV builder so với trường bậc học của CV; PDF so với bậc học theo đúng chữ in ở
tên bằng (`ml/labeling/education_key.json`), vì trường `degree_level` của CV tổng hợp lệch
với tên bằng ở 53/100 CV. Hai CV có tên bằng không nói rõ bậc không tính vào tỷ lệ.
"Bằng chứng không có trong CV" phải bằng 0 (quy tắc không bịa).
Tạo bằng `ml/scripts/check_profiles.py`.

Kỹ năng và ngoại ngữ của PDF chỉ tính những mục thật sự in trong tệp: mẫu TopCV bỏ hẳn mục
kỹ năng hoặc ngoại ngữ ở một số CV (cột "Kỹ năng không in trong tệp").

Chức danh: số CV có chức danh trùng đúng headline của CV gốc; trong ngoặc là số CV có chức danh
(chức danh khác headline thường là chức danh của việc gần nhất).

| Nguồn | Số CV | Recall kỹ năng | Kỹ năng không in trong tệp | Kỹ năng khai báo ngoài manifest | Kinh nghiệm đúng | Học vấn đúng | Ngôn ngữ đúng | Chức danh | Bằng chứng không có trong CV |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| CV builder | 100 | 100.0% (508/508) | 1 | 0 | 100% | 100% | 100% | 100/100 (có 100) | 0 |
| CV tải lên (PDF hệ thống) | 15 | 96.2% (76/79) | 0 | 0 | 93% | 100% | 100% | 15/15 (có 15) | 0 |
| PDF TopCV | 36 | 98.9% (180/182) | 41 | 0 | 100% | 97% | 94% | 29/36 (có 34) | 0 |

## Lệch ở CV tải lên (PDF hệ thống) (3 CV)

- `CV-045`: tháng None (đúng 0, theo —)
- `CV-056`: sót kỹ năng: quản lý dự án
- `CV-059`: sót kỹ năng: logistic, xử lý tình huống

## Lệch ở PDF TopCV (4 CV)

- `CV-053`: ngôn ngữ lệch
- `CV-058`: học vấn — (đúng intermediate)
- `CV-067`: sót kỹ năng: bán hàng
- `CV-086`: ngôn ngữ lệch; sót kỹ năng: cloud native architecture

## Hồ sơ tin tuyển dụng

- 100/100 tin trích xuất được; lỗi: 0.
- Ngôn ngữ nhận diện khác ngôn ngữ ghi lúc nhập: 0 [].
- Tin không có chunk yêu cầu: 0 [].
- Kỹ năng được đếm mỗi tin: trung bình 5.98; 44 kỹ năng nhóm "Phẩm chất cá nhân" bị loại khỏi điểm.
- Chunk mỗi tin: trung bình 24.8.
- Tiêu chí tin không khai: không có.

Kỹ năng khai báo ngoài manifest (để rà nhận nhầm):

—
