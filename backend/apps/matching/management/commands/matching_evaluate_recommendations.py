"""Thứ hạng gợi ý việc làm của CV tổng hợp theo hai chiến lược, cho `ml/scripts/evaluate_recommendations.py`.

    docker compose exec -T backend python manage.py matching_evaluate_recommendations

In JSONL, một dòng một CV builder của tài khoản tổng hợp: mã CV, danh sách `public_id`
tin theo thứ tự `semantic-v1` và theo thứ tự `profile-rule-v2`. Xếp trên mọi tin đang
công khai, không lọc tin đã ứng tuyển hay đã ẩn (tài khoản tổng hợp không có), không
cần đồng ý gợi ý (không hiển thị cho ai). Chỉ đọc.
"""

import json

from django.core.management.base import BaseCommand

from apps.cvs.models import UserCv
from apps.cvs.services import SYNTHETIC_EMAIL_DOMAIN
from apps.jobs.models import Job
from apps.jobs.selectors import active_jobs_queryset, rule_scores_for_cv

from ...selectors import cv_document_for, cvs_for_profile, rank_jobs_for_cv


class Command(BaseCommand):
    help = 'Thứ hạng gợi ý việc làm của CV tổng hợp (semantic-v1 và profile-rule-v2), JSONL.'

    def add_arguments(self, parser):
        parser.add_argument('--email-domain', default=SYNTHETIC_EMAIL_DOMAIN)

    def handle(self, *args, email_domain, **options):
        jobs = active_jobs_queryset()
        public_ids = dict(
            Job.objects.filter(pk__in=jobs.values('pk')).values_list('pk', 'public_id')
        )
        for cv in cvs_for_profile(email_domain).filter(cv_type=UserCv.CvType.BUILDER):
            document = cv_document_for(cv)
            semantic = [] if document is None else rank_jobs_for_cv(document, jobs, min_score=0)
            rules = rule_scores_for_cv(cv.pk, list(public_ids))
            row = {
                'cv': cv.user.email.split('@', 1)[0].upper(),
                'semantic': [public_ids[item['job_id']] for item in semantic],
                'rule': [
                    public_ids[job_id]
                    for job_id, score in sorted(rules.items(), key=lambda item: (-item[1], item[0]))
                    if score > 0
                ],
            }
            self.stdout.write(json.dumps(row))
