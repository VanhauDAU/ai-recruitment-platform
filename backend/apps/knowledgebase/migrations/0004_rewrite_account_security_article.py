import re
from hashlib import sha256
from html import unescape

from django.db import migrations
from django.db.models import Max
from django.utils import timezone

# ADR-0016 removes two-factor authentication, so the seeded security article
# must stop pointing candidates at a page that no longer exists. The slug is
# kept: public links stay valid and the 0003 seed remains idempotent.
SLUG = 'bao-ve-tai-khoan-va-xac-minh-hai-buoc'
TITLE = 'Bảo vệ tài khoản ProCV'
SEO_DESCRIPTION = (
    'Các bước đổi mật khẩu, giữ an toàn thông tin đăng nhập và xử lý khi nghi ngờ '
    'tài khoản ProCV bị truy cập trái phép.'
)
SOURCE = (
    'frontend/src/pages/main/account/ChangePassword.jsx; '
    'frontend/src/entities/account/config/candidate-menu.jsx'
)
BODY = """
<p>Mật khẩu riêng, đủ mạnh và email an toàn giúp giảm rủi ro người khác truy cập tài khoản của bạn.</p>
<h2>Đổi mật khẩu</h2>
<ol>
  <li>Đăng nhập tài khoản ứng viên.</li>
  <li>Mở <a href="/tai-khoan/doi-mat-khau">Đổi mật khẩu</a> trong nhóm <strong>Cá nhân &amp; Bảo mật</strong>.</li>
  <li>Làm theo biểu mẫu và hoàn tất bước xác thực lại nếu hệ thống yêu cầu.</li>
</ol>
<p>Dùng mật khẩu dài, khác với mật khẩu email và không gửi mật khẩu qua tin nhắn. Nếu bạn không còn nhớ mật khẩu hiện tại, dùng quy trình <a href="/forgot-password">Quên mật khẩu</a>.</p>
<h2>Khi nghi ngờ tài khoản bị truy cập trái phép</h2>
<ul>
  <li>Đổi ngay mật khẩu ProCV và mật khẩu email liên quan.</li>
  <li>Kiểm tra thông tin cá nhân, CV và hoạt động ứng tuyển để nhận biết thay đổi không do bạn thực hiện.</li>
  <li>Liên hệ hỗ trợ, nêu thời điểm và dấu hiệu bất thường; không gửi mật khẩu hoặc mã xác minh.</li>
</ul>
""".strip()


def _plain_text(body):
    return re.sub(r'\s+', ' ', unescape(re.sub(r'<[^>]+>', ' ', body))).strip()


def rewrite_account_security_article(apps, schema_editor):
    article_model = apps.get_model('knowledgebase', 'KnowledgeArticle')
    revision_model = apps.get_model('knowledgebase', 'KnowledgeArticleRevision')
    article = article_model.objects.filter(slug=SLUG).first()
    if article is None:
        return

    now = timezone.now()
    number = (article.revisions.aggregate(value=Max('number'))['value'] or 0) + 1
    revision = revision_model.objects.create(
        public_id=f'kbr_{sha256(f"{SLUG}:{number}".encode()).hexdigest()[:12]}',
        article=article,
        number=number,
        status='APPROVED',
        title=TITLE,
        body=BODY,
        body_plain_text=_plain_text(BODY),
        content_hash=sha256(f'{TITLE}\n{BODY}'.encode()).hexdigest(),
        seo_title=TITLE,
        seo_description=SEO_DESCRIPTION,
        change_summary='Gỡ hướng dẫn xác minh hai bước theo ADR-0016.',
        source_reference=SOURCE,
        submitted_at=now,
        reviewed_at=now,
        first_published_at=now,
    )
    article.published_revision_id = revision.id
    article.current_published_at = now
    article.revision_token += 1
    article.save(
        update_fields=[
            'published_revision',
            'current_published_at',
            'revision_token',
            'updated_at',
        ]
    )


class Migration(migrations.Migration):
    dependencies = [('knowledgebase', '0003_seed_verified_help_content')]

    operations = [
        migrations.RunPython(rewrite_account_security_article, migrations.RunPython.noop),
    ]
