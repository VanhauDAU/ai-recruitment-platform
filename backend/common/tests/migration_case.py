"""Công cụ test data migration.

- ``run_data_migration``: gọi thẳng hàm RunPython trên schema hiện tại trong một
  ``TestCase`` — nhanh, dùng khi chỉ cần kiểm logic điền dữ liệu.
- ``MigrationTestCase``: chạy ngược rồi tiến lại thật trên DB của worker — chậm
  (gỡ cả migration phụ thuộc ở app khác), chỉ dùng khi phải kiểm cả đổi schema.
"""

from importlib import import_module

from django.apps import apps as django_apps
from django.core.management import call_command
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


def drop_not_null(model, field_name):
    """Cho cột nhận NULL như trước migration bắt buộc giá trị.

    Chỉ gọi trong ``TestCase``: PostgreSQL hoàn tác DDL cùng giao dịch của test.
    """
    quote = connection.ops.quote_name
    column = model._meta.get_field(field_name).column
    with connection.cursor() as cursor:
        # Hàng vừa tạo trong test để lại trigger khóa ngoại deferred; ALTER TABLE sẽ
        # báo "pending trigger events" nếu không kiểm chúng ngay.
        cursor.execute('SET CONSTRAINTS ALL IMMEDIATE')
        cursor.execute(
            f'ALTER TABLE {quote(model._meta.db_table)} ALTER COLUMN {quote(column)} DROP NOT NULL'
        )


def run_data_migration(module_path, function_name):
    """Chạy hàm RunPython của một migration với registry model hiện tại."""
    getattr(import_module(module_path), function_name)(django_apps, None)


class MigrationTestCase(TransactionTestCase):
    """``serialized_rollback`` khôi phục dữ liệu seed của migration sau test.

    Một ``TransactionTestCase`` thường chạy trước trên cùng worker xdist sẽ flush
    rồi phát ``post_migrate``, tạo lại content type/permission; khôi phục bản
    serialize lên đó sẽ chèn trùng khóa. Flush không phát ``post_migrate`` trước
    khi khôi phục để test không phụ thuộc thứ tự chạy.
    """

    serialized_rollback = True

    @classmethod
    def _fixture_setup(cls):
        for alias in cls._databases_names(include_mirrors=False):
            call_command(
                'flush', verbosity=0, interactive=False, database=alias, inhibit_post_migrate=True
            )
        super()._fixture_setup()

    def migrate(self, targets):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(targets)
        return executor.loader.project_state(targets).apps

    def tearDown(self):
        self.migrate(MigrationExecutor(connection).loader.graph.leaf_nodes())
        super().tearDown()
