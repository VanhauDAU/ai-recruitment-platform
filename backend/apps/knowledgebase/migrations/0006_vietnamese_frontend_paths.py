"""Link nội bộ trong bài trợ giúp trỏ sang path tiếng Việt (path cũ vẫn redirect ở frontend).

Chỉ thay giá trị `href` khớp trọn path cũ; văn bản hiển thị không đổi nên
`body_plain_text` giữ nguyên, chỉ tính lại `content_hash` như service nội dung.
"""

import re
from hashlib import sha256

from django.db import migrations

PATHS = {
    '/login': '/dang-nhap',
    '/sign-up': '/dang-ky',
    '/register': '/dang-ky',
    '/forgot-password': '/quen-mat-khau',
    '/reset-password': '/dat-lai-mat-khau',
    '/onboard-user': '/hoan-thien-ho-so',
}


def _rewrite(apps, mapping):
    pattern = re.compile(
        r'href="(' + '|'.join(re.escape(path) for path in mapping) + r')(?=["?#])'
    )
    Revision = apps.get_model('knowledgebase', 'KnowledgeArticleRevision')
    for revision in Revision.objects.filter(body__contains='href="/'):
        body = pattern.sub(lambda match: f'href="{mapping[match.group(1)]}', revision.body)
        if body == revision.body:
            continue
        revision.body = body
        revision.content_hash = sha256(f'{revision.title}\n{body}'.encode()).hexdigest()
        revision.save(update_fields=['body', 'content_hash'])


def forwards(apps, schema_editor):
    _rewrite(apps, PATHS)


def backwards(apps, schema_editor):
    _rewrite(apps, {new: old for old, new in PATHS.items() if old != '/register'})


class Migration(migrations.Migration):
    dependencies = [
        ('knowledgebase', '0005_legal_articles'),
    ]

    operations = [migrations.RunPython(forwards, backwards)]
