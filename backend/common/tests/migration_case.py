"""Lớp cơ sở cho test data migration (chạy ngược rồi tiến lại trên DB của worker)."""

from django.core.management import call_command
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


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
