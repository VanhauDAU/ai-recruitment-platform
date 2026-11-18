# Rubric chấm độ phù hợp CV–JD (đã chốt 18/11/2026)

Dùng để gán nhãn tay 150 cặp CV–JD làm tập đánh giá. Người chấm đọc một tin
tuyển dụng và một CV rồi cho một điểm từ 0 đến 4. Chốt rubric trước khi chấm cặp
đầu tiên; sau đó không sửa định nghĩa các mức.

## Câu hỏi khi chấm

> Nếu tôi là người sàng lọc hồ sơ cho đúng tin này, hồ sơ này đáng được xem xét
> đến mức nào, chỉ xét về chuyên môn?

Chỉ xét kỹ năng, kinh nghiệm, học vấn và cấp bậc. Không xét địa điểm làm việc,
giới tính, tuổi, ảnh, tên trường, cách trình bày CV, lương mong muốn.

## Thang điểm

| Điểm | Tên mức | Điều kiện | Quyết định tương ứng |
| --- | --- | --- | --- |
| 4 | Rất phù hợp | Đúng vị trí chuyên môn; có gần hết kỹ năng cần có (từ khoảng 80%); đủ số năm kinh nghiệm và đúng loại công việc; cấp bậc khớp | Mời phỏng vấn ngay |
| 3 | Phù hợp | Đúng vị trí chuyên môn; thiếu 1–2 kỹ năng cần có không phải cốt lõi, hoặc thiếu một bậc kinh nghiệm | Đáng mời phỏng vấn |
| 2 | Phù hợp một phần | Vị trí gần (cùng mảng); có khoảng một nửa kỹ năng cần có, hoặc đủ kỹ năng nhưng lệch rõ về kinh nghiệm hay cấp bậc | Dự phòng |
| 1 | Ít phù hợp | Cùng nhóm ngành nhưng khác vị trí; chỉ có vài kỹ năng dùng lại được | Không mời |
| 0 | Không phù hợp | Khác ngành, gần như không có điểm chung | Loại |

## Quy tắc phân xử

- **Kỹ năng được đếm** là kỹ năng chuyên môn và kỹ năng mềm thể hiện được qua
  việc đã làm (giao tiếp, đàm phán, thuyết trình…). Không đếm phẩm chất cá nhân
  (trung thực, cẩn thận, chăm chỉ, chịu áp lực… — nhóm "Phẩm chất cá nhân" trong
  danh mục kỹ năng), dù tin có ghi trong Kỹ năng cần có.
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

## Quyết định đã chốt (18/11/2026)

| Điểm | Quyết định | Lý do |
| --- | --- | --- |
| Ngưỡng mức 4 | Giữ 80% kỹ năng cần có (được đếm) | Tin trung bình có 5 kỹ năng cần có: thiếu tối đa 1 kỹ năng; tách rõ với mức 3 |
| Địa điểm làm việc | Không tính vào nhãn | CV tổng hợp và CV đã ẩn danh không có nơi ở; khi đo, tắt tiêu chí địa điểm của hệ thống để so cùng điều kiện |
| Thừa trình độ | CV cao hơn tin từ hai bậc trở lên: trừ tối đa 1 điểm | Khớp thực tế tuyển dụng và tiêu chí Cấp bậc của hệ thống (lệch hai chiều đều giảm điểm) |
| Phẩm chất cá nhân | Không đếm khi tính tỷ lệ kỹ năng đáp ứng | CV hiếm khi ghi các mục này nên sẽ luôn bị coi là thiếu; hệ thống loại nhóm "Phẩm chất cá nhân" khi chấm |

Từ đây không sửa định nghĩa các mức; nếu buộc phải sửa thì chấm lại toàn bộ các
cặp đã chấm.

## Làm rõ cách áp dụng (18/11/2026, trước khi gán nhãn)

Không đổi định nghĩa các mức; chỉ làm rõ ba chỗ hay phân vân.

| Tình huống | Cách chấm |
| --- | --- |
| Kỹ năng tương đương | Chỉ tính khi rất gần, dùng thay nhau được ngay (MySQL ↔ PostgreSQL, Jest ↔ Mocha). Khác framework dù cùng vai trò (ReactJS ↔ Vue, Java ↔ C#) không tính |
| Thiếu kinh nghiệm, đúng vị trí và đủ kỹ năng | Thiếu chưa tới một nửa số năm tin yêu cầu là "thiếu một bậc" (mức 3); thiếu từ một nửa trở lên là "lệch rõ" (mức 2) |
| Bậc học thấp hơn yêu cầu | Trừ tối đa 1 điểm |

## Làm rõ sau đợt gán nhãn đầu (18/11/2026)

Đợt đầu cho thấy năm người gán (cùng một hướng dẫn) xử lý khác nhau một số tình
huống, nên người làm đồ án chốt thêm (A) và chấm lại toàn bộ 150 cặp theo đó. Các
quy tắc phụ (B) do Claude đề xuất để đồng nhất.

| | Tình huống | Cách chấm |
| --- | --- | --- |
| A1 | Kỹ năng cốt lõi | Theo vai trò của tin: kỹ năng định nghĩa vị trí (tiêu đề, yêu cầu chính). Công cụ chung (Word, Excel, Tin học văn phòng) và kỹ năng mềm không bao giờ là cốt lõi trừ khi tiêu đề nêu đích danh; thứ tự trong danh sách không quyết định. Tiêu đề nêu các lựa chọn ("NodeJS/PHP/Go") thì có một lựa chọn là đủ |
| A2 | Đúng vị trí nhưng dưới một nửa kỹ năng cần có | Mức nền 2 |
| A3 | Điểm trừ | Không đưa CV cùng nhóm ngành xuống 0. Ngoại ngữ bắt buộc: trừ 1 khi CV không ghi hoặc ghi thấp hơn mức yêu cầu |
| A4 | Suy ra kỹ năng | Khi rõ ràng: kỹ năng mềm thể hiện qua việc đã làm, kỹ năng bao trùm (Tin học văn phòng → Word/Excel), SDK của nền tảng CV làm nhiều năm, chứng chỉ chuyên môn. Không suy từ gợi ý mơ hồ |
| B1 | Ngưỡng mức 4 | Thiếu tối đa 1 kỹ năng được đếm, không thiếu cốt lõi |
| B2 | Yêu cầu có "hoặc"/"tương đương" | Có một lựa chọn là đáp ứng |
| B3 | Kinh nghiệm | Chỉ tính mục Kinh nghiệm; thiếu ≤ 1 tháng coi như đủ |
| B4 | Học vấn của tin | Là bậc tối thiểu; "Sinh viên" thấp hơn bậc đang học một bậc |
| B5 | Thừa trình độ | Chỉ xét cấp bậc chức danh, từ 2 bậc trở lên |
| B6 | Nhóm ngành (0 hay 1) | CNTT phần mềm; Kinh doanh – Marketing – CSKH – Telesales – Content; Kế toán – Kiểm toán – Thuế – Tài chính; Hành chính – Nhân sự – Lễ tân – Thư ký; Thiết kế – Media gần với Content |

Đợt chốt cuối (cũng ngày 18/11), sau lần chấm lại thứ hai:

| | Tình huống | Cách chấm |
| --- | --- | --- |
| C1 | Đúng nghề, vừa dưới nửa kỹ năng vừa thiếu từ nửa số năm (kể cả 0 tháng) | Mức nền 1 |
| C2 | Thiếu 1–2 kỹ năng không cốt lõi và thiếu một bậc kinh nghiệm | 2 (cộng dồn) |
| C3 | Telesales | Cùng nghề với Sales/Kinh doanh; vị trí gần với CSKH và Business Development |
| C4 | Thẻ kỹ năng thay thế nhau ("hoặc", "ít nhất một trong", Excel ↔ Google Sheets) | Gộp thành một yêu cầu |
| D1 | Backend cho tin Fullstack | Vị trí gần |
| D2 | Thiết kế nội thất cho tin Content | Khác ngành |
| D3 | "Manager/Lead dẫn nhóm" không ghi rõ cấp | Trưởng nhóm |
| D4–D5 | Testing | "Thực hiện test case" + ISTQB là có Viết test case; Automation không thay thẻ Manual Testing |
| D6 | Vị trí gần | Tối đa 2 |
| D7 | Vị trí của CV | Theo chức danh trong mục Kinh nghiệm, không có thì theo headline |
| D8 | Đúng một nửa kỹ năng và thiếu hẳn kinh nghiệm | Cộng dồn như C1: 1 |

Kết quả (18/11/2026): 150 nhãn, phân bố 0: 38, 1: 61, 2: 29, 3: 14, 4: 8; mọi cặp
"chắc" sau ba đợt (đợt đầu, chấm lại theo A–B, chấm lại theo C–D). Nhãn ở
`gold_pairs_claude.xlsx` (cột `annotator = claude`).

## Người gán nhãn

Tập vàng 150 cặp do mô hình ngôn ngữ (Claude) gán theo rubric này, chỉ dựa trên
nội dung tin và CV (không xem điểm hệ thống hay nguồn ghép cặp); các cặp phân vân
được hỏi lại người làm đồ án. Người làm đồ án chấm mù 30 cặp (2 cặp mỗi tin) để đo
độ đồng thuận (quadratic weighted kappa). Báo cáo trình bày đúng như vậy.
