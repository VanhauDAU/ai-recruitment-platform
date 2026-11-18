# Kiểm tra trích xuất hồ sơ CV

Đối chiếu `profile_json` với nhãn của `manifest.json` và nội dung JSON gốc.
Số tháng kinh nghiệm tính là đúng khi lệch ≤ 3 tháng; với PDF, đáp án là
số tháng của các việc thật sự in trong tệp (PDF TopCV bị rơi việc đang làm khi tạo).
Học vấn so với `degree_level` của manifest; một số CV tổng hợp ghi bằng cấp mâu thuẫn
với trường này (vd. "Bachelor of Science" nhưng `degree_level = college`), bộ trích xuất
đọc theo chữ trên CV nên bị tính là lệch.
"Bằng chứng không có trong CV" phải bằng 0 (quy tắc không bịa).
Tạo bằng `ml/scripts/check_profiles.py`.

| Nguồn | Số CV | Recall kỹ năng | Kỹ năng khai báo ngoài manifest | Kinh nghiệm đúng | Học vấn đúng | Ngôn ngữ đúng | Bằng chứng không có trong CV |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| CV builder | 100 | 100.0% | 0 | 100% | 100% | 100% | 0 |
| CV tải lên (PDF hệ thống) | 15 | 95.6% | 0 | 93% | 60% | 100% | 0 |
| PDF TopCV | 36 | 78.7% | 0 | 72% | 36% | 75% | 0 |

## Lệch ở CV tải lên (PDF hệ thống) (7 CV)

- `CV-022`: học vấn university (đúng college)
- `CV-028`: học vấn university (đúng college)
- `CV-039`: học vấn university (đúng postgraduate)
- `CV-045`: tháng None (đúng 0, theo —)
- `CV-053`: học vấn college (đúng postgraduate)
- `CV-058`: học vấn intermediate (đúng university)
- `CV-059`: học vấn university (đúng high_school)

## Lệch ở PDF TopCV (31 CV)

- `CV-005`: ngôn ngữ lệch
- `CV-008`: học vấn university (đúng postgraduate)
- `CV-011`: ngôn ngữ lệch
- `CV-016`: học vấn university (đúng college)
- `CV-017`: học vấn university (đúng postgraduate)
- `CV-020`: tháng 13 (đúng 37, theo whole_text); học vấn university (đúng postgraduate)
- `CV-022`: học vấn — (đúng college)
- `CV-023`: tháng 78 (đúng 32, theo whole_text); học vấn — (đúng university)
- `CV-025`: tháng 67 (đúng 21, theo whole_text)
- `CV-028`: học vấn university (đúng college)
- `CV-034`: ngôn ngữ lệch
- `CV-043`: tháng 7 (đúng 21, theo section); học vấn college (đúng postgraduate)
- `CV-044`: tháng None (đúng 30, theo —); học vấn university (đúng college); ngôn ngữ lệch
- `CV-046`: học vấn university (đúng college)
- `CV-047`: tháng 11 (đúng 26, theo whole_text); học vấn — (đúng college); ngôn ngữ lệch
- `CV-053`: học vấn college (đúng postgraduate); ngôn ngữ lệch
- `CV-055`: học vấn college (đúng university)
- `CV-058`: học vấn intermediate (đúng university)
- `CV-059`: học vấn university (đúng high_school)
- `CV-065`: ngôn ngữ lệch
- `CV-066`: học vấn university (đúng college)
- `CV-067`: học vấn university (đúng college); ngôn ngữ lệch
- `CV-068`: tháng 36 (đúng 58, theo whole_text)
- `CV-070`: tháng 103 (đúng 57, theo whole_text); học vấn — (đúng university)
- `CV-072`: học vấn high_school (đúng intermediate)
- `CV-077`: học vấn university (đúng postgraduate)
- `CV-082`: tháng 106 (đúng 115, theo section); học vấn university (đúng postgraduate)
- `CV-085`: học vấn college (đúng university)
- `CV-086`: ngôn ngữ lệch
- `CV-090`: tháng None (đúng 20, theo —)
- `CV-100`: học vấn postgraduate (đúng university)

## Hồ sơ tin tuyển dụng

- 100/100 tin trích xuất được; lỗi: 0.
- Ngôn ngữ nhận diện khác ngôn ngữ ghi lúc nhập: 0 [].
- Tin không có chunk yêu cầu: 0 [].
- Kỹ năng được đếm mỗi tin: trung bình 6.03; 39 kỹ năng nhóm "Phẩm chất cá nhân" bị loại khỏi điểm.
- Chunk mỗi tin: trung bình 18.8.
- Tiêu chí tin không khai: không có.

Kỹ năng khai báo ngoài manifest (để rà nhận nhầm):

—
