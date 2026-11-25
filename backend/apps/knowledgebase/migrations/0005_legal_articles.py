"""Bài Điều khoản sử dụng và Chính sách quyền riêng tư cho ứng viên.

Đặt trong Trung tâm trợ giúp để quản trị viên sửa bằng trình biên tập sẵn có
(nháp → xuất bản, lịch sử phiên bản). ``legal_terms_url``/``legal_privacy_url``
trỏ tới hai bài này. Idempotent: bỏ qua bài đã có cùng slug.
"""

from datetime import timedelta
from hashlib import sha256
from uuid import uuid4

from django.db import migrations
from django.utils import timezone

from common.html.plain_text import html_plain_text

CATEGORY = {
    'slug': 'dieu-khoan-va-chinh-sach',
    'name': 'Điều khoản và chính sách',
    'description': 'Điều khoản sử dụng, chính sách quyền riêng tư và quyền với dữ liệu cá nhân.',
    'order': 8,
}
SOURCE = (
    'Nghị định 13/2023/NĐ-CP; backend/apps/privacy (yêu cầu xóa tài khoản/xuất dữ liệu); '
    'frontend/src/pages/main/legal/CookiePolicy.jsx'
)

TERMS_BODY = """<p>Điều khoản này áp dụng khi bạn tạo tài khoản ứng viên và dùng các dịch vụ tìm việc, tạo CV, ứng tuyển trên ProCV. Khi đăng ký hoặc tiếp tục sử dụng, bạn đồng ý với điều khoản này và <a href="/tro-giup/dieu-khoan-va-chinh-sach/chinh-sach-quyen-rieng-tu">Chính sách quyền riêng tư</a>.</p>
<h2>1. Tài khoản</h2>
<ul>
  <li>Bạn cung cấp thông tin trung thực, tự bảo mật mật khẩu và chịu trách nhiệm về hoạt động trên tài khoản của mình.</li>
  <li>Mỗi email chỉ có một tài khoản ứng viên. Tài khoản nhà tuyển dụng là tài khoản riêng, có điều khoản riêng.</li>
  <li>Báo ngay cho ProCV khi nghi ngờ tài khoản bị truy cập trái phép.</li>
</ul>
<h2>2. CV và nội dung bạn đăng</h2>
<ul>
  <li>Bạn giữ quyền với CV và nội dung của mình, đồng thời cho phép ProCV lưu trữ, hiển thị và xử lý chúng để cung cấp dịch vụ.</li>
  <li>Không đăng thông tin sai sự thật, nội dung vi phạm pháp luật, xâm phạm quyền của người khác hoặc dữ liệu cá nhân của người khác khi chưa được đồng ý.</li>
  <li>CV chỉ được gửi tới nhà tuyển dụng khi bạn ứng tuyển, hoặc khi bạn bật cho phép nhà tuyển dụng tìm thấy hồ sơ.</li>
</ul>
<h2>3. Ứng tuyển và liên hệ với nhà tuyển dụng</h2>
<p>Nhà tuyển dụng tự chịu trách nhiệm về tin tuyển dụng và quyết định tuyển dụng. ProCV kiểm duyệt tin nhưng không bảo đảm kết quả ứng tuyển. Không nộp tiền, đặt cọc hay cung cấp giấy tờ gốc cho bất kỳ ai để được nhận việc; hãy báo cáo tin có dấu hiệu lừa đảo ngay trên trang tin.</p>
<h2>4. Tính năng dùng AI</h2>
<p>Các gợi ý việc làm, đánh giá mức độ phù hợp và hỗ trợ viết CV do AI tạo ra chỉ mang tính tham khảo. Bạn nên tự kiểm tra lại trước khi dùng.</p>
<h2>5. Hành vi bị cấm</h2>
<ul>
  <li>Thu thập dữ liệu tự động, dò quét hoặc can thiệp vào hệ thống.</li>
  <li>Mạo danh người khác, tạo nhiều tài khoản để lách giới hạn hoặc gửi thư rác.</li>
  <li>Sử dụng thông tin trên ProCV cho mục đích trái pháp luật.</li>
</ul>
<p>ProCV có thể tạm khóa hoặc chấm dứt tài khoản vi phạm và sẽ thông báo lý do trong phạm vi pháp luật cho phép.</p>
<h2>6. Chấm dứt sử dụng</h2>
<p>Bạn có thể ngừng sử dụng và gửi yêu cầu xóa tài khoản bất cứ lúc nào tại <a href="/tai-khoan/cai-dat-bao-mat">Cài đặt bảo mật</a>. Cách ProCV xử lý dữ liệu sau khi xóa được mô tả trong Chính sách quyền riêng tư.</p>
<h2>7. Thay đổi điều khoản</h2>
<p>Khi điều khoản thay đổi đáng kể, ProCV thông báo trên website hoặc qua email trước khi áp dụng. Mọi thắc mắc vui lòng gửi qua <a href="/tro-giup/lien-he-ho-tro">Liên hệ hỗ trợ</a>.</p>"""

PRIVACY_BODY = """<p>ProCV tôn trọng và bảo vệ dữ liệu cá nhân của ứng viên theo Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân. Chính sách này cho biết chúng tôi thu thập gì, dùng vào việc gì, chia sẻ với ai và bạn có những quyền gì.</p>
<h2>1. Dữ liệu chúng tôi thu thập</h2>
<ul>
  <li><strong>Thông tin tài khoản:</strong> họ tên, email, số điện thoại, ảnh đại diện, thông tin đăng nhập qua Google hoặc mạng xã hội nếu bạn chọn.</li>
  <li><strong>Hồ sơ và CV:</strong> học vấn, kinh nghiệm, kỹ năng, mong muốn công việc, file CV bạn tải lên hoặc tạo trên ProCV.</li>
  <li><strong>Hoạt động:</strong> việc làm đã xem, đã lưu, đã ứng tuyển, công ty theo dõi, thiết bị và phiên đăng nhập.</li>
  <li><strong>Cookie:</strong> xem <a href="/chinh-sach-cookie">Chính sách cookie</a>.</li>
</ul>
<h2>2. Mục đích xử lý</h2>
<ul>
  <li>Tạo và bảo vệ tài khoản, cung cấp công cụ tạo CV và ứng tuyển.</li>
  <li>Gửi hồ sơ tới nhà tuyển dụng khi bạn ứng tuyển.</li>
  <li>Gợi ý việc làm phù hợp và giúp nhà tuyển dụng tìm thấy bạn nếu bạn bật tùy chọn này.</li>
  <li>Gửi thông báo, email theo cài đặt của bạn; phòng chống gian lận và lừa đảo.</li>
</ul>
<h2>3. Xử lý bằng AI</h2>
<p>ProCV dùng mô hình AI tự vận hành để đối sánh CV với tin tuyển dụng. Một số tính năng gọi dịch vụ AI bên ngoài (Google Gemini) theo gói trả phí, theo đó nhà cung cấp không dùng dữ liệu gửi lên để huấn luyện mô hình. Bạn có thể tắt việc cho phép phân tích bằng AI khi ứng tuyển.</p>
<h2>4. Chia sẻ dữ liệu</h2>
<ul>
  <li><strong>Nhà tuyển dụng:</strong> chỉ nhận CV và thông tin liên hệ bạn gửi khi ứng tuyển, hoặc hồ sơ bạn cho phép tìm kiếm. Nhà tuyển dụng phải cam kết xử lý dữ liệu ứng viên đúng mục đích tuyển dụng.</li>
  <li><strong>Nhà cung cấp hạ tầng:</strong> lưu trữ, gửi email, AI, chỉ trong phạm vi cần để vận hành dịch vụ.</li>
  <li><strong>Cơ quan nhà nước:</strong> khi có yêu cầu hợp pháp.</li>
</ul>
<p>ProCV không bán dữ liệu cá nhân của bạn.</p>
<h2>5. Thời gian lưu trữ</h2>
<p>Dữ liệu được lưu trong thời gian bạn còn sử dụng tài khoản. Khi bạn xóa tài khoản: CV trong thư viện bị xóa vĩnh viễn, hồ sơ ứng viên bị xóa, thông tin tài khoản được ẩn danh hóa. Bản CV đã nộp cho một tin tuyển dụng thuộc hồ sơ tuyển dụng của nhà tuyển dụng đó và được giữ theo nghĩa vụ của họ. Nhật ký bảo mật và kiểm toán chỉ giữ mã tài khoản, không giữ nội dung hồ sơ.</p>
<h2>6. Quyền của bạn</h2>
<p>Bạn có quyền được biết, đồng ý hoặc rút lại đồng ý, truy cập và chỉnh sửa, yêu cầu xóa, hạn chế xử lý, phản đối xử lý, nhận bản sao dữ liệu và khiếu nại theo Nghị định 13/2023/NĐ-CP.</p>
<ul>
  <li>Chỉnh sửa thông tin cá nhân, CV và cài đặt thông báo ngay trong trang tài khoản.</li>
  <li>Gửi <strong>yêu cầu xuất dữ liệu</strong> hoặc <strong>yêu cầu xóa tài khoản</strong> tại <a href="/tai-khoan/cai-dat-bao-mat">Cài đặt bảo mật</a>. ProCV xử lý trong vòng 72 giờ; bản xuất dữ liệu tải được trong 7 ngày.</li>
</ul>
<h2>7. Bảo mật</h2>
<p>Dữ liệu được mã hóa khi truyền tải, CV lưu ở kho riêng tư và chỉ mở được qua liên kết có thời hạn. Quyền truy cập nội bộ được giới hạn và ghi nhật ký.</p>
<h2>8. Liên hệ</h2>
<p>Câu hỏi về dữ liệu cá nhân vui lòng gửi qua <a href="/tro-giup/lien-he-ho-tro">Liên hệ hỗ trợ</a>. Khi chính sách thay đổi đáng kể, chúng tôi sẽ thông báo trước khi áp dụng.</p>"""

ARTICLES = [
    {
        'slug': 'dieu-khoan-su-dung',
        'order': 1,
        'title': 'Điều khoản sử dụng dành cho ứng viên',
        'seo_description': 'Điều khoản khi tạo tài khoản ứng viên, tạo CV và ứng tuyển trên ProCV.',
        'body': TERMS_BODY,
    },
    {
        'slug': 'chinh-sach-quyen-rieng-tu',
        'order': 2,
        'title': 'Chính sách quyền riêng tư',
        'seo_description': (
            'ProCV thu thập, sử dụng, chia sẻ dữ liệu cá nhân của ứng viên thế nào và cách '
            'bạn yêu cầu xuất dữ liệu hoặc xóa tài khoản.'
        ),
        'body': PRIVACY_BODY,
    },
]


def _public_id(prefix):
    return f'{prefix}_{uuid4().hex[:12]}'


def add_legal_articles(apps, schema_editor):
    Category = apps.get_model('knowledgebase', 'KnowledgeCategory')
    Article = apps.get_model('knowledgebase', 'KnowledgeArticle')
    Revision = apps.get_model('knowledgebase', 'KnowledgeArticleRevision')
    now = timezone.now()
    category = Category.objects.filter(slug=CATEGORY['slug']).first()
    if category is None:
        category = Category.objects.create(public_id=_public_id('kbc'), **CATEGORY)
    for spec in ARTICLES:
        if Article.objects.filter(category=category, slug=spec['slug']).exists():
            continue
        article = Article.objects.create(
            public_id=_public_id('kba'),
            category=category,
            slug=spec['slug'],
            article_type='GUIDE',
            order=spec['order'],
            review_due_at=now + timedelta(days=category.review_interval_days),
            first_published_at=now,
            current_published_at=now,
        )
        revision = Revision.objects.create(
            public_id=_public_id('kbr'),
            article=article,
            number=1,
            status='PUBLISHED',
            title=spec['title'],
            body=spec['body'],
            body_plain_text=html_plain_text(spec['body']),
            content_hash=sha256(f'{spec["title"]}\n{spec["body"]}'.encode()).hexdigest(),
            seo_title=spec['title'],
            seo_description=spec['seo_description'],
            change_summary='Nội dung khởi tạo trước khi ra mắt production.',
            source_reference=SOURCE,
            first_published_at=now,
        )
        article.published_revision = revision
        article.save(update_fields=['published_revision'])


def remove_legal_articles(apps, schema_editor):
    Category = apps.get_model('knowledgebase', 'KnowledgeCategory')
    Article = apps.get_model('knowledgebase', 'KnowledgeArticle')
    category = Category.objects.filter(slug=CATEGORY['slug']).first()
    if category is None:
        return
    articles = Article.objects.filter(category=category, slug__in=[a['slug'] for a in ARTICLES])
    articles.update(published_revision=None)
    articles.delete()
    if not category.articles.exists():
        category.delete()


class Migration(migrations.Migration):
    dependencies = [('knowledgebase', '0004_remove_review_fields')]

    operations = [migrations.RunPython(add_legal_articles, remove_legal_articles)]
