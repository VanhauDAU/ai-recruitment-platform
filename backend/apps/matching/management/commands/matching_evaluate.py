"""Chấm các cặp CV–tin của tập đánh giá bằng đúng mã của sản phẩm (chỉ đọc, không ghi DB).

Đầu vào là mảng JSON `[{"jd": "<public_id của tin>", "cv": "CV-019"}, …]` đọc từ
tệp hoặc stdin (`-`); đầu ra là JSONL, một dòng một cặp. `ml/scripts/evaluate.py`
gọi lệnh này rồi tính chỉ số.

Chạy trong container `ml-worker` (nơi có torch và mô hình):

    docker compose exec -T ml-worker python manage.py matching_evaluate -
    docker compose exec -T ml-worker python manage.py matching_evaluate - \\
        --model-path /models/multilingual-e5-small/zs-v1 --model-version e5-small-zs-v1

Không truyền `--model-path` thì dùng mô hình đang cấu hình cho sản phẩm.
`--no-prefix` dành cho mô hình không thuộc họ E5. `--rule-baseline` thêm điểm của
bộ gợi ý theo luật `profile-rule-v2` để làm mốc so sánh. `--detail` kèm nguyên kết
quả chấm của từng cặp (kỹ năng khớp/thiếu, chi tiết tiêu chí) để phân tích lỗi.
`--ablation tên` (lặp lại được) tắt một thay đổi của công thức để đo riêng phần
đóng góp của nó: `semantic_skills`, `no_relevance_discount`.
"""

import json
import sys

from django.core.management.base import BaseCommand, CommandError

from apps.cvs.models import UserCv
from apps.cvs.services import SYNTHETIC_EMAIL_DOMAIN
from apps.jobs.selectors import rule_scores_for_cv

from ...models import jobs_for_profile
from ...selectors import cvs_for_profile
from ...services import SkillCatalog, get_encoder
from ...services.encoder import SentenceTransformerEncoder
from ...services.evaluation import evaluate_pairs
from ...services.scoring import ABLATIONS


def _encoder(model_path, model_version, no_prefix):
    if not model_path:
        return get_encoder()
    if not model_version:
        raise CommandError('--model-path phải đi kèm --model-version.')
    prefixes = {'query': '', 'passage': ''} if no_prefix else None
    return SentenceTransformerEncoder(model_path, model_version, prefixes=prefixes)


class Command(BaseCommand):
    help = 'Chấm các cặp CV–tin bằng đúng mã của sản phẩm, in JSONL (chỉ đọc).'

    def add_arguments(self, parser):
        parser.add_argument('source', help='Đường dẫn tệp JSON, hoặc "-" để đọc từ stdin.')
        parser.add_argument('--model-path', help='Thư mục mô hình; mặc định là mô hình sản phẩm.')
        parser.add_argument('--model-version', help='Tên phiên bản đi kèm --model-path.')
        parser.add_argument('--no-prefix', action='store_true', help='Không thêm tiền tố E5.')
        parser.add_argument(
            '--cv-type', choices=UserCv.CvType.values, default=UserCv.CvType.BUILDER.value
        )
        parser.add_argument('--email-domain', default=SYNTHETIC_EMAIL_DOMAIN)
        parser.add_argument('--rule-baseline', action='store_true')
        parser.add_argument('--detail', action='store_true', help='Kèm nguyên kết quả chấm.')
        parser.add_argument('--ablation', action='append', choices=ABLATIONS, default=[])

    def handle(self, *args, source, cv_type, email_domain, rule_baseline, **options):
        try:
            stream = sys.stdin if source == '-' else open(source, encoding='utf-8')  # noqa: SIM115
            with stream:
                requested = json.load(stream)
        except (OSError, json.JSONDecodeError) as error:
            raise CommandError(f'Không đọc được danh sách cặp: {error}') from error

        jobs = {
            job.public_id: job
            for job in jobs_for_profile(statuses=None).filter(
                public_id__in={pair['jd'] for pair in requested}
            )
        }
        cvs = {
            cv.user.email.split('@', 1)[0].upper(): cv
            for cv in cvs_for_profile(email_domain).filter(cv_type=cv_type)
        }
        known = [pair for pair in requested if pair['jd'] in jobs and pair['cv'] in cvs]
        encoder = _encoder(options['model_path'], options['model_version'], options['no_prefix'])
        rows = evaluate_pairs(
            [(jobs[pair['jd']], cvs[pair['cv']]) for pair in known],
            encoder=encoder,
            catalog=SkillCatalog.load(),
            detail=options['detail'],
            ablation=tuple(options['ablation']),
        )
        rule_scores = {}
        for pair, row in zip(known, rows, strict=True):
            row = {'jd': pair['jd'], 'cv': pair['cv'], 'model_version': encoder.version, **row}
            if rule_baseline:
                cv = cvs[pair['cv']]
                if cv.pk not in rule_scores:
                    rule_scores[cv.pk] = rule_scores_for_cv(
                        cv.pk, [job.pk for job in jobs.values()]
                    )
                row['rule_score'] = rule_scores[cv.pk].get(jobs[pair['jd']].pk)
            self.stdout.write(json.dumps(row, ensure_ascii=False))
        for pair in requested:
            if pair not in known:
                missing = 'job_not_found' if pair['jd'] not in jobs else 'cv_not_found'
                self.stdout.write(json.dumps({**pair, 'error': missing}, ensure_ascii=False))
