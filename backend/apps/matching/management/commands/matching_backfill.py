"""Tính vector cho mọi tin đang mở và phiên bản mới nhất của mọi CV.

Chạy sau khi đổi mô hình (MATCHING_MODEL_VERSION) hoặc khi bật tính năng lần đầu.
Mặc định gửi task vào queue `ai-matching`; `--inline` tính ngay trong tiến trình
hiện tại (chạy trong container ml-worker, nơi có mô hình):

    docker compose exec ml-worker python manage.py matching_backfill --inline

`--only applications` chấm các hồ sơ ứng tuyển chưa có kết quả với công thức và nội
dung tin hiện tại (hồ sơ ứng viên đồng ý phân tích); chạy sau khi đổi công thức
chấm hoặc khi bật `ai_application_ranking_enabled` lần đầu. Không chạy kèm khi bỏ
`--only`, vì nó chỉ có nghĩa khi cờ xếp hạng bật.
"""

from django.core.management.base import BaseCommand

from ...models import jobs_for_profile
from ...selectors import latest_cv_versions
from ...services import (
    SkillCatalog,
    applications_needing_score,
    ensure_cv_document,
    ensure_job_document,
    get_encoder,
    jobs_with_rankable_applications,
    score_application,
    snapshots_missing_profile,
)
from ...tasks import embed_cv_version, embed_job
from ...tasks import score_application as score_application_task


class Command(BaseCommand):
    help = 'Tính vector cho tin đang mở và CV (gửi task, hoặc --inline).'

    def add_arguments(self, parser):
        parser.add_argument('--only', choices=['jobs', 'cvs', 'applications'])
        parser.add_argument('--inline', action='store_true', help='Tính ngay, không gửi task.')

    def handle(self, *args, only=None, inline=False, **options):
        encoder = get_encoder() if inline else None
        catalog = SkillCatalog.load() if inline else None
        counts = {'jobs': 0, 'cvs': 0, 'failed': 0}
        if only == 'applications':
            self._applications(inline, encoder, catalog)
            return
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

    def _applications(self, inline, encoder, catalog):
        scored = failed = 0
        for job in jobs_with_rankable_applications():
            for application_id in applications_needing_score(job):
                if inline:
                    analysis = score_application(application_id, encoder=encoder, catalog=catalog)
                    failed += analysis is not None and analysis.status == analysis.Status.FAILED
                else:
                    score_application_task.delay(application_id)
                scored += 1
        # Điểm còn nhưng hồ sơ trích xuất của bản CV đã nộp thuộc phiên bản cũ: dựng lại.
        rebuilt = 0
        for version in snapshots_missing_profile():
            if inline:
                ensure_cv_document(version, encoder=encoder, catalog=catalog)
                rebuilt += 1
        mode = 'đã chấm' if inline else 'đã gửi task cho'
        self.stdout.write(
            f'{mode} {scored} hồ sơ ứng tuyển; không chấm được: {failed}; '
            f'dựng lại hồ sơ trích xuất: {rebuilt}.'
        )
