"""Small allow-list rich text helpers used by API serializers.

The employer editor intentionally supports formatting only.  Dropping every
attribute also removes event handlers and dangerous URL-bearing attributes.
"""

from html import escape
from html.parser import HTMLParser

ALLOWED_RICH_TEXT_TAGS = {'p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li'}
_DROP_CONTENT_TAGS = {'script', 'style'}
_TAG_ALIASES = {'b': 'strong', 'i': 'em'}


class _RichTextSanitizer(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.drop_depth = 0

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag in _DROP_CONTENT_TAGS:
            self.drop_depth += 1
            return
        if self.drop_depth:
            return
        tag = _TAG_ALIASES.get(tag, tag)
        if tag in ALLOWED_RICH_TEXT_TAGS:
            self.parts.append(f'<{tag}>')

    def handle_startendtag(self, tag, attrs):
        if not self.drop_depth and tag.lower() == 'br':
            self.parts.append('<br>')

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in _DROP_CONTENT_TAGS:
            self.drop_depth = max(0, self.drop_depth - 1)
            return
        if self.drop_depth:
            return
        tag = _TAG_ALIASES.get(tag, tag)
        if tag in ALLOWED_RICH_TEXT_TAGS and tag != 'br':
            self.parts.append(f'</{tag}>')

    def handle_data(self, data):
        if not self.drop_depth:
            self.parts.append(escape(data, quote=False))


def sanitize_rich_text(value):
    parser = _RichTextSanitizer()
    parser.feed(value or '')
    parser.close()
    return ''.join(parser.parts).strip()
