"""Tính vector cho mọi tin đang mở và phiên bản mới nhất của mọi CV.

Chạy sau khi đổi mô hình (MATCHING_MODEL_VERSION) hoặc khi bật tính năng lần đầu.
Mặc định gửi task vào queue `ai-matching`; `--inline` tính ngay trong tiến trình
hiện tại (chạy trong container ml-worker, nơi có mô hình):

    docker compose exec ml-worker python manage.py matching_backfill --inline
"""

from django.core.management.base import BaseCommand

from ...selectors import jobs_for_profile, latest_cv_versions
from ...services import SkillCatalog, ensure_cv_document, ensure_job_document, get_encoder
from ...tasks import embed_cv_version, embed_job


class Command(BaseCommand):
    help = 'Tính vector cho tin đang mở và CV (gửi task, hoặc --inline).'

    def add_arguments(self, parser):
        parser.add_argument('--only', choices=['jobs', 'cvs'])
        parser.add_argument('--inline', action='store_true', help='Tính ngay, không gửi task.')

    def handle(self, *args, only=None, inline=False, **options):
        encoder = get_encoder() if inline else None
        catalog = SkillCatalog.load() if inline else None
        counts = {'jobs': 0, 'cvs': 0, 'failed': 0}
        if only in (None, 'jobs'):
            for job in jobs_for_profile():
                if inline:
                    document = ensure_job_document(job, encoder=encoder)
                    counts['failed'] += document.status == document.Status.FAILED
                else:
                    embed_job.delay(job.pk)
                counts['jobs'] += 1
        if only in (None, 'cvs'):
            for cv in latest_cv_versions():
                if inline:
                    document = ensure_cv_document(
                        cv.latest_version, encoder=encoder, catalog=catalog
                    )
                    counts['failed'] += document.status == document.Status.FAILED
                else:
                    embed_cv_version.delay(cv.latest_version_id)
                counts['cvs'] += 1
        mode = 'đã tính' if inline else 'đã gửi task cho'
        self.stdout.write(
            f'{mode} {counts["jobs"]} tin, {counts["cvs"]} CV; trích xuất lỗi: {counts["failed"]}.'
        )
