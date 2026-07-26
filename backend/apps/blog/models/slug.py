import re

from django.utils.text import slugify

ROLE_PREFIXES = (
    'nhân viên',
    'chuyên viên',
    'trưởng phòng',
    'quản lý',
    'giám đốc',
    'kỹ sư',
    'lập trình viên',
)


def friendly_post_slug(title, *, max_words=10, max_length=70):
    """Build a concise, stable, ASCII blog slug from an editorial title.

    The title's first question/statement carries the search intent; explanatory
    tails such as "Từ A đến Z..." are intentionally omitted. For role aliases,
    e.g. "Nhân viên kinh doanh/Sales là gì?", keep the role prefix and the
    shorter alias: ``nhan-vien-sales-la-gi``.
    """
    concise_title = re.split(r'[?!:|–—]', (title or '').strip(), maxsplit=1)[0].strip()
    if '/' in concise_title:
        left, right = (part.strip() for part in concise_title.split('/', maxsplit=1))
        lowered_left = left.casefold()
        prefix = next((item for item in ROLE_PREFIXES if lowered_left.startswith(item)), '')
        concise_title = (
            f'{prefix} {right}'.strip() if prefix and right else f'{left} {right}'.strip()
        )

    words = slugify(concise_title).split('-')[:max_words]
    candidate = '-'.join(words)[:max_length].strip('-')
    return candidate or 'bai-viet'
