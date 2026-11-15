# Rubric chấm độ phù hợp CV–JD (bản nháp, chờ bạn chốt)

Dùng để gán nhãn tay 150 cặp CV–JD làm tập đánh giá. Người chấm đọc một tin
tuyển dụng và một CV rồi cho một điểm từ 0 đến 4. Chốt rubric trước khi chấm cặp
đầu tiên; sau đó không sửa định nghĩa các mức.

## Câu hỏi khi chấm

> Nếu tôi là người sàng lọc hồ sơ cho đúng tin này, hồ sơ này đáng được xem xét
> đến mức nào, chỉ xét về chuyên môn?

Chỉ xét kỹ năng, kinh nghiệm, học vấn và cấp bậc. Không xét giới tính, tuổi,
ảnh, tên trường, cách trình bày CV, lương mong muốn.

## Thang điểm

| Điểm | Tên mức | Điều kiện | Quyết định tương ứng |
| --- | --- | --- | --- |
| 4 | Rất phù hợp | Đúng vị trí chuyên môn; có gần hết kỹ năng cần có (từ khoảng 80%); đủ số năm kinh nghiệm và đúng loại công việc; cấp bậc khớp | Mời phỏng vấn ngay |
| 3 | Phù hợp | Đúng vị trí chuyên môn; thiếu 1–2 kỹ năng cần có không phải cốt lõi, hoặc thiếu một bậc kinh nghiệm | Đáng mời phỏng vấn |
| 2 | Phù hợp một phần | Vị trí gần (cùng mảng); có khoảng một nửa kỹ năng cần có, hoặc đủ kỹ năng nhưng lệch rõ về kinh nghiệm hay cấp bậc | Dự phòng |
| 1 | Ít phù hợp | Cùng nhóm ngành nhưng khác vị trí; chỉ có vài kỹ năng dùng lại được | Không mời |
| 0 | Không phù hợp | Khác ngành, gần như không có điểm chung | Loại |

## Quy tắc phân xử

- **Kỹ năng cốt lõi** là kỹ năng nằm trong tiêu đề tin hoặc đứng đầu mục yêu cầu.
  CV thiếu kỹ năng cốt lõi thì tối đa 2 điểm.
- **Kỹ năng tương đương** được tính là có (ví dụ tin ghi MySQL, CV có
  PostgreSQL), nhưng không quá hai kỹ năng tương đương cho mức 4.
- **Kỹ năng chỉ liệt kê, không có minh chứng** trong kinh nghiệm hay dự án: vẫn
  tính là có, ghi chú "không minh chứng".
- **Thừa trình độ** (CV cao hơn tin từ hai bậc): trừ tối đa một điểm.
- **CV thiếu thông tin**: chấm theo những gì CV viết, không suy đoán thêm.
- **Lệch ngôn ngữ** giữa CV và tin: không trừ điểm, trừ khi tin yêu cầu ngoại
  ngữ mà CV không thể hiện.
- **Phân vân giữa hai mức**: chọn mức thấp hơn và đánh dấu "không chắc".

## Trình tự chấm một cặp

1. Đọc tin: gạch chân vị trí, kỹ năng cần có, số năm kinh nghiệm, cấp bậc.
2. Đọc CV: vị trí gần nhất, kỹ năng, tổng thời gian làm việc liên quan.
3. Vị trí có đúng không? Sai hẳn ngành thì 0 hoặc 1 và dừng.
4. Đếm kỹ năng cần có mà CV đáp ứng; kiểm tra kỹ năng cốt lõi.
5. So số năm kinh nghiệm và cấp bậc.
6. Cho điểm theo bảng, ghi một dòng lý do.

## Kỷ luật gán nhãn

- Chấm mù: không xem điểm của hệ thống trước hoặc trong khi chấm.
- Chấm hết 10 CV của một tin rồi mới sang tin khác; thứ tự CV xáo ngẫu nhiên.
- Mỗi phiên không quá 40 cặp.
- Không sửa nhãn sau khi đã xem kết quả mô hình.
- Sau ít nhất 7 ngày, chấm lại 30 cặp mà không xem nhãn cũ để đo độ nhất quán.

## Mỗi cặp ghi những gì

| Cột | Nội dung |
| --- | --- |
| `jd_id` | Mã tin (JD-001) |
| `cv_id` | Mã CV |
| `label` | 0–4 |
| `confidence` | `chắc` hoặc `không chắc` |
| `reason` | Một dòng: thiếu gì, lệch gì |
| `labeled_at` | Ngày chấm |

## Ví dụ neo (viết trước khi chấm)

Trước khi bắt đầu, chọn một tin và viết năm CV mẫu ứng với năm mức, để mỗi lần
phân vân có chỗ đối chiếu. Ví dụ cho tin "Backend Developer (Python/Django), 2
năm kinh nghiệm":

- **4**: 3 năm backend Python/Django, có PostgreSQL và REST API trong dự án.
- **3**: 2 năm backend Python (Flask), có PostgreSQL, chưa dùng Django.
- **2**: 2 năm backend Java/Spring, biết SQL, chưa dùng Python trong công việc.
- **1**: 2 năm kiểm thử phần mềm, có viết script Python.
- **0**: 3 năm kế toán tổng hợp.

## Những điểm bạn cần chốt

- [ ] Ngưỡng "gần hết kỹ năng cần có" ở mức 4: giữ 80% hay đổi?
- [ ] Có tính địa điểm làm việc vào nhãn không? Đề xuất: không, vì nhiều CV
      không ghi nơi ở; khi đo sẽ tắt tiêu chí địa điểm của hệ thống.
- [ ] Thừa trình độ có bị trừ điểm không? Bản nháp: trừ tối đa một điểm.
- [ ] Tin không liệt kê kỹ năng rõ ràng thì dựa vào đâu? Đề xuất: dựa vào các
      dòng trong mục yêu cầu, mỗi dòng tính như một kỹ năng.
