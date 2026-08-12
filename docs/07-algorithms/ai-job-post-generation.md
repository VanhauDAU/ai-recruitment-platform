# Kiến trúc AI tạo tin tuyển dụng

## Quyết định V1

Dùng Gemini qua SDK `google-genai` với structured output; không train model ở
V1. Provider adapter nằm trong `ai_core`, còn prompt/schema/taxonomy/policy của
tin tuyển dụng thuộc `jobs`. Cách tách này cho phép dùng cùng runtime cho CV,
matching hoặc interview sau này mà không biến các use case thành phụ thuộc lẫn
nhau.

Luồng chuẩn:

```text
brief hoặc JD đã sanitize
  → policy/quota/idempotency
  → prompt + JSON schema có version
  → Gemini Developer API hoặc Vertex adapter
  → schema validation
  → resolve taxonomy từ catalog hiện hữu
  → suggestion owner-scoped
  → NTD review/bổ sung trường thủ công
  → lưu Job với provenance rõ ràng
```

Model không được phát minh taxonomy hoặc business commitment. ID catalog được
resolve deterministic sau inference; field ngoài allowlist bị loại. Company
context chỉ dùng hồ sơ đã duyệt và đã loại contact/PII.

## Hợp đồng output

AI có thể đề xuất title, description, requirements, category/domain, level,
employment/work type, education, experience và taxonomy đã resolve. Với brief
chỉ có chức danh, description và requirements được phép dùng nội dung nghề
nghiệp phổ quát để tạo một bản nháp có thể chỉnh sửa; không được biến suy đoán
thành cam kết riêng của công ty. Benefits chỉ được đề xuất khi có bằng chứng
trong input/company context. Các trường lương, địa điểm, lịch, deadline, số
lượng, campaign, nhận hồ sơ, auto-reject, tuổi và giới tính không thuộc schema
suggestion.

Từ `job-post-v2`, schema yêu cầu tối thiểu ba bullet mô tả và ba bullet yêu cầu.
Một result thiếu hai phần cốt lõi này được retry trong giới hạn tối đa hai
provider call, sau đó chuyển sang trạng thái lỗi thay vì báo hoàn tất giả.

Mỗi invocation ghi provider/model, use case, prompt/schema version, phase,
latency, token, chi phí ước tính và error code chuẩn hóa; không ghi raw prompt.

## Khi nào mới train

Chỉ cân nhắc Vertex fine-tuning khi:

1. có ≥300 cặp opt-in được reviewer duyệt và quyền sử dụng rõ ràng;
2. tách train/validation/holdout theo company, chống leakage và near-duplicate;
3. baseline prompt + structured output đã tối ưu nhưng vẫn không đạt mục tiêu;
4. model tuned thắng holdout về quality đồng thời không làm xấu safety, schema,
   latency và cost;
5. có model registry, rollback, deletion/retention và quy trình retrain.

Trước mốc đó, ưu tiên eval, prompt/schema versioning, catalog resolver, cache
policy, batching offline cho eval và quan sát token/cost. Đây là các tối ưu dễ
đưa production và tái sử dụng hơn fine-tuning sớm.
