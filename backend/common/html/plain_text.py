"""Visible text of stored HTML, for search, SEO snippets and length checks.

Both rich-text (employer editor) and media-rich content (blog, knowledgebase)
go through the same extractor: block elements become line breaks and every
other tag is dropped, so the result is stable whichever sanitizer produced it.
"""

from html import unescape
from html.parser import HTMLParser

_BLOCK_TAGS = {
    'blockquote',
    'br',
    'figcaption',
    'h2',
    'h3',
    'h4',
    'li',
    'ol',
    'p',
    'pre',
    'table',
    'tr',
    'ul',
}


class _PlainTextParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() in _BLOCK_TAGS and self.parts:
            self.parts.append('\n')

    def handle_endtag(self, tag):
        if tag.lower() in _BLOCK_TAGS:
            self.parts.append('\n')

    def handle_data(self, data):
        self.parts.append(data)


def html_plain_text(value):
    """Return non-empty visible lines with whitespace collapsed inside each line."""
    parser = _PlainTextParser()
    parser.feed(value or '')
    parser.close()
    lines = [' '.join(line.split()) for line in unescape(''.join(parser.parts)).splitlines()]
    return '\n'.join(line for line in lines if line).strip()
