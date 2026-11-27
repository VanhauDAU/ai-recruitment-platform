"""Soát ngưỡng điểm tối thiểu của gợi ý việc làm và Tìm CV khi đổi mô hình.

    ml/.venv/bin/python ml/scripts/check_score_floor.py

Hai chỗ trong sản phẩm cắt kết quả dưới 30 điểm: gợi ý việc làm (`MIN_SEMANTIC_SCORE`,
`selectors/recommendations.py`) và Tìm CV (`MIN_SEARCH_SCORE`,
`services/candidate_search.py`). Ngưỡng này đặt theo thang điểm của mô hình gốc, nên mỗi
mô hình mới phải soát lại hai điều trên 100 CV tổng hợp × 100 tin thật (nhãn yếu của
`manifest.json`):

- ngưỡng không cắt mất tin neo (gợi ý) hay CV neo (Tìm CV) của cặp khớp mạnh, khớp một phần;
- số kết quả không liên quan (khác vị trí chuyên môn và không neo vào tin) vượt ngưỡng
  không tăng.

Script gọi đúng hàm của sản phẩm (`rank_jobs_for_cv`, `rank_cvs_for_job`) với
`min_score=0` qua `manage.py shell` trong container `backend`, mỗi mô hình một lượt; vector
của từng mô hình phải có sẵn trong DB (`matching_backfill`). Chỉ đọc.

Kết quả: `ml/reports/score_floor.md`.
"""

import json
import subprocess

from evaluate_recommendations import load_jobs
from paths import CV_MANIFEST, JD_IMPORT_MAP, REPO_ROOT, REPORTS_DIR

MODELS = ('e5-base-zs-v1', 'e5-base-wise-v1')
FLOOR = 30

PROBE = r"""
import json
from apps.cvs.models import UserCv
from apps.cvs.services import SYNTHETIC_EMAIL_DOMAIN
from apps.jobs.models import Job
from apps.jobs.selectors import active_jobs_queryset
from apps.matching.selectors import cv_document_for, cvs_for_profile, rank_jobs_for_cv
from apps.matching.services import rank_cvs_for_job

ANCHORED = ('strong', 'partial')
jobs = active_jobs_queryset()
public_ids = dict(Job.objects.filter(pk__in=jobs.values('pk')).values_list('pk', 'public_id'))
documents = {}
for cv in cvs_for_profile(SYNTHETIC_EMAIL_DOMAIN).filter(cv_type=UserCv.CvType.BUILDER):
    code = cv.user.email.split('@', 1)[0].upper()
    document = cv_document_for(cv)
    if code in MANIFEST and document is not None:
        documents[code] = document

recommend = {'anchor': {level: [] for level in ANCHORED}, 'unrelated': [], 'kept': []}
for code, document in documents.items():
    label, kept = MANIFEST[code], 0
    for row in rank_jobs_for_cv(document, jobs, min_score=0):
        job = JOB_CODES.get(public_ids[row['job_id']])
        if job is None:
            continue
        kept += row['match_score'] >= FLOOR
        if job == label['anchor_job']:
            if label['intended_match'] in ANCHORED:
                recommend['anchor'][label['intended_match']].append(row['match_score'])
        elif SPECIALIZATION.get(job) != label['role_written']:
            recommend['unrelated'].append(row['match_score'])
    recommend['kept'].append(kept)

codes = {document.cv_version_id: code for code, document in documents.items()}
search = {'anchor': {level: [] for level in ANCHORED}, 'unrelated': [], 'kept': []}
for job in Job.objects.filter(public_id__in=JOB_CODES):
    ranked = rank_cvs_for_job(job, list(codes), min_score=0)
    if ranked is None:
        continue
    code, kept = JOB_CODES[job.public_id], 0
    for row in ranked:
        label = MANIFEST[codes[row['cv_version_id']]]
        kept += row['score'] >= FLOOR
        if label['anchor_job'] == code:
            if label['intended_match'] in ANCHORED:
                search['anchor'][label['intended_match']].append(row['score'])
        elif SPECIALIZATION.get(code) != label['role_written']:
            search['unrelated'].append(row['score'])
    search['kept'].append(kept)
print('RESULT ' + json.dumps({'recommend': recommend, 'search': search}))
"""


def probe(version, labels):
    code = ''.join(f'{name} = {value!r}\n' for name, value in labels.items()) + PROBE
    command = [
        'docker', 'compose', 'exec', '-T', '-e', 'MATCHING_ENCODER_BACKEND=sentence_transformers',
        '-e', f'MATCHING_MODEL_VERSION={version}', 'backend', 'python', 'manage.py', 'shell',
    ]  # fmt: skip
    result = subprocess.run(command, input=code, capture_output=True, text=True, cwd=REPO_ROOT, check=False)
    found = [line for line in result.stdout.splitlines() if line.startswith('RESULT ')]
    if result.returncode != 0 or not found:
        raise SystemExit(f'Không đo được {version}:\n{(result.stderr or result.stdout).strip()[-2000:]}')
    return json.loads(found[-1].removeprefix('RESULT '))


def percentile(values, share):
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(share * len(ordered)))] if ordered else None


def rows(name, measured):
    """Hai dòng bảng (khớp mạnh, khớp một phần) và một dòng kết quả không liên quan."""
    strong, partial = measured['anchor']['strong'], measured['anchor']['partial']
    unrelated = measured['unrelated']
    return (
        f'| `{name}` | {len(strong)} | {percentile(strong, 0.05)} / {percentile(strong, 0.5)} | {sum(score < FLOOR for score in strong)} '
        f'| {len(partial)} | {percentile(partial, 0.05)} / {percentile(partial, 0.5)} | {sum(score < FLOOR for score in partial)} '
        f'| {percentile(unrelated, 0.5)} / {percentile(unrelated, 0.9)} / {percentile(unrelated, 0.99)} '
        f'| {sum(score >= FLOOR for score in unrelated)} / {len(unrelated)} | {percentile(measured["kept"], 0.5)} |'
    )


def main():
    manifest = json.loads(CV_MANIFEST.read_text(encoding='utf-8'))
    labels = {
        'MANIFEST': {code: {key: row[key] for key in ('anchor_job', 'intended_match', 'role_written')} for code, row in manifest.items()},
        'JOB_CODES': {value['job_public_id']: code for code, value in json.loads(JD_IMPORT_MAP.read_text(encoding='utf-8')).items()},
        'SPECIALIZATION': {job['code']: job['specialization'] for job in load_jobs()},
        'FLOOR': FLOOR,
    }  # fmt: skip
    measured = {version: probe(version, labels) for version in MODELS}
    header = [
        '| Mô hình | Khớp mạnh: số cặp | điểm P5 / trung vị | dưới ngưỡng | Khớp một phần: số cặp | điểm P5 / trung vị | dưới ngưỡng '
        '| Không liên quan: trung vị / P90 / P99 | từ ngưỡng trở lên | Kết quả giữ lại mỗi lượt (trung vị) |',
        '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ]
    lines = [
        f'# Ngưỡng điểm tối thiểu ({FLOOR} điểm) khi đổi mô hình',
        '',
        '100 CV tổng hợp × 100 tin thật, nhãn yếu của kho CV. "Số cặp" là số cặp neo nằm trong nhóm ứng viên mà hệ thống',
        'đem ra chấm (tin hoặc CV gần nhất theo vector). "Không liên quan": khác vị trí chuyên môn và không neo vào tin.',
        'Tạo bằng `ml/scripts/check_score_floor.py`.',
        '',
        '## Gợi ý việc làm (`MIN_SEMANTIC_SCORE`)',
        '',
        *header,
        *(rows(version, measured[version]['recommend']) for version in MODELS),
        '',
        '## Tìm CV (`MIN_SEARCH_SCORE`)',
        '',
        *header,
        *(rows(version, measured[version]['search']) for version in MODELS),
    ]
    REPORTS_DIR.joinpath('score_floor.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
