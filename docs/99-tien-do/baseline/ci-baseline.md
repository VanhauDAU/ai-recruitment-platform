# Baseline CI ProCV tại P0

Số đo được lấy từ GitHub Actions qua API ngày 23/09/2026. Run thành công, thất
bại và bị hủy được tách riêng; thời gian bị hủy không được diễn giải là runtime
cần thiết để hoàn thành suite.

## Mười run PR tương đương gần nhất có dữ liệu

| Workflow | Run | SHA/nhánh | Kết quả | Khoảng thời gian | Bằng chứng chính |
| --- | --- | --- | --- | --- | --- |
| Backend | [34203415351](https://github.com/VanhauDAU/ai-recruitment-platform/actions/runs/34203415351) | `cd26cd78` / dev | Cancelled | 36m00s | Install 22s; pytest bị hủy sau 34m22s |
| Backend | [34203090335](https://github.com/VanhauDAU/ai-recruitment-platform/actions/runs/34203090335) | `5b803678` / dev | Cancelled | 3m58s | Run mới hủy run cũ; không dùng làm benchmark |
| Backend | [34203073346](https://github.com/VanhauDAU/ai-recruitment-platform/actions/runs/34203073346) | `0ae554a4` / remove-tts | Cancelled | 35m41s | Install 18s; pytest bị hủy sau 34m28s |
| Backend | [33968145973](https://github.com/VanhauDAU/ai-recruitment-platform/actions/runs/33968145973) | `220136fe` / dev | Failure | 30m49s | 1.294 pass, 9 fail, 2 skip; 87,29%; pytest 29m00s |
| Backend | [33966721238](https://github.com/VanhauDAU/ai-recruitment-platform/actions/runs/33966721238) | `290a45cd` / dev | Cancelled | 20m38s | Install 19s; pytest bị hủy sau 19m21s |
| Frontend | [34203415371](https://github.com/VanhauDAU/ai-recruitment-platform/actions/runs/34203415371) | `cd26cd78` / dev | Cancelled/final gate failed | 20m07s | Static 23s; coverage bị hủy ở 14m59s; E2E thất bại |
| Frontend | [34203090307](https://github.com/VanhauDAU/ai-recruitment-platform/actions/runs/34203090307) | `5b803678` / dev | Cancelled | 3m59s | Run mới hủy coverage/E2E; static đạt |
| Frontend | [34203071785](https://github.com/VanhauDAU/ai-recruitment-platform/actions/runs/34203071785) | `0ae554a4` / remove-tts | Cancelled/final gate failed | 20m22s | Coverage bị hủy ở khoảng 15m; E2E bị hủy ở khoảng 20m |
| Frontend | [33968145981](https://github.com/VanhauDAU/ai-recruitment-platform/actions/runs/33968145981) | `220136fe` / dev | Cancelled/final gate failed | 20m13s | Static đạt; coverage bị hủy; E2E thất bại |
| Frontend | [33968017578](https://github.com/VanhauDAU/ai-recruitment-platform/actions/runs/33968017578) | `5ed7ba6` / dev | Cancelled | 2m56s | Audit fail sớm; run mới hủy coverage/E2E |

Queue delay quan sát được ở các run trên thường vài giây đến dưới một phút. Log
không công bố ổn định `cache-hit` cho mọi run, nên P0 không suy diễn cache hit từ
thời gian cài dependency. Runner-minutes phải tính lại từ các job hoàn tất sau khi
P1 làm suite chẩn đoán được; không cộng duration của run bị supersede như runtime
sản phẩm.

## Lỗi đã quan sát

Backend run 33968145973 đạt coverage 87,29% nhưng thất bại 9 test. Hai nhóm chính
là fixture/migration state (`company_name_search` null hoặc thiếu cột
`application_reasons`) và hai assertion onboarding employer. Đây là bằng chứng
lịch sử ở SHA cũ, không phải kết luận nguyên nhân của SHA P0.

Frontend run 34203415371 có 33 E2E fail và 1 pass trong log lượt chẩn đoán; nhiều
lỗi xuất hiện ở tablet/mobile, announcement strip, employer readiness, CV,
navigation và timeout interaction. Artifact Playwright khoảng 180 MB đã hết hạn.
P1 phải tái hiện failure đầu tiên trên SHA mới trước khi sửa hoặc tăng song song.

## Run tại SHA P0

Khi chốt tài liệu, run PR-generated cho merge commit
`dddf4455c4e4cdd8b82424fadf9f1f774f8ee09d` vẫn đang chạy:

- Backend [35832791531](https://github.com/VanhauDAU/ai-recruitment-platform/actions/runs/35832791531): backend checks in progress.
- Frontend [35832791662](https://github.com/VanhauDAU/ai-recruitment-platform/actions/runs/35832791662): static/build/budget đạt, audit fail, coverage và E2E in progress.

Không ghi “CI đạt” cho SHA P0. P1 phải cập nhật kết quả cuối và thu log/timing
trên chính SHA hoặc SHA con tái hiện được.

## Branch protection và required checks

- REST branch-protection endpoint trả `404 Branch not protected` cho cả `dev` và
  `main` vì repository dùng ruleset.
- Không có ruleset áp vào `dev`; do đó required checks của `dev` là chưa cấu hình.
- Ruleset `Protect main` đang active, yêu cầu một approval, resolve review thread,
  chặn delete/non-fast-forward và yêu cầu các context: `static-quality`,
  `coverage`, `build`, `bundle-budget`, `e2e-smoke`, `audit`.
- `quality` backend và `frontend-final-gate` có trong workflow nhưng không nằm
  trong required status checks của ruleset `main` tại thời điểm P0. Không xóa hoặc
  đổi tên check trong P0; việc đồng bộ ruleset thuộc P8/P9 và cần quyền repository.

## Hành động P1

1. Thêm `pytest --durations=30`, JUnit và faulthandler timeout rồi tái hiện lỗi đầu
   tiên; dump stack không được coi là timeout tự dừng.
2. Ghi timing setup/call/teardown, test hiện chạy, test count và coverage kể cả khi
   thất bại nếu runner còn cleanup được.
3. Frontend ghi test chậm, timer/query retry, unhandled promise và mock thiếu;
   chưa tăng worker trước khi có số đo.
4. E2E sửa failure đầu tiên, giữ trace của lượt chính; không gọi mock smoke là
   integration backend thật.
5. Chỉ chuyển P2 khi test trọng yếu lặp ba lượt không flaky và suite hoàn tất hoặc
   phần chậm đã được khoanh chính xác.

