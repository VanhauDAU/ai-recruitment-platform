"""Read-only preflight for the application-snapshot migrations.

Reports whether the expand/backfill/contract migrations (applications
0004/0005/0006) are recorded, whether the snapshot columns and index exist,
how many applications still lack a snapshot, and any data inconsistency (a
linked snapshot that belongs to another CV or is not an application_snapshot,
or an orphaned deterministic ``cvv-application-{pk}`` row that mismatches).

Read-only by default. Pass ``--repair`` to run the same guarded, idempotent
backfill the migration uses (create/reuse ``cvv-application-{pk}`` for
applications missing a snapshot). Repair never drops columns, resets the
database, or fakes migration state.

Exit code: 0 when healthy, 1 when inconsistencies remain (so CI/deploy can gate).
"""

from django.core.management.base import BaseCommand
from django.db import connection, transaction

SNAPSHOT_MIGRATIONS = [
    '0004_application_snapshot_expand',
    '0005_application_snapshot_backfill',
    '0006_application_snapshot_contract',
]
SNAPSHOT_COLUMNS = [
    'submitted_at',
    'submitted_cv_source',
    'submitted_cv_title',
    'submitted_cv_version_id',
]
SNAPSHOT_INDEX = 'idx_app_submitted_cv_version'
TABLE = 'applications_application'


def _recorded_migrations():
    with connection.cursor() as cursor:
        cursor.execute("SELECT name FROM django_migrations WHERE app = 'applications'")
        return {row[0] for row in cursor.fetchall()}


def _existing_columns():
    with connection.cursor() as cursor:
        cursor.execute(
            'SELECT column_name FROM information_schema.columns WHERE table_name = %s',
            [TABLE],
        )
        return {row[0] for row in cursor.fetchall()}


def _index_exists(name):
    with connection.cursor() as cursor:
        cursor.execute(
            'SELECT 1 FROM pg_indexes WHERE tablename = %s AND indexname = %s', [TABLE, name]
        )
        return cursor.fetchone() is not None


def _application_rows(where_sql='', params=()):
    """Read columns available from snapshot migration 0004 onward.

    The preflight is intentionally usable between its expand and contract
    migrations. Importing the current Application ORM model would make Django
    select fields added by later migrations (for example ``contact_name`` in
    0009), which do not exist in that intermediate schema.
    """
    query = (
        'SELECT id, cv_id, candidate_id, applied_at, submitted_cv_version_id '
        f'FROM {TABLE} {where_sql}'
    )
    with connection.cursor() as cursor:
        cursor.execute(query, params)
        return cursor.fetchall()


def _missing_snapshot_count():
    with connection.cursor() as cursor:
        cursor.execute(f'SELECT COUNT(*) FROM {TABLE} WHERE submitted_cv_version_id IS NULL')
        return cursor.fetchone()[0]


def _inconsistencies():
    """Linked snapshots that belong to the wrong CV or are the wrong kind."""
    from apps.cvs.models import CvVersion

    problems = []
    linked_rows = _application_rows('WHERE submitted_cv_version_id IS NOT NULL')
    snapshots = CvVersion.objects.in_bulk(row[4] for row in linked_rows)
    for app_id, cv_id, _candidate_id, _applied_at, submitted_cv_version_id in linked_rows:
        snapshot = snapshots.get(submitted_cv_version_id)
        if snapshot is None:
            problems.append(
                f'application {app_id}: submitted snapshot {submitted_cv_version_id} is missing'
            )
        elif snapshot.cv_id != cv_id:
            problems.append(
                f'application {app_id}: snapshot {snapshot.public_id} belongs to '
                f'cv_id={snapshot.cv_id}, expected {cv_id}'
            )
        elif snapshot.version_kind != 'application_snapshot':
            problems.append(
                f'application {app_id}: snapshot {snapshot.public_id} has '
                f"version_kind={snapshot.version_kind!r}, expected 'application_snapshot'"
            )
    return problems


def _orphan_deterministic_snapshots():
    """`cvv-application-{pk}` rows that no longer match their application."""
    from apps.cvs.models import CvVersion

    problems = []
    application_cv_ids = {row[0]: row[1] for row in _application_rows()}
    for snapshot in CvVersion.objects.filter(public_id__startswith='cvv-application-').iterator():
        try:
            app_pk = int(snapshot.public_id.rsplit('-', 1)[1])
        except (IndexError, ValueError):
            continue
        if app_pk not in application_cv_ids:
            continue  # application deleted; snapshot retained by design
        application_cv_id = application_cv_ids[app_pk]
        if snapshot.cv_id != application_cv_id or snapshot.version_kind != 'application_snapshot':
            problems.append(
                f'{snapshot.public_id}: cv_id={snapshot.cv_id}/kind={snapshot.version_kind!r} '
                f'does not match application {app_pk} (cv_id={application_cv_id})'
            )
    return problems


def _repair_missing_snapshots(stdout):
    """Idempotent, guarded backfill for applications missing a snapshot.

    Mirrors migration 0005: deterministic public_id, reuse only when the row
    genuinely belongs to this application's CV and is an application_snapshot.
    """
    from apps.cvs.models import CvVersion, UserCv

    repaired = 0
    missing = _application_rows('WHERE submitted_cv_version_id IS NULL')
    for app_id, cv_id, candidate_id, applied_at, _submitted_cv_version_id in missing:
        with transaction.atomic():
            cv = UserCv.objects.get(pk=cv_id)
            base = CvVersion.objects.filter(cv_id=cv.pk).order_by('-version_number').first()
            if base is None:
                raise RuntimeError(
                    f'application {app_id}: cv {cv.pk} has no CvVersion to snapshot from; '
                    f'run migrations first (0005 creates a recovery baseline).'
                )
            snapshot_public_id = f'cvv-application-{app_id}'
            snapshot = CvVersion.objects.filter(public_id=snapshot_public_id).first()
            if snapshot is not None and (
                snapshot.cv_id != cv.pk or snapshot.version_kind != 'application_snapshot'
            ):
                raise RuntimeError(
                    f'Refusing to reuse {snapshot_public_id!r} for application {app_id}: '
                    f'cv_id={snapshot.cv_id}/kind={snapshot.version_kind!r} mismatch.'
                )
            if snapshot is None:
                next_number = (
                    CvVersion.objects.filter(cv_id=cv.pk)
                    .order_by('-version_number')
                    .values_list('version_number', flat=True)
                    .first()
                    or 0
                ) + 1
                snapshot = CvVersion.objects.create(
                    public_id=snapshot_public_id,
                    cv_id=cv.pk,
                    version_number=next_number,
                    version_kind='application_snapshot',
                    template_version_id=base.template_version_id,
                    parent_version_id=base.pk,
                    schema_version=base.schema_version,
                    content_json=base.content_json,
                    layout_json=base.layout_json,
                    style_json=base.style_json,
                    plain_text=base.plain_text,
                    content_hash=base.content_hash,
                    created_by_id=candidate_id,
                )
            with connection.cursor() as cursor:
                cursor.execute(
                    f'UPDATE {TABLE} SET submitted_cv_version_id = %s, submitted_cv_title = %s, '
                    'submitted_cv_source = %s, submitted_at = %s WHERE id = %s',
                    [snapshot.pk, cv.title, cv.source, applied_at, app_id],
                )
            repaired += 1
    stdout(f'repaired {repaired} application snapshot(s)')
    return repaired


class Command(BaseCommand):
    help = 'Read-only preflight for the application-snapshot migrations (use --repair to backfill).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--repair',
            action='store_true',
            help='Backfill snapshots for applications missing one (idempotent, guarded). Not read-only.',
        )

    def handle(self, *args, **options):
        recorded = _recorded_migrations()
        columns = _existing_columns()

        self.stdout.write(self.style.MIGRATE_HEADING('Application snapshot preflight'))

        self.stdout.write('\nMigration state:')
        for name in SNAPSHOT_MIGRATIONS:
            mark = 'X' if name in recorded else ' '
            self.stdout.write(f'  [{mark}] applications.{name}')

        self.stdout.write('\nSchema:')
        for column in SNAPSHOT_COLUMNS:
            mark = 'X' if column in columns else ' '
            self.stdout.write(f'  [{mark}] column {column}')
        self.stdout.write(
            f'  [{"X" if _index_exists(SNAPSHOT_INDEX) else " "}] index {SNAPSHOT_INDEX}'
        )

        has_fk_column = 'submitted_cv_version_id' in columns
        missing_count = _missing_snapshot_count() if has_fk_column else None
        inconsistencies = []
        if has_fk_column:
            inconsistencies = _inconsistencies() + _orphan_deterministic_snapshots()

        self.stdout.write('\nData:')
        if not has_fk_column:
            self.stdout.write(
                '  submitted_cv_version_id column absent — run migrations before checking data.'
            )
        else:
            self.stdout.write(f'  applications missing snapshot: {missing_count}')
            self.stdout.write(f'  inconsistencies: {len(inconsistencies)}')
            for problem in inconsistencies:
                self.stdout.write(self.style.ERROR(f'    - {problem}'))

        if options['repair']:
            self.stdout.write('\nRepair:')
            if inconsistencies:
                self.stdout.write(
                    self.style.ERROR(
                        '  inconsistencies present — refusing to repair. Resolve them first.'
                    )
                )
                raise SystemExit(1)
            if not has_fk_column:
                self.stdout.write(self.style.ERROR('  columns absent — run migrations first.'))
                raise SystemExit(1)
            self._write_repair_line(_repair_missing_snapshots)
            missing_count = _missing_snapshot_count()

        healthy = has_fk_column and not inconsistencies and (missing_count == 0)
        self.stdout.write('')
        if healthy:
            self.stdout.write(self.style.SUCCESS('OK: snapshots consistent.'))
        else:
            self.stdout.write(self.style.WARNING('Attention: see items above.'))
            raise SystemExit(1)

    def _write_repair_line(self, repair):
        repair(lambda line: self.stdout.write(f'  {line}'))
