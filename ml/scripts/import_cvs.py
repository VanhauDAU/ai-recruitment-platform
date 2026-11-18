"""Nhập CV tổng hợp ở `ml/data/cv/synthetic/` vào hệ thống và ghi vào tệp theo dõi CV.

Chạy từ thư mục gốc của repo, khi Docker Compose đang chạy:

    ml/.venv/bin/python ml/scripts/import_cvs.py            # chạy thử, không ghi gì
    ml/.venv/bin/python ml/scripts/import_cvs.py --apply    # ghi thật
    ml/.venv/bin/python ml/scripts/import_cvs.py --pdf-twins --apply
        # xuất PDF 15 CV (trải đều nhóm vị trí và ngôn ngữ), tải lên lại thành CV
        # tải lên của cùng tài khoản, lưu bản PDF ở ml/data/cv/pdf/system/

Sau khi ghi thật, mỗi CV đã nhập có một dòng trong tab CV của
`ml/data/cv/cv_inventory.xlsx` (nguồn "CV tổng hợp"). Chạy lại an toàn.
"""

import argparse
import json
import subprocess

from openpyxl import load_workbook
from paths import CV_INVENTORY as INVENTORY
from paths import CV_MANIFEST, REPO_ROOT
from paths import CV_PDF_SYSTEM_DIR as PDF_DIR
from paths import SYNTHETIC_CV_DIR as CV_DIR

PDF_TWIN_COUNT = 15
CONTAINER_PDF_DIR = '/tmp/pdf_twins'
EXPERIENCE_LABELS = [
    (0, 'Chưa có'),
    (11, 'Dưới 1 năm'),
    (23, '1 năm'),
    (35, '2 năm'),
    (47, '3 năm'),
    (59, '4 năm'),
    (71, '5 năm'),
]
EDUCATION_LABELS = {
    'postgraduate': 'Cao học',
    'university': 'Đại học',
    'college': 'Cao đẳng',
    'intermediate': 'Trung cấp',
    'high_school': 'Trung học phổ thông',
}


def experience_label(months):
    return next((label for limit, label in EXPERIENCE_LABELS if months <= limit), 'Trên 5 năm')


def run_command(items, *, apply):
    command = ['docker', 'compose', 'exec', '-T', 'backend', 'python', 'manage.py', 'import_cv_documents', '-']  # fmt: skip
    if apply:
        command.append('--apply')
    result = subprocess.run(
        command,
        input=json.dumps(items, ensure_ascii=False),
        capture_output=True,
        text=True,
        cwd=REPO_ROOT,
        check=False,
    )
    if result.returncode != 0:
        raise SystemExit(
            'Không chạy được lệnh nhập trong container backend (Docker Compose đã bật chưa?):\n'
            + (result.stderr.strip() or result.stdout.strip())
        )
    return json.loads(result.stdout.strip().splitlines()[-1])


def update_inventory(manifest, report):
    workbook = load_workbook(INVENTORY)
    sheet = workbook['CV']
    headers = [cell.value for cell in sheet[1]]
    column = {name: index + 1 for index, name in enumerate(headers)}
    known = {
        sheet.cell(row=row, column=1).value: row
        for row in range(3, sheet.max_row + 1)
        if sheet.cell(row=row, column=1).value
    }
    next_row = max([2, *known.values()]) + 1
    for entry in report['rows']:
        if entry['status'] == 'error':
            continue
        facts = manifest[entry['code']]
        row = known.get(entry['code'])
        if row is None:
            row, next_row = next_row, next_row + 1
        values = {
            'Mã CV': entry['code'],
            'Nguồn': 'CV tổng hợp',
            'Đã có đồng ý': 'Không cần',
            'Đã ẩn danh': 'Có',
            'Ngôn ngữ': facts['language'],
            'Nhóm vị trí': facts['cluster'],
            'Vị trí gần nhất của CV': facts['role_written'],
            'Tổng kinh nghiệm liên quan': experience_label(facts['experience_months']),
            'Học vấn cao nhất': EDUCATION_LABELS.get(facts['education_level'], ''),
            'Dạng': 'CV builder',
            'Tài khoản ứng viên': entry['email'],
            'Trạng thái': 'Đã đưa vào hệ thống',
            'Ghi chú': (
                f'Sinh bằng {facts["model"]} từ {facts["anchor_job"]}, '
                f'mức khớp dự kiến {facts["intended_match"]}'
            ),
        }
        for name, value in values.items():
            if name in column:
                sheet.cell(row=row, column=column[name], value=value)
    workbook.save(INVENTORY)


def pdf_twin_codes(manifest):
    """Mỗi nhóm vị trí lấy một CV tiếng Việt và một CV tiếng Anh, theo thứ tự mã."""
    codes = []
    for cluster in dict.fromkeys(facts['cluster'] for facts in manifest.values()):
        for language in ('vi', 'en'):
            code = next(
                (
                    code
                    for code, facts in manifest.items()
                    if facts['cluster'] == cluster
                    and facts['language'] == language
                    and code not in codes
                ),
                None,
            )
            if code:
                codes.append(code)
    return codes[:PDF_TWIN_COUNT]


def run_pdf_twins(codes, *, apply):
    command = ['docker', 'compose', 'exec', '-T', 'backend', 'python', 'manage.py', 'create_pdf_twins', *codes, '--out', CONTAINER_PDF_DIR]  # fmt: skip
    if apply:
        command.append('--apply')
    result = subprocess.run(command, capture_output=True, text=True, cwd=REPO_ROOT, check=False)
    if result.returncode != 0:
        raise SystemExit(result.stderr.strip() or result.stdout.strip())
    report = json.loads(result.stdout.strip().splitlines()[-1])
    if apply:
        PDF_DIR.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            ['docker', 'compose', 'cp', f'backend:{CONTAINER_PDF_DIR}/.', str(PDF_DIR)],
            cwd=REPO_ROOT,
            check=True,
            capture_output=True,
        )
    return report


def note_pdf_twins(report):
    workbook = load_workbook(INVENTORY)
    sheet = workbook['CV']
    headers = [cell.value for cell in sheet[1]]
    note = headers.index('Ghi chú') + 1
    twins = {entry['code'] for entry in report['rows'] if entry['status'] != 'error'}
    for row in range(3, sheet.max_row + 1):
        cell = sheet.cell(row=row, column=note)
        if sheet.cell(row=row, column=1).value in twins and 'bản PDF' not in (cell.value or ''):
            cell.value = f'{cell.value or ""}; có bản PDF tải lên ({sheet.cell(row=row, column=1).value} PDF)'.lstrip(
                '; '
            )
    workbook.save(INVENTORY)


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--apply', action='store_true', help='Ghi thật. Mặc định chỉ chạy thử.')
    parser.add_argument(
        '--pdf-twins', action='store_true', help='Tạo bản PDF tải lên cho 15 CV đã nhập.'
    )
    options = parser.parse_args()

    manifest = json.loads(CV_MANIFEST.read_text(encoding='utf-8'))
    if options.pdf_twins:
        report = run_pdf_twins(pdf_twin_codes(manifest), apply=options.apply)
        for entry in report['rows']:
            print(f'{entry["status"]:<9} {entry["code"]} {entry.get("error", "")}')
        print(('ĐÃ GHI: ' if report['applied'] else 'CHẠY THỬ: ') + json.dumps(report['summary']))
        if options.apply:
            note_pdf_twins(report)
            print(f'PDF đã lưu ở {PDF_DIR}')
        return
    items = [
        {
            'code': code,
            'language': facts['language'],
            'data': json.loads((CV_DIR / f'{code}.json').read_text(encoding='utf-8')),
        }
        for code, facts in manifest.items()
        if (CV_DIR / f'{code}.json').exists()
    ]
    report = run_command(items, apply=options.apply)
    for entry in report['rows']:
        if entry['status'] == 'error':
            print(f'LỖI   {entry["code"]}: {entry["error"]}')
    summary = report['summary']
    mode = 'ĐÃ GHI' if report['applied'] else 'CHẠY THỬ (chưa ghi gì)'
    print(
        f'{mode}: {summary["imported"]} CV nhập được, {summary["skipped"]} CV đã có, '
        f'{summary["error"]} lỗi; mẫu CV dùng: {report["template"]}.'
    )
    if options.apply:
        update_inventory(manifest, report)
        print(f'Đã cập nhật {INVENTORY}')


if __name__ == '__main__':
    main()
