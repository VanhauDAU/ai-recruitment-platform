"""Xuất `profile_json` từ hệ thống ra `ml/data/profiles/` (cần Docker Compose đang chạy).

Gọi lệnh `manage.py matching_export_dataset` trong container backend:
- `skills.jsonl`: danh mục kỹ năng (tên chuẩn và alias);
- `jd.jsonl`: mọi tin đang mở;
- `cv.jsonl`: CV của tài khoản tổng hợp (bản CV builder và bản tải lên);
- `pdf_system.jsonl`, `pdf_topcv.jsonl`: PDF trong `ml/data/cv/pdf/` (chép tạm vào container).

Chạy: ml/.venv/bin/python ml/scripts/export_profiles.py
"""

import subprocess

from paths import CV_PDF_SYSTEM_DIR, CV_PDF_TOPCV_DIR, PROFILES_DIR, REPO_ROOT

CONTAINER_PDF_DIR = '/tmp/matching_pdf'


def compose(*args, output=None):
    command = ['docker', 'compose', *args]
    subprocess.run(command, cwd=REPO_ROOT, check=True, stdout=output)


def export(kind, target, *extra):
    with target.open('w', encoding='utf-8') as output:
        compose('exec', '-T', 'backend', 'python', 'manage.py', 'matching_export_dataset', kind, *extra, output=output)  # fmt: skip
    print(f'{target.relative_to(REPO_ROOT)}: {sum(1 for _ in target.open(encoding="utf-8"))} dòng')


def main():
    PROFILES_DIR.mkdir(parents=True, exist_ok=True)
    export('skills', PROFILES_DIR / 'skills.jsonl')
    export('jobs', PROFILES_DIR / 'jd.jsonl')
    export('cvs', PROFILES_DIR / 'cv.jsonl')
    for name, source in (('pdf_system', CV_PDF_SYSTEM_DIR), ('pdf_topcv', CV_PDF_TOPCV_DIR)):
        target_dir = f'{CONTAINER_PDF_DIR}/{name}'
        # `docker compose cp` chép với quyền root, nên dọn bằng root.
        compose('exec', '-T', '-u', '0', 'backend', 'sh', '-c', f'rm -rf {target_dir} && mkdir -p {CONTAINER_PDF_DIR}')
        compose('cp', str(source), f'backend:{target_dir}')
        export('files', PROFILES_DIR / f'{name}.jsonl', target_dir)
    compose('exec', '-T', '-u', '0', 'backend', 'rm', '-rf', CONTAINER_PDF_DIR)


if __name__ == '__main__':
    main()
