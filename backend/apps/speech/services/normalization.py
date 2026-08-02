from __future__ import annotations

import re
from hashlib import sha256
from html.parser import HTMLParser

NORMALIZER_VERSION = 'blog-speech-v1'
BLOCK_TAGS = {
    'blockquote',
    'div',
    'figcaption',
    'h1',
    'h2',
    'h3',
    'h4',
    'li',
    'p',
    'td',
    'th',
    'tr',
}
SKIPPED_TAGS = {'code', 'noscript', 'pre', 'script', 'style'}
EMOTION_CUE_PATTERN = re.compile(
    r'\[(?:cười|thở\s+dài|hắng\s+giọng|chuckle|sigh|clear\s+throat)\]',
    flags=re.IGNORECASE,
)
WHITESPACE_PATTERN = re.compile(r'\s+')
URL_PATTERN = re.compile(r'(?:(?:https?://|www\.)[^\s<]+)', flags=re.IGNORECASE)
ABBREVIATIONS = {
    'AI': 'ây ai',
    'API': 'ây pi ai',
    'CV': 'xi vi',
    'HR': 'hát a',
    'JD': 'giây đi',
    'KPI': 'ca pi ai',
    'SEO': 'ét i ô',
}


def _finish_sentence(value):
    value = WHITESPACE_PATTERN.sub(' ', value).strip(' \t\r\n-•')
    if not value:
        return ''
    if value[-1] not in '.!?;:':
        value += '.'
    return value


class _BlogSpeechParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.blocks = []
        self.buffer = []
        self.skipped_depth = 0
        self.skipped_announced = False

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if self.skipped_depth:
            if tag in SKIPPED_TAGS:
                self.skipped_depth += 1
            return
        if tag in SKIPPED_TAGS:
            self._flush()
            self.skipped_depth = 1
            if not self.skipped_announced:
                self.blocks.append('Đoạn mã minh họa được lược bỏ.')
                self.skipped_announced = True
            return
        if tag in BLOCK_TAGS or tag == 'br':
            self._flush()

    def handle_endtag(self, tag):
        tag = tag.lower()
        if self.skipped_depth:
            if tag in SKIPPED_TAGS:
                self.skipped_depth -= 1
            return
        if tag in BLOCK_TAGS:
            self._flush()

    def handle_data(self, data):
        if not self.skipped_depth:
            self.buffer.append(data)

    def close(self):
        super().close()
        self._flush()

    def _flush(self):
        value = _finish_sentence(''.join(self.buffer))
        self.buffer.clear()
        if value and (not self.blocks or self.blocks[-1] != value):
            self.blocks.append(value)


def _pronounce_abbreviations(value):
    def replace_url(match):
        trailing = match.group(0)[-1]
        return f'liên kết{trailing}' if trailing in '.,!?;:' else 'liên kết'

    value = URL_PATTERN.sub(replace_url, value)
    for source, spoken in ABBREVIATIONS.items():
        value = re.sub(rf'(?<![\w]){source}(?![\w])', spoken, value)
    return value


def _truncate_blocks(blocks, max_chars):
    selected = []
    used = 0
    truncated = False
    for block in blocks:
        required = len(block) + (2 if selected else 0)
        if used + required <= max_chars:
            selected.append(block)
            used += required
            continue
        remaining = max_chars - used - (2 if selected else 0)
        if remaining >= 120:
            candidate = block[:remaining]
            boundary = max(candidate.rfind('.'), candidate.rfind('!'), candidate.rfind('?'))
            if boundary >= remaining // 2:
                candidate = candidate[: boundary + 1]
            else:
                candidate = f'{candidate[: max(remaining - 1, 0)].rstrip()}.'
            selected.append(candidate)
        truncated = True
        break
    return selected, truncated


def blog_post_speech_script(post, *, max_chars):
    parser = _BlogSpeechParser()
    parser.feed(post.content or '')
    parser.close()

    title = _finish_sentence(post.title)
    blocks = [title, *parser.blocks]
    blocks = [
        _pronounce_abbreviations(EMOTION_CUE_PATTERN.sub('', block)) for block in blocks if block
    ]
    selected, truncated = _truncate_blocks(blocks, max_chars)
    text = '\n\n'.join(selected).strip()
    digest = sha256(text.encode()).hexdigest()
    return {
        'text': text,
        'text_hash': digest,
        'normalizer_version': NORMALIZER_VERSION,
        'truncated': truncated,
    }
