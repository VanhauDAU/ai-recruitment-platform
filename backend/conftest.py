"""Dựng DB test một lần rồi clone cho từng worker pytest-xdist.

Mặc định pytest-django để mỗi worker tự ``migrate`` DB riêng: ~30s cục bộ,
~90s trên CI (coverage + nhiều worker tranh CPU) — lặp lại ở mọi worker, mọi
lần chạy. Ở đây worker đầu tiên (giữ file lock) dựng ``test_<DB>_tpl`` bằng
``migrate`` một lần; mọi worker clone DB của mình bằng
``CREATE DATABASE … TEMPLATE`` (~1s) rồi để Django chạy tiếp như ``keepdb``
(migrate không còn gì để áp, vẫn serialize khi test cần ``serialized_rollback``).

Template được dùng lại giữa các lần chạy khi dấu vân tay của migration không
đổi. Không vi phạm lý do cấm ``--reuse-db``: TransactionTestCase chỉ truncate
DB của worker, template không bao giờ được test chạm vào. Mỗi worker vẫn bắt
đầu từ DB mới clone và bị xóa sau phiên.

Đặt ``PYTEST_DB_TEMPLATE=0`` để quay về hành vi mặc định của pytest-django.
"""

import fcntl
import hashlib
import os
import tempfile
from contextlib import contextmanager
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parent
# Mọi thứ quyết định nội dung DB sau migrate: file migration (kể cả
# reference_data.json) và code dùng chung mà data migration gọi.
FINGERPRINT_GLOBS = ('apps/*/migrations/*.py', 'apps/*/migrations/*.json', 'common/db/*.py')


def _fingerprint():
    import django

    digest = hashlib.sha256(django.get_version().encode())
    for pattern in FINGERPRINT_GLOBS:
        for path in sorted(BACKEND_DIR.glob(pattern)):
            digest.update(str(path.relative_to(BACKEND_DIR)).encode())
            digest.update(path.read_bytes())
    return digest.hexdigest()[:32]


@contextmanager
def _file_lock(name):
    path = Path(tempfile.gettempdir()) / f'{name}.lock'
    with path.open('w') as handle:
        fcntl.flock(handle, fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)


@contextmanager
def _coverage_paused():
    """Migrate không phải code đang được đo; tracer làm nó chậm gấp nhiều lần."""
    try:
        import coverage
    except ImportError:  # pragma: no cover - coverage luôn có trong requirements
        yield
        return
    current = coverage.Coverage.current()
    if current is None:
        yield
        return
    current.stop()
    try:
        yield
    finally:
        current.start()


def _quote(connection, name):
    return connection.ops.quote_name(name)


def _template_fingerprint(cursor, template):
    cursor.execute(
        'SELECT shobj_description(oid, %s) FROM pg_database WHERE datname = %s',
        ['pg_database', template],
    )
    row = cursor.fetchone()
    return row[0] if row else None


def _build_template(connection, template, fingerprint):
    from django.core.management import call_command

    with connection._nodb_cursor() as cursor:
        cursor.execute(f'DROP DATABASE IF EXISTS {_quote(connection, template)}')
        cursor.execute(f'CREATE DATABASE {_quote(connection, template)}')
    original_name = connection.settings_dict['NAME']
    connection.close()
    connection.settings_dict['NAME'] = template
    try:
        with _coverage_paused():
            call_command('migrate', verbosity=0, interactive=False, run_syncdb=True)
    finally:
        connection.close()
        connection.settings_dict['NAME'] = original_name
    with connection._nodb_cursor() as cursor:
        # Chỉ đánh dấu khi migrate thành công: template dở dang sẽ bị dựng lại.
        cursor.execute(f"COMMENT ON DATABASE {_quote(connection, template)} IS '{fingerprint}'")


def _clone_worker_database(connection, template):
    fingerprint = _fingerprint()
    with _file_lock(f'procv-pytest-{template}'):
        with connection._nodb_cursor() as cursor:
            current = _template_fingerprint(cursor, template)
        if current != fingerprint:
            _build_template(connection, template, fingerprint)
        worker_db = connection.creation._get_test_db_name()
        with connection._nodb_cursor() as cursor:
            cursor.execute(f'DROP DATABASE IF EXISTS {_quote(connection, worker_db)}')
            # Clone trong lock: Postgres từ chối TEMPLATE khi template đang có
            # phiên khác kết nối (worker khác đang dựng).
            cursor.execute(
                f'CREATE DATABASE {_quote(connection, worker_db)} TEMPLATE {_quote(connection, template)}'
            )


def _template_enabled():
    from django.conf import settings

    return (
        os.environ.get('PYTEST_DB_TEMPLATE', '1') != '0'
        and settings.DATABASES['default']['ENGINE'] == 'django.db.backends.postgresql'
    )


@pytest.fixture(scope='session')
def django_db_setup(
    request,
    django_test_environment,
    django_db_blocker,
    django_db_use_migrations,
    django_db_keepdb,
    django_db_createdb,
    django_db_modify_db_settings,
):
    # Bản sao fixture gốc của pytest-django, chỉ chen bước clone template.
    from django.db import connections
    from django.test.utils import setup_databases, teardown_databases
    from pytest_django.fixtures import _disable_migrations, _get_databases_for_setup

    if not django_db_use_migrations:
        _disable_migrations()
    aliases, serialized_aliases = _get_databases_for_setup(request.session.items)
    use_template = _template_enabled() and django_db_use_migrations and aliases == {'default'}
    keepdb = django_db_keepdb and not django_db_createdb
    verbosity = request.config.option.verbose

    with django_db_blocker.unblock():
        if use_template:
            connection = connections['default']
            template = f'test_{connection.settings_dict["NAME"]}_tpl'
            _clone_worker_database(connection, template)
        db_cfg = setup_databases(
            verbosity=verbosity,
            interactive=False,
            aliases=aliases,
            serialized_aliases=serialized_aliases,
            # Với template, DB của worker đã có đủ schema và dữ liệu tham chiếu.
            keepdb=use_template or keepdb,
        )

    yield

    if keepdb and not use_template:
        return
    with django_db_blocker.unblock():
        try:
            teardown_databases(db_cfg, verbosity=verbosity)
        except Exception as exc:  # noqa: BLE001 - giống pytest-django: cảnh báo, không fail
            request.node.warn(
                pytest.PytestWarning(f'Error when trying to teardown test databases: {exc!r}')
            )


@pytest.fixture(autouse=True)
def _isolated_cache():
    """Cache test là LocMem dùng chung trong một process: xóa trước mỗi test.

    Payload công khai được cache (thống kê trang chủ, danh mục, sitemap...) và
    bucket throttle không được rò từ test này sang test khác.
    """
    from django.core.cache import cache

    cache.clear()
