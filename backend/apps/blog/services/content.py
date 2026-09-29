from common.content_html import content_html_plain_text, sanitize_content_html


def sanitize_blog_html(value):
    return sanitize_content_html(value, allow_http=True)


def blog_html_plain_text(value):
    return ' '.join(content_html_plain_text(value).split())
