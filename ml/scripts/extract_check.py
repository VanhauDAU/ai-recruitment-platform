"""So sánh thư viện đọc PDF trên kho CV: `pypdf` và `pypdfium2` (kế hoạch mục 4, 10a).

Mỗi PDF trong `pdf/system/` và `pdf/topcv/` có bản JSON gốc cùng mã, nên từ vựng
của JSON là đáp án. Với mỗi cách đọc, đo:

- tỷ lệ từ bị tách: hai token liền nhau đều không có trong từ vựng gốc nhưng ghép
  lại thì có (vd. "Ứ" + "ng" → "ứng"), chia cho số từ đọc đúng cộng số từ bị tách;
- độ phủ: tỷ lệ từ (≥ 2 chữ cái) của JSON xuất hiện nguyên vẹn trong văn bản đọc ra.

Chạy: ml/.venv/bin/python ml/scripts/extract_check.py
Kết quả: ml/reports/extract_check.md (commit) và bảng từng tệp trên màn hình.
"""

import json
import logging
import re
import statistics
import unicodedata
import warnings

import pypdfium2 as pdfium
from paths import CV_MANIFEST, CV_PDF_SYSTEM_DIR, CV_PDF_TOPCV_DIR, REPORTS_DIR, SYNTHETIC_CV_DIR
from pypdf import PdfReader

WORD = re.compile(r'[^\W\d_]+')


def read_pypdf(path):
    return '\n'.join(page.extract_text() or '' for page in PdfReader(path).pages)


def read_pdfium(path):
    document = pdfium.PdfDocument(path)
    try:
        return '\n'.join(page.get_textpage().get_text_bounded() for page in document)
    finally:
        document.close()


READERS = {
    'pypdf': read_pypdf,
    'pypdf + NFC': lambda path: unicodedata.normalize('NFC', read_pypdf(path)),
    'pypdfium2 + NFC': lambda path: unicodedata.normalize('NFC', read_pdfium(path)),
}


def words(text):
    return [word.casefold() for word in WORD.findall(unicodedata.normalize('NFC', text))]


def source_vocabulary(code):
    data = json.loads((SYNTHETIC_CV_DIR / f'{code}.json').read_text(encoding='utf-8'))
    found = []

    def walk(value):
        if isinstance(value, str):
            found.extend(words(value))
        elif isinstance(value, dict):
            for item in value.values():
                walk(item)
        elif isinstance(value, list):
            for item in value:
                walk(item)

    walk(data)
    return {word for word in found if len(word) >= 2}


def measure(tokens, vocabulary):
    split = 0
    index = 0
    whole = 0
    while index < len(tokens):
        token = tokens[index]
        if token in vocabulary:
            whole += 1
            index += 1
            continue
        if index + 1 < len(tokens) and token + tokens[index + 1] in vocabulary:
            split += 1
            index += 2
            continue
        index += 1
    present = set(tokens)
    coverage = sum(1 for word in vocabulary if word in present) / max(len(vocabulary), 1)
    return split / max(whole + split, 1), coverage


def main():
    warnings.filterwarnings('ignore')
    # Vài tệp TopCV có dòng trống trước `%PDF`; pypdf vẫn đọc được, chỉ cảnh báo.
    logging.getLogger('pypdf').setLevel(logging.ERROR)
    manifest = json.loads(CV_MANIFEST.read_text(encoding='utf-8'))
    files = sorted(CV_PDF_SYSTEM_DIR.glob('*.pdf')) + sorted(CV_PDF_TOPCV_DIR.glob('*.pdf'))
    rows = []
    for path in files:
        vocabulary = source_vocabulary(path.stem)
        language = manifest[path.stem]['language']
        row = {'file': f'{path.parent.name}/{path.name}', 'language': language}
        for name, reader in READERS.items():
            row[name] = measure(words(reader(path)), vocabulary)
        rows.append(row)

    groups = {
        'Tất cả': rows,
        'Tiếng Việt': [row for row in rows if row['language'] == 'vi'],
        'Tiếng Anh': [row for row in rows if row['language'] == 'en'],
        'pdf/system': [row for row in rows if row['file'].startswith('system/')],
        'pdf/topcv': [row for row in rows if row['file'].startswith('topcv/')],
    }
    lines = [
        '# So sánh thư viện đọc PDF',
        '',
        f'{len(rows)} PDF của kho CV tổng hợp; đáp án là từ vựng của JSON gốc cùng mã.',
        'Tạo bằng `ml/scripts/extract_check.py`.',
        '',
        '| Nhóm | Số tệp | Cách đọc | Từ bị tách (TB) | Từ bị tách (max) | Độ phủ (TB) |',
        '| --- | ---: | --- | ---: | ---: | ---: |',
    ]
    for group, members in groups.items():
        for name in READERS:
            splits = [row[name][0] for row in members]
            coverage = [row[name][1] for row in members]
            lines.append(
                f'| {group} | {len(members)} | {name} | {statistics.mean(splits):.2%} '
                f'| {max(splits):.2%} | {statistics.mean(coverage):.2%} |'
            )
    worst = sorted(rows, key=lambda row: row['pypdfium2 + NFC'][1])[:5]
    lines += ['', 'Năm tệp có độ phủ thấp nhất với `pypdfium2 + NFC`:', '']
    lines += [
        f'- `{row["file"]}` ({row["language"]}): độ phủ {row["pypdfium2 + NFC"][1]:.2%}, '
        f'tách {row["pypdfium2 + NFC"][0]:.2%}'
        for row in worst
    ]
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    report = REPORTS_DIR / 'extract_check.md'
    report.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print('\n'.join(lines))
    print(f'\nĐã ghi {report.relative_to(REPORTS_DIR.parents[1])}')


if __name__ == '__main__':
    main()
