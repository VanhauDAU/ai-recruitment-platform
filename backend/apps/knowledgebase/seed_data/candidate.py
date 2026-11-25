"""Bài trợ giúp cho ứng viên, đối chiếu với màn hình và đặc tả hiện hành của ProCV."""

FAQ, GUIDE = 'FAQ', 'GUIDE'

ARTICLES = [
    # ── Tài khoản và đăng nhập ────────────────────────────────────────────────
    {
        'category': 'tai-khoan-va-dang-nhap',
        'slug': 'khong-nhan-duoc-email-xac-thuc',
        'type': FAQ,
        'order': 20,
        'title': 'Tôi không nhận được email xác thực, phải làm sao?',
        'seo_description': 'Cách kiểm tra hộp thư và yêu cầu gửi lại email xác thực tài khoản ứng viên ProCV khi chưa nhận được liên kết.',
        'source_reference': 'frontend/src/pages/main/account/SecuritySettings.jsx; route /tai-khoan/xac-thuc-email',
        'body': """<p>Email xác thực thường đến sau vài phút. Nếu chưa thấy, hãy làm lần lượt các bước sau trước khi liên hệ hỗ trợ.</p>
<ol>
  <li>Kiểm tra thư mục <strong>Spam</strong>, <strong>Quảng cáo</strong> hoặc <strong>Cập nhật</strong> của hộp thư.</li>
  <li>Đối chiếu địa chỉ email hiển thị ở <a href="/tai-khoan/cai-dat-bao-mat">Cài đặt bảo mật</a>; nếu gõ nhầm khi đăng ký, liên kết đã được gửi tới địa chỉ khác.</li>
  <li>Tại dòng email đăng nhập đang ghi <em>Email chưa xác thực</em>, chọn <strong>Xác thực ngay</strong> để mở trang <a href="/tai-khoan/xac-thuc-email">Xác thực email</a> và yêu cầu gửi lại.</li>
  <li>Chỉ bấm vào liên kết mới nhất; liên kết cũ có thể đã hết hiệu lực.</li>
</ol>
<h2>Vì sao nên xác thực email?</h2>
<ul>
  <li>Thông báo việc làm theo tiêu chí chỉ được gửi tới email đăng nhập đã xác thực.</li>
  <li>Email đã xác thực giúp bạn khôi phục tài khoản khi quên mật khẩu.</li>
</ul>
<p>Nếu vẫn không nhận được thư, gửi yêu cầu theo hướng dẫn ở <a href="/tro-giup/lien-he-ho-tro">Liên hệ hỗ trợ</a> và ghi rõ email đã đăng ký. Không gửi mật khẩu cho bất kỳ ai.</p>""",
    },
    {
        'category': 'tai-khoan-va-dang-nhap',
        'slug': 'dang-ky-bang-google-va-tao-mat-khau',
        'type': FAQ,
        'order': 21,
        'title': 'Tôi đăng ký bằng Google, có đăng nhập bằng mật khẩu được không?',
        'seo_description': 'Tài khoản ứng viên tạo bằng Google có thể tạo thêm mật khẩu để đăng nhập bằng email. Xem cách thiết lập trên ProCV.',
        'source_reference': 'frontend/src/pages/main/account/SecuritySettings.jsx; frontend/src/pages/main/account/ChangePassword.jsx',
        'body': """<p>Được. Tài khoản tạo bằng Google ban đầu chưa có mật khẩu riêng trên ProCV. Bạn có thể tạo mật khẩu để đăng nhập bằng email khi không dùng được Google.</p>
<ol>
  <li>Mở <a href="/tai-khoan/cai-dat-bao-mat">Cài đặt bảo mật</a>. Dòng <strong>Mật khẩu đăng nhập</strong> sẽ ghi <em>Chưa có, đang đăng nhập bằng mạng xã hội</em>.</li>
  <li>Chọn <strong>Tạo mật khẩu</strong> để chuyển tới trang <a href="/tai-khoan/doi-mat-khau">Đổi mật khẩu</a>.</li>
  <li>Đặt mật khẩu theo yêu cầu hiển thị trên biểu mẫu và lưu lại.</li>
</ol>
<p>Sau đó bạn đăng nhập được bằng cả Google và email kèm mật khẩu. Nên dùng mật khẩu dài, không trùng với mật khẩu email hay dịch vụ khác.</p>""",
    },
    {
        'category': 'tai-khoan-va-dang-nhap',
        'slug': 'mot-email-cho-ca-ung-vien-va-nha-tuyen-dung',
        'type': FAQ,
        'order': 22,
        'title': 'Một email có dùng được cho cả tài khoản ứng viên và nhà tuyển dụng?',
        'seo_description': 'Trên ProCV, tài khoản ứng viên và nhà tuyển dụng cùng email là hai tài khoản độc lập với mật khẩu và dữ liệu riêng.',
        'source_reference': 'backend/apps/accounts (định danh theo email + vai trò); docs/01-phan-tich/dac-ta-nha-tuyen-dung.md mục 2',
        'body': """<p>Được, nhưng đó là <strong>hai tài khoản độc lập</strong>. ProCV tách cổng ứng viên và cổng nhà tuyển dụng, mỗi cổng có mật khẩu, hồ sơ và dữ liệu riêng.</p>
<ul>
  <li>Đổi mật khẩu ở cổng này không làm thay đổi mật khẩu ở cổng kia.</li>
  <li><strong>Quên mật khẩu</strong> chỉ đặt lại mật khẩu cho tài khoản thuộc cổng bạn đang dùng.</li>
  <li>Đăng nhập bằng Google ở mỗi cổng sẽ tạo hoặc gắn đúng tài khoản của cổng đó.</li>
  <li>CV, việc làm đã lưu và hồ sơ ứng tuyển chỉ nằm trong tài khoản ứng viên; tin tuyển dụng và chiến dịch chỉ nằm trong tài khoản nhà tuyển dụng.</li>
</ul>
<p>Nếu thấy thông báo <em>Tài khoản không thuộc cổng này</em>, hãy kiểm tra bạn đang ở đúng trang đăng nhập dành cho ứng viên hay nhà tuyển dụng.</p>""",
    },
    # ── Bảo mật và quyền riêng tư ─────────────────────────────────────────────
    {
        'category': 'bao-mat-va-quyen-rieng',
        'slug': 'quan-ly-thiet-bi-dang-dang-nhap',
        'type': GUIDE,
        'order': 20,
        'title': 'Xem và đăng xuất các thiết bị đang đăng nhập',
        'seo_description': 'Kiểm tra các phiên đăng nhập của tài khoản ProCV, đăng xuất một thiết bị lạ hoặc mọi thiết bị khác chỉ với vài thao tác.',
        'source_reference': 'frontend/src/pages/main/account/SecuritySettings.jsx (SessionManager); docs/adr/adr-0033-portal-session-policy.md',
        'body': """<p>Mục <strong>Thiết bị đang đăng nhập</strong> trong <a href="/tai-khoan/cai-dat-bao-mat">Cài đặt bảo mật</a> liệt kê các phiên đang hoạt động của tài khoản. Thiết bị bạn đang dùng được đánh dấu <em>Thiết bị này</em>.</p>
<h2>Đăng xuất một thiết bị</h2>
<ol>
  <li>Tìm thiết bị hoặc trình duyệt bạn không nhận ra.</li>
  <li>Chọn <strong>Đăng xuất thiết bị</strong> và xác nhận. Thiết bị đó phải đăng nhập lại mới dùng tiếp được.</li>
</ol>
<h2>Đăng xuất mọi thiết bị khác</h2>
<p>Chọn <strong>Đăng xuất thiết bị khác</strong> khi bạn từng đăng nhập trên máy dùng chung hoặc làm mất điện thoại. Phiên trên thiết bị hiện tại được giữ lại.</p>
<h2>Khi nghi ngờ bị truy cập trái phép</h2>
<ul>
  <li>Đổi mật khẩu ngay tại <a href="/tai-khoan/doi-mat-khau">Đổi mật khẩu</a>, sau đó đăng xuất các thiết bị khác.</li>
  <li>Đổi cả mật khẩu email dùng để đăng nhập ProCV.</li>
  <li>Kiểm tra lại CV và <a href="/tai-khoan/viec-lam-da-ung-tuyen">Việc làm đã ứng tuyển</a> để phát hiện thay đổi lạ.</li>
</ul>""",
    },
    {
        'category': 'bao-mat-va-quyen-rieng',
        'slug': 'yeu-cau-xuat-du-lieu-ca-nhan',
        'type': GUIDE,
        'order': 21,
        'title': 'Yêu cầu bản sao dữ liệu cá nhân của tôi',
        'seo_description': 'Theo Nghị định 13/2023, ứng viên có thể yêu cầu ProCV xuất bản sao dữ liệu cá nhân. Xem cách gửi yêu cầu và thời hạn tải.',
        'source_reference': 'backend/apps/privacy/services/data_requests.py (EXPORT_DOWNLOAD_DAYS = 7); frontend DataRequestsPanel',
        'body': """<p>Theo Nghị định 13/2023/NĐ-CP, bạn có quyền nhận bản sao dữ liệu cá nhân mà ProCV đang lưu về mình.</p>
<h2>Gửi yêu cầu</h2>
<ol>
  <li>Mở <a href="/tai-khoan/cai-dat-bao-mat">Cài đặt bảo mật</a> và cuộn tới khối quyền với dữ liệu cá nhân.</li>
  <li>Tại <strong>Xuất dữ liệu của tôi</strong>, chọn <strong>Yêu cầu xuất dữ liệu</strong>.</li>
  <li>Yêu cầu được quản trị viên xử lý trong vòng 72 giờ.</li>
</ol>
<h2>Nhận bản sao</h2>
<ul>
  <li>Khi yêu cầu được duyệt, bản xuất xuất hiện ngay trong khối này để bạn tải về.</li>
  <li>Bản xuất chỉ tải được trong <strong>7 ngày</strong> kể từ lúc được duyệt; hết hạn thì gửi yêu cầu mới.</li>
  <li>Bản xuất gồm thông tin tài khoản, CV, hoạt động ứng tuyển và các cuộc trò chuyện ProCV Connect của bạn.</li>
</ul>
<p>Hãy lưu tệp ở nơi an toàn vì nó chứa nhiều thông tin cá nhân.</p>""",
    },
    {
        'category': 'bao-mat-va-quyen-rieng',
        'slug': 'yeu-cau-xoa-tai-khoan-ung-vien',
        'type': GUIDE,
        'order': 22,
        'title': 'Yêu cầu xóa tài khoản ứng viên',
        'seo_description': 'Điều gì xảy ra khi bạn yêu cầu xóa tài khoản ProCV: dữ liệu nào bị xóa, dữ liệu nào được giữ và vì sao không thể hoàn tác.',
        'source_reference': 'backend/apps/privacy/services/data_requests.py; frontend/messages common privacy_erasure_*',
        'body': """<p>Bạn có thể yêu cầu xóa tài khoản bất cứ lúc nào tại <a href="/tai-khoan/cai-dat-bao-mat">Cài đặt bảo mật</a> bằng nút <strong>Yêu cầu xóa tài khoản</strong>. Yêu cầu được quản trị viên xử lý trong vòng 72 giờ.</p>
<h2>Khi yêu cầu được xử lý</h2>
<ul>
  <li>Bạn bị đăng xuất khỏi mọi thiết bị và <strong>không thể khôi phục</strong> tài khoản.</li>
  <li>Tài khoản được ẩn danh hóa; CV trong thư viện và hồ sơ ứng viên bị xóa vĩnh viễn.</li>
  <li>Bản CV đã nộp kèm từng đơn ứng tuyển vẫn được giữ cho nhà tuyển dụng đã nhận hồ sơ, vì đó là một phần hồ sơ tuyển dụng của họ.</li>
  <li>Tin nhắn và tệp bạn gửi trong ProCV Connect bị xóa; phía nhà tuyển dụng thấy <em>Tài khoản đã xóa</em>.</li>
</ul>
<blockquote>Muốn giữ lại dữ liệu, hãy <a href="/tro-giup/bao-mat-va-quyen-rieng/yeu-cau-xuat-du-lieu-ca-nhan">yêu cầu xuất dữ liệu</a> và tải về trước khi gửi yêu cầu xóa.</blockquote>""",
    },
    # ── Tìm việc và gợi ý việc làm ────────────────────────────────────────────
    {
        'category': 'tim-viec-va-goi-y-viec-lam',
        'slug': 'tim-viec-gan-vi-tri-cua-ban',
        'type': GUIDE,
        'order': 20,
        'title': 'Tìm việc gần vị trí của bạn trên bản đồ',
        'seo_description': 'Dùng Việc làm gần bạn để xem tin tuyển dụng quanh vị trí hiện tại, phường/xã hoặc địa chỉ đã chọn, kèm khoảng cách và bán kính.',
        'source_reference': 'docs/01-phan-tich/dac-ta-tim-viec-gan-day.md; route /viec-lam-gan-ban; ADR-0029',
        'body': """<p>Tính năng <strong>Việc làm gần bạn</strong> hiển thị tin tuyển dụng trên bản đồ, sắp theo khoảng cách tới điểm bạn chọn.</p>
<ol>
  <li>Mở <a href="/viec-lam">Việc làm</a> và bấm <strong>Tìm việc gần tôi</strong>.</li>
  <li>Chọn điểm xuất phát: dùng vị trí hiện tại của thiết bị, chọn phường/xã, nhập địa chỉ hoặc bấm trực tiếp lên bản đồ.</li>
  <li>Chọn bán kính tìm kiếm bằng các nút bán kính phía trên danh sách.</li>
  <li>Bản đồ và danh sách hiển thị song song; mỗi tin có số km tới điểm bạn chọn.</li>
</ol>
<h2>Về quyền riêng tư vị trí</h2>
<ul>
  <li>Vị trí chỉ dùng để tìm việc trong phiên hiện tại, không được lưu lên máy chủ.</li>
  <li>Trình duyệt chỉ cho định vị trên kết nối HTTPS. Nếu bạn từ chối quyền vị trí, hãy chọn phường/xã hoặc nhập địa chỉ thay thế.</li>
</ul>
<p>Khoảng cách dựa trên địa chỉ làm việc nhà tuyển dụng khai trong tin; hãy đọc kỹ địa điểm trên trang tin trước khi ứng tuyển.</p>""",
    },
    {
        'category': 'tim-viec-va-goi-y-viec-lam',
        'slug': 'so-sanh-viec-lam',
        'type': GUIDE,
        'order': 21,
        'title': 'So sánh hai đến ba việc làm cạnh nhau',
        'seo_description': 'Thêm tối đa 3 tin vào So sánh việc làm để đối chiếu lương, cấp bậc, kinh nghiệm, kỹ năng và quyền lợi trước khi ứng tuyển.',
        'source_reference': 'frontend/src/features/main/job/compare-jobs; route /so-sanh-viec-lam',
        'body': """<p>Khi phân vân giữa vài cơ hội, bạn có thể đặt chúng cạnh nhau trong <strong>So sánh việc làm</strong>.</p>
<h2>Thêm việc làm vào so sánh</h2>
<ol>
  <li>Trên thẻ việc làm, bấm nút <strong>So sánh</strong>. Nút chuyển thành <em>Đã thêm</em>.</li>
  <li>Thêm từ hai đến tối đa ba việc làm. Bấm lại nút để bỏ một tin khỏi danh sách.</li>
  <li>Mở trang So sánh việc làm để xem bảng đối chiếu.</li>
</ol>
<h2>Đọc bảng so sánh</h2>
<ul>
  <li>Các dòng gồm mức lương, cấp bậc, loại công việc, hình thức làm việc, kinh nghiệm, học vấn, kỹ năng bắt buộc và ưu tiên, hạn nộp, quyền lợi và giới thiệu công ty.</li>
  <li>Bật <strong>Chỉ hiện điểm khác nhau</strong> để ẩn các tiêu chí giống nhau.</li>
  <li>Dùng <strong>Sao chép liên kết</strong> để gửi bảng so sánh cho người thân hoặc bạn bè góp ý.</li>
</ul>
<p>Danh sách so sánh được giữ trên trình duyệt khi bạn bật nhóm cookie Sở thích; nếu tắt, danh sách chỉ còn trong tab hiện tại. Xem thêm <a href="/chinh-sach-cookie">Chính sách cookie</a>.</p>""",
    },
    {
        'category': 'tim-viec-va-goi-y-viec-lam',
        'slug': 'tin-tuyen-dung-duoc-sap-xep-the-nao',
        'type': FAQ,
        'order': 22,
        'title': 'Tin tuyển dụng trên ProCV được sắp xếp thế nào?',
        'seo_description': 'ProCV không bán vị trí HOT/VIP: tin mặc định xếp theo lần đăng đầu, nhãn Sắp hết hạn và Phản hồi nhanh do hệ thống tự tính.',
        'source_reference': 'docs/adr/adr-0030-fair-job-listing.md; backend/apps/jobs/domain/listing.py',
        'body': """<p>ProCV không có gói trả phí để đẩy tin lên đầu, nên mọi tin được đối xử như nhau.</p>
<ul>
  <li><strong>Mặc định: Mới đăng</strong>, tính theo thời điểm tin được đăng công khai lần đầu. Sửa, gia hạn hay mở lại tin không làm tin "trẻ lại".</li>
  <li>Bạn có thể đổi cách sắp xếp sang lương cao trước hoặc sắp hết hạn trước.</li>
  <li>Không có nhãn HOT, GẤP hay Tài trợ gán tay.</li>
</ul>
<h2>Các nhãn bạn có thể thấy</h2>
<ul>
  <li><strong>Sắp hết hạn</strong>: hạn nhận hồ sơ chỉ còn vài ngày.</li>
  <li><strong>Phản hồi nhanh</strong>: nhà tuyển dụng thường xuyên phản hồi hồ sơ đúng hạn; hệ thống tính lại mỗi giờ.</li>
</ul>
<p>Mới đi làm? Hãy dùng ô <strong>Việc không cần kinh nghiệm</strong> trong trang <a href="/viec-lam">Việc làm</a> để lọc nhanh.</p>""",
    },
    {
        'category': 'tim-viec-va-goi-y-viec-lam',
        'slug': 'theo-doi-cong-ty',
        'type': FAQ,
        'order': 23,
        'title': 'Theo dõi công ty để không bỏ lỡ việc làm mới',
        'seo_description': 'Theo dõi công ty yêu thích trên ProCV để xem lại trong tài khoản và nhận email khi công ty có việc làm mới.',
        'source_reference': 'frontend/src/features/main/company/follow-company; frontend/src/pages/main/account/FollowedCompanies.jsx',
        'body': """<p>Khi bấm theo dõi một công ty, bạn sẽ dễ dàng nắm được các vị trí mới của công ty đó.</p>
<ul>
  <li>Danh sách công ty bạn theo dõi nằm ở <strong>Quản lý tìm việc › Công ty đang theo dõi</strong> trong tài khoản.</li>
  <li>Bật loại thông báo <strong>Việc làm mới từ công ty đang theo dõi</strong> trong <strong>Cài đặt nhận thông báo</strong> nếu muốn nhận email.</li>
  <li>Bỏ theo dõi bất cứ lúc nào; nhà tuyển dụng không nhận được CV của bạn chỉ vì bạn theo dõi công ty.</li>
</ul>""",
    },
    # ── Ứng tuyển và theo dõi hồ sơ ───────────────────────────────────────────
    {
        'category': 'ung-tuyen-va-theo-doi-ho-so',
        'slug': 'y-nghia-trang-thai-ho-so-ung-tuyen',
        'type': FAQ,
        'order': 20,
        'title': 'Các trạng thái hồ sơ ứng tuyển có ý nghĩa gì?',
        'seo_description': 'Giải thích từng trạng thái hồ sơ trên ProCV: đã nộp, đã xem, phù hợp, mời phỏng vấn, trúng tuyển, chưa phù hợp và tự động từ chối.',
        'source_reference': 'docs/01-phan-tich/dac-ta-chien-dich-va-tin-tuyen-dung.md mục 7; route /tai-khoan/viec-lam-da-ung-tuyen',
        'body': """<p>Bạn theo dõi tiến trình tại <a href="/tai-khoan/viec-lam-da-ung-tuyen">Việc làm đã ứng tuyển</a>.</p>
<table>
  <thead><tr><th>Trạng thái</th><th>Ý nghĩa</th></tr></thead>
  <tbody>
    <tr><td>Đã nộp hồ sơ</td><td>Hồ sơ đã tới nhà tuyển dụng.</td></tr>
    <tr><td>Nhà tuyển dụng đã xem hồ sơ</td><td>Nhà tuyển dụng đã mở CV của bạn lần đầu.</td></tr>
    <tr><td>Hồ sơ phù hợp</td><td>Hồ sơ được đưa vào danh sách cân nhắc.</td></tr>
    <tr><td>Mời phỏng vấn</td><td>Nhà tuyển dụng muốn gặp bạn; lịch hẹn có thể được gửi qua ProCV Connect.</td></tr>
    <tr><td>Trúng tuyển</td><td>Kết quả cuối cùng: bạn được nhận.</td></tr>
    <tr><td>Chưa phù hợp</td><td>Kết quả cuối cùng cho lần nộp này.</td></tr>
  </tbody>
</table>
<h2>Vì sao thông báo kết quả đến chậm vài giây?</h2>
<p>Nhà tuyển dụng có một khoảng ngắn để hoàn tác khi bấm nhầm, nên bạn chỉ nhận trạng thái đã được xác nhận.</p>
<h2>Hồ sơ lâu không được phản hồi</h2>
<p>Một số tin bật tự động từ chối: hồ sơ ở trạng thái <em>Đã nộp</em> hoặc <em>Đã xem</em> quá số ngày nhà tuyển dụng cấu hình sẽ chuyển sang <em>Chưa phù hợp</em> và bạn nhận email thông báo. Khi đó bạn có thể ứng tuyển lại nếu tin còn nhận hồ sơ.</p>""",
    },
    {
        'category': 'ung-tuyen-va-theo-doi-ho-so',
        'slug': 'rut-ho-so-va-ung-tuyen-lai',
        'type': GUIDE,
        'order': 21,
        'title': 'Rút hồ sơ và ứng tuyển lại vào cùng một tin',
        'seo_description': 'Khi nào được rút CV ứng tuyển, khi nào được nộp lại và giới hạn số lần nộp vào một tin tuyển dụng trên ProCV.',
        'source_reference': 'backend/apps/applications/services/applications.py; site settings application_max_per_job, application_reapply_cooldown_minutes',
        'body': """<p>Mỗi tin tuyển dụng chỉ có <strong>một hồ sơ hiệu lực</strong> của bạn tại một thời điểm.</p>
<h2>Rút hồ sơ</h2>
<ol>
  <li>Mở <a href="/tai-khoan/viec-lam-da-ung-tuyen">Việc làm đã ứng tuyển</a>.</li>
  <li>Chọn <strong>Rút CV ứng tuyển</strong> ở hồ sơ chưa có kết quả và xác nhận.</li>
</ol>
<p>Sau khi rút, cuộc trò chuyện ProCV Connect về tin đó chuyển sang chỉ đọc cho tới khi bạn nộp lại.</p>
<h2>Ứng tuyển lại</h2>
<ul>
  <li>Chỉ nộp lại được khi hồ sơ trước đã <strong>rút</strong> hoặc <strong>chưa phù hợp</strong>, và tin vẫn đang nhận hồ sơ.</li>
  <li>Tổng số lần nộp vào một tin, tính cả lần đầu, có giới hạn (mặc định 3 lần).</li>
  <li>Giữa hai lần nộp cần cách nhau một khoảng tối thiểu tính từ lần nộp trước (mặc định 5 phút).</li>
  <li>Mỗi lần nộp lưu một bản chụp CV riêng, nên hãy cập nhật CV trước khi nộp lại.</li>
</ul>""",
    },
    {
        'category': 'ung-tuyen-va-theo-doi-ho-so',
        'slug': 'nha-tuyen-dung-luu-ho-so-cua-toi',
        'type': FAQ,
        'order': 22,
        'title': 'Nhà tuyển dụng lưu hồ sơ của tôi vào kho ứng viên nghĩa là gì?',
        'seo_description': 'Kho ứng viên tiềm năng giúp nhà tuyển dụng mời bạn ứng tuyển vị trí mới. Bạn được báo, xem được ai đang lưu và có thể rút hồ sơ.',
        'source_reference': 'docs/01-phan-tich/dac-ta-chien-dich-va-tin-tuyen-dung.md mục 7 (Kho ứng viên tiềm năng); frontend/src/pages/main/account/TalentPools.jsx',
        'body': """<p>Nhà tuyển dụng có thể lưu hồ sơ của ứng viên từng nộp vào tin của họ vào <strong>kho ứng viên tiềm năng</strong> để liên hệ khi có vị trí phù hợp hơn.</p>
<ul>
  <li>Bạn nhận thông báo khi được lưu và xem danh sách tại <strong>Quản lý tìm việc › Nhà tuyển dụng lưu hồ sơ</strong>.</li>
  <li>Bạn có thể rút hồ sơ khỏi kho của một nhà tuyển dụng bất cứ lúc nào.</li>
  <li>Mỗi mục trong kho tự hết hạn sau 12 tháng.</li>
  <li>Nhà tuyển dụng có thể gửi <strong>lời mời ứng tuyển</strong> cho một tin mới, tối đa một lần cho mỗi tin. Bạn tự quyết định có nộp hồ sơ hay không.</li>
</ul>
<p>Ghi chú và nhãn nhà tuyển dụng đặt cho bạn là dữ liệu nội bộ của họ và không hiển thị với bạn.</p>""",
    },
    {
        'category': 'ung-tuyen-va-theo-doi-ho-so',
        'slug': 'phan-hoi-loi-moi-ket-noi-tu-nha-tuyen-dung',
        'type': GUIDE,
        'order': 23,
        'title': 'Phản hồi lời mời kết nối từ nhà tuyển dụng',
        'seo_description': 'Khi CV được bật cho nhà tuyển dụng tìm kiếm, bạn có thể nhận lời mời kết nối về một vị trí. Đồng ý hoặc từ chối thế nào?',
        'source_reference': 'frontend/src/pages/main/account/EmployerConnections.jsx; features/main/application/respond-to-connection-invitation',
        'body': """<p>Nếu bạn cho phép nhà tuyển dụng tìm thấy CV, họ có thể gửi <strong>lời mời kết nối</strong> về một vị trí cụ thể. Lời mời nằm ở <strong>Quản lý CV › Nhà tuyển dụng muốn kết nối với bạn</strong>.</p>
<h2>Đồng ý</h2>
<ul>
  <li>Nhà tuyển dụng được nhắn tin với bạn qua ProCV Connect để trao đổi chi tiết.</li>
  <li>Họ tên, liên hệ và tệp CV của bạn vẫn chỉ hiện khi bạn chủ động ứng tuyển vào tin.</li>
</ul>
<h2>Từ chối</h2>
<ul>
  <li>Công ty biết bạn chưa quan tâm vị trí đó và không thể mời lại cho cùng tin.</li>
  <li>Phản hồi sớm giúp nhà tuyển dụng biết bạn có quan tâm hay không.</li>
</ul>
<p>Muốn ngừng nhận lời mời, hãy tắt CV đang cho phép tìm kiếm trong <a href="/tai-khoan/cv-cua-toi">CV của tôi</a>.</p>""",
    },
    # ── CV và mẫu CV ──────────────────────────────────────────────────────────
    {
        'category': 'cv-va-mau-cv',
        'slug': 'tai-cv-co-san-len-procv',
        'type': GUIDE,
        'order': 20,
        'title': 'Tải CV có sẵn lên ProCV',
        'seo_description': 'Tải CV dạng PDF hoặc DOCX dưới 5 MB lên ProCV, cách để hệ thống đọc đúng nội dung và lưu ý với bản scan.',
        'source_reference': 'frontend/src/features/main/cv/upload-cv; route /tai-cv-len; docs/01-phan-tich/dac-ta-nha-tuyen-dung.md mục 8',
        'body': """<p>Nếu đã có CV, bạn không cần tạo lại từ đầu.</p>
<ol>
  <li>Mở <a href="/tai-khoan/cv-cua-toi">CV của tôi</a> và chọn tải CV lên.</li>
  <li>Chọn tệp <strong>PDF hoặc DOCX dưới 5 MB</strong>.</li>
  <li>Tệp được kiểm tra an toàn trước khi dùng; chờ tới khi trạng thái tải lên hoàn tất.</li>
</ol>
<h2>Để hệ thống đọc đúng CV</h2>
<ul>
  <li>Dùng PDF có thể bôi đen chữ. Bản chụp hoặc scan dạng ảnh sẽ không đọc được nội dung.</li>
  <li>Đặt tiêu đề mục rõ ràng: Kinh nghiệm, Học vấn, Kỹ năng, Dự án, Chứng chỉ.</li>
  <li>Ghi mốc thời gian cho từng công việc để tính đúng số năm kinh nghiệm.</li>
</ul>
<p>Muốn chỉnh sửa trực tiếp trên ProCV, hãy tạo CV từ <a href="/mau-cv">Mẫu CV</a>.</p>""",
    },
    {
        'category': 'cv-va-mau-cv',
        'slug': 'cho-phep-nha-tuyen-dung-tim-thay-cv',
        'type': GUIDE,
        'order': 21,
        'title': 'Cho phép nhà tuyển dụng tìm thấy CV của bạn',
        'seo_description': 'Bật một CV cho nhà tuyển dụng tìm kiếm trên ProCV: họ thấy gì, không thấy gì và cách tắt khi không còn nhu cầu.',
        'source_reference': 'frontend/src/features/main/cv/update-recruiter-visibility; docs/archive kế hoạch Tìm CV 25/11/2026',
        'body': """<p>Bạn có thể để nhà tuyển dụng chủ động tìm thấy mình thay vì chỉ chờ ứng tuyển.</p>
<ol>
  <li>Mở <a href="/tai-khoan/cv-cua-toi">CV của tôi</a>.</li>
  <li>Ở khối cho phép nhà tuyển dụng tìm kiếm, bấm <strong>Chọn CV</strong> (hoặc <strong>Đổi CV</strong>) và chọn một CV.</li>
</ol>
<h2>Những điều cần biết</h2>
<ul>
  <li><strong>Mỗi lần chỉ một CV được bật.</strong> Bật CV khác thì CV đang bật tự tắt.</li>
  <li>Nhà tuyển dụng thấy hồ sơ trích xuất từ CV: kinh nghiệm, học vấn, kỹ năng.</li>
  <li>Họ <strong>không</strong> thấy họ tên, ảnh, số điện thoại, email, địa chỉ hay tệp CV cho tới khi bạn ứng tuyển.</li>
  <li>Họ có thể gửi lời mời kết nối về một vị trí; bạn chọn đồng ý hoặc từ chối.</li>
  <li>Tắt đồng ý thì CV bị gỡ khỏi tìm kiếm và nhà tuyển dụng không mời bạn qua CV đó được nữa.</li>
</ul>""",
    },
    {
        'category': 'cv-va-mau-cv',
        'slug': 'ho-so-nha-tuyen-dung-nhin-thay',
        'type': FAQ,
        'order': 22,
        'title': '"Hồ sơ NTD nhìn thấy" là gì và sửa thế nào?',
        'seo_description': 'Hồ sơ trích xuất được đọc tự động từ CV để nhà tuyển dụng tìm kiếm. Xem trước nội dung và cách sửa khi có chỗ sai.',
        'source_reference': 'frontend/src/features/main/cv/view-recruiter-profile; messages candidate_recruiter_profile_*',
        'body': """<p>Bấm <strong>Xem hồ sơ NTD nhìn thấy</strong> ở CV để xem trước đúng những gì nhà tuyển dụng thấy khi tìm kiếm. Cửa sổ có hai tab: <em>Hồ sơ trích xuất</em> và <em>CV</em>.</p>
<ul>
  <li>Hồ sơ được hệ thống đọc tự động từ CV và chỉ để xem; không sửa trực tiếp ở đây.</li>
  <li>Thấy sai hoặc thiếu, hãy sửa trong CV rồi lưu lại; hồ sơ trích xuất được cập nhật sau ít giây.</li>
  <li>Nếu báo không đọc được chữ, có thể tệp là bản scan. Hãy tải PDF có thể bôi đen chữ hoặc dùng CV tạo trên ProCV.</li>
  <li>Nếu báo thiếu nội dung, bổ sung mục kinh nghiệm và kỹ năng rồi lưu lại.</li>
</ul>""",
    },
    # ── Tìm việc an toàn ──────────────────────────────────────────────────────
    {
        'category': 'tim-viec-an-toan',
        'slug': 'procv-co-thu-phi-ung-vien-khong',
        'type': FAQ,
        'order': 20,
        'title': 'ProCV có thu phí ứng viên không?',
        'seo_description': 'Ứng viên dùng ProCV miễn phí. ProCV không bao giờ yêu cầu bạn chuyển tiền, đặt cọc hay cung cấp mã OTP để ứng tuyển.',
        'source_reference': 'docs/01-phan-tich/dac-ta-trung-tam-tro-giup.md mục 3; docs/adr/adr-0015-remove-commercial-services.md',
        'body': """<p><strong>Không.</strong> Ứng viên tạo CV, tìm việc và ứng tuyển trên ProCV hoàn toàn miễn phí.</p>
<ul>
  <li>ProCV không yêu cầu ứng viên chuyển tiền, đặt cọc, mua hàng hay nạp tiền để được ứng tuyển hoặc nhận việc.</li>
  <li>ProCV không bao giờ hỏi mật khẩu, mã OTP hay mã xác minh email của bạn qua tin nhắn hoặc điện thoại.</li>
  <li>Ai nhân danh ProCV hoặc nhà tuyển dụng đòi những điều trên đều có dấu hiệu lừa đảo.</li>
</ul>
<p>Gặp trường hợp như vậy, hãy dừng trao đổi và <a href="/tro-giup/tim-viec-an-toan/bao-cao-tin-tuyen-dung-vi-pham">báo cáo tin tuyển dụng</a> ngay trên trang tin.</p>""",
    },
    {
        'category': 'tim-viec-an-toan',
        'slug': 'bao-cao-tin-tuyen-dung-vi-pham',
        'type': GUIDE,
        'order': 21,
        'title': 'Báo cáo tin tuyển dụng có dấu hiệu vi phạm',
        'seo_description': 'Cách báo cáo tin tuyển dụng lừa đảo, công ty không có thật hoặc sai sự thật trên ProCV và quy trình quản trị viên xử lý.',
        'source_reference': 'backend/apps/jobs/models/report.py; docs/01-phan-tich/dac-ta-chien-dich-va-tin-tuyen-dung.md mục 8',
        'body': """<p>Tin tuyển dụng hiển thị ngay khi nhà tuyển dụng đăng và được quản trị viên hậu kiểm. Báo cáo của bạn giúp phát hiện vi phạm nhanh hơn.</p>
<h2>Gửi báo cáo</h2>
<ol>
  <li>Đăng nhập tài khoản ứng viên và mở trang tin.</li>
  <li>Chọn nút báo cáo và một lý do: <em>Công ty không có thật</em>, <em>Lừa đảo, thu phí ứng viên</em>, <em>Thông tin tin đăng sai sự thật</em>, <em>Tin trùng lặp</em>, <em>Tin đã tuyển xong nhưng chưa gỡ</em> hoặc <em>Lý do khác</em>.</li>
  <li>Mô tả ngắn điều bạn thấy và gửi. Mỗi tài khoản báo cáo một tin một lần.</li>
</ol>
<h2>Sau khi gửi</h2>
<ul>
  <li>Tin vẫn hiển thị trong lúc quản trị viên xem xét.</li>
  <li>Nếu vi phạm được xác nhận với lý do công ty không có thật, lừa đảo hoặc sai sự thật, tin bị tạm ẩn và người đăng mất dấu xác thực trên mọi tin.</li>
  <li>Danh tính người báo cáo không được chuyển cho nhà tuyển dụng.</li>
</ul>""",
    },
    # ── Gợi ý việc làm và phân tích AI ────────────────────────────────────────
    {
        'category': 'goi-y-viec-lam-va-phan-tich-ai',
        'slug': 'bat-tat-goi-y-viec-lam',
        'type': GUIDE,
        'order': 10,
        'title': 'Bật hoặc tắt Gợi ý việc làm',
        'seo_description': 'Gợi ý việc làm trên ProCV chỉ phân tích CV sau khi bạn đồng ý. Xem cách bật, tắt và đọc lý do phù hợp của từng tin.',
        'source_reference': 'frontend/src/features/main/job/toggle-ai-recommendation; route /tai-khoan/viec-lam-phu-hop',
        'body': """<p><strong>Gợi ý việc làm</strong> xếp các tin gần nhất với CV đã lưu và nhu cầu công việc bạn khai. Quá trình phân tích có dùng công nghệ AI, nên tính năng chỉ chạy khi bạn đồng ý.</p>
<h2>Bật gợi ý</h2>
<ol>
  <li>Mở <a href="/tai-khoan/viec-lam-phu-hop">Việc làm phù hợp với bạn</a> hoặc <a href="/tai-khoan/cai-dat-goi-y-viec-lam">Cài đặt gợi ý việc làm</a>.</li>
  <li>Bật công tắc <strong>Gợi ý việc làm</strong> và xác nhận trong hộp thoại <em>Xác nhận bật Gợi ý việc làm</em>.</li>
  <li>Lưu ít nhất một CV hoặc khai nhu cầu công việc để danh sách sát hơn.</li>
</ol>
<h2>Dùng danh sách gợi ý</h2>
<ul>
  <li>Bấm <strong>Vì sao phù hợp?</strong> để xem lý do của từng tin.</li>
  <li>Chọn <strong>Ẩn tin tuyển dụng này</strong> với tin không quan tâm.</li>
</ul>
<h2>Tắt gợi ý</h2>
<p>Khi tắt, hệ thống ngừng phân tích CV. Bạn vẫn xem được việc làm theo nhu cầu đã khai hoặc tin mới nhất, chỉ là không còn xếp theo kinh nghiệm và kỹ năng của bạn. Bạn có thể bật lại bất cứ lúc nào.</p>""",
    },
    {
        'category': 'goi-y-viec-lam-va-phan-tich-ai',
        'slug': 'khai-bao-nhu-cau-cong-viec',
        'type': GUIDE,
        'order': 11,
        'title': 'Khai báo nhu cầu công việc để gợi ý sát hơn',
        'seo_description': 'Cập nhật vị trí chuyên môn, kinh nghiệm, kỹ năng, mức lương và địa điểm mong muốn để ProCV gợi ý việc làm đúng hướng bạn muốn.',
        'source_reference': 'frontend/src/features/main/job/configure-job-preferences; frontend/src/pages/main/account/JobPreferenceSettings.jsx',
        'body': """<p>Nhu cầu công việc cho hệ thống biết hướng bạn muốn đi, kể cả khi CV chưa thể hiện hết.</p>
<ol>
  <li>Mở <a href="/tai-khoan/cai-dat-goi-y-viec-lam">Cài đặt gợi ý việc làm</a>.</li>
  <li>Chọn tối đa <strong>5 vị trí chuyên môn</strong> từ danh mục. Không thấy vị trí của mình, bạn có thể gõ thêm tối đa 5 vị trí ngoài danh mục.</li>
  <li>Khai kinh nghiệm, kỹ năng, mức lương mong muốn và tỉnh/thành muốn làm việc.</li>
  <li>Đánh dấu <strong>Tôi có thể thay đổi địa điểm làm việc</strong> nếu sẵn sàng chuyển nơi làm.</li>
  <li>Đánh dấu đồng ý để hệ thống gợi ý việc làm dựa trên nhu cầu công việc rồi lưu.</li>
</ol>
<p>Tỉnh/thành và vị trí chuyên môn mong muốn cũng là bộ lọc nhà tuyển dụng dùng khi tìm CV, nếu bạn đã bật một CV cho phép tìm kiếm.</p>""",
    },
    {
        'category': 'goi-y-viec-lam-va-phan-tich-ai',
        'slug': 'xem-do-phu-hop-cv-voi-tin-tuyen-dung',
        'type': GUIDE,
        'order': 12,
        'title': 'Xem độ phù hợp giữa CV và một tin tuyển dụng',
        'seo_description': 'Dùng nút Xem độ phù hợp trên trang tin để AI so CV với yêu cầu của tin: kỹ năng có và còn thiếu, kinh nghiệm, học vấn, ngoại ngữ.',
        'source_reference': 'frontend/src/features/main/application/analyze-job-fit; frontend/messages shared fit_*',
        'body': """<p>Trước khi ứng tuyển, bạn có thể nhờ AI so CV với từng yêu cầu của tin để biết nên bổ sung gì.</p>
<ol>
  <li>Mở trang tin và bấm <strong>Xem độ phù hợp</strong> (có nhãn AI).</li>
  <li>Chọn CV muốn so. CV tạo trên ProCV cần được lưu ít nhất một lần.</li>
  <li>Chờ vài giây trong lúc AI đọc CV và so với tin.</li>
</ol>
<h2>Đọc kết quả</h2>
<ul>
  <li>Mức phù hợp: <em>Chưa phù hợp</em>, <em>Tương đối phù hợp</em>, <em>Phù hợp</em> hoặc <em>Rất phù hợp</em>, kèm điểm trên 100.</li>
  <li>Danh sách <strong>kỹ năng có trong CV</strong> và <strong>kỹ năng còn thiếu</strong> so với tin.</li>
  <li>Nhận xét về kinh nghiệm, học vấn, cấp bậc và ngoại ngữ.</li>
</ul>
<p>Bấm <strong>Đổi CV hoặc phân tích lại</strong> sau khi sửa CV. Số lần phân tích trong một giờ có giới hạn; kết quả cũ vẫn xem được. Kết quả này để bạn tham khảo; nhà tuyển dụng chỉ thấy phân tích AI khi bạn đồng ý lúc ứng tuyển.</p>""",
    },
    {
        'category': 'goi-y-viec-lam-va-phan-tich-ai',
        'slug': 'diem-phu-hop-duoc-tinh-the-nao',
        'type': FAQ,
        'order': 13,
        'title': 'Điểm phù hợp giữa CV và tin tuyển dụng được tính thế nào?',
        'seo_description': 'ProCV tính điểm phù hợp từ kỹ năng, kinh nghiệm, học vấn, cấp bậc và ngoại ngữ bằng mô hình AI tự vận hành. Điểm chỉ để tham khảo.',
        'source_reference': 'docs/07-algorithms/thuat-toan-ai.md (hybrid-v2); frontend/messages employer_workspace_match_how_*',
        'body': """<p>Điểm tổng là trung bình có trọng số của các tiêu chí tính được:</p>
<table>
  <thead><tr><th>Tiêu chí</th><th>Trọng số</th></tr></thead>
  <tbody>
    <tr><td>Kỹ năng</td><td>40%</td></tr>
    <tr><td>Kinh nghiệm</td><td>30%</td></tr>
    <tr><td>Học vấn</td><td>10%</td></tr>
    <tr><td>Cấp bậc</td><td>10%</td></tr>
    <tr><td>Ngoại ngữ</td><td>10%</td></tr>
  </tbody>
</table>
<ul>
  <li>Tiêu chí tin không yêu cầu hoặc CV không ghi thì không tính vào điểm.</li>
  <li>Địa điểm không làm thay đổi điểm.</li>
  <li>Nếu chuyên môn trong CV khác lĩnh vực của tin, học vấn, cấp bậc và ngoại ngữ chỉ được tính một phần.</li>
  <li>Thiếu ngoại ngữ bắt buộc thì điểm tổng bị giới hạn.</li>
  <li>Kỹ năng chỉ được đếm khi CV có ghi; nhà tuyển dụng thấy câu trích nguyên văn trong CV làm bằng chứng.</li>
</ul>
<p>ProCV dùng mô hình AI tự vận hành cho phần đối sánh này. Điểm là ước lượng để tham khảo, <strong>không tự loại</strong> hồ sơ nào; quyết định tuyển dụng luôn do nhà tuyển dụng đưa ra.</p>""",
    },
    {
        'category': 'goi-y-viec-lam-va-phan-tich-ai',
        'slug': 'dong-y-phan-tich-ai-khi-ung-tuyen',
        'type': FAQ,
        'order': 14,
        'title': 'Có bắt buộc đồng ý phân tích AI khi ứng tuyển không?',
        'seo_description': 'Ô đồng ý phân tích AI trong form ứng tuyển là tùy chọn. Xem nhà tuyển dụng thấy gì khi bạn đồng ý và khi không đồng ý.',
        'source_reference': 'frontend/src/features/main/application/apply-for-job; frontend/messages shared fit_chip_not_consented*',
        'body': """<p><strong>Không bắt buộc.</strong> Form ứng tuyển có ô cho phép ProCV dùng công nghệ AI để phân tích độ phù hợp CV với tin và hiển thị kết quả cho nhà tuyển dụng.</p>
<ul>
  <li>Lần đầu ứng tuyển, ô này để trống. Các lần sau, ô giữ lựa chọn của lần ứng tuyển gần nhất và bạn vẫn đổi được.</li>
  <li><strong>Khi đồng ý:</strong> nhà tuyển dụng thấy mức phù hợp, lý do và hồ sơ trích xuất từ CV đã nộp.</li>
  <li><strong>Khi không đồng ý:</strong> hồ sơ vẫn hợp lệ như bình thường, chỉ hiện nhãn <em>Không tham gia AI</em> và không có điểm. Nhà tuyển dụng đọc CV gốc.</li>
</ul>
<p>Hồ sơ chưa có điểm được xếp cuối khi nhà tuyển dụng sắp theo <em>Phù hợp nhất</em>, nhưng đó không phải đánh giá kém; mặc định danh sách vẫn xếp theo hồ sơ mới nhất.</p>""",
    },
    # ── Thông báo, email và tin nhắn ──────────────────────────────────────────
    {
        'category': 'thong-bao-email-va-tin-nhan',
        'slug': 'cai-dat-nhan-thong-bao',
        'type': GUIDE,
        'order': 10,
        'title': 'Chọn loại thông báo và kênh nhận',
        'seo_description': 'Tùy chỉnh thông báo trên web và email cho từng sự kiện: nộp hồ sơ, nhà tuyển dụng xem CV, kết quả hồ sơ, lời mời và cơ hội việc làm.',
        'source_reference': 'frontend/src/features/main/account/configure-email-notifications; frontend/src/pages/main/account/EmailNotificationSettings.jsx',
        'body': """<p>Mở <strong>Cài đặt email &amp; thông báo › Cài đặt nhận thông báo</strong> trong tài khoản để chọn kênh nhận cho từng loại thông báo.</p>
<h2>Hồ sơ ứng tuyển</h2>
<ul>
  <li><strong>Nộp hồ sơ thành công</strong>: xác nhận ngay khi bạn ứng tuyển; có thể kèm gợi ý việc làm tương tự trong email.</li>
  <li><strong>Nhà tuyển dụng xem hoặc tải CV</strong>: biết khi hồ sơ đang được quan tâm.</li>
  <li><strong>Kết quả xử lý hồ sơ</strong>: phù hợp, mời phỏng vấn, trúng tuyển hoặc chưa phù hợp. Đây là thông tin bắt buộc nên luôn được gửi.</li>
  <li><strong>Lời mời ứng tuyển từ nhà tuyển dụng</strong>: khi bạn được lưu vào kho ứng viên và được mời vào vị trí mới.</li>
</ul>
<h2>Email cơ hội việc làm</h2>
<ul>
  <li>Việc làm phù hợp với hồ sơ của bạn.</li>
  <li>Việc làm mới từ công ty đang theo dõi.</li>
  <li>Việc làm theo thông báo bạn đã tạo.</li>
</ul>
<p>Thông báo trên web nằm ở biểu tượng chuông; chọn <strong>Đánh dấu đã đọc</strong> để dọn danh sách. Nếu quản trị viên tạm tắt email toàn hệ thống, thông báo trên web vẫn hoạt động và lựa chọn email của bạn được giữ nguyên.</p>""",
    },
    {
        'category': 'thong-bao-email-va-tin-nhan',
        'slug': 'tao-thong-bao-viec-lam-theo-tieu-chi',
        'type': GUIDE,
        'order': 11,
        'title': 'Tạo thông báo việc làm theo tiêu chí',
        'seo_description': 'Nhận email việc làm mới theo vị trí, ngành nghề, địa điểm, kinh nghiệm và mức lương bạn chọn, hằng ngày hoặc hằng tuần.',
        'source_reference': 'frontend/src/features/main/job/manage-job-alerts; backend/apps/jobs/services/alerts.py (job_alert_limit_per_candidate, job_alert_delivery_hour)',
        'body': """<p>Thông báo việc làm giúp bạn nhận tin mới khớp tiêu chí mà không phải tìm lại mỗi ngày.</p>
<ol>
  <li>Mở <strong>Cài đặt email &amp; thông báo › Cài đặt thông báo việc làm</strong>.</li>
  <li>Bật <strong>Nhận thông báo việc làm theo thiết lập</strong> (công tắc chung cho mọi bộ tiêu chí).</li>
  <li>Tạo bộ tiêu chí: tên vị trí hoặc công ty, ngành nghề, địa điểm, kinh nghiệm, mức lương, loại hình công việc, hình thức làm việc.</li>
  <li>Chọn tần suất <strong>Hàng ngày</strong> hoặc <strong>Hàng tuần</strong> rồi lưu.</li>
</ol>
<h2>Lưu ý</h2>
<ul>
  <li>Mỗi tài khoản có số bộ tiêu chí tối đa (mặc định 5). Khi đã dùng hết, sửa hoặc xóa một bộ cũ trước khi tạo mới.</li>
  <li>Email chỉ được gửi tới email đăng nhập đã xác thực.</li>
  <li>Tắt công tắc chung thì các tiêu chí vẫn được giữ nguyên để bật lại sau.</li>
</ul>
<p>Ngoài ra, công tắc <strong>Nhận thông báo việc làm phù hợp</strong> gửi bản tổng hợp gợi ý dựa trên nhu cầu công việc và CV vào sáng thứ Hai hằng tuần.</p>""",
    },
    {
        'category': 'thong-bao-email-va-tin-nhan',
        'slug': 'nhan-tin-voi-nha-tuyen-dung-qua-procv-connect',
        'type': GUIDE,
        'order': 12,
        'title': 'Nhắn tin với nhà tuyển dụng qua ProCV Connect',
        'seo_description': 'Trao đổi trực tiếp với nhà tuyển dụng về tin bạn đã ứng tuyển: gửi tin nhắn, CV, tệp, chặn tin nhắn và quyền riêng tư.',
        'source_reference': 'docs/01-phan-tich/dac-ta-procv-connect.md; docs/adr/adr-0032-procv-connect-messaging.md',
        'body': """<p><strong>ProCV Connect</strong> cho phép bạn và nhà tuyển dụng trao đổi về một tin tuyển dụng mà không phải chia sẻ số điện thoại hay email trước khi cần. Mỗi cặp tin – ứng viên có một cuộc trò chuyện.</p>
<h2>Bắt đầu trò chuyện</h2>
<ul>
  <li>Bạn mở được khi có hồ sơ hiện hành vào tin (chưa rút): bấm <strong>Nhắn tin</strong> ở thẻ trong <a href="/tai-khoan/viec-lam-da-ung-tuyen">Việc làm đã ứng tuyển</a>.</li>
  <li>Nhà tuyển dụng cũng có thể mở trò chuyện sau khi bạn đồng ý lời mời kết nối.</li>
</ul>
<h2>Gửi được gì?</h2>
<ul>
  <li>Tin nhắn chữ tối đa 2.000 ký tự, kèm emoji.</li>
  <li>Một CV trong thư viện của bạn.</li>
  <li>Tệp PDF, DOCX hoặc ảnh PNG, JPG, WEBP tối đa 10 MB.</li>
</ul>
<p>Khi nhà tuyển dụng chưa trả lời lần nào, bạn gửi được tối đa 3 tin; họ trả lời một lần thì giới hạn này được bỏ.</p>
<h2>Quyền riêng tư</h2>
<ul>
  <li>Email nhắc tin chưa đọc chỉ ghi số tin mới, người gửi và tin tuyển dụng, không kèm nội dung.</li>
  <li><strong>Xóa cuộc trò chuyện</strong> chỉ ẩn ở phía bạn; <strong>Chặn tin nhắn</strong> khiến không bên nào gửi được cho tới khi bạn bỏ chặn.</li>
  <li>Khi hồ sơ được báo <em>Chưa phù hợp</em>, cuộc trò chuyện chuyển sang chỉ đọc.</li>
</ul>""",
    },
    {
        'category': 'thong-bao-email-va-tin-nhan',
        'slug': 'phan-hoi-lich-hen-phong-van',
        'type': FAQ,
        'order': 13,
        'title': 'Phản hồi lịch hẹn phỏng vấn trong ProCV Connect thế nào?',
        'seo_description': 'Nhà tuyển dụng gửi lịch phỏng vấn qua ProCV Connect. Bạn có thể chấp nhận, từ chối hoặc đề nghị giờ khác và nhận lời nhắc trước buổi hẹn.',
        'source_reference': 'docs/01-phan-tich/dac-ta-procv-connect.md mục 6; frontend/src/features/main/messaging/respond-interview',
        'body': """<p>Lịch hẹn hiện thành một thẻ trong cuộc trò chuyện, gồm thời gian, thời lượng, hình thức (trực tiếp, online hoặc điện thoại), địa điểm hoặc link họp và ghi chú. Khi nhận lịch, hồ sơ của bạn chuyển sang <em>Mời phỏng vấn</em>.</p>
<ul>
  <li><strong>Chấp nhận</strong>: hai bên nhận email kèm tệp lịch <code>.ics</code> để thêm vào lịch cá nhân; hệ thống nhắc trước 24 giờ và 1 giờ.</li>
  <li><strong>Từ chối</strong>: nhà tuyển dụng được báo ngay.</li>
  <li><strong>Đề nghị giờ khác</strong>: kèm ghi chú khung giờ bạn rảnh; nhà tuyển dụng gửi lịch mới thay lịch cũ.</li>
</ul>
<p>Nhà tuyển dụng có thể đổi giờ hoặc hủy lịch trước giờ hẹn; mọi thay đổi đều hiện trong cuộc trò chuyện và chuông thông báo. Sau buổi phỏng vấn, nếu lâu chưa có kết quả, bạn có thể dùng nút <strong>Nhắc NTD</strong>.</p>""",
    },
]
