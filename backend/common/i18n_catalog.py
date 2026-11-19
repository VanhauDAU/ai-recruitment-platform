"""Catalog dịch theo từng app, không cần GNU gettext (ADR-0023).

Docker và CI không cài gettext nên ``makemessages``/``compilemessages`` không
chạy được. Module này làm đúng phần dự án cần, bằng Python thuần:

- trích msgid từ code (``gettext``/``_``/``gettext_lazy``/``ngettext``…) và
  template (``{% translate %}``, ``{% blocktranslate trimmed %}``);
- cập nhật ``apps/<app>/locale/en/LC_MESSAGES/django.po``, giữ bản dịch cũ;
- biên dịch ``.mo``;
- ``check``: mọi msgid trong code phải có bản dịch tiếng Anh và ``.mo`` khớp
  ``.po`` (``common/tests/test_locale_catalogs.py`` chạy bước này).

Msgid của dự án là tiếng Việt (ngôn ngữ mặc định), nên chỉ cần catalog ``en``.

Dùng: ``python -m common.i18n_catalog update apps/employers`` rồi điền
``msgstr`` còn trống, chạy lại ``update`` để biên dịch ``.mo``.
"""

import ast
import re
import struct
import sys
from dataclasses import dataclass, field
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
TARGET_LOCALE = 'en'
SINGULAR_FUNCS = {'_', 'gettext', 'gettext_lazy', 'gettext_noop'}
PLURAL_FUNCS = {'ngettext', 'ngettext_lazy'}
PO_HEADER = (
    'Project-Id-Version: procv\n'
    'Language: en\n'
    'MIME-Version: 1.0\n'
    'Content-Type: text/plain; charset=UTF-8\n'
    'Content-Transfer-Encoding: 8bit\n'
    'Plural-Forms: nplurals=2; plural=(n != 1);\n'
)
TRANSLATE_TAG = re.compile(r"""{%\s*(?:translate|trans)\s+(?P<q>["'])(?P<text>.*?)(?P=q)[^%]*%}""")
BLOCK_TAG = re.compile(
    r'{%\s*(?:blocktranslate|blocktrans)(?P<opts>[^%]*)%}(?P<body>.*?){%\s*(?:endblocktranslate|endblocktrans)\s*%}',
    re.DOTALL,
)
TEMPLATE_VAR = re.compile(r'{{\s*(\w+)\s*}}')


@dataclass
class Entry:
    msgid: str
    msgid_plural: str = ''
    msgstr: list = field(default_factory=lambda: [''])

    @property
    def key(self):
        return (self.msgid, self.msgid_plural)

    @property
    def translated(self):
        return all(self.msgstr) and len(self.msgstr) == (2 if self.msgid_plural else 1)


class ExtractionError(ValueError):
    pass


def _call_name(node):
    if isinstance(node.func, ast.Name):
        return node.func.id
    if isinstance(node.func, ast.Attribute):
        return node.func.attr
    return None


def _literal(node, path):
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    raise ExtractionError(f'{path}:{node.lineno}: gettext cần chuỗi hằng, không dùng f-string/biến')


def _translation_aliases(tree):
    """Tên gọi gettext trong tệp, kể cả alias (`gettext_lazy as _lazy`)."""
    singular, plural = set(SINGULAR_FUNCS), set(PLURAL_FUNCS)
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module == 'django.utils.translation':
            for alias in node.names:
                if alias.name in SINGULAR_FUNCS:
                    singular.add(alias.asname or alias.name)
                elif alias.name in PLURAL_FUNCS:
                    plural.add(alias.asname or alias.name)
    return singular, plural


def extract_python(path):
    tree = ast.parse(path.read_text(encoding='utf-8'), filename=str(path))
    singular, plural = _translation_aliases(tree)
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call) or not node.args:
            continue
        name = _call_name(node)
        if name in singular:
            yield (_literal(node.args[0], path), '')
        elif name in plural and len(node.args) >= 2:
            yield (_literal(node.args[0], path), _literal(node.args[1], path))


def _block_msgid(body, options):
    if '{%' in body:
        raise ExtractionError('blocktranslate chỉ hỗ trợ biến {{ x }}, không lồng tag')
    msgid = TEMPLATE_VAR.sub(lambda m: f'%({m.group(1)})s', body.replace('%', '%%'))
    if 'trimmed' in options:
        msgid = re.sub(r'\s*\n\s*', ' ', msgid.strip())
    return msgid


def extract_template(path):
    source = path.read_text(encoding='utf-8')
    for match in TRANSLATE_TAG.finditer(source):
        yield (match.group('text'), '')
    for match in BLOCK_TAG.finditer(source):
        if '{% plural' in match.group('body') or re.search(r'(^|\s)count\s', match.group('opts')):
            raise ExtractionError(f'{path}: blocktranslate số nhiều chưa được hỗ trợ')
        yield (_block_msgid(match.group('body'), match.group('opts')), '')


def extract_app(app_dir):
    """Msgid theo thứ tự xuất hiện, bỏ test và migration."""
    found = {}
    for path in sorted(app_dir.rglob('*')):
        relative = path.relative_to(app_dir).parts
        if 'tests' in relative or 'migrations' in relative or 'locale' in relative:
            continue
        if path.suffix == '.py':
            items = extract_python(path)
        elif path.suffix in {'.html', '.txt'} and 'templates' in relative:
            items = extract_template(path)
        else:
            continue
        for key in items:
            found.setdefault(key, None)
    return list(found)


def _quote(text):
    escaped = (
        text.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n').replace('\t', '\\t')
    )
    return f'"{escaped}"'


def _unquote(token):
    return ast.literal_eval(token)


def read_po(path):
    entries, current, last = [], None, None
    if not path.exists():
        return entries
    for raw in path.read_text(encoding='utf-8').splitlines():
        line = raw.strip()
        if not line or line.startswith('#'):
            continue
        if line.startswith('"'):
            value = _unquote(line)
            if last == 'msgid':
                current.msgid += value
            elif last == 'msgid_plural':
                current.msgid_plural += value
            else:
                current.msgstr[last] += value
            continue
        keyword, _, value = line.partition(' ')
        if keyword == 'msgid':
            current = Entry(_unquote(value), msgstr=[])
            entries.append(current)
            last = 'msgid'
        elif keyword == 'msgid_plural':
            current.msgid_plural = _unquote(value)
            last = 'msgid_plural'
        elif keyword.startswith('msgstr'):
            index = int(keyword[7:-1]) if '[' in keyword else 0
            while len(current.msgstr) <= index:
                current.msgstr.append('')
            current.msgstr[index] = _unquote(value)
            last = index
    return [entry for entry in entries if entry.msgid]


def write_po(path, entries):
    lines = ['msgid ""', 'msgstr ""', *(_quote(line + '\n') for line in PO_HEADER.splitlines()), '']
    for entry in entries:
        lines.append(f'msgid {_quote(entry.msgid)}')
        if entry.msgid_plural:
            lines.append(f'msgid_plural {_quote(entry.msgid_plural)}')
            for index in range(2):
                text = entry.msgstr[index] if index < len(entry.msgstr) else ''
                lines.append(f'msgstr[{index}] {_quote(text)}')
        else:
            lines.append(f'msgstr {_quote(entry.msgstr[0] if entry.msgstr else "")}')
        lines.append('')
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text('\n'.join(lines), encoding='utf-8')


def compile_mo(entries):
    """Định dạng GNU .mo (như Tools/i18n/msgfmt.py); chỉ gồm mục đã dịch."""
    catalog = {'': PO_HEADER}
    for entry in entries:
        if not entry.translated:
            continue
        if entry.msgid_plural:
            catalog[f'{entry.msgid}\0{entry.msgid_plural}'] = '\0'.join(entry.msgstr)
        else:
            catalog[entry.msgid] = entry.msgstr[0]
    keys = sorted(catalog, key=lambda key: key.encode('utf-8'))
    ids = b''.join(key.encode('utf-8') + b'\0' for key in keys)
    strs = b''.join(catalog[key].encode('utf-8') + b'\0' for key in keys)
    key_offsets, value_offsets, id_pos, str_pos = [], [], 0, 0
    for key in keys:
        encoded_key, encoded_value = key.encode('utf-8'), catalog[key].encode('utf-8')
        key_offsets.append((len(encoded_key), id_pos))
        value_offsets.append((len(encoded_value), str_pos))
        id_pos += len(encoded_key) + 1
        str_pos += len(encoded_value) + 1
    keystart = 7 * 4 + 16 * len(keys)
    valuestart = keystart + len(ids)
    table = []
    for length, offset in key_offsets:
        table += [length, offset + keystart]
    for length, offset in value_offsets:
        table += [length, offset + valuestart]
    header = struct.pack('Iiiiiii', 0x950412DE, 0, len(keys), 7 * 4, 7 * 4 + len(keys) * 8, 0, 0)
    return header + struct.pack(f'{len(table)}i', *table) + ids + strs


def catalog_paths(app_dir):
    base = app_dir / 'locale' / TARGET_LOCALE / 'LC_MESSAGES'
    return base / 'django.po', base / 'django.mo'


def update(app_dir):
    """Đồng bộ .po với code (giữ bản dịch cũ, bỏ msgid không còn dùng) rồi biên dịch .mo."""
    po_path, mo_path = catalog_paths(app_dir)
    existing = {entry.key: entry for entry in read_po(po_path)}
    entries = [
        existing.get(key) or Entry(key[0], key[1], ['', ''] if key[1] else [''])
        for key in extract_app(app_dir)
    ]
    if not entries:
        return 0
    write_po(po_path, entries)
    mo_path.write_bytes(compile_mo(entries))
    return sum(not entry.translated for entry in entries)


def check(app_dir):
    """Danh sách lỗi: msgid chưa có trong .po, chưa dịch, hoặc .mo cũ."""
    keys = extract_app(app_dir)
    if not keys:
        return []
    po_path, mo_path = catalog_paths(app_dir)
    entries = {entry.key: entry for entry in read_po(po_path)}
    name = app_dir.relative_to(BACKEND_DIR)
    problems = [
        f'{name}: thiếu bản dịch en cho {msgid!r}'
        for msgid, plural in keys
        if not entries.get((msgid, plural), Entry('')).translated
    ]
    if not mo_path.exists() or mo_path.read_bytes() != compile_mo(list(entries.values())):
        problems.append(
            f'{name}: {mo_path.name} cũ; chạy python -m common.i18n_catalog update {name}'
        )
    return problems


def app_dirs():
    return sorted(path for path in (BACKEND_DIR / 'apps').iterdir() if (path / 'apps.py').exists())


def main(argv):
    command, *targets = argv
    dirs = [BACKEND_DIR / target for target in targets] or app_dirs()
    if command == 'update':
        for app_dir in dirs:
            missing = update(app_dir)
            if missing:
                print(f'{app_dir.relative_to(BACKEND_DIR)}: còn {missing} msgid chưa dịch')
        return 0
    if command == 'check':
        problems = [problem for app_dir in dirs for problem in check(app_dir)]
        print('\n'.join(problems) or 'Catalog en đầy đủ.')
        return 1 if problems else 0
    raise SystemExit('Dùng: python -m common.i18n_catalog update|check [apps/<app> ...]')


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
