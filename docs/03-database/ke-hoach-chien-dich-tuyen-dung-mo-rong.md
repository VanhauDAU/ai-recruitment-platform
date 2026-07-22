# Kế hoạch mở rộng chiến dịch tuyển dụng (định hướng sau EMP-P12)

Tài liệu này là **định hướng mở rộng** cho module chiến dịch tuyển dụng và tin
tuyển dụng. Hiện trạng đã triển khai (mô hình dữ liệu, vòng đời tin, pipeline
ứng viên, API/UI) vẫn do
[ke-hoach-chien-dich-va-vong-doi-tin.md](./ke-hoach-chien-dich-va-vong-doi-tin.md)
làm source of truth; tài liệu này không thay đổi hành vi nào đã ship mà trả lời
ba câu hỏi sản phẩm:

1. Mô hình một chiến dịch – một tin có hợp lý lâu dài không?
2. Chiến dịch gồm những gì, khác gì tin tuyển dụng?
3. Nền tảng khác biệt gì so với TopCV/VietnamWorks/ITviec, và về lâu dài có thể
   bán những dịch vụ nào (chỉ liệt kê, chưa triển khai)?

## 1. Đánh giá mô hình 1 chiến dịch – 1 tin

**Kết luận: giữ mô hình 1:1, bổ sung lịch sử các vòng đăng.** Không gỡ
constraint `jobs_one_job_per_campaign` (partial unique trên `jobs.campaign_id`)
và validate ở `EmployerJobWriteSerializer.validate_campaign`.

Lý do giữ:

- Đây chính là mô hình TopCV: chiến dịch là workspace cho **một vị trí cần
  tuyển**, tin đăng là một hoạt động bên trong. Nhà tuyển dụng Việt Nam đã quen
  mental model này.
- Phễu báo cáo mỗi chiến dịch quy về một vị trí duy nhất nên số liệu chuyển
  đổi, headcount mục tiêu/offer đọc được ngay, không phải trộn nhiều vị trí
  khác cấp bậc/lương vào cùng một phễu.
- Nhu cầu "tuyển nhiều vị trí cho một dự án" giải quyết bằng **nhiều chiến
  dịch**, không cần 1:N. Nếu sau này cần nhóm chiến dịch theo dự án thì thêm
  nhãn/nhóm ở tầng trên, rẻ hơn nhiều so với đổi ràng buộc dữ liệu.

Điều kiện để 1:1 không trở thành "vỏ bọc thừa" của tin: chiến dịch phải mang
dữ liệu và thao tác mà tin không có (mục 2). Nếu một màn hình chiến dịch chỉ
lặp lại thông tin của tin thì màn hình đó thiết kế sai, không phải mô hình sai.

## 2. Chiến dịch khác gì tin tuyển dụng

Định vị: **chiến dịch = không gian làm việc riêng tư của recruiter cho một vị
trí cần tuyển; tin tuyển dụng = một kênh thu CV công khai của chiến dịch, có
vòng đời kiểm duyệt riêng.**

| Khía cạnh | Chiến dịch (`recruitment_campaigns`) | Tin tuyển dụng (`jobs_job`) |
| --- | --- | --- |
| Mục đích | Quản trị việc tuyển một vị trí: mục tiêu, tiến độ, phễu, nguồn CV | Truyền thông vị trí ra công khai để thu CV |
| Ai nhìn thấy | Chỉ recruiter sở hữu (nội bộ) | Ứng viên và public khi `active` |
| Vòng đời | `draft → active ⇄ paused → completed`, `cancelled` cuối | `draft → pending → active/rejected → closed`, có duyệt admin |
| Kiểm duyệt | Không cần duyệt, tạo nhanh chỉ bằng tên | Bắt buộc admin duyệt từng lần gửi |
| Dữ liệu riêng | Headcount mục tiêu, ngân sách min/max + nguồn ngân sách, deadline/tuyển liên tục, truy ngược `source_need` | Nội dung JD, lương hiển thị, địa điểm, lịch làm việc, kênh nhận hồ sơ, tier/badge hiển thị |
| Quan hệ với CV | Gom CV từ mọi nguồn của vị trí (hiện tại: từ tin; tương lai: tìm kiếm, đề xuất, mời lại từ pool) | Chỉ CV ứng tuyển trực tiếp vào tin (`Application.job`) |
| Thời gian sống | Dài — sống qua nhiều vòng đăng tin, tới khi tuyển đủ | Ngắn — theo deadline từng lần đăng |

Hệ quả thiết kế đã đúng và cần giữ: dừng chiến dịch không tự đóng tin; xóa tin
nháp không đụng chiến dịch; `duplicate_job` luôn reset `campaign=None`.

### Lịch sử các vòng đăng (bổ sung, không cần bảng mới)

Một chiến dịch sống lâu hơn một lần đăng: tin hết hạn → gia hạn, đóng → mở
lại, bị từ chối → sửa gửi lại. Toàn bộ chu kỳ này đã được audit trong
`job_status_history` (actor employer/admin/system + ghi chú). Việc cần làm chỉ
là **trình bày**: tab Tổng quan của chiến dịch thêm timeline "các vòng đăng"
suy từ chuỗi `pending → active → closed/expired → pending …` của tin liên kết.

Ghi chú tương lai (chưa làm, chưa có lý do kích hoạt): chỉ khi mỗi vòng đăng
cần gắn gói dịch vụ/chi phí riêng (mục 5) mới tách thực thể `job_posting_rounds`.
Trước thời điểm đó, thêm bảng là dư thừa dữ liệu.

## 3. Ba điểm khác biệt so với nền tảng khác

Nguyên tắc kế thừa từ tài liệu gốc: **không hiển thị số liệu trang trí** —
tính năng chỉ bật khi có dữ liệu thật và tiêu chí giải thích được. Mỗi điểm
dưới đây ghi rõ điều kiện dữ liệu tối thiểu.

### 3.1 AI Campaign Copilot — chiến dịch tự nói cho recruiter biết phải làm gì

Các nền tảng hiện tại chỉ *đếm* (bao nhiêu CV, bao nhiêu lượt xem); copilot
*chẩn đoán và gợi ý hành động* ngay trong workspace chiến dịch:

- **Điểm sức khỏe chiến dịch** từ tiêu chí giải thích được, mỗi tiêu chí kèm
  câu diễn giải: tốc độ CV về so với tuổi tin, tỷ lệ chuyển đổi từng bước phễu,
  thời gian recruiter phản hồi CV (`submitted → viewed` đã có timestamp), tiến
  độ offer so với headcount và `target_date`. Điều kiện: chỉ cần dữ liệu
  `applications` + `application_status_history` hiện có.
- **Gợi ý tối ưu JD**: so cấu trúc tin với các tin cùng vị trí chuyên môn có
  tỷ lệ chuyển đổi tốt (thiếu khoảng lương, thiếu kỹ năng, mô tả quá ngắn…).
  Điều kiện: đủ số tin `active` cùng taxonomy để so sánh có nghĩa.
- **Benchmark lương** theo vị trí chuyên môn + cấp bậc + khu vực, tính từ chính
  các tin trên nền tảng. Điều kiện: ngưỡng tối thiểu số tin trong nhóm (ví dụ
  ≥ 20) trước khi hiển thị, dưới ngưỡng thì ẩn hẳn, không ước lượng bừa.
- **Dự đoán thời gian tuyển**: chỉ làm sau cùng, khi đã tích lũy đủ chiến dịch
  `completed` để học phân phối thực tế.

### 3.2 Matching minh bạch hai chiều — cả ứng viên lẫn nhà tuyển dụng cùng thấy

Điểm khớp CV–JD trên các nền tảng khác là hộp đen chỉ phía nhà tuyển dụng
thấy. Nền tảng này (đề tài AI Career Coach) hiển thị **cùng một điểm khớp kèm
giải thích cho cả hai phía**:

- Ứng viên trước khi nộp thấy: khớp k/n kỹ năng bắt buộc, thiếu kỹ năng nào,
  chênh lệch kinh nghiệm/cấp bậc — matching trở thành công cụ coaching ("cần bổ
  sung gì để đạt vị trí này"), đúng tinh thần career coach.
- Recruiter trong pipeline thấy đúng phần giải thích đó để sàng lọc nhanh,
  không phải một con số phần trăm vô căn cứ.
- MVP là **rule-based giải thích được**, tận dụng domain đã có: `JobSkill`
  (importance/weight/min_level), yêu cầu kinh nghiệm/học vấn/ngoại ngữ của tin,
  đối chiếu hồ sơ + CV ứng viên. Chỉ nâng lên semantic/AI khi rule-based đã
  chạy và đo được.

### 3.3 Talent pool theo chiến dịch — không bỏ rơi ứng viên đã từ chối

CV bị từ chối trên nền tảng khác là dữ liệu chết. Ở đây, khi chuyển
`rejected`, recruiter được gợi ý lưu ứng viên vào **pool theo vị trí chuyên
môn** (kèm lý do "tốt nhưng chưa đúng thời điểm"…). Chiến dịch mới cùng vị trí
sẽ gợi ý lại các ứng viên trong pool để mời ứng tuyển (`Application.source`
đã có sẵn giá trị `invited`).

- Phía ứng viên: được biết mình trong danh sách quan tâm của công ty — trải
  nghiệm tích cực hiếm có sau một lần bị từ chối.
- **Điều kiện tiên quyết về consent**: chỉ đưa ứng viên vào pool khi có đồng ý
  rõ ràng. Phải xử lý mục nợ đã ghi nhận về nhãn `recruiter_visibility_consent`
  (nhãn checkbox hiện lệch nghĩa với việc nhà tuyển dụng tìm/lưu hồ sơ) trước
  hoặc ngay trong phase này.
- Liên kết với hai mục sidebar "Quản lý nhãn CV"/"Quản lý yêu cầu kết nối CV"
  đang disabled: pool là workflow thật đầu tiên lấp vào đó.

## 4. Dịch vụ trả phí có thể áp dụng về lâu dài (chỉ liệt kê)

Chưa triển khai bất kỳ mục nào. Hạ tầng catalog marketing đã có ở
`backend/apps/services/` (`ServiceCategory`, `ServicePackage`, `ConsultationLead`);
**điều kiện tiên quyết chung là module billing/entitlement** (mua – ghi nhận
quyền – trừ lượt), đúng nguyên tắc hiện tại: không hiển thị số 0 giả.

| Nhóm | Dịch vụ | Móc nối với hệ thống hiện có |
| --- | --- | --- |
| Hiển thị tin | Nâng tier tin `featured`/`top`; badge `is_hot`/`is_urgent`/`has_flash_badge`; đẩy/làm mới tin lên đầu danh sách | Các field đã tồn tại trên `Job`, hiện admin gán tay; docstring model đã ghi chú chờ gói trả phí |
| Quota đăng tin | Mua thêm lượt gửi duyệt ngoài 3 lượt miễn phí trọn đời | Setting `employer_free_job_quota` + đếm trong `services/posting.py` |
| Tiếp cận ứng viên | Credit tìm kiếm CV trong kho; lượt mở thông tin liên hệ ứng viên | Đã chủ đích defer trong tài liệu gốc, chờ billing + contract quyền riêng tư |
| Gói AI | Sàng lọc CV tự động theo tiêu chí tin; Campaign Copilot nâng cao (benchmark sâu, dự đoán) | Xây trên nền mục 3.1–3.2 sau khi bản miễn phí chạy ổn |
| Thương hiệu | Trang công ty nổi bật, banner trang chủ/trang ngành | Trang công ty + catalogue đã có ở module employers |
| Gói tổng hợp | Combo/subscription theo tháng gộp các quyền lợi trên | `ServicePackage` (benefits JSON, badge, highlight) dùng làm catalog bán |

## 5. Roadmap theo phase

Mỗi phase độc lập, ship xong mới sang phase sau; tiêu chí hoàn thành đo được.

| Phase | Nội dung | Điều kiện/tiêu chí hoàn thành |
| --- | --- | --- |
| CAMP-M1 | Làm giàu workspace chiến dịch: timeline các vòng đăng suy từ `job_status_history`; phễu tách theo `Application.source` (applied/recommended/invited) | Không migration mới; tab Tổng quan hiển thị đúng với chiến dịch có tin đã đóng/mở lại ≥ 2 vòng; test selector report |
| CAMP-M2 | Matching minh bạch hai chiều MVP rule-based: điểm khớp + giải thích từ `JobSkill`/kinh nghiệm/học vấn, hiển thị cho ứng viên trước khi nộp và recruiter trong pipeline | Cùng một engine tính cho hai phía; mọi điểm số đều có dòng giải thích; test unit cho engine + owner-only |
| CAMP-M3 | AI Campaign Copilot MVP: điểm sức khỏe chiến dịch + gợi ý tối ưu JD; benchmark lương chỉ bật khi nhóm đủ ngưỡng mẫu | Mỗi tiêu chí có diễn giải tiếng Việt; dưới ngưỡng dữ liệu thì ẩn, không hiện ước lượng |
| CAMP-M4 | Talent pool theo chiến dịch: lưu ứng viên `rejected` vào pool (có consent), gợi ý + mời lại ở chiến dịch mới cùng vị trí | Đã sửa nhãn/tách consent `recruiter_visibility_consent`; ứng viên rút khỏi pool được; kích hoạt hai mục sidebar Quản lý CV |
| CAMP-M5 | Billing/entitlement + bật dần dịch vụ mục 4 (bắt đầu từ tier tin và quota) | Ledger mua/trừ lượt có audit; chỉ khi đó mới cân nhắc tách `job_posting_rounds` nếu dịch vụ gắn theo vòng đăng |

## 6. Kiểm thử tối thiểu khi triển khai từng phase

- Giữ nguyên toàn bộ bất biến hiện có: constraint một tin mỗi chiến dịch,
  owner-only trên campaign/job/application, ứng viên chỉ thấy timeline đã lọc.
- CAMP-M1: report/timeline đúng với chiến dịch nhiều vòng đăng, chiến dịch chưa
  có tin, tin đã gỡ liên kết.
- CAMP-M2: điểm khớp hai phía cùng giá trị; ứng viên không thấy ghi chú/điểm
  nội bộ của recruiter.
- CAMP-M4: không có consent thì không vào pool; rút consent xóa khỏi pool.
