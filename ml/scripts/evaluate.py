"""Đo các phương án đối sánh CV–tin trên tập vàng (kế hoạch bản 3, mục 8).

Chạy từ thư mục gốc của repo, khi Docker Compose đang bật:

    ml/.venv/bin/python ml/scripts/evaluate.py
    ml/.venv/bin/python ml/scripts/evaluate.py --model e5-small=multilingual-e5-small/zs-v1
    ml/.venv/bin/python ml/scripts/evaluate.py --ablation
    ml/.venv/bin/python ml/scripts/evaluate.py --split test --final

Mặc định đo trên phần validation. Phần test chỉ chạy một lần ở giai đoạn nghiệm
thu, nên phải thêm `--final` mới chạy.

Phương án được đo:
- TF-IDF và BM25 trên văn bản thô (`baseline.py`).
- Các dòng còn lại lấy từ lệnh `matching_evaluate` chạy trong container `ml-worker`,
  tức đúng mã trích xuất, mã hóa và chấm điểm của sản phẩm: điểm của bộ gợi ý theo
  luật `profile-rule-v2`, cosine toàn văn của bi-encoder, và điểm `hybrid` (công
  thức đang chạy, hiện là `hybrid-v2`).
- `--ablation` thêm ba dòng: `hybrid` với từng thay đổi của `hybrid-v2` bị tắt (khớp
  kỹ năng gần nghĩa bật lại, bỏ hệ số liên quan) và tắt cả hai, tức `hybrid-v1`.
- `--model tên=thư_mục[:noprefix]` thêm một bi-encoder khác trong `ml/models/` (chỉ
  lấy cosine toàn văn, vì mốc quy đổi điểm của `hybrid` là theo từng mô hình).

Chỉ số (mọi khoảng tin cậy là bootstrap 95%, lấy mẫu lại theo tin):
- Spearman giữa điểm và nhãn 0–4, gộp mọi cặp.
- NDCG@5 trung bình theo tin, độ lợi 2^nhãn − 1; kèm mức của xếp ngẫu nhiên.
- Số tin mà phương án có NDCG@5 cao hơn BM25.
- Riêng các dòng `hybrid`: kappa bậc hai giữa mức hiển thị và nhãn, và điểm của các
  cặp nhãn 0 (khác ngành).

Kết quả: `ml/reports/eval_<phần>.md` và `.json`; điểm từng cặp ở `ml/data/eval/`.
"""

import argparse
import json
import subprocess

import numpy as np
from agreement import labels
from baseline import bm25_scores, ndcg_at, tfidf_scores
from corpus import load_cvs, load_jds
from paths import EVAL_DIR, GOLD_CLAUDE_SHEETS, GOLD_POOL, JD_IMPORT_MAP, REPO_ROOT, REPORTS_DIR
from scipy.stats import spearmanr
from sklearn.metrics import cohen_kappa_score

SEED = 42
BOOTSTRAP_ROUNDS = 2000
RANDOM_ROUNDS = 2000
TOP_K = 5
# Mức hiển thị của sản phẩm (ngưỡng điểm) và mức tương ứng của nhãn rubric:
# 4 → Rất phù hợp, 3 → Phù hợp, 2 → Tương đối phù hợp, 0–1 → Chưa phù hợp.
BAND_THRESHOLDS = (50, 65, 80)
LABEL_BAND = {0: 0, 1: 0, 2: 1, 3: 2, 4: 3}
HYBRID = 'hybrid'
# (tên dòng, các thay đổi của công thức bị tắt): xem `scoring.ABLATIONS` ở backend.
ABLATION_RUNS = (
    ('hybrid, bật khớp kỹ năng gần nghĩa', ('semantic_skills',)),
    ('hybrid, bỏ hệ số liên quan', ('no_relevance_discount',)),
    ('hybrid, tắt cả hai (công thức `hybrid-v1`)', ('semantic_skills', 'no_relevance_discount')),
)
BM25 = 'BM25'


def gold_pairs(split):
    """Các cặp của một phần tập vàng: mã tin, mã CV, nhãn, nguồn ghép cặp."""
    pool = {
        (pair['jd_id'], pair['cv_id']): pair
        for pair in json.loads(GOLD_POOL.read_text(encoding='utf-8'))['pairs']
    }
    pairs = []
    for sheet in GOLD_CLAUDE_SHEETS:  # hai đợt gán nhãn, mỗi đợt 150 cặp
        for row in labels(sheet).values():
            info = pool[(row[1], row[3])]
            if split in ('all', info['split']):
                pairs.append({'jd': row[1], 'cv': row[3], 'label': int(row[4]), **info})
    return pairs


def lexical_scores(pairs):
    """Điểm TF-IDF và BM25 của từng cặp, tính trên toàn bộ kho tin và CV."""
    jds, cvs = load_jds(), load_cvs()
    jd_row = {jd['code']: index for index, jd in enumerate(jds)}
    cv_column = {cv['code']: index for index, cv in enumerate(cvs)}
    systems = {}
    for name, matrix in (('TF-IDF', tfidf_scores(jds, cvs)), (BM25, bm25_scores(jds, cvs))):
        systems[name] = [float(matrix[jd_row[p['jd']], cv_column[p['cv']]]) for p in pairs]
    languages = {
        'jd': {jd['code']: jd['language'] for jd in jds},
        'cv': {cv['code']: cv['language'] for cv in cvs},
    }
    return systems, languages


def product_rows(pairs, name, flags):
    """Chạy `matching_evaluate` trong ml-worker; trả dòng kết quả theo đúng thứ tự `pairs`."""
    jobs = json.loads(JD_IMPORT_MAP.read_text(encoding='utf-8'))
    payload = [{'jd': jobs[pair['jd']]['job_public_id'], 'cv': pair['cv']} for pair in pairs]
    command = ['docker', 'compose', 'exec', '-T', 'ml-worker', 'python', 'manage.py', 'matching_evaluate', '-', *flags]  # fmt: skip
    result = subprocess.run(
        command, input=json.dumps(payload), capture_output=True, text=True, cwd=REPO_ROOT, check=False
    )  # fmt: skip
    if result.returncode != 0:
        raise SystemExit(f'matching_evaluate lỗi ({name}):\n{result.stderr.strip()[-2000:]}')
    lines = [line for line in result.stdout.splitlines() if line.startswith('{')]
    EVAL_DIR.mkdir(parents=True, exist_ok=True)
    (EVAL_DIR / f'{name}.jsonl').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    rows = {(row['jd'], row['cv']): row for row in map(json.loads, lines)}
    return [rows[(item['jd'], item['cv'])] for item in payload]


def filled(scores):
    """Cặp không có điểm (không chấm được) xếp dưới mọi cặp có điểm."""
    known = [score for score in scores if score is not None]
    floor = (min(known) - 1) if known else 0.0
    return np.array([floor if score is None else score for score in scores], dtype=float)


def ndcg_by_job(pairs, scores):
    """{mã tin: NDCG@5}; cặp cùng điểm xếp theo mã CV để kết quả lặp lại được."""
    values = {}
    for jd in dict.fromkeys(pair['jd'] for pair in pairs):
        rows = [index for index, pair in enumerate(pairs) if pair['jd'] == jd]
        order = sorted(rows, key=lambda index: (-scores[index], pairs[index]['cv']))
        value = ndcg_at([2 ** pairs[index]['label'] - 1 for index in order], TOP_K)
        if value is not None:
            values[jd] = value
    return values


def random_ndcg(pairs, rng):
    """NDCG@5 kỳ vọng khi xếp CV ngẫu nhiên: mức sàn, vì mỗi tin chỉ có 10 CV."""
    means = []
    for jd in dict.fromkeys(pair['jd'] for pair in pairs):
        gains = np.array([2 ** pair['label'] - 1 for pair in pairs if pair['jd'] == jd])
        values = [ndcg_at(rng.permutation(gains), TOP_K) for _ in range(RANDOM_ROUNDS)]
        if values[0] is not None:
            means.append(np.mean(values))
    return float(np.mean(means))


def spearman(scores, gold):
    if len(set(scores)) < 2 or len(set(gold)) < 2:
        return float('nan')
    return float(spearmanr(scores, gold).statistic)


def interval(values):
    values = [value for value in values if not np.isnan(value)]
    return [float(np.percentile(values, 2.5)), float(np.percentile(values, 97.5))] if values else None


def measure(pairs, scores, rng):
    """Spearman và NDCG@5 kèm khoảng tin cậy bootstrap lấy mẫu lại theo tin."""
    gold = np.array([pair['label'] for pair in pairs])
    by_job = ndcg_by_job(pairs, scores)
    jobs = list(dict.fromkeys(pair['jd'] for pair in pairs))
    members = {jd: [i for i, pair in enumerate(pairs) if pair['jd'] == jd] for jd in jobs}
    rhos, ndcgs = [], []
    for _ in range(BOOTSTRAP_ROUNDS):
        drawn = rng.choice(jobs, size=len(jobs), replace=True)
        rows = [index for jd in drawn for index in members[jd]]
        rhos.append(spearman(scores[rows], gold[rows]))
        ndcgs.append(np.mean([by_job[jd] for jd in drawn if jd in by_job]))
    return {
        'pairs': len(pairs),
        'spearman': spearman(scores, gold),
        'spearman_ci': interval(rhos),
        'ndcg': float(np.mean(list(by_job.values()))),
        'ndcg_ci': interval(ndcgs),
        'ndcg_by_job': by_job,
    }


def band(score):
    return sum(score >= threshold for threshold in BAND_THRESHOLDS)


def score_quality(pairs, scores):
    """Chỉ cho phương án có thang 0–100: mức hiển thị so với nhãn, và điểm cặp khác ngành."""
    gold = [LABEL_BAND[pair['label']] for pair in pairs]
    unrelated = [score for pair, score in zip(pairs, scores, strict=True) if pair['label'] == 0]
    return {
        'band_kappa': float(
            cohen_kappa_score(gold, [band(s) for s in scores], weights='quadratic', labels=[0, 1, 2, 3])
        ),  # fmt: skip
        'unrelated_pairs': len(unrelated),
        'unrelated_median': float(np.median(unrelated)) if unrelated else None,
        'unrelated_max': float(max(unrelated)) if unrelated else None,
        'unrelated_at_least_50': int(sum(score >= 50 for score in unrelated)),
    }


def parse_model(spec):
    name, _, location = spec.partition('=')
    path, _, option = location.partition(':')
    if not name or not path or option not in ('', 'noprefix'):
        raise argparse.ArgumentTypeError('Dạng đúng: tên=thư_mục_trong_ml/models[:noprefix]')
    return name, path, option == 'noprefix'


def number(value, digits=3):
    return '–' if value is None or np.isnan(value) else f'{value:.{digits}f}'.replace('.', ',')


def spread(ci):
    return '–' if ci is None else f'{number(ci[0])} đến {number(ci[1])}'


def report(split, pairs, results, floor, quality, errors, cross):
    jobs = len(dict.fromkeys(pair['jd'] for pair in pairs))
    counts = np.bincount([pair['label'] for pair in pairs], minlength=5)
    lines = [
        f'# Kết quả trên tập vàng, phần {split}',
        '',
        f'{len(pairs)} cặp của {jobs} tin; số cặp theo nhãn 0–4: '
        + ', '.join(str(count) for count in counts)
        + '. Nhãn do Claude gán theo `ml/labeling/rubric.md`.',
        'Khoảng tin cậy 95% là bootstrap lấy mẫu lại theo tin. Tạo bằng `ml/scripts/evaluate.py`.',
        '',
        f'NDCG@5 khi xếp CV ngẫu nhiên là {number(floor)}: mỗi tin chỉ có 10 CV nên mức sàn cao.',
        '',
        '| Phương án | Spearman | Khoảng tin cậy | NDCG@5 | Khoảng tin cậy | Số tin hơn BM25 |',
        '| --- | ---: | --- | ---: | --- | ---: |',
    ]
    reference = results[BM25]['ndcg_by_job']
    for name, result in results.items():
        wins = sum(result['ndcg_by_job'][jd] > reference[jd] for jd in reference)
        beats = '–' if name == BM25 else f'{wins}/{len(reference)}'
        lines.append(
            f'| {name} | {number(result["spearman"])} | {spread(result["spearman_ci"])} | '
            f'{number(result["ndcg"])} | {spread(result["ndcg_ci"])} | {beats} |'
        )
    unrelated = next(iter(quality.values()))['unrelated_pairs']
    lines += [
        '',
        f'## Thang điểm của `{HYBRID}`',
        '',
        f'Kappa bậc hai giữa mức hiển thị và nhãn; điểm của {unrelated} cặp nhãn 0 (khác ngành).',
        '',
        '| Phương án | Kappa mức hiển thị | Nhãn 0: trung vị | Nhãn 0: cao nhất | Nhãn 0: từ 50 điểm |',
        '| --- | ---: | ---: | ---: | ---: |',
    ]
    lines += [
        f'| {name} | {number(row["band_kappa"])} | {number(row["unrelated_median"], 0)} | '
        f'{number(row["unrelated_max"], 0)} | {row["unrelated_at_least_50"]} |'
        for name, row in quality.items()
    ]
    if cross:
        lines += ['', '## Cặp khác ngôn ngữ (tin và CV một Việt một Anh)', '']
        lines += ['| Phương án | Số cặp | Spearman |', '| --- | ---: | ---: |']
        lines += [f'| {name} | {count} | {number(rho)} |' for name, (count, rho) in cross.items()]
    if errors:
        lines += ['', '## Cặp không chấm được', '']
        lines += [f'- {name}: {count} cặp ({codes})' for name, (count, codes) in errors.items()]
    return '\n'.join(lines) + '\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--split', choices=['validation', 'test', 'all'], default='validation')
    parser.add_argument('--final', action='store_true', help='Xác nhận đây là lần chạy test duy nhất.')
    parser.add_argument('--model', action='append', type=parse_model, default=[], metavar='TÊN=THƯ_MỤC')
    parser.add_argument('--ablation', action='store_true', help='Đo thêm hybrid với từng thay đổi bị tắt.')
    options = parser.parse_args()
    if options.split != 'validation' and not options.final:
        raise SystemExit('Phần test chỉ chạy một lần ở giai đoạn nghiệm thu. Thêm --final nếu đúng lúc đó.')

    pairs = gold_pairs(options.split)
    systems, languages = lexical_scores(pairs)
    errors = {}

    def collect(name, rows, key):
        systems[name] = [row.get(key) for row in rows]
        failed = [row['error'] for row in rows if 'error' in row]
        if failed:
            errors[name] = (len(failed), ', '.join(sorted(set(failed))))

    rows = product_rows(pairs, 'product', ['--rule-baseline'])
    version = next((row['model_version'] for row in rows if 'model_version' in row), 'mô hình sản phẩm')
    collect('Luật `profile-rule-v2`', rows, 'rule_score')
    collect(f'Bi-encoder `{version}` (cosine toàn văn)', rows, 'document_similarity')
    collect(HYBRID, rows, 'score')
    hybrids = [HYBRID]
    for index, (name, names) in enumerate(ABLATION_RUNS if options.ablation else ()):
        flags = [flag for item in names for flag in ('--ablation', item)]
        collect(name, product_rows(pairs, f'ablation_{index}', flags), 'score')
        hybrids.append(name)
    for name, path, no_prefix in options.model:
        flags = ['--model-path', f'/models/{path}', '--model-version', name]
        rows = product_rows(pairs, name, flags + (['--no-prefix'] if no_prefix else []))
        collect(f'Bi-encoder `{name}` (cosine toàn văn)', rows, 'document_similarity')

    rng = np.random.default_rng(SEED)
    scores = {name: filled(values) for name, values in systems.items()}
    results = {name: measure(pairs, values, rng) for name, values in scores.items()}
    different = [i for i, p in enumerate(pairs) if languages['jd'][p['jd']] != languages['cv'][p['cv']]]
    gold = np.array([pair['label'] for pair in pairs])
    cross = (
        {name: (len(different), spearman(values[different], gold[different])) for name, values in scores.items()}
        if len(different) >= 10
        else {}
    )
    quality = {name: score_quality(pairs, scores[name]) for name in hybrids}
    floor = random_ndcg(pairs, rng)
    text = report(options.split, pairs, results, floor, quality, errors, cross)

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    (REPORTS_DIR / f'eval_{options.split}.md').write_text(text, encoding='utf-8')
    summary = {
        'split': options.split,
        'pairs': len(pairs),
        'random_ndcg': floor,
        'systems': results,
        'hybrid_quality': quality[HYBRID],
        'hybrid_ablation_quality': {name: quality[name] for name in hybrids[1:]},
        'cross_language': {name: {'pairs': count, 'spearman': rho} for name, (count, rho) in cross.items()},
    }
    (REPORTS_DIR / f'eval_{options.split}.json').write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8'
    )
    print(text)


if __name__ == '__main__':
    main()
