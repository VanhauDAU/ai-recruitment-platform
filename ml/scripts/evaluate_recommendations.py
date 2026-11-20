"""Đo gợi ý việc làm (CV → tin) trên nhãn yếu: `semantic-v1`, luật `profile-rule-v2` và BM25.

    ml/.venv/bin/python ml/scripts/evaluate_recommendations.py

Tập vàng chấm theo chiều tin → CV (mỗi tin 10 CV), nên chiều CV → tin của "Việc làm gợi
ý" chỉ đo được bằng nhãn yếu của kho CV tổng hợp (`manifest.json`), trên 100 tin thật:

- Tin neo: CV khớp mạnh và khớp một phần được viết từ chính tin neo, nên tin neo phải
  đứng đầu danh sách. Đo recall@1, @5, @10 và MRR của tin neo.
- Cùng vị trí: mọi tin có cùng "Vị trí chuyên môn" với vị trí CV được viết (kể cả CV
  "vị trí gần") đều là gợi ý đúng. Đo precision@5 và NDCG@10.
- Độ phủ: tỷ lệ CV nhận được ít nhất một gợi ý.

`--intent-study` đo thêm phần nhu cầu đã khai (vị trí mong muốn), với vài mức điểm cộng:

- Khai đúng nghề cũ: mỗi CV khai vị trí nó được viết. Không được làm tụt tin neo.
- Đổi nghề: mỗi CV khai một vị trí khác (chọn ngẫu nhiên cố định theo mã CV trong các
  vị trí có từ 3 tin). Đo tỷ lệ tin của nghề mới trong 10 gợi ý đầu, và tỷ lệ tin
  nghề cũ còn lại (ứng viên vẫn nên thấy vài tin đúng chuyên môn hiện có).

Thứ hạng của hệ thống lấy từ lệnh `matching_evaluate_recommendations` (đúng selector của
sản phẩm, vector đã tính sẵn trong DB). Kết quả: `ml/reports/recommendations.md`.
"""

import argparse
import json
import random
import shlex
import subprocess
from collections import Counter
from pathlib import Path
from statistics import mean

import numpy as np
from baseline import ndcg_at
from corpus import load_cvs, load_jds, tokenize
from generate_cvs import load_jobs
from paths import CV_MANIFEST, JD_IMPORT_MAP, REPO_ROOT, REPORTS_DIR
from rank_bm25 import BM25Okapi

ANCHORED = ('strong', 'partial')
MANAGE = 'docker compose exec -T backend python manage.py'
POSITION_BONUSES = (0.10, 0.20, 0.30, 0.40, 0.50)
MIN_TARGET_JOBS = 3


def _rows(text):
    return {row['cv']: row for row in map(json.loads, (line for line in text.splitlines() if line.startswith('{')))}


def system_rankings(path=None, *, manage=MANAGE, extra=(), intents=None):
    """{mã CV: thứ hạng}; đọc từ tệp JSONL đã xuất nếu có, không thì chạy lệnh trong container."""
    if path is not None:
        return _rows(Path(path).read_text(encoding='utf-8'))
    command = [*shlex.split(manage), 'matching_evaluate_recommendations', *extra]
    if intents is not None:
        command += ['--intent', '-', '--no-rules']
    result = subprocess.run(
        command, input=json.dumps(intents) if intents is not None else None,
        capture_output=True, text=True, cwd=REPO_ROOT, check=True,
    )  # fmt: skip
    return _rows(result.stdout)


def bm25_rankings(codes):
    jds, cvs = load_jds(), {cv['code']: cv for cv in load_cvs()}
    index = BM25Okapi([tokenize(jd['text']) for jd in jds])
    rankings = {}
    for code in codes:
        scores = index.get_scores(tokenize(cvs[code]['text']))
        rankings[code] = [jds[i]['code'] for i in np.argsort(-scores, kind='stable')]
    return rankings


def measure(rankings, manifest, specialization):
    anchor_ranks, precision, ndcg, covered = [], [], [], 0
    for code, ranking in rankings.items():
        facts = manifest[code]
        covered += bool(ranking)
        if facts['intended_match'] in ANCHORED:
            anchor_ranks.append(ranking.index(facts['anchor_job']) + 1 if facts['anchor_job'] in ranking else None)
        relevant = {job for job, spec in specialization.items() if spec == facts['role_written']}
        if relevant:
            gains = [1 if job in relevant else 0 for job in ranking]
            gains += [1] * len(relevant - set(ranking))  # tin đúng không được gợi ý xếp sau cùng
            precision.append(sum(gains[:5]) / 5)
            ideal = ndcg_at(sorted(gains, reverse=True), 10)
            ndcg.append(ndcg_at(gains, 10) if ideal else 0)

    def recall(k):
        return mean(1 if rank is not None and rank <= k else 0 for rank in anchor_ranks)

    return {
        'cvs': len(rankings),
        'anchored_cvs': len(anchor_ranks),
        'recall@1': recall(1),
        'recall@5': recall(5),
        'recall@10': recall(10),
        'mrr': mean(1 / rank if rank else 0 for rank in anchor_ranks),
        'precision@5': mean(precision),
        'ndcg@10': mean(ndcg),
        'coverage': covered / len(rankings),
    }


def switch_targets(codes, manifest, specialization):
    """Vị trí "nghề mới" của mỗi CV: khác vị trí CV được viết, có từ 3 tin thật."""
    counts = Counter(specialization.values())
    choices = sorted(name for name, count in counts.items() if count >= MIN_TARGET_JOBS)
    targets = {}
    for code in codes:
        options = [name for name in choices if name != manifest[code]['role_written']]
        targets[code] = random.Random(code).choice(options)
    return targets


def measure_switch(rankings, manifest, specialization, targets):
    target_share, own_share, ndcg = [], [], []
    for code, ranking in rankings.items():
        top = ranking[:10]
        target_share.append(sum(specialization.get(job) == targets[code] for job in top) / 10)
        own_share.append(sum(specialization.get(job) == manifest[code]['role_written'] for job in top) / 10)
        gains = [1 if specialization.get(job) == targets[code] else 0 for job in ranking]
        ndcg.append(ndcg_at(gains, 10) or 0)
    counts = Counter(specialization.values())
    return {
        'target@10': mean(target_share),
        'target_ceiling@10': mean(min(counts[targets[code]], 10) / 10 for code in rankings),
        'own@10': mean(own_share),
        'target_ndcg@10': mean(ndcg),
    }


def intent_study(options, manifest, specialization, codes, real_jobs, baseline):
    """Bảng đo nhu cầu đã khai theo từng mức điểm cộng vị trí mong muốn."""
    own = {code: {'positions': [manifest[code]['role_written']]} for code in codes}
    targets = switch_targets(codes, manifest, specialization)
    switch = {code: {'positions': [targets[code]]} for code in codes}

    def ranked(intents, bonus):
        rows = system_rankings(manage=options.manage, extra=['--position-bonus', str(bonus)], intents=intents)
        return {code: real_jobs(rows[code]['semantic']) for code in codes}

    results = {'none': {**measure(baseline, manifest, specialization), **measure_switch(baseline, manifest, specialization, targets)}}
    for bonus in POSITION_BONUSES:
        results[f'own {bonus:.2f}'] = measure(ranked(own, bonus), manifest, specialization)
        results[f'switch {bonus:.2f}'] = measure_switch(ranked(switch, bonus), manifest, specialization, targets)
    lines = [
        '',
        '## Nhu cầu đã khai: vị trí mong muốn',
        '',
        'Mô phỏng trên cùng 100 CV, chỉ khai vị trí mong muốn. "Đổi nghề": mỗi CV khai một vị '
        'trí khác vị trí nó được viết. Tạo bằng `evaluate_recommendations.py --intent-study`.',
        '',
        '| Điểm cộng vị trí mong muốn | Khai đúng nghề cũ: tin neo hạng 1 | MRR | NDCG@10 cùng vị trí '
        '| Đổi nghề: tin nghề mới trong top 10 (trần) | NDCG@10 nghề mới | Tin nghề cũ còn trong top 10 |',
        '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ]
    base = results['none']
    lines.append(
        f'| Không khai | {number(base["recall@1"])} | {number(base["mrr"])} | {number(base["ndcg@10"])} '
        f'| {base["target@10"]:.0%} ({base["target_ceiling@10"]:.0%}) | {number(base["target_ndcg@10"])} | {base["own@10"]:.0%} |'
    )
    for bonus in POSITION_BONUSES:
        own_result, switch_result = results[f'own {bonus:.2f}'], results[f'switch {bonus:.2f}']
        lines.append(
            f'| +{bonus:.2f} | {number(own_result["recall@1"])} | {number(own_result["mrr"])} '
            f'| {number(own_result["ndcg@10"])} | {switch_result["target@10"]:.0%} ({switch_result["target_ceiling@10"]:.0%}) '
            f'| {number(switch_result["target_ndcg@10"])} | {switch_result["own@10"]:.0%} |'
        )
    return lines, results


def number(value):
    return f'{value:.3f}'.replace('.', ',')


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--rankings', help='Tệp JSONL đã xuất bằng matching_evaluate_recommendations.')
    parser.add_argument('--manage', default=MANAGE, help='Lệnh gọi manage.py (mặc định: container backend).')
    parser.add_argument('--intent-study', action='store_true', help='Đo thêm phần nhu cầu đã khai.')
    options = parser.parse_args()
    manifest = json.loads(CV_MANIFEST.read_text(encoding='utf-8'))
    codes_by_id = {value['job_public_id']: code for code, value in json.loads(JD_IMPORT_MAP.read_text(encoding='utf-8')).items()}  # fmt: skip
    specialization = {job['code']: job['specialization'] for job in load_jobs()}
    rows = system_rankings(options.rankings, manage=options.manage)
    codes = sorted(code for code in rows if code in manifest)

    def real_jobs(ids):  # chỉ tính 100 tin thật; 31 tin demo của seed bị bỏ khỏi danh sách
        return [codes_by_id[job] for job in ids if job in codes_by_id]

    methods = {
        'BM25 (CV → tin)': bm25_rankings(codes),
        'Luật `profile-rule-v2`': {code: real_jobs(rows[code]['rule']) for code in codes},
        '`semantic-v1` (e5-base gốc)': {code: real_jobs(rows[code]['semantic']) for code in codes},
    }
    results = {name: measure(rankings, manifest, specialization) for name, rankings in methods.items()}
    sample = next(iter(results.values()))
    lines = [
        '# Gợi ý việc làm trên nhãn yếu (CV → tin)',
        '',
        f'{sample["cvs"]} CV tổng hợp (CV builder) × 100 tin thật; {sample["anchored_cvs"]} CV được viết '
        'từ chính tin neo (khớp mạnh hoặc một phần). Nhãn yếu do script sinh CV đặt ra; CV do mô hình '
        'ngôn ngữ viết từ tin neo nên lợi thế cho phép so từ vựng. Tạo bằng '
        '`ml/scripts/evaluate_recommendations.py`.',
        '',
        '| Phương án | Tin neo ở hạng 1 | Trong top 5 | Trong top 10 | MRR | Precision@5 cùng vị trí | NDCG@10 cùng vị trí | CV có gợi ý |',
        '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ]
    for name, result in results.items():
        lines.append(
            f'| {name} | {number(result["recall@1"])} | {number(result["recall@5"])} | {number(result["recall@10"])} '
            f'| {number(result["mrr"])} | {number(result["precision@5"])} | {number(result["ndcg@10"])} '
            f'| {result["coverage"]:.0%} |'
        )
    if options.intent_study:
        study_lines, study = intent_study(
            options, manifest, specialization, codes, real_jobs, methods['`semantic-v1` (e5-base gốc)']
        )
        lines += study_lines
        results['intent_study'] = study
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    (REPORTS_DIR / 'recommendations.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    (REPORTS_DIR / 'recommendations.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
