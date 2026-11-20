"""Nhập tin tuyển dụng từ `ml/data/jd/jd_input.xlsx` vào hệ thống đang chạy bằng Docker Compose.

Chạy từ thư mục gốc của repo:

    ml/.venv/bin/python ml/scripts/import_jd.py                          # chạy thử, không ghi gì
    ml/.venv/bin/python ml/scripts/import_jd.py --apply --create-skills   # ghi thật

Chạy thử in ra lỗi từng dòng và danh sách kỹ năng chưa có trong danh mục. Chạy lại
an toàn: tin đã nhập (trùng tiêu đề và mô tả) được bỏ qua. Sau khi ghi thật, bảng
đối chiếu mã tin → tin trong hệ thống được lưu ở `ml/data/jd/jd_import_map.json`.

Khi ghi thật, bảng gộp kỹ năng `ml/labeling/skill_merge.json` được áp vào danh mục
trước, để các cách viết khác nhau của một kỹ năng về cùng một bản ghi. Tin gán vào
một công ty demo không còn trong hệ thống (ví dụ sau khi dựng lại DB) được hệ thống
chia đều cho các công ty demo đang đăng được tin.
"""

import argparse
import json
import subprocess
from datetime import date, datetime
from pathlib import Path

from openpyxl import load_workbook
from paths import JD_IMPORT_MAP, JD_INPUT, REPO_ROOT, SKILL_MERGE

SHEET_NAME = 'JD'
EXAMPLE_PREFIX = 'VD'
# Tiêu đề cột trong Excel → khóa gửi cho lệnh `import_job_postings`.
TEXT_COLUMNS = {
    'Mã tin': 'code',
    'Link nguồn': 'source_url',
    'Trang nguồn': 'source_site',
    'Ngôn ngữ': 'language',
    'Công ty gốc': 'source_company',
    'Gán vào công ty demo': 'company',
    'Tiêu đề tin': 'title',
    'Vị trí chuyên môn': 'specialization',
    'Vị trí chuyên môn khác': 'specialization_other',
    'Cấp bậc': 'position_level',
    'Kinh nghiệm yêu cầu': 'experience_years',
    'Học vấn yêu cầu': 'education_level',
    'Hình thức làm việc': 'work_type',
    'Loại hình': 'employment_type',
    'Tỉnh/thành': 'province',
    'Mô tả công việc': 'description',
    'Yêu cầu ứng viên': 'requirements',
    'Quyền lợi': 'benefits',
    'Ghi chú': 'note',
}
SOURCE_KEYS = ('source_url', 'source_site', 'collected_on', 'language', 'source_company', 'source_deadline')  # fmt: skip


def cell_text(value):
    if isinstance(value, (datetime, date)):
        return value.strftime('%Y-%m-%d')
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return '' if value is None else str(value).strip()


def split_names(value):
    return [name.strip() for name in cell_text(value).replace('\n', ';').split(';') if name.strip()]


def read_rows(path):
    """Đọc tab JD thành danh sách (số dòng Excel, dữ liệu dòng); bỏ dòng trống và dòng ví dụ."""
    sheet = load_workbook(path, read_only=True, data_only=True)[SHEET_NAME]
    lines = sheet.iter_rows(values_only=True)
    headers = [cell_text(header) for header in next(lines)]
    missing = [header for header in TEXT_COLUMNS if header not in headers]
    if missing:
        raise SystemExit(f'Tệp thiếu cột: {", ".join(missing)}. Đừng đổi tên tiêu đề cột.')

    rows = []
    for number, values in enumerate(lines, start=2):
        cells = dict(zip(headers, values, strict=False))
        if not any(cell_text(value) for value in cells.values()):
            continue
        if cell_text(cells.get('Mã tin')).upper().startswith(EXAMPLE_PREFIX):
            continue
        row = {key: cell_text(cells.get(header)) for header, key in TEXT_COLUMNS.items()}
        row['collected_on'] = cell_text(cells.get('Ngày lấy'))
        # Cột bổ sung, không bắt buộc có trong tệp. Hạn nộp gốc chỉ lưu để trích dẫn:
        # hệ thống đặt hạn riêng để tin còn hiển thị suốt thời gian thực nghiệm.
        row['source_deadline'] = cell_text(cells.get('Hạn nộp hồ sơ'))
        row['address_detail'] = cell_text(cells.get('Địa chỉ làm việc'))
        row['work_schedule_note'] = cell_text(cells.get('Thời gian làm việc'))
        row['vacancies'] = cell_text(cells.get('Số lượng tuyển'))
        row['salary_min_million'] = cell_text(cells.get('Lương từ (triệu VND)'))
        row['salary_max_million'] = cell_text(cells.get('Lương đến (triệu VND)'))
        row['domains'] = [
            name
            for name in (cell_text(cells.get(f'Kiến thức chuyên ngành {slot}')) for slot in (1, 2))
            if name
        ]
        row['required_skills'] = split_names(cells.get('Kỹ năng cần có'))
        row['preferred_skills'] = split_names(cells.get('Kỹ năng nên có'))
        row['languages'] = [
            {
                'language': cell_text(cells.get(f'Ngoại ngữ {slot}')),
                'level': cell_text(cells.get(f'Mức ngoại ngữ {slot}')),
                'certificate': cell_text(cells.get(f'Chứng chỉ {slot}')),
                'required': cell_text(cells.get(f'Ngoại ngữ {slot} bắt buộc')).casefold()
                != 'không',
            }
            for slot in (1, 2)
            if cell_text(cells.get(f'Ngoại ngữ {slot}'))
        ]
        rows.append((number, row))
    return rows


def source_problems(row):
    """Lỗi về ghi nguồn; hệ thống không lưu nguồn nên kiểm tra ngay tại đây."""
    problems = []
    if not row['source_url'].startswith(('http://', 'https://')):
        problems.append('Thiếu "Link nguồn" hoặc link không bắt đầu bằng http.')
    try:
        datetime.strptime(row['collected_on'], '%Y-%m-%d')
    except ValueError:
        problems.append('"Ngày lấy" phải có dạng YYYY-MM-DD.')
    if row['language'] not in ('vi', 'en'):
        problems.append('"Ngôn ngữ" phải là vi hoặc en.')
    if not row['source_company']:
        problems.append('Thiếu "Công ty gốc".')
    return problems


def manage(command, payload, *flags):
    """Chạy một lệnh `manage.py` trong container backend, gửi JSON qua stdin, trả báo cáo JSON."""
    result = subprocess.run(
        ['docker', 'compose', 'exec', '-T', 'backend', 'python', 'manage.py', command, '-', *flags],
        input=json.dumps(payload, ensure_ascii=False),
        capture_output=True,
        text=True,
        cwd=REPO_ROOT,
        check=False,
    )
    if result.returncode != 0:
        raise SystemExit(
            f'Không chạy được lệnh {command} trong container backend (Docker Compose đã bật chưa?):\n'
            + (result.stderr.strip() or result.stdout.strip())
        )
    return json.loads(result.stdout.strip().splitlines()[-1])


def run_import(rows, *, apply, create_skills):
    flags = [flag for flag, on in (('--apply', apply), ('--create-skills', create_skills)) if on]
    return manage('import_job_postings', rows, *flags)


def apply_skill_merge():
    report = manage('apply_skill_merge', json.loads(SKILL_MERGE.read_text(encoding='utf-8')))
    print(
        f'Bảng gộp kỹ năng: thêm {report["skills_created"]} kỹ năng, {report["aliases_added"]} '
        f'cách viết khác, {report["skills_grouped"]} kỹ năng vào nhóm.'
    )
    for name in report['conflicts']:
        print(f'  ! "{name}" đã là một kỹ năng riêng, chưa gộp được.')


def fold(name):
    return ' '.join(name.split()).casefold()


def release_missing_companies(rows):
    """Bỏ trống công ty demo không còn đăng được tin; trả {tên công ty: số tin}."""
    available = {fold(name) for name in run_import([], apply=False, create_skills=False)['publisher_companies']}  # fmt: skip
    released = {}
    for row in rows:
        if row['company'] and fold(row['company']) not in available:
            released[row['company']] = released.get(row['company'], 0) + 1
            row['company'] = ''
    return released


def print_report(numbered_rows, held_back, report):
    sent_numbers = [number for number, _ in numbered_rows if number not in held_back]
    entries = dict(zip(sent_numbers, report['rows'], strict=True))
    for number, row in numbered_rows:
        problems = held_back.get(number)
        entry = entries.get(number)
        if problems is None and entry is not None:
            problems = entry['errors']
        label = f'Dòng {number} [{row["code"] or "?"}] {row["title"][:50]}'
        if problems:
            print(f'LỖI   {label}')
            for problem in problems:
                print(f'        - {problem}')
        elif entry['status'] == 'skipped':
            print(f'BỎ QUA {label}: đã có trong hệ thống')
        else:
            print(f'ĐẠT   {label} → {entry["company"]}')
        for warning in (entry or {}).get('warnings', []):
            print(f'        ! {warning}')

    if report['new_skills']:
        print('\nKỹ năng chưa có trong danh mục (số tin dùng):')
        for name, count in sorted(
            report['new_skills'].items(), key=lambda item: (-item[1], item[0])
        ):
            print(f'  {count:>3}  {name}')
    summary = report['summary']
    errors = summary['errors'] + len(held_back)
    mode = 'ĐÃ GHI' if report['applied'] else 'CHẠY THỬ (chưa ghi gì)'
    print(
        f'\n{mode}: {summary["imported"]} tin nhập được, {summary["skipped"]} tin đã có, '
        f'{errors} dòng lỗi, trên tổng {len(numbered_rows)} dòng.'
    )


def save_map(numbered_rows, report):
    path = JD_IMPORT_MAP
    mapping = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
    sources = {row['code']: row for _, row in numbered_rows}
    for entry in report['rows']:
        if entry['job_public_id']:
            mapping[entry['code']] = {
                'job_public_id': entry['job_public_id'],
                'slug': entry['slug'],
                'title': entry['title'],
                **{key: sources[entry['code']][key] for key in SOURCE_KEYS},
            }
    path.write_text(json.dumps(mapping, ensure_ascii=False, indent=2), encoding='utf-8')
    return path


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--file', type=Path, default=JD_INPUT)
    parser.add_argument('--apply', action='store_true', help='Ghi thật. Mặc định chỉ chạy thử.')
    parser.add_argument(
        '--create-skills',
        action='store_true',
        help='Khi ghi thật, tạo kỹ năng chưa có trong danh mục thay vì từ chối dòng.',
    )
    options = parser.parse_args()

    numbered_rows = read_rows(options.file)
    if not numbered_rows:
        raise SystemExit('Chưa có dòng tin nào ngoài dòng ví dụ.')
    held_back = {
        number: problems for number, row in numbered_rows if (problems := source_problems(row))
    }
    sendable = [row for number, row in numbered_rows if number not in held_back]
    if options.apply:
        apply_skill_merge()
    released = release_missing_companies(sendable)
    report = run_import(sendable, apply=options.apply, create_skills=options.create_skills)
    print_report(numbered_rows, held_back, report)
    for company, count in sorted(released.items()):
        print(f'Công ty demo "{company}" không còn đăng được tin: {count} tin được hệ thống tự chia.')
    if options.apply:
        print(f'Bảng đối chiếu mã tin: {save_map(numbered_rows, report)}')


if __name__ == '__main__':
    main()
