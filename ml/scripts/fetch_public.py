"""Tải mô hình và dữ liệu công khai dùng cho thực nghiệm, ghi lại nguồn và phiên bản.

    ml/.venv/bin/python ml/scripts/fetch_public.py            # tải mọi thứ còn thiếu
    ml/.venv/bin/python ml/scripts/fetch_public.py --only datasets

- Dữ liệu vào `ml/data/public/<tên>/` (không commit). Mỗi lần tải ghi nguồn, mã
  commit và ngày tải vào `ml/data/public/SOURCES.md`, để báo cáo trích đúng phiên bản.
- Mô hình vào bộ nhớ đệm của Hugging Face; `export_model.py` chép sang `ml/models/`.

Giấy phép (kiểm tra 19/11/2026):
- VietJobs: kho GitHub `dinhieufam/vietjobs` ghi giấy phép MIT cho cả dự án; trang
  Hugging Face của bộ dữ liệu không có thẻ mô tả. Tệp `LICENSE` được tải kèm.
- resume-job-description-fit: không công bố giấy phép; dùng cho nghiên cứu, không
  phân phối lại.
"""

import argparse
import urllib.request
from datetime import date

from huggingface_hub import HfApi, snapshot_download
from paths import PUBLIC_DIR

DATASETS = {
    'vietjobs': {
        'repo': 'dinhieufam/VietJobs',
        'license': 'MIT (theo kho GitHub dinhieufam/vietjobs)',
        'license_urls': [
            'https://raw.githubusercontent.com/dinhieufam/vietjobs/main/LICENSE',
            'https://raw.githubusercontent.com/dinhieufam/vietjobs/master/LICENSE',
        ],
    },
    'resume_job_fit': {
        'repo': 'cnamuangtoun/resume-job-description-fit',
        'license': 'không công bố',
        'license_urls': [],
    },
}
# Mô hình gốc: cross-encoder để fine-tune (tầng 2) và các bi-encoder để so sánh.
MODELS = [
    'cross-encoder/mmarco-mMiniLMv2-L12-H384-v1',
    'intfloat/multilingual-e5-small',
    'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
]
SOURCES = PUBLIC_DIR / 'SOURCES.md'


def fetch_license(urls, target):
    for url in urls:
        try:
            with urllib.request.urlopen(url, timeout=30) as response:  # noqa: S310 - URL cố định ở trên
                target.write_bytes(response.read())
            return url
        except OSError:
            continue
    return None


def record(lines):
    header = '# Nguồn dữ liệu và mô hình công khai\n\n| Tên | Nguồn | Mã commit | Ngày tải | Giấy phép |\n| --- | --- | --- | --- | --- |\n'
    existing = SOURCES.read_text(encoding='utf-8') if SOURCES.exists() else header
    SOURCES.write_text(existing + ''.join(lines), encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--only', choices=['datasets', 'models'])
    options = parser.parse_args()
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    api, today, lines = HfApi(), date.today().isoformat(), []

    if options.only in (None, 'datasets'):
        for name, source in DATASETS.items():
            target = PUBLIC_DIR / name
            if target.exists():
                print(f'{name}: đã có, bỏ qua')
                continue
            revision = api.dataset_info(source['repo']).sha
            snapshot_download(source['repo'], repo_type='dataset', revision=revision, local_dir=target)
            note = source['license']
            if source['license_urls'] and fetch_license(source['license_urls'], target / 'LICENSE') is None:
                note += ' (chưa tải được tệp LICENSE)'
            lines.append(f'| {name} | https://huggingface.co/datasets/{source["repo"]} | `{revision}` | {today} | {note} |\n')
            print(f'{name}: đã tải vào {target}')

    if options.only in (None, 'models'):
        for repo in MODELS:
            info = api.model_info(repo)
            snapshot_download(repo, revision=info.sha)
            license_name = (info.card_data or {}).get('license', 'xem thẻ mô hình')
            lines.append(f'| {repo} | https://huggingface.co/{repo} | `{info.sha}` | {today} | {license_name} |\n')
            print(f'{repo}: đã có trong bộ nhớ đệm')

    if lines:
        record(lines)
        print(f'Đã ghi nguồn vào {SOURCES}')


if __name__ == '__main__':
    main()
