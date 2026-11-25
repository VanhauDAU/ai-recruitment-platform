"""Bài trợ giúp cho nhà tuyển dụng, đối chiếu với đặc tả miền NTD, chiến dịch và ProCV Connect."""

FAQ, GUIDE = 'FAQ', 'GUIDE'

ARTICLES = [
    # ── Đăng ký và xác thực doanh nghiệp ──────────────────────────────────────
    {
        'category': 'ntd-dang-ky-va-xac-thuc',
        'slug': 'dang-ky-tai-khoan-nha-tuyen-dung',
        'type': GUIDE,
        'order': 10,
        'title': 'Đăng ký tài khoản nhà tuyển dụng',
        'seo_description': 'Các bước tạo tài khoản nhà tuyển dụng trên ProCV: thông tin bắt buộc, xác thực email và khai báo nhu cầu tuyển dụng.',
        'source_reference': 'docs/01-phan-tich/dac-ta-nha-tuyen-dung.md mục 2; POST /api/employer/register/',
        'body': """<p>Tài khoản nhà tuyển dụng tách biệt với tài khoản ứng viên, kể cả khi dùng cùng email. Bạn đăng ký tại trang dành cho nhà tuyển dụng bằng email hoặc Google.</p>
<h2>Thông tin cần chuẩn bị</h2>
<ul>
  <li>Email công việc và mật khẩu 8–25 ký tự, có chữ hoa, chữ thường và chữ số.</li>
  <li>Họ tên, giới tính, số điện thoại liên hệ và tỉnh/thành nơi làm việc.</li>
  <li>Đồng ý điều khoản sử dụng và chính sách quyền riêng tư (bắt buộc); nhận tin tiếp thị là tùy chọn.</li>
</ul>
<h2>Sau khi đăng ký</h2>
<ol>
  <li><strong>Xác thực email</strong> bằng liên kết ProCV gửi tới hộp thư.</li>
  <li><strong>Khai báo nhu cầu tuyển dụng</strong>: vị trí, cấp bậc, số lượng, thời hạn tuyển hoặc tuyển liên tục, ngân sách dự kiến (tùy chọn).</li>
  <li>Chuyển tới <strong>checklist xác thực nhà tuyển dụng</strong> để mở khóa đăng tin và xem hồ sơ ứng viên.</li>
</ol>
<p>Đăng ký bằng Google sẽ yêu cầu hoàn thiện hồ sơ người liên hệ trước. Đăng ký không tự tạo công ty; bạn chọn hoặc tạo công ty trong checklist.</p>""",
    },
    {
        'category': 'ntd-dang-ky-va-xac-thuc',
        'slug': 'checklist-xac-thuc-nha-tuyen-dung',
        'type': GUIDE,
        'order': 11,
        'title': 'Hoàn thành checklist xác thực nhà tuyển dụng',
        'seo_description': 'Sáu bước xác thực nhà tuyển dụng trên ProCV, giấy tờ cần nộp, cấp tài khoản 0–3 và hạn mức đăng tin tương ứng.',
        'source_reference': 'docs/01-phan-tich/dac-ta-nha-tuyen-dung.md mục 5 và 11; site settings employer_free_job_quota, employer_verified_level_three_job_quota',
        'body': """<p>Trang <strong>Xác thực nhà tuyển dụng</strong> là checklist làm dần, không cần xong trong một lần:</p>
<ol>
  <li>Xác thực số điện thoại bằng mã SMS.</li>
  <li>Chọn công ty có sẵn hoặc tạo công ty mới.</li>
  <li>Nộp giấy tờ: <em>giấy đăng ký doanh nghiệp</em>, hoặc <em>giấy ủy quyền kèm CCCD/hộ chiếu</em> nếu bạn không phải người đại diện. Tệp JPG, PNG hoặc PDF tối đa 5 MB.</li>
  <li>Tải văn bản thỏa thuận xử lý dữ liệu cá nhân giữa ứng viên và nhà tuyển dụng.</li>
  <li>Đồng ý thỏa thuận xử lý dữ liệu (DPA) với nền tảng.</li>
  <li>Đăng tin đầu tiên (được ghi nhận khi tin thực sự công khai).</li>
</ol>
<h2>Thẩm định hồ sơ</h2>
<ul>
  <li>Mọi tệp được quét an toàn trước khi lưu. Quản trị viên duyệt từng giấy tờ, sau đó ra quyết định cho cả hồ sơ.</li>
  <li>Hồ sơ có thể được duyệt, yêu cầu bổ sung hoặc từ chối. Sau 3 lần bị từ chối cuối cùng, bạn cần quản trị viên mở khóa mới nộp lại được.</li>
</ul>
<h2>Cấp tài khoản và hạn mức đăng tin</h2>
<table>
  <thead><tr><th>Cấp</th><th>Điều kiện</th></tr></thead>
  <tbody>
    <tr><td>0</td><td>Chưa xác thực email</td></tr>
    <tr><td>1</td><td>Đã xác thực email</td></tr>
    <tr><td>2</td><td>Thêm số điện thoại đã xác minh và giấy tờ đã được duyệt</td></tr>
    <tr><td>3</td><td>Hồ sơ xác thực được duyệt cho đúng công ty</td></tr>
  </tbody>
</table>
<p>Hạn mức tính trên số tin từng được đăng công khai: mặc định 3 tin, nâng lên 100 tin khi đạt Cấp 3 và DPA còn hiệu lực.</p>""",
    },
    {
        'category': 'ntd-dang-ky-va-xac-thuc',
        'slug': 'xac-minh-so-dien-thoai-bang-sms',
        'type': FAQ,
        'order': 12,
        'title': 'Xác minh số điện thoại nhà tuyển dụng bằng SMS thế nào?',
        'seo_description': 'Quy tắc xác minh số điện thoại bằng mã OTP qua SMS cho nhà tuyển dụng ProCV: số hợp lệ, thời gian chờ, hạn mã và số lần nhập.',
        'source_reference': 'docs/01-phan-tich/dac-ta-nha-tuyen-dung.md mục 7',
        'body': """<ul>
  <li>Chỉ nhận số di động Việt Nam. Bạn nhập lại mật khẩu trước khi ProCV gửi mã.</li>
  <li>Mã có hiệu lực 10 phút; mỗi lần gửi lại phải cách nhau 60 giây, và mã mới làm mã cũ mất hiệu lực.</li>
  <li>Nhập sai quá 5 lần thì cần yêu cầu mã mới.</li>
  <li>Tài khoản tạo bằng Google cần đặt mật khẩu đăng nhập trước khi xác minh số điện thoại.</li>
  <li>Khi đổi số, số cũ vẫn giữ hiệu lực cho tới khi số mới xác minh thành công.</li>
</ul>
<p>Không chia sẻ mã OTP cho bất kỳ ai, kể cả người tự nhận là nhân viên ProCV.</p>""",
    },
    {
        'category': 'ntd-dang-ky-va-xac-thuc',
        'slug': 'chon-hoac-tao-cong-ty',
        'type': FAQ,
        'order': 13,
        'title': 'Chọn công ty có sẵn hay tạo công ty mới?',
        'seo_description': 'Cách liên kết tài khoản nhà tuyển dụng với công ty trên ProCV: yêu cầu tham gia, tạo công ty mới, quyền quản lý và thành viên.',
        'source_reference': 'backend/apps/employers/models/membership.py (CompanyJoinRequest); docs/01-phan-tich/dac-ta-nha-tuyen-dung.md mục 3',
        'body': """<p>Tìm công ty theo tên, tên thương mại hoặc mã số thuế trước khi tạo mới để tránh trùng.</p>
<ul>
  <li><strong>Tham gia công ty có sẵn</strong>: bạn gửi yêu cầu tham gia, yêu cầu có hiệu lực khi quản lý công ty duyệt. Nếu công ty chưa có quản lý đủ điều kiện, quản trị viên ProCV duyệt thay.</li>
  <li><strong>Tạo công ty mới</strong>: bạn trở thành quản lý công ty ngay.</li>
  <li>Đã liên kết thì không tự đổi sang công ty khác được. Chọn nhầm, hãy liên hệ hỗ trợ.</li>
</ul>
<h2>Quản lý và thành viên</h2>
<ul>
  <li>Chỉ quản lý công ty tải logo, ảnh bìa và thư viện ảnh.</li>
  <li>Sau khi công ty đã có hồ sơ xác thực, mọi thay đổi thông tin công ty đi qua yêu cầu cập nhật để quản trị viên thẩm định.</li>
  <li>Tin, chiến dịch và hồ sơ ứng tuyển thuộc về người tạo; thành viên cùng công ty không xem dữ liệu tuyển dụng của nhau.</li>
</ul>""",
    },
    {
        'category': 'ntd-dang-ky-va-xac-thuc',
        'slug': 'dau-xac-thuc-tren-tin-tuyen-dung',
        'type': FAQ,
        'order': 14,
        'title': 'Làm sao để tin tuyển dụng có dấu xác thực?',
        'seo_description': 'Dấu xác thực trên tin tuyển dụng ProCV cần đủ năm điều kiện, trong đó có tên miền email công ty xác minh qua bản ghi DNS.',
        'source_reference': 'docs/01-phan-tich/dac-ta-nha-tuyen-dung.md mục 5.4; site setting employer_badge_min_account_months',
        'body': """<p>Dấu xác thực giúp ứng viên tin tưởng tin của bạn. Dấu chỉ bật khi đủ cả năm điều kiện:</p>
<ol>
  <li>Email công việc của bạn thuộc tên miền công ty đã được xác minh.</li>
  <li>Số điện thoại đã xác minh.</li>
  <li>Hồ sơ xác thực đã được duyệt cùng bộ giấy tờ hiện hành.</li>
  <li>Tài khoản đủ thời gian hoạt động tối thiểu (mặc định 6 tháng).</li>
  <li>Không có báo cáo vi phạm nào bị xác nhận.</li>
</ol>
<h2>Xác minh tên miền</h2>
<p>Thêm bản ghi TXT <code>_procv-verification.&lt;tên-miền&gt;</code> theo giá trị ProCV cung cấp vào DNS của tên miền công ty. Hệ thống kiểm tra lại định kỳ 30 ngày một lần; gỡ bản ghi thì dấu sẽ mất sau thời gian ân hạn.</p>
<p>Cấp tài khoản, dấu xác thực và hạn mức đăng tin là ba chính sách riêng: đạt cấp 3 chưa chắc đã có dấu.</p>""",
    },
    # ── Đăng tin tuyển dụng và hậu kiểm ───────────────────────────────────────
    {
        'category': 'ntd-dang-tin-tuyen-dung',
        'slug': 'dang-tin-va-dieu-kien-cong-khai',
        'type': GUIDE,
        'order': 10,
        'title': 'Đăng tin tuyển dụng và điều kiện để tin công khai',
        'seo_description': 'Tin trên ProCV công khai ngay khi đăng nếu tài khoản đủ điều kiện. Xem trường bắt buộc, cam kết chịu trách nhiệm và lý do bị chặn.',
        'source_reference': 'docs/01-phan-tich/dac-ta-chien-dich-va-tin-tuyen-dung.md mục 3–4; docs/adr/adr-0014-job-post-moderation.md',
        'body': """<p>ProCV áp dụng <strong>hậu kiểm</strong>: tin hiển thị với ứng viên ngay khi bạn đăng, quản trị viên xử lý sau nếu có báo cáo hoặc phát hiện vi phạm.</p>
<h2>Lưu nháp và đăng</h2>
<ul>
  <li><strong>Lưu nháp</strong> không cần đủ thông tin và không tính vào hạn mức.</li>
  <li><strong>Đăng tin</strong> cần đủ: tiêu đề, mô tả, yêu cầu, quyền lợi, cấp bậc, loại công việc, hình thức làm việc, học vấn, kinh nghiệm, mức lương, số lượng, địa điểm, vị trí chuyên môn chính, hạn nhận hồ sơ và người nhận hồ sơ (họ tên, điện thoại, email).</li>
  <li>Mỗi lần đưa tin lên công khai, bạn xác nhận <strong>cam kết chịu trách nhiệm</strong> về nội dung tin.</li>
</ul>
<h2>Vì sao tin vẫn ở trạng thái nháp?</h2>
<ul>
  <li>Hồ sơ xác thực chưa được duyệt cho đúng công ty của tin.</li>
  <li>Thỏa thuận DPA chưa còn hiệu lực.</li>
  <li>Tài khoản đang bị tạm giữ do tuân thủ.</li>
  <li>Tin thuộc một chiến dịch chưa chạy.</li>
  <li>Đã dùng hết hạn mức đăng tin.</li>
</ul>
<p>Sửa tin đang tuyển có hiệu lực ngay và không làm thay đổi thứ tự hiển thị. Tin chưa từng đăng mới được xóa; tin đã đăng thì đóng hoặc sao chép thành nháp mới.</p>""",
    },
    {
        'category': 'ntd-dang-tin-tuyen-dung',
        'slug': 'tao-ban-nhap-tin-bang-ai',
        'type': GUIDE,
        'order': 11,
        'title': 'Tạo bản nháp tin tuyển dụng bằng AI',
        'seo_description': 'Dùng AI để viết bản nháp tin tuyển dụng từ brief hoặc chuẩn hóa JD có sẵn. Nội dung AI chỉ là gợi ý, không tự lưu hay tự đăng.',
        'source_reference': 'backend/apps/jobs/models/ai_generation.py; docs/07-algorithms/ai-tao-tin-tuyen-dung.md',
        'body': """<p>Trong form đăng tin, bảng <strong>Tạo tin tuyển dụng bằng AI</strong> có hai cách:</p>
<ul>
  <li><strong>Từ brief có hướng dẫn</strong>: nhập vị trí, trách nhiệm, yêu cầu, kỹ năng ưu tiên và quyền lợi (mỗi ý một dòng, tối đa 10 ý, mỗi ý 120 ký tự) cùng ghi chú văn phong.</li>
  <li><strong>Từ JD có sẵn</strong>: dán nội dung mô tả công việc để AI chuẩn hóa vào các trường của form. Thông tin liên hệ được loại bỏ trước khi gửi tới nhà cung cấp AI.</li>
</ul>
<h2>Những gì AI không điền</h2>
<p>Lương, địa điểm, lịch làm việc, hạn nộp, số lượng tuyển, chiến dịch, người nhận hồ sơ, tự động từ chối, yêu cầu giới tính và độ tuổi luôn do bạn tự nhập.</p>
<h2>Kiểm tra trước khi đăng</h2>
<ul>
  <li>Nội dung AI <strong>không bao giờ tự lưu hoặc tự đăng</strong>. Hãy đọc lại từng trường.</li>
  <li>Hệ thống tự loại quyền lợi không có căn cứ trong JD hoặc hồ sơ công ty đã duyệt, và các giá trị danh mục không hợp lệ.</li>
  <li>Không nhập dữ liệu ứng viên hay thông tin cá nhân nhạy cảm vào brief.</li>
</ul>
<p>Nếu AI lỗi hoặc quá tải, brief vẫn được giữ để bạn thử lại hoặc chuyển sang nhập thủ công.</p>""",
    },
    {
        'category': 'ntd-dang-tin-tuyen-dung',
        'slug': 'han-nop-thoi-gian-hien-thi-va-gia-han',
        'type': FAQ,
        'order': 12,
        'title': 'Hạn nhận hồ sơ, thời gian hiển thị và gia hạn tin hoạt động ra sao?',
        'seo_description': 'Phân biệt hạn nhận hồ sơ và chu kỳ hiển thị của tin trên ProCV, quy tắc gia hạn, đóng, mở lại và vì sao không có nút làm mới tin.',
        'source_reference': 'docs/01-phan-tich/dac-ta-chien-dich-va-tin-tuyen-dung.md mục 6; docs/adr/adr-0030-fair-job-listing.md',
        'body': """<ul>
  <li><strong>Hạn nhận hồ sơ</strong>: tính theo giờ Việt Nam, tối đa 90 ngày kể từ hôm nay (gợi ý 30 ngày).</li>
  <li><strong>Chu kỳ hiển thị</strong>: bắt đầu từ lần đăng đầu, mặc định 30 ngày, tối đa 90 ngày. Tin chỉ công khai khi còn trong chu kỳ và còn hạn nộp.</li>
  <li><strong>Gia hạn</strong>: không rút ngắn hạn; tin đã hết hạn chỉ gia hạn được trong 30 ngày sau hạn cũ; tổng thời gian công khai không quá 90 ngày kể từ lần đăng đầu.</li>
  <li><strong>Đóng và mở lại</strong>: tin đóng có thể mở lại với hạn mới, cần xác nhận cam kết như khi đăng.</li>
</ul>
<h2>Thứ tự hiển thị</h2>
<p>Tin xếp theo thời điểm đăng công khai lần đầu. Sửa, gia hạn hay mở lại không đẩy tin lên đầu, và ProCV không có gói HOT/VIP. Muốn đăng lại như tin mới, hãy sao chép tin thành nháp rồi đăng (tính một lượt trong hạn mức).</p>""",
    },
    {
        'category': 'ntd-dang-tin-tuyen-dung',
        'slug': 'tin-bi-tam-an-va-cach-xu-ly',
        'type': FAQ,
        'order': 13,
        'title': 'Tin của tôi bị tạm ẩn, phải làm gì?',
        'seo_description': 'Các lý do khiến tin tuyển dụng trên ProCV bị ẩn: hậu kiểm vi phạm, chiến dịch tạm dừng, tài khoản bị giữ do xác thực hoặc DPA.',
        'source_reference': 'docs/01-phan-tich/dac-ta-chien-dich-va-tin-tuyen-dung.md mục 5 và 8; docs/01-phan-tich/dac-ta-nha-tuyen-dung.md mục 5.3',
        'body': """<p>Trang chi tiết tin cho biết loại tạm ẩn, thời điểm và nhóm lý do. Các trường hợp thường gặp:</p>
<ul>
  <li><strong>Hậu kiểm của quản trị viên</strong>: tin bị ẩn để xem xét hoặc do vi phạm đã xác nhận. Tin bị giữ không sửa, gia hạn, mở lại hay sao chép được cho tới khi quản trị viên khôi phục.</li>
  <li><strong>Chiến dịch tạm dừng</strong>: mọi tin của chiến dịch tạm biến mất với ứng viên; mở lại chiến dịch thì tin còn hạn tự hiển thị lại.</li>
  <li><strong>Hồ sơ xác thực bị thu hồi hoặc hết hạn</strong>: tin công khai bị ẩn, dữ liệu ứng viên bị khóa; duyệt lại hồ sơ thì tin tự hiện lại.</li>
  <li><strong>DPA quá hạn</strong>: đồng ý phiên bản DPA hiện hành để gỡ trạng thái giữ.</li>
  <li><strong>Hết hạn</strong>: tin quá hạn nộp hoặc hết chu kỳ hiển thị; hãy gia hạn nếu còn trong giới hạn.</li>
</ul>
<p>Cần trao đổi thêm về quyết định hậu kiểm, hãy liên hệ hỗ trợ và ghi mã tin.</p>""",
    },
    # ── Chiến dịch tuyển dụng và mạng xã hội ──────────────────────────────────
    {
        'category': 'ntd-chien-dich-va-mang-xa-hoi',
        'slug': 'tao-va-kich-hoat-chien-dich',
        'type': GUIDE,
        'order': 10,
        'title': 'Tạo và kích hoạt chiến dịch tuyển dụng',
        'seo_description': 'Chiến dịch là một đợt tuyển gồm nhiều tin. Thiết lập thời gian, ngân sách, chọn tin, rồi kích hoạt ngay hoặc lên lịch trên ProCV.',
        'source_reference': 'docs/01-phan-tich/dac-ta-chien-dich-va-tin-tuyen-dung.md mục 2; docs/adr/adr-0020-campaign-lifecycle-and-distribution.md',
        'body': """<p>Chiến dịch là một <strong>đợt tuyển</strong> gồm khoảng thời gian, ngân sách và nhiều tin, mỗi tin một vị trí với số lượng riêng. Chỉ tiêu của chiến dịch là tổng số người cần tuyển của các tin.</p>
<h2>Các bước thiết lập</h2>
<ol>
  <li><strong>Thông tin</strong>: ngày bắt đầu, ngày kết thúc hoặc tuyển liên tục, ngân sách và ghi chú.</li>
  <li><strong>Tin tuyển dụng</strong>: chọn tin nháp để đăng khi kích hoạt, hoặc tin đang hiển thị để gắn vào chiến dịch. Có thể tạo tin mới ngay từ bước này.</li>
  <li><strong>Kênh phân phối</strong> (không bắt buộc): thêm nơi bạn sẽ đăng tuyển.</li>
  <li><strong>Xem lại &amp; kích hoạt</strong>: checklist cho biết còn bao nhiêu việc trước khi kích hoạt và dẫn về đúng bước cần sửa.</li>
</ol>
<h2>Kích hoạt</h2>
<ul>
  <li><strong>Kích hoạt ngay</strong>: đăng mọi tin nháp đã chọn và gắn các tin còn lại. Một tin lỗi thì không có gì thay đổi.</li>
  <li><strong>Lên lịch</strong>: chiến dịch tự chạy vào ngày bắt đầu.</li>
</ul>
<p>Tạm dừng chiến dịch sẽ ẩn các tin của nó; hoàn tất hoặc hủy sẽ đóng hẳn các tin. Hệ thống tự hoàn tất chiến dịch sau ngày kết thúc và nhắc bạn trước 3 ngày.</p>""",
    },
    {
        'category': 'ntd-chien-dich-va-mang-xa-hoi',
        'slug': 'kenh-phan-phoi-link-theo-doi-va-nguon-ho-so',
        'type': GUIDE,
        'order': 11,
        'title': 'Kênh phân phối, link theo dõi và nguồn hồ sơ',
        'seo_description': 'Mỗi kênh chiến dịch có link theo dõi và mã QR riêng để biết hồ sơ đến từ đâu, chi phí trên mỗi hồ sơ và kênh nào hiệu quả nhất.',
        'source_reference': 'docs/01-phan-tich/dac-ta-chien-dich-va-tin-tuyen-dung.md mục 2 (Phân phối đa kênh)',
        'body': """<p>Mỗi <strong>kênh</strong> là một nơi bạn đăng tuyển: Fanpage, nhóm Facebook, LinkedIn, Zalo, email, website công ty, tờ rơi có mã QR…</p>
<h2>Link theo dõi</h2>
<ul>
  <li>Mỗi kênh có mã riêng, từ đó tạo link tới trang tuyển dụng của chiến dịch, tới một tin cụ thể hoặc tới trang công ty. Link nào cũng tải được mã QR.</li>
  <li>Lượt bấm được đếm theo kênh và ngày mà không dùng cookie hay lưu địa chỉ IP.</li>
</ul>
<h2>Soạn bài đăng</h2>
<ul>
  <li>Chọn tin đưa vào bài và nơi link dẫn tới, rồi bấm <strong>Soạn bằng AI</strong> hoặc tự viết. Nội dung theo văn phong từng loại kênh và chỉ dùng dữ liệu công khai của tin.</li>
  <li>Sao chép nội dung đã chèn sẵn link, đăng tay rồi đánh dấu <strong>Đã đăng</strong>.</li>
  <li>Nhập chi phí theo kênh (quảng cáo, in ấn) để tính chi phí trên mỗi hồ sơ.</li>
</ul>
<h2>Đọc hiệu quả</h2>
<p>Tab <strong>Kênh &amp; nguồn</strong> so sánh người bấm, hồ sơ, tỷ lệ nộp, trúng tuyển và chi phí của từng kênh. Ở mỗi hồ sơ, bạn thấy dòng <em>Nguồn hồ sơ</em> cho biết ứng viên đến từ kênh nào hay từ nguồn tự nhiên.</p>""",
    },
    {
        'category': 'ntd-chien-dich-va-mang-xa-hoi',
        'slug': 'ket-noi-mang-xa-hoi-va-tu-dong-dang-bai',
        'type': GUIDE,
        'order': 12,
        'title': 'Kết nối mạng xã hội để tự động đăng bài tuyển dụng',
        'seo_description': 'Kết nối Fanpage Facebook, Instagram, Threads hoặc LinkedIn với ProCV để hẹn giờ đăng bài chiến dịch, tự thử lại và tự gỡ khi kết thúc.',
        'source_reference': 'docs/adr/adr-0021-campaign-facebook-page.md; docs/adr/adr-0025-campaign-social-networks.md',
        'body': """<p>ProCV có thể tự đăng bài của kênh chiến dịch lên <strong>Fanpage Facebook</strong>, <strong>Instagram</strong> (tài khoản doanh nghiệp, kết nối qua Facebook), <strong>Threads</strong> và <strong>LinkedIn</strong> (trang cá nhân).</p>
<h2>Kết nối tài khoản</h2>
<ol>
  <li>Vào <strong>Cài đặt tài khoản › Kết nối mạng xã hội</strong>.</li>
  <li>Chọn mạng, đăng nhập và cấp quyền trên trang của mạng xã hội đó, rồi chọn trang hoặc tài khoản muốn dùng.</li>
  <li>ProCV chỉ lưu mã truy cập đã mã hóa. Ngắt kết nối sẽ hủy các bài đang hẹn trên tài khoản đó.</li>
</ol>
<h2>Hẹn đăng và vòng đời bài</h2>
<ul>
  <li>Trong kênh tương ứng, chọn đăng ngay hoặc hẹn giờ; nội dung lấy từ bài đã soạn kèm link theo dõi và sửa được trước khi hẹn.</li>
  <li>Lỗi tạm thời được thử lại tự động; đăng thành công thì kênh tự chuyển <em>Đã đăng</em> kèm link bài.</li>
  <li>Tạm dừng chiến dịch: bài hẹn chuyển <em>Hoãn</em>, bài đã đăng giữ nguyên. Hoàn tất hoặc hủy: bài đã đăng được gỡ; nếu mạng không cho gỡ, bạn nhận thông báo kèm link để tự gỡ.</li>
  <li>Kết nối hết hạn thì bạn được báo để kết nối lại; trong lúc đó kênh quay về chế độ sao chép và đăng tay.</li>
</ul>""",
    },
    # ── Hồ sơ ứng viên và AI xếp hạng ─────────────────────────────────────────
    {
        'category': 'ntd-ho-so-ung-vien-va-ai',
        'slug': 'xu-ly-ho-so-va-hoan-tac-quyet-dinh',
        'type': GUIDE,
        'order': 10,
        'title': 'Xử lý hồ sơ ứng tuyển và hoàn tác quyết định',
        'seo_description': 'Các trạng thái hồ sơ trên ProCV, cách chuyển trạng thái, cửa sổ hoàn tác 15 giây trước khi ứng viên được báo và tự động từ chối.',
        'source_reference': 'docs/01-phan-tich/dac-ta-chien-dich-va-tin-tuyen-dung.md mục 7; site setting candidate_status_notify_delay_seconds; ADR-0028',
        'body': """<table>
  <thead><tr><th>Nhà tuyển dụng thấy</th><th>Ứng viên thấy</th></tr></thead>
  <tbody>
    <tr><td>Mới</td><td>Đã nộp hồ sơ</td></tr>
    <tr><td>Đã xem</td><td>Nhà tuyển dụng đã xem hồ sơ</td></tr>
    <tr><td>Phù hợp</td><td>Hồ sơ phù hợp</td></tr>
    <tr><td>Phỏng vấn</td><td>Mời phỏng vấn</td></tr>
    <tr><td>Trúng tuyển</td><td>Trúng tuyển</td></tr>
    <tr><td>Không phù hợp</td><td>Chưa phù hợp</td></tr>
  </tbody>
</table>
<ul>
  <li>Mở CV lần đầu tự chuyển <em>Mới</em> sang <em>Đã xem</em>. Bạn được bỏ qua bước nhưng không lùi trạng thái.</li>
  <li><strong>Trúng tuyển</strong> và <strong>Không phù hợp</strong> là kết quả cuối, cần xác nhận.</li>
  <li>Sau mỗi quyết định, bạn có khoảng <strong>15 giây</strong> (theo cấu hình hệ thống) để hoàn tác trước khi ứng viên được báo. Bấm nhanh nhiều trạng thái thì ứng viên chỉ nhận trạng thái cuối.</li>
  <li>Điểm đánh giá 1–5 và ghi chú nội bộ không bao giờ hiển thị với ứng viên.</li>
</ul>
<h2>Tự động từ chối</h2>
<p>Trong tin, bạn có thể bật tự động từ chối hồ sơ không được xử lý sau 14, 21, 28, 42 hoặc 56 ngày. Bạn được nhắc 3 ngày trước đó; hồ sơ đã có lịch phỏng vấn không bị tự từ chối.</p>""",
    },
    {
        'category': 'ntd-ho-so-ung-vien-va-ai',
        'slug': 'ai-xep-hang-ho-so-phu-hop-nhat',
        'type': GUIDE,
        'order': 11,
        'title': 'Sắp xếp hồ sơ theo mức phù hợp bằng AI',
        'seo_description': 'Dùng sắp xếp Phù hợp nhất và nút Xem vì sao để đọc điểm AI của từng hồ sơ, gồm kỹ năng khớp, còn thiếu và câu trích từ CV.',
        'source_reference': 'frontend/messages shared fit_*, employer-workspace employer_workspace_match_*; docs/07-algorithms/thuat-toan-ai.md',
        'body': """<p>Khi ứng viên đồng ý phân tích AI lúc nộp hồ sơ, ProCV chấm mức phù hợp giữa bản CV đã nộp và tin bằng mô hình AI tự vận hành.</p>
<h2>Xem và sắp xếp</h2>
<ul>
  <li>Cột <strong>Phù hợp</strong> hiện chip điểm trên 100 kèm mức: <em>Chưa phù hợp</em>, <em>Tương đối phù hợp</em>, <em>Phù hợp</em>, <em>Rất phù hợp</em>.</li>
  <li>Danh sách mặc định xếp hồ sơ mới nhất; chọn <strong>Phù hợp nhất</strong> để xếp theo điểm, lựa chọn này được nhớ cho lần sau.</li>
  <li>Bấm <strong>Xem vì sao</strong> để mở chi tiết: kỹ năng có trong CV kèm câu trích nguyên văn, kỹ năng còn thiếu, kinh nghiệm, học vấn, cấp bậc, ngoại ngữ.</li>
</ul>
<h2>Cách tính điểm</h2>
<p>Kỹ năng 40%, kinh nghiệm 30%, học vấn 10%, cấp bậc 10%, ngoại ngữ 10%; tiêu chí tin không yêu cầu hoặc CV không ghi thì không tính. CV khác lĩnh vực chỉ được tính một phần ở học vấn, cấp bậc và ngoại ngữ.</p>
<h2>Các nhãn đặc biệt</h2>
<ul>
  <li><em>Đang phân tích</em>: điểm sẽ hiện sau ít phút.</li>
  <li><em>Không tham gia AI</em>: ứng viên không đồng ý phân tích; hồ sơ vẫn hợp lệ, hãy đọc CV gốc.</li>
  <li><em>Chưa chấm được</em>: không đọc được nội dung CV hoặc tin.</li>
</ul>
<blockquote>Điểm chỉ để tham khảo. Hệ thống không tự loại hồ sơ nào; quyết định là của bạn.</blockquote>""",
    },
    {
        'category': 'ntd-ho-so-ung-vien-va-ai',
        'slug': 'tim-cv-va-moi-ung-vien-ket-noi',
        'type': GUIDE,
        'order': 12,
        'title': 'Tìm CV và mời ứng viên kết nối',
        'seo_description': 'Tìm ứng viên đang cho phép nhà tuyển dụng tìm kiếm, xếp theo mức phù hợp với một tin đang tuyển, lọc theo kỹ năng và gửi lời mời kết nối.',
        'source_reference': 'frontend/messages employer-workspace employer_workspace_search_*; route /candidate-search; AccessChannel.RECRUITER_SEARCH',
        'body': """<p><strong>Tìm CV</strong> giúp bạn chủ động tìm ứng viên trong số những người đã bật một CV cho phép nhà tuyển dụng tìm kiếm.</p>
<ol>
  <li>Chọn một <strong>tin đang tuyển</strong> làm mốc. Hệ thống xếp ứng viên theo mức phù hợp với tin đó.</li>
  <li>Thu hẹp bằng bộ lọc: từ khóa (có tất cả, có một trong, không có), tỉnh/thành muốn làm việc, ngành nghề mong muốn, ngoại ngữ, số năm kinh nghiệm, học vấn, chức danh hiện tại, trường đã học.</li>
  <li>Mở xem nhanh hồ sơ trích xuất: kinh nghiệm, dự án, học vấn, kỹ năng và số kỹ năng trùng với tin.</li>
  <li>Bấm mời để gửi <strong>lời mời kết nối</strong> về tin đang chọn; có thể chọn nhiều ứng viên và mời một lần.</li>
</ol>
<h2>Quyền riêng tư của ứng viên</h2>
<ul>
  <li>Hồ sơ ẩn danh: không có họ tên, ảnh, liên hệ hay tệp CV.</li>
  <li>Ứng viên đồng ý lời mời thì bạn nhắn tin được qua ProCV Connect; danh tính chỉ hiện khi họ ứng tuyển.</li>
  <li>Ứng viên từ chối thì bạn không mời lại được cho cùng tin.</li>
</ul>
<p>Tìm CV dùng cổng dữ liệu ứng viên: tài khoản cần được xác thực và DPA còn hiệu lực.</p>""",
    },
    {
        'category': 'ntd-ho-so-ung-vien-va-ai',
        'slug': 'kho-ung-vien-danh-sach-den-va-moi-danh-gia',
        'type': FAQ,
        'order': 13,
        'title': 'Kho ứng viên, danh sách đen và mời đánh giá nội bộ dùng thế nào?',
        'seo_description': 'Lưu ứng viên tiềm năng, chặn ứng viên có thời hạn và mời trưởng bộ phận đánh giá CV bằng link có hạn trên ProCV.',
        'source_reference': 'docs/01-phan-tich/dac-ta-chien-dich-va-tin-tuyen-dung.md mục 7',
        'body': """<h2>Kho ứng viên tiềm năng</h2>
<ul>
  <li>Lưu ứng viên kèm ghi chú và nhãn; ứng viên được báo và có thể rút khỏi kho. Mục lưu hết hạn sau 12 tháng.</li>
  <li>Khi chọn một tin mới, hệ thống xếp người trong kho theo độ tương đồng giữa tin họ từng nộp và tin mới, kèm lý do; bạn mời ứng tuyển được một lần cho mỗi tin.</li>
</ul>
<h2>Danh sách đen</h2>
<ul>
  <li>Chặn ứng viên kèm lý do, thời hạn 30, 90, 180 ngày hoặc vô thời hạn; có thể từ chối luôn các hồ sơ đang chờ.</li>
  <li>Danh sách áp dụng cho cả công ty. Ứng viên bị chặn chỉ thấy thông báo chung và không nộp được vào tin của công ty.</li>
  <li>Hệ thống cảnh báo khi một ứng viên nộp từ 5 tin của bạn trở lên trong 14 ngày.</li>
</ul>
<h2>Mời đánh giá nội bộ</h2>
<p>Tạo link có hạn từ 3 đến 30 ngày cho người không có tài khoản, ví dụ trưởng bộ phận. Họ xem CV đã ẩn thông tin liên hệ và ảnh, rồi gửi phiếu gồm đề xuất, điểm 1–5, điểm mạnh và băn khoăn. Bạn thu hồi link bất cứ lúc nào và xem tổng hợp phiếu trong workspace.</p>""",
    },
    # ── ProCV Connect ─────────────────────────────────────────────────────────
    {
        'category': 'ntd-procv-connect',
        'slug': 'bat-dau-nhan-tin-voi-ung-vien',
        'type': GUIDE,
        'order': 10,
        'title': 'Bắt đầu nhắn tin với ứng viên trên ProCV Connect',
        'seo_description': 'Ai được mở trò chuyện, gửi được nội dung gì và các quy tắc khóa, chặn, bàn giao tin trong ProCV Connect dành cho nhà tuyển dụng.',
        'source_reference': 'docs/01-phan-tich/dac-ta-procv-connect.md mục 3–4; docs/adr/adr-0032-procv-connect-messaging.md',
        'body': """<p>Bấm <strong>ProCV Connect</strong> trên thanh đầu trang của workspace để mở hộp thư. Mỗi cuộc trò chuyện gắn với một cặp tin tuyển dụng – ứng viên.</p>
<h2>Khi nào được mở trò chuyện?</h2>
<ul>
  <li>Bạn là người phụ trách tin, và ứng viên đã nộp hồ sơ vào tin hoặc đã đồng ý lời mời kết nối về tin đó.</li>
  <li>Tài khoản đã được xác thực và DPA còn hiệu lực; điều kiện này được kiểm ở mọi thao tác, không chỉ lúc mở.</li>
  <li>Mở từ panel hồ sơ ứng tuyển, từ Tìm CV hoặc danh sách ứng viên đã kết nối.</li>
</ul>
<h2>Gửi được gì?</h2>
<ul>
  <li>Tin nhắn chữ tối đa 2.000 ký tự, emoji, thẻ tin tuyển dụng khác của công ty.</li>
  <li>Tệp PDF, DOCX, PNG, JPG, WEBP tối đa 10 MB.</li>
  <li>Lịch hẹn phỏng vấn.</li>
</ul>
<h2>Các quy tắc cần biết</h2>
<ul>
  <li>Đổi trạng thái hồ sơ không sinh tin nhắn hệ thống; ứng viên đã được báo qua chuông.</li>
  <li>Hồ sơ đã được báo <em>Không phù hợp</em> thì cuộc trò chuyện chỉ còn đọc; <em>Trúng tuyển</em> vẫn nhắn được để trao đổi ngày đi làm.</li>
  <li>Công ty chặn ứng viên thì mọi cuộc trò chuyện với ứng viên đó bị khóa.</li>
  <li>Bàn giao tin cho đồng nghiệp thì người phụ trách mới tiếp quản ngay, lịch sử giữ nguyên.</li>
  <li>Quản trị viên không có màn hình đọc nội dung hội thoại.</li>
</ul>""",
    },
    {
        'category': 'ntd-procv-connect',
        'slug': 'dat-lich-phong-van-qua-procv-connect',
        'type': GUIDE,
        'order': 11,
        'title': 'Đặt lịch phỏng vấn qua ProCV Connect',
        'seo_description': 'Gửi lịch phỏng vấn ngay trong cuộc trò chuyện, xử lý khi ứng viên xin đổi giờ, nhận lời nhắc và ra kết quả sau buổi hẹn.',
        'source_reference': 'docs/01-phan-tich/dac-ta-procv-connect.md mục 6; site setting interview_decision_reminder_days',
        'body': """<ol>
  <li>Trong cuộc trò chuyện, chọn gửi lịch hẹn.</li>
  <li>Nhập thời điểm bắt đầu (trong tương lai), thời lượng, hình thức trực tiếp, online hoặc điện thoại, địa điểm hoặc link họp và ghi chú.</li>
  <li>Gửi lịch. Hồ sơ đang <em>Mới</em>, <em>Đã xem</em> hoặc <em>Phù hợp</em> tự chuyển sang <em>Phỏng vấn</em> và ứng viên được báo ngay.</li>
</ol>
<h2>Phản hồi của ứng viên</h2>
<ul>
  <li><strong>Chấp nhận</strong>: hai bên nhận email kèm tệp <code>.ics</code>; hệ thống nhắc trước 24 giờ và 1 giờ.</li>
  <li><strong>Từ chối</strong> hoặc <strong>đề nghị giờ khác</strong>: thẻ lịch có nút <strong>Đổi giờ</strong> điền sẵn thông tin cũ và ghi chú của ứng viên.</li>
</ul>
<p>Bạn có thể đổi giờ hoặc hủy trước giờ hẹn. Sau giờ hẹn, thẻ ghi <em>Đã diễn ra</em> và có sẵn nút <strong>Trúng tuyển</strong> / <strong>Không phù hợp</strong>. Nếu chưa ra kết quả sau số ngày cấu hình (mặc định 3), bạn nhận lời nhắc một lần; hồ sơ đã phỏng vấn không bị tự từ chối.</p>""",
    },
    # ── DPA và Nghị định 13 ───────────────────────────────────────────────────
    {
        'category': 'ntd-du-lieu-ca-nhan-va-dpa',
        'slug': 'hai-loai-thoa-thuan-du-lieu-ca-nhan',
        'type': GUIDE,
        'order': 10,
        'title': 'Hai loại thỏa thuận dữ liệu cá nhân nhà tuyển dụng cần hoàn thành',
        'seo_description': 'Phân biệt văn bản xử lý dữ liệu cá nhân ứng viên – nhà tuyển dụng và DPA với nền tảng ProCV theo Nghị định 13/2023/NĐ-CP.',
        'source_reference': 'docs/01-phan-tich/dac-ta-nha-tuyen-dung.md mục 6; Nghị định 13/2023/NĐ-CP',
        'body': """<p>Hồ sơ ứng viên chứa nhiều dữ liệu cá nhân, nên Nghị định 13/2023/NĐ-CP yêu cầu việc xử lý phải có căn cứ và đúng mục đích. Trên ProCV, nhà tuyển dụng hoàn thành hai mốc độc lập tại trang <strong>Bảo vệ dữ liệu cá nhân</strong> trong cài đặt tài khoản.</p>
<h2>1. Văn bản xử lý dữ liệu cá nhân ứng viên – nhà tuyển dụng</h2>
<ul>
  <li>Văn bản thể hiện việc ứng viên đồng ý cho nhà tuyển dụng thu thập, lưu trữ và sử dụng dữ liệu cá nhân cho mục đích tuyển dụng.</li>
  <li>Tải lên tệp DOCX hoặc PDF tối đa 5 MB; quản trị viên duyệt thủ công. Thay tệp thì trạng thái duyệt bắt đầu lại.</li>
  <li>Văn bản gắn với tài khoản của bạn, không kế thừa từ người khác hay từ công ty cũ.</li>
</ul>
<h2>2. DPA với nền tảng ProCV</h2>
<ul>
  <li>Đọc và bấm đồng ý đúng phiên bản DPA hiện hành.</li>
  <li>Mỗi lần đồng ý được lưu lại làm bằng chứng gồm phiên bản, thời điểm và phiên đăng nhập.</li>
  <li>Khi ProCV ban hành phiên bản mới, bạn cần đồng ý lại.</li>
</ul>
<p>Cam kết chung: chỉ dùng dữ liệu ứng viên cho tuyển dụng, không chia sẻ cho bên thứ ba ngoài mục đích này và xóa khi không còn cần thiết.</p>""",
    },
    {
        'category': 'ntd-du-lieu-ca-nhan-va-dpa',
        'slug': 'trang-thai-dpa-va-quyen-truy-cap',
        'type': FAQ,
        'order': 11,
        'title': 'Trạng thái DPA ảnh hưởng thế nào đến đăng tin và dữ liệu ứng viên?',
        'seo_description': 'Ý nghĩa các trạng thái DPA trên ProCV và tính năng nào bị khóa khi DPA hết hiệu lực, đang ân hạn hoặc bị tạm giữ.',
        'source_reference': 'docs/01-phan-tich/dac-ta-nha-tuyen-dung.md mục 6 và 11; EMPLOYER_DPA_GRACE_DAYS',
        'body': """<table>
  <thead><tr><th>Trạng thái</th><th>Workspace</th><th>Đăng tin, dữ liệu ứng viên</th></tr></thead>
  <tbody>
    <tr><td>Còn hiệu lực (đúng phiên bản hiện hành)</td><td>Mở</td><td>Mở</td></tr>
    <tr><td>Phiên bản cũ hoặc chưa có bằng chứng phiên bản</td><td>Mở</td><td>Khóa</td></tr>
    <tr><td>Đang ân hạn sau khi có phiên bản mới (30 ngày)</td><td>Mở</td><td>Khóa</td></tr>
    <tr><td>Quá hạn ân hạn, bị tạm giữ</td><td>Khóa</td><td>Khóa</td></tr>
    <tr><td>Chưa đồng ý</td><td>Khóa</td><td>Khóa</td></tr>
  </tbody>
</table>
<ul>
  <li>Khi dữ liệu ứng viên bị khóa, bạn vẫn thấy số liệu tổng hợp, nhưng tên, email, ảnh, CV và lịch sử của ứng viên bị ẩn.</li>
  <li>Bị tạm giữ do DPA, các tin công khai của bạn cũng bị ẩn.</li>
  <li>Đồng ý phiên bản DPA hiện hành sẽ gỡ trạng thái giữ do DPA và tin tự hiển thị lại; trạng thái giữ vì lý do khác không bị gỡ theo.</li>
</ul>""",
    },
]
