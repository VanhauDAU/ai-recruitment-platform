from common.html.content import sanitize_content_html
from common.html.plain_text import html_plain_text


def sanitize_blog_html(value):
    return sanitize_content_html(value, allow_http=True)


def blog_html_plain_text(value):
    return ' '.join(html_plain_text(value).split())
