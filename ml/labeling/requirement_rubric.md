# Quy tắc gán nhãn cặp yêu cầu – câu CV (27/11/2026)

Dùng để đo cross-encoder `req-ce-v1` và chọn ngưỡng. Mỗi cặp gồm một câu yêu cầu của
tin tuyển dụng và một câu lấy từ CV. Người gán chỉ thấy hai câu này.

## Câu hỏi

> Chỉ dựa vào câu CV này, có thể nói người viết đáp ứng yêu cầu trên không?

Không suy đoán từ những gì câu không viết. Không xét văn phong, độ dài, số liệu đẹp hay
xấu.

## Ba nhãn

| Nhãn | Khi nào |
| --- | --- |
| `met` (đạt) | Câu CV cho thấy người viết đã làm đúng việc, hoặc dùng đúng công cụ, kỹ năng mà yêu cầu nêu |
| `partial` (có liên quan, chưa đủ) | Câu CV cùng mảng việc với yêu cầu nhưng chưa đủ để nói là đáp ứng |
| `unmet` (không đạt) | Câu CV nói về việc khác; không cho thấy điều yêu cầu cần |

## Quy tắc phân xử

- **Yêu cầu nêu lựa chọn** ("hoặc", "một trong", "như", "tương đương"): câu CV có một
  lựa chọn là `met`.
- **Yêu cầu liệt kê nhiều thứ đều cần** ("Java, Spring Boot và MySQL"): câu CV thể hiện
  từ một nửa số thứ trở lên là `met`; ít hơn một nửa là `partial`; không thứ nào là
  `unmet`.
- **Công cụ tương đương**: chỉ tính khi dùng thay nhau được ngay (MySQL với PostgreSQL,
  Jest với Mocha) → `met`. Cùng vai trò nhưng khác hẳn (ReactJS với Vue, Java với C#) →
  `partial`.
- **Yêu cầu nêu việc, câu CV nêu đúng việc đó bằng lời khác** (yêu cầu "chăm sóc khách
  hàng sau bán", CV "giải quyết khiếu nại và duy trì quan hệ với khách đã mua") → `met`.
- **Câu CV chung chung** ("làm việc với nhiều công nghệ hiện đại") → `unmet`, trừ khi
  yêu cầu cũng chung như vậy.
- **Yêu cầu về quy mô hay mức độ** ("quản lý đội từ 10 người"): câu CV cùng việc nhưng
  quy mô nhỏ hơn rõ, hoặc chỉ tham gia một phần → `partial`.
- **Yêu cầu về phẩm chất, thái độ** (chăm chỉ, chịu áp lực): câu CV phải kể một việc cho
  thấy điều đó mới là `met`; chỉ tự nhận thì `unmet`.
- **Khác ngôn ngữ** (yêu cầu tiếng Việt, câu CV tiếng Anh hoặc ngược lại): chấm theo nội
  dung, không trừ.
- **Phân vân giữa hai mức**: chọn mức thấp hơn.

## Ví dụ

| Yêu cầu | Câu CV | Nhãn |
| --- | --- | --- |
| Thành thạo Excel (Pivot, VLOOKUP) | Dùng Pivot và VLOOKUP lập báo cáo doanh thu hằng tuần cho ban giám đốc | `met` |
| Có kinh nghiệm với Docker hoặc Kubernetes | Đóng gói dịch vụ bằng Docker và triển khai lên máy chủ thử nghiệm | `met` |
| Thành thạo ReactJS | Xây giao diện quản trị bằng Vue 3 và Pinia | `partial` |
| Quản lý nhóm kinh doanh từ 10 người | Hướng dẫn hai nhân viên mới trong tháng đầu | `partial` |
| Am hiểu luật thuế và quyết toán thuế | Tuyển dụng 20 nhân viên bán hàng trong quý | `unmet` |
| Có kinh nghiệm viết test tự động | Tham gia các buổi họp nhóm hằng tuần | `unmet` |

## Người gán và cách dùng

Hai lượt gán độc lập do mô hình ngôn ngữ (Claude) thực hiện trên phiếu mù; cặp lệch lấy
mức thấp hơn (`build_requirement_eval.py merge`). Phần `calibration` dùng để chọn
ngưỡng, phần `validation` chỉ để báo cáo. Báo cáo ghi đúng: nhãn do mô hình ngôn ngữ
gán, chưa có người kiểm.
