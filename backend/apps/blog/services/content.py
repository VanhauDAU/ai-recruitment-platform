from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

from django.utils.html import strip_tags

ALLOWED_TAGS = {
    'a',
    'b',
    'blockquote',
    'br',
    'code',
    'div',
    'em',
    'figcaption',
    'figure',
    'h2',
    'h3',
    'h4',
    'hr',
    'img',
    'li',
    'ol',
    'p',
    'pre',
    'span',
    'strong',
    'table',
    'tbody',
    'td',
    'th',
    'thead',
    'tr',
    'u',
    'ul',
}
VOID_TAGS = {'br', 'hr', 'img'}
ALLOWED_ATTRIBUTES = {
    'a': {'href', 'target'},
    'img': {'src', 'alt', 'data-width', 'data-align'},
    'td': {'colspan', 'rowspan'},
    'th': {'colspan', 'rowspan'},
}


def _safe_url(value):
    value = (value or '').strip()
    if not value:
        return ''
    parsed = urlparse(value)
    if parsed.scheme and parsed.scheme not in {'http', 'https', 'mailto', 'tel'}:
        return ''
    if value.startswith('//'):
        return ''
    return value


class _BlogHtmlSanitizer(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.output = []

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag not in ALLOWED_TAGS:
            return
        safe_attrs = []
        for name, value in attrs:
            name = name.lower()
            if name not in ALLOWED_ATTRIBUTES.get(tag, set()):
                continue
            if name in {'href', 'src'}:
                value = _safe_url(value)
                if not value:
                    continue
            elif name == 'target':
                value = '_blank' if value == '_blank' else '_self'
            elif name in {'colspan', 'rowspan'}:
                value = value if str(value).isdigit() else '1'
            elif name == 'data-width':
                value = value if value in {'25%', '50%', '75%', '100%'} else '100%'
            elif name == 'data-align':
                value = value if value in {'left', 'center', 'right'} else 'center'
            safe_attrs.append(f' {name}="{escape(str(value), quote=True)}"')
        if tag == 'a' and any(item.startswith(' target="_blank"') for item in safe_attrs):
            safe_attrs.append(' rel="noopener noreferrer"')
        self.output.append(f'<{tag}{"".join(safe_attrs)}>')

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in ALLOWED_TAGS and tag not in VOID_TAGS:
            self.output.append(f'</{tag}>')

    def handle_data(self, data):
        self.output.append(escape(data))

    def handle_entityref(self, name):
        self.output.append(f'&{name};')

    def handle_charref(self, name):
        self.output.append(f'&#{name};')


def sanitize_blog_html(value):
    parser = _BlogHtmlSanitizer()
    parser.feed(value or '')
    parser.close()
    return ''.join(parser.output).strip()


def blog_html_plain_text(value):
    return ' '.join(strip_tags(value or '').split())
