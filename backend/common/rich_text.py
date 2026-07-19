"""Small allow-list rich text helpers used by API serializers.

The employer editor intentionally supports formatting only.  Dropping every
attribute also removes event handlers and dangerous URL-bearing attributes.
"""

from html import escape, unescape
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


class _VisibleTextParser(HTMLParser):
    BLOCK_TAGS = {'p', 'br', 'ul', 'ol', 'li'}

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


def sanitize_rich_text(value):
    parser = _RichTextSanitizer()
    parser.feed(value or '')
    parser.close()
    return ''.join(parser.parts).strip()


def rich_text_plain_text(value):
    parser = _VisibleTextParser()
    parser.feed(value or '')
    parser.close()
    lines = [' '.join(line.split()) for line in unescape(''.join(parser.parts)).splitlines()]
    return '\n'.join(line for line in lines if line).strip()
