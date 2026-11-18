# Sức khỏe chiến dịch tuyển dụng

## Phạm vi

Tab "Sức khỏe" trong chi tiết chiến dịch, cảnh báo trong chuông thông báo, email
báo cáo tuần và tệp Excel/PDF đều dùng chung một hàm:
`apps.campaigns.services.campaign_health(campaign)`.

- `GET /api/employer/campaigns/<id>/health/`: chỉ số hiện tại + 60 ảnh chụp
  ngày gần nhất cho biểu đồ.
- `GET /api/employer/campaigns/<id>/report/export/?type=xlsx|pdf`: báo cáo tải
  về (tham số tên `type`, vì DRF dành `format` để chọn renderer).

Nguyên tắc: mọi con số tính từ dữ liệu đã ghi nhận (hồ sơ ứng tuyển và mốc thời
gian từng bước, lượt bấm và chi phí của kênh). Chỉ số chưa có mẫu số trả `null`,
giao diện hiện "—", không đoán. Báo cáo chỉ có số liệu tổng hợp, không có dữ liệu
cá nhân ứng viên.

## Đầu vào

Chỉ tính **hồ sơ hiệu lực** (`Application.is_current`) của các tin trong chiến dịch.

| Ký hiệu | Ý nghĩa |
| --- | --- |
| `H` | Chỉ tiêu = tổng `number_of_vacancies` của các tin trong chiến dịch |
| `A` | Số hồ sơ trúng tuyển |
| `N` | Số hồ sơ |
| `D` | Số ngày chạy thật (`campaign_active_seconds`, không tính thời gian tạm dừng) |
| `R` | Số ngày còn lại tới `target_date`; chiến dịch tuyển liên tục dùng 30 ngày |
| `v7` | CV mỗi ngày trong 7 ngày gần nhất = hồ sơ 7 ngày / min(7, D) |

## Dự báo

Tỷ lệ trúng tuyển làm trơn (trung bình Bayes với tiên nghiệm `p0 = 5%`, trọng số
`α = 10` hồ sơ ảo), để chiến dịch mới có ít hồ sơ không bị đoán quá tay:

```
h = (A + α·p0) / (N + α)
```

Hồ sơ đang xử lý được xếp vào bước cao nhất đã đạt (mới, phù hợp, phỏng vấn).
Mỗi bước có xác suất trúng tuyển `p_s`. Mặc định 5% / 20% / 40%; khi chiến dịch
có ít nhất 20 hồ sơ **đã có kết quả** từng qua bước đó thì dùng tỷ lệ của chính
chiến dịch.

```
F = A + Σ open_s · p_s + v7 · R · h
```

Tốc độ cần đạt để kịp chỉ tiêu (khi còn thiếu):

```
v_required = (H − A − Σ open_s · p_s) / (h · R)
```

### Trạng thái

| Trạng thái | Điều kiện (xét theo thứ tự) |
| --- | --- |
| Chưa có chỉ tiêu | `H = 0` |
| Đã đủ chỉ tiêu | `A ≥ H` |
| Chưa đủ dữ liệu | `D < 3` hoặc `N < 5` |
| Đúng tiến độ | `F ≥ H` |
| Có rủi ro | `0,7·H ≤ F < H` |
| Chậm tiến độ | `F < 0,7·H` |

Ví dụ (trùng với test `test_forecast_matches_the_documented_formula`): 10 hồ sơ,
2 trúng tuyển, 8 hồ sơ trong 7 ngày, đang xử lý 3 mới + 1 phù hợp + 2 phỏng vấn,
còn 20 ngày, `H = 3`.
`h = (2 + 0,5) / 20 = 0,125`; `Σ open_s·p_s = 0,15 + 0,2 + 0,8 = 1,15`;
`F = 2 + 1,15 + (8/7)·20·0,125 ≈ 6,0` → đúng tiến độ. Nếu `H = 20` thì chậm tiến
độ, cần `(20 − 2 − 1,15) / (0,125·20) ≈ 6,74` CV/ngày.

## Chỉ số phụ

- **Phản hồi**: trung vị số giờ từ nộp tới lúc NTD mở hồ sơ (30 ngày gần nhất);
  % hồ sơ được xem trong 48 giờ, tính trên hồ sơ đã nộp quá 48 giờ; tồn đọng là
  hồ sơ còn "Đã nộp" quá 48 giờ.
- **Phễu**: số hồ sơ đã tới từng bước (ứng tuyển, đã xem, phù hợp, phỏng vấn,
  trúng tuyển) và % trên tổng hồ sơ.
- **Ngân sách**: đã chi = tổng chi phí nhập theo kênh; `% ngân sách = đã chi /
  budget_max`; `burn_ratio = % ngân sách / % thời gian đã chạy` (chỉ khi chiến
  dịch có cả ngày bắt đầu và kết thúc).

## Cảnh báo

| Mã | Khi nào |
| --- | --- |
| `forecast_at_risk` | Trạng thái "Có rủi ro" hoặc "Chậm tiến độ" |
| `backlog` | Từ 5 hồ sơ chờ xem quá 48 giờ |
| `channel_zero_apply` | Kênh đã đăng từ 5 ngày mà chưa có hồ sơ (kèm số lượt bấm để phân biệt "không ai bấm" với "bấm mà không nộp") |
| `budget_overburn` | `burn_ratio > 1,2` |

Beat `snapshot-campaign-health` chạy mỗi giờ cho chiến dịch đang chạy/tạm dừng,
không bị giữ (policy hold): lưu `CampaignHealthSnapshot` một dòng mỗi ngày VN và
trường `open_alerts` `{mã: {since, notified}}`. Thông báo
`campaign_health_alert` chỉ gửi khi một cảnh báo **mới mở**, và nhắc lại tối đa
7 ngày một lần khi vẫn còn; dedupe key `campaign-health:<id>:<mã>:<ngày>`.
Cảnh báo đã hết thì bị xóa khỏi `open_alerts`, lần sau mở lại sẽ báo ngay.

## Báo cáo

- **Email tuần**: beat `send-campaign-weekly-reports` (mỗi giờ) chỉ gửi từ 08:00
  thứ Hai giờ Việt Nam, một email cho mỗi chiến dịch đang chạy/tạm dừng.
  `CampaignReportDelivery(campaign, week_start)` unique nên chạy lại không gửi
  trùng. NTD tắt được trong Cài đặt thông báo
  (`campaign_weekly_report_email`).
- **Excel** (`openpyxl`): sheet Tổng quan, Phễu, Nguồn và chi phí, Theo ngày (30
  ngày), Tin tuyển dụng.
- **PDF**: template Django tự chứa (biểu đồ cột SVG dựng ở server), in bằng
  Chromium của `apps.cvs.services.pdf_renderer.render_html_pdf`; mọi request
  mạng ngoài `data:` bị chặn.

## Lệch kế hoạch có chủ ý

- Ngưỡng là hằng số trong `services/health.py`, chưa đưa thành site setting.
- PDF xuất đồng bộ (giới hạn 20 lần/giờ mỗi NTD) thay cho hàng đợi `cv-export`
  có hết hạn: báo cáo ngắn, in vài giây, không cần lưu tệp.
- Chưa có huy hiệu sức khỏe ở danh sách chiến dịch (cần tính cho từng dòng).
