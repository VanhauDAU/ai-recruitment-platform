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

from common import i18n_catalog
from common.i18n import recipient_language

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


# ---- Catalog en theo app (common/i18n_catalog.py) ----


@pytest.mark.parametrize('app_dir', i18n_catalog.app_dirs(), ids=lambda path: path.name)
def test_app_catalog_translates_every_message(app_dir):
    assert i18n_catalog.check(app_dir) == []


def _fake_app(tmp_path):
    app = tmp_path / 'apps' / 'demo'
    (app / 'templates' / 'demo').mkdir(parents=True)
    (app / 'tests').mkdir()
    (app / 'apps.py').write_text('')
    (app / 'services.py').write_text(
        'from django.utils.translation import gettext as _, gettext_lazy as _lazy, ngettext\n'
        "A = _lazy('Tin tuyển dụng')\n"
        'def f(n):\n'
        "    return _('Xin chào %(name)s') + ngettext('%(n)s hồ sơ', '%(n)s hồ sơ', n)\n"
    )
    (app / 'tests' / 'test_x.py').write_text("_('Chỉ trong test')\n")
    (app / 'templates' / 'demo' / 'mail.html').write_text(
        '{% load i18n %}<p>{% translate "Chào bạn" %}</p>\n'
        '{% blocktranslate trimmed count=application_count %}\n  Bạn có {{ count }}\n  hồ sơ 100%\n{% endblocktranslate %}'
    )
    return app


def test_extracts_code_and_templates_but_not_tests(tmp_path):
    app = _fake_app(tmp_path)

    assert i18n_catalog.extract_app(app) == [
        ('Tin tuyển dụng', ''),
        ('Xin chào %(name)s', ''),
        ('%(n)s hồ sơ', '%(n)s hồ sơ'),
        ('Chào bạn', ''),
        ('Bạn có %(count)s hồ sơ 100%%', ''),
    ]


def test_rejects_non_literal_messages(tmp_path):
    app = _fake_app(tmp_path)
    (app / 'bad.py').write_text(
        "from django.utils.translation import gettext as _\nx = _(f'{1}')\n"
    )

    with pytest.raises(i18n_catalog.ExtractionError):
        i18n_catalog.extract_app(app)


def test_update_keeps_translations_and_compiles_a_readable_mo(tmp_path, monkeypatch):
    monkeypatch.setattr(i18n_catalog, 'BACKEND_DIR', tmp_path)
    app = _fake_app(tmp_path)
    po_path, mo_path = i18n_catalog.catalog_paths(app)

    assert i18n_catalog.update(app) == 5
    entries = i18n_catalog.read_po(po_path)
    translations = {
        'Tin tuyển dụng': ['Job posting'],
        'Xin chào %(name)s': ['Hello "%(name)s"\\n'],
        '%(n)s hồ sơ': ['%(n)s profile', '%(n)s profiles'],
        'Chào bạn': ['Hi there'],
        'Bạn có %(count)s hồ sơ 100%%': ['You have %(count)s profiles 100%%'],
    }
    for entry in entries:
        entry.msgstr = translations[entry.msgid]
    i18n_catalog.write_po(po_path, entries)
    assert i18n_catalog.check(app) == [
        'apps/demo: django.mo cũ; chạy python -m common.i18n_catalog update apps/demo'
    ]

    assert i18n_catalog.update(app) == 0
    assert i18n_catalog.check(app) == []
    with mo_path.open('rb') as handle:
        compiled = gettext.GNUTranslations(handle)
    assert compiled.gettext('Xin chào %(name)s') == 'Hello "%(name)s"\\n'
    assert compiled.ngettext('%(n)s hồ sơ', '%(n)s hồ sơ', 2) == '%(n)s profiles'
    assert compiled.ngettext('%(n)s hồ sơ', '%(n)s hồ sơ', 1) == '%(n)s profile'


def test_check_reports_untranslated_messages(tmp_path, monkeypatch):
    monkeypatch.setattr(i18n_catalog, 'BACKEND_DIR', tmp_path)
    app = _fake_app(tmp_path)
    i18n_catalog.update(app)

    problems = i18n_catalog.check(app)

    assert "apps/demo: thiếu bản dịch en cho 'Chào bạn'" in problems


def test_recipient_language_follows_the_account_preference():
    english = type('User', (), {'preferred_language': 'en'})()

    with translation.override('vi'):
        with recipient_language(english):
            assert translation.get_language() == 'en'
        with recipient_language(None):
            assert translation.get_language() == 'vi'
        assert translation.get_language() == 'vi'
