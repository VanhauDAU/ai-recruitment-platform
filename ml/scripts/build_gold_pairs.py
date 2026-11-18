"""Ghép 150 cặp CV–JD cho tập vàng và xuất phiếu chấm (kế hoạch mục 9).

Mỗi JD trong 15 JD đã chọn lấy 10 CV khác nhau bằng pooling:
4 CV điểm BM25 cao nhất, thêm 4 CV điểm e5 zero-shot cao nhất (chưa có trong
nhóm), thêm 2 CV ngẫu nhiên; rồi xáo thứ tự. Phiếu chấm không ghi nguồn hay
điểm hệ thống (chấm mù); nguồn và phép chia validation/test lưu riêng ở
`ml/data/labels/gold_pool.json`.

Chạy (cần mô hình `intfloat/multilingual-e5-base` đã tải về, chạy trên MPS):
    ml/.venv/bin/python ml/scripts/build_gold_pairs.py
Không ghi đè phiếu đã có; thêm --force để tạo lại (mất nhãn đã chấm).
"""

import argparse
import json
import os
import random
import sys

import numpy as np
from baseline import bm25_scores
from corpus import load_cvs, load_jds
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font
from openpyxl.worksheet.datavalidation import DataValidation
from paths import GOLD_POOL, GOLD_SHEET

GOLD_JDS = (
    'JD-02', 'JD-66', 'JD-11', 'JD-12', 'JD-35', 'JD-36', 'JD-47', 'JD-53',
    'JD-77', 'JD-59', 'JD-60', 'JD-75', 'JD-80', 'JD-89', 'JD-26',
)  # fmt: skip
PER_SOURCE = 4
RANDOM_PER_JD = 2
VALIDATION_JDS = 5
SEED = 42
MODEL = 'intfloat/multilingual-e5-base'


def e5_scores(jds, cvs):
    os.environ.setdefault('HF_HUB_OFFLINE', '1')
    # Cùng giới hạn như smoke_mps.py: mức thấp phải nhỏ hơn mức cao.
    os.environ.setdefault('PYTORCH_MPS_HIGH_WATERMARK_RATIO', '0.6')
    os.environ.setdefault('PYTORCH_MPS_LOW_WATERMARK_RATIO', '0.4')
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer(MODEL, device='mps')
    model.max_seq_length = 512
    encode = lambda texts: model.encode(texts, batch_size=16, normalize_embeddings=True)  # noqa: E731
    jd_vectors = encode([f'query: {jd["text"]}' for jd in jds])
    cv_vectors = encode([f'passage: {cv["text"]}' for cv in cvs])
    return jd_vectors @ cv_vectors.T


def pool(bm25_row, e5_row, rng):
    """10 chỉ số CV khác nhau kèm nguồn: bm25, e5, random."""
    chosen = {}
    for source, row in (('bm25', bm25_row), ('e5', e5_row)):
        for index in np.argsort(-row, kind='stable'):
            if sum(1 for value in chosen.values() if value == source) == PER_SOURCE:
                break
            chosen.setdefault(int(index), source)
    rest = [index for index in range(len(bm25_row)) if index not in chosen]
    for index in rng.sample(rest, RANDOM_PER_JD):
        chosen[index] = 'random'
    order = list(chosen.items())
    rng.shuffle(order)
    return order


def split(jds, rng):
    """5 JD validation (có cả JD tiếng Anh), 10 JD test."""
    while True:
        validation = rng.sample([jd['code'] for jd in jds], VALIDATION_JDS)
        languages = {jd['language'] for jd in jds if jd['code'] in validation}
        if languages == {'vi', 'en'}:
            return sorted(validation)


def write_sheet(jds, cvs, pairs):
    book = Workbook()
    sheet = book.active
    sheet.title = 'Chấm'
    header = ['stt', 'jd_id', 'jd_title', 'cv_id', 'label', 'confidence', 'reason', 'labeled_at']
    sheet.append(header)
    for number, (jd_code, cv_code) in enumerate(pairs, start=1):
        sheet.append([number, jd_code, jds[jd_code]['title'], cv_code, None, None, None, None])
    labels = DataValidation(type='whole', operator='between', formula1='0', formula2='4')
    confidence = DataValidation(type='list', formula1='"chắc,không chắc"')
    labels.add(f'E2:E{len(pairs) + 1}')
    confidence.add(f'F2:F{len(pairs) + 1}')
    sheet.add_data_validation(labels)
    sheet.add_data_validation(confidence)
    for column, width in zip('ABCDEFGH', (5, 8, 50, 8, 7, 12, 50, 12)):
        sheet.column_dimensions[column].width = width
    sheet.freeze_panes = 'A2'

    wrap = Alignment(wrap_text=True, vertical='top')
    for title, rows in (
        ('JD', [(code, jds[code]['title'], jds[code]['text']) for code in dict.fromkeys(p[0] for p in pairs)]),
        ('CV', [(code, cvs[code]['headline'], cvs[code]['text']) for code in sorted({p[1] for p in pairs})]),
    ):  # fmt: skip
        reference = book.create_sheet(title)
        reference.append(['mã', 'tiêu đề', 'nội dung'])
        for row in rows:
            reference.append(list(row))
        for column, width in zip('ABC', (8, 40, 120)):
            reference.column_dimensions[column].width = width
        for cells in reference.iter_rows(min_row=2):
            for cell in cells:
                cell.alignment = wrap
        reference.freeze_panes = 'A2'
    for current in book.worksheets:
        for cell in current[1]:
            cell.font = Font(bold=True)
    GOLD_SHEET.parent.mkdir(parents=True, exist_ok=True)
    book.save(GOLD_SHEET)


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--force', action='store_true')
    options = parser.parse_args()
    if GOLD_SHEET.exists() and not options.force:
        sys.exit(f'{GOLD_SHEET} đã có; thêm --force nếu muốn tạo lại (mất nhãn đã chấm).')

    all_jds = {jd['code']: jd for jd in load_jds()}
    gold = [all_jds[code] for code in GOLD_JDS]
    cvs = load_cvs()
    bm25 = bm25_scores(gold, cvs)
    e5 = e5_scores(gold, cvs)
    rng = random.Random(SEED)
    validation = split(gold, rng)

    pairs, provenance = [], []
    # Chấm theo khối 10 CV của một tin; tin validation trước để có nhãn chỉnh tham số sớm.
    ordered = sorted(gold, key=lambda jd: (jd['code'] not in validation, GOLD_JDS.index(jd['code'])))
    for jd in ordered:
        row = GOLD_JDS.index(jd['code'])
        for index, source in pool(bm25[row], e5[row], rng):
            cv = cvs[index]
            pairs.append((jd['code'], cv['code']))
            provenance.append(
                {
                    'jd_id': jd['code'],
                    'cv_id': cv['code'],
                    'source': source,
                    'split': 'validation' if jd['code'] in validation else 'test',
                    'bm25_rank': int((bm25[row] > bm25[row][index]).sum()) + 1,
                    'e5_rank': int((e5[row] > e5[row][index]).sum()) + 1,
                    'anchored': cv['anchor_job'] == jd['code'],
                }
            )

    write_sheet(all_jds, {cv['code']: cv for cv in cvs}, pairs)
    GOLD_POOL.parent.mkdir(parents=True, exist_ok=True)
    GOLD_POOL.write_text(
        json.dumps(
            {'seed': SEED, 'model': MODEL, 'validation_jds': validation, 'pairs': provenance},
            ensure_ascii=False,
            indent=2,
        ),
        encoding='utf-8',
    )
    sources = {name: sum(1 for p in provenance if p['source'] == name) for name in ('bm25', 'e5', 'random')}
    overlap = sum(1 for p in provenance if p['source'] == 'bm25' and p['e5_rank'] <= PER_SOURCE)
    print(f'{len(pairs)} cặp, {len({p[1] for p in pairs})} CV khác nhau; nguồn {sources}')
    print(f'Validation: {", ".join(validation)}')
    print(f'CV top-4 của BM25 cũng nằm trong top-4 e5: {overlap}/{sources["bm25"]}')
    print(f'Cặp có CV neo vào chính JD: {sum(p["anchored"] for p in provenance)}')
    print(f'Đã ghi {GOLD_SHEET} và {GOLD_POOL}')


if __name__ == '__main__':
    main()
