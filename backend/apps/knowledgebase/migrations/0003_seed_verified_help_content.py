import re
from datetime import timedelta
from hashlib import sha256
from html import unescape

from django.db import migrations
from django.utils import timezone

ARTICLES = (
    {
        'category': 'tai-khoan-va-dang-nhap',
        'slug': 'dang-ky-dang-nhap-va-khoi-phuc-tai-khoan',
        'type': 'GUIDE',
        'title': 'Đăng ký, đăng nhập và khôi phục tài khoản ứng viên',
        'seo_description': 'Hướng dẫn đăng ký tài khoản ProCV, xác thực email, đăng nhập và đặt lại mật khẩu an toàn.',
        'source': 'frontend/src/pages/main/auth/Register.jsx; frontend/src/pages/main/auth/ForgotPassword.jsx; frontend/src/pages/main/auth/VerifyEmail.jsx; frontend/src/app/router/routes/main.routes.jsx',
        'body': """
<p>Bạn có thể tạo tài khoản ứng viên bằng email hoặc tài khoản Google ngay trên ProCV. Các bước dưới đây bám theo đúng màn hình hiện có của hệ thống.</p>
<h2>Đăng ký tài khoản mới</h2>
<ol>
  <li>Mở trang <a href="/sign-up">Đăng ký</a>.</li>
  <li>Chọn đăng ký bằng Google, hoặc chọn <strong>Đăng ký bằng email</strong>.</li>
  <li>Nếu dùng email, nhập họ tên, email và mật khẩu theo các yêu cầu hiển thị trên biểu mẫu.</li>
  <li>Đọc, đồng ý với các điều khoản bắt buộc rồi gửi biểu mẫu. Sau khi đăng ký thành công, hệ thống đăng nhập tài khoản và đưa bạn tới bước phù hợp tiếp theo.</li>
</ol>
<blockquote>Hãy dùng email bạn đang truy cập được. ProCV kiểm tra email đã được sử dụng hay chưa trước khi gửi biểu mẫu, nhưng kết quả cuối cùng vẫn do máy chủ xác nhận.</blockquote>
<h2>Xác thực email</h2>
<p>Sau khi đăng ký, mở email xác thực ProCV gửi và truy cập liên kết trong thư. Bạn cũng có thể vào <a href="/tai-khoan/xac-thuc-email">Xác thực email</a> khi đã đăng nhập để kiểm tra trạng thái hoặc yêu cầu gửi lại thư.</p>
<p>Nếu chưa thấy thư, hãy kiểm tra Spam/Thư rác và chắc chắn địa chỉ email trong tài khoản là chính xác.</p>
<h2>Đăng nhập và quên mật khẩu</h2>
<p>Mở <a href="/login">Đăng nhập</a> để dùng email, mật khẩu hoặc phương thức đăng nhập mạng xã hội đã liên kết.</p>
<p>Nếu quên mật khẩu, mở <a href="/forgot-password">Quên mật khẩu</a>, nhập email đăng ký và làm theo liên kết được gửi qua email. Vì lý do bảo mật, màn hình luôn dùng cùng một thông báo dù email có tồn tại hay không. Liên kết đặt lại mật khẩu hiện có hiệu lực trong 30 phút.</p>
<h3>Khi vẫn chưa truy cập được tài khoản</h3>
<ul>
  <li>Không chia sẻ mật khẩu hoặc mã xác minh cho người khác.</li>
  <li>Thử lại sau nếu hệ thống báo thao tác quá nhanh.</li>
  <li>Liên hệ bộ phận hỗ trợ và chỉ cung cấp thông tin cần thiết để xác minh sự cố.</li>
</ul>""",
    },
    {
        'category': 'bao-mat-va-quyen-rieng',
        'slug': 'bao-ve-tai-khoan-va-xac-minh-hai-buoc',
        'type': 'GUIDE',
        'title': 'Bảo vệ tài khoản và bật xác minh hai bước',
        'seo_description': 'Các bước đổi mật khẩu, bật xác minh hai bước và xử lý khi nghi ngờ tài khoản ProCV bị truy cập trái phép.',
        'source': 'frontend/src/pages/main/account/ChangePassword.jsx; frontend/src/pages/main/account/TwoFactorAuthentication.jsx; frontend/src/entities/account/config/candidate-menu.jsx',
        'body': """
<p>Mật khẩu riêng và xác minh hai bước giúp giảm rủi ro người khác truy cập tài khoản của bạn.</p>
<h2>Đổi mật khẩu</h2>
<ol>
  <li>Đăng nhập tài khoản ứng viên.</li>
  <li>Mở <a href="/tai-khoan/doi-mat-khau">Đổi mật khẩu</a> trong nhóm <strong>Cá nhân &amp; Bảo mật</strong>.</li>
  <li>Làm theo biểu mẫu và hoàn tất bước xác thực lại nếu hệ thống yêu cầu.</li>
</ol>
<p>Dùng mật khẩu dài, khác với mật khẩu email và không gửi mật khẩu qua tin nhắn. Nếu bạn không còn nhớ mật khẩu hiện tại, dùng quy trình <a href="/forgot-password">Quên mật khẩu</a>.</p>
<h2>Bật xác minh hai bước</h2>
<ol>
  <li>Mở <a href="/tai-khoan/xac-minh-hai-buoc">Xác minh hai bước</a>.</li>
  <li>Chọn bật tính năng. Hệ thống gửi mã xác minh tới email của tài khoản.</li>
  <li>Nhập mã theo thời hạn hiển thị để hoàn tất.</li>
</ol>
<p>Bạn cũng cần mã xác minh qua email khi tắt tính năng. Không cung cấp mã này cho bất kỳ ai.</p>
<h2>Khi nghi ngờ tài khoản bị truy cập trái phép</h2>
<ul>
  <li>Đổi ngay mật khẩu ProCV và mật khẩu email liên quan.</li>
  <li>Bật xác minh hai bước nếu chưa bật.</li>
  <li>Kiểm tra thông tin cá nhân, CV và hoạt động ứng tuyển để nhận biết thay đổi không do bạn thực hiện.</li>
  <li>Liên hệ hỗ trợ, nêu thời điểm và dấu hiệu bất thường; không gửi mật khẩu hoặc mã xác minh.</li>
</ul>""",
    },
    {
        'category': 'tim-viec-va-goi-y-viec-lam',
        'slug': 'tim-kiem-luu-va-xem-viec-lam-phu-hop',
        'type': 'GUIDE',
        'title': 'Tìm kiếm, lưu và xem việc làm phù hợp',
        'seo_description': 'Hướng dẫn tìm việc theo từ khóa, địa điểm, bộ lọc, lưu tin và sử dụng gợi ý việc làm trên ProCV.',
        'source': 'frontend/src/pages/main/jobs/model/use-job-list-filters.js; frontend/src/pages/main/jobs/ui/JobSearchBar.jsx; frontend/src/features/saved-jobs; frontend/src/pages/main/account/MatchingJobs.jsx',
        'body': """
<p>ProCV cho phép tìm việc theo nhu cầu hiện tại, lưu tin để xem lại và nhận danh sách gợi ý sau khi bạn chủ động cấu hình.</p>
<h2>Tìm việc theo từ khóa và địa điểm</h2>
<ol>
  <li>Mở trang <a href="/viec-lam">Việc làm</a>.</li>
  <li>Nhập từ khóa, chọn địa điểm rồi bấm tìm kiếm.</li>
  <li>Dùng các bộ lọc ngành nghề, kinh nghiệm, mức lương, loại công việc hoặc hình thức làm việc để thu hẹp kết quả.</li>
  <li>Mở một tin để đọc mô tả, yêu cầu, quyền lợi, địa điểm và thông tin nhà tuyển dụng trước khi ứng tuyển.</li>
</ol>
<h2>Lưu tin tuyển dụng</h2>
<p>Bấm biểu tượng trái tim hoặc nút <strong>Lưu tin</strong> trên danh sách hay trang chi tiết. Khách chưa đăng nhập sẽ được yêu cầu đăng nhập trước. Danh sách đã lưu nằm tại <a href="/viec-lam-da-luu">Việc làm đã lưu</a>.</p>
<h2>Thiết lập gợi ý phù hợp</h2>
<p>Trong tài khoản, mở <a href="/tai-khoan/cai-dat-goi-y-viec-lam">Cài đặt gợi ý việc làm</a> để cập nhật vị trí, kinh nghiệm, mức lương và địa điểm mong muốn. Hệ thống chỉ dùng nhu cầu và CV để xếp hạng sau khi bạn đồng ý; bạn có thể thay đổi hoặc rút lại lựa chọn này.</p>
<p>Danh sách tại <a href="/tai-khoan/viec-lam-phu-hop">Việc làm phù hợp với bạn</a> hiển thị điểm phù hợp và lý do tính điểm. Nếu chưa có CV, kết quả có thể chỉ dựa trên nhu cầu công việc đã lưu.</p>
<blockquote>Điểm phù hợp là công cụ hỗ trợ sàng lọc, không phải cam kết tuyển dụng. Luôn đọc đầy đủ tin và tự đánh giá trước khi nộp hồ sơ.</blockquote>""",
    },
    {
        'category': 'ung-tuyen-va-theo-doi-ho-so',
        'slug': 'ung-tuyen-va-theo-doi-ho-so',
        'type': 'GUIDE',
        'title': 'Ứng tuyển và theo dõi hồ sơ đã nộp',
        'seo_description': 'Cách chọn CV, nộp hồ sơ và theo dõi các mốc xử lý hồ sơ ứng tuyển trên ProCV.',
        'source': 'frontend/src/features/apply-for-job/ui/ApplyForJobModal.jsx; frontend/src/features/apply-for-job/model/use-apply-form.js; frontend/src/pages/main/account/AppliedJobs.jsx',
        'body': """
<p>Trước khi nộp hồ sơ, hãy đọc kỹ tin tuyển dụng, kiểm tra nhà tuyển dụng và chuẩn bị CV phù hợp với vị trí.</p>
<h2>Nộp hồ sơ ứng tuyển</h2>
<ol>
  <li>Mở một tin tuyển dụng và chọn <strong>Ứng tuyển</strong>. Bạn cần đăng nhập bằng tài khoản ứng viên.</li>
  <li>Chọn một CV đã có trên tài khoản, hoặc tải tệp PDF/DOCX từ máy tính theo lựa chọn trong biểu mẫu.</li>
  <li>Nếu vị trí có nhiều nơi làm việc, chọn địa điểm mong muốn.</li>
  <li>Có thể viết thư giới thiệu ngắn, kiểm tra thông tin liên hệ và các lựa chọn đồng ý xử lý dữ liệu.</li>
  <li>Bấm <strong>Nộp hồ sơ ứng tuyển</strong> và chờ thông báo thành công.</li>
</ol>
<p>Hãy kiểm tra đúng phiên bản CV trước khi gửi. Bản CV đã nộp được giữ cùng hồ sơ ứng tuyển để bạn xem lại.</p>
<h2>Theo dõi hồ sơ</h2>
<p>Mở <a href="/tai-khoan/viec-lam-da-ung-tuyen">Việc làm đã ứng tuyển</a>. Trang hiển thị tin đã ứng tuyển, CV đã nộp, trạng thái hiện tại và tiến trình do nhà tuyển dụng cập nhật.</p>
<p>Các mốc có thể gồm gửi hồ sơ, nhà tuyển dụng tiếp nhận, xem, xử lý và phản hồi. Việc hiển thị một mốc không bảo đảm bạn sẽ được mời phỏng vấn.</p>
<h2>Ứng tuyển lại</h2>
<p>Nếu hệ thống cho phép ứng tuyển lại, màn hình sẽ hiển thị số lượt còn lại và cảnh báo cân nhắc. Chỉ nộp lại khi bạn có thay đổi thực sự cần thiết để tránh làm giảm tính chuyên nghiệp của hồ sơ.</p>""",
    },
    {
        'category': 'cv-va-mau-cv',
        'slug': 'tao-chinh-sua-va-quan-ly-cv',
        'type': 'GUIDE',
        'title': 'Tạo, chỉnh sửa và quản lý CV trên ProCV',
        'seo_description': 'Hướng dẫn chọn mẫu, tạo, chỉnh sửa, xem và quản lý CV đã tạo hoặc tải lên ProCV.',
        'source': 'frontend/src/pages/main/cv-templates/TemplateCatalog.jsx; frontend/src/pages/main/cv-templates/TemplateDetail.jsx; frontend/src/pages/main/account/MyCvs.jsx; frontend/src/pages/main/account/ui/UserCvCard.jsx',
        'body': """
<p>Bạn có thể bắt đầu từ mẫu có sẵn hoặc tải CV PDF/DOCX để quản lý cùng tài khoản.</p>
<h2>Chọn mẫu và tạo CV</h2>
<ol>
  <li>Mở <a href="/mau-cv">Mẫu CV</a> và chọn ngôn ngữ hoặc nhóm mẫu phù hợp.</li>
  <li>Mở trang chi tiết mẫu để xem trước, sau đó chọn tạo CV.</li>
  <li>Đăng nhập nếu được yêu cầu. Hệ thống tạo CV trong tài khoản và mở trình chỉnh sửa.</li>
  <li>Điền nội dung, kiểm tra bố cục và lưu các thay đổi trước khi rời trang.</li>
</ol>
<h2>Quản lý CV</h2>
<p>Mở <a href="/tai-khoan/cv-cua-toi">CV của tôi</a> để xem hai nhóm: CV tạo trên ProCV và CV tải lên. Tại đây bạn có thể tạo thêm CV, tải tệp PDF/DOCX, mở xem hoặc chỉnh sửa CV thuộc quyền sở hữu của mình.</p>
<h2>Dùng CV để ứng tuyển</h2>
<p>Khi bấm ứng tuyển một việc làm, biểu mẫu hiển thị các CV sẵn có để bạn chọn. Hãy mở xem lại CV, kiểm tra chức danh, kinh nghiệm và thông tin liên hệ trước khi nộp.</p>
<h3>Mẹo trước khi hoàn tất</h3>
<ul>
  <li>Ưu tiên nội dung liên quan trực tiếp đến vị trí ứng tuyển.</li>
  <li>Kiểm tra lỗi chính tả, thứ tự thời gian và thông tin liên hệ.</li>
  <li>Không đưa dữ liệu nhạy cảm không cần thiết vào CV.</li>
</ul>""",
    },
    {
        'category': 'tim-viec-an-toan',
        'slug': 'nhan-dien-va-bao-cao-tin-tuyen-dung-rui-ro',
        'type': 'GUIDE',
        'title': 'Nhận diện và báo cáo tin tuyển dụng có rủi ro',
        'seo_description': 'Dấu hiệu cảnh báo lừa đảo tuyển dụng, cách tự bảo vệ và báo cáo tin đáng ngờ trên ProCV.',
        'source': 'frontend/src/pages/main/jobs/JobDetail.jsx; frontend/src/pages/main/jobs/ui/job-detail/JobDetailContent.jsx; frontend/src/features/report-job/ui/ReportJobModal.jsx; frontend/src/features/apply-for-job/ui/ApplyForJobModal.jsx',
        'body': """
<p>Không chuyển tiền, cung cấp mật khẩu hay mã xác minh chỉ để được ứng tuyển. Chủ động kiểm tra công ty và vị trí trước mọi cuộc trao đổi ngoài nền tảng.</p>
<h2>Dấu hiệu cần thận trọng</h2>
<ul>
  <li>Yêu cầu đóng phí, đặt cọc, mua hàng, nạp tiền hoặc chuyển tiền để nhận việc.</li>
  <li>Đề nghị thu nhập bất thường nhưng mô tả công việc mơ hồ hoặc né tránh hợp đồng.</li>
  <li>Liên hệ từ tài khoản cá nhân không thể xác minh, thúc ép quyết định ngay.</li>
  <li>Yêu cầu mật khẩu, mã OTP, mã xác minh email hoặc thông tin tài chính không cần thiết.</li>
  <li>Đường dẫn, địa chỉ phỏng vấn hay danh tính công ty không khớp với thông tin công khai.</li>
</ul>
<h2>Cách kiểm tra trước khi ứng tuyển</h2>
<ol>
  <li>Đọc toàn bộ mô tả, yêu cầu, địa điểm và thông tin nhà tuyển dụng trên tin.</li>
  <li>Tìm website, địa chỉ và kênh liên hệ chính thức của công ty bằng nguồn độc lập.</li>
  <li>Không cài ứng dụng lạ hoặc chia sẻ màn hình theo yêu cầu không rõ mục đích.</li>
  <li>Giữ lại tin nhắn, email, đường dẫn và chứng từ nếu phát hiện dấu hiệu đáng ngờ.</li>
</ol>
<h2>Báo cáo trên ProCV</h2>
<p>Tại trang chi tiết việc làm, chọn liên kết <strong>hãy phản ánh với chúng tôi</strong> trong khu vực báo cáo tin tuyển dụng. Đăng nhập bằng tài khoản ứng viên, chọn lý do, mô tả ngắn gọn và gửi báo cáo. Quản trị viên sẽ xem xét trước khi kết luận.</p>
<p>Bạn cũng có thể dùng email hỗ trợ hiển thị trong biểu mẫu ứng tuyển. Gửi URL tin, tên công ty, thời điểm liên hệ và bằng chứng liên quan; che dữ liệu tài chính hoặc thông tin nhạy cảm không cần thiết.</p>
<blockquote>Nếu đã chuyển tiền hoặc lộ thông tin tài chính, hãy liên hệ ngay ngân hàng và cơ quan có thẩm quyền. Báo cáo cho ProCV giúp xử lý nội dung trên nền tảng nhưng không thay thế các bước bảo vệ tài khoản và tài sản của bạn.</blockquote>""",
    },
    {
        'category': 'lien-he-ho-tro',
        'slug': 'gui-yeu-cau-ho-tro-hieu-qua',
        'type': 'FAQ',
        'title': 'Cần cung cấp gì để được ProCV hỗ trợ nhanh hơn?',
        'seo_description': 'Các kênh liên hệ và danh sách thông tin cần chuẩn bị khi gửi yêu cầu hỗ trợ ProCV.',
        'source': 'frontend/src/widgets/floating-actions/FloatingActions.jsx; frontend/src/features/submit-feedback/ui/FeedbackModal.jsx; frontend/src/entities/site-settings/model/site-settings-context.js',
        'body': """
<p>Bạn có thể mở nút <strong>Hỗ trợ</strong> ở góc màn hình để xem các kênh ProCV đang cung cấp. Kênh Zalo, hotline và email phụ thuộc cấu hình hiển thị tại thời điểm bạn truy cập.</p>
<h2>Thông tin nên chuẩn bị</h2>
<ul>
  <li>Email tài khoản và vai trò đang sử dụng; không gửi mật khẩu hay mã xác minh.</li>
  <li>URL trang hoặc mã nhận diện hiển thị trên màn hình liên quan.</li>
  <li>Thời điểm xảy ra, các bước đã thao tác và thông báo lỗi nguyên văn.</li>
  <li>Ảnh chụp đã che số điện thoại, địa chỉ, giấy tờ và dữ liệu không cần thiết.</li>
  <li>Kết quả bạn mong muốn để đội hỗ trợ xác định đúng phạm vi.</li>
</ul>
<h2>Chọn đúng kênh</h2>
<p>Dùng email hoặc Zalo hỗ trợ cho sự cố cần trao đổi. Dùng nút <strong>Góp ý</strong> để gửi nhận xét, đề xuất hoặc phản hồi về sản phẩm. Góp ý được gửi tới ProCV, không phải nhà tuyển dụng.</p>
<h2>Bảo vệ dữ liệu khi yêu cầu hỗ trợ</h2>
<p>Không gửi mật khẩu, mã OTP, mã xác minh email, thông tin thẻ hoặc toàn bộ giấy tờ tùy thân. Chỉ cung cấp dữ liệu tối thiểu cần thiết và kiểm tra đúng kênh liên hệ đang hiển thị trên website ProCV.</p>""",
    },
)


def _stable_public_id(prefix, value):
    return f'{prefix}_{sha256(value.encode()).hexdigest()[:12]}'


def _plain_text(body):
    return re.sub(r'\s+', ' ', unescape(re.sub(r'<[^>]+>', ' ', body))).strip()


def seed_verified_help_content(apps, schema_editor):
    category_model = apps.get_model('knowledgebase', 'KnowledgeCategory')
    article_model = apps.get_model('knowledgebase', 'KnowledgeArticle')
    revision_model = apps.get_model('knowledgebase', 'KnowledgeArticleRevision')
    published_at = timezone.now()

    for order, item in enumerate(ARTICLES, start=10):
        category = category_model.objects.get(slug=item['category'])
        article, created = article_model.objects.get_or_create(
            category=category,
            slug=item['slug'],
            defaults={
                'public_id': _stable_public_id('kba', item['slug']),
                'article_type': item['type'],
                'order': order,
                'lifecycle_state': 'ACTIVE',
                'first_published_at': published_at,
                'current_published_at': published_at,
                'review_due_at': published_at + timedelta(days=category.review_interval_days),
            },
        )
        if not created:
            # Nội dung admin đã có là nguồn chuẩn; migration không ghi đè.
            continue

        body = item['body'].strip()
        revision = revision_model.objects.create(
            public_id=_stable_public_id('kbr', item['slug']),
            article=article,
            number=1,
            status='APPROVED',
            title=item['title'],
            body=body,
            body_plain_text=_plain_text(body),
            content_hash=sha256(f'{item["title"]}\n{body}'.encode()).hexdigest(),
            seo_title=item['title'],
            seo_description=item['seo_description'],
            change_summary='Nội dung khởi tạo đã đối chiếu với route và hành vi KB-P5.',
            source_reference=item['source'],
            submitted_at=published_at,
            reviewed_at=published_at,
            first_published_at=published_at,
        )
        article.published_revision_id = revision.id
        article.save(update_fields=['published_revision'])


def keep_verified_content(apps, schema_editor):
    # Dữ liệu có thể đã nhận revision mới sau rollout. Rollback code không được
    # hard-delete nội dung, lịch sử hoặc con trỏ publish của quản trị viên.
    return None


class Migration(migrations.Migration):
    dependencies = [('knowledgebase', '0002_seed_knowledgebase')]

    operations = [migrations.RunPython(seed_verified_help_content, keep_verified_content)]
