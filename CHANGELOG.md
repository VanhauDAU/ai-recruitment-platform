# Changelog

Tất cả thay đổi đáng chú ý của dự án sẽ được ghi lại trong file này.

Định dạng dựa trên [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) và dự án tuân theo [Semantic Versioning](https://semver.org/spec/v2.0.0.html) khi bắt đầu phát hành phiên bản. Trong giai đoạn chưa cắt phiên bản, thay đổi được nhóm theo ngày dưới `[Unreleased]`.

## [Unreleased]

### 2026-11-27

#### Changed — Dọn `ml/` sau đợt huấn luyện

- `ml/scripts/run_training.sh` dựng lại đúng cấu hình đang dùng: thêm mini-batch 2, nội suy
  `wise-v1`, hiệu chỉnh trên tập hiệu chỉnh, đo cross-encoder và đủ cờ của `evaluate.py`.
- `ml/reports/train_pairs.md` sinh lại từ tập của `ft-v1` (5.936 bộ ba, khớp mã băm trong
  `model_card.json`) thay vì tập thử `ft-v2`. Ghim `pandas`, `scipy` trong `ml/requirements.txt`.
- Phiếu đọc kiểm lượt kế tiếp `ml/labeling/train_cv_review.md` thôi commit (sinh lại mỗi lần
  chạy `quality_gate.py`); sửa chú thích lỗi thời trong `ml/README.md`, `calibrate.py`,
  `domain/calibration.py`, `matching_evaluate`.
- Settings test ghi đè `MATCHING_RERANKER_BACKEND = 'none'`: test không còn hỏng khi
  `backend/.env` ở máy đã bật cross-encoder.

#### Changed — Production dùng hai mô hình đối sánh đã huấn luyện

- `docker-compose.prod.yml`: `MATCHING_MODEL_PATH`/`MATCHING_MODEL_VERSION` chuyển sang
  `e5-base-wise-v1`, thêm `MATCHING_RERANKER_BACKEND: cross_encoder` (`req-ce-v1`), `mem_limit`
  của `ml-worker` từ 1792m lên 2560m (hai mô hình cùng nạp đạt đỉnh 2,05–2,14 GB khi chấm).
- Trước khi deploy bản này phải có hai thư mục mô hình trên máy chủ
  (`scripts/deploy/sync_ml_models.sh` với `MODEL=multilingual-e5-base/wise-v1` và
  `MODEL=mmarco-mMiniLMv2-L12/req-ce-v1`) và chạy `matching_backfill --inline` sau deploy.
  Quay lui về mô hình gốc: `docs/06-deployment/van-hanh-va-kill-switch.md`.

#### Added — Lõi đối sánh CV–tin: công thức `hybrid-v3`, bi-encoder và cross-encoder đã huấn luyện

- Công thức chấm `hybrid-v3` (`apps/matching`). **Nhóm kỹ năng thay thế** có hiệu lực ngay:
  tin viết "A hoặc B", "một trong…", "such as…" thì CV có một kỹ năng là đạt cả nhóm; phần
  kỹ năng còn thiếu hiện "A hoặc B". Kết quả cũ (`hybrid-v2`) được chấm lại khi mở.
- Hai mô hình huấn luyện trên máy, **chưa bật mặc định**: bi-encoder `e5-base-wise-v1`
  (fine-tune `multilingual-e5-base` rồi nội suy trọng số với mô hình gốc) và cross-encoder
  `req-ce-v1` phán từng câu yêu cầu là đạt / có liên quan / chưa thấy, đồng thời nhận kỹ năng
  qua câu chứng minh trong CV. Trên validation của tập vàng (100 cặp): Spearman 0,705 → 0,822,
  NDCG@5 0,870 → 0,921, kappa mức hiển thị 0,697 → 0,733; cặp khác ngành trung vị 6 điểm, cao
  nhất 36. Gợi ý việc làm: MRR 0,776 → 0,867. Số đo, dữ liệu và giới hạn ở mục 7 của
  `docs/07-algorithms/thuat-toan-ai.md` và `ml/reports/`.
- Biến môi trường mới `MATCHING_RERANKER_BACKEND` (`none` mặc định, `cross_encoder`),
  `MATCHING_RERANKER_PATH`, `MATCHING_RERANKER_VERSION`. Quy trình bật ở local và production,
  kèm mức bộ nhớ đã đo (nâng `mem_limit` của `ml-worker` lên 2.304 MB khi bật cross-encoder), ở
  `docs/06-deployment/van-hanh-va-kill-switch.md`.
- Chặn cấu hình sai: phiên bản mô hình chưa có mốc quy đổi thì `manage.py check` báo lỗi (bỏ
  mốc mặc định); `ml-worker` dừng lúc nạp nếu `model_card.json` của thư mục mô hình không khớp
  `MATCHING_MODEL_VERSION`. `docker-compose.prod.yml` ghi rõ phiên bản cạnh đường dẫn.
- `result_json` bản 3: `overall.coverage`, `flags.reranker_used`, `meta.reranker_version`,
  `detail.units` của tiêu chí kỹ năng; khóa cache gồm cả phiên bản cross-encoder.
- Giao diện kết quả "Xem độ phù hợp" và bảng điểm hồ sơ của nhà tuyển dụng: gộp kỹ năng thiếu
  theo nhóm thay thế, nhãn mức giữa của yêu cầu là "Có liên quan, chưa rõ".
- `ml/`: đường ống dữ liệu huấn luyện (cổng chất lượng CV, bộ ba, chống rò rỉ), tập hiệu
  chỉnh 321 cặp có nhãn, 358 cặp yêu cầu–câu CV có nhãn, script huấn luyện, hiệu chỉnh và đo
  (bootstrap ghép cặp, chuẩn ngoài, ngưỡng điểm tối thiểu), trang chấm mù cho người.

#### Fixed — Chữ của tab trang chi tiết tin và thẻ "Xem độ phù hợp" vào i18n

- Nhãn ba tab, khối "Giới thiệu công ty", dải "Việc làm cùng công ty", dòng "Chưa có việc làm
  liên quan" và chữ trên thẻ/nút "Xem độ phù hợp" chuyển từ viết cứng sang
  `messages/candidate` (vi/en). Bước lint của Frontend CI đỏ vì các dòng này vượt trần chữ
  tiếng Việt viết cứng (`features/main` 627/626, `pages/main` 755/744); nay còn 623 và 744.

#### Changed — Trang chi tiết tin trên mobile: cụm thông tin chính gọn hơn, chia 3 tab

- Trên mobile, Địa điểm / Kinh nghiệm / Hạn ứng tuyển ở đầu trang chi tiết tin chuyển từ
  3 cột (ô icon 36px nằm trên chữ) sang 3 dòng "icon · nhãn · giá trị"; "Còn N ngày"
  nằm cùng dòng với ngày hết hạn. Địa điểm dài cắt ở 2 dòng. Desktop giữ nguyên.
- Phần dưới khối đầu tin trên mobile chia 3 tab gạch chân, dính ngay dưới header:
  **Thông tin** (thông tin chung, chi tiết tin, đánh giá, bí kíp an toàn), **Công ty**
  (thẻ công ty), **Việc liên quan** (danh sách + danh mục nghề). Panel ẩn bằng `hidden`
  nên giữ trạng thái khi đổi tab; sang tin khác tự về tab Thông tin. Nút "Xem việc làm
  liên quan" của tin đã ngừng tuyển mở thẳng tab Việc liên quan. Thanh neo mục trên cùng
  ẩn trên mobile vì thanh tab đã thay thế.
- Thẻ "Xem độ phù hợp" trên điện thoại thành nút nổi gọn: mascot đứng + nhãn AI + bong
  bóng chữ "Xem độ phù hợp CV", ở góc phải ngay trên nút Góp ý. Bong bóng mặc định thu về
  0 (không che nội dung); khoảng 12 giây trượt ra ~3 giây rồi thu vào, mascot nhún + vẫy
  tay cùng lúc. Máy tính bảng và desktop giữ thẻ đầy đủ.
- Tab **Công ty** thêm "Giới thiệu công ty" (mô tả, lĩnh vực, website) và dải "Việc làm
  cùng công ty" vuốt ngang: tối đa 6 tin, thẻ thấp chỉ có tiêu đề/lương/nơi làm · kinh
  nghiệm, mỗi lần một tin, hé tin sau; chỉ tải khi mở tab. API chi tiết
  tin thêm `company_public_id` để lọc `?company=` mà không phải gọi trang công ty.
- Trên mobile, khối đầu tin và các khối trong tab tràn sát mép, góc vuông, cách nhau dải
  xám 8px; thanh tab liền ngay dưới khối đầu tin.

#### Changed — Trang bảo trì theo thiết kế mới, bánh răng xoay

- Màn bảo trì của SPA (`MaintenanceScreen`) và trang lỗi `50x.html` của nginx dùng chung
  một giao diện: logo, cụm bánh răng xoay (tốc độ theo tỉ lệ số răng, tắt khi người dùng
  bật giảm chuyển động), tiêu đề "Hệ thống đang **bảo trì**", vòng tròn trang trí, nút
  tải lại. CSS và SVG nằm ở `frontend/public/maintenance/` nên không vào CSS khởi tạo.
- Trước đây khi bật bảo trì, các trang SEO do Django dựng (trang chủ, `/viec-lam`…) chỉ
  trả một dòng chữ trơn. Giờ middleware vẫn dựng khung SPA và chỉ đổi mã sang 503
  (`Retry-After`, `X-Robots-Tag: noindex`), SPA tự hiện màn bảo trì.
- Câu mặc định của `maintenance_message` trong seed đổi theo thiết kế. DB đang chạy giữ
  giá trị cũ: sửa ở Cấu hình hệ thống → Vận hành → Bảo trì.
#### Added — Link "Trạng thái hệ thống" ở footer

- Migration `sitecontent.0014` thêm link tới Status page UptimeRobot vào cụm footer "Về
  ProCV" (mở tab mới); seed `link_groups.json` có link này cho bản cài mới.
- Sửa checklist go-live: bước "Admin → cụm link `footer_nav`" không làm được vì
  production tắt Django admin, cụm link chưa có màn sửa trong trang quản trị.

#### Docs — Trang trạng thái hệ thống bằng UptimeRobot

- Checklist go-live thêm 3 monitor (trang chủ, `/api/health/ready/`, cổng NTD), tạo trang
  Status page của UptimeRobot, xử lý 403 do Cloudflare và gắn link "Trạng thái hệ thống"
  vào cụm `footer_nav` sau deploy. Không đổi code.

#### Fixed — Bản đồ VietMap chỉ hiện nền trơn ở "Việc làm gần tôi"

- Sau khi dán link style VietMap vào `map_style_url`, bản đồ chỉ là nền be trơn: tile
  vector của VietMap dùng định dạng riêng (byte đầu `01 01 01`, không phải MVT `1a`), chỉ
  SDK `vietmap-gl` đọc được.
- `useBasemap()` giờ chuyển link `…/maps/styles/<kiểu>/style.json?apikey=…` thành nguồn
  tile ảnh PNG cùng kiểu, cùng key. Màn hình nét dùng ảnh `@2x`; zoom tối đa 18, vì từ
  zoom 19 VietMap chỉ trả ảnh trống. Admin không phải đổi cấu hình.
- Đã soát ảnh tile vùng Biển Đông: có "Quần Đảo Hoàng Sa", "Quần Đảo Trường Sa", "Biển
  Đông".
- `MapView` đổi prop `styleUrl` thành `mapStyle`. Cập nhật ADR-0029 và hướng dẫn site
  settings. E2E giả tile ảnh và kiểm tra MapLibre gọi đúng đường `/maps/tiles/tm/…png`.

#### Fixed — Thẻ việc làm ở "Việc làm gần tôi" tràn khỏi màn hình điện thoại

- Lưới `.nearby-results` dùng cột ngầm định `auto` nên tên công ty dài (để `nowrap`) đẩy
  thẻ rộng hơn khung trang. Trên iPhone thẻ lòi ra mép phải và bị lớp cha cắt mất; trên
  desktop, khi có bản đồ, trang cuộn ngang 30px. Giờ cột dùng `minmax(0, 1fr)` và tên
  công ty bị cắt bằng "…".
- E2E `nearby-jobs` dùng tên công ty dài và đo trực tiếp mép phải mỗi thẻ so với khung
  lọc. Trước đây test chỉ so `scrollWidth`, nên không bắt được phần tràn bị cắt.

#### Fixed — Việc làm gần tôi: bỏ bản đồ nền sai chủ quyền Hoàng Sa, Trường Sa; làm lại ô vị trí và bố cục điện thoại

- Production để trống `map_style_url` nên các trang "Việc làm gần tôi", chi tiết tin và
  ghim nơi làm việc dùng style OpenFreeMap. Tile vector của style này ghi "South China
  Sea 南海" và từ zoom 7 gán tên Trung Quốc cho hai quần đảo: "Sansha 三沙市", "Xisha
  西沙区", "Nansha 南沙区", "Yongxing 永兴镇", "Zhubi 渚碧岛". Zoom 8 thêm hàng chục tên
  đáy biển tiếng Trung, còn đảo Ba Bình có đường biên quốc gia gắn Đài Loan.
- `useBasemap()` mới (`entities/system/site-settings`) chỉ nhận style https của nhà cung
  cấp bản đồ Việt Nam (hiện chỉ `maps.vietmap.vn`). `MapView` không còn style dự
  phòng, kể cả ở dev.
- Chưa có style hợp lệ thì các trang ẩn bản đồ. "Việc làm gần tôi" vẫn tìm theo GPS hoặc
  phường/xã, danh sách chiếm cả hàng. Chi tiết tin không hiện bản đồ nhỏ. Form đăng tin ẩn
  nút "Ghim trên bản đồ" và dùng tọa độ geocode hoặc tâm phường.
- Cập nhật ADR-0029, hướng dẫn site settings và mô tả `map_style_url`/`map_attribution`
  trong seed. Bật lại bản đồ: tạo key tile VietMap giới hạn domain procv.site rồi dán
  `https://maps.vietmap.vn/maps/styles/tm/style.json?apikey=<key>` vào cấu hình hệ thống.
- Ô vị trí gộp tìm kiếm và định vị. Nút ngắm nằm cạnh ô, trên điện thoại chỉ còn biểu
  tượng. Bấm nút sẽ điền "Vị trí của bạn · P. X, Tỉnh Y" vào ô; bấm bản đồ thì ghi "Điểm đã
  chọn trên bản đồ". Đang định vị thì ô báo "Đang lấy vị trí hiện tại…". Tìm không thấy thì
  gợi ý nhập tên phường/xã, không còn danh sách trống.
- Sửa lỗi bản đồ tràn khỏi màn hình điện thoại làm lệch trang (khung 434px trên màn
  375px): lưới trang và thanh lọc dùng `minmax(0, 1fr)` nên canvas MapLibre không đẩy
  cột rộng ra.
- Dưới 1024px, danh sách và bản đồ chuyển bằng nút "Danh sách (n) | Bản đồ" thay vì xếp
  chồng; bấm ghim trên bản đồ sẽ quay về danh sách các việc ở điểm đó.
- Điện thoại (dưới 640px) chỉ còn hai hàng: ô vị trí kèm nút định vị, rồi bán kính dạng ô
  chọn, nút "Bộ lọc" (có số bộ lọc đang bật) và nút chuyển danh sách/bản đồ dạng biểu
  tượng. Ngành nghề, mức lương, "Gồm việc làm từ xa" nằm trong bảng trượt từ dưới lên, có
  nút "Xem kết quả".
- Tìm địa chỉ chuyển sang `geoapify` (`GEOCODING_PROVIDER=geoapify`) cho production và gỡ
  hai adapter `vietmap`, `goong` cùng test của chúng; giá trị cũ giờ rơi về `disabled`.
  Lý do chọn Geoapify: gói miễn phí 3.000 request/ngày, đăng ký không cần thẻ. API tìm kiếm của
  VietMap trả phí, còn tài khoản Goong mới phải chờ kích hoạt. Kết quả lọc
  `countrycode:vn` và bằng tiếng Việt. Ref gợi ý mang sẵn tọa độ nên chọn gợi ý không gọi
  thêm API. Khi gợi ý đến từ Geoapify, danh sách ghi công Geoapify và © OpenStreetMap như
  gói miễn phí yêu cầu. VietMap chỉ cấp tile bản đồ.
- Cập nhật chú thích `GEOCODING_*` trong `backend/.env.example`, ADR-0029, hướng dẫn
  deploy và checklist go-live.
- E2E `nearby-jobs` chạy với style VietMap giả nên bản đồ hiện thật. Test kiểm tra ô vị trí
  được điền, bảng bộ lọc trên điện thoại và trang không cuộn ngang ở cả chế độ bản đồ trên
  tablet và điện thoại.

#### Fixed — Trắng trang ở tab "Bản AI chờ duyệt" (React #185)

- Xem trước CV đo chiều cao section kèm margin, nhưng section cuối vùng có `last:mb-0`
  nên đo thấp hơn 20px; CV dài sát một trang A4 bị chia trang đổi qua lại (đo → chia →
  đo lại) tới khi React ném "Maximum update depth exceeded". Giờ mọi section cộng cùng
  một khoảng cách, và phép đo dừng sau 12 lượt đổi của cùng một document.

### 2026-11-26

#### Fixed — Gõ chữ mượt hơn ở ô góp ý/báo lỗi, ô nhắn tin trên iPhone; CI bundle xanh lại

- iPhone/iPad: mọi ô gõ chữ (input, textarea, select, ô soạn thảo, ô antd) cỡ chữ 16px
  qua `@supports (-webkit-touch-callout: none)` nên Safari không phóng to trang khi chạm;
  Android/desktop giữ cỡ chữ thiết kế.
- `useVisualViewportBottomInset` bỏ qua thay đổi khung nhìn khi đang gõ (bàn phím ảo mở)
  và đo lại khi rời ô: trước đây mỗi phím trên iOS vẽ lại cụm nút nổi cùng hộp góp ý, khung
  chat onboarding và thanh so sánh việc làm. `FeedbackModal` bọc `memo`.
- Trang chủ: dải logo nhà tuyển dụng chỉ lặp đủ phủ màn hình 2560px (216 → 54 logo, mỗi logo
  một animation), dừng khi khuất màn hình, tắt khi giảm chuyển động. Gõ ô góp ý trên trang
  chủ, CPU 6×: p75 40 → 24 ms, p95 64 → 32 ms.
- `ToastSoundEffect` tải lười: JS khởi tạo 267,1 → 266,3 KiB (CI `main` từng vượt ngân
  sách 268,1/268,0 KiB sau PR âm thanh).

#### Changed — Form đăng tin tuyển dụng dễ nhập trên điện thoại, hết giật khi gõ

- Gõ phím không còn vẽ lại cả form: form gốc chỉ theo dõi số mục hoàn tất, bản xem
  trước tự theo dõi giá trị ở mức ưu tiên thấp và chỉ mount từ 1536px. Đo Playwright,
  CPU chậm 6×: điện thoại 1255 → ~45 ms/ký tự, desktop có xem trước 861 → ~65 ms/ký tự.
- Điện thoại: mọi ô nhập, select, ngày giờ, ô soạn thảo cỡ chữ 16px nên iOS không phóng
  to trang khi chạm; ô cao 40px dễ chạm.
- Chọn nhiều (chuyên ngành, hình thức làm việc, kỹ năng) hiện đủ mọi mục đã chọn thay
  vì gom thành "+N"; popup chọn vị trí chuyên môn 3 cột vừa màn hình, chữ dài xuống dòng.
- Thẻ tiến độ cao gần nửa màn hình thay bằng dải 4 bước dính đầu vùng cuộn, sáng theo
  phần đang xem; hai nút Lưu nháp / Đăng tin chung một hàng ở đáy.
- Bàn phím đúng loại (số cho lương, tuổi, số lượng; điện thoại cho SĐT), ô hạn nhận hồ sơ
  chỉ mở lịch không bật bàn phím; cặp ô ngắn (tuổi, lương, ngày/giờ làm) chung một hàng.
#### Added — Âm thanh chúc mừng ở mốc thành công và tiếng tin nhắn riêng

- Hiệu ứng `celebrate` (`public/audio/effects/celebrate.mp3`, 11 KB, từ file gốc 68 KB:
  cắt lặng, mono 48 kbps, chuẩn hóa −20 LUFS như các tiếng sẵn có) phát cùng toast khi:
  nộp hồ sơ ứng tuyển, đăng ký tài khoản ứng viên/NTD, hoàn tất hồ sơ NTD, xác thực số
  điện thoại NTD lần đầu, đăng tin lần đầu (cập nhật tin giữ toast thường) và kích hoạt
  hoặc lên lịch chiến dịch. Cổng quản trị không phát vì thao tác duyệt lặp lại liên tục.
- Hiệu ứng `message` (`message.mp3`, 6 KB, từ 51 KB) thay tiếng chuông cho toast tin nhắn
  ProCV Connect mới; `announceNotice` nhận tham số `sound`.
- Hai tiếng mới không tải sẵn khi người dùng chạm lần đầu, chỉ fetch ở lần phát đầu; tiếng
  chúc mừng im theo công tắc chuông thông báo (`procv:notification-sound`, nay khai ở
  `shared/lib/sound-effects`). Trình duyệt chặn phát hay tải lỗi thì bỏ qua, không ảnh
  hưởng luồng.

#### Changed — Cổng nhà tuyển dụng và quản trị chuyển sang subdomain riêng

- Production: nhà tuyển dụng ở `tuyendung.procv.site` (giới thiệu ở `/`, khu làm việc
  ở `/app`), quản trị ở `quantri.procv.site` (app ở gốc). Máy dev và e2e giữ đường dẫn
  `/tuyendung`, `/quan-tri` khi không đặt `VITE_*_HOST`.
- `procv.site/tuyendung/*`, `/quan-tri/*`, `/admin/*` chuyển 301 sang subdomain (giữ
  query); trong SPA, link cũ đã lưu (thông báo, banner) cũng tự chuyển, và link từ cổng
  NTD/quản trị sang trang tin, công ty, CV mở ở `procv.site`.
- Backend dựng mọi link email/thông báo của NTD qua `common/portal_paths.py`, suy ra
  từ `EMPLOYER_FRONTEND_URL`/`ADMIN_FRONTEND_URL`; bỏ biến `ADMIN_INVITATION_PATH`,
  `ADMIN_PASSWORD_RESET_PATH`, `EMPLOYER_EMAIL_VERIFICATION_PATH`,
  `EMPLOYER_PASSWORD_RESET_PATH`.
- SEO: trang giới thiệu NTD có canonical, robots, sitemap riêng trên subdomain;
  `quantri.` trả `Disallow: /`. nginx chỉ mở `/api/admin/` trên `quantri.`.
- Vận hành: DNS `tuyendung`, `quantri`; Cloudflare Access thêm `quantri.procv.site`;
  redirect URI OAuth (Google/Facebook/LinkedIn) thêm `tuyendung.procv.site`.

#### Changed — Cổng quản trị đổi đường dẫn sang `/quan-tri`

- Cổng quản trị chạy chung domain đổi từ `/admin/app/…` sang `/quan-tri/…`
  (ví dụ `/quan-tri/dang-nhap`), đồng nhất với các đường dẫn tiếng Việt còn lại.
  Subdomain riêng (`VITE_ADMIN_HOST`) vẫn dùng `/app`.
- Link cũ `/admin/app/…` trong email mời, email đặt lại mật khẩu, thông báo và
  bookmark tự chuyển sang đường dẫn mới, giữ nguyên query (token) và hash; prefix
  thông báo đã xuất bản lưu path cũ vẫn khớp.
- Mặc định `ADMIN_INVITATION_PATH`, `ADMIN_PASSWORD_RESET_PATH` đổi theo;
  `robots.txt` chặn thêm `/quan-tri/`.
- Vận hành: thêm `procv.site/quan-tri*` vào application Cloudflare Access của cổng
  quản trị (giữ `procv.site/admin*` cho link cũ).

#### Changed — Việc làm đã ứng tuyển chia trang, 6 việc mỗi trang

- Trang `/tai-khoan/viec-lam-da-ung-tuyen` hiện 6 hồ sơ mỗi trang; số trang nằm trên
  URL (`?page=`) để quay lại từ tin tuyển dụng vẫn đúng trang, đổi bộ lọc trạng thái
  thì về trang 1.

#### Fixed — Gõ chữ không còn giật ở form ứng tuyển và ProCV Connect

- Thư giới thiệu và ô liên hệ (họ tên, email, SĐT) tự giữ chữ đang gõ; mỗi phím không
  còn vẽ lại cả modal (danh sách CV, chọn địa điểm, ô đồng ý). Đo trên Chromium giảm CPU
  6×: 41–44 → 7–9 ms/ký tự.
- Tín hiệu "đang gõ" của bên kia chỉ gia hạn thời hạn hiển thị, không vẽ lại cả hộp thư ở
  mỗi tín hiệu.

#### Fixed — Cụm nút quyết định hồ sơ bị trình chặn quảng cáo ẩn

- Phù hợp / Phỏng vấn / Trúng tuyển / Không phù hợp mất khỏi panel "Xử lý hồ sơ" khi
  trình duyệt bật uBlock/AdBlock: class `ad-bar` trúng quy tắc `##.ad-bar` của EasyList.
  Đổi tiền tố `ad-` sang `decision-`; đã đối chiếu mọi class frontend với EasyList và
  ABPVN, không còn class nào trúng.

#### Fixed — Form ứng tuyển không phóng to trên iPhone

- Ô địa điểm làm việc bỏ ô tìm kiếm (danh sách ngắn) nên chạm vào không bật bàn phím,
  không zoom; ô nhập chữ của form dùng 16px trên màn hình hẹp.
- Tin chỉ có một tỉnh/thành thì chọn sẵn tỉnh đó.

#### Changed — Gọn giao diện cổng ứng viên trên điện thoại

- Hero trang chủ: điện thoại bỏ huy hiệu số việc làm và câu phụ, ô tìm kiếm lên trên fold.
- Header: icon Danh mục, tìm kiếm, chuông, tin nhắn, quay lại đổi sang bộ nét Lucide
  (ISC) vendor ở `src/shared/ui/icons/LineIcon.jsx`; nút tròn 40px đồng cỡ.
- Dải thông báo luôn một dòng; câu dài hơn khung thì chạy chữ (dừng đầu/cuối) và giữ
  thông báo đến khi chạy hết mới xoay; giảm chuyển động thì quay về dấu ba chấm.
- Khối "Lợi ích khi sử dụng" ở bài viết ẩn trên điện thoại; đóng một lần thì nhớ cho
  mọi bài (localStorage).

#### Fixed — Kính lúp header không mở bàn phím trên iPhone

- WebKit chỉ mở bàn phím khi `focus()` chạy trong thao tác chạm; nút giờ giữ focus bằng ô
  ẩn (`src/shared/lib/hold-keyboard-focus.js`) trước khi chuyển sang `/viec-lam`.

#### Fixed — Rà soát production (PageSpeed/console): LCP, soft 404, a11y

- CSP Report-Only bỏ `upgrade-insecure-requests` (Chrome bỏ qua chỉ thị này ở chế độ
  Report-Only và ghi lỗi console ở mọi trang, Lighthouse trừ điểm Best Practices).
- Nginx: đường dẫn có đuôi file tĩnh (`.png`, `.txt`, `.json`…) không tồn tại trả 404 thật
  thay vì `index.html` 200 (soft 404 cho `/favicon.ico`, `/llms.txt`, `/.well-known/*`);
  `/favicon.ico` phục vụ `favicon-32.png`.
- LCP trang chủ: SEO shell `/` thêm `<link rel="preload" as="image" fetchpriority="high">`
  cho ảnh slide đầu carousel (trước đây chỉ biết sau khi tải JS + gọi API, trễ ~1,5 s
  trên 4G chậm); ảnh slide đầu thêm `fetchpriority="high"`.
- Footer: nút App Store/Google Play mất nền tối (antd reset nền/chữ thẻ `a`) nên hiện chữ
  xanh trên nền trắng, dòng "DOWNLOAD ON THE" gần như vô hình — dùng `!bg-`/`!text-`.
- A11y theo Lighthouse: tab Hotline có `role="tablist"`; link "Xem tất cả" công ty có tên
  riêng; chip "Sắp ra mắt" đủ tương phản; chấm chọn màu mẫu CV giãn cách ≥ 24 px.
- Dải thông báo chỉ gọi lại API khi quay lại tab nếu dữ liệu đã quá một chu kỳ poll
  (trước đây mỗi lần đổi tab là một request).

#### Fixed — Bớt email Sentry nhiễu và request API thừa

- CSP: hash script giao diện sáng/tối trong `index.html` đã cũ nên mọi lượt tải trang
  gửi một báo cáo "Blocked 'script' from 'inline:'" lên Sentry; cập nhật hash, thêm test
  `src/app/csp-inline-script-hash.test.js` so hash với `index.html`. Cho phép beacon
  Cloudflare Web Analytics (`static.cloudflareinsights.com`) và thêm `'report-sample'`.
- Sentry SDK bỏ qua lỗi `zaloJSV2` do trình duyệt trong app Zalo tự chèn script.
- Tab cũ sau deploy gặp lỗi tải chunk (`vite:preloadError`) thì tự tải lại, tối đa một
  lần mỗi phút (script inline trong `index.html`, không tốn ngân sách JS khởi tạo).
- Script giao diện tối trong `index.html` nhận path đăng nhập mới (`/dang-nhap`,
  `/dang-ky`…, gồm cổng `/tuyendung`) sau khi chuẩn hoá path.
- Trang chủ lấy tổng số việc làm từ `/public/jobs/stats/` (dùng chung cache với khối
  thống kê) thay vì tải cả một trang tin; thông báo hệ thống cache 5 phút theo trang.

#### Changed — Path URL frontend thống nhất tiếng Việt không dấu

- Cổng ứng viên: `/dang-nhap`, `/dang-ky`, `/quen-mat-khau`, `/dat-lai-mat-khau`,
  `/hoan-thien-ho-so`, `/cv/:id/chinh-sua`, `/cv/:id/xem`, `/cv/:id/da-luu`,
  `/cv/chia-se/:token` (thay `/login`, `/sign-up`, `/register`, `/cvs/:id/edit`…).
- Workspace NTD `/tuyendung/app/…` và admin `/admin/app/…` đổi toàn bộ segment tiếng Anh
  (vd. `employer-verify` → `xac-thuc-tai-khoan`, `account/settings/gpkd` →
  `cai-dat/giay-phep-kinh-doanh`, `jobs/:id/edit` → `tin-tuyen-dung/:id/chinh-sua`,
  `job-moderation` → `duyet-tin`). Giữ nguyên tiền tố `app`, `/oauth/callback` (đã khai
  với Google/Facebook/LinkedIn) và `/procv-connect`; workspace NTD dùng `/procv-connect`
  thay `/connect`.
- Path cũ redirect giữ tham số, query và hash qua bảng
  `app/router/redirects/legacy-paths.js` để link trong email, thông báo đã lưu và link
  đã chia sẻ vẫn mở được; test khóa mọi đích redirect là route có thật.
- Backend phát link mới trong email/thông báo; mặc định `ADMIN_INVITATION_PATH`,
  `ADMIN_PASSWORD_RESET_PATH`, `EMPLOYER_EMAIL_VERIFICATION_PATH`,
  `EMPLOYER_PASSWORD_RESET_PATH` đổi theo (prod có đặt trong `.env` thì sửa lại).
- Thông báo đa cổng: revision đã xuất bản giữ prefix route cũ vẫn khớp path mới
  (`sitecontent.selectors.legacy_paths`); migration `sitecontent.0013` đổi link footer và
  CTA banner đã lưu sang path mới.

#### Fixed — Trang "CV của tôi" tải chậm / treo trên production

- `GET /api/candidate/cvs/` gọi `default_storage.exists()` (HEAD tới R2, ~100 ms) hai lần
  cho mỗi CV chỉ để tính `thumbnail_url`/`thumbnail_status`; R2 chậm là request treo,
  trình duyệt bỏ (nginx 499). Danh sách giờ chỉ so khoá ảnh trong DB
  (`thumbnail_matches_latest_version`, worker chỉ ghi khoá sau khi lưu file xong);
  endpoint ảnh một CV vẫn kiểm tra storage.
- Client R2 (boto3) có timeout kết nối 5 s, đọc 30 s, tối đa 3 lần thử thay cho mặc định
  60 s × 4 lần.

#### Added — Góp ý / báo lỗi gửi sang Telegram

- Góp ý mới được task `apps.sitecontent.tasks.notify_feedback_telegram` (queue `default`,
  sau commit, thử lại khi Telegram lỗi mạng/429/5xx) gửi sang Telegram: chủ đề, người gửi,
  link trang, thiết bị, nội dung (HTML đã escape).
- Bật bằng `TELEGRAM_BOT_TOKEN` + `TELEGRAM_FEEDBACK_CHAT_ID` trong `backend/.env`; để trống
  thì không gửi.
- Form góp ý: 5 mức hài lòng dùng emoji động Noto như khối đánh giá tin (bản động khi
  rê/chọn); `RatingEmoji` tách thành `shared/ui/AnimatedEmoji.jsx` dùng chung.
#### Added — 100 tin tuyển dụng demo viết tay

- `seed_data/demo_job_catalog.py`: 100 tin cho 8 công ty demo, đúng ngành từng công ty
  (outsource phần mềm, viễn thông, game, ngân hàng, ví điện tử, thương mại điện tử,
  bất động sản/khách sạn/ô tô, nhà máy điện tử). Mỗi tin có mô tả, yêu cầu, phúc lợi,
  kỹ năng bắt buộc/ưu tiên, ngoại ngữ, cấp bậc, đủ loại hợp đồng (thực tập, bán thời
  gian, thời vụ, freelance, làm tại nhà), lương VND/USD đủ 5 kiểu, ca xoay/đêm/cuối tuần.
- `seed_demo_jobs` tạo thêm bộ này sau 30 tin ngẫu nhiên; cờ `--catalog-only` chỉ tạo
  lại 100 tin trên công ty demo đang có, không xoá tin khác, và ký lại DPA hiện hành
  cho chủ công ty demo (đổi phiên bản DPA làm tin demo cũ bị ẩn). Cờ này chạy được
  trên production vì không tạo tài khoản; seed đầy đủ vẫn bị chặn ở đó.

#### Changed — Trang danh sách việc làm trên điện thoại

- Header chỉ hiện khi ở đầu trang danh sách việc làm; lướt xuống ẩn, lướt lên giữa trang
  vẫn ẩn (`useHideOnScroll(…, { topOnly })`). Trang chi tiết tin giữ header dính.
- Cụm tìm kiếm gọn hơn: từ khóa + nút tìm một hàng (40px); "Ngành nghề" và "Địa điểm"
  thành chip kính 34px, chip đang lọc nền trắng chữ xanh và hiện giá trị.
- Nút kính lúp ở header: về đầu trang danh sách và đặt con trỏ vào ô từ khóa (trước đây
  đứng ở `/viec-lam` bấm không có gì xảy ra).
#### Added — Nút góp ý & báo lỗi phía ứng viên

- Nút xanh nhỏ góc phải dưới mọi trang ứng viên (`FeedbackLauncher`; trong trình chỉnh
  sửa CV nằm trên cụm zoom) mở form góp ý sẵn có. Thêm chủ đề "🐞 Báo lỗi" (gợi ý cách
  mô tả lỗi); form tự gửi kèm URL đầy đủ và `client_info` (cỡ màn hình, dpr, cảm ứng,
  web app, ngôn ngữ, trình duyệt) để tái hiện lỗi.
- `Feedback.client_info` + `Category.BUG` (migration `sitecontent.0012`).
- Lệnh xuất: `python manage.py export_feedback` (Markdown, mặc định góp ý mới);
  `--status all|new|in_progress|resolved`, `--category bug`, `--since YYYY-MM-DD`,
  `--format csv`, `-o file`, `--mark-in-progress`.

#### Fixed — Trình chỉnh sửa CV trên điện thoại

- Thanh trên: tên CV một dòng cắt "…", ẩn icon trang; "Xem trước" chỉ còn icon (trước
  đó `hidden` bị style antd Button đè nên vẫn hiện và đè lên tên CV).
- Header site trong trình chỉnh sửa bỏ "Danh mục" và kính lúp trên điện thoại (avatar
  bị tràn 20px).
- Thanh công cụ dưới đủ 7 cột một hàng, chừa vùng an toàn đáy iPhone.
- Zoom vừa màn tính theo bề ngang cửa sổ (`fitZoom`), thay 48% cố định làm trang A4
  tràn mép phải ở 390px.
- Nút "Thêm nội dung" chỉ hiện khi đang chọn mục (như desktop), không đè dòng cuối.
#### Fixed — Điện thoại vẫn mở tin ở tab mới

- Áp `useNewTabLinkProps` cho các link nội bộ còn sót: tiêu đề tin trong `JobCard`
  (trang Việc làm…), feed tin mới ở trang chủ, nút "Xem trang công ty" ở trang tin, thẻ
  blog, bài ghim và banner nội bộ ở blog. Link ra site ngoài vẫn mở tab mới.

#### Changed — Điều hướng trên điện thoại

- Trang chi tiết tin / mẫu CV / công ty: header có nút ←; không có trang trước trong
  app (link chia sẻ, tab mới) thì về danh sách tương ứng (`model/detail-back.js`).
- Thẻ việc làm ở trang chủ và blog chỉ mở tab mới trên máy có chuột
  (`useNewTabLinkProps`); điện thoại mở ngay trong tab, web app không bị đẩy ra Safari.
- Thanh tab dưới ẩn khi cuộn xuống, hiện khi cuộn lên; nút nổi hạ xuống theo.
- Header luôn dính trên điện thoại (trước đây ẩn khi cuộn ở các trang `/viec-lam`).
- Sửa test `HeroTypingTitle` theo vế "Tìm việc nhanh chóng".

#### Fixed — Web app trên iPhone và thanh tab dưới

- Icon "Thêm vào Màn hình chính": `apple-touch-icon.png` dựng lại nền trắng (bản cũ nền
  trong suốt, iOS tô đen nên logo gần như mất); thêm `manifest.webmanifest` (tên
  "ProCV", icon 192/512 + maskable trong `public/icons/`), `apple-mobile-web-app-title`,
  `theme-color`. nginx trả manifest với `application/manifest+json`.
- Bấm lại tab của chính trang đang mở ở thanh tab dưới thì cuộn mượt lên đầu.
- Tab đang chọn có viên kính bo tròn hơi trong suốt phía sau icon + nhãn (`.mobile-tab--active` trong `index.css`).

#### Changed — Lưu logo/ảnh bìa công ty nhanh hơn

- Trình duyệt thu nhỏ ảnh về trần server (logo 800 px, ảnh bìa/thư viện 2400×1600)
  và mã hóa WebP trước khi tải (`shared/lib/shrink-image.js`): ảnh điện thoại vài MB
  không còn đi nguyên qua mạng rồi lên R2. Logo và ảnh bìa tải song song; thư viện
  vẫn lần lượt để giữ thứ tự.
- `services/company_media.py`: trần kích thước theo loại (`MEDIA_MAX_DIMENSIONS`),
  logo 800×800 thay vì 2400×1600.

#### Changed — Trang chủ trên điện thoại

- Ô tìm kiếm: từ khoá một hàng, địa điểm + nút kính lúp chung hàng dưới; tiêu đề gõ
  chữ mở đầu bằng "Tạo CV chuyên nghiệp".
- Cụm "Website của chúng tôi có" xếp ba cột (icon / số / nhãn) thay vì ba dòng cao.
- Nút nổi giữa thanh tab dưới chỉ còn chữ "CV" trắng (bỏ icon và nhãn "Tạo CV";
  tên đầy đủ vẫn có qua `aria-label`).

#### Added — SMS OTP nhà tuyển dụng qua SpeedSMS

- Provider `EMPLOYER_SMS_PROVIDER=speedsms` gọi thẳng API SpeedSMS.vn (Basic auth
  bằng access token), mặc định brandname "Verify" (`EMPLOYER_SMS_SPEEDSMS_TYPE=4`,
  750đ/tin, không cần đăng ký brandname); `2` là đầu số ngẫu nhiên (250–300đ/tin).
- Nội dung tin lấy từ `EMPLOYER_SMS_CONTENT_TEMPLATE` (không dấu, ≤ 160 ký tự, chỉ
  `{code}`/`{ttl_minutes}`); readiness báo sai mẫu. Production chấp nhận `http`
  hoặc `speedsms`; mã lỗi SpeedSMS (hết số dư, số sai, lỗi tạm) ra reason code riêng.
#### Changed — Tiêu đề trang chủ gõ chữ trên điện thoại

- Màn dưới 768px: dưới tên trang lần lượt gõ rồi xóa "Tạo CV", "Tìm việc làm",
  "Tuyển dụng hiệu quả", có con trỏ nhấp nháy. Thẻ h1 vẫn giữ nguyên câu đầy đủ cho
  SEO và trình đọc màn hình; desktop và người bật giảm chuyển động thấy câu tĩnh.

#### Changed — Tắt ClamAV trên production

- `docker-compose.prod.yml`: `UPLOAD_QUARANTINE_ENABLED: 'False'`, service `clamav`
  chuyển vào profile `scanner` nên `up` mặc định không chạy (trên VPS nó không chạy
  được ổn định). Upload session trả `UPLOAD_PIPELINE_DISABLED`, frontend tự quay về
  luồng upload cũ. Bật lại: đặt cờ `'True'` và chạy compose với `--profile scanner`.

#### Changed — Vừa đăng nhập Google thì tạo mật khẩu không cần mã email

- Tài khoản chưa có mật khẩu, trong 10 phút sau lần đăng nhập Google của phiên
  (`PASSWORD_SETUP_GOOGLE_MAX_AGE_SECONDS`), tạo mật khẩu không cần mã; quá hạn hoặc
  đăng nhập bằng Facebook/LinkedIn vẫn cần mã. Refresh token không làm mới mốc này.
- Migration `accounts.0007`: `AuthSession.oauth_provider`; phiên đang mở trước khi
  triển khai vẫn cần mã.

#### Added — Ảnh đại diện bài cẩm nang lấy từ đường dẫn

- Trình soạn bài có ô "Dán link ảnh": backend tải ảnh về media (mã hóa lại như ảnh
  tải từ máy) rồi hiển thị; bài chỉ lưu storage key, không trỏ sang máy chủ ngoài.
- `common/http/safe_fetch.py` chặn URL trỏ vào mạng nội bộ (SSRF), kể cả qua chuyển
  hướng, và dừng khi vượt giới hạn dung lượng ảnh.

#### Fixed — Banner cookie hiện lại mỗi lần tải trang dù đã chọn

- `GET /api/public/privacy/consent/` tốn lượt của scope `consent` (20/giờ): tải trang
  quá 20 lần/giờ (hoặc chung IP) thì đọc lựa chọn trả 429, frontend coi như chưa đồng ý.
  Scope nay chỉ tính lượt ghi (`WriteScopedRateThrottle`, khóa theo IP thật); lượt đọc
  chịu trần chung `/api/public`.

#### Fixed — Thiếu bản dịch tiếng Anh cho thông báo xác minh SĐT nhà tuyển dụng

- Bổ sung 3 bản dịch en trong `apps/employers` của `verify_employer_phone` (#402);
  `test_locale_catalogs[employers]` xanh trở lại.

#### Changed — Trang chủ tải nhanh hơn trên điện thoại, sửa một số lỗi hỗ trợ tiếp cận

- Ảnh nền trang trí hai bên khối tìm kiếm (hơn 400 KB, đang là phần tử LCP) chỉ tải
  từ màn hình 769px; linh vật hero chỉ dựng trên desktop.
- Carousel banner chỉ dựng slide đang xem, slide kế tiếp và slide đã xem.
- Sentry chỉ re-export `init` (bỏ Replay, Feedback khỏi chunk) và nạp sau `load`.
- Ảnh loader linh vật còn 40 khung hình, 160px (266 KB → 125 KB).
- Thêm nhãn cho nút mũi tên và ô chọn loại biểu đồ, tăng tương phản một số chữ xám,
  nới vùng bấm chấm chuyển banner lên 24px.

#### Fixed — Giao diện mobile: ô chat Connect trên iPhone, banner cookie, ô Địa điểm

- ProCV Connect: ô nhập trên màn hình cảm ứng dùng chữ 16px để iOS (Safari, Chrome)
  không tự phóng to khi chạm — phóng to làm ô soạn trượt dưới thanh công cụ trình
  duyệt và gõ bị giật. Ô soạn tự giãn bằng `field-sizing: content`; trình duyệt
  chưa hỗ trợ thì chỉ thu chiều cao khi chữ ngắn đi, không co/giãn ở mỗi phím.
- Banner cookie có nút ✕ trên điện thoại: ẩn trong phiên, không ghi lựa chọn
  (cookie tùy chọn vẫn tắt); dock so sánh việc làm hạ xuống theo.
- Viền ô "Địa điểm" ở tìm kiếm trang chủ đậm hơn trên mobile.

#### Fixed — Chạy thật trên VPS demo: compose prod, popup đăng nhập mobile; seed Cẩm nang và Trợ giúp

- Compose prod: nâng `mem_limit` theo số đo trên VPS 16 GB (email-worker 512 MB — trần
  256 MB làm healthcheck không chạy nổi và container khởi động lại liên tục; beat,
  realtime 384 MB; backend 1,25 GB); thêm service `clamav` và bật
  `UPLOAD_QUARANTINE_ENABLED` (hai cờ `*_UPLOAD_SESSION_REQUIRED` vẫn tắt).
- nginx miễn trừ thêm gateway `172.28.0.128`: Docker 29 lấy địa chỉ đầu của
  `ip_range` làm gateway, nên bước gọi thử của `deploy.sh` từng nhận 403.
- `sync_ml_models.sh` cấp quyền đọc cho mô hình sau khi rsync (`model.safetensors` 600
  từ máy dev làm ml-worker không nạp được) và nhận `SSH_KEY`.
- Popup đăng nhập trên điện thoại để giao diện tối: chữ trắng trên nền trắng. Lớp
  `dark` chỉ còn ở các trang dùng `AuthLayout` và chỉ khi người dùng tự chọn (bỏ suy từ
  giao diện hệ điều hành), gỡ khi rời trang; popup gọn hơn trên mobile.
- Thêm `seed_blog_posts` (30 bài Cẩm nang nghề nghiệp, 6 chuyên mục) và
  `seed_knowledgebase` (48 bài Trợ giúp cho ứng viên và nhà tuyển dụng), đi qua service
  biên tập như admin, chạy lại không nhân bản.
- Thêm `verify_employer_phone`: khi SMS OTP còn tắt, quản trị viên gọi xác nhận rồi ghi
  nhận số điện thoại cho NTD (ghi audit, chỉ lưu 3 số cuối; từ chối chạy khi SMS đã bật).
  Trước đó NTD mới không có cách nào xác thực số nên hồ sơ xác thực không duyệt được.

#### Removed — `featured_employers` khỏi `GET /api/public/jobs/stats/`

- Trang chủ đã lấy "Công ty nổi bật" từ danh bạ công khai; trường này không còn ai
  đọc nhưng vẫn trả `id` số nội bộ của công ty. Gỡ cả truy vấn (dashboard 6 → 5
  query), schema OpenAPI và mock test; khóa cache stats lên `v2`.

#### Fixed — Job `coverage` của Frontend CI chỉ gộp được một shard

- Bỏ `--shard` khiến mọi shard đặt tên blob report là `blob.json` và ghi đè nhau khi
  gộp; mỗi shard nay ghi `blob-<shard>-<tổng>.json`.

#### Changed — CI nhanh hơn: cache DB test đã migrate, cân shard bằng số đo CI

- Backend: shard nạp DB test đã migrate từ cache (khóa theo migration) thay vì
  `migrate` 60–90 giây ở mỗi shard.
- Frontend: 10 shard unit cân theo thời lượng đo trên CI (shard chậm nhất 164s → 106s
  phần chạy test); bảng thời lượng đọc thẳng từ blob report nên vẫn xuất được khi
  bước gộp đỏ. E2E 7 shard (desktop 3, tablet 2, mobile 2).

#### Changed — Tổ chức lại tài liệu, dọn code tương thích, CI chia shard theo thời lượng

- Tài liệu: ADR sang `docs/adr/` (có chỉ mục và trạng thái thay thế), kế hoạch đã
  xong, audit và decision log sang `docs/archive/`, 16 tài liệu đổi tên tiếng Việt.
  `docs/README.md` liệt kê đủ mọi tài liệu và CI chặn tài liệu mồ côi.
  `TIEN-DO-DU-AN.md` thành bảng trạng thái theo module, đối chiếu với PR đã gộp;
  bản cũ lưu nguyên ở archive.
- Frontend: bỏ 46 export thừa khỏi public API của slice, `formatDateTime` dùng chung
  thay 12 bản chép lại, 7 widget phẳng về `ui/`/`model/`, trang 404 vào lazy
  registry, `ARCHITECTURE.md` tách phần bản đồ sở hữu ra `docs/08-frontend/`.
- CI: backend tách `backend-static` và 3 shard `backend-tests` (pytest-split), cài
  dependency bằng uv. Unit test frontend chia 8 shard cân theo thời lượng từng file,
  E2E desktop chia đôi. Required check giữ nguyên tên.
- `scripts/`: kiểm tra axios chỉ trong `shared/api` chuyển vào
  `npm run check:architecture`; script riêng của CI vào `scripts/ci/`.

#### Removed — Endpoint và field tương thích không còn ai dùng

- `GET /api/employer/phone/check/` (giao diện đã không gọi từ lâu).
- `free_publish_limit`, `free_publish_remain` trong posting context (dùng
  `publish_limit`, `publish_remain`) và `onboarding_completed` trong tài khoản do
  admin quản lý (dùng `initial_onboarding.completed`).
- Biến môi trường cũ `CAMPAIGN_SOCIAL_PROVIDER=facebook`; dùng
  `CAMPAIGN_SOCIAL_LIVE_NETWORKS=facebook_page`.
- Bốn spec E2E ở gốc `tests/e2e/` không chạy trong CI; `router.spec.js` chuyển vào smoke.

#### Changed — Trang Tìm CV của NTD theo bố cục kho ứng viên

- Cột lọc trái (từ khóa có tất cả / một trong / không có, tỉnh, ngành nghề, ngoại ngữ + trình
  độ, kinh nghiệm từ–đến, cấp bậc, học vấn, chức danh, trường) và thẻ ứng viên ẩn danh: vòng
  điểm, mốc kinh nghiệm không tên công ty, học vấn, ngoại ngữ, kỹ năng khớp tin.
- Chọn nhiều để mời kết nối hàng loạt; chọn số dòng mỗi trang.
- API `GET /api/employer/candidate-search/` thêm tham số lọc, `page_size` và trường thẻ
  (`experience`, `experience_count`, `education`, `desired_positions`, `provinces`).

#### Changed — Hạn phiên đăng nhập riêng theo cổng (ADR-0033)

- Theo NIST SP 800-63B-4: ứng viên giữ đăng nhập tối đa 30 ngày (tự đăng xuất sau 7 ngày
  không hoạt động), NTD 24 giờ (1 giờ), admin 12 giờ (15 phút, access 5 phút). Hạn tối đa
  tính từ lần đăng nhập, refresh không gia hạn.
- Sửa lỗi ngưỡng không hoạt động không bao giờ chạy: refresh giờ cũng kiểm idle.
- Env: chín khóa `AUTH_<CỔNG>_{ACCESS_MINUTES,IDLE_MINUTES,MAX_AGE_HOURS}` thay cho
  `JWT_ACCESS_TOKEN_MINUTES`, `JWT_REFRESH_TOKEN_DAYS`, `ADMIN_ACCESS_TOKEN_MINUTES`,
  `AUTH_SESSION_IDLE_TIMEOUT_SECONDS`.

#### Changed — AI tạo tin điền đủ hơn

- Quyền lợi khi tạo bằng brief lấy từ ô *Quyền lợi* mới, ghi chú, hồ sơ công ty và quyền lợi
  bắt buộc theo luật; AI gợi ý thêm yêu cầu ngoại ngữ; tạo bằng JD tự điền lương và số lượng
  tuyển khi JD ghi rõ (đối chiếu con số với JD). Sửa ô kỹ năng hiện ID thay vì tên.

#### Added — AI chạy được bằng Claude

- `AI_PROVIDER_BACKEND=anthropic` + `ANTHROPIC_API_KEY`: AI soạn tin, nhập CV, bài đăng
  chiến dịch và CV mẫu chạy bằng Claude; đổi về Gemini chỉ cần sửa env. Hết credit (402)
  thì nhập CV và bài đăng chuyển sang cách dự phòng thay vì báo lỗi.

### 2026-11-25

#### Changed — Đăng nhập mạng xã hội mở cửa sổ popup trên desktop

- Google/Facebook/LinkedIn trên máy tính mở cửa sổ đăng nhập riêng, trang đang xem
  (kể cả modal đăng nhập ở trang việc làm) không bị tải lại. Mobile hoặc khi trình
  duyệt chặn popup vẫn chuyển trang như trước.
- `GET /api/auth/oauth/<provider>/start/` nhận thêm `mode=popup&nonce=`; trang callback
  frontend nhận thêm `popup=1&nonce=` ở chế độ này.

#### Security — Đăng nhập admin phải qua Cloudflare Access, production chặn cấu hình mẫu

- Khi đặt `CLOUDFLARE_ACCESS_TEAM_DOMAIN` + `CLOUDFLARE_ACCESS_AUD`, đăng nhập và làm mới
  phiên admin đòi JWT Cloudflare Access hợp lệ (lộ mật khẩu admin không đủ đăng nhập từ
  ngoài Access).
- `production.py` từ chối `SECRET_KEY` dạng `django-insecure…`, `*` trong `ALLOWED_HOSTS`,
  origin CORS không phải HTTPS. `safe_next` chặn `/\…`; reCAPTCHA production đòi `hostname`.
- Runbook sửa redirect URI OAuth, thêm hướng dẫn email (Resend/Brevo, DMARC) và tinh chỉnh
  Cloudflare; checklist go-live 2/12 (`docs/06-deployment/go-live.md`).

#### Fixed — Thỏa thuận xử lý DLCN ProCV–NTD không còn trỏ sang TopCV

- Link "Xem nội dung đầy đủ" ở bước Bảo vệ dữ liệu mở văn bản DPA của ProCV
  (`/documents/procv-thoa-thuan-xu-ly-dlcn-nha-tuyen-dung-2026-11.html`, phiên bản `2026-11`)
  thay cho URL tạm của TopCV trong `.env`. Hướng dẫn deploy ghi sẵn URL và SHA-256.

#### Security — Gia cố xử lý file tải lên

- DOCX ở nhập CV và DPA của NTD (đường upload trực tiếp) bị kiểm vỏ ZIP trước khi
  parse: ≤300 mục, ≤30 MB giải nén, `word/document.xml` ≤10 MB, tỉ lệ nén ≤100.
  Bộ kiểm dùng chung ở `common/files/docx.py`.
- Giấy tờ NTD tải trực tiếp được kiểm cấu trúc như đường phiên quét: PDF phải mở được
  ở chế độ strict, không mã hóa, tối đa 50 trang; ảnh phải giải mã được. Không còn nhận
  Word `.doc`; tệp `.doc` cũ không còn được dựng bản xem trước, chỉ tải về.
- Ảnh công khai luôn được mã hóa lại: bỏ EXIF/GPS, xoay đúng chiều, giữ hồ sơ màu;
  từ chối ảnh vượt 10.000 px mỗi cạnh, 40 MP hoặc 100 frame.
- LibreOffice dựng bản xem trước chạy với giới hạn bộ nhớ 2 GiB, CPU 30 s, bị giết cả
  nhóm tiến trình khi quá giờ; tối đa 2 lượt cùng lúc, hết chỗ thì trả tệp gốc.

#### Security — Trần ghi theo tài khoản cho mọi API ghi (ADR-0031)

- Mọi request ghi của người đã đăng nhập có trần theo tài khoản: 90/phút và 3000/giờ
  (admin 300/phút, 10000/giờ). Lượt đọc và khách không tính. Vượt trần trả 429 và log
  WARNING gồm scope + `user.pk`.
- View đã tự khai throttle giữ throttle cũ và gắn thêm trần (`with_account_write_cap`); 21
  thao tác rủi ro cao có scope riêng chỉ tính lượt ghi (tạo kỹ năng 20/giờ, tạo công ty
  20/ngày, nộp đơn 30/giờ, nhắc NTD 10/giờ, phát hành chiến dịch 10/giờ, yêu cầu dữ liệu cá
  nhân 10/ngày…).
- Miễn trần: lượt xem/hiển thị tin, sự kiện thông báo, vé WebSocket.
- Throttle ảnh bài đăng và xuất báo cáo chiến dịch không còn dùng chung một bucket.
- Test mới quét mọi route ghi: thiếu trần, sai scope hay scope chưa có rate đều làm CI đỏ.

#### Added — Sao lưu media công khai và báo cáo CSP qua Sentry

- `scripts/deploy/backup_files.sh` sao lưu thêm bucket `procv-public-media` sang
  `procv-backups-public-media` khi có `BACKUP_PUBLIC_FILES_REMOTE` (trống thì cảnh báo,
  bỏ qua); `restore_files.sh --bucket private|public`; `lib.sh` tách `_set_r2_remote`,
  thêm `set_public_remote`.
- Image `web` dựng `report-uri`/`report-to` + `Reporting-Endpoints` của CSP từ
  `VITE_SENTRY_DSN` lúc build (`frontend/docker/nginx/render-csp.sh`); CSP vẫn Report-Only.
  CI shellcheck thêm script này.

#### Changed — Mô tả site setting xác thực NTD và runbook go-live

- `employer_require_approved_verification`: nhãn/mô tả/trợ giúp nói đúng phạm vi (chỉ bước
  checklist onboarding; đăng tin công khai luôn cần hồ sơ đã duyệt + DPA). Chạy
  `seed_sitecontent` sau deploy để đồng bộ.
- Runbook deploy: Cloudflare Access cho `/admin*`, `/api/admin/*` (email OTP) + kiểm
  WebSocket admin, quota/inbound filter Sentry cho báo cáo CSP; runbook sao lưu: bucket
  `procv-backups-public-media`, token, khôi phục `--bucket public`.

#### Changed — Tải trang đầu nhẹ hơn

- Bundle đầu còn 9 file JS, 252 KiB gzip (trước 78 file, 333 KiB): thư viện trang đầu gom
  vào chunk `vendor`, barrel `index.js` của slice khai báo không side effect nên form đăng
  nhập không còn nằm trong bundle đầu. Ngân sách hạ về 256 KiB JS, 35 KiB CSS.
- 7 ảnh PNG lớn trên R2 (trang chủ, blog, onboarding, CV online; ~3,1 MB) chuyển sang
  WebP trong `public/images` (177 KB).
- Nginx gửi file `.gz` nén sẵn mức 9 (`gzip_static`); Vite dev biên dịch sẵn trang chủ khi khởi động.

#### Fixed — API công khai có cache trả 500 khi chạy với Redis

- `cache_public_get` (#349) lưu cache bằng callback sau render trả về kết quả `cache.set`;
  Django thay response bằng giá trị đó, và django-redis trả `True`, nên danh mục nghề,
  địa điểm, địa điểm việc làm tốt nhất… trả 500 ở môi trường dùng Redis (dev docker,
  production). Callback giờ không trả giá trị; thêm test với cache trả `True`.

#### Changed — Điều hướng cổng ứng viên trên mobile

- Thanh tab dưới (Trang chủ, Việc làm, Tạo CV nổi ở giữa, Cẩm nang, Tài khoản) thay cụm
  avatar/tin nhắn/đăng nhập trên header ở màn < 768px; header mobile còn logo, nút
  "Danh mục", tìm việc và chuông. Tab Tài khoản mở tấm trượt từ đáy.
- Chuông thông báo ứng viên mở dạng tấm trượt từ đáy trên mobile, popover làm lại trên
  desktop (số chưa đọc ở tiêu đề, trạng thái rỗng mới).
- Hủy được đăng nhập trên mobile: tab Tài khoản mở popup đăng nhập tại chỗ; trang
  đăng nhập/đăng ký ứng viên có nút ✕ quay lại trang trước (hoặc trang chủ).
- Cụm nút nổi Việc làm đã lưu/Góp ý/Hỗ trợ trên mobile gom thành một nút, bấm mới bung
  lên có hiệu ứng; desktop không đổi.
- Trang Cài đặt bảo mật ứng viên làm lại (tổng quan email/mật khẩu, thiết bị, quyền dữ liệu);
  mục menu "Cài đặt thông tin cá nhân" đổi tên thành "Hồ sơ cá nhân".
- Tài khoản đăng nhập bằng mạng xã hội tạo mật khẩu lần đầu bằng mã 6 số gửi qua email thay
  cho đăng nhập lại Google/Facebook (`POST /api/auth/password/setup-code/`, `email_code`).
- Thanh tab tự ẩn ở trang có thanh hành động riêng (chi tiết tin, mẫu CV, trang công ty);
  nút nổi và dock so sánh việc làm nâng lên theo `--page-bottom-bar-height`.

#### Added — Lời mời kết nối của NTD cho ứng viên

- Tìm CV: nút đổi thành "Mời kết nối"; ứng viên đồng ý hoặc từ chối ở trang mới
  `/tai-khoan/nha-tuyen-dung-muon-ket-noi` (menu Quản lý CV). NTD nhận thông báo kèm mã ẩn danh
  và thấy "Đã kết nối"/"Đã từ chối"; nút "Nhắn tin" giữ chỗ, chưa hoạt động.
- API `GET /api/candidate/connection-invitations/`,
  `POST /api/candidate/connection-invitations/<public_id>/respond/`; trường `status`,
  `responded_at`, `public_id` cho `CandidateSearchInvitation`; thông báo `connection_invitation`
  (ứng viên), `search_invitation_accepted`/`search_invitation_declined` (NTD).
#### Changed — Thứ tự và nhãn tin tuyển dụng công bằng (ADR-0030)

- Bỏ hạng tin `tier` và nhãn gán tay HOT/GẤP/"Tài trợ" cùng thẻ tô màu; chỉ còn nhãn hệ
  thống "Sắp hết hạn" (`job_closing_soon_days`) và "Phản hồi nhanh".
- Mọi bề mặt xếp theo một mốc là lần đăng đầu; mở lại tin không còn đẩy tin lên trang
  chủ, gợi ý hay email báo việc.
- `/viec-lam`: sắp xếp Mới đăng / Lương cao nhất / Sắp hết hạn nộp (`ordering=closing_soon`,
  bỏ `urgent`); thêm ô "Việc không cần kinh nghiệm" và nút "Tìm việc gần tôi".
- **Breaking API:** `tier`, `is_hot`, `is_urgent`, `tier_label` và các trường
  `presentation.sponsored/card_tone/display_reason/placement/active_until` bị gỡ;
  `presentation` chỉ còn `labels`. Bỏ chủ đề tư vấn `service_packages`.

#### Added — Trang Danh mục dữ liệu cho admin

- `/admin/app/catalog` (mục Nội dung), 5 tab: Kỹ năng, Ngành nghề, Phúc lợi, Lĩnh vực công ty,
  Ngôn ngữ. Bảng + ngăn kéo sửa; ẩn/hiện áp dụng ngay kèm Hoàn tác 15 giây; số tin/CV/công ty
  đang dùng trên từng dòng; danh sách thẻ trên điện thoại; chuỗi vi/en.
- Kỹ năng: dải "Cần dọn" (chưa có nhóm, có thể trùng), gán nhóm ngay trên dòng và hàng loạt,
  "Lưu & tiếp", gộp kỹ năng có xem trước (chỉ superuser; chuyển tin, CV, nhu cầu tìm việc và
  `profile_json` của tài liệu đối sánh), quản lý nhóm kỹ năng (khóa hai nhóm hệ thống).
- Ngành nghề: bảng cây ba cấp, tìm không dấu tự mở nhánh, cấp suy ra từ mục cha, tên tiếng
  Anh (`JobCategoryLocalization`), icon nhóm nghề.
- API `/api/admin/skills/`, `/api/admin/skills/groups/`, `/api/admin/jobs/categories/`
  (+ `icon/`), `/api/admin/jobs/benefits/` (+ `reorder/`), `/api/admin/jobs/languages/`,
  `/api/admin/industries/`; mọi thao tác ghi audit.
- `Skill.source`, `Industry.is_active` (ô chọn lĩnh vực của hồ sơ công ty chỉ còn mục đang mở).

#### Removed — Trang Django admin trùng lặp của danh mục

- Gỡ trang Django admin của Skill, SkillGroup, Benefit, Language, Industry và form sửa
  JobCategory (giữ bản chỉ-xem cho autocomplete); sửa danh mục giờ chỉ qua cổng quản trị.

#### Fixed — Slug danh mục trùng nhau

- Tên cho cùng slug ("C", "C++", "C#") không còn làm lỗi 500 khi NTD hoặc admin thêm kỹ
  năng, ngành nghề, lĩnh vực: slug tự thêm hậu tố (`common/db/slugs.py`).

#### Added — Việc làm gần tôi (ADR-0029)

- Trang `/viec-lam-gan-ban`: bản đồ (MapLibre, nạp lazy) + danh sách sắp theo khoảng cách,
  bán kính 3/5/10/20/50 km, lấy vị trí bằng GPS, chọn phường/xã, nhập địa chỉ hoặc bấm/kéo
  ghim; lọc ngành nghề, mức lương, gồm việc từ xa; nhóm "Tuyển khắp tỉnh"; gợi ý mở rộng
  bán kính khi trống. Lối vào ở header và trang chủ; chi tiết tin có bản đồ nơi làm việc và
  "Cách bạn x km".
- API `GET /api/public/jobs/nearby/`, `/nearby/map/`, `/api/public/locations/geo/*`
  (autocomplete, place, wards); site settings `nearby_jobs_*`, `map_style_url`,
  `map_attribution`; env `GEOCODING_*` (VietMap/Goong/Nominatim).
- Tọa độ: tâm 34 tỉnh + 3.321 phường/xã (`seed_location_coordinates`), `JobLocation` có
  tọa độ/độ chính xác, ghim tùy chọn của NTD trong form đăng tin, geocode nền có cache,
  lệnh `refresh_job_coordinates` để backfill.

#### Fixed — Mất 5 phường trung tâm Hà Nội khi seed địa điểm

- Mã phường từ nguồn seed là số trần (Ba Đình = 4, Giảng Võ = 25…) trùng mã tỉnh nên ghi đè
  lẫn nhau. Mã phường nay đệm 5 chữ số (migration `locations.0002` cho dữ liệu cũ).
- `Permissions-Policy` cho phép định vị trên chính site (`geolocation=(self)`).

#### Changed — Hồ sơ trích xuất đầy đủ (`extract-v4`) và giải thích mức phù hợp

- `profile_json` thêm `sections`: nội dung đầy đủ từng mục của CV (tóm tắt, từng công việc kèm
  mô tả, dự án, học vấn, kỹ năng, chứng chỉ, giải thưởng, hoạt động, ngoại ngữ, sở thích, thông
  tin thêm), đã bỏ email, số điện thoại, phần đầu trang và người tham chiếu. Hiển thị ở "Hồ sơ
  NTD nhìn thấy", ở cột giữa màn xử lý hồ sơ (chuyển "CV gốc | Hồ sơ trích xuất", API
  `/api/employer/applications/{id}/extracted-profile/`) và ở xem nhanh của Tìm CV (che họ tên
  trong câu văn, không có mục "Thông tin thêm").
- Bộ đọc PDF tải lên: dòng "Kỹ năng …" dưới tiêu đề Kỹ năng là một kỹ năng (trước bị coi là
  tiêu đề nên mất); nhận thêm tiêu đề "Danh hiệu và giải thưởng", "Người giới thiệu", "Thông
  tin thêm", kể cả khi tiêu đề bị ngắt hai dòng; phần nội dung của một cột chạy sang trang sau
  được ghép về đúng cột; tên/chức danh đặt trên cột phải được đưa về đầu tài liệu; bỏ dòng chân
  trang. Trên 51 PDF mẫu: kinh nghiệm PDF hệ thống 93% → 100%, chức danh PDF TopCV 29 → 32/36,
  các chỉ số khác giữ nguyên.
- Cổng NTD: chip mức phù hợp bấm được, mở bảng "vì sao" (điểm từng tiêu chí kèm lý do, kỹ năng
  có/thiếu kèm câu trích, cách tính điểm) ở bảng CV của tin, bảng CV của chiến dịch (thêm cột và
  sắp xếp "Phù hợp nhất") và đầu panel "Xử lý hồ sơ". Panel này giữ nguyên các mục cũ (liên hệ,
  thông tin ứng tuyển, đánh giá, lịch sử); bản chia ba tab đã bỏ.
- Sửa: ứng viên không xóa được CV sau khi NTD xem hồ sơ ở Tìm CV (nhật ký truy cập chặn việc
  xóa phiên bản CV).

#### Added — Tìm CV: nhà tuyển dụng tìm ứng viên theo một tin

- Nút **Tìm CV** trên header và mục "Tìm CV" ở thanh bên cổng NTD mở trang
  `/tuyendung/app/candidate-search`: chọn tin đang tuyển, lọc theo chức danh, kinh nghiệm, học
  vấn; danh sách ứng viên ẩn danh xếp theo mức phù hợp (`hybrid-v2`); **Xem nhanh** hiện hồ sơ
  trích xuất và mức phù hợp theo tiêu chí; **Mời ứng tuyển** gửi thông báo cho ứng viên.
- API `/api/employer/candidate-search/` (danh sách, chi tiết, mời). Chỉ gồm ứng viên đang bật
  một CV cho NTD tìm kiếm, còn đồng ý, không bị công ty chặn. Không trả tên, liên hệ, tệp CV,
  tên công ty cũ hay câu trích. Mỗi lần xem nhanh ghi `CvAccessLog` kênh `recruiter_search`.
- Model `CandidateSearchInvitation` (một lời mời cho mỗi ứng viên và tin); cờ
  `ai_candidate_search_enabled`; giới hạn tần suất tìm và mời.

#### Changed — Mỗi ứng viên chỉ bật một CV cho NTD tìm kiếm; thêm "Hồ sơ NTD nhìn thấy"

- Ràng buộc `uq_user_searchable_cv` (migration `cvs.0003`): ứng viên đang bật nhiều CV thì giữ
  CV chính nếu nó đang bật, không thì CV cập nhật gần nhất. Bật CV khác thì CV cũ tự tắt.
- `GET /api/candidate/matching/cv-profiles/{cv_public_id}/`: hồ sơ trích xuất từ CV (chức
  danh, kỹ năng theo nhóm, kinh nghiệm, học vấn, cấp bậc, ngoại ngữ), qua danh sách trắng
  trường; không trả chữ nguyên văn ngoài các mục liệt kê.
- Trang "CV của tôi" và thanh bên tài khoản: chọn một CV, nút "Xem hồ sơ NTD nhìn thấy" mở
  hộp thoại hai cột CV | hồ sơ trích xuất (màn hẹp: hai tab). Hồ sơ chỉ đọc.

#### Added — Mức phù hợp của hồ sơ ở cổng nhà tuyển dụng (giao diện)

- Bảng "CV ứng tuyển" của một tin có cột **Phù hợp** và lựa chọn sắp xếp "Phù hợp nhất"
  (mặc định vẫn là mới nhất, lựa chọn được nhớ). Hồ sơ chưa có điểm ghi rõ lý do.
- Màn xử lý hồ sơ: thẻ hồ sơ có chip điểm; panel bên phải chia ba tab Đánh giá | Thông
  tin | Hoạt động, tab Đánh giá hiện điểm tổng, năm tiêu chí, kỹ năng có/thiếu kèm câu
  trích từ CV và dòng "quyết định là của bạn".
- Bộ hiển thị dùng chung `entities/application/job-fit` cho cả hai cổng; hộp thoại "Xem độ
  phù hợp" của ứng viên dùng chung nhãn. Một màu nhấn, mức phù hợp thể hiện bằng chữ.

#### Added — AI xếp hạng hồ sơ ứng tuyển cho nhà tuyển dụng (backend)

- Hồ sơ ứng viên đồng ý phân tích AI được chấm trên **bản CV đã nộp** ngay sau khi nộp
  (queue nền `ai-matching-batch`, cùng `ml-worker`); tin đổi nội dung thì các hồ sơ của tin
  được chấm lại. `MatchAnalysis.purpose` tách bản chấm cho NTD khỏi lượt ứng viên tự xem.
- `GET /api/employer/applications/` thêm `ai_match_score`, `ai_match_level`,
  `ai_match_status` và `ordering=ai_match`; endpoint chi tiết
  `/api/employer/applications/{id}/ai-match/`. Sắp xếp mặc định vẫn là mới nhất, không có
  bước nào tự loại hồ sơ theo điểm.
- Cờ `ai_application_ranking_enabled` (nhóm AI); lệnh `matching_backfill --only applications`.
- Form ứng tuyển: ô đồng ý ghi rõ kết quả hiện cho nhà tuyển dụng, giữ lựa chọn của lần
  ứng tuyển gần nhất.
- Sửa: bản chụp của CV tải lên được đọc từ tệp đã nộp, không phải tệp hiện tại trong thư
  viện; CV đã bị xóa khỏi thư viện vẫn chấm được.

#### Changed — Công thức chấm độ phù hợp `hybrid-v2`

- Bỏ tiêu chí địa điểm; tắt khớp kỹ năng "viết khác tên" với mô hình chưa fine-tune; học
  vấn, cấp bậc, ngoại ngữ chỉ được tính đủ vào điểm tổng khi CV đúng lĩnh vực của tin (hệ số
  liên quan `min(1, R/50)`). Điểm từng tiêu chí vẫn hiện giá trị thật.
- Trên validation: Spearman 0,603 → 0,699, NDCG@5 0,815 → 0,857; cặp khác ngành trung vị
  28 → 11 điểm, cao nhất 65 → 46, không còn cặp nào từ 50 điểm.
- `result_json` thêm `schema_version = 2`, `overall.relevance`,
  `flags.relevance_discount_applied`; không còn mục `location` trong `components`.
- `matching_evaluate --detail` và `--ablation`; `ml/scripts/evaluate.py --ablation`.

#### Changed — Phễu tuyển dụng trên trang chủ NTD

- Thẻ donut "Trạng thái hồ sơ" thay bằng phễu 3D (SVG): Nhận hồ sơ → Phù hợp → Phỏng vấn
  → Trúng tuyển, thêm tầng Không phù hợp; nhãn kèm tỉ lệ so với tổng hồ sơ nhận.
- `GET /api/employer/dashboard/` thêm `funnel`: số hồ sơ hiện có đã tới từng bước (theo
  `*_at`), nên hồ sơ phỏng vấn rồi bị loại vẫn tính ở bước phỏng vấn.
- Khối "Hoàn thiện workspace tuyển dụng" ẩn khi đủ 5 bước xác thực.

#### Changed — Huy hiệu Sấm Chớp tính từ mức phản hồi thật (ADR-0027)

- `Job.has_flash_badge` không còn do admin tick tay. Task mỗi giờ (`refresh-flash-badges`)
  đo từng người đăng tin: đủ hồ sơ đến hạn, tỷ lệ quyết định trong hạn, có quyết định gần
  đây. Tin nào có hồ sơ chờ quá hạn thì không mang huy hiệu.
- Ảnh chụp `RecruiterResponsiveness`; 6 key `flash_badge_*` trong Cấu hình hệ thống.
- NTD: thẻ tiến độ trên dashboard, thông báo đạt, mất và sắp mất huy hiệu.
- Ứng viên: banner trang chủ bỏ đồng hồ đếm ngược giả; bộ lọc "Nhà tuyển dụng phản hồi
  nhanh"; số liệu thật ở chi tiết tin; +2 điểm trong "Việc làm tốt nhất"; nhãn GẤP đổi
  icon để không trùng tia sét.

#### Added — Mã tin và mã công ty dễ đọc

- `Job.code` (`J` + 7 chữ số) và `Company.code` (`C` + 6 chữ số): ngẫu nhiên, unique, có
  check constraint; migration gán mã cho dữ liệu cũ. `public_id` giữ nguyên cho API và slug.
- Admin tìm tin/công ty theo mã, NTD tìm tin theo mã; bỏ dấu ngăn cách khi đọc mã theo nhóm.
- `CodeBadge` dùng chung (monospace + nút sao chép) ở cổng admin và NTD; CSV admin xuất mã mới.

### 2026-11-24

#### Changed — Câu báo email đã được dùng khi đăng ký và đổi email

- Đăng ký và đổi email báo "Email này đã được sử dụng cho một tài khoản khác." thay cho
  "…cho một tài khoản cùng loại.", không để lộ cách hệ thống chia tài khoản theo cổng.
  Bản tiếng Anh: "This email is already associated with an account."

#### Added — Bộ file triển khai production procv.site

- `docker-compose.prod.yml` cho một VPS: PostgreSQL/Redis không mở cổng ra ngoài, service
  `migrate` chạy trước backend và worker, gunicorn, worker Celery tách queue như dev, giới hạn
  RAM từng service; giá trị theo domain đặt trong compose, bí mật đọc từ `backend/.env`.
- `frontend/Dockerfile` build SPA và phục vụ bằng nginx: route SEO, `/api`, `/r` về Django,
  còn lại là SPA; cổng nội bộ 8080 cho SEO shell và trang in CV; IP thật qua Cloudflare.
- `scripts/deploy/`: deploy/rollback theo commit, sao lưu PostgreSQL hằng ngày lên R2,
  khôi phục, khởi tạo VPS Ubuntu, đồng bộ mô hình đối sánh.
- Viết lại `docs/06-deployment/huong-dan-deployment.md` thành runbook triển khai.

### 2026-11-22

#### Changed — Mã tài khoản 8 chữ số cho ứng viên, NTD và admin

- `User.public_id` đổi từ `usr_<12 hex>` sang 8 chữ số ngẫu nhiên (vd `48261937`), dễ
  đọc qua điện thoại; không tăng dần nên không đoán được số lượng tài khoản. Migration
  đổi mã toàn bộ tài khoản cũ và cập nhật nhật ký quản trị theo mã mới.
- "Mã NTD" ở dashboard và email NTD dùng mã tài khoản thay cho mã hồ sơ NTD `rec_…`;
  API dashboard NTD đổi `account.recruiter_public_id` thành `account.public_id`.
- Ô tìm kiếm tài khoản của admin chấp nhận mã gõ theo nhóm ("4826 1937").

#### Fixed — Ảnh đại diện khi đăng nhập Google

- Ảnh Google/Facebook/LinkedIn được tải về storage nội bộ lúc đăng nhập thay vì lưu URL
  ngoài (Google chặn ảnh khi trình duyệt gửi Referer). Không ghi đè ảnh người dùng tự tải
  lên; tài khoản cũ có URL Google được sửa ở lần đăng nhập kế tiếp.

### 2026-11-21

#### Changed — Cắt ảnh banner và thêm tông màu

- Chọn ảnh banner mở hộp cắt khóa tỉ lệ (8:3 cho slide ảnh trang chủ, 4:3 cho ảnh minh họa):
  kéo, phóng to để căn khung rồi tải lên bản WebP. Ảnh tối thiểu hạ còn 960×360 nên banner
  thiết kế sẵn rộng 1000 px dùng được.
- Sửa lỗi tải ảnh báo "undefined" khi tạo banner mới (loại slide chưa vào form).
- 8 tông gradient hiện đại (thêm tím, ngọc lam, hồng đỏ, cực quang, đêm) dùng chung cho
  carousel, banner trang việc làm và cẩm nang; trang quản trị chọn tông bằng ô màu.

#### Added — Carousel banner trang chủ động, nhiều loại slide

- Bốn loại slide: ảnh + link (cả slide là ảnh thiết kế sẵn), nhà tuyển dụng nổi bật (ảnh
  bìa, logo, số tin đang tuyển thật), gợi ý việc làm AI (ứng viên thấy số việc hợp CV),
  bố cục chữ. Banner có lịch bắt đầu/kết thúc, xoay vòng theo thứ tự.
- Trang quản trị **Banner quảng bá** thay cho Django admin: tải ảnh có kiểm tra tỉ lệ,
  chọn công ty, kéo thả sắp thứ tự, bật/tắt, xem trước, audit.
- Carousel hiện trên điện thoại (khung 2:1, vuốt để chuyển); dừng khi focus và tôn trọng
  giảm chuyển động. API công khai trả thêm `kind`, CTA phụ và công ty lồng nhau.

#### Changed — Luật tuyển dụng và lưu trữ chỉnh được ở trang cấu hình (ADR-0026, GĐ5)

- **Ứng tuyển & SLA:** admin chỉnh số lần nộp mỗi tin, thời gian chờ nộp lại, thời hạn
  tự từ chối mặc định cho tin mới, thời gian nhắc trước, khoảng chờ email kết quả, khoảng
  hoàn tác thông báo, các mốc nhắc nhà tuyển dụng, nút nhắc của ứng viên và hạn link chia
  sẻ hồ sơ. Giá trị lạ bị kẹp vào khoảng an toàn; form của ứng viên và NTD đọc cùng giá trị.
- **Tin tuyển dụng:** hạn nhận hồ sơ mặc định/tối đa, thời gian hiển thị, thời gian gia
  hạn và thời gian chống đếm trùng lượt xem chuyển từ `.env` (`JOB_POSTING_*`,
  `JOB_VIEW_DEDUP_TTL_SECONDS`) sang cấu hình; trần cứng 90 ngày giữ trong mã nguồn.
- **Nhà tuyển dụng:**
  - Công tắc bắt buộc duyệt hồ sơ xác thực (chỉ siết thêm cờ máy chủ).
  - Chế độ dấu tick (shadow/enforce), số lần bị từ chối trước khi khoá nộp lại, lý do
    báo cáo làm mất tick, độ dài tối thiểu mô tả công ty (form NTD đọc cùng giá trị).
  - Một SLA cho hàng chờ xác thực/cập nhật công ty và một SLA cho báo cáo vi phạm, dùng
    chung ở bảng điều khiển, danh sách tài khoản và hàng chờ xác thực.
- **Chia sẻ CV:** tắt được; tắt thì mọi link đang có ngừng mở. Link mới có hạn mặc định,
  không đặt quá hạn tối đa; link cũ không hạn hết hiệu lực khi quá hạn tối đa.
- **Lưu trữ dữ liệu:** thời gian giữ kho ứng viên, thông báo ứng viên, file nguồn import
  CV và lịch sử email gợi ý việc làm chỉ rút ngắn được, có mức sàn.
- **Đăng nhập:** admin tắt bớt Google/Facebook/LinkedIn theo từng cổng (nút và API cùng
  chặn); hạn lời mời quản trị viên chỉnh được.
- **Sửa CI:** cổng cấu trúc backend đỏ từ GĐ1/GĐ3 — audit ghi qua
  `AdminAccessAuditLog.objects.record()`, middleware bảo trì chuyển vào `sitecontent/api/`.

#### Changed — Email, AI và gợi ý việc làm theo cấu hình (ADR-0026, GĐ4)

- **Email:**
  - Mọi email hệ thống dùng chung tên người gửi, địa chỉ trả lời (email hỗ trợ) và màu
    thương hiệu trong cấu hình. Trước đây email gợi ý việc làm, tự động từ chối và báo
    cáo tuần gửi bằng tên trong `.env`; email xác thực, chào mừng, đặt lại mật khẩu và
    gợi ý việc làm viết cứng màu `#00b14f`.
  - Công tắc "email nghiệp vụ" chặn thêm email nhắc/kết quả tự động từ chối và báo cáo
    tuần chiến dịch. Email bỏ qua khi tắt không gửi bù.
  - Email chào mừng tắt được.
- **Email gợi ý việc làm:** công tắc riêng; giờ gửi, số tin mỗi email và số thông báo
  việc làm mỗi ứng viên chỉnh được. Thêm công tắc nhắc nhà tuyển dụng về hồ sơ chưa
  phản hồi.
- **AI:**
  - Import CV dùng chung runtime AI với tạo tin (`AI_CV_IMPORT_MODEL`): có log
    invocation, theo `AI_RUNTIME_ENABLED`, không còn gọi thẳng REST của
    Gemini/OpenAI/Anthropic.
  - Gỡ `ai_provider`, `ai_model`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`.
  - `ai_enabled` là công tắc chung cho import CV, viết tin và viết bài chiến dịch. Khi
    tắt, CV được đọc bằng bộ trích xuất quy tắc thay vì báo lỗi.
- **AI viết bài chiến dịch:** có công tắc và hạn mức lượt mỗi ngày.
- **Lựa chọn model tạo tin** lấy từ `AI_JOB_GENERATION_MODEL_ALLOWLIST` của máy chủ.

#### Changed — Cấu hình hệ thống chạy thật ở các cổng (ADR-0026, GĐ3)

- **Chế độ bảo trì:**
  - API cổng ứng viên, nhà tuyển dụng và API công khai trả 503; trang SEO trả 503 kèm noindex.
  - Frontend hiện màn bảo trì, kể cả khi API mới báo 503 mà bản cấu hình đã tải còn cũ.
  - Trang quản trị vẫn dùng được.
- **Tạm dừng đăng ký** ứng viên hoặc nhà tuyển dụng: chặn ở form và ở lần đăng nhập mạng
  xã hội đầu tiên; trang đăng ký hiện thông báo kèm link đăng nhập.
- **Trang chủ:** ẩn/hiện từng khối (carousel, ngành nghề, việc làm tốt nhất, thống kê,
  mẫu CV) và đổi số tin "Việc làm tốt nhất".
- **Sửa lỗi:** số liệu và logo đối tác ở trang nhà tuyển dụng không bao giờ hiện, vì giá
  trị mảng bị đọc như chuỗi.
- **SEO:** trang chủ dùng mô tả admin cấu hình ở cả server lẫn frontend; ảnh chia sẻ đã
  upload dùng URL `/media/` đúng, khi trống thì dùng logo.
- **Nhận diện:**
  - Layout đăng nhập/thiết lập của NTD theo màu thương hiệu.
  - Footer NTD theo công tắc mạng xã hội và liên hệ.
  - Khối hotline trang chủ dùng hotline/email trong cấu hình thay số viết cứng.
  - Các fallback liên hệ dùng chung một nguồn mặc định.
- **Pháp lý:**
  - Link điều khoản/bảo mật ở form đăng ký ứng viên và link hướng dẫn DPA chuyển thành
    cấu hình, không còn trỏ sang topcv.vn.
  - Bỏ URL DPA mặc định của bên thứ ba.
  - Phiên bản đồng ý của ứng viên do server gán.
- **Tính năng:** admin tạm đóng được Trung tâm trợ giúp, việc index và từng nơi hiện
  thông báo đa cổng, nhưng không mở vượt cấu hình máy chủ. Thêm kiểu cấu hình
  `multiselect`.
- **Hạn mức đăng tin:** thông báo hết lượt dùng hạn mức Cấp 3 thật thay số "100".

#### Changed — Giao diện mới trang Cấu hình hệ thống (ADR-0026, GĐ2)

- Thanh bên chia 3 khu kèm ô tìm kiếm trên mọi nhóm. Trên mobile, thanh bên thành
  dải chip cuộn ngang.
- Nút "?" ở mỗi mục giải thích tác dụng, nơi áp dụng và giá trị mặc định (có nút
  "Đặt về mặc định"), kèm key và lịch sử thay đổi
  (`GET /api/admin/site/settings/{key}/history/`).
- Lưu một lần cho mọi nhóm:
  - thanh lưu dính đáy màn hình, hoàn tác được từng mục;
  - hỏi lại trước khi bật bảo trì, tắt đăng ký, tắt index, tắt email;
  - lỗi hiện ngay dưới mục bị lỗi.
- Editor dạng danh sách cho số liệu và logo đối tác; ô nhập dạng thẻ cho allowlist;
  bộ đếm ký tự cho ô có giới hạn độ dài.
- Xem trước thương hiệu (kèm độ tương phản WCAG), kết quả Google và dòng bản quyền.
- Bảng Thông số hệ thống chỉ đọc nằm ở nhóm Vận hành.
- Toàn bộ chuỗi giao diện của trang đã chuyển sang vi/en.

#### Changed — Hợp đồng cấu hình hệ thống (ADR-0026, GĐ1)

- Gỡ 46 site setting không có code nào đọc. Một số trong đó còn ghi giá trị trái với
  hệ thống:
  - toàn bộ nhóm thanh toán, bảo mật, upload, tin tuyển dụng;
  - phần lớn nhóm CV;
  - các key `env`.
- Thông số bảo mật/upload/email/AI runtime thật hiển thị ở API chỉ đọc
  `GET /api/admin/site/system-parameters/`; secret chỉ báo "đã/chưa cấu hình".
- Gom key vào 17 nhóm, thuộc 3 khu:
  - Giao diện & nội dung;
  - Nghiệp vụ tuyển dụng;
  - Tuân thủ & vận hành.
- Mỗi key có `section` và `help` (nội dung nút "?"); API admin trả thêm `default_value`.
  Link `?group=` của nhóm cũ vẫn mở đúng nhóm.
- `seed_data/settings.json` là nguồn default duy nhất. Key blog và
  `cv_builder_wysiwyg_enabled` được đưa vào seed. Logo mặc định đổi sang `.webp`, vì
  bản `.png` đã bị xoá.
- Gộp 4 helper đọc setting thành `apps.sitecontent.selectors`. Map cấu hình được cache
  và xoá sau commit; code trong transaction đọc thẳng DB.
- Server kiểm tra thêm URL, email, `max_length` và JSON `schema`. Upload ảnh cấu hình
  có ghi audit. Django admin chỉ còn quyền xem SiteSetting.
- Test hợp đồng (`test_settings_contract.py`) chặn hai trường hợp: key trong seed không
  có code đọc, và code đọc key không có trong seed.

### 2026-11-20

#### Changed — Trang "Việc làm phù hợp" và bật/tắt gợi ý việc làm

- Bật hay tắt "Gợi ý việc làm" đều hỏi lại bằng popup (đồng ý kèm liên kết chính sách AI;
  tắt thì nói rõ hệ thống ngừng phân tích CV).
- Tắt gợi ý bằng AI vẫn có danh sách nhưng không đọc CV: xếp theo nhu cầu đã khai, hoặc tin
  mới nhất khi chưa khai (`latest-v1`); API thêm `ai_recommendation_enabled`, trang hiện
  khung "Gợi ý việc làm đang tắt" kèm nút bật lại. Khối gợi ý ở trang chủ ẩn khi tắt.
- Giao diện mới: đầu trang có mascot, "Tìm thấy N việc làm…", thẻ tin có "Vì sao phù hợp?"
  (chú thích liệt kê lý do), "Ứng tuyển" (mở form ứng tuyển ở trang tin qua `?ung-tuyen=1`),
  ẩn tin, lưu tin.

#### Added — Công tắc "Gợi ý việc làm" ở thanh bên tài khoản ứng viên

- Bật/tắt đồng ý gợi ý việc làm bằng AI ngay ở thanh bên, độc lập với nhu cầu công việc
  (`GET/PATCH /api/candidate/ai-recommendation/`, ghi `CandidateConsentEvent` nguồn
  `account_sidebar`; không đánh dấu đã khai nhu cầu).
- Biểu tượng "?" giải thích chức năng và trỏ tới văn bản chính sách xử lý dữ liệu bằng AI
  qua cài đặt quản trị mới `ai_data_policy_url` (để trống thì không hiện liên kết).

#### Added — Việc làm gợi ý theo ngữ nghĩa (kế hoạch bản 3, GĐ 4)

- "Việc làm phù hợp" và trang lưu CV xếp tin theo độ gần ngữ nghĩa với CV (`semantic-v1`,
  pgvector, vector tính sẵn); rơi về gợi ý theo luật khi chưa có vector hoặc cờ tắt.
- Cài đặt mới `ai_job_recommendation_semantic_enabled` (mặc định bật).
- `MatchDocument.is_current` (**migration** `matching.0002`, điền cờ cho dữ liệu cũ).
- Trang lưu CV hiện lý do gợi ý thay cho thẻ "+điểm".
- Nhu cầu đã khai lái gợi ý theo ngữ nghĩa: tin đúng vị trí mong muốn luôn được xét và xếp
  trên (người đổi nghề), điểm cộng nhỏ cho tỉnh, lương, kinh nghiệm, kèm lý do. API gợi ý
  thêm `cv_recommendations_enabled`; trang chủ hiện gợi ý cả khi chưa khai nhu cầu.
- `matching_evaluate_recommendations` và `ml/scripts/evaluate_recommendations.py`.

#### Changed — AI đối sánh: trích xuất `extract-v3` (kế hoạch bản 3, GĐ 2)

- PDF được đọc theo vị trí chữ (`apps/cvs/services/pdf_layout.py`): mẫu CV hai cột
  không còn để tiêu đề mục rời khỏi nội dung. Áp dụng cho cả bước nhận dạng CV tải lên.
- Khoảng ngày viết liền, in thành hai dòng, "tháng 9 năm 2021", "T9/2021"; khoảng chỉ
  ghi năm tính từ giữa năm; từ khóa bằng cấp, ngoại ngữ so theo ranh giới từ.
- CV tải lên có chức danh (`title`); cấp bậc lấy theo việc gần nhất.
- Danh mục kỹ năng: công cụ cụ thể tách khỏi khái niệm chung (PyTorch ≠ Deep Learning…);
  nhóm "Tên vị trí" không được đếm; `import_job_postings --refresh-skills`.
- `profile_json` có JSON Schema (`services/extraction/profile.schema.json`).
- `EXTRACTOR_VERSION = 'extract-v3'`: sau khi triển khai chạy
  `docker compose exec ml-worker python manage.py matching_backfill --inline`.

#### Added — AI đối sánh: đo lường trên tập vàng (kế hoạch bản 3, GĐ 1)

- Lệnh `matching_evaluate` chấm danh sách cặp CV–tin bằng đúng bước trích xuất,
  mã hóa và `score_match` của sản phẩm, không ghi DB; `--model-path` thử mô hình
  khác, `--rule-baseline` thêm điểm của bộ gợi ý theo luật `profile-rule-v2`.
- `ml/scripts/evaluate.py`: Spearman, NDCG@5, khoảng tin cậy bootstrap theo tin, số
  tin hơn BM25, kappa của mức hiển thị → `ml/reports/eval_validation.md`.
- Lệnh `apply_skill_merge` áp bảng gộp kỹ năng (alias, nhóm) vào danh mục, chạy
  lại được; `ml/scripts/import_jd.py` gọi lệnh này trước khi nhập tin.
- `ml/scripts/fetch_public.py` tải dữ liệu và mô hình công khai, ghi nguồn và mã
  commit.
- Tập vàng mở rộng lên 30 tin / 300 cặp (`build_gold_pairs.py --extend`); đợt 2 do
  hai lượt Claude độc lập gán (kappa 0,979), gộp bằng `merge_gold_passes.py`; rubric
  thêm quy tắc E1–E5.
- Nhập tin hàng loạt: khớp tỉnh/thành bất kể tiền tố "Tỉnh"/"Thành phố"; báo cáo
  thêm `publisher_companies`.

#### Changed — FAQ/hướng dẫn và blog: Nháp → Xuất bản (ADR-0024)

- Bỏ bước gửi duyệt/duyệt/từ chối vốn chỉ còn là tự duyệt sau ADR-0018.
  Revision trợ giúp còn `DRAFT`/`PUBLISHED`; bài blog còn
  `draft/published/archived`.
- FAQ/hướng dẫn: sửa thẳng bài đang công khai (lưu lần đầu tạo bản nháp, bản
  công khai giữ nguyên tới khi xuất bản), một nút Xuất bản lưu trước rồi xuất
  bản, hủy bản nháp, công khai lại bản cũ từ thẻ Phiên bản.
- **API**: thêm `POST /api/admin/knowledgebase/articles/{id}/revisions/{n}/discard/`;
  `publish/` nhận bản nháp hoặc revision đã xuất bản (rollback); gỡ
  `…/revisions/{n}/submit|approve|reject/`, `/api/admin/blog/posts/{id}/submit|return/`,
  trường `review_note`, `submitted_*`, `reviewed_*`; KPI `in_review` → `drafts`.
- Gỡ hàng chờ `knowledge_reviews`, `blog_reviews` khỏi dashboard, sidebar, chuông.
- **Migration**: `knowledgebase.0003/0004`, `blog.0003/0004` — revision từng công
  khai giữ lại, bản sửa dở mới nhất thành nháp, revision chưa từng công khai khác
  bị xóa; bài blog chờ duyệt về nháp.

#### Changed — Admin: sidebar hai tầng, nhóm "Cần xử lý" và tìm nhanh

- Sidebar còn tối đa 2 tầng, chia mục Vận hành · Quản lý · Nội dung · Hệ thống;
  mọi hàng chờ gom vào nhóm "Cần xử lý" (mở sẵn, cùng thứ tự với dashboard và
  chuông); bỏ flyout tầng 3 và các lá trùng với tab trong trang (Cấu hình, Mẫu
  CV), "Tài khoản cá nhân" và mục "Sắp ra mắt".
- Mục điều hướng là liên kết thật (mở tab mới được); mở nhiều nhóm cùng lúc,
  nhớ nhóm đang mở và trạng thái thu gọn; hàng chờ rỗng hiển thị mờ.
- Tìm trang nhanh bằng ô "Tìm trang…" hoặc ⌘K/Ctrl+K, không phân biệt dấu.
- **API**: `GET /api/admin/dashboard/queues/` (và dashboard) thêm hàng chờ
  `company_content_changes` (hậu kiểm trang công ty, hạn 48 giờ).
- Danh sách Cẩm nang đọc bộ lọc trạng thái từ URL (`?status=`).

#### Changed — README và chính sách bảo vệ `main`

- Viết lại `README.md` theo đúng hệ thống hiện tại: giới thiệu ba cổng, tính
  năng theo cổng, AI đối sánh CV–JD (`hybrid-v1`, mô hình E5 chạy local), sơ đồ
  kiến trúc Mermaid, bảng công nghệ, hướng dẫn chạy bằng Docker kèm
  `scripts/reset_local_db.sh`, cổng kiểm tra và quy trình nhánh. Bỏ các mô tả đã
  lỗi thời (luyện phỏng vấn, gói dịch vụ/nhãn HOT, mục tài liệu trùng).
- `quy-trinh-pull-request.md` ghi đúng ruleset `Protect main` đang bật: required
  checks `quality` và `frontend-final-gate`, không yêu cầu approval, admin được
  bypass.
- Dọn repository GitHub: xóa 154 nhánh đã gộp, cache Actions của PR đã đóng và
  artifact CI cũ; thêm mô tả, topics; tắt Wiki và Projects.

#### Changed — Admin: giao diện chi tiết nhà tuyển dụng

- Hero có dải số liệu (nhu cầu, tin, chiến dịch, giấy tờ, phiên đang mở); tab
  nằm trên nền trang, nội dung mỗi tab trong panel riêng thay vì card lồng card.
- "Tổng quan" chia hai cột: hồ sơ NTD bên trái, tóm tắt dạng danh sách và hoạt
  động gần đây bên phải; mobile xếp tóm tắt lên đầu.
- Trường hồ sơ và công ty hiển thị nhãn trên giá trị theo lưới tự co (thay bảng
  viền 4 cột), chia nhóm "Thông tin cá nhân" và "Đăng ký và điều khoản"; nút
  hiện dữ liệu nhạy cảm nằm ở đầu panel.
- Sửa: bảng giấy tờ ở tab Xác thực tràn khỏi khung trên mobile; xóa CSS chi
  tiết cũ trùng tên lớp trong widget danh sách tài khoản.

### 2026-11-19

#### Changed — Admin: trang nhà tuyển dụng, nhật ký và popup xử lý

- **API**: `GET /api/admin/accounts/?scope=recruiters` thêm `context.next_action`,
  tham số `next_action` (mã hoặc `admin_queue`), `ordering=next_action`, tìm
  theo tên công ty/MST/SĐT; summary NTD thêm `next_actions`.
- **API (đổi shape)**: `GET /api/admin/accounts/:id/activity/` trả timeline
  gộp nhiều nguồn `{results, next_cursor, category_counts}` với
  `?category=&before=&limit=`; bỏ `section_counts.activity` ở chi tiết tài
  khoản.
- **API**: các endpoint `*-impact` của tài khoản, xác thực NTD, gỡ liên kết công
  ty và domain nhận `reason` trống để xem trước; confirm vẫn bắt buộc lý do
  (xác nhận domain nay tự kiểm tra lý do).
- Danh sách NTD: ô phân khúc kiểu dashboard, cột "Việc cần làm", 20/40/60
  dòng/trang, xem nhanh có chuyển NTD. Chi tiết NTD: hero gọn, dải việc cần
  làm, gộp "Hồ sơ NTD" vào "Tổng quan", nhật ký chia theo nhóm và ngày.
- Popup xử lý dùng chung `ActionDialog`/`ReasonField`/`ImpactFacts`: tác động
  tự tải, lý do mẫu, xác nhận một click; duyệt giấy tờ đạt không cần popup;
  sau quyết định xác thực có "Hồ sơ tiếp theo".
#### Changed — Tiêu đề trang chuẩn hóa trên 3 cổng

- `<title>` theo dạng `<nội dung trang> | <thương hiệu cổng>`: `ProCV`,
  `ProCV cho Nhà tuyển dụng`, `Quản trị ProCV`; SEO shell backend dùng chung
  helper `seo_page_title` và ra cùng chuỗi với frontend.
- Tin tuyển dụng `Tuyển <vị trí> - <công ty>`; danh sách việc làm
  `Tuyển dụng <N> việc làm <ngữ cảnh> mới nhất`; danh mục mẫu CV, blog, trợ giúp
  khớp H1; chiến dịch `<tên> - <công ty>`.
- Sửa các route bị gán "Trang không tồn tại"/`noindex` (`/tai-cv-len`,
  `/tuyen-dung/:slug`, thông báo, lịch sử hoạt động, trang công ty của NTD);
  thanh trên cùng NTD dùng cùng nguồn tiêu đề.
- Gỡ `/tuyendung/bao-gia` khỏi SEO shell và sitemap.

#### Changed — Nội dung trang công ty đăng ngay, hậu kiểm (ER-D65–ER-D68)

- Người biên tập lưu một khối ở tab "Nội dung" là khối đó lên trang ngay; mỗi
  lần lưu ghi `CompanyContentChange` (giá trị mới và giá trị bị thay). Migration
  `employers/0004` thêm bảng này và `Company.content_review_required`.
- Quản trị viên hậu kiểm ở tab "Thay đổi nội dung" (Công ty): so sánh trước/sau,
  đánh dấu đã xem hàng loạt, hoàn tác kèm lý do (người sửa nhận thông báo), bật
  "duyệt trước" cho công ty vi phạm để nội dung quay về yêu cầu cập nhật.
- Thay đổi pháp lý và form hồ sơ công ty vẫn duyệt trước như cũ.
- **Sửa lỗi**: gửi form hồ sơ công ty không còn xoá nội dung trang đang chờ duyệt
  trong cùng yêu cầu; hàng đợi "Yêu cầu cập nhật công ty" không còn đếm yêu cầu
  đang chờ NTD chỉnh sửa.

#### Changed — Backend: baseline migration (ADR-0022, GĐ6) — **phải reset DB local**

- 274 migration gộp thành baseline: `0001_initial` mỗi app (thêm `0002_initial`
  khi FK vòng giữa app) và `00xx_reference_data` nạp dữ liệu tham chiếu từ
  `migrations/reference_data.json`. Extension `unaccent`, `pg_trgm`, `vector`
  khai báo trong baseline.
- Schema mới khớp schema cũ; dọn 4 cột mồ côi của `employers_company` (còn sót
  từ migration chỉ đổi state); bảng chiến dịch đổi tên thành `campaigns_*`.
- Gỡ 8 test nâng cấp migration và job CI `backend-migration-tests`.
- DB local tạo trước mốc này phải dựng lại: `./scripts/reset_local_db.sh [--demo]`.

#### Changed — Backend: dọn chất lượng (ADR-0022, GĐ5)

- Không còn module production nào trên 500 dòng; settings tách thành
  `config/settings/components/` (giá trị không đổi).
- Gộp code trùng: `common/outbox.py`, `common/errors.py` (`DomainError`), một
  bộ chuyển HTML→text, một bảng chữ ký file, chính sách AI tạo tin một nguồn.
- **Bảo mật**: captcha và nhật ký truy cập CV lấy IP client qua
  `common.http.client_ip` (trước đây tin `X-Forwarded-For`/`REMOTE_ADDR`).
- Gỡ legacy: chuỗi `legacy-media`, 9 lệnh chạy một lần, kênh OTP email cũ, nguồn
  quyết định `legacy_*`, font CV cũ (Arial/Calibri/Source Sans Pro); bỏ trường API
  không dùng `application_deadline`, `is_salary_visible`, `preferred_location_id`.
- `GET /api/public/skills/?group=abc` trả `[]` thay vì 500; ảnh GIF89a được nhận.
- Bật rule Django của ruff; thêm test privacy/skills/locations, tách file test lớn.

#### Changed — API theo cổng (ADR-0022, GĐ4) — **thay đổi phá vỡ**

- Mọi endpoint chuyển sang `/api/{auth,public,candidate,employer,admin,shared}/`;
  bỏ `/api/v2/`. Ví dụ `/api/jobs/mine/` → `/api/employer/jobs/`,
  `/api/v2/cvs/` → `/api/candidate/cvs/`, `/api/blog/admin/` → `/api/admin/blog/`.
  Bảng đầy đủ: `docs/archive/snapshot/url-map-2026-11.md`. Không giữ alias cũ.
- Frontend đổi cùng lúc (API client, mock unit test và E2E).
- Gỡ API-root của DRF router và route SEO legacy `/jobs`, `/jobs/<slug>`.
- Bỏ tên `v2` ở module, lớp, tên route và tag OpenAPI.

#### Changed — Backend: tầng API (ADR-0022, GĐ3)

- Lỗi đi qua exception handler chung: Django `ValidationError` thành 400
  (`{field: [..]}` hoặc `{"detail": [..]}` — lỗi chung trước đây có nơi trả mảng
  JSON), lỗi nghiệp vụ là `DomainError` giữ nguyên payload. Gỡ các helper đổi
  lỗi trong view (`_call`, `_run_mutation`, `_validation_detail`).
- ORM, transaction, ghi file và `.delay()` chuyển từ view/serializer vào
  services/selectors ở mọi app; các GET của NTD không còn tạo `RecruiterProfile`.
- OpenAPI: mọi view có `@extend_schema`, tên enum trùng có override — từ 70 lỗi /
  340 cảnh báo về 0/0; `docs/04-api/openapi.yaml` sinh lại.
- `common/api/params.py` (`parse_bool`, `parse_int`) thay ~10 cách parse cờ; bỏ
  khai báo phân trang thừa; Browsable API chỉ bật khi `DEBUG`.

#### Changed — Backend: ranh giới domain (ADR-0022, GĐ2)

- `RecruitmentCampaign`, `CampaignActivity`, máy trạng thái, selectors, API và
  signal `campaign_status_changed` chuyển từ `employers` sang `campaigns`. Ba
  migration chỉ đổi state (không SQL), bảng giữ tên `employers_*`, ContentType
  chuyển theo. Ghi hoạt động và thời gian chạy thành API của model
  (`CampaignActivity.objects.record`, `RecruitmentCampaign.active_seconds`).
- `cv_templates` thành engine tài liệu CV: schema nội dung, ghép document và in
  PDF; engine Chromium dùng chung chuyển vào `common/pdf/browser.py`. `cvs` gọi
  services của `cv_templates`, chiều ngược lại chỉ đọc model `CvAsset`.
- Gỡ route trùng `/api/v2/cvs/backgrounds/` (frontend dùng `/api/v2/cv-backgrounds/`).
- Import chéo app chỉ qua package công khai; `check_backend_imports.py` không
  còn baseline — mọi vi phạm làm fail CI.

#### Changed — Backend: bố cục app chuẩn (ADR-0022, GĐ1)

- Module gốc app về đúng tầng: `accounts/{permissions,authentication,schema}` →
  `api/`, `oauth`, `exceptions`, token mời → `services/`; registry CV, trang
  công ty, cấu hình upload, salt ký → tầng mới `domain/`.
- URL tách theo cổng: `<app>/api/urls/{public,candidate,employer,admin,auth,shared}.py`;
  HTML SEO và link `/r/<code>` → `<app>/seo/`. Đường dẫn không đổi.
- `signals/` (khai báo + `receivers.py`), `tasks/` là package ở mọi app; task CV
  tách `exports`/`imports` (tên task Celery đổi theo module, queue giữ nguyên).
- `common/` chia subpackage `api/`, `http/`, `storage/`, `html/`, `pdf/`,
  `files/`, `db/`; `company_email`, `phone` về employers, `atomic_pop` về
  accounts; `common` không còn import `apps`.

#### Changed — Backend: cổng kiểm tra cấu trúc (ADR-0022, GĐ0)

- ADR-0022 thay ADR-0010: bố cục app, luật import chéo app, URL theo cổng, lộ
  trình 7 giai đoạn.
- CI và `check_all.sh` thêm `check_backend_imports.py` (import chéo app, module
  gốc app, code trong `__init__.py`) và `check_openapi_schema.sh` (schema khớp
  `docs/04-api/openapi.yaml`, số cảnh báo không tăng); cả hai dùng baseline chỉ
  được giảm.
- Công cụ lint/test tách sang `requirements-dev.txt`, không còn trong image
  production; pin `gunicorn` và `redis`.
- Gunicorn/Celery/ASGI bắt buộc có `DJANGO_SETTINGS_MODULE`; image Docker mặc
  định production, compose dev đặt development.

#### Added — Giải thích chỉ số chiến dịch

- Icon "?" cạnh các chỉ số dễ nhầm (chi phí / hồ sơ, chi phí / trúng tuyển, tỷ
  lệ nộp, người bấm, ứng viên duy nhất và hồ sơ, tỷ lệ xem, thời gian tới lúc
  xem, tốc độ chi, chỉ tiêu, số ngày đã chạy...): rê chuột hoặc focus bằng bàn
  phím để đọc cách tính.

#### Added — Ảnh trong bài đăng Fanpage

- Ngăn soạn bài Fanpage cho tải tối đa 4 ảnh hoặc dùng nhanh ảnh bìa, logo
  công ty; bản xem trước hiện lưới ảnh như Facebook. Ảnh được mã hóa lại (bỏ
  thông tin vị trí) trước khi lưu và đăng.

#### Changed — Chiến dịch: giao diện kênh, đăng Fanpage và lịch sử hoạt động

- Tab "Kênh & nguồn" chia hai cột: danh sách kênh và chi tiết kênh với các mục
  Nội dung bài (xem trước như bài mạng xã hội), Đăng Fanpage, Link & QR, Chi phí.
- Soạn bài Fanpage trong ngăn riêng có xem trước; đăng ngay, hẹn giờ theo khung
  gợi ý hoặc đăng nhiều lần (nhắc lại sau 3, 7, 14 ngày). Lỗi đăng bài được giải
  thích kèm cách xử lý.
- Chi phí kênh chuyển từ popup sang mục riêng có giải thích và chọn nhanh.
- Lịch sử hoạt động thành timeline một dòng, lọc bằng dải nút.

#### Fixed — Đăng Fanpage với link máy cục bộ

- Facebook từ chối bài kèm link `localhost` (lỗi 1500). Link không công khai giờ
  được chèn vào nội dung thay vì gửi làm link đính kèm.

### 2026-11-18

#### Added — Chiến dịch: sức khỏe, cảnh báo và báo cáo (GĐ4)

- Tab "Sức khỏe" trong chi tiết chiến dịch: dự báo số người tuyển được so với
  chỉ tiêu (đúng tiến độ / có rủi ro / chậm), tốc độ CV cần đạt, thời gian phản
  hồi hồ sơ, phễu, mức chi ngân sách và biểu đồ dự báo theo ngày.
- Cảnh báo trong chuông khi dự báo thấp, hồ sơ chờ xem quá 48 giờ, kênh đã đăng
  chưa có CV hoặc chi tiêu nhanh hơn tiến độ; không gửi trùng, nhắc lại tối đa
  mỗi tuần.
- Email báo cáo tuần sáng thứ Hai (tắt được), tải báo cáo Excel/PDF.
- Danh sách chiến dịch ghi rõ "N tin tuyển dụng" và "Cần tuyển M người".

#### Added — Chiến dịch: đăng tự động lên Facebook Page (GĐ3)

- Kết nối Fanpage qua OAuth của Facebook (Cài đặt tài khoản → Kết nối mạng xã
  hội); chỉ lưu Page token đã mã hóa.
- Kênh "Fanpage Facebook" hẹn đăng ngay hoặc theo giờ. Bài tự hoãn khi chiến
  dịch tạm dừng, tự gỡ khi chiến dịch hoàn tất hoặc bị hủy; lỗi tạm thời được
  thử lại, token hết hạn thì báo NTD.
- `CAMPAIGN_SOCIAL_PROVIDER=fake` chạy toàn bộ luồng không cần Meta; hướng dẫn
  tạo Meta App ở `docs/06-deployment/tich-hop-mang-xa-hoi.md`.

#### Added — Chiến dịch: phân phối đa kênh và ghi nhận nguồn (GĐ2)

- Kênh phân phối cho chiến dịch: mỗi kênh có link theo dõi `/r/<code>` và mã
  QR, nội dung đăng soạn bằng AI (có mẫu dự phòng) hoặc sửa tay, đánh dấu đã
  đăng, sổ chi phí.
- Đếm lượt bấm không cookie, không lưu IP. Hồ sơ ứng tuyển ghi kênh đã đưa ứng
  viên tới (`?ref=` có ký, 30 ngày; không có consent Analytics thì chỉ trong
  phiên).
- Tab "Kênh & nguồn": so sánh người bấm, hồ sơ, tỷ lệ nộp, trúng tuyển, chi phí
  mỗi hồ sơ và mỗi trúng tuyển giữa các kênh và nguồn tự nhiên.
- Trang tuyển dụng công khai `/tuyen-dung/<slug>` cho từng chiến dịch, có vỏ
  SEO; bước "Kênh phân phối" trong wizard.

#### Changed — Danh sách và trang chi tiết chiến dịch gọn hơn

- Danh sách: dải trạng thái có số đếm, mặc định sắp theo trạng thái (đang chạy
  trước, đã kết thúc cuối), bộ lọc `status=ended`, mỗi dòng một nút việc tiếp
  theo. Bỏ công tắc bật/tắt, nút hiện khi rê chuột, nút đăng tin lặp ở từng dòng.
- "Thêm chiến dịch mới" mở wizard `/tuyendung/app/campaigns/new`; bỏ hộp nhập
  tên và hộp đổi tên.
- Trang chi tiết: một nút chính theo trạng thái, "Sửa thông tin", menu "Thao tác
  khác" (dừng, hoàn tất, hủy, hủy lịch); dải Chỉ tiêu, Thời gian, Ngân sách, Đã
  chạy; năm chỉ số Tổng quan gom thành một dải.

#### Changed — Chiến dịch: đợt tuyển nhiều tin, wizard rõ ràng hơn

- Chiến dịch không còn một vị trí, cấp bậc, chỉ tiêu riêng; chỉ tiêu bằng tổng số
  lượng tuyển của các tin (API trả `headcount`). Migration `employers.0066`.
- Wizard thiết lập làm lại:
  - thanh lộ trình theo trạng thái thật;
  - bước Kích hoạt liệt kê việc còn thiếu kèm nút sửa, chọn cách kích hoạt
    bằng thẻ, ghi trước kết quả khi kích hoạt;
  - bước Tin hướng dẫn tạo tin nháp và hiện số người cần tuyển.

#### Added — Chiến dịch tuyển dụng: mục tiêu, wizard và lịch chạy (GĐ1)

- Mục tiêu chiến dịch ghi được qua API: vị trí, cấp bậc, chỉ tiêu, ngày bắt
  đầu/kết thúc hoặc tuyển liên tục, ngân sách.
- Wizard thiết lập `/tuyendung/app/campaigns/:id/setup` gồm ba bước: Mục tiêu →
  Tin tuyển dụng → Xem lại & kích hoạt. Có checklist, kích hoạt tất cả hoặc
  không gì cả, hoặc lên lịch theo ngày bắt đầu.
- App `apps.campaigns`, API `/api/employer/campaigns/<id>/launch/`, beat
  `run_campaign_schedule`: tự kích hoạt, tự hoàn tất sau ngày kết thúc, nhắc
  trước 3 ngày, báo khi kích hoạt theo lịch thất bại.
- Trạng thái chiến dịch `scheduled`; nút Hoàn tất / Hủy / Hủy lịch trong
  workspace.

#### Changed

- Chiến dịch tạo nhanh ra nháp (tạo ngay trong form đăng tin vẫn chạy luôn).
- Hoàn tất hoặc hủy chiến dịch đóng các tin đang tuyển thay vì chỉ ẩn.
- `docs/04-api/openapi.yaml` được sinh lại từ mã hiện tại.

#### Added — Giao diện "Xem độ phù hợp" (tuần 4)

- Thẻ "Xem độ phù hợp" có mascot ở cột phải trang chi tiết tin (điện thoại, máy tính
  bảng: ngay dưới thông tin chính của tin); hộp thoại chọn CV,
  màn hình AI đang phân tích, kết quả với thước bốn mức, tiêu chí, kỹ năng có/thiếu
  kèm câu trích từ CV, yêu cầu, gợi ý và cảnh báo không phải quyết định tuyển dụng.
- Tập vàng 150 cặp CV–tin cho đánh giá (nhãn do Claude gán theo rubric, có quy tắc
  làm rõ do người làm đồ án chốt; người kiểm tra sơ bộ 5 cặp).

#### Changed

- Trang lưu CV thành công chỉ hiện nhãn mức phù hợp, không hiện phần trăm.
- Tên site setting `ai_job_match_enabled` trong trang quản trị: "AI xem độ phù hợp CV với tin".

#### Added — Chấm độ phù hợp CV–tin và ml-worker (tuần 3)

- API `/api/matching/analyses/` cho ứng viên: yêu cầu phân tích (cache theo
  phiên bản CV, nội dung tin, mô hình, công thức), poll kết quả, xem các lần gần
  nhất của một tin; cờ `ai_job_match_enabled`, giới hạn 20 lượt/giờ.
- Công thức `hybrid-v1` (`apps/matching/services/scoring/`): kỹ năng, kinh
  nghiệm (số năm nhân mức liên quan), học vấn, cấp bậc, ngoại ngữ (trần 64 khi
  thiếu ngoại ngữ bắt buộc), địa điểm; câu tóm tắt và gợi ý theo luật
  (`explain.py`), không sinh văn bản tự do.
- Service `ml-worker` (Dockerfile target `ml`, queue `ai-matching`) chạy mô hình
  `intfloat/multilingual-e5-base` local; vector tính sẵn khi CV/tin được lưu;
  lệnh `matching_backfill`; beat phục hồi phân tích treo mỗi 60 giây.
- `ml/scripts/calibrate.py` đo AUC và mốc hiệu chuẩn; `ml/scripts/export_model.py`
  lưu mô hình cho ml-worker.

#### Added — Trích xuất hồ sơ đối sánh CV–JD (tuần 2)

- `apps/matching/services/extraction/` chuyển CV builder, CV tải lên (PDF/DOCX)
  và tin tuyển dụng thành `profile_json`: kỹ năng kèm nguồn và câu bằng chứng,
  số tháng kinh nghiệm kèm cơ sở tính, bậc học, cấp bậc, ngoại ngữ, chunk. Theo
  quy tắc chống bịa dữ liệu: thiếu thông tin thì ghi vào `quality.missing`,
  không đoán; chunk không chứa email/số điện thoại; câu yêu cầu về giới tính,
  tuổi, ngoại hình không được đối sánh.
- `apps/matching/services/skills.py` nhận diện kỹ năng theo danh mục (tên +
  alias, đúng hoa thường với tên ngắn như "AI"), loại nhóm "Phẩm chất cá nhân"
  khỏi điểm.
- Lệnh `matching_export_dataset` (chỉ đọc) xuất hồ sơ ra JSONL cho các script ở `ml/`.
- `ml/scripts/`: `extract_check.py` (so thư viện đọc PDF), `baseline.py`
  (TF-IDF, BM25), `build_gold_pairs.py` (ghép 150 cặp tập vàng, phiếu chấm
  `ml/labeling/gold_pairs.xlsx`), `export_profiles.py` + `check_profiles.py`
  (đối chiếu hồ sơ với nhãn); số liệu ở `ml/reports/`.

#### Changed

- Đọc chữ của CV PDF bằng `pypdfium2` (pypdf chỉ còn kiểm tra mật khẩu và số
  trang): pypdf tách rời chữ có dấu ở khoảng 9% từ của CV tiếng Việt, pypdfium2
  không tách ở cả 51 PDF đo thử. Văn bản CV chuẩn hóa NFC, icon font của mẫu CV
  đổi thành khoảng trắng.

#### Fixed

- CV-070 của kho CV tổng hợp lẫn lời thoại của mô hình vào tên tổ chức; đã sửa
  trong JSON và lưu phiên bản CV mới. `enrich_cvs.py` sinh lại khi ô ngắn dài
  bất thường (`has_runaway_text`).

#### Added — Kho CV tổng hợp cho thực nghiệm đối sánh CV–JD

- `ml/scripts/generate_cvs.py` sinh CV hư cấu bằng mô hình chạy local (Ollama,
  `qwen2.5:7b`) từ các tin tuyển dụng đã nhập: đủ 8 nhóm vị trí của tập vàng và
  các vị trí khác, tiếng Việt và tiếng Anh, ba mức khớp dự kiến, kiểm tra trùng
  nội dung.
- Lệnh `import_cv_documents` (app `cvs`) đưa CV dựng sẵn vào hệ thống, mỗi CV một
  tài khoản ứng viên thử không có mật khẩu dùng được; `ml/scripts/import_cvs.py`
  gọi lệnh này và ghi kết quả vào tệp theo dõi `ml/data/cv/cv_inventory.xlsx`.
- `ml/README.md` mô tả cấu trúc thư mục `ml/` và thứ tự chạy; đường dẫn dữ liệu
  gom vào `ml/scripts/paths.py`.

### 2026-11-16

#### Added — Bảng điều khiển quản trị

- Trang chủ cổng quản trị thay danh sách lối tắt bằng bảng điều khiển: khối
  "Cần xử lý" gom 8 hàng chờ (báo cáo tin/công ty, xác thực NTD, tên miền, yêu
  cầu cập nhật công ty, tin nộp lại, bài viết, FAQ), xếp theo mức gấp, hiện thời
  gian chờ lâu nhất so với hạn xử lý và dẫn thẳng tới danh sách đã lọc.
- KPI ứng tuyển, tin mới, ứng viên mới, NTD mới so với kỳ trước (7/30/90 ngày),
  biểu đồ xu hướng kèm bảng số liệu, phễu ứng tuyển, tình trạng tin, an toàn và
  tuân thủ, ngành nghề nhiều tin nhất, sức khỏe hệ thống AI.
- API `GET /api/dashboard/admin/?period=` (chỉ cổng quản trị).

#### Changed — Sidebar và header cổng quản trị

- Sidebar chuyển sang nền sáng cùng ngôn ngữ với bảng điều khiển. Badge số lượng
  có trên mọi mục có hàng chờ (thêm báo cáo công ty, báo cáo vi phạm, tin chờ
  duyệt lại, bài viết, FAQ chờ duyệt và quá hạn rà soát); badge đỏ khi có mục
  quá hạn. Bỏ ô "Tìm chức năng".
- Cụm tài khoản (ảnh, tên, cấp quản trị, cài đặt) và nút "Đăng xuất" ở đáy
  sidebar, kể cả trong drawer mobile.
- Header có breadcrumb, nút "Tạo mới" (bài viết, FAQ, thông báo, mời quản trị
  viên; đăng tin hộ NTD sắp ra mắt), chuông liệt kê hàng chờ theo mức gấp, trợ
  giúp (sắp ra mắt) và menu tài khoản (hồ sơ, bảo mật, nhật ký hoạt động).
- API `GET /api/dashboard/admin/queues/` trả số mục chờ cho badge và chuông.
- Badge cập nhật ngay sau mỗi thao tác duyệt/xử lý thay vì chờ lượt làm mới 30 giây.

#### Fixed

- Trang "Việc làm đã ứng tuyển" không còn lỗi khi trình duyệt không hỗ trợ `scrollIntoView` (lỗi làm unit test báo unhandled error).

#### Added — Ảnh đại diện (ứng viên, NTD, quản trị)

- Modal "Chỉnh sửa ảnh đại diện" theo mẫu TopCV, mở từ nút camera ở thẻ chào
  và trang "Cài đặt thông tin cá nhân": chọn hoặc kéo thả ảnh, kéo khung vuông
  để chọn vùng, kéo góc để đổi cỡ (hoặc dùng phím mũi tên), xem trước dạng tròn,
  đổi/xóa ảnh. Ảnh được cắt trong trình duyệt thành JPEG vuông rồi mới tải lên.
- Kiểm tra JPG/PNG/WebP, tối đa 5 MB, tối thiểu 200×200 px trước khi đọc ảnh.
- `DELETE /api/auth/avatar/` xóa ảnh đại diện; upload thu nhỏ ảnh quá 1024 px.
- Cổng NTD (Thông tin tài khoản → "Đổi avatar") và cổng quản trị (Tài khoản
  của tôi → Hồ sơ) dùng chung modal này thay cho upload thẳng tệp gốc.

### 2026-11-15

#### Added — Nền tảng đối sánh ngữ nghĩa CV–JD chạy local

- PostgreSQL của Docker Compose và CI chuyển sang image
  `pgvector/pgvector:pg16-trixie` (có extension `vector`). Sau khi lấy thay đổi
  này về cần `docker compose up -d db` và `docker compose build backend`; dữ
  liệu trong volume `pgdata` giữ nguyên. PostgreSQL cài trực tiếp trên máy thì
  phải tự cài pgvector.
- App `matching`: ba bảng `MatchDocument`, `MatchChunk`, `MatchAnalysis` lưu hồ
  sơ đã chuẩn hóa, vector 768 chiều và kết quả phân tích. Chưa có API.
- Thư mục `ml/`: môi trường huấn luyện trên host (Apple MPS) và script kiểm tra
  `ml/scripts/smoke_mps.py`.
- Nhập hàng loạt tin tuyển dụng thật cho bản demo và tập đánh giá: điền
  `ml/data/jd_input.xlsx`, chạy `ml/.venv/bin/python ml/scripts/import_jd.py`
  (mặc định chỉ chạy thử, `--apply --create-skills` để ghi). Phía backend là
  lệnh `import_job_postings`; tin đi qua cùng bước kiểm tra điều kiện đăng với
  tin thường, bỏ qua quota và xác thực nhà tuyển dụng vì do người vận hành nhập.

#### Added — Báo NTD khi có hồ sơ mới; làm gọn workspace CV ứng tuyển

- Ứng viên nộp hồ sơ: NTD nhận thông báo trên chuông và email tới các địa chỉ
  nhận hồ sơ của tin (mặc định email người đăng). Email không chứa tên ứng
  viên; tắt được trong cài đặt thông báo NTD ("Hồ sơ ứng tuyển mới") hoặc bằng
  site setting `email_notify_new_application`.
- Workspace: thao tác với CV (Tải PDF, Mời đánh giá, Nhắn tin) nằm trên thanh
  riêng; "Lưu vào kho" và "Chặn" thành một hàng hai nút; lọc trạng thái là một
  ô chọn cạnh ô tìm kiếm thay cho dãy chip.

#### Added — Kho ứng viên tiềm năng (giai đoạn 5)

- NTD lưu ứng viên vào kho kèm ghi chú, nhãn; ứng viên được thông báo, có trang
  "Nhà tuyển dụng lưu hồ sơ" để rút hồ sơ; mục tự hết hạn sau 12 tháng.
- Trang "Kho ứng viên tiềm năng": chọn tin đang tuyển để xem người trong kho
  xếp theo độ tương đồng (có lý do) và mời ứng tuyển; ứng viên nhận lời mời
  theo kênh Email/Web mới "Lời mời ứng tuyển từ nhà tuyển dụng".

#### Added — Danh sách đen ứng viên (giai đoạn 4)

- NTD chặn ứng viên từ hồ sơ (lý do, thời hạn, tùy chọn từ chối hồ sơ đang
  chờ); ứng viên bị chặn không nộp được vào các tin của NTD và chỉ thấy thông
  báo chung.
- Workspace cảnh báo "ứng tuyển hàng loạt" khi một ứng viên nộp ≥ 5 tin của
  NTD trong 14 ngày, kèm nút chặn; trang "Danh sách đen" trong sidebar để xem
  và gỡ chặn.

#### Added — Mời người khác đánh giá hồ sơ (giai đoạn 3)

- Nút "Mời đánh giá" trong workspace hồ sơ: tạo link có hạn, sao chép hoặc gửi
  qua email của chính NTD, thu hồi bất cứ lúc nào; token chỉ lưu dạng hash.
- Trang công khai `/tuyendung/danh-gia-ho-so/:token`: CV đã ẩn ảnh, liên hệ và
  người tham chiếu; phiếu đánh giá (đề xuất, điểm, điểm mạnh, băn khoăn), sửa
  được tới khi hết hạn. NTD nhận thông báo và xem tổng hợp phiếu.

#### Added — Xử lý hồ sơ ứng tuyển (giai đoạn 1)

- Ứng viên có chuông thông báo và email khi nhà tuyển dụng xem, tải CV hoặc ra
  quyết định (`CandidateNotification`, `/api/candidate/notifications/…`). Quyết
  định được báo sau 5 phút (`CANDIDATE_STATUS_NOTIFICATION_DELAY_SECONDS`);
  bấm nhiều trạng thái liên tiếp chỉ báo trạng thái cuối.
- Nhà tuyển dụng hoàn tác được quyết định khi ứng viên chưa được báo
  (`POST …/status/undo/`); trạng thái cuối có hộp xác nhận.
- Tải PDF đúng bản CV đã nộp (`…/cv/exports/`); mọi lần xem/tải CV ghi
  `CvAccessLog`, ứng viên được báo một lần cho mỗi hồ sơ.
- Workspace `/tuyendung/app/applications` làm lại: chip lọc trạng thái, thanh
  quyết định, lịch sử hiện trạng thái thông báo, nút "Nhắn tin" (sắp ra mắt).
- Sidebar NTD: nhóm "Quản lý CV" có mục "CV ứng tuyển" (hộp CV của mọi tin,
  kèm số CV chưa xem) và các mục sắp mở "Kho ứng viên tiềm năng", "Danh sách
  đen" theo lộ trình.

#### Changed — Quy trình trạng thái hồ sơ

- Còn 6 trạng thái: Mới, Đã xem (hệ thống đặt), Phù hợp, Phỏng vấn, Trúng
  tuyển, Không phù hợp. Trang "Việc làm đã ứng tuyển" chỉ hiện trạng thái đã
  báo cho ứng viên.
- Thông báo trong chuông của hồ sơ bị tự động từ chối hiện sau 3 ngày ân hạn,
  cùng lúc với email.
- Nộp hồ sơ bị chặn khi CV đang phân tích hoặc thiếu họ tên / liên hệ / nội
  dung; form ứng tuyển chờ phân tích CV tải lên xong mới nộp (trước đây có thể
  nộp bản CV rỗng).

#### Added — Xác nhận nộp hồ sơ và cài đặt nhận thông báo theo kênh

- Nộp hồ sơ thành công: chuông "Hồ sơ đã được tiếp nhận" và email "Chúc mừng
  bạn đã ứng tuyển thành công vị trí …" với tối đa 5 việc làm tương tự, nút
  "Xem tất cả việc làm", hotline/email hỗ trợ và mạng xã hội từ site settings.
- Trang "Cài đặt nhận thông báo": cột Email / Trên web cho hồ sơ ứng tuyển,
  dòng "Kết quả xử lý hồ sơ" luôn bật, công tắc gợi ý việc làm tương tự; lý do
  bị từ chối bật hiện ngay dưới công tắc kèm link sửa; lưu một công tắc không
  khóa các công tắc khác; báo khi email toàn site đang tắt.
- Email ứng viên chỉ gửi khi email đã xác thực; thẻ việc làm trong email dùng
  chung `jobs/services/email_cards.py` (digest dùng lại).

#### Removed

- 9 công tắc email không có tác dụng (cập nhật hệ thống, tính năng mới, ưu
  đãi đối tác, lời mời NTD, …); `employer_viewed_cv` đổi tên `cv_activity_email`.
- Trạng thái `considering` (dữ liệu gộp vào `viewed`, migration không đảo
  ngược).
- `PATCH /api/v2/recruiter/applications/{id}/` không còn nhận `status`; dùng
  `POST …/status/`.

#### Changed — Danh sách và chi tiết tin tuyển dụng của nhà tuyển dụng

- `/tuyendung/app/jobs`: tab trạng thái kèm số đếm thay cho dropdown, tìm kiếm
  tự chạy sau khi ngừng gõ, mỗi tin hiện ứng viên + badge "N mới", lượt xem và
  tỉ lệ ứng tuyển, hạn nộp có đếm ngược và thanh thời gian; nút "Hoàn
  thiện"/"Gia hạn" không còn xuống dòng; trạng thái rỗng dùng mascot.
- `/tuyendung/app/jobs/:id`: header gọn (meta bằng icon, "Xem tin đăng",
  "Đóng tin" trong menu và có xác nhận), bốn chỉ số bấm được để lọc CV, giữ
  nguyên bốn tab. Tab CV lọc/sắp xếp/phân trang phía server với chip trạng
  thái; tab lượt xem thành phễu Hiển thị → Xem → Ứng tuyển; tab thông tin
  bố cục lại và render rich text qua `shared/ui/RichContent`.
- Thông báo lỗi 404 của chi tiết tin bằng tiếng Việt thay cho chuỗi DRF.

#### Added — API workspace tin tuyển dụng

- `GET /api/jobs/mine/` trả thêm `status_counts` và
  `unviewed_application_count` cho từng tin; `GET /api/jobs/mine/{id}/` trả
  thêm `impression_count` và `application_summary` (lần nộp mới nhất của mỗi
  ứng viên). Chỉ thêm trường, không đổi trường cũ.

#### Fixed

- Số liệu CV ở chi tiết tin không còn chỉ tính trên 20 hồ sơ đầu tiên.

### 2026-11-14

#### Removed — Widget Trợ lý ProCV ở cổng ứng viên

- Gỡ nút nổi "Trợ lý ProCV" góc phải dưới cùng panel chat kịch bản tĩnh
  (`widgets/candidate-assistant`) khỏi `MainLayout`. Không đổi backend hay API.
- Đặc tả chatbot ứng viên (CB-P0) ghi chú tạm dừng; CB-P2 cần UI mới.

#### Removed — Phòng ban, chức danh và nhân viên quản trị (ADR-0018)

- Theo [ADR-0018](docs/adr/adr-0018-remove-admin-rbac.md): cổng quản
  trị còn hai cấp superuser và admin thường. Admin thường dùng mọi chức năng
  nghiệp vụ; superuser thêm tài khoản quản trị, lời mời, site settings, cấu
  hình AI, cấm tài khoản, gỡ policy hold và audit toàn hệ thống.
- Xóa model `AdminPermission`, `Department`, `AdminRole`, `AdminMembership`,
  `AdminProvisioningScope`, danh mục mã quyền, API
  `/api/admin/departments|roles|permissions|memberships|staff|provisioning-scopes/`,
  `account-invitations/available-roles/`, PATCH đổi chức danh lời mời, trang
  `/access-control`, lệnh `seed_admin_access`, `sync_admin_permissions`,
  `export_admin_permissions`, `purge_deprecated_admin_permissions`,
  `check_admin_access_readiness` và script `check_admin_permissions_sync.sh`.
- `HasAdminPermission` → `AdminPortalPermission`; `/api/auth/me/` chỉ còn
  `admin_access: {is_superuser}`. Lời mời admin do superuser tạo với
  `{email, full_name, reason}`.
- Nhóm site settings `admin_roles` (bốn khóa không được đọc) bị xóa.
- Migration `accounts.0034_remove_admin_rbac` xóa vĩnh viễn dữ liệu RBAC;
  `sitecontent.0023_remove_admin_roles_settings`.

#### Fixed — Checklist xác thực sau khi hồ sơ hết hiệu lực, tải PDF có ký tự đầu

- Khi admin cho hồ sơ xác thực hết hiệu lực, thu hồi, từ chối hoặc yêu cầu bổ
  sung, bước "Nộp giấy tờ chứng minh quyền đại diện" không còn tick xanh ở
  checklist, bảng tin và popover cấp tài khoản. Backend trả thêm
  `onboarding.business_doc_current` và `business_doc_approved` tính cả trạng
  thái hồ sơ; `business_doc_submitted` giữ nguyên nên quyền xem workspace không
  đổi.
- PDF có khoảng trắng hoặc BOM trước `%PDF-` (ví dụ tệp xuất từ TopCV) không
  còn bị báo "Nội dung tệp không khớp định dạng đã khai báo". Kiểm tra cấu trúc
  đọc từ vị trí header; nội dung khác đứng trước header vẫn bị từ chối.
- Khi máy quét virus không phản hồi, giao diện báo "Dịch vụ kiểm tra an toàn
  tệp đang tạm gián đoạn" thay vì yêu cầu tải lại tệp.

#### Added — Trang công ty và quyền biên tập (CP-1 → CP-7)

- Trang công khai `/cong-ty/:slug` (tab Tổng quan / Việc làm, lọc từ khoá và
  tỉnh), SEO shell, `sitemaps/companies.xml`; mọi liên kết công ty dẫn về
  trang này. Admin tạm ẩn trang được (404 thật, có audit).
- Ứng viên theo dõi công ty, nhận email việc mới (tắt theo công ty hoặc tắt
  chung) và báo cáo thông tin sai; admin xử lý ở hàng chờ "Báo cáo công ty".
- Nhà tuyển dụng tuỳ biến trang ở `/tuyendung/app/company-page`: bố cục áp
  dụng ngay, nội dung (khẩu hiệu, văn hoá, video, mạng xã hội, phúc lợi,
  văn phòng, ảnh) qua kiểm duyệt. Chỉ owner đã xác thực và member được owner
  uỷ quyền mới biên tập (ER-D58 → ER-D64).
- Migration `employers.0048`–`0052`, `accounts.0032`–`0033`, `jobs.0051`,
  `candidates.0008` đều chỉ cộng thêm.

#### Added — Nền móng trang công ty (CP-0)

- Theo [ADR-0017](docs/adr/adr-0017-company-page.md) và
  [kế hoạch trang công ty](docs/archive/ke-hoach/ke-hoach-trang-cong-ty.md).
- `GET /api/jobs/` nhận `company=<company_public_id>` (khớp chính xác, không
  thêm query); card và chi tiết tin trả `company_slug`.
- `Company.public_headquarters` là nguồn duy nhất cho địa chỉ công khai.
  `company_address` của chi tiết tin không còn trả địa chỉ hộ kinh doanh.
- Slug `tim-kiem` dành riêng cho route tìm kiếm danh bạ; công ty trùng tên
  nhận slug có hậu tố `public_id`.
- Predicate người đại diện hợp lệ chuyển xuống
  `employers/models/representation.py` để selector và service dùng chung.
- Frontend: `CompanyLogo` và helper tên công ty thuộc `entities/company`;
  `RichContent` (thay `JobRichContent`) và `ShareButtons` thuộc `shared/ui`.

### 2026-11-13

#### Removed — Gỡ xác thực hai bước (2FA/MFA) ở cả ba cổng

- Theo [ADR-0016](docs/adr/adr-0016-remove-two-factor-auth.md): bỏ mã
  email, ứng dụng xác thực (TOTP), mã dự phòng và challenge khi đăng nhập. Đăng
  nhập mật khẩu/OAuth cấp token ngay; `/api/auth/me/` không còn
  `two_factor_*`.
- Backend: xóa `services/two_factor.py`, mọi route `/api/auth/two-factor/*`, API
  admin `mfa-impact`/`reset-mfa`, quyền `account.mfa.reset` (deprecated qua
  migration), bộ lọc `mfa`, ordering `two_factor_enabled`, cảnh báo
  `mfa_warning`, email `two_factor`/`mfa_reset_notice`, throttle và biến môi
  trường `TWO_FACTOR_*`. Migration `accounts.0030` xóa bốn field `two_factor_*`
  trên `User`; `knowledgebase.0004` viết lại bài trợ giúp bảo mật tài khoản
  (giữ slug cũ để link công khai không gãy).
- Lệnh `bootstrap_admin_mfa` được thay bằng `verify_admin_email` (chỉ đánh dấu
  email admin đã xác thực và ghi audit). Seed demo admin không còn mã dự phòng.
- Frontend: xóa trang "Xác minh hai bước", panel MFA ở cài đặt NTD/admin, modal
  nhập mã khi đăng nhập, nút "Tài khoản chưa đủ an toàn" ở sidebar NTD, cột/bộ
  lọc MFA trong quản trị tài khoản và phân quyền; luồng khôi phục danh tính còn
  đổi email → gửi link đặt lại mật khẩu.

#### Removed — Dọn code, asset và lệnh không còn dùng

- Frontend: `AccountDetailView` (thay bằng widget `admin-account-detail`),
  `AdminJobApplications`/`AdminJobDisclosure` cùng `getAdminJobApplicationPage`
  và `applicationKeys.adminJobList`; export không ai dùng `SELF_SERVICE_ACTIONS`,
  `ANNOUNCEMENT_PRESENTATION_STATUSES`, `EMPLOYER_ACCOUNT_VERIFICATION_LEVEL_STEPS`;
  ảnh public `topcv-v-brand.svg` và hai bản `procv-ai-robot-market.png` trùng nhau
  (app dùng bản `-v2` trên R2); dependency `@tiptap/extension-link` (StarterKit
  đã kèm) và npm script `quality`.
- Backend: `apps/blog/permissions.py` (`CanEditBlog`), lệnh no-op
  `reconcile_employer_verifications` cùng hàm deprecated
  `reconcile_completed_verification_cases`, bốn lệnh chuyển media một lần
  (`migrate_external_media_to_r2`, `migrate_frontend_assets_to_r2`,
  `migrate_local_media_to_r2`, `normalize_media_references`) và
  `requirements-ai.txt` không có import nào.
- `scripts/codebase_inventory.py` không còn ai gọi. Docs liên quan cập nhật theo.

#### Fixed — Chặn artifact tái phát

- Test settings trỏ mọi media root vào thư mục tạm; trước đây pytest ghi PDF và
  ảnh test vào `backend/private-media` và `backend/public-media` thật.
- `backend/.dockerignore` loại `.venv`, các media root và cache, để `COPY . .`
  không đưa virtualenv hay file riêng tư vào image.

#### Changed — Hợp nhất cấu hình env

- Env chỉ còn ở `backend/` và `frontend/`, mỗi nơi một cặp `.env`/`.env.example`.
  Xóa `.env`/`.env.example` ở root và hai file `.env.optional.example`; nội dung
  catalog optional gộp vào `.env.example` theo nhóm. Frontend dùng `frontend/.env`
  thay cho `.env.local`.
- `docker-compose.yml` không còn interpolation `${...}`: PID limit, log rotation,
  concurrency Celery và tài nguyên ClamAV cố định trong file. Bật scanner bằng
  `docker compose --profile scanner up`.
- Gỡ biến không có consumer: `AI_POLICY_CACHE_SECONDS`,
  `CV_ARCHIVE_RESTORE_WINDOW_DAYS`, `REQUIRE_APPROVED_EMPLOYER_CANDIDATE_ACCESS`
  (cờ chưa từng được đọc; test xác nhận nó không có tác dụng đã bỏ).
- Thêm `scripts/sync_local_env.py` đồng bộ `.env` local theo `.env.example`, giữ
  giá trị đang có. `check_env_sync` kiểm thêm file env đặt sai chỗ, interpolation
  trong Compose và key thiếu/thừa/sai kiểu trong `.env` local; bỏ
  `scripts/env_inventory.py`.

#### Changed — Tối ưu thời gian CI (#162)

- Backend test chạy song song bằng `pytest-xdist` (`-n auto --dist loadfile`;
  `PYTEST_WORKERS=0` để chạy tuần tự), dùng MD5 password hasher chỉ trong test
  settings và PostgreSQL CI trên tmpfs với fsync tắt.
- Frontend unit và E2E chia shard; E2E CI chạy trên bundle production
  (`PLAYWRIGHT_WEB_SERVER=preview`) và cho phép một lần retry, test cần retry bị
  báo `flaky`.
- Cập nhật dependency frontend có lỗ hổng, giữ nguyên bundle budget.

#### Removed — Gói dịch vụ, quyền lợi và yêu cầu tư vấn (ADR-0015)

- Xóa API `/api/services/*` (catalogue gói, phiên bản, cấp lượt, kích hoạt dịch
  vụ cho tin, làm mới tin, thông báo việc làm trả phí, audit, yêu cầu tư vấn) và
  `/api/jobs/remarketing/saved/*`. Migration `services.0012` xóa 15 bảng; dữ
  liệu không khôi phục được, cần sao lưu trước khi chạy.
- Danh sách việc làm chỉ còn thứ tự tự nhiên: nhãn `tier` do quản trị viên gán,
  rồi thời điểm đăng. Box "Việc làm tốt nhất" chỉ nhận tin `tier=top`. Nhãn
  `tier`, `is_hot`, `is_urgent`, `has_flash_badge` và object `presentation` giữ
  nguyên.
- Posting context bỏ object `services`; pause impact của chiến dịch bỏ
  `active_services`.
- Bỏ 10 quyền admin `consultation_lead.*`, `service_catalog.*`,
  `service_entitlement.*`, `service_audit.view` (`accounts.0029` đánh dấu
  deprecated) và phòng ban mẫu "Dịch vụ nhà tuyển dụng".
- Bỏ 3 tác vụ Celery beat, định tuyến hàng đợi và 10 biến môi trường của mảng
  dịch vụ.
- Frontend: bỏ trang báo giá, trang dịch vụ của nhà tuyển dụng, quản trị gói
  dịch vụ và lead tư vấn, form và nút tư vấn nổi, lane remarketing việc đã lưu,
  tab dịch vụ trong chi tiết tin và chiến dịch.
- Xóa thư mục `backend/apps/services` và bỏ app khỏi `INSTALLED_APPS`.
  Migration `jobs.0049` xóa content type, quyền Django, nhật ký admin và bản
  ghi `django_migrations` còn sót của app. Chỉ triển khai sau khi
  `services.0012` đã chạy ở môi trường đó.

#### Added — Cam kết khi đăng tin và trạng thái tạm ẩn cho nhà tuyển dụng

- Đăng tin nháp và mở lại tin đã đóng yêu cầu `responsibility_statement_version`
  khớp bản cam kết đang có hiệu lực; thiếu hoặc sai trả
  `JOB_RESPONSIBILITY_REQUIRED`. Posting context trả `responsibility_statement`;
  tin lưu `responsibility_accepted_at` và `responsibility_statement_version`
  (`jobs.0048`). Form đăng tin và hộp thoại mở lại tin có ô xác nhận; trang chi
  tiết tin của admin hiển thị thời điểm nhà tuyển dụng cam kết.
- API tin của nhà tuyển dụng trả `visibility_hold` (loại, thời điểm, nhóm lý
  do, không gồm ghi chú nội bộ); báo cáo hiệu quả tin của chiến dịch trả
  `visibility_held`. Cổng nhà tuyển dụng gắn nhãn "Tạm ẩn", giải thích ở trang
  chi tiết và ẩn các thao tác bị từ chối khi tin đang tạm ẩn.

#### Changed — Hậu kiểm tin tuyển dụng thay cho duyệt trước (ADR-0014)

- Nhà tuyển dụng đăng tin là tin công khai ngay: `submit` và `reopen` chuyển
  tin sang `active`, khởi tạo hoặc tiếp tục vòng đời hiển thị và chụp snapshot
  nội dung. Sửa tin đang tuyển có hiệu lực tại chỗ, không đổi `published_at`.
- Điều kiện trước đây kiểm tra khi duyệt nay chặn ngay thao tác đăng: hồ sơ xác
  thực đã được chấp nhận cho đúng công ty, DPA còn hiệu lực, không có compliance
  hold và chiến dịch đang chạy. Không đạt thì API trả `JOB_PUBLICATION_BLOCKED`.
- Trang quản trị tin chỉ còn tạm ẩn và khôi phục; chi tiết tin trả
  `content_changes` so với nội dung của lần đăng gần nhất và
  `published_job_count` thay cho `approved_job_count`.
- Tin nháp đã từng được đăng không còn xóa được, vì có thể đang giữ hồ sơ ứng
  tuyển.

#### Changed — Giao diện theo mô hình hậu kiểm

- Cổng nhà tuyển dụng: nút "Đăng tin" thay "Gửi duyệt tin", hiển thị lý do khi
  backend trả
  `JOB_PUBLICATION_BLOCKED`; bỏ nhãn, bộ lọc và số đếm "Chờ duyệt", "Từ chối".
- Cổng quản trị: danh sách tin mặc định hiển thị tất cả tin, thêm phạm vi "Có
  báo cáo chờ"; trang chi tiết chỉ còn tạm ẩn và khôi phục, tab "Thay đổi" so
  nội dung hiện tại với bản đã đăng. Xóa feature `review-job-submission`.

#### Removed — Quy trình duyệt tin

- Trạng thái `pending`, `rejected` và cột `rejected_reason` của tin; các hàm
  `approve_job`, `reject_job`; endpoint `/api/jobs/admin/moderation/{id}/review/`;
  các field `approve_blockers`, `approve_requirements`, `approval_required`,
  `jobs_pending`, `pending_job_count`, `rejected_job_count`; scope
  `pending_jobs` của danh sách chiến dịch.
- Quyền admin `job_moderation.approve` và `job_moderation.reject`.
- Site setting `job_auto_approve` chưa từng được dùng.

#### Changed — Chuyển đổi dữ liệu duyệt tin (migration)

- `jobs.0046` đưa mọi tin `pending` và `rejected` về `draft` kèm một dòng lịch
  sử trạng thái; `jobs.0047` xóa hai trạng thái và cột `rejected_reason`.
- Sau khi migrate, chạy `python manage.py publish_converted_pending_jobs` để
  xem trước rồi thêm `--apply` để đăng lại các tin từng chờ duyệt. Chỉ tin đạt
  điều kiện đăng mới công khai; tin còn lại vẫn là bản nháp.
- `accounts.0028` đánh dấu hai quyền duyệt tin là deprecated;
  `sitecontent.0021` xóa setting `job_auto_approve`.

### 2026-10-11

#### Fixed — Ownership và kiểm tra biến môi trường (#160)

- Env checker kiểm hợp nhất các catalog, owner, tên trùng, consumer thiếu hoặc
  thừa và kiểu cast; xác nhận Docker smoke với cấu hình mới.

### 2026-10-10

#### Changed — Cấu hình môi trường tối thiểu (#159)

- Backend chỉ đọc `backend/.env` cùng process environment; `.env.example` chỉ
  còn cấu hình tối thiểu, các tích hợp và tuning chuyển sang
  `.env.optional.example` (không tự nạp). Frontend tách tương tự.
- Compose chỉ giữ override hạ tầng nội bộ (DB, Redis, media, ClamAV). Thêm
  `scripts/check_env_sync.sh` và `scripts/env_inventory.py`.

### 2026-09-30

#### Removed — Cấu hình deploy production

- Bỏ `docker-compose.prod.yml`, `deploy/nginx/`, `frontend/Dockerfile` và
  `frontend/nginx.conf`; dự án chỉ còn Compose cho local.

### 2026-09-27

#### Fixed — Chẩn đoán và ổn định test CI (#156)

- Pytest xuất `--durations`, JUnit và `faulthandler_timeout=120`; Vitest xuất
  JUnit; Playwright giữ trace ở lượt chính. E2E CI khóa
  `VITE_API_BASE_URL` để route mock không phụ thuộc hostname.
- Sửa fixture và assertion cũ làm 34 E2E lỗi; E2E smoke đạt trên ba viewport.

#### Removed — Artifact sinh ra trong repo (#157)

- Bỏ media test giả và artifact runtime khỏi Git; `scripts/clean_artifacts.sh`
  chỉ xóa file tái tạo được.

### 2026-09-24

#### Added — Baseline tái tổ chức ProCV (#155)

- Kiểm kê repo, hợp đồng hành vi (API, migration, quyền, task, UI) và số đo CI
  làm mốc cho kế hoạch tái cấu trúc P0–P10.

### 2026-09-23

#### Removed — App interviews và route placeholder (#154)

- Xóa app `interviews` chưa dùng và các route giữ chỗ không có nội dung.

### 2026-09-08

#### Removed — Text-to-speech (#153)

- Gỡ tính năng đọc bài blog bằng giọng nói cùng worker, cache và 14 biến môi
  trường TTS.

### 2026-09-05

#### Added — Danh bạ công ty công khai (#151)

- Trang danh sách công ty có tìm kiếm và API công khai (ADR-0013).

#### Fixed — CI và bảo mật dependency

- Sửa bundle budget frontend và timeout test backend trên CI; nâng `nanoid`
  lên 3.3.18 để xử lý cảnh báo audit mức cao.

### 2026-08-14

#### Added — So sánh việc làm (#150)

- Ứng viên chọn nhiều tin để so sánh trong một dock dùng chung giữa các trang.

#### Added — Gợi ý việc làm theo nhu cầu ứng viên (#149)

- Gợi ý dựa trên nhu cầu việc làm đã khai báo khi onboarding, cho phép ẩn tin
  không phù hợp.

### 2026-08-13

#### Added — Xác minh tên miền công ty và huy hiệu tin cậy (#148)

- Nhà tuyển dụng xác minh tên miền công ty qua bản ghi TXT; tin của công ty đạt
  điều kiện hiển thị huy hiệu tin cậy.

#### Added — Nền tảng dịch vụ tin tuyển dụng (#146, #147)

- Catalogue gói có phiên bản, quyền lợi, kích hoạt dịch vụ cho tin, tin tài trợ,
  làm mới tin, số liệu quảng bá và remarketing việc đã lưu. Toàn bộ mảng này đã
  được gỡ ở ngày 2026-11-13 (ADR-0015).

### 2026-08-12

#### Added — AI tạo tin tuyển dụng (#145)

- Nhà tuyển dụng tạo bản nháp tin bằng AI qua `apps.ai_core`, có ranh giới field,
  quota và lưu nguồn gốc của bản nháp.

#### Changed — Xác thực nhà tuyển dụng theo tài khoản (#144)

- Bỏ model xác thực công ty cũ; xác thực gắn với tài khoản nhà tuyển dụng.
- Admin xem tab tin tuyển dụng của từng công ty trong danh bạ quản trị.

#### Added — Tự động từ chối hồ sơ quá hạn

- Tin có thể đặt `auto_reject_after_days`; nhà tuyển dụng được nhắc trước và ứng
  viên nhận email sau khi hồ sơ bị từ chối. Nhãn trạng thái "Không đạt" đổi
  thành "Từ chối".

### 2026-08-11

#### Added — Thông báo việc làm cho ứng viên (#143)

- Ứng viên tạo bộ lọc thông báo việc làm và nhận email tổng hợp định kỳ.

### 2026-08-10

#### Added — Employer rollout readiness và monitoring

- Thêm audit command chỉ đọc, xuất JSON aggregate-only cho schema, upload,
  scanner, SMS, DPA, Celery, retention và legacy cohort; strict mode fail-closed
  và không tự backfill/apply.
- Thêm metric PII-free cho notification create/dedupe/retention và runbook ER-8
  mô tả rollout tuần tự, Chrome QA, ngưỡng dừng, rollback và compatibility soak.
- Giữ migration notification đã phát hành ở `0042`; tách preference/email
  outbox dedupe sang `0043` additive để DB Docker cũ và fresh install cùng an toàn.

#### Added — Employer notification center và activity log

- Bật chuông topbar có unread badge, popover, trang thông báo phân trang, trạng
  thái đã đọc/đọc tất cả và deep-link nội bộ về đúng workflow xác thực/công ty.
- Thêm activity log riêng cho sự kiện nghiệp vụ quan trọng; event được ghi
  idempotent cùng transaction, chỉ giữ metadata allowlist và không lộ file,
  storage key, hash hoặc danh tính quản trị viên.
- Email quyết định xác thực tiếp tục qua outbox có retry; bổ sung sweep 60 giây
  và retention 730 ngày cho notification/activity/outbox đã kết thúc.

#### Added — Employer company link recovery

- Thêm admin impact-preview và confirm có signed token để gỡ liên kết công ty
  chọn nhầm khi recruiter còn hoàn toàn clean; reason và audit event bắt buộc.
- Khóa thao tác nếu là company owner hoặc đã có giấy tờ, verification/tax
  history, update request, nhu cầu, campaign, job hay compliance hold; không
  xóa công ty hoặc tái sử dụng proof của công ty cũ.
- Thêm permission rủi ro cao `employer_verification.unlink_company`, không cấp
  mặc định cho role quản trị.

#### Added — Employer SMS verification live workflow

- Chuyển endpoint xác thực phone từ OTP email legacy sang challenge SMS có
  public ID, trạng thái poll, cooldown, attempt budget và replay protection.
- Hỗ trợ xác thực lần đầu, đổi số giữ proof cũ tới khi thành công và self-
  reverify; UI không còn gọi availability oracle hoặc thông báo gửi mã qua email.
- Chặn employer đổi phone trực tiếp qua `/api/auth/me/`; xóa task/service OTP
  email legacy và không còn đưa raw phone/OTP vào Celery broker.

#### Added — Employer DPA evidence core

- Thêm bằng chứng DPA append-only theo exact version/SHA-256, thời điểm, IP,
  phiên đăng nhập và hash User-Agent; không backfill giả dữ liệu lịch sử.
- `GET /api/employer/me/` công bố `dpa_policy`; `POST /api/employer/dpa/accept/`
  fail closed khi policy stale/misconfigured. Frontend khóa xác nhận khi chưa có
  policy hiện hành và yêu cầu re-consent cho `legacy_unversioned|outdated`.

#### Added — Employer DPA grace và compliance hold

- Thêm grace 30 ngày có deadline/rollout ID cho DPA legacy hoặc outdated;
  hết hạn chuyển sang `hold`, khóa workspace/candidate-data/job approval theo
  canonical readiness và liên kết hold với campaign/job hiện hữu.
- Thêm command rollout dry-run mặc định, batch/cursor idempotent và query phẳng;
  chỉ `--apply` sau ops review. Tái đồng ý exact DPA hiện hành chỉ gỡ hold nguồn
  DPA, giữ nguyên verification/account/moderation hold.
- `GET /api/employer/me/` trả `dpa_grace_expires_at`; trang DPA hiển thị đúng
  deadline hoặc trạng thái quá hạn tại đúng workflow, không thêm badge vào
  checklist xác thực.

#### Fixed — Employer verification và company settings UX

- Route job/campaign/application bị chặn do chưa đủ readiness nay điều hướng về
  checklist `employer-verify`, không thay trang nghiệp vụ bằng cảnh báo
  “Workspace tuyển dụng chưa sẵn sàng”. Lỗi tải readiness vẫn fail-closed với
  retry.
- Trang verify bỏ hai banner readiness/case status trùng lặp, giữ checklist và
  tiến độ làm nội dung chính.
- Trang thông tin công ty không còn tải/hiển thị lịch sử yêu cầu của member
  khác. Update form có nút quay lại, khóa gửi khi chưa có thay đổi thật và
  không còn toast thành công giả cho diff rỗng.
- Update request không còn tự thêm hoặc bắt sửa tên thương mại legacy khi người
  dùng chỉ thay đổi trường khác.
- Form GPKD/DPA chỉ đọc `scope=mine`; summary trạng thái lấy đúng current file
  đang hiển thị, không bị một tài liệu của member khác làm hiện “bị từ chối”.
- Nút Google ở cổng employer giữ nền sáng và contrast chữ đạt mức đọc được kể
  cả khi HTML còn class dark từ portal khác.

#### Added — Employer verification final-decision backend ER-5

- Tách document review khỏi quyết định cuối; thêm preview/confirm có signed
  impact token cho approve/changes-requested/reject và revoke/expire manual.
- Thêm tax advisory override có permission/lý do riêng, state
  `revoked`/`expired`, reapprove event và legacy classifier dry-run mặc định.
- Thêm verification compliance hold theo source với liên kết campaign/job;
  revoke/expire chặn candidate-data/job approval và ẩn active public job nhưng
  không downgrade company hoặc khóa workspace/tạo/sửa/gửi tin.

#### Added — Admin employer final-decision UI ER-5

- Admin phải xem impact trước khi xác nhận approve/changes-requested/reject,
  revoke hoặc expire; stale impact tải lại hồ sơ và bắt preview lại.
- Company/capability/resource impact được trình bày trong modal; trường hợp
  nguồn thuế chưa đủ kết luận được diễn đạt thành **duyệt thủ công**, bắt buộc
  quyền, xác nhận đã đối chiếu giấy tờ gốc và lý do audit.
- Màn kiểm duyệt tin giữ nút duyệt disabled theo blocker backend và hiện link
  exact recruiter verification chỉ cho actor có quyền xem màn đích.
- Thiết kế lại tab Xác thực thành bàn xử lý gọn: bộ giấy tờ theo bốn cột trạng
  thái có kéo thả và menu tương đương, preview ở vùng chính, quyết định cuối ở
  rail, điều kiện/lịch sử thu gọn; hồ sơ nộp lại có action **Nhận xử lý lại**.
- Cụm quyết định cuối dùng lưới hành động ổn định, nút chính chiếm toàn hàng và
  không xuống dòng trên desktop, tablet hoặc mobile.

#### Fixed — Employer verification impact token và admin counters

- Chuẩn hóa thứ tự mọi collection trong decision integrity fingerprint trước
  khi ký và xác nhận. Nhiều bản ghi tra cứu thuế không còn gây `409 stale` giả
  khi admin từ chối hồ sơ mà dữ liệu thực tế không đổi; thay đổi nội dung thật
  vẫn bị chặn và yêu cầu xem tác động lại.
- Badge sidebar quản trị dùng đúng summary query theo domain, cập nhật sau
  mutation, khi focus lại cửa sổ và theo chu kỳ 30 giây; số 0 không còn thêm
  padding và số lớn được rút gọn thành `99+`.

#### Fixed — Employer verification resubmit và giới hạn từ chối

- Case bị từ chối chỉ về `pending`/tăng revision sau khi recruiter thay toàn bộ
  current document cần sửa; admin có thể duyệt giấy tờ và quyết định cuối lại.
- Chỉ final decision `rejected` tăng bộ đếm. Document reject/changes-requested
  không tính; final reject thứ ba khóa nộp lại nhưng không tự ban tài khoản.
- Thêm permission riêng `employer_verification.resubmission_unlock`; mở khóa
  yêu cầu lý do + lock version, giữ nguyên rejection count và audit history.
- Employer document API hỗ trợ `scope=mine` để form chỉ đánh giá bộ giấy tờ của
  actor, không trộn tài liệu của member khác cùng công ty.

#### Security — Verification race, redaction và RBAC ER-5

- Chuẩn hóa lock order từ User/Recruiter/VerificationCase đến company/resource;
  approve-vs-revoke commit sau luôn recheck và không thể công khai tin dưới
  verification đã mất hiệu lực.
- Reapprove chỉ gỡ exact verification hold; giữ nguyên DPA/account/moderation
  hold. Hai permission revoke/tax override được seed nhưng không grant mặc định.
- Stored decision snapshot dùng allowlist; response thiếu quyền nhạy cảm không
  lộ integrity fingerprint, tax response hash hoặc raw document filename.
- OpenAPI, contract frontend và admin UI cùng enforce workflow hai bước; UI
  không tự suy eligibility hoặc gọi confirm khi chưa có signed impact token.

#### Added — Employer upload-session integration ER-3

- Nối upload session/quarantine vào giấy tờ xác thực, DPA, yêu cầu cập nhật công
  ty và logo/cover/gallery. Backend recheck owner, purpose, clean state và
  one-time claim trong transaction; business document/media giữ liên kết audit
  tới private `UploadAsset` đã quét.
- Thêm post-scan structural validation: PDF parse strict, ảnh verify bằng Pillow
  và DOCX dùng bounded container validator. File malware-clean nhưng sai/hỏng
  định dạng vẫn bị từ chối, không tạo business record.
- Frontend pre-scan toàn bộ tập file trước khi tạo company/update request, hiển
  thị trạng thái scan, retry bounded và attach tuần tự; bỏ partial-success khi
  một file lỗi. Raw fallback chỉ còn cho exact `UPLOAD_PIPELINE_DISABLED` trong
  compatibility window; strict rollout dùng `EMPLOYER_UPLOAD_SESSION_REQUIRED`.
- OpenAPI/runbook bổ sung contract upload-session, machine errors và thứ tự bật
  quarantine → staging gate → strict raw-upload lock. PostgreSQL Docker và real
  ClamAV local gate đã đạt; ER-3 còn Chrome và production-like staging/strict.

#### Added — Candidate CV upload quarantine integration ER-3

- Import CV PDF/DOCX có/không template và avatar nay ưu tiên upload session
  purpose `candidate_cv`; backend chỉ parser/decode sau clean verdict, exact
  owner/purpose recheck và one-time claim.
- Import template giữ idempotency; avatar clean được verify/re-encode thành
  private derivative. File clean nhưng hỏng cấu trúc rollback claim và không tạo
  CV/asset.
- Xóa CV hoặc hết hạn source release claim nhưng giữ clean evidence theo minimum
  retention; không xóa storage byte trực tiếp hoặc bịa scan proof cho file cũ.
- Frontend library, template import, form ứng tuyển và avatar editor chờ scan;
  các bề mặt tải CV hiển thị trạng thái an toàn. Compatibility raw chỉ dùng khi
  pipeline trả exact `UPLOAD_PIPELINE_DISABLED`; strict rollout dùng
  `CANDIDATE_UPLOAD_SESSION_REQUIRED`.

#### Added — Shared upload quarantine core ER-3

- Thêm shared app `uploads` với session/asset/scan-attempt state machine,
  owner-scoped API, purpose/role capability map và transactional owner quota.
  Quarantine/private byte còn tồn tại tiếp tục chiếm quota sau expiry/rejection
  cho tới khi cleanup thực sự xóa storage key.
- Thêm ClamAV INSTREAM adapter, bounded retry/lease/reconciliation, expiry,
  cleanup và evidence purge trên queue `upload-scan`; status polling tách sang
  `upload_status=120/min`, còn create/cancel/retry giữ `30/hour`.
- Thêm clean-only claim bắt buộc owner và expected purpose, explicit release,
  minimum retention 730 ngày, legal hold và privacy scrub metadata sau khi byte
  cùng claim không còn giữ evidence.

#### Security — Upload validation và rollout boundary ER-3

- Thêm Compose profile `scanner` dùng image chính thức
  `clamav/clamav:1.4_base`, signature volume riêng, không publish TCP 3310 và
  opt-in integration test cho clean PDF cùng DOCX chứa EICAR. Apple Silicon
  chạy image pin qua `linux/amd64` emulation.
- DOCX pre-scan validation nay kiểm bounded ZIP metadata, required parts,
  encryption, traversal/symlink, duplicate entry, entry/uncompressed/ratio
  limits và không extract Office content trước scan. PDF/image mới chỉ kiểm
  MIME, dung lượng, magic signature và malware; chưa được tuyên bố hợp lệ ở cấp
  parser.
- Shared core đã merge tại `99b34781`; employer và candidate business workflow
  hiện đều tích hợp qua public service boundary của shared app `uploads`, không
  tạo coupling `cvs → employers`. Production flag tiếp tục tắt cho tới khi real
  production-like ClamAV staging cùng candidate Chrome runtime đạt gate; ER-3
  vẫn `In progress`.

#### Added — Employer SMS provider-neutral foundation ER-6A

- Thêm challenge SMS theo purpose (`initial_verification`, `phone_change`,
  `reverify`), adapter HTTP trung lập, fake provider cho development/test,
  queue `auth-sms`, recovery bounded, metrics redacted và retention task. Đây
  mới là hạ tầng; endpoint OTP hiện hành, frontend và nhà cung cấp production
  chưa được chuyển sang SMS.
- Thêm readiness command và production startup validation cho HTTPS endpoint,
  credential, sender, template, Fernet/HMAC key riêng. Production tiếp tục giữ
  `EMPLOYER_SMS_OTP_ENABLED=False` cho tới khi Product/Ops duyệt provider,
  sender và template.

#### Security — Employer SMS fail-closed boundary ER-6A

- Destination và OTP của challenge mới được mã hóa; OTP hash gắn với public
  challenge ID, Celery chỉ nhận opaque ID, HTTP không theo redirect và không
  ghi raw phone/OTP/provider response. Challenge PII được purge sau 30 ngày;
  event redacted giữ 730 ngày.
- Khi SMS tắt hoặc cấu hình/provider lỗi, dispatch fail closed, không fallback
  email và không giả delivery. Migration không gắn marker, deadline hoặc hold
  và không thay đổi phone proof của tài khoản cũ.

#### Security — Employer company-update review safety ER-4

- Chuẩn hóa lock order `Company → CompanyUpdateRequest → CompanyDocument` cho
  create/upload/review/tax-refresh hiện hành và khóa mutation trực tiếp qua
  Django admin.
- Admin list/retrieve che filename, MIME, size, SHA, uploader email và source
  URL nếu thiếu `account.sensitive.view`; binary vẫn yêu cầu đồng thời quyền
  xem company update và quyền sensitive.

#### Fixed — Exact company-update review ER-4

- Admin queue/deep-link nay truyền exact request public ID và detail gọi
  retrieve-by-ID; panel từ chối xử lý nếu company, requester hoặc trạng thái
  không khớp. Không còn lấy `results[0]` từ danh sách company rồi có thể duyệt
  nhầm yêu cầu của member khác.

#### Added — Employer company-update lifecycle V2 ER-4

- Thêm revision snapshot bất biến, event append-only và state
  `submitted/in_review/changes_requested/approved/rejected/withdrawn/cancelled`.
  Nhiều member được gửi request riêng; mỗi requester chỉ có một active request
  trên company.
- Recruiter được sửa/gửi lại/rút trước review, owner được hủy trước review;
  admin phải nhận review exact revision rồi mới duyệt tài liệu hoặc ra quyết
  định cuối tường minh.
- Apply dùng field-level base conflict và không partial write. Form company chỉ
  gửi diff thật, không tự thêm tên thương mại legacy, không hiển thị company
  request history và luôn có nút quay lại.
- Tách migration schema `employers.0037` khỏi backfill `0038`; dữ liệu cũ giữ
  requester, tạo revision 1 và migrated event mà không gọi dịch vụ ngoài.

#### Security — Upload storage boundary ER-3 foundation

- Tách storage public/private/quarantine cho local và Cloudflare R2; chỉ public
  được phép qua `/media`, private/quarantine không phát direct URL. Root shared
  cũ trở thành nguồn migration không phục vụ trực tiếp.
- Sửa production Compose override để không kế thừa bind-mount source hoặc các
  cổng backend/PostgreSQL/Redis/Vite từ cấu hình development; chỉ nginx publish
  cổng và chỉ mount public media.
- Thêm lệnh kiểm kê/copy layout dry-run mặc định, idempotent, batch/cursor và
  hash verify; unknown key fail-closed về private, đồng thời nhận đúng
  `gallerys/` và các prefix public hiện hành.
- Raw DOC/DOCX employer preview trước upload trả `UPLOAD_SCAN_REQUIRED` và
  không gọi LibreOffice. Preview/download document đã lưu vẫn đi qua endpoint
  có authorization. Shared upload session/scanner/retention core đã merge;
  employer/candidate domain integration, frontend và real-scanner staging tiếp
  tục ở các slice ER-3 kế tiếp.

#### Changed — Employer readiness contract ER-2

- `/api/employer/me/` nay trả năm field readiness canonical và `/api/auth/me/`
  trả `employer_job_workspace_ready`. Workspace việc làm, verification approval,
  candidate-data và DPA không còn bị gộp vào một boolean legacy.
- Frontend tách `JobWorkspaceGuard` khỏi `CandidateDataGuard`, cập nhật login
  destination, checklist và compliance strip theo machine blocker/action.
  Direct URL bị từ chối giữ nguyên để hiển thị lý do và retry.

#### Security — Employer candidate-data boundary ER-2

- Backend áp cùng capability policy cho employer job/campaign mutation và mọi
  đường application list/export/status/history/snapshot, dashboard/job/campaign
  preview, activity metadata/deep-link và recruiter CV asset content; không còn
  feature-flag bypass. Recruiter asset token được audience-bound và live
  reauthorize trước khi mở nội dung.
- Frontend không mount hoặc query JobDetail applications và campaign Apply CV/
  Activity khi readiness checking/error/denied; PII, avatar, preview và CV link
  đã cache cũng bị bỏ ngay khi quyền chuyển `true → false`. Aggregate không chứa
  danh tính vẫn được giữ lại trong các bề mặt job/campaign/dashboard.

#### Fixed — Employer request state ER-1A

- Thẻ “Yêu cầu của tôi” nay chỉ đọc `scope=mine`; employer page không tải
  `scope=company`, nên member mới không còn thấy request hoặc ngày của member
  khác. Ngày chỉ lấy từ `submitted_at` hợp lệ, không fallback
  sang `created_at`/`updated_at` và không hiển thị placeholder giả.
- Tách rõ loading/error/empty/has-data. Lỗi tải lần đầu hoặc refresh nền đều
  hiện retry và khóa fail-closed toàn bộ thao tác tạo, sửa, upload, xóa media và
  submit cho đến khi actor scope đồng bộ thành công.
- Contract `scope=company` và redaction vẫn giữ ở backend cho admin/audit và
  compatibility; không còn component history trong company settings recruiter.

#### Security — Employer document access ER-1B

- Tách quyền xem metadata và quyền mở binary giấy tờ: requester/uploader và
  company owner được mở file; member khác chỉ nhận metadata đã che và direct
  content trả `404`. Storage key, tên file, MIME, kích thước và preview media
  không còn lộ qua lịch sử company cho actor không có quyền.
- Yêu cầu cập nhật công ty nay giới hạn một `pending` trên mỗi
  `(company, requester)` nên nhiều member có thể gửi song song mà không ghi đè
  nhau. `requested_by` bất biến, có `submitted_at`, `scope=mine|company` và
  requester summary không chứa email.

#### Security — Employer hardening ER-1C

- Job moderation nay fail-closed khi recruiter chưa có verification case đã
  duyệt đúng company hoặc chưa chấp thuận DPA. Canonical decision,
  compatibility review và Django-admin service path đều dùng cùng một backend
  guard; frontend không thể tự bỏ blocker để duyệt.
- Quyết định approve khóa và đọc lại recruiter, verification case và campaign
  trong transaction; lỗi trả `JOB_APPROVAL_BLOCKED` cùng blocker code ổn định
  `verification_required`/`dpa_outdated`.

### 2026-08-06

#### Added — Announcement visual theme (AN-V0 / AN-V1 / AN-V2)

- Mở epic **AN-V** nâng cấp dải thông báo đa cổng: chọn màu hiển thị (mode
  `kind` / `preset` / `custom` hex) và ảnh nền strip (ví dụ 980×31) kèm overlay
  contrast. Đặc tả:
  [`docs/01-phan-tich/dac-ta-thong-bao-da-cong.md`](docs/01-phan-tich/dac-ta-thong-bao-da-cong.md).
- **AN-V1 backend:** migration `sitecontent.0017_announcement_revision_visual_theme`
  thêm field theme/background trên `AnnouncementRevision`; service
  `normalize_theme_and_background` (hex `#RRGGBB`, storage key ảnh, ép overlay
  `dark` khi có ảnh); public feed trả `theme` + `background.image_url`; admin
  revision đọc/ghi field visual (storage key chỉ admin).
- **AN-V2 admin:** `POST /api/site/admin/announcements/backgrounds/` upload
  JPEG/PNG/WebP (640–2400×24–120, ≤1MB); form editor theme + ColorPicker + upload
  nền; live preview Desktop/Tablet/Mobile với token màu shared
  (`resolveAnnouncementThemeTokens`), mobile line-clamp 2, height theo content
  (không khóa 31px).
- **AN-V3 runtime:** public contract normalize `theme`/`background`; strip áp CSS
  variables + ảnh/overlay (`buildAnnouncementStripVisual`); tắt sheen khi có
  ảnh; nút điều khiển mobile 44×44; system banner vẫn palette theo kind.
- Tests: backend visual/upload + FE contract/theme/strip visual. Cập nhật
  `docs/TIEN-DO-DU-AN.md`, runtime guide.

### 2026-08-05

#### Changed — Rút gọn FAQ ứng viên và mở ảnh HTTPS

- Rút trang `/tro-giup` về đúng hai khối chuyên mục + danh sách câu hỏi; bỏ hero,
  type filter, topic cards và counter. Cột phải chỉ giữ một ô tìm kiếm toàn bộ
  chuyên mục, debounce nhưng không ghi query lên URL. Kết quả hiển thị tổng số,
  nhãn chuyên mục phía trên tiêu đề, tô sáng phần chữ khớp không phân biệt dấu
  và hiện mô tả đầu nội dung trên đúng một dòng có dấu “…”. Cột chuyên mục cố
  định, bỏ mục “Tất cả chủ đề”, giữ nguyên vị trí khi mở chi tiết và lấy màu chữ
  “Chuyên mục” từ `brand_primary_color` qua CSS variable của hệ thống. Khung
  danh sách dùng nền trong suốt; từng câu hỏi là thẻ nền trắng có khoảng hở,
  viền và hover riêng thay vì dính thành một mảng. Sidebar chi tiết đổi nhãn
  “Trong chuyên mục này” thành “Tên chuyên mục”; bài đang xem chỉ nhận trạng
  thái active và giữ nguyên vị trí theo `order`, không còn bị đưa lên đầu.
- Media library trở thành tùy chọn: revision chấp nhận ảnh URL HTTPS hoặc đường
  dẫn nội bộ an toàn mà không yêu cầu upload vào ProCV trước; sanitizer và alt
  text vẫn là bắt buộc, readiness chỉ kiểm storage existence cho ảnh media nội
  bộ. Editor FAQ có thêm tab **Từ URL** để chèn trực tiếp nguồn ảnh hợp lệ.
- Đưa khối “Bước tiếp theo” và các nút gửi duyệt/duyệt/yêu cầu chỉnh sửa lên đầu
  workspace biên tập; Lưu/Xem trước nằm trên thanh sticky để không bị che trên
  mobile. Khi cuộn, topbar admin, thanh hành động và toolbar rich-text được xếp
  thành các lớp riêng có khoảng cách, không còn chồng/cắt nút hoặc nội dung.
  Trang chi tiết render ảnh HTTPS/nội bộ, hiển thị cả giờ cập nhật và dùng nhãn
  “Câu hỏi tiếp” cho điều hướng cuối bài.
- Sửa deadlock UX khi tạo revision của bài đã xuất bản: form chỉ đọc không còn
  bị validate trường `change_summary` không thể nhập. Nút tạo revision mở modal
  nhập tóm tắt bắt buộc, clone nội dung sang draft rồi mở lại toàn bộ trường để
  tiếp tục sửa. Nút gửi duyệt/duyệt/yêu cầu sửa chuyển sang cụm compact 30 px,
  selector CSS được scope riêng nên không còn bị style Ant Design lan rộng.
- Loại bỏ outline lồng trên input con của ô tìm kiếm Ant Design; wrapper vẫn giữ
  focus state rõ ràng ở portal admin và nhà tuyển dụng.
- Xác minh: 48 regression backend, 889 unit/coverage frontend, 6 targeted unit
  cho thay đổi tìm kiếm và 6 smoke E2E FAQ public/admin trên
  desktop/tablet/mobile đều pass; Ruff, format,
  import-linter, migration drift, lint, architecture và production build xanh.

#### Added — FAQ/Help Center KB-P1 foundation

- Thêm app Django `knowledgebase` theo ADR-0010 với category, article ổn định,
  revision có partial unique constraint cho một bản mở và media asset có kích
  thước xác minh; ID public dùng prefix `kbc/kba/kbr/kbm`.
- Seed idempotent đúng bảy chuyên mục đã chốt và bốn permission
  `knowledgebase.view/manage/review/publish`; role `content-cv` staff được biên
  tập, manager được duyệt/phát hành.
- Tách sanitizer HTML giàu nội dung dùng chung sang `common/html/content.py`,
  chặn active content, credential và URL scheme nguy hiểm; blog chuyển sang
  helper chung mà vẫn giữ policy URL tương thích.
- Targeted backend test, migration drift check, Ruff, import-linter và backend
  layering gate đều đạt.

#### Added — FAQ/Help Center KB-P2 workflow và admin API

- Thêm transactional service cho toàn bộ lifecycle revision/article/category,
  khóa hàng và `revision_token` trả 409 khi stale; bản public tiếp tục ổn định
  trong lúc bản sửa còn draft/in-review/rejected và hỗ trợ rollback revision đã
  duyệt.
- Mở admin API quản lý category, article, revision, reorder, review, publish,
  archive/restore và media; bốn permission được kiểm độc lập ở backend, response
  quản trị luôn `private, no-store`.
- Nội dung được sanitize/canonicalize, sinh plain text + SHA-256, ảnh bắt buộc
  thuộc media library và có alt; upload chỉ nhận JPEG/PNG/WebP tối đa 5 MB,
  resize trong 1600×1600 và lưu kích thước sau xử lý.
- Audit chỉ ghi metadata nhỏ, không ghi body/review note. List admin giữ query
  budget cố định 3 query cho 5 bài. 22 targeted/regression test cùng Ruff,
  migration drift, import-linter và layering gate đều đạt.

#### Added — FAQ/Help Center KB-P3 workspace quản trị

- Thêm route lazy `/admin/app/knowledgebase`, trang tạo và workspace biên tập;
  navigation và permission catalog dùng đủ `view/manage/review/publish`.
- Danh sách quản trị có dashboard, tìm kiếm, filter category/type/revision/review
  due, sort và phân trang server-side lấy URL làm nguồn chuẩn; drawer chuyên mục
  hỗ trợ tạo, sửa, sắp xếp, bật/tắt và cảnh báo ảnh hưởng nội dung công khai.
- Editor rich text lưu tường minh, dirty guard, local recovery, media library
  JPEG/PNG/WebP, readiness checklist, preview sanitized, optimistic concurrency
  và khóa metadata sau lần publish đầu.
- Workflow revision có diff với bản public, lịch sử, submit/approve/reject có
  ghi chú, publish với ngày rà soát, archive/restore; action tách feature và ẩn
  theo RBAC. Modal workflow mobile dùng footer full-width không chồng nút.
- Lint phần thay đổi và architecture check sạch, production build đạt, 13
  targeted test pass; smoke lưu → duyệt → xuất bản pass ở desktop/tablet/mobile.

#### Added — FAQ/Help Center KB-P4 public help center

- Mở public API category/article browse, search không dấu nhiều token, filter
  type, pagination và detail có related/trước/sau; selector fail-closed chỉ lộ
  revision approved đang publish của article/category active.
- Thêm throttle IP 120/phút, cache policy public 60 giây + stale-while-revalidate
  300 giây, ETag/304, generation invalidation sau mutation public và fallback
  đọc DB khi cache lỗi; kill switch production trả 404 mà không ảnh hưởng admin.
- Thêm SEO shell thật cho home/category/detail với canonical, Open Graph,
  Article và BreadcrumbList; 404 có status thật, toàn bộ rollout KB-P4 giữ
  `noindex, nofollow` và không dùng FAQPage schema.
- Thêm ba route lazy `/tro-giup`, `/tro-giup/:categorySlug` và detail; giao diện
  responsive theo mô hình hero search + sidebar category + question rows, URL
  là nguồn chuẩn cho search/type/page, có loading/empty/error/retry/404 và rich
  content sanitize với ảnh lazy/broken-image fallback.
- 28 test knowledgebase backend pass; 9 frontend regression pass; lint,
  architecture, build pass và smoke browse → search → detail → 404 pass trên
  desktop/tablet/mobile.

#### Added — FAQ/Help Center KB-P5 verified content và entry points

- Thêm bảy bài ProCV đã đối chiếu với route/component thật, mỗi category active
  có một revision approved đang publish; bao phủ tài khoản, bảo mật, tìm việc,
  ứng tuyển, CV, tìm việc an toàn và liên hệ hỗ trợ mà không sao chép nội dung
  hay tài sản từ website tham chiếu.
- Data migration dùng public ID ổn định, chỉ thêm khi slug chưa tồn tại, không
  ghi đè nội dung admin và không reverse-delete dữ liệu/revision sau rollout.
- Public site-settings expose `knowledgebase_public_enabled` trực tiếp từ
  backend kill switch và frontend mặc định fail-closed; nối hai mục Help Center
  trong floating actions cùng mục hướng dẫn CV trên header tới route canonical.
- 26 backend test và 4 frontend regression test pass; Ruff, oxlint và kiểm tra
  kiến trúc frontend đều đạt.

#### Added — FAQ/Help Center KB-P6 hardening và rollout

- Thêm `KNOWLEDGEBASE_SEARCH_INDEX_ENABLED` mặc định tắt, độc lập với public
  kill switch; backend SEO shell, frontend metadata và sitemap chỉ index khi
  public/index/global SEO cùng bật, còn URL search/filter luôn noindex.
- Thêm `/sitemaps/knowledgebase.xml`, chỉ chứa home, category có nội dung và
  article active với revision approved đang publish; sitemap index tự thêm/gỡ
  theo rollout configuration.
- Thêm command `check_knowledgebase_readiness --json` kiểm taxonomy, public
  coverage, source/SEO, hạn review, nội dung an toàn, link route và media/alt;
  lỗi làm command exit khác 0 để chặn rollout.
- Ghi metric request/latency public/admin, zero-result bucket và content state
  qua product metric boundary mà không ghi raw search hay PII; thêm regression
  xác nhận dữ liệu không mất qua chuỗi bật → tắt → bật lại.
- Thêm runbook rollout/rollback, ngưỡng quan sát sau khi có baseline và nguyên
  tắc không reverse-delete migration nội dung. 48 backend và 14 frontend
  regression test mục tiêu đều đạt; full gate đạt 769 backend test (coverage
  86,36%), 886 frontend test, 191 E2E smoke pass và 4 ca không áp dụng được
  skip; lint, format, import/architecture và production build đều đạt.

### 2026-07-29

#### Added — Account status enforcement theo vai trò

- Thay thao tác đổi trạng thái chung bằng state machine rõ: tạm khóa, cấm,
  bắt đầu khôi phục, gỡ giữ tài nguyên và mở lại; cấm/khôi phục tài khoản bị
  cấm vẫn superuser-only ở P0.
- Thêm `AccountStatusTransition` cùng `temporary_lock`/`ban_review`/
  `legacy_lock` cho campaign và job. Workflow không còn đổi campaign active
  thành paused, nhờ đó không làm sai trạng thái nghiệp vụ và chỉ khôi phục đúng
  lớp hold của thao tác.
- Public job selector fail-closed theo job, campaign, poster và campaign owner,
  bao gồm cả danh sách việc làm ứng viên đã lưu; mutation job/campaign/
  application khóa account trước resource để đóng race với admin enforcement.
- Candidate bị hạn chế vẫn giữ CV/application snapshot; employer chỉ được
  chuyển hồ sơ sang `rejected`, không được đẩy pipeline tiến thêm.
- UI admin có modal rộng, thông tin đối chiếu user, dấu bắt buộc, preview tác
  động theo vai trò và hướng dẫn quy trình khôi phục nhiều bước. 409 tự tải lại
  preview nhưng không tự confirm.
- Thêm transactional notice không chứa evidence, permission không grant mặc
  định, command đối soát read-only/`--apply`, tài liệu thiết kế và runbook
  rollout/rollback.
- Quality gate toàn repo: 633 backend test pass, coverage 86.25%; 699 frontend
  unit/integration test pass; production build và bundle budget đạt; 159 E2E
  smoke test pass trên desktop/tablet/mobile. Reconciliation staging local có
  0 mismatch và hai permission nhạy cảm có 0 role grant.

#### Fixed — Animation dải thông báo

- `slide` và `fade` của một thông báo nay lặp nhẹ theo khoảng 4–15 giây đã cấu
  hình; trước đây hiệu ứng chỉ chạy 280–320 ms lúc component vừa mount nên
  người dùng gần như luôn thấy nội dung đứng yên.
- Nhóm có nhiều thông báo vẫn chuyển item theo thời lượng riêng; `static` không
  chuyển động. Animation dừng khi hover/focus/tab bị ẩn và tự tắt khi thiết bị
  yêu cầu reduced motion.
- Preview quản trị chạy đúng loại và thời lượng animation của bản nháp. Verify:
  683 frontend test, lint/architecture/build/bundle budget và 12/12 smoke
  runtime trên desktop/tablet/mobile đều pass.

#### Fixed — Luân phiên và tạm ẩn thông báo cùng hạng

- Khi tạm ẩn một item trong hàng đợi cùng hạng, runtime xác định lại index và
  đưa item kế tiếp lên ngay. Focus còn ở nút đóng vẫn pause animation nhưng nội
  dung mới luôn nhìn thấy; không còn trạng thái mất chữ nhưng nền dải còn lại.
- Editor đổi nhãn thành **Thứ tự trong cùng hạng** và giải thích: số lớn chạy
  trước, mọi item thuộc hạng cao nhất vẫn luân phiên từng cái chứ không hiển thị
  đồng thời.
- Regression mới đóng lần lượt hai item cùng hạng và kiểm tra count, nội dung,
  opacity cùng focus-pause trên desktop/tablet/mobile. Verify: 684 frontend
  test, lint/architecture/build/bundle budget và 15/15 smoke runtime pass.

#### Changed — Trải nghiệm soạn thông báo đa cổng

- Thay ô nhập URL CTA nội bộ bằng danh mục có tìm kiếm, nhóm theo bốn portal và
  tự sinh URL đúng cho local hoặc subdomain triển khai. Nơi hiển thị và trang
  CTA độc lập nên thông báo ở cổng Ứng viên có thể dẫn sang Marketing NTD.
- Gắn nhãn **Công khai** hoặc **Cần đăng nhập** cho trang CTA; cảnh báo trực
  tiếp khi thông báo dành cho guest nhưng CTA đi vào workspace được bảo vệ.
- Thay textarea route include/exclude bằng multi-select có tìm kiếm, lọc theo
  surface và vẫn cho nhập prefix nâng cao với validation tương thích backend.
- Catalog có test contract cho URL/prefix/access. Route mới được đăng ký một
  lần để xuất hiện ở mọi editor sau lần triển khai; revision đã publish không
  bị tự viết lại URL.
- Verify: 683 frontend test pass; lint/architecture/build và bundle budget
  293,6/320 KiB JS, 34,2/35 KiB CSS pass; smoke quản trị thông báo 6/6 trên
  desktop/tablet/mobile.

#### Fixed — Preview bản nháp thông báo

- Bước Xem trước nay đọc toàn bộ form store, không còn nhận object rỗng và hiện
  placeholder sau khi quản trị viên đã soạn nội dung ở bước đầu.
- Route selector chuyển tiếp đầy đủ `value`, `onChange` và `id` của Ant Form,
  tránh trạng thái nhìn như đã chọn nhưng payload không lưu prefix.

#### Added — Announcement AN-P5 rollout hardening

- Thêm kill switch runtime fail-closed theo từng surface bằng
  `ANNOUNCEMENT_REMOTE_ENABLED_SURFACES`. Feed bị tắt trả
  `remote_enabled=false`, danh sách rỗng và không query dữ liệu; label xác thực,
  bảo mật và tuân thủ do hệ thống sở hữu vẫn tiếp tục hiển thị.
- Thêm telemetry PII-free cho latency/feed/contract/render error, throttle cho
  runtime event và error boundary trả banner legacy khi strip gặp lỗi. Client
  chỉ nhận contract remote khi backend xác nhận `remote_enabled=true`.
- Thêm command read-only `announcement_rollout_preflight`, kiểm tra integrity,
  critical end time, live/scheduled surface và nhóm rotation xung đột trước khi
  mở rollout.
- Bổ sung runbook staging theo thứ tự Admin → NTD marketing → workspace NTD →
  ứng viên, ngưỡng monitoring, failure injection, kill-switch rehearsal và
  rollback không reverse schema hay xóa dữ liệu.
- Quality gate code cuối: 615 backend test (86,12% coverage), 666 frontend test,
  architecture/import contract sạch, OpenAPI validate, bundle 293,6 KiB JS /
  34,2 KiB CSS gzip và 153 smoke E2E trên desktop/tablet/mobile. Rollout staging
  thực tế vẫn cần evidence vận hành theo runbook trước khi chốt AN-P5 hoàn tất.

#### Fixed — Announcement analytics khi Redis gián đoạn

- Failure injection trên staging cô lập phát hiện rate-limit truy cập Redis
  trước service analytics và trả HTTP 500, dù tracking được thiết kế
  best-effort.
- Hai endpoint telemetry announcement nay fail-open riêng ở lớp throttle khi
  cache lỗi, phát metric PII-free `announcement_throttle`; giới hạn vẫn hoạt
  động bình thường khi cache khỏe và analytics dedupe vẫn không tăng aggregate
  khi Redis lỗi.
- Chạy lại với Redis dừng đạt HTTP 202, sau đó Redis được khôi phục healthy và
  active feed tiếp tục trả 200. Bằng chứng bốn surface, priority và kill switch
  nằm tại
  rehearsal staging 2026-07-29 (đã gộp vào [vận hành và kill switch](docs/06-deployment/van-hanh-va-kill-switch.md)).
- Full gate sau bản vá đạt 617 backend test với coverage 86,13%, 666 frontend
  test, bundle budget và 153 smoke E2E desktop/tablet/mobile.

#### Fixed — Đặt mật khẩu lần đầu cho tài khoản mạng xã hội

- Thay cảnh báo “Cần đăng nhập lại để tạo mật khẩu” (chỉ hiện sau khi người dùng
  điền xong form rồi bấm lưu, và xoá phiên để đá về `/login`) bằng luồng xác
  thực lại tại chỗ: banner hiện ngay khi mở trang, nút “Xác thực với
  &lt;Provider&gt;” mở OAuth với `next` là trang hiện tại nên người dùng quay về
  đúng chỗ đang làm, không mất phiên.
- Thêm `GET /api/auth/password/` trả `{has_usable_password, requires_reauth,
  reauth_provider, reauth_max_age_seconds}` để client biết trước điều kiện của
  phiên. `POST` trả kèm `reauth_provider` trong lỗi 403 `reauth_required`.
- Nút “Tạo mật khẩu” bị vô hiệu hoá khi phiên chưa đủ điều kiện; tài khoản không
  liên kết provider nào được hướng sang luồng “Quên mật khẩu” thay vì kẹt.
- Giữ nguyên cửa sổ bảo mật `AUTH_REAUTH_MAX_AGE_SECONDS` (mặc định 5 phút) —
  đây là bằng chứng duy nhất thay cho mật khẩu hiện tại, không nới lỏng.

#### Fixed — Hàng chờ và chi tiết xác thực nhà tuyển dụng

- Đồng nhất badge “Chờ xác thực NTD” với bộ lọc mặc định “Cần xử lý”: hàng chờ
  nay gồm hồ sơ `pending`, `in_review` và hồ sơ có giấy tờ hiện hành chờ duyệt,
  nên không còn badge có số nhưng bảng rỗng.
- Sửa cảnh báo Ant Design `columns.render return cell props is deprecated` ở
  bảng tài khoản. Formatter ngày nay chỉ nhận giá trị ô, không nhận nhầm cả
  record làm fallback khi ngày trống.
- Thu gọn hành trình 9 bước theo mặc định, cho phép mở chi tiết khi cần; nhóm
  bộ giấy tờ theo quyền đại diện, pháp lý doanh nghiệp và bảo vệ dữ liệu.
- Làm rõ đối chiếu mã số thuế là bằng chứng bổ trợ về pháp nhân công ty trong
  hồ sơ xác thực quyền đại diện, không phải dấu hiệu NTD đã tạo hoặc chỉnh sửa
  công ty; yêu cầu cập nhật công ty tiếp tục là workflow độc lập.

### 2026-07-27

#### Changed — Quyền truy cập nhà tuyển dụng

- Bỏ yêu cầu MFA khi nhà tuyển dụng truy cập dữ liệu ứng viên, tạo hồ sơ công
  ty hoặc quản lý ảnh công ty. Các endpoint vẫn yêu cầu phiên employer hợp lệ
  và giữ nguyên ràng buộc phạm vi tin tuyển dụng, công ty và vai trò owner.
- Khôi phục hành trình xác thực employer về năm bước chính; “Đăng tin tuyển
  dụng đầu tiên” tiếp tục là bước thứ sáu tách riêng, không đưa các trạng thái
  email, onboarding hoặc chờ admin duyệt thành bước bổ sung.
- Sửa liên kết mở văn bản DLCN riêng tư: nội dung được tải qua API client đã
  xác thực rồi mở bằng blob URL, tránh tab mới gọi trực tiếp backend và nhận
  lỗi `401 Unauthorized`.

### 2026-07-26

#### Added — Account Management G3

- Thêm migration `accounts.0016`, seed bảy permission `account.*`,
  `AdminProvisioningScope` và `AdminInvitation`; mỗi lời mời dùng token ký có
  version, hết hạn 72 giờ và chỉ chấp nhận một lần.
- Thêm migration `accounts.0017` cho index phiên theo user/portal/IP/trạng thái
  thu hồi, phục vụ danh sách thiết bị và impact thu hồi phiên.
- Mở API quản lý Candidate/Employer/Admin, phiên, hoạt động, impact đổi trạng
  thái/thu hồi phiên, lời mời Admin và whitelist cấp tài khoản. Các thao tác
  ghi dùng transaction, row locking, audit và impact token; thu hồi scope đồng
  thời thu hồi mọi lời mời pending liên quan.
- Thêm `/admin/app/accounts` với năm tab, bộ lọc nâng cao, action icon/tooltip,
  drawer xem nhanh, trang chi tiết hồ sơ–bảo mật–audit và luồng nhận lời mời có
  MFA email cùng mã dự phòng chỉ hiển thị một lần.
- Trang Phân quyền có tab “Cấp tài khoản” dành riêng cho superuser, hiển thị
  whitelist nguồn–đích, số lời mời pending và impact preview trước khi thu hồi.
- Thêm command local idempotent `seed_admin_account_demo` tạo superuser, nhân
  sự được ủy quyền và Admin kiểm duyệt kèm mã dự phòng demo.

#### Security — Account Management G3

- Admin được ủy quyền phải đồng thời có một membership hiệu lực, permission
  `account.admin.invite` và scope nguồn–đích active; backend chặn request giả
  mạo role ngoài whitelist và mọi role chứa quyền quản trị nhạy cảm.
- Người mời thường chỉ thấy và quản lý lời mời của chính mình. Sau kích hoạt,
  mọi thay đổi trạng thái, chức danh hoặc bảo mật của Admin vẫn superuser-only.
- Accept đồng thời được serialize bằng row lock; chỉ một transaction tạo đúng
  một membership. Audit không ghi token, mật khẩu, MFA secret hay mã dự phòng.
- Sửa reset mật khẩu Admin: email dùng đúng nhãn “Quản trị” và link cổng
  `/admin/app/reset-password?portal=admin`; backend ràng buộc token với cổng
  Admin, kiểm tra trạng thái ở lúc gửi/lúc dùng, và từ chối reset cho tài khoản
  `inactive` hoặc `banned`.

#### Changed — Gán chức danh nhân viên

- Migration `accounts.0015` hợp nhất dữ liệu lịch sử về một membership active
  cho mỗi nhân viên và thêm ràng buộc database tương ứng. Gán chức danh mới nay
  là thao tác thay thế nguyên tử: thu hồi chức danh cũ, audit trước/sau và bust
  cache quyền sau commit.
- Bỏ endpoint, payload và UI “phòng ban chính”. Preview đổi chức danh hiển thị
  rõ chức danh hiện tại cùng quyền được thêm/mất; trang Nhân viên chỉ còn một
  dòng chức danh hiệu lực cho mỗi người.
- Thêm regression cho thay thế membership và hai xác nhận đồng thời: chỉ một
  transaction được commit, yêu cầu còn lại nhận stale impact token.
- Bổ sung bộ lọc nhanh theo nội dung/trạng thái/MFA, action icon có tooltip và
  drawer xem chi tiết nhân viên; bảng phòng ban/chức danh hiển thị thêm mã và
  số liệu vận hành nhưng không lặp thao tác chỉnh sửa trong menu.

#### Changed — Bảo mật tài khoản quản trị

- Admin có thể bật hoặc tắt Email MFA, ứng dụng xác thực và mã dự phòng như
  các tài khoản khác. Mọi thao tác tắt vẫn bắt buộc step-up bằng phương thức
  MFA đang có và được ghi audit không chứa mã xác minh hay secret.

#### Added — Quản trị phân quyền (RBAC G2)

- Thêm migration `accounts.0014`, cờ `is_system_managed` cho department/role,
  ma trận seed code-owned và command tạo admin thường không bypass RBAC.
- Mở API `/api/admin/` cho phòng ban, chức danh, permission runtime, membership
  và staff; có impact preview, restore mặc định, audit/cache và primary
  deterministic.
- Thêm trang `/admin/app/access-control` ba tab, PermissionPicker giữ grant
  deprecated, badge MFA, trạng thái loading/empty/error và impact modal cho mọi
  thao tác nguy hiểm.

#### Security — RBAC admin G2

- Mọi ghi, mọi impact preview và dữ liệu nhân sự là superuser-only; admin
  `admin_access.view` chỉ được đọc cấu trúc tổ chức.
- Impact token ký ràng buộc revision/operation/resource/payload, hết hạn 10
  phút; xác nhận khoá row phụ thuộc và trả `409 admin_resource_changed` khi
  preview stale.
- Chặn gán người vào role không có permission active và chặn xoá sạch quyền của
  role còn membership hoạt động; code trùng được map ổn định về 400.
- Quality gate cuối: 417 backend test (85,54% coverage), 416 frontend test,
  architecture/import contract sạch, build trong bundle budget và 81 smoke E2E.

#### Added — RBAC admin G1.1

- Thêm registry permission code-owned, phòng ban, chức danh, membership có lịch
  sử thu hồi, primary deterministic, cache 60 giây và audit log luôn bật.
- Thêm command đồng bộ/deprecate permission, seed hội tụ ma trận phòng ban,
  export contract frontend, bootstrap MFA và readiness gate trước khi siết API.
- `/api/auth/me/` trả `admin_access`; cổng admin có trang “Quyền của tôi”, badge
  phòng ban, sidebar/route/login destination dùng chung một access policy.

#### Security — RBAC admin G1.2

- Siết site settings ở mức superuser; áp permission chi tiết cho catalogue dịch
  vụ, lead tư vấn, catalogue CV và kiểm duyệt tin.
- Chặn nhân viên CV đi vòng qua `PATCH is_active/status`; dữ liệu do staff tạo
  mặc định ẩn/draft, gồm cả upload background đi qua service riêng.
- Chuẩn hoá mọi lỗi thiếu quyền thành `403 admin_permission_denied`; frontend
  revalidate session có cooldown khi nhận chùm 403.

#### Changed — Tài liệu và kiểm chứng

- Bổ sung thiết kế database RBAC, ma trận seed, runbook hai release, cảnh báo
  endpoint dashboard/blog còn legacy và gate chống lệch registry backend/frontend.

### 2026-07-24

#### Added — Cá nhân hóa tài khoản ứng viên

- Mở ba trang thật trong cụm `/tai-khoan`: cài đặt thông báo qua email, đổi mật khẩu và danh sách việc làm phù hợp; route tiếp tục được bảo vệ theo thứ tự `AuthGuard → RoleGuard(candidate)`.
- Thêm 12 lựa chọn email theo ba nhóm hệ thống/cơ hội việc làm/giới thiệu dịch vụ. Các lựa chọn mặc định bật và tự lưu từng thay đổi qua `GET/PATCH /api/candidate/email-notification-settings/`; email xác thực, đặt lại mật khẩu và 2FA là email giao dịch ngoài preference này.
- Thêm feed `GET /api/jobs/recommendations/for-me/` có phân trang, lý do/điểm khớp, nguồn CV đang dùng và trạng thái thiết lập/consent. Preference là nguồn chính, CV mặc định hoặc CV gần nhất bổ sung vị trí/headline/kỹ năng; không tuyên bố dùng lịch sử tìm kiếm vì backend chưa lưu tín hiệu đó.

#### Changed — Menu, consent và bảo mật ứng viên

- Dropdown tài khoản desktop chuyển sang mở bằng click, single-open accordion, tự mở nhóm chứa route hiện tại và cuộn nội bộ theo viewport; header tài khoản cùng nút đăng xuất luôn nhìn thấy. Bỏ badge thông báo giả.
- Form nhu cầu việc làm luôn cho phép bật hoặc rút consent gợi ý; nội dung giải thích đúng nguồn dữ liệu thực tế và nhãn quyền hiển thị hồ sơ cho nhà tuyển dụng không còn bị diễn đạt thành email/sự kiện. Endpoint gợi ý theo CV cũng dừng đọc nội dung CV khi chưa có consent; cập nhật hoặc rút consent xóa cache feed để không lóe lại kết quả cũ.
- Form đổi mật khẩu dùng chung candidate/employer nhưng không còn hardcode điều hướng employer; candidate thấy email đăng nhập read-only, rule mật khẩu khớp backend và tiếp tục hỗ trợ xoay token/đăng xuất thiết bị khác.
- Trang cài đặt email rút về ba nhóm phẳng theo TopCV, bỏ card/icon/mô tả lặp và không hiển thị email giao dịch bảo mật như một switch riêng.

#### Changed — Việc làm đã lưu và gợi ý tương tự

- Nâng cấp `/viec-lam-da-luu` với empty/error/retry rõ ràng, thời điểm lưu, CTA tạo CV đúng đích và feed việc làm vẫn hữu ích khi ứng viên chưa lưu tin nào.
- Thay phép chọn một category phổ biến ở frontend bằng
  `GET /api/jobs/recommendations/by-saved/`: xếp hạng pairwise tối đa 20 tin lưu
  gần nhất theo chuyên môn, tiêu đề, kỹ năng, địa điểm và hình thức làm việc;
  loại tin đã lưu, đã ứng tuyển hoặc không còn public.
- Khi chưa có tín hiệu, trả tin active mới nhất và hiển thị trung thực là “Việc
  làm bạn có thể quan tâm”; lưu/bỏ lưu thành công tự làm mới feed. Route
  standalone được bảo vệ bằng `AuthGuard → RoleGuard(candidate)`.
- Siết public availability khi lưu tin và semantic anchor khi xếp hạng: không
  thể lưu tin nháp/đóng bằng public ID; kỹ năng nhiễu hoặc từ chức danh chung
  không đủ để biến một công việc khác chuyên môn thành “tương tự”.

#### Changed — Tài liệu và kiểm chứng

- Bổ sung tài liệu thuật toán recommendation, schema email preference, contract API/frontend, ownership map FSD, tiến độ và OpenAPI.
- Ghi lại khảo sát TopCV ở trạng thái 0 và 3 tin đã lưu, tài liệu hóa trọng số,
  fallback, privacy và contract của feed gợi ý theo lịch sử lưu.
- Thêm regression backend cho preference email, permission/consent, fallback không CV và feed candidate; thêm unit frontend cho menu, email auto-save, đổi mật khẩu, API và các trạng thái trang việc làm phù hợp.
- Sau review, bổ sung regression cho prefilter không dấu/kỹ năng JSON, salary mở, CV archived/failed, job đã ứng tuyển, số query phẳng, consent trên trang lưu CV, cache khi rút quyền, lỗi tải preference, re-auth OAuth và accessibility keyboard/link.
- Ổn định regression báo cáo chiến dịch ở ranh giới ngày UTC bằng cách tạo daily counter theo cùng múi giờ báo cáo `Asia/Ho_Chi_Minh`; quality gate đã đạt backend coverage 85,50%, 374 frontend test và 81 smoke E2E; regression cuối cho saved-job đạt 15 test.

### 2026-07-20

#### Added — Quản lý hồ sơ công ty đầy đủ

- Nâng cấp `/tuyendung/app/account/settings/company` thành ba trạng thái hoàn chỉnh: catalogue công ty dùng chung có recent/search/phân trang; form tạo Doanh nghiệp/Hộ kinh doanh; và hồ sơ đã liên kết theo quyền owner/member/pending.
- Form mới có option card theo luồng, logo/website/tên thương mại với checkbox phụ thuộc, catalogue lĩnh vực/quy mô/thị trường/khách hàng, TipTap rich text 10.000 ký tự, gallery nhiều ảnh và hồ sơ chứng minh cho thay đổi pháp lý.
- Bổ sung `GET /api/employer/company/catalogs/`; chuẩn hóa `company/search` trả sáu công ty mỗi trang, mới nhất trước khi không có từ khóa và tìm không dấu theo tên/tên thương mại/MST khi có từ khóa.
- Thêm migration `employers.0014` seed idempotent catalogue lĩnh vực đầy đủ; media công ty chỉ nhận JPG/PNG/WebP tối đa 5 MB, gallery tối đa 10 ảnh và dọn file khi thao tác DB lỗi.

#### Security — Nội dung công ty và cập nhật pháp lý

- Mô tả/phúc lợi được lưu dưới HTML allowlist (`p`, `br`, `strong`, `em`, `u`, `ul`, `ol`, `li`), bỏ thuộc tính/script/style nguy hiểm và giới hạn theo 10.000 ký tự nhìn thấy; API chi tiết việc làm tiếp tục trả mô tả công ty dạng plain text.
- Owner gửi thay đổi qua `CompanyUpdateRequest`; đổi tên/MST bắt buộc lý do, loại hồ sơ và tài liệu gắn đúng request trước khi admin có thể duyệt. Member chỉ xem, request pending thứ hai tiếp tục bị chặn.

#### Changed — Kiểm chứng trang thông tin công ty

- Thêm regression backend cho catalogue, validation, rich-text XSS, gallery và update-request proof; unit frontend cho mapping/diff/media cùng option cards/recent list.
- Thêm Playwright smoke riêng chạy xanh desktop, tablet `834×1112` và Pixel mobile, kiểm tra không tràn ngang và nhãn động Hộ kinh doanh.

#### Changed — Quy tắc liên kết công ty

- Bỏ điều kiện phải xác thực số điện thoại trước khi tạo công ty mới hoặc gửi hồ sơ liên kết công ty có sẵn; xác thực điện thoại tiếp tục là một bước bảo mật độc lập.
- Sau lần tạo hoặc chọn công ty đầu tiên, tài khoản không thể chuyển sang công ty khác. Backend khóa recruiter trong giao dịch để chặn cả request đồng thời; frontend chỉ hiển thị hồ sơ đã liên kết và thông báo đây là liên kết cố định.

#### Changed — Catalogue công ty gọn hơn

- Luồng tìm công ty chuyển về bố cục tab ngang, ô tìm kiếm chiếm toàn bộ hàng, kèm nhãn **Lưu ý!** về tên công ty theo dữ liệu Cục Thuế.
- Card catalogue rút gọn thành logo, tên, MST, một dòng `địa chỉ | quy mô nhân viên`, lĩnh vực và nút **Chọn** nhỏ; lĩnh vực bị giới hạn một dòng có ellipsis, hover để xem đầy đủ; mobile tự xếp lại mà không tràn ngang.
- Khu chọn logo trong form tạo công ty được rút về cụm căn giữa không khung: avatar/logo tròn có affordance camera, nhãn bắt buộc và checkbox “Tôi không có logo”.
- Bỏ trường Năm thành lập khỏi form; các phần thông tin còn lại dùng đường phân cách nhẹ thay vì nhiều card, giúp input liền mạch và gọn hơn.
- Tiếp tục nén form theo spacing TopCV: bỏ heading nhóm thị giác, giảm khoảng cách alert/label/form item và chiều cao editor, giữ nguyên nhãn và validation của từng trường.
- Chứng minh Tên thương mại giờ chỉ hiện CTA **+ Thêm giấy tờ chứng minh Tên thương mại**. CTA mở popup chọn **Giấy tờ** (JPEG/JPG/PNG/PDF, tối đa 5 MB) hoặc **Website**; sau khi lưu hiện link mở tab mới và nút **Chỉnh sửa**.
- Dropdown **Lĩnh vực chính** bị khóa cho đến khi người dùng chọn ít nhất một **Lĩnh vực hoạt động**, tránh chọn dữ liệu không hợp lệ.
- Khi chọn “Tên thương mại trùng với tên đăng ký kinh doanh”, hệ thống ẩn thao tác thêm/chỉnh sửa giấy tờ chứng minh tên thương mại vì không còn cần thiết.
- Chọn một công ty từ catalogue giờ liên kết ngay, không mở modal và không bắt người dùng tải hồ sơ ở bước này; trạng thái liên kết vẫn chờ quản trị viên duyệt.
- Làm lại trạng thái công ty đã liên kết theo hierarchy TopCV: khối “Yêu cầu cập nhật thông tin công ty” có thời điểm gần nhất/CTA tạo yêu cầu, tiếp theo là hồ sơ đọc dạng nhãn–giá trị; form yêu cầu có tiêu đề và mô tả ngữ cảnh rõ ràng.
- Liên kết công ty có hiệu lực ngay sau khi chọn; bỏ hoàn toàn trạng thái/alert chờ duyệt liên kết.
- Mọi employer đã liên kết công ty, gồm cả member, đều thấy và tạo được **Yêu cầu cập nhật**; yêu cầu vẫn ở trạng thái chờ quản trị viên duyệt trước khi áp dụng.
- Tương thích liên kết cũ còn trạng thái `pending`: chỉ cần tài khoản đã có công ty là luôn hiển thị **Tạo yêu cầu**.

#### Changed — Dashboard nhà tuyển dụng: khối "Xin chào" theo UX TopCV

- Dựng lại section hành trình xác thực (`DashboardVerificationJourney`) theo mẫu TopCV: mỗi bước là thẻ pill bo góc riêng biệt cuộn ngang, bước đang làm có viền + chữ + nút mũi tên xanh, bước đã xong hiển thị check tròn và chữ mờ.
- Thêm hai nút chevron trái/phải ở header để cuộn qua các bước; ghim sticky thẻ "Đăng tin tuyển dụng đầu tiên" ở ngoài cùng bên phải, tách khỏi vùng cuộn.
- Màu chủ đạo dùng biến thương hiệu (`--brand-primary`, `--brand-primary-soft`, `brand_primary_color`) từ site settings thay cho hardcode, đồng bộ khi đổi màu brand.

#### Fixed — Gộp danh sách domain email miễn phí về một nguồn

- Bỏ `PUBLIC_EMAIL_DOMAINS` chép tay ở frontend (`account-verification-level.js`); cấp độ xác minh email doanh nghiệp giờ tin hoàn toàn vào cờ `email_domain_verified` do backend trả, tránh lệch danh sách khi thêm domain mới.

#### Fixed — CI frontend

- Sửa regression coverage của trang cài đặt bảo mật: test thao tác phương thức 2FA giờ bám vào `data-testid` ổn định thay vì class layout, nên không hỏng khi UI chuyển từ flex sang grid.
- Bỏ import icon không dùng làm `static-quality` dừng lint; giữ kiểm tra ranh giới API/feature và kiến trúc sạch.
- Điều chỉnh ngân sách CSS initial gzip từ 30 KiB lên 35 KiB, phản ánh stylesheet responsive của shell settings hiện ở 31,5 KiB mà vẫn giữ giới hạn rõ ràng; JavaScript initial vẫn ở 279/320 KiB.
- Khôi phục đầy đủ chuỗi kiểm tra: coverage 76 file/270 test, production build, bundle budget và 63 Playwright smoke desktop/tablet/mobile đều chạy xanh.
- Sửa smoke xác thực employer: tài khoản đã hoàn tất năm điều kiện vẫn được redirect khỏi checklist, đồng thời test xác nhận CTA **Đăng tin tuyển dụng đầu tiên** còn hiển thị như hành động ghim độc lập, không bị tính là bước xác thực.

### 2026-07-19

#### Changed — Xác thực giấy tờ nhà tuyển dụng

- Hoàn thiện UX trang `/tuyendung/app/account/settings/gpkd`: hai phương thức giấy ĐKDN hoặc giấy ủy quyền + CCCD/hộ chiếu luôn giữ thứ tự dọc; mỗi phương thức chỉ mở các ô hồ sơ tương ứng, có khoảng cách thao tác rõ ràng trên desktop và mobile.
- Thay minh họa code-native bằng ba ảnh mẫu đã tối ưu trong `frontend/public/images/employer/`; cập nhật link tải mẫu giấy ủy quyền và link hướng dẫn đăng tải.
- Trong giai đoạn hiện tại, người dùng vẫn xem/chọn file cục bộ nhưng nút Lưu được khóa; không gửi tài liệu lên API trước khi workflow cập nhật thông tin công ty và lưu giấy tờ được bật.

#### Added — Văn bản xử lý Dữ liệu cá nhân

- Hoàn thiện `/tuyendung/app/account/settings/personal-data-protection` theo hai khối độc lập: thỏa thuận Ứng viên–Nhà tuyển dụng có hướng dẫn, tải mẫu DOCX local, tải lên/lưu; và thỏa thuận nền tảng–Nhà tuyển dụng có link văn bản đầy đủ cùng xác nhận inline.
- Đưa mẫu DOCX người dùng cung cấp vào `frontend/public/documents/` để nhà tuyển dụng tải về và chỉnh sửa. Giao diện chỉ nhận một tệp DOC/DOCX/PDF tối đa 5 MB; chọn tệp mới sẽ thay thế tệp đang chờ lưu.
- Thêm migration `employers.0012`: văn bản DLCN được gắn với recruiter thay vì bắt buộc công ty, có thể lưu/thay thế khi chưa cập nhật thông tin công ty; dữ liệu DLCN cũ theo company vẫn được đọc để giữ nguyên tiến độ xác thực.

#### Added — Quản lý nhu cầu tuyển dụng

- Mở route `/tuyendung/app/account/settings/recruitment-demand`: hiển thị toàn bộ nhu cầu đã khai báo lúc onboarding và cho phép thêm, sửa, xóa, bật/tắt từng nhu cầu. Nguồn ngân sách là thiết lập dùng chung Công ty/Cá nhân, được lưu cho các nhu cầu hiện có và tự áp dụng khi tạo nhu cầu mới.
- Migration `employers.0013` chuyển nhu cầu từ một bản ghi onboarding cố định sang nhiều nhu cầu theo recruiter, giữ dữ liệu cũ và trạng thái hoạt động mặc định; thêm API CRUD `/api/employer/recruitment-needs/`.
- Tinh chỉnh UX theo mẫu TopCV: form thêm/sửa có hierarchy rõ ràng, danh sách responsive không cuộn ngang và thiết lập nguồn ngân sách mở popover radio với nút Lưu/Hủy.

#### Changed — Responsive toàn bộ cổng nhà tuyển dụng

- Chuẩn hóa shell employer cho mobile/tablet: sidebar workspace mở dạng drawer phủ có mask, tiêu đề route không tràn, content không phát sinh cuộn ngang và menu cài đặt chuyển thành dropdown trên màn hình nhỏ.
- Responsive lại dashboard, xác minh tài khoản, hồ sơ/công ty, GPKD, DLCN, bảo mật, đổi mật khẩu và nhu cầu tuyển dụng; grid tự xếp cột, text dài ngắt an toàn, modal/popover giới hạn theo viewport và nút form chiếm đủ chiều rộng trên mobile.
- Tinh chỉnh typography, CTA và card của toàn bộ trang marketing employer; thêm Playwright project tablet `834x1112` cùng regression chống tràn ngang cho desktop, tablet và Pixel mobile.
- Ghi responsive mobile-first thành baseline bắt buộc trong `frontend/ARCHITECTURE.md` cho mọi giao diện employer phát triển sau này.

#### Changed — Trang đăng ký nhà tuyển dụng

- Bỏ thanh **Các bước tạo tài khoản** ở đầu trang đăng ký; luồng hai phần vẫn tiếp tục bằng CTA phía cuối form và giữ nút Quay lại ở phần thông tin nhà tuyển dụng.
- Thêm khối **Quy định đăng ký tài khoản** theo UX tham khảo TopCV: mặc định mở, cho phép hiện/ẩn bằng nút có trạng thái truy cập `aria-expanded`, dùng tên website và hotline từ site settings.
- Làm phẳng phần giới thiệu và hai phần form, bỏ card viền/đổ bóng bao quanh để giảm lớp thị giác; bổ sung regression Playwright cho trạng thái Quy định và chống tràn ngang trên desktop, tablet, mobile.
- Form mật khẩu employer hiển thị mức độ yếu/trung bình/mạnh, thanh tiến trình và bốn điều kiện cập nhật theo từng ký tự; chỉ cho tiếp tục khi có đủ độ dài, hoa/thường, chữ số và ký tự đặc biệt.
- Hướng dẫn xác minh mật khẩu chỉ hiển thị khi ô Mật khẩu đang được focus và tự đóng khi người dùng rời ô, tránh che hoặc kéo dài form không cần thiết.
- Thêm lưu ý ngay dưới email đăng ký: email không thuộc tên miền công ty có thể bị giới hạn quyền mua hoặc sử dụng một số dịch vụ.

#### Fixed — Hoàn tất xác thực employer

- Đồng bộ checklist, progress dashboard và redirect `/employer-verify` theo đúng năm điều kiện xác thực; mục **Đăng tin tuyển dụng đầu tiên** là hành động sản phẩm, không còn được tính vào tiến độ hay giữ tài khoản đã xác thực ở checklist.
- Thiết kế lại hành trình xác thực trên dashboard theo hierarchy TopCV: phần trăm/lời chào rõ ràng, năm bước có trạng thái; bố cục tự chuyển thành danh sách dễ quét trên mobile.
- Căn chỉnh lại journey sát mẫu dashboard TopCV: năm bước nằm trong dải cuộn riêng, tiêu đề mỗi bước mở đúng màn hình tác vụ ở tab mới; mục **Đăng tin tuyển dụng đầu tiên** được ghim ngoài cùng bên phải ở trạng thái khóa và không còn hiển thị điểm thưởng.
- Tải và self-host SVG `v-brand` tham khảo từ TopCV; dùng làm nền trang trí cho khối hành trình xác thực, không phụ thuộc CDN ngoài khi hiển thị.
- Đồng bộ vị trí ảnh nền `v-brand` theo CSS mẫu TopCV (`top: -250px; bottom: 0; right: 5%`) để họa tiết neo đúng cạnh phải của journey.

#### Fixed — Màu liên kết DLCN

- Ép màu emerald cho các liên kết/hành động trên trang DLCN (hướng dẫn, tải mẫu, xem nội dung đầy đủ, thỏa thuận và tài liệu đã tải) để không bị màu xanh mặc định của Ant Design ghi đè.
- Đặt checkbox xác nhận thỏa thuận nền tảng ở một dòng/khối riêng dưới liên kết xem văn bản, giữ khoảng cách và căn chỉnh ổn định khi nội dung dài.

#### Fixed — Toast workspace nhà tuyển dụng

- Thay toàn bộ lớp `message` Ant Design bằng Sonner: toast được render độc lập ở cấp `document.body`, không thể bị header hay vùng cuộn của workspace cắt mất nội dung. Các trạng thái thành công, lỗi, cảnh báo, thông tin và đang tải có biểu tượng/màu riêng; người dùng có thể đóng từng toast.

#### Changed — Nộp giấy tờ nhà tuyển dụng

- Bỏ yêu cầu MFA và xác thực lại phiên đối với thao tác nộp/thay thế giấy tờ doanh nghiệp, giấy tờ liên kết công ty và văn bản DLCN. Endpoint vẫn yêu cầu phiên nhà tuyển dụng hợp lệ để gắn đúng chủ sở hữu; mọi tài liệu nộp mới tiếp tục chờ admin duyệt.
- Sau khi lưu văn bản DLCN, hiển thị toast xác nhận tiếp nhận theo tên hệ thống, nhãn “Hệ thống đang xử lý” và chỉ cho mở form thay tệp qua nút Chỉnh sửa/Hủy. Tài liệu DOC/DOCX đã nộp mở bằng Google Docs Viewer; thời điểm chấp nhận thỏa thuận nền tảng hiển thị đến giây theo giờ Việt Nam.
- Khi văn bản DLCN đang được xử lý, vẫn giữ khối **Văn bản mẫu** và nút tải xuống cạnh tệp đã nộp; bỏ nhãn trạng thái trùng lặp ở dòng tệp để chỉ dùng nhãn trạng thái tại tiêu đề.
- Khi chọn **Chỉnh sửa**, giữ liên kết xem tệp đã nộp và hiển thị tên tệp thay thế ngay trong ô tải lên. Sau khi lưu, tên hiển thị chuẩn của tài liệu là **Thỏa thuận xử lý DLCN**, không dùng tên gốc của tệp tải lên.
- API ưu tiên văn bản DLCN mới gắn recruiter trước bản DLCN lịch sử theo company, tránh mở nhầm PDF cũ khi hai bản cùng tồn tại. DOC/DOCX tại URL HTTPS storage công khai/S3 có chữ ký mở qua Google Docs Viewer; PDF và URL localhost mở trực tiếp. Hover liên kết tệp dùng màu thương hiệu cấu hình của hệ thống.

#### Changed — Tài liệu

- Cập nhật hướng dẫn xác thực employer, tiến độ EMP-P8/EMP-P9 và regression test desktop/mobile cho layout/asset GPKD cùng DLCN; chuẩn hóa thông báo toàn ứng dụng qua Sonner.

### 2026-07-18

#### Added — Cổng marketing nhà tuyển dụng

- Thêm app backend `services` với danh mục/gói dịch vụ song ngữ, lead tư vấn, public API bảng giá, admin CRUD API, cache + signal invalidation, throttle form và seed 5 nhóm/11 gói idempotent.
- Hoàn thiện 5 route marketing `/tuyendung`: Landing đủ chuỗi section AI/dịch vụ/số liệu/form/giá trị/đối tác/liên hệ; Giới thiệu, Dịch vụ, Báo giá động và Liên hệ; header/footer riêng, drawer mobile, language switcher VI/EN và CTA tư vấn nổi.
- Thêm `entities/service-package`, `entities/consultation-lead`, feature gửi tư vấn, widget footer nhà tuyển dụng; bảng giá fallback ngôn ngữ, loading/error/empty state và CTA prefill theo gói.
- Thêm hai màn admin `/admin/app/services` và `/admin/app/consultation-leads` để quản lý danh mục/gói và xử lý lead.

#### Added — Xác thực tài khoản nhà tuyển dụng

- Thêm API đăng ký employer riêng, tạo atomically tài khoản, recruiter profile và consent có phiên bản; trả JWT và gửi email xác thực ngay sau đăng ký. Công ty không còn được tạo ngầm trong bước này.
- Thêm hồ sơ đăng ký recruiter (giới tính, số liên hệ, địa điểm, thời điểm hoàn tất, consent/marketing) bằng migration `employers.0009`; thêm endpoint hoàn thiện profile cho tài khoản Google.
- Thêm giao diện login/register tách biệt cổng ứng viên, màn xác thực email riêng tại `/account/verify`, khảo sát nhu cầu tại `/consulting-need`, trang điều khoản/quyền riêng tư và route recovery riêng cho employer.
- Thêm model/API `RecruitmentNeed` cho vị trí chuyên môn, cấp bậc, thời hạn hoặc tuyển liên tục, số lượng, khoảng/nguồn ngân sách và nhu cầu tư vấn; email employer có mã NTD, CTA xác thực và cảnh báo bảo mật riêng.
- Thêm `/tuyendung/app/employer-verify` theo shell quản trị employer: checklist điện thoại/công ty/giấy ĐKDN/hai bước DLCN/tin đầu tiên và lựa chọn xác thực sau; email không lặp lại vì đã là điều kiện vào trang.
- Thêm nhóm route account nội bộ `/account/phone-verify`, `/account/settings/password-login`, `/account/settings/company?update=true`, `/account/settings/gpkd` và `/account/settings/personal-data-protection`; trang company có hai tab tìm/liên kết công ty có sẵn và tạo công ty mới.
- Thêm API đổi/đặt mật khẩu khi đã đăng nhập. Tài khoản Google chưa có mật khẩu được chặn trước bước OTP bằng modal an toàn và dẫn tới màn đặt mật khẩu đầu tiên.
- Thêm read-model `GET /api/dashboard/employer/` trong `apps.dashboard` cùng dashboard responsive: KPI tuyển dụng, biểu đồ hồ sơ 7 ngày, pipeline, tin/hồ sơ gần đây, nhu cầu ưu tiên, tiến độ xác thực và hồ sơ công ty.
- Thêm email chào mừng riêng cho nhà tuyển dụng: tài khoản email chỉ nhận sau khi xác thực thành công, tài khoản Google mới nhận ngay sau callback; nội dung có tên, mã NTD, CTA quay về state machine cổng tuyển dụng và thông tin CSKH từ site settings.

#### Changed

- Employer đăng ký email giữ session và đi theo state machine `/account/verify → /consulting-need → /dashboard`; employer mới qua Google bổ sung hồ sơ tại `/account/complete-profile` rồi đi thẳng tới khảo sát vì email đã được provider xác thực. State onboarding không còn phụ thuộc company; company chỉ hoàn tất sau thao tác chọn/tạo rõ ràng.
- Link đặt lại mật khẩu trong email được dựng theo role; link employer dùng host/path của cổng tuyển dụng. Dashboard guard bắt buộc email + hồ sơ + consulting, còn company/membership thuộc checklist xác thực có thể hoàn thiện dần.
- Trường nhu cầu tư vấn trong khảo sát tuyển dụng chỉ cho phép chọn một lựa chọn; frontend gửi mảng một phần tử tương thích API và backend từ chối payload nhiều lựa chọn.
- Làm lại giao diện đăng ký nhà tuyển dụng: form hiển thị tuần tự bước 01 rồi mới sang bước 02 (có quay lại), khối tài khoản và hồ sơ tách bạch, email không còn chừa cột trống trên desktop và lựa chọn giới tính không còn viền bao quanh trên mobile.
- Luồng sau khai báo nhu cầu chuyển thành `/consulting-need → /employer-verify → /dashboard`; checklist bảo mật không tạo state onboarding bắt buộc mới. Workspace dùng đúng `100dvh`, chỉ cuộn vùng nội dung; link dịch vụ/bảng giá và workflow chưa triển khai được disabled rõ ràng, không thoát sang landing page.
- Tách trạng thái tài liệu thỏa thuận ứng viên–nhà tuyển dụng (`candidate_dpa`) khỏi trạng thái chấp nhận thỏa thuận nền tảng–nhà tuyển dụng; tin tuyển dụng đầu tiên bị khóa đến khi đủ năm điều kiện trước.
- Thiết kế lại toàn bộ shell quản trị employer theo mẫu dashboard nghiệp vụ: dải cảnh báo tuân thủ theo trạng thái DLCN, topbar tối toàn chiều ngang, sidebar trắng có hồ sơ/mã NTD/tiến độ xác thực và menu phân nhóm, header tên trang cùng content cuộn nội bộ. Dashboard mới có thông báo quan trọng, banner code-native, hành trình xác thực ngang, khu khám phá và CV đề xuất; KPI/read-model thật vẫn được giữ bên dưới. Mọi tính năng chưa có workflow đều disabled “Sắp mở”.

#### Security

- Consent bắt buộc và marketing consent được lưu tách biệt kèm thời điểm/phiên bản; backend kiểm tra captcha, password policy, email không phân biệt hoa/thường, số điện thoại duy nhất và transaction rollback.
- Transactional outbox giới hạn đúng một welcome job trên mỗi tài khoản bằng cả thao tác idempotent và partial unique constraint; callback Google lặp lại, đăng nhập social cũ hoặc token xác thực dùng lại không gửi trùng thư chào mừng.

#### Fixed

- Sửa destination sau đăng nhập nhà tuyển dụng: tài khoản còn thiếu bước bảo mật/pháp lý vào `/tuyendung/app/employer-verify` và không bị `returnUrl=/dashboard` bỏ qua; tài khoản đã xác thực đủ năm điều kiện hiện hành vào thẳng bảng tin hoặc deep-link an toàn. CTA email chào mừng vẫn dùng điểm vào checklist cho tài khoản mới.
- Sidebar workspace nhà tuyển dụng dùng thang “Tài khoản xác thực: Cấp 0/3–3/3” theo điện thoại, thông tin công ty và ĐKDN; dấu `?` mở popover có tiến độ, ba action tương ứng và CTA tìm hiểu thêm, thay vì hiển thị 6 bước checklist.
- Sidebar desktop nay thu gọn theo đúng mô hình icon rail của TopCV (216px → 64px), không biến mất khỏi layout; icon được phóng to và căn giữa. Khi rail đang thu gọn, hover vào sẽ mở tạm menu/hồ sơ và tự thu lại khi rời chuột; trạng thái mặc định vẫn luôn mở. Trên mobile vẫn thu về 0px để không che vùng làm việc.
- Giữ nguyên query `?token=` khi redirect link xác thực employer cũ từ `/xac-thuc-email` sang `/account/verify`; đồng bộ `EMPLOYER_EMAIL_VERIFICATION_PATH` trong môi trường phát triển để email mới dùng trực tiếp route chuẩn.
- Sửa toàn bộ link footer nhà tuyển dụng từ prefix cũ `/nha-tuyen-dung` sang route thật `/tuyendung` bằng seed và data migration `sitecontent.0015`.
- Header marketing hiển thị rõ route hiện tại (màu thương hiệu, gạch chân và `aria-current`), dùng màu trung tính nhất quán cho link chưa chọn; thêm mục Trang chủ. Card giá/dịch vụ có vùng thao tác thật, con trỏ pointer và focus keyboard thay vì chỉ có hiệu ứng thị giác.
- Khóa form consulting sau lần hoàn tất đầu tiên ở cả frontend và backend; sửa race session refresh khiến URL vừa tới `employer-verify` lại bị redirect sang dashboard.
- Sửa hồ sơ company rỗng do luồng đăng ký cũ bị hiểu nhầm là đã hoàn tất; vẫn cho phép người dùng thay thế bằng thao tác tìm/tạo công ty thật.
- Sửa upload giấy tờ dùng validator ảnh cho file PDF; ĐKDN nay nhận JPG/PNG/PDF còn thỏa thuận `candidate_dpa` nhận PDF/DOC/DOCX với kiểm tra MIME, chữ ký file và giới hạn 5 MB.

#### Changed — Tài liệu

- Ghi rõ boundary i18n chỉ thuộc chunk employer marketing, ownership FSD cho domain dịch vụ/lead và cập nhật tiến độ dự án.
- Thêm tài liệu state machine/validation/API cho auth employer, email xác thực/chào mừng, khảo sát nhu cầu, checklist và dashboard; kiểm chứng 85 backend test `accounts/employers/dashboard`, 220 frontend test với coverage 86,96%, lint/architecture/build và 38 Playwright smoke test desktop/mobile. Full backend có 229 test, còn 5 lỗi legacy độc lập ở `apps.applications.tests_migrations` do schema migration thiếu cột `contact_name`.

### 2026-07-15

#### Added

- CV Builder Phase 0: thêm canonical `compose_cv_document` dùng chung để map content vào published template version, áp presentation và validate document/capabilities; bổ sung regression test và ADR 0007.
- CV Builder Phase 1: position options hỗ trợ locale/ordering/content availability; preview API trả canonical document/renderer/revision, hỗ trợ blank và cache base không chứa PII thực.
- CV Builder Phase 2: thêm `CvDraft.document_hash`, latest-recoverable endpoint, read-only template projection và `source_cv_public_id` để copy draft sang CV mới.
- CV Builder Phase 3: thêm registry/API `Locale`, migration FK song song có backfill cho localization/sample/blueprint, canonical `content_json_template` dual-read và route catalogue locale mở rộng.
- CV Builder Phase 4: thêm admin REST/publishing portal, structured sample editor và snapshot worker canonical WeasyPrint→pypdfium2 theo fingerprint, idempotent/write-then-swap.
- CV Builder Phase 5: nâng import PDF/DOCX thành durable AI job có MIME sniffing, idempotency, provider adapter, canonical validation/composition, retry/throttle/retention và modal polling.
- CV Builder Phase 6: gom preview selector/zoom/swatches, thêm versioned cache + PII-free product metrics, rollout runbook và hoàn tất full backend/frontend/E2E gates.

#### Fixed

- AI import adapter đọc `GEMINI_API_KEY`, `OPENAI_API_KEY` và `ANTHROPIC_API_KEY` qua `python-decouple`, nên secret trong `backend/.env` được worker/web process dùng đúng thay vì chỉ đọc `os.environ`.
- Badge cấu hình secret ở Admin dùng cùng resolver `python-decouple`, nên phản ánh đúng key trong `backend/.env` mà không bao giờ trả giá trị key về client.
- `DELETE /api/v2/cvs/{id}/` chuyển từ archive mềm sang xóa vĩnh viễn; loại bỏ UI/API archive/restore, xóa library artifacts và giữ snapshot đã nộp ở trạng thái detached cho workflow tuyển dụng.

- Chuẩn hóa taxonomy kho mẫu CV bằng quan hệ many-to-many `CvTemplate.categories` qua `CvTemplateCategoryLink`; bổ sung `CvColor` và `CvTemplateColorLink` để một template có nhiều màu, mỗi màu có thumbnail/preview URL, thứ tự và trạng thái mặc định riêng.
- Public CV Template API V2 trả thêm `colors[]` từ database; Django admin có màn quản lý category/color và inline gán category/color cho từng template.
- Migration `cv_templates.0004_cv_template_taxonomy_colors` backfill màu từ style JSON cũ sang bảng quan hệ; `seed_cv_catalog` chuyển category legacy thành link thật, seed palette màu/localization/sample content theo cách idempotent.
- Luồng tạo CV V2 nhận tùy chọn `theme_color`, chỉ chấp nhận màu active đã gán cho template và ghi màu đã chọn vào initial version cùng draft.
- Thêm unit/regression test cho contract category/color, URL preview theo màu và việc lưu màu vào CV; smoke test desktop/mobile phủ hover màu đổi preview và trang detail mở create flow.
- Tách contract vị trí sample CV qua migration `cv_templates.0005`: `job_category_slug` giữ định danh ổn định, `position_name_vi` giữ nhãn dropdown tiếng Việt ở mọi locale, còn `position_name` và `content_json` được seed theo ngôn ngữ preview (ví dụ AI/Machine Learning Engineer).
- Sửa mapping locale `en-US` cho các vị trí có tên gốc tiếng Việt (`Chăm sóc khách hàng` → `Customer Service`, `Nhân viên kinh doanh` → `Sales Executive`, `Kế toán` → `Accountant`, `Nhân sự` → `Human Resources`); chạy seed idempotent để sửa sample generated hiện hữu.
- Migration `jobs.0017` chuyển position picker sang taxonomy-driven: `JobCategory` có `public_id`, `JobCategoryLocalization` quản lý tên 4 locale trong admin; dropdown lấy toàn bộ vị trí chuyên môn và chỉ hiển thị `name_vi` có tìm kiếm.
- Migration `cv_templates.0006` thêm `CvContentBlueprint` cấu hình theo locale/experience trong admin và position-content resolver: ưu tiên curated `CvSampleContent`, nếu chưa có thì materialize canonical content từ blueprint. Baseline 61 vị trí × 4 locale được bootstrap, validate thành 244 preview document.
- Migration `cvs.0006` lưu FK position trên CV; `POST /api/v2/cvs/` nhận `position_public_id` và clone nội dung đã resolve vào initial immutable version/draft. `sample_content_public_id` được giữ tương thích trong cửa sổ chuyển đổi.
- Hoàn thiện parity cho account library ở V2: `POST /api/v2/cvs/imports/` nhận PDF/DOCX, `PATCH /api/v2/cvs/{id}/` đổi title/default CV, và `DELETE` archive CV bằng lifecycle service. Response import chỉ trả metadata file, không lộ storage URL.
- Bổ sung constraint DB chỉ cho phép một CV mặc định còn active mỗi candidate; migration giữ CV default cập nhật gần nhất nếu dữ liệu cũ có nhiều bản ghi.
- Bổ sung `POST /api/v2/cvs/{id}/duplicate/`, archive list và `POST …/restore/`. Duplicate builder CV tạo aggregate/version/draft độc lập từ snapshot immutable; restore owner-only trong restore window cấu hình được (`CV_ARCHIVE_RESTORE_WINDOW_DAYS`, mặc định 30 ngày) và không tự đặt lại default CV.
- Bổ sung `GET|POST /api/v2/applications/` cho candidate. Request ghi rõ `cv_public_id` và `version_public_id`; backend tạo `application_snapshot` từ version đó, không đọc draft và không làm đổi CV pointer.

#### Changed

- Luồng create CV V2 và switch draft template dùng chung canonical composer, giữ nguyên CAS draft, immutable version, payload và dual-write legacy.
- Modal và template detail mặc định render sample locale/vị trí đầu tiên, chống request race, đổi màu tức thì; xóa toàn bộ persona/sample/layout hardcode khỏi frontend.
- Previous hoạt động thật; Restore tự dùng duy nhất draft dirty mới nhất, giữ nguyên content và switch template/màu bằng CAS. Editor flush autosave trước điều hướng nội bộ và khi tab chuyển hidden.
- Catalogue/preview/create chỉ chấp nhận locale active; frontend tải locale từ API qua entity riêng, giữ fallback bốn SEO locale và không làm router phụ thuộc request bất đồng bộ.

- Card mẫu CV bỏ danh sách màu fallback hard-code; hover/focus một màu dùng đúng `preview_url` của quan hệ template–color, còn compatibility fallback chỉ giữ một màu cho node API chưa migrate.
- Trang template detail và modal dùng chung `CvSourcePanel`; màu của modal mẫu liên quan có state riêng, không làm đổi màu template chính. Catalog không còn tải sample content rồi truyền vào prop không được sử dụng.
- Đổi tên page `CvEditorPlaceholder` thành `CvEditor` vì route `/cvs/{public_id}/edit` đã render editor thật; thu hẹp public API của entity `cv-template` bằng cách bỏ export preview component không có consumer ngoài slice.
- Trang “CV của tôi” dùng entity API V2 cho archive, rename, default, share và import; upload gọi backend thật rồi refresh danh sách, không còn thông báo thành công bằng timeout hoặc gọi V1.
- Trang “CV của tôi” đã duplicate CV builder thật, hiển thị kho archive để restore, đồng thời bỏ các CTA giả cho “đẩy top” và trạng thái searchable chưa có backend.
- Smoke desktop/mobile của candidate library phủ contract list, owner view, restore và application chọn version; permission/lifecycle vẫn được kiểm tra bằng regression test backend, không đánh đồng mock API với integration test.
- CTA trên card CV dẫn rõ tới owner view để xem và xuất PDF từ immutable version, tái sử dụng feature export hiện có thay vì tạo luồng export thứ hai.
- CTA “Ứng tuyển ngay” mở workflow chọn CV/version bất biến, ưu tiên bản published, cảnh báo khi chưa publish và chỉ gửi payload V2 sau bước xác nhận.
- V1 `/api/cvs/` và `/api/cv-templates/` giữ hoạt động trong thời gian cutover nhưng mọi response đã có `Deprecation`, `Sunset`, `Link: rel="successor-version"` và event telemetry endpoint-level không ghi URL, user-agent hay định danh người dùng.

#### Changed — Tài liệu

- Cập nhật kiến trúc, API, database inventory, tiến độ và kế hoạch CV Builder theo nguồn dữ liệu category/color mới, V1→V2 cutover, các biến môi trường deprecation/sunset và phần còn lại của workflow clone/restore/import analysis.

### 2026-07-14

#### Added

- Hoàn tất onboarding ứng viên và trang cài đặt gợi ý việc làm dùng chung workflow preference: modal chọn vị trí chuyên môn responsive, giới tính tại settings qua candidate profile, validation/toast rõ ràng và cột hồ sơ sticky trên desktop.
- Thêm entity frontend `candidate-profile` cho contract `GET/PATCH /api/candidate/profile/` và regression API test; cập nhật E2E route cho form settings và validation trên desktop/mobile.
- Thêm Cookie Consent Foundation: signed HttpOnly consent cookie, API public `GET/POST /api/privacy/consent/`, provider toàn ứng dụng, banner/modal responsive, trang `/chinh-sach-cookie`, điểm mở lại tại footer và gate cho color scheme/search history.
- Thêm Job View Tracking consent-aware: GET chi tiết việc làm không còn tăng view; `POST /api/jobs/{slug}/views/` dùng consent backend, viewer cookie ký số, Redis Lua dedupe 24 giờ và DB atomic increment.
- Bổ sung inventory cookie/browser storage, tài liệu API/rollout và regression test cho consent, GET read-only, consent-required và first view.

#### Changed

- Tối ưu response API theo use case frontend: tách DTO list/detail/write cho job và employer job, session user/candidate profile/location/blog chỉ trả field đang hiển thị; relation public dùng DTO tối thiểu và không lộ contact nhận hồ sơ hay field quản trị.
- Tối ưu query tương ứng bằng query list/detail riêng, `select_related`, `prefetch_related`, `only` và `defer`; bổ sung regression test so sánh tập key chính xác để chặn field model mới tự lọt ra API.
- Đồng bộ contract `desired_salary_vnd`: frontend và backend đều bắt buộc lương kỳ vọng là số nguyên VND lớn hơn 0; backend thêm regression test cho payload thiếu lương.
- Sửa popup tìm kiếm desktop: cột lịch sử không còn chiếm toàn bộ chiều rộng làm bóp cột việc làm thành vùng trắng; giới hạn chiều cao theo viewport và thêm regression test cho tỷ lệ hai cột.
- Chuẩn hóa toast toàn app: tối đa một thông báo hiện hành để không chồng nhiều lỗi khi người dùng click liên tục.
- CORS giữ origin allowlist nhưng cho phép credential riêng cho consent/tracking first-party cookie.
- Bỏ feature flag job-view tracking dư thừa: tracking chạy khi và chỉ khi Analytics consent hợp lệ; `.env.example` không chứa secret hoặc thông tin database mẫu có thể bị dùng nhầm.
- Consent settings không gửi lại POST nếu lựa chọn không thay đổi, tránh đốt quota khi mở lại modal; lỗi `429` hiện thời gian chờ cụ thể thay vì thông báo chung.
- Môi trường development không áp dụng throttle cho consent để QA có thể đổi lựa chọn liên tục; production vẫn giữ giới hạn `20/hour`.
- Đăng nhập qua Google/Facebook/LinkedIn bỏ qua email 2FA sau khi provider xác thực thành công; đăng nhập email/mật khẩu vẫn yêu cầu mã 2FA khi tài khoản đã bật.
- Đăng ký hoặc OAuth thành công của ứng viên chưa hoàn tất preference luôn chuyển vào `/onboard-user`, kể cả khi có URL quay lại an toàn.
- Nâng chính sách mật khẩu từ 6–25 lên 8–25 ký tự; vẫn chặn mật khẩu phổ biến và bắt buộc có chữ hoa, chữ thường, chữ số.
- Tách email xác thực và email chào mừng cho candidate: đăng ký email chỉ gửi xác thực, sau khi xác thực mới gửi chào mừng; candidate tạo lần đầu qua OAuth nhận email chào mừng ngay vì provider đã xác thực email.
- Form đăng ký candidate kiểm tra email sau 500ms người dùng ngừng gõ, hủy request cũ để kết quả không bị ghi đè; backend có endpoint pre-check giới hạn 12 lần/phút, còn `RegisterSerializer` vẫn là lớp xác thực cuối cùng.

### 2026-07-13

#### Changed

- Hoàn tất đợt tái cấu trúc R3–R8 và R10: feature hóa auth/account/2FA/jobs/applications/saved jobs, tách Django settings theo môi trường, và đưa Candidate/CV/CV template về selector/service khi có use case thực tế.
- Xóa compatibility re-export đã hết hạn ở frontend; consumer dùng public API của `features/*` hoặc `shared/api/*`. Frontend CI kiểm tra thêm feature boundary để chặn deep import alias xuyên feature.
- Giữ R9 onboarding ngoài đợt cleanup để triển khai lại theo thiết kế mới.

### 2026-07-11

#### Fixed

- **Thiếu tỉnh Đà Nẵng trong danh sách địa điểm**: DB chỉ có 33/34 tỉnh — Thành phố Đà Nẵng (code 48) và toàn bộ 94 phường/xã trực thuộc không có bản ghi nào (lần seed trước không nạp đủ; lệnh `seed_locations` bọc atomic toàn bộ nên dữ liệu vào không trọn vẹn). Chạy lại `seed_locations` (idempotent theo `code`, không phá FK) + `seed_province_merges` → khôi phục đủ 34 tỉnh + 3.321 phường/xã, Đà Nẵng có `merged_from = ['Quảng Nam', 'Đà Nẵng']`. Đã xác minh qua API public và picker địa điểm trên `/viec-lam`.
- **Bộ lọc "Theo danh mục nghề" không tự tick con khi chọn cha**: trước đây tick ô nhóm nghề chỉ lưu id nhóm còn checkbox con so khớp id riêng nên không sáng, gây hiểu nhầm là chưa chọn. Nay checkbox suy trạng thái từ tập lá đang chọn: tick cha → mọi con hiển thị checked; bỏ 1 con khi đang chọn cả nhóm → cha thành indeterminate và URL tự khai triển phần còn lại; chọn đủ các con → tự gộp lên id nhóm cho URL ngắn. Logic cây tách vào util dùng chung `pages/main/jobs/utils/categoryTree.js` (có test 8 case), `CategoryPicker` (modal) refactor dùng lại cùng util nên hành vi cha/con nhất quán giữa modal và sidebar.

#### Added — Chuẩn hóa schema tin tuyển dụng (migration `jobs.0012`–`0013`)

- Thay dữ liệu phẳng trên `Job` bằng các bảng quan hệ có cấu trúc: `JobCategoryAssignment` (danh mục theo vai trò — 1 **vị trí chuyên môn chính** unique/job + nhiều **kiến thức chuyên ngành**), `JobLocation` (địa điểm theo **phường/xã** + địa chỉ cụ thể; ghi mới bắt buộc ward có tỉnh cha), `JobWorkSchedule` (khung giờ cấu trúc: thứ từ/đến + giờ + `is_overnight` + ghi chú), `Benefit`/`JobBenefit` (quyền lợi chuẩn hóa), `Language`/`JobLanguageRequirement` (ngoại ngữ: 5 mức trình độ, chứng chỉ, bắt buộc/ưu tiên), `JobApplicationContact`+`JobApplicationEmail` (người nhận hồ sơ 1-5 email — nội bộ, **không expose qua API public**, có test chống lộ).
- `Job` thêm `gender_requirement`, `age_min/age_max`, `number_of_vacancies`, `salary_type` 5 loại (thỏa thuận/khoảng/cố định/từ mức/đến mức) — ràng buộc CheckConstraint ở DB + validate chéo trong serializer theo từng loại.
- `JobSerializer` nhận nested writes cho cả 6 quan hệ (thay thế trọn gói khi update, validate trùng lặp); field cũ frontend đang dùng (`category`, `locations_detail`, `short_description`, `is_salary_visible`) chuyển thành computed read-only. Filter `?category=` match qua `category_assignments` (giữ mở rộng cấp con).

#### Added — Trang chi tiết việc làm bản mới (job detail v2)

- **API view-model, không thêm cột DB**: `JobDetailSerializer` trả thêm `primary_specialization`/`domain_knowledge` (`{id,name,slug}`), `workplace_groups` (địa điểm nhóm theo tỉnh/thành, mỗi dòng có `display` ghép sẵn "địa chỉ, phường/xã"), `requirement_tags` (kinh nghiệm, tuổi, học vấn "Từ X trở lên", giới tính, kỹ năng required), `benefit_tags`, và `proficiency_label` trên `language_requirements` — frontend bỏ hẳn lớp tự suy luận `buildJobTagGroups`; dữ liệu nested thô giữ nguyên cho form employer.
- **Nội dung theo thứ tự đọc mới** (`JobDetailContent`): tag tóm tắt (Yêu cầu/Quyền lợi/Chuyên môn — chuyên môn chính tô emerald) → mô tả → yêu cầu ứng viên → quyền lợi → **yêu cầu ngoại ngữ** ("Tiếng Hàn — Giao tiếp — TOPIK 2", nhãn "Ưu tiên" khi không bắt buộc) → **địa điểm nhóm theo tỉnh** → **thời gian làm việc render JSX** (component `WorkScheduleList` thay chuỗi HTML tự ghép — an toàn hơn, hỗ trợ nhiều ca + ghi chú) → cách thức ứng tuyển (câu cố định của sản phẩm) → CTA ứng tuyển/lưu/báo cáo. Các khối tách vào `JobDetailBlocks.jsx` (6 component nhỏ).
- **Sidebar**: "Thông tin chung" còn đúng 5 mục Cấp bậc/Học vấn/Số lượng tuyển/Hình thức/Loại hình (bỏ "Kinh nghiệm" vì đã có ở Hero + tag yêu cầu); "Danh mục nghề liên quan" link theo **từng** category (`?cat=<id>` riêng cho chuyên môn chính và từng kiến thức chuyên ngành) thay vì mọi tag đổ về chung `job.category`.
- **Sticky bar**: 4 anchor Chi tiết/Mô tả công việc/Địa điểm làm việc/Việc làm liên quan; 2 anchor sau **tự ẩn khi tin không có dữ liệu tương ứng** (tin remote không văn phòng, tin chưa có việc liên quan) — không còn nút cuộn chết.
- **Mobile**: khối tag Yêu cầu thu gọn tối đa ~3 dòng + nút "Xem thêm"/"Thu gọn" (đo `scrollHeight`, chỉ hiện khi thực sự tràn; `sm:` trở lên bỏ giới hạn); sidebar xếp sau nội dung chính; giữ thanh đáy Lưu tin/Ứng tuyển ngay.
- Seed `seed_demo_jobs` làm giàu dữ liệu demo để phủ đủ biến thể trang chi tiết: ~20% tin lương thỏa thuận, ~30% có khoảng tuổi, ~20% yêu cầu giới tính, ~35% có 1-2 ngoại ngữ (chứng chỉ theo mã: TOEIC/TOPIK/JLPT/HSK), 40% làm 2 ca (sáng/chiều), 3-5 quyền lợi, 2-4 kỹ năng, tin remote chỉ 0-1 địa điểm, kiến thức chuyên ngành gắn từ parent của vị trí chuyên môn.
- Verify: 7/7 test `apps.jobs` (2 test mới cho view-model: nhóm địa điểm đúng 2 tỉnh + tag đúng thứ tự; tin tối giản trả mảng rỗng an toàn), 17/17 vitest, lint + `vite build` pass; kiểm chứng browser thật 4 loại tin (onsite 2 tỉnh nhiều địa chỉ, remote không địa điểm, lương thỏa thuận, 2 ngoại ngữ + 2 ca làm việc) và mobile 375px (nút Xem thêm/Thu gọn hoạt động, sticky anchor ẩn/hiện đúng theo dữ liệu).

#### Added — Trang thương hiệu (brand page) cho nhà tuyển dụng

- `EmployerProfile.has_brand_page` (BooleanField, migration `employers.0005`) — admin gán qua Django admin (`list_editable`, cùng khuôn với `Job.tier`); sau này sẽ gán tự động theo gói dịch vụ ở Giai đoạn 6. Bật thì toàn bộ tin tuyển dụng của công ty mở dưới URL riêng `/brand/<company-slug>/tuyen-dung/<job-slug>` kèm header thương hiệu (banner cover + logo + tên công ty), thay vì `/viec-lam/<job-slug>` thông thường.
- `JobSerializer` thêm 2 field đọc: `brand_slug` (suy từ `employer_profile.has_brand_page`, `null` nếu công ty không bật) và `company_cover_url`.
- Frontend: gom toàn bộ logic dựng URL chi tiết job vào **một nơi duy nhất** — `config/jobPaths.js` (`jobDetailPath(job)`), kèm test `jobPaths.test.js` (4 case: tin thường, tin có brand, thiếu `brand_slug`, job rỗng). Migrate mọi điểm gọi cũ tự ghép chuỗi `/viec-lam/${slug}` (`SearchDropdown`, `BestJobsResults`, `FlashBadge`, `MarketStats`, `JobCard`, `JobQuickView`) sang dùng hàm này, không còn nơi nào tự dựng URL job thủ công.
- `MainRoutes` thêm route `/brand/:companySlug/tuyen-dung/:slug` (dùng chung `JobDetailPage`); `JobDetail.jsx` tự `navigate(..., { replace: true })` về đúng URL chuẩn nếu người dùng vào sai dạng URL (ví dụ vào `/viec-lam/...` của một tin có brand), và render component `BrandHeader` khi `job.brand_slug` có giá trị.
- Seed `seed_demo_jobs`: bật `has_brand_page` cho 3 công ty demo (FPT Software, VNG Corporation, Shopee Việt Nam).
- Verify: `manage.py test apps.jobs apps.employers` pass, `vitest run` 4/4 pass, `vite build` pass; kiểm chứng trên browser thật cả 2 luồng — tin công ty có brand page redirect đúng sang `/brand/...` và hiện header thương hiệu; tin công ty thường giữ nguyên `/viec-lam/...`, không phát sinh header thừa.

#### Changed — Tối ưu cấu trúc code (theo quy ước `docs/02-tong-quan/quy-uoc-code.md`)

- Backend: tách `apps/accounts/views.py` (395 dòng, trộn 4 mối quan tâm) thành package `apps/accounts/views/` gồm `auth.py` (đăng ký/đăng nhập/me/avatar), `verification.py` (xác thực email), `password_reset.py` (đặt lại mật khẩu), `oauth.py` (social login) — mỗi module views khớp 1-1 với module service cùng tên có sẵn; helper JWT dùng chung (`issue_tokens`, `revoke_refresh_tokens`) tách vào `views/tokens.py`; `views/__init__.py` re-export nên `urls.py` và mọi import bên ngoài giữ nguyên.
- Frontend: `JobList.jsx` 493 → 367 dòng — toàn bộ logic đọc/ghi bộ lọc lên URL (search/category/location/salary/experience/sort/page, clear, persist) gom vào hook mới `pages/main/jobs/hooks/useJobListFilters.js` (184 dòng), page chỉ còn ghép UI + state cục bộ (dropdown, drawer, quick view); state đóng dropdown giữ ở page vì là UI, bọc quanh `runSearch` của hook.
- Frontend: `FloatingActions.jsx` 343 → 178 dòng — form góp ý sản phẩm (chip chủ đề, emoji hài lòng, phone/email khách vãng lai, submit + constants khớp backend) tách thành `components/layout/FeedbackModal.jsx` (179 dòng), thêm reset form theo mỗi lần mở qua `useEffect` thay vì reset thủ công trước khi mở.
- Frontend: dọn 2 file lệch quy ước — `PopularSearches.jsx` chuyển từ `pages/main/components/layout/` (xoá luôn thư mục trùng tên gây nhầm với `components/layout/`) về `components/layout/` vì nó là thành phần của `MainLayout`, không phải của trang nào; `SavedJobsProvider.jsx` chuyển từ `components/job/` về `contexts/` nằm cạnh `AuthProvider` và `savedJobsContext.js` theo đúng convention provider.
- Verify: backend 30/30 test + `check` + `makemigrations --check` sạch; frontend lint + 17/17 unit test + build pass; kiểm chứng browser: bộ lọc URL (`?cat=&wt=`) render đúng breadcrumb/pill/đếm filter, nút "Xóa bộ lọc & từ khóa" reset sạch URL, modal "Bạn muốn?" → form góp ý mở đúng, tim việc đã lưu + footer PopularSearches vẫn hiển thị.

### 2026-07-10

#### Added — Đặt lại mật khẩu (quên mật khẩu) qua link email

- Luồng 2 bước: `/forgot-password` (nhập email) → email chứa link → `/reset-password?token=` (đặt mật khẩu mới) → điều hướng về đúng cổng đăng nhập theo `role`.
- Backend: module mới `apps/accounts/password_reset.py` — token `secrets.token_urlsafe(32)` lưu Redis, **TTL 30 phút** (ngắn hơn xác thực email 24h vì đây là luồng chiếm được tài khoản), cooldown 60s/tài khoản. Khoá `password_reset:latest:<user_id>` giữ token mới nhất nên **xin link mới là link cũ chết ngay**; token tiêu một lần qua `atomic_pop`.
- Tách helper mail dùng chung `apps/accounts/mailing.py` (`site_setting`, `from_email`, `frontend_link`, `send_html_email`); `email_verification.py` refactor dùng lại thay vì nhân bản.
- Endpoints mới: `POST /api/auth/password-reset/` (captcha; **luôn trả cùng một `detail`** dù email tồn tại hay không → không dò được danh sách email; cooldown xử lý im lặng để phản hồi không lệch; email đẩy qua outbox `AuthEmailJob` kind `password_reset`), `GET /api/auth/password-reset/validate/?token=` (kiểm tra link **không tiêu token**, trả `{email, role}` → hiện ngay màn "link hết hạn" thay vì bắt user gõ xong mật khẩu mới báo lỗi), `POST /api/auth/password-reset/confirm/` (validate mật khẩu **trước** khi tiêu token, để mật khẩu yếu không đốt link).
- Sau khi đổi mật khẩu: `email_verified=True` (nhận được mail ở địa chỉ đó = đã chứng minh quyền sở hữu hòm thư) và **blacklist toàn bộ refresh token cũ** qua `rest_framework_simplejwt.token_blacklist` — phiên đăng nhập cũ không gia hạn được nữa (access token vẫn sống tới khi hết hạn vì SimpleJWT không kiểm blacklist cho access token).
- Rule mật khẩu tách thành `password_field()` dùng chung với `RegisterSerializer` (6–25 ký tự, có hoa/thường/số, `validate_password`).
- Frontend: 2 trang lazy `ForgotPassword.jsx` / `ResetPassword.jsx` (dùng lại `PasswordRequirements` realtime + rule "nhập lại không khớp"); thêm `MAIN_FORGOT_PASSWORD_URL` trong `portals.js` vì cổng NTD/admin chạy subdomain riêng phải link tuyệt đối về host chính — `LoginForm` render `<a>` thay `<Link>` khi link là absolute URL.
- Env mới: `PASSWORD_RESET_TTL=1800`, `PASSWORD_RESET_RESEND_COOLDOWN=60` (đã thêm vào `.env` và `.env.example`).
- **Bug tự gây ra rồi sửa**: ban đầu cả 3 endpoint dùng chung `throttle_scope='password_reset'` (5/phút theo IP) → gõ sai mật khẩu mới vài lần là hết quota và **không confirm được nữa** dù link còn hạn. Tách bucket riêng `password_reset_confirm` (10/phút).
- Verify: 15 assertion qua HTTP client thật (chống dò email, cooldown im lặng, link cũ chết khi xin link mới, token dùng một lần, mật khẩu yếu không đốt token, refresh token bị blacklist, `email_verified` bật) + kiểm chứng trên browser (submit thật → 200, màn "link không còn hiệu lực", mobile 375px không tràn ngang).

#### Fixed — `JWT_SIGNING_KEY` bỏ trống làm hỏng mọi lần phát token

- `SIMPLE_JWT['SIGNING_KEY']` dùng `config('JWT_SIGNING_KEY', default=SECRET_KEY)`, nhưng `python-decouple` chỉ áp dụng `default` khi key **vắng mặt** — dòng `JWT_SIGNING_KEY=` (đúng như `.env.example` hướng dẫn) trả về chuỗi rỗng, khiến PyJWT ném `InvalidKeyError: HMAC key must not be empty` ở mọi lần phát token. Đổi sang `config('JWT_SIGNING_KEY', default='') or SECRET_KEY` (cùng pattern `EMAIL_FROM_ADDRESS` sẵn có); kiểm tra bắt buộc khai báo key riêng khi `ENVIRONMENT=production` vẫn giữ nguyên.
- `.env.example`: 2 dòng `EMAIL_VERIFICATION_*` viết comment **cùng dòng với giá trị** (`86400  # 24h`) — decouple không cắt comment nên `cast=int` ném `ValueError`, ai copy nguyên xi thì backend không boot. Chuyển comment lên dòng riêng và ghi chú rõ; bổ sung `PASSWORD_RESET_*`, `OAUTH_STATE_TTL`, `OAUTH_CODE_TTL` cho khớp `settings.py`.

#### Fixed — Email phân biệt hoa/thường giữa đặt lại mật khẩu và đăng nhập

- `password-reset` tra user bằng `email__iexact`, còn login đi qua `authenticate()` → `get_by_natural_key()` so sánh **chính xác** (Postgres phân biệt hoa/thường), và `BaseUserManager.normalize_email()` chỉ hạ chữ phần domain chứ không hạ phần trước `@`. Hệ quả: tài khoản đăng ký `Hau@gmail.com` **đặt lại mật khẩu được nhưng đăng nhập bằng `hau@gmail.com` thì 401**.
- Sửa: `UserManager.normalize_email()` hạ chữ **toàn bộ** địa chỉ; `UserManager.get_by_natural_key()` dùng `iexact`; thêm ràng buộc DB `UniqueConstraint(Lower('email'), name='uniq_users_email_lower')` — nếu thiếu, `iexact` có thể khớp 2 bản ghi và `authenticate()` ném `MultipleObjectsReturned` (500 thay vì 401). `RegisterSerializer.validate_email()` chặn trùng theo `iexact` để trả 400 tử tế, vì `UniqueValidator` mặc định của ModelSerializer cũng phân biệt hoa/thường và sẽ vỡ ở index DB.
- Migration `accounts.0004_email_case_insensitive`: `RunPython` hạ chữ email cũ trước khi gắn ràng buộc, và **dừng kèm danh sách địa chỉ cụ thể** nếu môi trường đã lỡ có 2 tài khoản chỉ khác nhau hoa/thường — gộp hay xoá tài khoản nào là quyết định của con người, không phải của migration.
- Verify: rollback về `0003` → tạo xung đột thật → migrate lại và thấy đúng `RuntimeError` mong đợi. Qua HTTP: đăng ký `Hau.Test@Example.com` lưu thành `hau.test@example.com`; login được với cả `hau.test@…`, `Hau.Test@…`, `HAU.TEST@…`; đăng ký lại khác case → 400 (không phải 500); reset bằng email chữ hoa rồi login chữ thường → 200. 25/25 test `apps.accounts` pass.

#### Added — Ghi nhận `last_login`

- `User.last_login` (có sẵn từ `AbstractUser` nhưng chưa từng được cập nhật vì JWT không đi qua `django.contrib.auth.login()`) nay được set ở cả 3 luồng phát token: đăng nhập email/mật khẩu (`RoleTokenObtainPairSerializer.validate`, chỉ set sau khi qua được kiểm tra `portal` — sai mật khẩu hoặc sai cổng không tính là đăng nhập), đăng ký auto-login và social login (cả hai qua `_issue_tokens()`). Expose thêm field `last_login` trong `UserSerializer`.
- Test: 5 test mới (`LastLoginTests`) cho cả 3 luồng + 2 case âm (sai mật khẩu, sai cổng không set). Phát hiện và sửa 2 vấn đề cô lập test khi viết: Django test runner luôn ép `DEBUG=False` (cần override tường minh để bypass captcha khi test), và `ScopedRateThrottle` dùng chung cache Redis thật nên phải override `CACHES` sang `LocMemCache` để không cộng dồn số lần gọi `/api/auth/login/` giữa các lần chạy test.

#### Added — Social login (OAuth Google / Facebook / LinkedIn)

- Đăng nhập mạng xã hội theo **OAuth Authorization Code Flow qua backend callback**: ứng viên dùng Google/Facebook/LinkedIn, nhà tuyển dụng chỉ Google, admin không có. App chạy được ngay cả khi chưa cấu hình credential — nút social chỉ báo "chưa cấu hình" khi bấm.
- Backend: model `SocialAccount` (`user`, `provider`, `provider_user_id`, `email`, `raw_profile`, unique `(provider, provider_user_id)`); `User.Provider` thêm `facebook`/`linkedin`. Service `apps/accounts/services/oauth.py`: build authorize URL, `state` chống CSRF lưu Redis TTL 10 phút (one-shot), đổi code lấy token, đọc + chuẩn hoá profile (OIDC cho Google/LinkedIn, Graph cho Facebook), `one_time_code` Redis TTL 60s.
- Endpoints mới: `GET /api/auth/oauth/<provider>/start/?portal&next` (redirect sang provider), `GET /api/auth/oauth/<provider>/callback/` (verify state → tạo/liên kết user → redirect frontend kèm code), `POST /api/auth/oauth/complete/` (đổi one_time_code lấy `{user, access, refresh}`, throttle 10/min).
- Luật tài khoản: có `SocialAccount` → đăng nhập luôn; email trùng **cùng vai trò** → tự liên kết (đánh dấu `email_verified=True`, giữ mật khẩu cũ); email trùng **khác vai trò** → chặn "Tài khoản không thuộc cổng này"; user mới → vai trò theo cổng, `email_verified=True`, mật khẩu unusable. Tham số `next` chỉ nhận path nội bộ (chặn absolute/`//`).
- Frontend: component chung `SocialLoginButtons` (full-page redirect sang start URL, `next` = trang hiện tại trừ trang auth), trang `OAuthCallback` dùng chung 2 cổng (`/oauth/callback`, `/tuyendung/app/oauth/callback`; guard chống StrictMode gọi effect 2 lần vì code one-shot), lưu token đúng portal key, lỗi → quay về trang login của cổng kèm `?oauth_error=` hiển thị trong Alert (map mã lỗi → tiếng Việt ở `errorMessage.js`). Login/Register cổng NTD thêm nút Google + divider.
- Cấu hình `.env`: `OAUTH_{GOOGLE,FACEBOOK,LINKEDIN}_CLIENT_ID/SECRET`, `OAUTH_FACEBOOK_GRAPH_VERSION`, `OAUTH_MAIN/EMPLOYER_CALLBACK_URL`, `OAUTH_STATE_TTL`, `OAUTH_CODE_TTL`. Hướng dẫn lấy key từng provider: `docs/05-huong-dan/dang-nhap-mang-xa-hoi.md`.
- Test: 13 test OAuth backend (portal rules, tạo/liên kết/chặn theo vai trò, state one-shot, one_time_code one-shot, chặn `next` absolute).

#### Changed — Media lưu storage key thay vì URL tuyệt đối

- Toàn bộ tham chiếu ảnh (`User.avatar_url`, `EmployerProfile.company_logo_url`/`cover_image_url`, `JobCategory.logo_url`, `Banner.image_url`, `SiteSetting` kiểu image, `UserCv.file_url`/`pdf_url`/`thumbnail_url`) nay lưu **storage key** (vd `site/settings/logo.png`) trong DB thay vì URL tuyệt đối; serializer resolve ra URL công khai theo domain/CDN **tại thời điểm trả API** qua `media_url_from_value`. Nhờ vậy đổi domain hoặc bật `MEDIA_PUBLIC_BASE_URL` không còn để lại `localhost:8000` cũ trong dữ liệu/cache.
- `apps/common/media_storage` thêm `media_storage_path` (đọc được cả key mới, `/media/...` cũ và URL `http://localhost:8000/media/...` legacy, chống path traversal, chỉ nhận host media hợp lệ để không xoá nhầm ảnh bên thứ ba), `normalise_media_value`, `media_url_from_value`. Xoá file cũ khi thay ảnh chỉ chạy sau `transaction.on_commit`.
- Command mới `normalize_media_references` (dry-run mặc định, `--apply` để ghi) chuyển dữ liệu URL legacy sẵn có sang storage key; URL ngoài hệ thống giữ nguyên.
- `POST /api/site/admin/settings/upload/` nay resize ảnh theo `UPLOAD_MAX_DIMENSIONS` (favicon giới hạn 256×256, dùng Pillow) và trả `{key, value, url}`; upload avatar/logo/cover cũng lưu storage key.

#### Changed — Tối ưu hiệu năng frontend (đợt 1)

- Favicon: `frontend/index.html` từng trỏ ảnh logo 2000×2000 nặng **957KB** tải mọi trang. Dựng `favicon-32.png` (1.9KB) + `apple-touch-icon.png` (18.8KB) resize từ đúng logo ProCV bằng Pillow; đặt làm default ở `index.html`, `siteSettingsContext.js` và seed `sitecontent`. Fix cả tầng runtime (`SiteSettingsProvider` ghi đè `<link rel=icon>` từ `brand_favicon_url`) lẫn seed idempotent để không revert về ảnh nặng.
- Vite: tách vendor `react` (react/react-dom/react-router-dom/scheduler) thành chunk riêng qua `manualChunks` (dạng **function** — Vite 8 dùng rolldown) để cache độc lập qua các lần deploy; cố ý **không** gom antd vào 1 chunk để tránh kéo antd trang admin vào initial load.
- Thêm dependency `Pillow==11.3.0` (resize favicon + ảnh upload).

### 2026-07-09

#### Added — Hệ thống cài đặt admin 15 nhóm (schema-driven)

- `SiteSetting` mở rộng thành nền tảng cấu hình toàn hệ thống: thêm `value_type` (text/textarea/number/boolean/select/color/image/email/url/json/env), `options` (choices cho select, `env_var` cho kiểu env), `order`; nhóm mở rộng từ 4 → 15 (chung, trang chủ, SEO, ứng viên, NTD, việc làm, CV, email, thanh toán, bảo mật, upload, footer, liên hệ, phân quyền admin, AI). Migration gộp nhóm `appearance` cũ vào `general`.
- Seed `seed_sitecontent` viết lại: 96 keys đủ 15 nhóm, idempotent — đồng bộ metadata nhưng không ghi đè `value` admin đã chỉnh. Secrets (API key AI, SMTP, VNPay) giữ trong `.env`, DB chỉ lưu trạng thái qua kiểu `env`.
- API admin mới: `GET/PATCH /api/site/admin/settings/` (trả cấu hình gộp theo nhóm kèm metadata; bulk update có validate theo `value_type`, từ chối key kiểu env) + `POST /api/site/admin/settings/upload/` (upload ảnh dùng chung `media_storage`); permission `IsAdmin` mới. Public `/api/site/settings/` được cache 1h, signal `post_save/post_delete` tự invalidate.
- Trang React `/admin/settings`: tabs 15 nhóm, form tự sinh từ metadata (`SettingField` map value_type → control AntD: Switch/InputNumber/Select/ColorPicker/Upload ảnh/JSON editor/tag env), dirty-tracking + lưu theo nhóm + hoàn tác, tag "Public" cho key lộ ra frontend. Nav admin trong `DashboardLayout` bỏ 2 menu chết (users/skills), thêm "Cài đặt hệ thống", highlight theo route.
- Tài liệu: hướng dẫn mới `docs/05-huong-dan/cau-hinh-site-settings.md` (bảng đủ 96 keys, quy ước env, quy tắc seed), cập nhật `docs/04-api/tai-lieu-api.md` và tiến độ 6.6–6.8.
- Dọn dẹp: xoá file trùng lặp mồ côi `frontend/src/components/brand/siteSettingsContext.js`.

#### Added — Storage nội bộ cho logo/ảnh upload

- Thêm helper `apps.common.media_storage` để validate ảnh JPG/PNG/GIF/WebP, giới hạn dung lượng upload, lưu file qua Django `default_storage`, sinh public URL theo `MEDIA_URL`/`MEDIA_PUBLIC_BASE_URL`, và tự xóa file cũ nếu thuộc storage nội bộ.
- Thêm cấu hình `MEDIA_PUBLIC_BASE_URL`, `IMAGE_UPLOAD_MAX_SIZE`; bổ sung API upload `POST /api/auth/avatar/`, `POST /api/employer/profile/logo/`, `POST /api/employer/profile/cover/`; upload CV cũng dùng chung hàm sinh media URL.
- Django admin hỗ trợ upload ảnh nội bộ cho `JobCategory.logo_url` và `Banner.image_url`; frontend có helper `mediaService.js` cho multipart upload.
- Chuẩn hóa asset ProCV: `brand_logo_url` dùng logo ngang `/images/logo/logo_proCV_2000_600.png` cho header, còn `brand_logo_mark_url`/`brand_favicon_url` dùng logo vuông `/images/logo/logo_proCV_2000_2000.png`; cập nhật default site settings, seed `sitecontent`, DB local và favicon mặc định trong `frontend/index.html`.

#### Changed — Header và branding

- Header chỉ ẩn khi cuộn xuống ở trang danh sách việc làm (`/viec-lam`, `/viec-lam/tai/...`, `/jobs`); trang chủ và các trang khác giữ header sticky luôn hiện.
- Site settings/brand logo dùng fallback ProCV thống nhất; sửa bản context trùng trong `frontend/src/components/brand/siteSettingsContext.js` để không còn key sai.
- Màu thương hiệu chính (`brand_primary_color`) từ DB nay điều khiển Ant Design `ConfigProvider` và các class màu brand phổ biến qua CSS variables (`--brand-primary`, `--brand-primary-hover`, `--brand-primary-soft`), thay vì chỉ set biến nhưng UI vẫn hardcode `#00b14f`.

#### Fixed

- Sửa lọc "Mức lương" trong section "Việc làm tốt nhất": thêm query `salary_bucket` cho homepage, bucket theo mức lương cao nhất hiển thị của job thay vì logic giao nhau khoảng lương. Nhờ vậy chọn "Dưới 10 triệu" không còn trả job `8 - 13tr` hoặc `10 - 25tr`.
- Thêm test backend cho salary bucket và test upload avatar/logo công ty qua media storage; chạy lại `manage.py check`, test liên quan và `npm run build`.

### 2026-07-07

#### Added — Tài liệu API Swagger + dashboard thống kê trang chủ

- Tích hợp `drf-spectacular` (OpenAPI 3): Swagger UI tại `/api/docs/`, ReDoc tại `/api/redoc/`, schema tại `/api/schema/`. Cấu hình JWT Bearer để "Authorize" thử API ngay trên trình duyệt, gom endpoint theo tag tiếng Việt, đặt tên enum tường minh (`ENUM_NAME_OVERRIDES`) để schema sạch (0 warning/error). Annotate 2 APIView đặc biệt (`UserCvUploadView` upload multipart, `JobStatsView`) bằng `@extend_schema`.
- Endpoint `GET /api/jobs/stats/` (public): thống kê cho dashboard trang chủ — số việc làm đang tuyển, số công ty, việc làm mới trong 24h, chuỗi tăng trưởng 7 ngày (cộng dồn job active theo ngày), nhu cầu tuyển dụng theo nhóm ngành (cuộn lên từ danh mục 3 cấp), và 10 việc làm mới nhất.
- Frontend: section `MarketStats` trên trang chủ (thẻ nền xanh đậm) gồm mascot + danh sách "Việc làm mới nhất" tự xoay 10 giây/lần, 3 ô số liệu nhanh, biểu đồ đường tăng trưởng và biểu đồ cột nhu cầu theo ngành (vẽ bằng SVG, bảng màu kiểm định CVD theo skill dataviz). Banner cạnh danh mục đổi thành `BannerCarousel` (tự trượt 5s, nút trước/sau, dot, dừng khi hover). Áp dụng bộ lọc địa điểm ở trang chủ tìm ngay không cần bấm "Tìm kiếm".
- Lệnh `seed_demo_jobs` tạo 8 công ty demo + ~30 tin tuyển dụng active (trải theo ngày/ngành/địa điểm) để dashboard và danh sách job có dữ liệu minh hoạ; re-runnable, có cờ `--clear`.

#### Added — Trang chủ, danh sách/chi tiết job (Giai đoạn 1.14)

- Trang chủ (`Home.jsx`): hero xanh với ô tìm kiếm (từ khoá + `LocationFilter`), banner quảng cáo dạng carousel (`BannerCarousel` — tự trượt mỗi 5 giây, dừng khi hover, nút trước/sau, dot điều hướng, 3 slide mẫu), mega-menu danh mục 3 cấp (`CategoryMenu` — hover một nhóm nghề hiện nghề + vị trí chuyên môn ở 2 cột bên phải, phân trang nhóm nghề bằng nút mũi tên có hiệu ứng hover), lưới "Việc làm mới nhất".
- Trang danh sách job (`pages/jobs/JobList.jsx`, route `/jobs`): thanh tìm kiếm trên cùng gồm `CategoryPicker` (modal chọn danh mục 3 cấp, multi-select, tự rút gọn về id nhóm/nghề khi chọn đủ toàn bộ danh mục con), ô từ khoá, `LocationFilter`, nút Tìm kiếm; sidebar lọc thêm hình thức làm việc/loại hình/cấp bậc; phân trang kết quả.
- Trang chi tiết job (`pages/jobs/JobDetail.jsx`, route `/jobs/:slug`): hiển thị đầy đủ mô tả công việc, số lượng cần tuyển, yêu cầu học vấn, danh sách nhiều địa điểm tuyển, nút Ứng tuyển (điều hướng sang đăng nhập nếu chưa có tài khoản).
- Component dùng chung mới: `Header`/`Footer` (mega-menu dropdown theo từng mục Việc làm/Tạo CV/Công cụ/Cẩm nang nghề nghiệp — có icon, vách ngăn giữa các cột, mũi tên hiệu ứng khi hover từng mục), `JobCard`/`JobCardSkeleton`, `MainLayout`, `CategoryMenu`, `CategoryPicker` (modal 3 cấp, chuyển sang chế độ drill-down 1 cột trên mobile), `LocationFilter` (chọn nhiều tỉnh/thành + phường/xã cùng lúc, 2 ô tìm kiếm, drill-down mobile, nhãn "Tỉnh (Tất cả)"/"Tỉnh (n phường/xã)"), `BannerCarousel`.
- `api/jobService.js`, `api/locationService.js`, `api/pagination.js` (helper `fetchAllPages()` gộp toàn bộ trang của một endpoint bị phân trang thành 1 mảng), `constants/jobOptions.js` (nhãn tiếng Việt cho work_type/employment_type/experience_level/education_level, hàm `formatSalary`/`formatEducation`/`formatLocations`).
- Toàn bộ trang chuyển sang lazy-load (`React.lazy` + `Suspense` trong `AppRoutes.jsx`), thay `Spin` bằng Ant Design `Skeleton` cho danh sách job, theme Ant Design đổi màu chủ đạo sang xanh `#00b14f` qua `ConfigProvider`.
- Áp dụng bộ lọc địa điểm ở trang chủ giờ tìm kiếm ngay khi bấm "Áp dụng" trong popover, không cần bấm thêm nút "Tìm kiếm".

#### Changed — Job hỗ trợ nhiều địa điểm, số lượng tuyển, yêu cầu học vấn

- `Job.location` (ForeignKey, PROTECT) đổi thành `Job.locations` (ManyToManyField tới `locations.Location`) — một tin tuyển dụng có thể tuyển nhiều tỉnh/phường cùng lúc; migration tự động chuyển dữ liệu `location` cũ sang bảng M2M trước khi xoá cột, không mất dữ liệu job đã tạo trước đó.
- Thêm `Job.number_of_vacancies` (số lượng cần tuyển) và `Job.education_level` (yêu cầu học vấn tối thiểu: none/high_school/intermediate/college/university/postgraduate).
- API `/api/jobs/` nhận nhiều `?location=` (id tỉnh hoặc phường/xã — id tỉnh tự khớp mọi job ở các phường/xã trực thuộc) và nhiều `?category=` (id ở bất kỳ cấp nào trong danh mục 3 cấp, tự mở rộng xuống các danh mục con).
- `JobSerializer` đổi trường ghi `location`/đọc `location_name` thành `locations` (ghi, nhận danh sách id) và `locations_detail` (đọc, danh sách object `{id, name, level}`).
- `job_categories` reseed thành taxonomy 3 cấp qua `seed_job_categories` (nhóm nghề → nghề → vị trí chuyên môn: 8 nhóm, 24 nghề, 61 vị trí); danh mục 2 cấp cũ chuyển `status=inactive` thay vì xoá.
- `/api/locations/` tắt phân trang (`pagination_class = None`, giới hạn 500 bản ghi/lần) — endpoint tra cứu tỉnh/phường trả trọn danh sách trong 1 lần gọi thay vì phân trang 20/trang.

#### Fixed

- `getProvinces()`/`getJobCategories()` gọi thẳng `.map()` lên response bị lỗi vì `/api/locations/` và `/api/jobs/categories/` bị phân trang mặc định (`PAGE_SIZE=20`) trong khi có 34 tỉnh/nhiều danh mục hơn 1 trang — thêm `fetchAllPages()` gộp hết các trang trước khi trả về component.
- `CategoryPicker`/`LocationFilter` bị tràn và không thao tác được bằng cảm ứng trên mobile do hiển thị nhiều cột cố định (280px/640px) — chuyển sang chế độ drill-down 1 cột có nút quay lại khi ở màn hình nhỏ, giữ nguyên nhiều cột trên desktop.

### 2026-07-06

#### Added — Khởi tạo dự án + nền tảng (Giai đoạn 0 + 4 bảng đầu Giai đoạn 1)

- Khởi tạo file changelog để theo dõi thay đổi của dự án.
- Chốt công nghệ theo PRD: ReactJS + Vite (frontend), Django + Django REST Framework (backend), PostgreSQL, JWT (simplejwt).
- Scaffold Django project `backend/config` với các app: `accounts`, `skills`, `candidates`, `employers`, `cv_templates`, `cvs`, `jobs`, `applications`, `interviews`, `ai_core`, `dashboard`.
- Scaffold frontend React + Vite + Tailwind CSS + Ant Design, cấu trúc `src/{pages,components,layouts,services,hooks,routes}`.
- Triển khai 4 bảng đầu của Giai đoạn 1 (theo tài liệu database v1.4, mục 7): `users` (custom User kế thừa AbstractUser, role candidate/employer/admin, public_id, status, soft-delete), `skills` (nguồn kỹ năng chuẩn duy nhất, seed 34 kỹ năng qua `seed_skills`), `candidate_profiles`, `employer_profiles`.
- API JWT auth (`/api/auth/register`, `/login`, `/refresh`, `/me`) và profile theo vai trò (`/api/candidate/profile`, `/api/employer/profile`), có phân quyền theo role.
- Frontend: trang đăng ký/đăng nhập, dashboard shell theo vai trò (candidate/employer/admin), test end-to-end thành công.
- Cấu trúc `docs/` theo 8 chủ đề (01-phan-tich ... 08-frontend), mỗi thư mục một file tài liệu đặt tên cụ thể.
- Thêm `docs/TIEN-DO-DU-AN.md` theo dõi tiến độ toàn dự án theo từng giai đoạn.
- Local dev: PostgreSQL qua Homebrew (không dùng Docker ở giai đoạn đầu, theo khuyến nghị PRD mục 8.4).

#### Added — Hoàn thành Giai đoạn 1 (MVP lõi): 8 bảng còn lại

- `job_categories` — danh mục ngành nghề, self-referential parent.
- `locations` — địa điểm hành chính 2 cấp (tỉnh/xã), seed dữ liệu thật 34 tỉnh + 3.321 xã/phường từ `provinces.open-api.vn` qua management command `seed_locations`.
- `cv_templates` — mẫu CV, API public list/detail.
- `user_cvs` — CV Builder + upload CV có sẵn (PDF/DOCX), soft-delete.
- `cv_skills` — kỹ năng theo từng CV, lồng trong API `user_cvs`.
- `jobs` — tin tuyển dụng, API public list/detail (tăng `view_count`, lọc theo category/location/work_type/employment_type/experience_level/search) và employer CRUD.
- `job_skills` — kỹ năng yêu cầu của job, lồng trong API `jobs`.
- `applications` — hồ sơ ứng tuyển, UNIQUE(candidate, job) chặn ứng tuyển trùng (kiểm tra ở cả serializer và DB constraint), employer xem/cập nhật trạng thái (tự set mốc thời gian tương ứng).
- API tra cứu địa điểm `/api/locations/` (cascading tỉnh → xã) phục vụ chọn địa điểm khi đăng job.
- Test end-to-end toàn bộ luồng: đăng job → tạo CV → ứng tuyển → employer duyệt hồ sơ.

#### Fixed

- `ApplicationSerializer` trả lỗi 500 khi ứng tuyển trùng job (IntegrityError từ DB constraint) — thêm `validate_job()` để trả lỗi 400 rõ ràng trước khi chạm DB.
- `UserCvSerializer` yêu cầu `cv_type` trong payload dù giá trị được set ở server — chuyển `cv_type` sang `read_only_fields`.

#### Changed — Tái cấu trúc thư mục cho gọn hơn

- Backend: gom toàn bộ 12 Django app (`accounts`, `skills`, `candidates`, `employers`, `locations`, `cv_templates`, `cvs`, `jobs`, `applications`, `interviews`, `ai_core`, `dashboard`) vào `backend/apps/`, giữ `backend/config/` (settings/urls) và `backend/common/` (tiện ích dùng chung) ở ngoài vì không phải app. Cập nhật `AppConfig.name`, `INSTALLED_APPS`, toàn bộ import chéo giữa các app và `include()` trong `config/urls.py` sang `apps.<tên_app>`. Không phát sinh migration mới (app_label giữ nguyên), đã test lại toàn bộ API sau khi đổi.
- Frontend: đổi `src/services/` thành `src/api/` (chứa `api.js` và `authService.js`), cập nhật import ở `hooks/useAuth.jsx` và `pages/auth/Register.jsx`. Build và test đăng nhập lại thành công.

#### Removed

- Gỡ `backend/venv` cũ (thiết lập FastAPI/Alembic bị vô tình commit vào git) do đổi hướng backend sang Django.
