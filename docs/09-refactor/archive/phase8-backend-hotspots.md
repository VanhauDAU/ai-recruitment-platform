# Giai đoạn 8 — Dọn backend theo hotspot

**Ngày:** 2026-07-13 · **Trạng thái:** một phần, chỉ xử lý hotspot có use case thật.

## Inventory và quyết định

| Khu vực | Hiện trạng | Quyết định R8 |
| --- | --- | --- |
| Accounts | Đã có `services/` và `selectors/`; view đã tách theo auth, OAuth, reset, verify, 2FA | Giữ nguyên, không tách lại máy móc |
| Employers | Đã có `services/` và `selectors/` cho company/onboarding | Giữ nguyên, không thay API/profile contract |
| Candidates | Profile view tự `get_or_create` và save trực tiếp | Tạo selector/service cho profile hiện tại |
| CVs | View trộn ownership query, builder creation, soft-delete, upload/storage | Tách selector và service cho lifecycle CV |
| CV templates | Public view tự dựng query active | Tạo selector read-only dùng chung |
| Jobs/Applications | Đã có selector/service từ R5–R6 | Không thay lại |
| Dashboard/AI Core | Chưa có endpoint/use case nghiệp vụ | Không tạo service/selectors rỗng |
| Sitecontent | `views.py` là hotspot còn lại, chứa public config và admin mutation | Để lát cắt sau; không trộn với CV/profile để giảm rủi ro API admin |

## Source → target

| Trước | Sau |
| --- | --- |
| `candidates/views.py` ownership + mutation | `candidates/selectors/profiles.py`, `candidates/services/profiles.py` |
| `cvs/views.py` query/lifecycle/upload | `cvs/selectors/cvs.py`, `cvs/services/cvs.py` |
| `cv_templates/views.py` query trực tiếp | `cv_templates/selectors/templates.py` |

## Bất biến

- Không đổi URL, serializer hay schema database.
- CV upload vẫn chỉ nhận PDF/DOCX, lưu storage key và soft-delete như trước.
- Mọi queryset CV chỉ đọc CV thuộc candidate hiện tại, preload template/kỹ năng để
  tránh N+1 khi response mở rộng.
- Dashboard và AI Core không nhận abstraction rỗng khi chưa có write workflow hay
  read model thực tế.

## Xác nhận

- Candidate profile, CV upload/builder và public CV template có 4 API test mới.
- Toàn bộ backend suite: 81/81 pass với `config.settings.test`.

## Phần còn lại

- Tách `sitecontent/views.py` theo public selectors và admin-setting/feedback
  services khi thực hiện lát cắt site settings tiếp theo.
- Khi Dashboard/AI Core có endpoint nghiệp vụ, tạo read model/provider/use case
  từ contract đó thay vì suy diễn trước.
