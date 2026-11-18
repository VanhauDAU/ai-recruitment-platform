"""Chuẩn hóa văn bản, tách câu, nhận diện ngôn ngữ."""

import re
import unicodedata

from common.content_html import content_html_plain_text

# Tỷ lệ chữ cái riêng của tiếng Việt (có dấu, đ) trên tổng chữ cái để coi là tiếng Việt.
VIETNAMESE_LETTER_RATIO = 0.02

BULLET = re.compile(r'^\s*(?:[-–—•*·+▪●○■□✓✔➢►>]+|\d{1,2}[.)])\s*')
# Hết câu (dấu chấm câu rồi chữ cái) hoặc gạch đầu dòng giữa dòng (" - Managed…").
_SENTENCE_END = re.compile(r'(?<=[.!?;])\s+(?=[^\W\d_])|\s+[-•▪●]\s+(?=[^\W\d_])')
_SENTENCE_CLOSE = ('.', '!', '?', ':', ';')
_WORD = re.compile(r'[^\W\d_]+')


def normalize_text(text):
    """NFC và xuống dòng kiểu Unix."""
    text = unicodedata.normalize('NFC', str(text or ''))
    return text.replace('\r\n', '\n').replace('\r', '\n')


def word_count(text):
    return len(_WORD.findall(text))


def plain_text(value):
    """Chuỗi thường, khối `rich_text_v1` của CV builder hoặc HTML → văn bản thuần."""
    if isinstance(value, dict):
        return '\n'.join(str(block.get('text', '')) for block in value.get('content') or [])
    if isinstance(value, list):
        return '\n'.join(plain_text(item) for item in value)
    text = str(value or '')
    return content_html_plain_text(text) if '<' in text else text


def join_parts(*parts, separator=' — '):
    return separator.join(str(part).strip() for part in parts if part and str(part).strip())


def split_sentences(text):
    """Câu có ít nhất hai từ: bỏ ký hiệu gạch đầu dòng, tách dòng dài theo dấu chấm câu."""
    sentences = []
    for line in normalize_text(text).split('\n'):
        line = BULLET.sub('', line).strip()
        for sentence in _SENTENCE_END.split(line):
            sentence = ' '.join(sentence.split())
            if word_count(sentence) >= 2:
                sentences.append(sentence)
    return sentences


# Câu bị ngắt ngay sau từ nối hay dấu phẩy chắc chắn còn tiếp ở dòng sau.
_CONNECTORS = frozenset(
    'và hoặc của với cho các như từ về trong tại để bằng and or of with for in to the a an on at by'.split()
)


def _ends_mid_sentence(line):
    last = line.rsplit(maxsplit=1)[-1].casefold() if line.split() else ''
    return line.endswith(',') or last in _CONNECTORS


def reflow_lines(lines):
    """Nối dòng bị PDF ngắt giữa câu.

    Dòng sau được nối vào dòng trước khi dòng trước chưa hết câu và dòng sau
    viết thường, hoặc dòng trước dừng ở dấu phẩy/từ nối và dòng sau không phải
    gạch đầu dòng ("…thành thạo ReactJS và" + "JavaScript.").
    """
    merged = []
    for line in lines:
        if merged and not merged[-1].endswith(_SENTENCE_CLOSE):
            starts_lower = line[:1].islower() or (line[:1].isdigit() and not BULLET.match(line))
            cut = _ends_mid_sentence(merged[-1]) and not BULLET.match(line)
            if starts_lower or cut:
                merged[-1] = f'{merged[-1]} {line}'
                continue
        merged.append(line)
    return merged


def detect_language(text):
    """`'vi'`, `'en'` hoặc rỗng nếu không có chữ cái."""
    letters = [char for char in normalize_text(text) if char.isalpha()]
    if not letters:
        return ''
    vietnamese = sum(1 for char in letters if not char.isascii())
    return 'vi' if vietnamese / len(letters) >= VIETNAMESE_LETTER_RATIO else 'en'
