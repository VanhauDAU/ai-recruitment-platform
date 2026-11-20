"""Đo gợi ý việc làm (CV → tin) trên nhãn yếu: `semantic-v1`, luật `profile-rule-v2` và BM25.

    ml/.venv/bin/python ml/scripts/evaluate_recommendations.py

Tập vàng chấm theo chiều tin → CV (mỗi tin 10 CV), nên chiều CV → tin của "Việc làm gợi
ý" chỉ đo được bằng nhãn yếu của kho CV tổng hợp (`manifest.json`), trên 100 tin thật:

- Tin neo: CV khớp mạnh và khớp một phần được viết từ chính tin neo, nên tin neo phải
  đứng đầu danh sách. Đo recall@1, @5, @10 và MRR của tin neo.
- Cùng vị trí: mọi tin có cùng "Vị trí chuyên môn" với vị trí CV được viết (kể cả CV
  "vị trí gần") đều là gợi ý đúng. Đo precision@5 và NDCG@10.
- Độ phủ: tỷ lệ CV nhận được ít nhất một gợi ý.

Thứ hạng của hệ thống lấy từ lệnh `matching_evaluate_recommendations` (đúng selector của
sản phẩm, vector đã tính sẵn trong DB). Kết quả: `ml/reports/recommendations.md`.
"""

import argparse
import json
import subprocess
from pathlib import Path
from statistics import mean

import numpy as np
from baseline import ndcg_at
from corpus import load_cvs, load_jds, tokenize
from generate_cvs import load_jobs
from paths import CV_MANIFEST, JD_IMPORT_MAP, REPO_ROOT, REPORTS_DIR
from rank_bm25 import BM25Okapi

ANCHORED = ('strong', 'partial')


def system_rankings(path=None):
    """{mã CV: thứ hạng}; đọc từ tệp JSONL đã xuất nếu có, không thì chạy lệnh trong container."""
    if path is not None:
        lines = Path(path).read_text(encoding='utf-8').splitlines()
        return {row['cv']: row for row in map(json.loads, (line for line in lines if line.startswith('{')))}
    result = subprocess.run(
        ['docker', 'compose', 'exec', '-T', 'backend', 'python', 'manage.py', 'matching_evaluate_recommendations'],
        capture_output=True, text=True, cwd=REPO_ROOT, check=True,
    )  # fmt: skip
    return {row['cv']: row for row in map(json.loads, result.stdout.splitlines())}


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


def number(value):
    return f'{value:.3f}'.replace('.', ',')


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--rankings', help='Tệp JSONL đã xuất bằng matching_evaluate_recommendations.')
    options = parser.parse_args()
    manifest = json.loads(CV_MANIFEST.read_text(encoding='utf-8'))
    codes_by_id = {value['job_public_id']: code for code, value in json.loads(JD_IMPORT_MAP.read_text(encoding='utf-8')).items()}  # fmt: skip
    specialization = {job['code']: job['specialization'] for job in load_jobs()}
    rows = system_rankings(options.rankings)
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
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    (REPORTS_DIR / 'recommendations.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    (REPORTS_DIR / 'recommendations.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
