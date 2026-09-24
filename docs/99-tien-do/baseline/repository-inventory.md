# Kiểm kê repository ProCV tại P0

Baseline này mô tả đúng commit
`dddf4455c4e4cdd8b82424fadf9f1f774f8ee09d` trên `dev`. Mục đích là xác định
owner, dữ liệu có rủi ro và tham chiếu cần cập nhật trước khi di chuyển hoặc xóa.
Không có file sản phẩm nào được di chuyển trong P0.

## Công cụ và dependency

| Thành phần | Phiên bản hoặc định danh |
| --- | --- |
| Python hệ thống | 3.9.6 |
| Python backend venv | 3.11.15 |
| pip backend venv | 26.1.2 |
| Node.js | 24.19.0 |
| npm | 11.17.0 |
| Docker | 29.6.1 |
| Docker Compose | 5.3.0 |
| Git | 2.54.0 Apple Git 157 |
| `backend/requirements.txt` SHA-256 | `0e3e3b499362a5adca3853d289b1a1f4d5bbdda2db568ea93275e7f5ae6fc505` |
| `frontend/package-lock.json` SHA-256 | `1ca6b6bbead2abe1b456e0e58e6fd556fc81e19050768ddcf74f2019b137ed22` |

## Tệp được Git theo dõi

Có 2.551 file. [tracked-files.csv](tracked-files.csv) liệt kê từng file từ index
của commit baseline với kích thước blob, Git blob ID, owner và mục đích. Manifest
dùng blob trong Git thay vì nội dung working tree, nên vẫn đại diện đúng checkpoint
khi script tạo manifest đã được sửa trên nhánh P0.

| Khu vực | Số file | Kích thước blob |
| --- | ---: | ---: |
| `frontend/` | 1.446 | 11.139.881 byte |
| `backend/` | 986 | 5.483.855 byte |
| `docs/` | 68 | 2.161.559 byte |
| `private-media/` | 17 | 944 byte |
| `public-media/` | 4 | 268 byte |
| `scripts/` | 12 | 47.055 byte |
| `.github/` | 5 | 31.281 byte |
| `deploy/` | 1 | 2.242 byte |
| Root và metadata khác | 12 | 156.733 byte |

[code-hotspots.md](code-hotspots.md) ghi 2.049 file code được quét, 76 file từ
500 dòng và 124 file từ 300 đến 499 dòng. Kích thước chỉ dùng để chọn nơi khảo
sát; không phải bằng chứng rằng file cần tách.

## Media ở root

21 file media được track là nội dung giả cực nhỏ, không phải Git LFS pointer:

- 10 PDF tối giản 45 byte;
- 3 DOCX placeholder 68 byte;
- 8 PNG 1x1 67 byte;
- tổng 1.212 byte;
- không có ID thư mục hoặc tên file nào được tham chiếu trực tiếp ngoài hai thư
  mục media khi tìm bằng `rg`;
- Git không có `.gitattributes` áp LFS cho các đường dẫn này.

Kết luận P0: hình dạng nội dung giống fixture kiểm thử nhưng đường dẫn giống runtime.
P2 phải tìm consumer theo storage/path động và chạy test trước khi quyết định. Nếu
là fixture, chuyển về `tests/fixtures/` của app sở hữu; nếu là runtime, sao lưu và
untrack mà không xóa file vật lý. P0 không xóa hoặc đổi đường dẫn.

## Artifact phát sinh

- `frontend/test-results/` và `frontend/coverage/` đang tồn tại local nhưng không
  được Git theo dõi.
- `.gitignore` đã có `test-results/`, `playwright-report/`, `.coverage*`, cache
  Python và `frontend/dist/`.
- Không có `test-results/.last-run.json`, Playwright report, coverage hoặc
  `htmlcov` nào trong index của commit baseline. Nhận định cũ trong kế hoạch đã
  được xử lý trước SHA này và không được lặp lại như việc chưa làm.

## Ứng viên bỏ deploy và tham chiếu

| Ứng viên | Tham chiếu đang biết | Quyết định P0 |
| --- | --- | --- |
| `docker-compose.prod.yml` | Comment trong `docker-compose.yml`; tự tham chiếu Nginx | Giữ đến P3 |
| `deploy/nginx/procv.conf` | Mount trong `docker-compose.prod.yml` | Giữ đến P3 |
| `frontend/Dockerfile`, `frontend/nginx.conf` | Tài liệu trang công ty và detector CI | Kiểm tra tiếp ở P3 |
| `docs/06-deployment/` | README, CHANGELOG và nhiều tài liệu nghiệp vụ | Tách nội dung ở P7, không xóa mù |
| `config/settings/production.py`, ASGI, WSGI | Entrypoint Django có thể còn được import/test | Giữ |

## Owner chính

- `backend/apps/<domain>` sở hữu code, migration và test của domain.
- `backend/common` và `backend/config` thuộc backend platform.
- `frontend/src/{app,pages,widgets,features,entities,shared,test}` giữ ownership
  theo `frontend/ARCHITECTURE.md`.
- `scripts/` chỉ giữ check và điều phối liên repository.
- `.github/` thuộc CI; `docs/` thuộc tài liệu; media root chưa xác minh owner.
