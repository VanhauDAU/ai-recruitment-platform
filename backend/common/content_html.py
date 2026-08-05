"""Allow-list HTML helpers for reviewed, media-rich content.

The parser intentionally owns only the technical HTML policy. Domain services
remain responsible for checking that image URLs belong to their media library
and that required editorial metadata (for example meaningful alt text) exists.
"""

from html import escape, unescape
from html.parser import HTMLParser
from urllib.parse import urlparse

ALLOWED_CONTENT_TAGS = {
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
DROP_CONTENT_TAGS = {'form', 'iframe', 'script', 'style'}
ALLOWED_ATTRIBUTES = {
    'a': {'href', 'target'},
    'img': {'src', 'alt', 'data-width', 'data-align', 'data-decorative'},
    'td': {'colspan', 'rowspan'},
    'th': {'colspan', 'rowspan'},
}


def safe_content_url(value, *, allow_http=False):
    """Return a normalized safe link/image URL, or an empty string.

    Relative application paths must start with exactly one slash. External
    links are HTTPS-only by default and may never contain credentials.
    """

    value = str(value or '').strip()
    if not value or value.startswith('//'):
        return ''
    if value.startswith('/'):
        return value

    parsed = urlparse(value)
    allowed_schemes = {'https', 'mailto', 'tel'}
    if allow_http:
        allowed_schemes.add('http')
    if parsed.scheme not in allowed_schemes:
        return ''
    if parsed.username is not None or parsed.password is not None:
        return ''
    if parsed.scheme in {'http', 'https'} and not parsed.netloc:
        return ''
    return value


class _ContentHtmlSanitizer(HTMLParser):
    def __init__(self, *, allow_http=False, url_normalizer=None):
        super().__init__(convert_charrefs=True)
        self.allow_http = allow_http
        self.url_normalizer = url_normalizer
        self.output = []
        self.drop_depth = 0

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag in DROP_CONTENT_TAGS:
            self.drop_depth += 1
            return
        if self.drop_depth or tag not in ALLOWED_CONTENT_TAGS:
            return

        safe_attrs = []
        for name, value in attrs:
            name = name.lower()
            if name not in ALLOWED_ATTRIBUTES.get(tag, set()):
                continue
            if name in {'href', 'src'}:
                if self.url_normalizer:
                    value = self.url_normalizer(tag, name, value)
                value = safe_content_url(value, allow_http=self.allow_http)
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
            elif name == 'data-decorative':
                value = 'true' if str(value).lower() == 'true' else 'false'
            safe_attrs.append(f' {name}="{escape(str(value), quote=True)}"')

        if tag == 'a' and any(item == ' target="_blank"' for item in safe_attrs):
            safe_attrs.append(' rel="noopener noreferrer"')
        self.output.append(f'<{tag}{"".join(safe_attrs)}>')

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in DROP_CONTENT_TAGS:
            self.drop_depth = max(0, self.drop_depth - 1)
            return
        if self.drop_depth:
            return
        if tag in ALLOWED_CONTENT_TAGS and tag not in VOID_TAGS:
            self.output.append(f'</{tag}>')

    def handle_data(self, data):
        if not self.drop_depth:
            self.output.append(escape(data))


class _ContentPlainTextParser(HTMLParser):
    BLOCK_TAGS = {
        'blockquote',
        'br',
        'figcaption',
        'h2',
        'h3',
        'h4',
        'li',
        'p',
        'pre',
        'table',
        'tr',
    }

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() in self.BLOCK_TAGS and self.parts:
            self.parts.append('\n')

    def handle_endtag(self, tag):
        if tag.lower() in self.BLOCK_TAGS:
            self.parts.append('\n')

    def handle_data(self, data):
        self.parts.append(data)


def sanitize_content_html(value, *, allow_http=False, url_normalizer=None):
    parser = _ContentHtmlSanitizer(
        allow_http=allow_http,
        url_normalizer=url_normalizer,
    )
    parser.feed(value or '')
    parser.close()
    return ''.join(parser.output).strip()


def content_html_plain_text(value):
    parser = _ContentPlainTextParser()
    parser.feed(value or '')
    parser.close()
    lines = [' '.join(line.split()) for line in unescape(''.join(parser.parts)).splitlines()]
    return '\n'.join(line for line in lines if line).strip()
