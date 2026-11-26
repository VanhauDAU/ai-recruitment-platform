# ADR-0029: Việc làm gần bạn — tọa độ không PostGIS, geocoding qua adapter

**Trạng thái:** Đã chấp nhận
**Ngày:** 25/11/2026
**Owner:** Việc làm (`apps.jobs`) + Địa điểm (`apps.locations`)
**Đặc tả:** [dac-ta-tim-viec-gan-day.md](../01-phan-tich/dac-ta-tim-viec-gan-day.md)

## Bối cảnh

- Địa điểm làm việc chỉ có đơn vị hành chính: `JobLocation.location` trỏ tới một tỉnh
  hoặc một phường/xã (2 cấp sau 01/07/2025) cộng địa chỉ chữ tự do. Không có tọa độ ở
  bất kỳ bảng nào, không có geocoder, không có thư viện bản đồ.
- CSDL là image `pgvector/pgvector:pg16`, không có PostGIS.
- Header `Permissions-Policy: geolocation=()` chặn định vị trên mọi trang do Django
  trả (kể cả SEO shell là tài liệu gốc của SPA).
- Nguồn seed `provinces.open-api.vn` trả mã phường dạng số trần nên mã của 5 phường
  trung tâm Hà Nội (Ba Đình = 4, Giảng Võ = 25…) trùng mã tỉnh, `update_or_create`
  ghi đè lẫn nhau và các phường này biến mất khỏi DB.

## Quyết định

1. **Không dùng PostGIS.** Thêm `latitude`/`longitude` (`FloatField`) + index ghép cho
   `Location` và `JobLocation`. Truy vấn bán kính = lọc hộp bao (range scan trên index)
   rồi haversine bằng hàm ORM (`Radians/Sin/Cos/ASin/Sqrt`), khoảng cách của tin =
   `Subquery` min theo các nơi làm việc. Quy mô vài chục nghìn nơi làm việc, bán kính
   ≤ 100 km: đủ nhanh, không đổi image DB, test chạy trên Postgres sẵn có.
2. **Tâm phường/tỉnh là dữ liệu tĩnh trong repo.** `build_location_centroids` tính tâm
   hình học (điểm nằm trong đa giác) từ ranh giới GeoJSON sau sáp nhập
   (ThangLeQuoc/vietnamese-provinces-database, MIT), ghép theo tên trong từng tỉnh, ghi
   `apps/locations/seed_data/centroids.json` (3.355/3.355 đơn vị). `seed_location_coordinates`
   nạp file này, không gọi mạng — giữ nguyên tắc "không gọi API lúc chạy" của `Location`.
3. **Mã phường đệm 5 chữ số** (`00004`): migration `locations.0002` đệm mã cũ, seed đệm
   mã mới. Mã tỉnh giữ nguyên.
4. **Thứ tự tin cậy tọa độ một nơi làm việc:** ghim của NTD (tùy chọn, server kiểm
   trong lãnh thổ VN và đúng tỉnh) > địa chỉ đã geocode (cache) > tâm phường. Dòng
   "Tất cả" (cả tỉnh) và dòng tỉnh cũ không có điểm; tìm gần khớp chúng khi vị trí ứng
   viên thuộc tỉnh đó ("Tuyển khắp tỉnh", xếp sau tin có km).
5. **Geocoding qua adapter, cache theo khóa địa chỉ chuẩn hóa.** `GEOCODING_PROVIDER`
   = `geoapify` (production) | `nominatim` (chỉ dev, 1 req/s, không autocomplete) |
   `disabled`. Key là bí mật phía server; trình duyệt chỉ gọi `/api/public/locations/geo/*`.
   `GeocodeCache` giữ kết quả 180 ngày (không thấy: 7 ngày) vì `job_locations` bị
   xóa-tạo-lại mỗi lần lưu tin. Địa chỉ chưa có trong cache được geocode nền bằng
   Celery sau commit; trong lúc chờ, nơi làm việc dùng tâm phường.
   *Sửa 27/11/2026:* bản đầu chọn `vietmap` (thêm `goong` dự phòng). Khi triển khai thì
   API tìm kiếm của VietMap trả phí, còn tài khoản Goong mới phải chờ kích hoạt mới tạo
   được key, nên hai adapter này đã bị gỡ. LocationIQ không được chọn vì gói miễn phí chỉ
   cho cache 48 giờ.
   Geoapify miễn phí 3.000 request/ngày, đăng ký không cần thẻ, được dùng thương mại nếu
   ghi công Geoapify và OpenStreetMap. Kết quả lọc `countrycode:vn` nên không lẫn đối tượng
   OSM gán cho nước khác ở Hoàng Sa. Ref gợi ý mang sẵn tọa độ, nên chọn gợi ý không tốn
   thêm request. Key tile VietMap chỉ dùng cho bản đồ nền (mục 6).
6. **Bản đồ: MapLibre GL, nạp lazy.** Style lấy từ site setting `map_style_url` (style
   VietMap kèm key tile công khai). Thư viện ~300 KB gzip chỉ nằm trong chunk của trang
   dùng bản đồ, bundle khởi tạo không đổi.
   *Sửa 27/11/2026:* bỏ style dự phòng OpenFreeMap. Tile OpenStreetMap trong vùng Biển
   Đông gán tên Trung Quốc cho hai quần đảo (từ zoom 7 có "Sansha 三沙市", "Xisha 西沙区",
   "Nansha 南沙区", "Yongxing 永兴镇"; zoom 8 thêm hàng chục tên đáy biển tiếng Trung),
   nhãn biển ghi "South China Sea 南海", còn đảo Ba Bình có đường biên quốc gia gắn Đài
   Loan. Như vậy là vi phạm khoản 4 Điều 6 Luật Đo đạc và bản đồ 2018.
   `useBasemap()` (`entities/system/site-settings`) chỉ nhận style https của nhà cung cấp
   bản đồ Việt Nam (hiện chỉ `maps.vietmap.vn`). Nếu không hợp lệ, trang ẩn bản
   đồ: danh sách việc làm gần vẫn chạy, NTD không ghim tay mà dùng tọa độ geocode hoặc
   tâm phường. Thêm nhà cung cấp khác thì phải soát vùng Biển Đông trước.
7. **Quyền riêng tư:** chỉ hỏi vị trí khi ứng viên bấm nút; tọa độ làm tròn 3 chữ số
   (~110 m) trước khi gửi, server làm tròn lại, không lưu; tọa độ GPS không lên URL
   (chỉ sessionStorage), URL chỉ mang slug phường khi gốc là phường/xã.
8. **Header:** `Permissions-Policy` đổi sang `geolocation=(self)`; camera/micro giữ chặn.

## Hệ quả

- Tin cũ cần chạy `refresh_job_coordinates` một lần sau khi deploy (backfill tâm phường
  + xếp hàng geocode địa chỉ).
- Đổi ranh giới hành chính: chạy lại `seed_locations`, `build_location_centroids` với
  bộ GeoJSON mới, xem báo cáo, commit JSON.
- Nếu sau này cần truy vấn hình học phức tạp (đa giác, tuyến đường) mới cân nhắc PostGIS.
- Ngoài phạm vi: lựa chọn "Toàn quốc", job alert theo bán kính, lưu vị trí ứng viên lên
  máy chủ, thời gian di chuyển, tọa độ cho `CompanyOffice`.
