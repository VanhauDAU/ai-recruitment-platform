"""Dò mốc quy đổi cosine → điểm sao cho thang điểm của công thức khớp nhãn nhất.

    ml/.venv/bin/python ml/scripts/calibrate_labeled.py --model-dir multilingual-e5-base/wise-v1 --version e5-base-wise-v1
    ml/.venv/bin/python ml/scripts/calibrate_scale.py   --model-dir multilingual-e5-base/wise-v1 --version e5-base-wise-v1

`calibrate_labeled.py` cho cosine của từng cặp; script này thử vài bộ mốc `(low, high)`
lấy từ chính phân bố cosine đó rồi chấm cả 321 cặp của tập hiệu chỉnh bằng **công thức
đầy đủ của sản phẩm** (lệnh `matching_evaluate` trong `ml-worker`, CV của tập hiệu chỉnh
gửi kèm vì không nằm trong DB). Mỗi bộ mốc được đo:

- kappa bậc hai giữa mức hiển thị và nhãn (mục tiêu ≥ 0,70);
- Spearman và NDCG@5;
- điểm của cặp nhãn 0 (trung vị ≤ 20, không cặp nào từ 50);
- điểm trung bình theo nhãn.

Các bộ mốc thử: `low` là trung vị cosine của nhãn 0, của nhãn 1, hoặc điểm giữa hai giá
trị đó; `high` là phân vị 75 hoặc 90 của nhãn 3–4. Cùng một quy ước áp cho cả hai phép
so (toàn văn, chức danh), nên chỉ có sáu phương án và không dò từng con số. Chọn phương
án có kappa cao nhất trong những phương án giữ được điều kiện của nhãn 0; kết quả được
xác nhận lại trên validation của tập vàng bằng `evaluate.py --hybrid-model`.

Kết quả: `ml/reports/calibration_scale_<phiên bản>.md`.
"""

import argparse
import json
import subprocess

import numpy as np
from build_train_pairs import DROPPED_CV_SECTIONS
from evaluate import filled, ndcg_by_job, number, score_quality, spearman
from paths import JD_IMPORT_MAP, LABELING_DIR, LABELS_DIR, REPO_ROOT, REPORTS_DIR, TRAIN_CV_DIR, TRAIN_CV_MANIFEST

LOWS = (('nhãn 0', lambda zero, one: zero), ('giữa nhãn 0 và 1', lambda zero, one: (zero + one) / 2), ('nhãn 1', lambda zero, one: one))
HIGHS = (('P75', 75), ('P90', 90))


def candidates(version):
    """{tên: {'document': (low, high), 'title': (low, high)}} từ cosine của tập hiệu chỉnh."""
    rows = json.loads((LABELS_DIR / f'calibration_cosine_{version}.json').read_text(encoding='utf-8'))
    gold = np.array([row['label'] for row in rows])
    found = {}
    for low_name, low in LOWS:
        for high_name, percentile in HIGHS:
            marks = {}
            for key in ('document', 'title'):
                values = np.array([np.nan if row[key] is None else row[key] for row in rows], dtype=float)
                known = ~np.isnan(values)
                zero, one = np.median(values[known & (gold == 0)]), np.median(values[known & (gold == 1)])
                high = np.percentile(values[known & (gold >= 3)], percentile)
                marks[key] = (round(float(low(zero, one)), 3), round(float(high), 3))
            found[f'low = {low_name}, high = {high_name}'] = marks
    return found


def product_rows(labels, model_dir, version, *, marks=None, flags=()):
    """Chấm các cặp của tập hiệu chỉnh bằng `matching_evaluate`; trả [(cặp có nhãn, dòng kết quả)].

    CV của tập hiệu chỉnh không nằm trong DB nên được gửi kèm; `marks` là các bộ mốc cần
    chấm thêm, `flags` là cờ thêm cho lệnh (cross-encoder, ablation).
    """
    manifest = json.loads(TRAIN_CV_MANIFEST.read_text(encoding='utf-8'))
    jobs = json.loads(JD_IMPORT_MAP.read_text(encoding='utf-8'))
    payload = {
        'pairs': [{'jd': jobs[row['jd']]['job_public_id'], 'cv': row['cv']} for row in labels],
        'cvs': [
            {'id': code, 'language': manifest[code]['language'],
             'data': {key: value for key, value in json.loads((TRAIN_CV_DIR / f'{code}.json').read_text(encoding='utf-8')).items() if key not in DROPPED_CV_SECTIONS}}
            for code in sorted({row['cv'] for row in labels})
        ],
        **({'marks': marks} if marks else {}),
    }  # fmt: skip
    command = [
        'docker', 'compose', 'exec', '-T', 'ml-worker', 'python', 'manage.py', 'matching_evaluate', '-',
        '--model-path', f'/models/{model_dir}', '--model-version', version, *flags,
    ]  # fmt: skip
    result = subprocess.run(command, input=json.dumps(payload), capture_output=True, text=True, cwd=REPO_ROOT, check=False)
    if result.returncode != 0:
        raise SystemExit(f'matching_evaluate lỗi:\n{result.stderr.strip()[-2000:]}')
    rows = {(row['jd'], row['cv']): row for row in map(json.loads, (line for line in result.stdout.splitlines() if line.startswith('{')))}
    return [(row, rows.get((jobs[row['jd']]['job_public_id'], row['cv']), {})) for row in labels]


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--model-dir', required=True)
    parser.add_argument('--version', required=True)
    options = parser.parse_args()

    labels = json.loads((LABELING_DIR / 'calibration_labels.json').read_text(encoding='utf-8'))['pairs']
    marks = candidates(options.version)
    scored = product_rows(labels, options.model_dir, options.version, marks=marks)
    failed = [f'{row["jd"]} × {row["cv"]}' for row, out in scored if 'variants' not in out]
    pairs = [{'jd': row['jd'], 'cv': row['cv'], 'label': row['label']} for row, out in scored if 'variants' in out]
    gold = np.array([pair['label'] for pair in pairs])

    lines = [
        f'# Dò mốc thang điểm cho `{options.version}` trên tập hiệu chỉnh',
        '',
        f'{len(pairs)} cặp có nhãn của {len({pair["jd"] for pair in pairs})} tin, chấm bằng công thức đầy đủ của sản phẩm. '
        'Tạo bằng `ml/scripts/calibrate_scale.py`.',
        '',
        '| Mốc | Toàn văn | Chức danh | Kappa | Spearman | NDCG@5 | Nhãn 0: trung vị | cao nhất | từ 50 | Điểm trung bình theo nhãn 0→4 |',
        '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
    ]
    summary = {}
    for name, value in marks.items():
        scores = filled([out['variants'][name] for _, out in scored if 'variants' in out])
        quality = score_quality(pairs, scores)
        ndcg = float(np.mean(list(ndcg_by_job(pairs, scores).values())))
        summary[name] = {**quality, 'spearman': spearman(scores, gold), 'ndcg': ndcg, 'marks': value}
        means = ' / '.join(number(mean, 0) for mean in quality['mean_by_label'])
        lines.append(
            f'| {name} | {value["document"][0]} – {value["document"][1]} | {value["title"][0]} – {value["title"][1]} | '
            f'{number(quality["band_kappa"])} | {number(summary[name]["spearman"])} | {number(ndcg)} | '
            f'{number(quality["unrelated_median"], 0)} | {number(quality["unrelated_max"], 0)} | {quality["unrelated_at_least_50"]} | {means} |'
        )
    allowed = {name: row for name, row in summary.items() if row['unrelated_median'] <= 20 and row['unrelated_at_least_50'] == 0}
    best = max(allowed or summary, key=lambda name: (allowed or summary)[name]['band_kappa'])
    chosen = summary[best]['marks']
    lines += [
        '',
        f'Chọn: **{best}** ('
        + ('kappa cao nhất trong các phương án giữ được điều kiện của nhãn 0' if allowed else 'kappa cao nhất; không phương án nào giữ được điều kiện "không cặp nhãn 0 nào từ 50 điểm"')
        + ').',
        '',
        f"    '{options.version}': Calibration(document={tuple(chosen['document'])}, title={tuple(chosen['title'])}, ...)",
    ]
    if failed:
        lines += ['', f'Không chấm được {len(failed)} cặp: {", ".join(failed[:6])}…']
    REPORTS_DIR.joinpath(f'calibration_scale_{options.version}.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
