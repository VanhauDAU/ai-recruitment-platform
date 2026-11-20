"""Thứ hạng gợi ý việc làm của CV tổng hợp, cho `ml/scripts/evaluate_recommendations.py`.

    docker compose exec -T backend python manage.py matching_evaluate_recommendations
    ... matching_evaluate_recommendations --intent intent.json --no-rules --position-bonus 0.15

In JSONL, một dòng một CV builder của tài khoản tổng hợp: mã CV, danh sách `public_id`
tin theo thứ tự `semantic-v1` và (trừ khi `--no-rules`) theo thứ tự `profile-rule-v2`.
Xếp trên mọi tin đang công khai, không lọc tin đã ứng tuyển hay đã ẩn (tài khoản tổng
hợp không có), không cần đồng ý gợi ý (không hiển thị cho ai). Chỉ đọc.

`--intent` mô phỏng nhu cầu đã khai: tệp JSON {mã CV: {"positions": [tên vị trí chuyên
môn]}}; CV không có trong tệp xếp như chưa khai nhu cầu.
"""

import json
import sys
from pathlib import Path

from django.core.management.base import BaseCommand

from apps.cvs.models import UserCv
from apps.cvs.services import SYNTHETIC_EMAIL_DOMAIN
from apps.jobs.models import Job, JobCategory
from apps.jobs.selectors import active_jobs_queryset, ranking_intent, rule_scores_for_cv

from ...selectors import cv_document_for, cvs_for_profile, rank_jobs_for_cv


def _ids_by_name(queryset, field):
    ids = {}
    for pk, name in queryset.values_list('pk', field):
        ids.setdefault(name, []).append(pk)
    return ids


class Command(BaseCommand):
    help = 'Thứ hạng gợi ý việc làm của CV tổng hợp (semantic-v1 và profile-rule-v2), JSONL.'

    def add_arguments(self, parser):
        parser.add_argument('--email-domain', default=SYNTHETIC_EMAIL_DOMAIN)
        parser.add_argument('--intent', help='Tệp JSON nhu cầu mô phỏng theo mã CV (- đọc stdin).')
        parser.add_argument('--position-bonus', type=float, help='Điểm cộng vị trí mong muốn.')
        parser.add_argument('--no-rules', action='store_true', help='Bỏ thứ hạng theo luật.')

    def handle(self, *args, email_domain, intent, position_bonus, no_rules, **options):
        jobs = active_jobs_queryset()
        public_ids = dict(
            Job.objects.filter(pk__in=jobs.values('pk')).values_list('pk', 'public_id')
        )
        if intent == '-':
            intents = json.load(sys.stdin)
        else:
            intents = json.loads(Path(intent).read_text(encoding='utf-8')) if intent else {}
        categories = _ids_by_name(
            JobCategory.objects.filter(category_type=JobCategory.CategoryType.SPECIALIZATION),
            'name',
        )
        extra = {} if position_bonus is None else {'position_bonus': position_bonus}
        for cv in cvs_for_profile(email_domain).filter(cv_type=UserCv.CvType.BUILDER):
            code = cv.user.email.split('@', 1)[0].upper()
            document = cv_document_for(cv)
            wanted = intents.get(code)
            cv_intent = None
            if wanted:
                cv_intent = ranking_intent(
                    jobs,
                    category_ids=[
                        pk
                        for name in wanted.get('positions', [])
                        for pk in categories.get(name, [])
                    ],
                    **extra,
                )
            semantic = (
                []
                if document is None
                else rank_jobs_for_cv(document, jobs, intent=cv_intent, min_score=0)
            )
            row = {'cv': code, 'semantic': [public_ids[item['job_id']] for item in semantic]}
            if not no_rules:
                rules = rule_scores_for_cv(cv.pk, list(public_ids))
                row['rule'] = [
                    public_ids[job_id]
                    for job_id, score in sorted(rules.items(), key=lambda item: (-item[1], item[0]))
                    if score > 0
                ]
            self.stdout.write(json.dumps(row))
