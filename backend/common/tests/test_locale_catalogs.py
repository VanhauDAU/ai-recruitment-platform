"""Catalog dịch của dự án (backend/locale) phải đồng bộ giữa .po và .mo.

Docker và CI không cài GNU gettext nên .mo được commit cùng .po. Test này bắt
trường hợp sửa .po mà quên chạy `msgfmt -o django.mo django.po`.
"""

import ast
import gettext
from pathlib import Path

import pytest
from django.conf import settings
from django.utils import translation
from rest_framework import serializers

LOCALE_DIR = Path(settings.BASE_DIR) / 'locale'
PO_FILES = sorted(LOCALE_DIR.glob('*/LC_MESSAGES/django.po'))


def _parse_po(path):
    """Đọc .po tối giản: msgid, msgid_plural, msgstr và msgstr[n]."""
    entries, current, field = [], {}, None
    for raw in path.read_text(encoding='utf-8').splitlines():
        line = raw.strip()
        if not line or line.startswith('#'):
            if current:
                entries.append(current)
            current, field = {}, None
            continue
        if line.startswith('"'):
            current[field] += ast.literal_eval(line)
            continue
        field, _, value = line.partition(' ')
        current[field] = ast.literal_eval(value)
    if current:
        entries.append(current)
    return [entry for entry in entries if entry.get('msgid')]


def test_project_ships_vietnamese_catalog():
    assert PO_FILES, 'backend/locale phải có ít nhất catalog vi'


@pytest.mark.parametrize('po_path', PO_FILES, ids=lambda path: path.parts[-3])
def test_compiled_catalog_matches_source(po_path):
    mo_path = po_path.with_suffix('.mo')
    assert mo_path.exists(), f'Thiếu {mo_path.name}; chạy msgfmt -o django.mo django.po'
    with mo_path.open('rb') as handle:
        compiled = gettext.GNUTranslations(handle)

    for entry in _parse_po(po_path):
        if 'msgid_plural' in entry:
            expected = entry['msgstr[0]']
            actual = compiled.ngettext(entry['msgid'], entry['msgid_plural'], 1)
        else:
            expected = entry['msgstr']
            actual = compiled.gettext(entry['msgid'])
        assert actual == expected, f'{mo_path} cũ so với .po ở mục {entry["msgid"]!r}'


def test_drf_messages_use_project_vietnamese_supplement():
    field = serializers.ChoiceField(choices=['vi', 'en'])
    with translation.override('vi'):
        with pytest.raises(serializers.ValidationError) as error:
            field.run_validation('fr')
    assert error.value.detail == ['"fr" không phải là lựa chọn hợp lệ.']
