"""Trang chấm tập vàng chạy trên máy: đọc và ghi thẳng `ml/labeling/gold_pairs.xlsx`.

    ml/.venv/bin/python ml/scripts/label_server.py
    → mở http://127.0.0.1:8765

Trang chỉ hiện nội dung tin và CV như người sàng lọc đọc, kèm vài phép đếm khách
quan để chấm nhanh hơn theo rubric (kỹ năng cần có có xuất hiện nguyên chữ trong
CV không, tổng thời gian làm việc theo ngày tháng CV ghi). Không hiện điểm hệ
thống, mức khớp dự kiến hay nguồn ghép cặp: chấm mù (rubric, mục "Kỷ luật gán nhãn").

Mỗi lần lưu ghi một dòng vào phiếu (ghi ra tệp tạm rồi thay, nên không hỏng phiếu
nếu bị ngắt giữa chừng). Lúc khởi động, phiếu hiện tại được sao lưu vào
`ml/data/labels/`. Đóng tệp trong Excel trước khi chấm.
"""

import json
import os
import re
import shutil
import tempfile
import unicodedata
from datetime import date, datetime
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Lock

import openpyxl
from paths import GOLD_SHEET, JD_INPUT, LABELING_DIR, LABELS_DIR, SYNTHETIC_CV_DIR

HOST, PORT = '127.0.0.1', 8765
PAGE = LABELING_DIR / 'label_app.html'
SHEET = 'Chấm'
COLUMNS = ('stt', 'jd_id', 'jd_title', 'cv_id', 'label', 'confidence', 'reason', 'labeled_at')
CONFIDENCE = ('chắc', 'không chắc')
TRAIT_GROUP = 'Phẩm chất cá nhân'
JD_FIELDS = {
    'position': 'Vị trí chuyên môn',
    'level': 'Cấp bậc',
    'experience': 'Kinh nghiệm yêu cầu',
    'education': 'Học vấn yêu cầu',
    'required': 'Kỹ năng cần có',
    'preferred': 'Kỹ năng nên có',
    'description': 'Mô tả công việc',
    'requirements': 'Yêu cầu ứng viên',
}
_SAVE_LOCK = Lock()


# ---------------------------------------------------------------- dữ liệu


def _cell(value):
    return str(value).strip() if value is not None else ''


def _split(value):
    return [part.strip() for part in re.split(r'[;\n]', _cell(value)) if part.strip()]


def load_jds():
    sheet = openpyxl.load_workbook(JD_INPUT, read_only=True, data_only=True)['JD']
    rows = sheet.iter_rows(values_only=True)
    header = [_cell(cell) for cell in next(rows)]
    jds = {}
    for row in rows:
        record = dict(zip(header, row, strict=False))
        code = _cell(record.get('Mã tin'))
        if not code.startswith('JD-'):
            continue
        jd = {key: _cell(record.get(column)) for key, column in JD_FIELDS.items()}
        jd['required'], jd['preferred'] = _split(jd['required']), _split(jd['preferred'])
        jd['title'] = _cell(record.get('Tiêu đề tin'))
        jd['languages'] = [
            {
                'language': _cell(record.get(f'Ngoại ngữ {n}')),
                'level': _cell(record.get(f'Mức ngoại ngữ {n}')),
                'certificate': _cell(record.get(f'Chứng chỉ {n}')),
                'required': _cell(record.get(f'Ngoại ngữ {n} bắt buộc')) == 'Có',
            }
            for n in (1, 2)
            if _cell(record.get(f'Ngoại ngữ {n}'))
        ]
        jds[code] = jd
    return jds


def load_traits():
    groups = json.loads((LABELING_DIR / 'skill_merge.json').read_text(encoding='utf-8'))['groups']
    return {name.casefold() for name in groups.get(TRAIT_GROUP, [])}


def _month(value):
    year, month = (int(part) for part in value.split('-')[:2])
    return year * 12 + month - 1


def experience_months(cv, today):
    """Tổng số tháng làm việc theo ngày tháng CV ghi (gộp khoảng chồng nhau)."""
    now = today.year * 12 + today.month - 1
    ranges = sorted(
        (_month(job['start_date']), _month(job['end_date']) if job.get('end_date') else now)
        for job in cv.get('experience', [])
        if job.get('start_date')
    )
    total, current = 0, None
    for start, end in ranges:
        if current and start <= current[1] + 1:
            current = (current[0], max(current[1], end))
            continue
        if current:
            total += current[1] - current[0] + 1
        current = (start, end)
    return total + (current[1] - current[0] + 1 if current else 0)


def _folded(text):
    return unicodedata.normalize('NFC', text).casefold()


def _work_text(cv):
    """Phần kể việc đã làm: kinh nghiệm và dự án."""
    parts = [
        ' '.join([item.get('role', ''), *item.get('highlights', [])])
        for key in ('experience', 'projects')
        for item in cv.get(key, [])
    ]
    return _folded(' '.join(parts))


def skill_checks(jd, cv, traits):
    """Từng kỹ năng của tin: có nguyên chữ trong CV không, có câu kể việc không, có được đếm không.

    Chỉ là tìm chữ giống hệt; kỹ năng tương đương (MySQL ↔ PostgreSQL) người chấm tự xét.
    """
    text, work = _folded(json.dumps(cv, ensure_ascii=False)), _work_text(cv)
    return [
        {
            'name': name,
            'importance': importance,
            'counted': _folded(name) not in traits,
            'found': _folded(name) in text,
            'in_work': _folded(name) in work,
        }
        for importance, names in (('required', jd['required']), ('preferred', jd['preferred']))
        for name in names
    ]


# ---------------------------------------------------------------- phiếu chấm


def read_rows():
    sheet = openpyxl.load_workbook(GOLD_SHEET, read_only=True)[SHEET]
    rows = []
    for values in sheet.iter_rows(min_row=2, values_only=True):
        row = dict(zip(COLUMNS, values, strict=False))
        if row['stt'] is not None:
            rows.append(row)
    return rows


def excel_is_open():
    return (GOLD_SHEET.parent / f'~${GOLD_SHEET.name}').exists()


def save_label(stt, label, confidence, reason):
    """Ghi nhãn của dòng `stt` (ghi tệp tạm rồi thay, giữ nguyên định dạng và kiểm tra dữ liệu)."""
    with _SAVE_LOCK:
        book = openpyxl.load_workbook(GOLD_SHEET)
        sheet = book[SHEET]
        row = next(
            (cells for cells in sheet.iter_rows(min_row=2) if cells[0].value == stt),
            None,
        )
        if row is None:
            raise KeyError(stt)
        row[COLUMNS.index('label')].value = label
        row[COLUMNS.index('confidence')].value = confidence
        row[COLUMNS.index('reason')].value = reason
        row[COLUMNS.index('labeled_at')].value = date.today().isoformat()
        handle, temporary = tempfile.mkstemp(suffix='.xlsx', dir=GOLD_SHEET.parent)
        os.close(handle)
        try:
            book.save(temporary)
            os.replace(temporary, GOLD_SHEET)
        finally:
            if os.path.exists(temporary):
                os.remove(temporary)


def backup_sheet():
    LABELS_DIR.mkdir(parents=True, exist_ok=True)
    target = LABELS_DIR / f'gold_pairs.backup-{datetime.now():%Y%m%d-%H%M%S}.xlsx'
    shutil.copy2(GOLD_SHEET, target)
    return target


# ---------------------------------------------------------------- HTTP


class LabelHandler(BaseHTTPRequestHandler):
    jds, traits = {}, set()

    def log_message(self, *args):  # gọn terminal
        pass

    def _send(self, status, body, content_type='application/json; charset=utf-8'):
        payload = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        if self.path == '/':
            return self._send(HTTPStatus.OK, PAGE.read_bytes(), 'text/html; charset=utf-8')
        if self.path == '/api/pairs':
            rows = read_rows()
            return self._send(
                HTTPStatus.OK,
                {
                    'pairs': [
                        {key: row[key] for key in ('stt', 'jd_id', 'cv_id', 'label', 'confidence')}
                        for row in rows
                    ],
                    'excel_open': excel_is_open(),
                },
            )
        match = re.fullmatch(r'/api/pairs/(\d+)', self.path)
        if match:
            return self._pair(int(match.group(1)))
        return self._send(HTTPStatus.NOT_FOUND, {'error': 'not_found'})

    def _pair(self, stt):
        row = next((row for row in read_rows() if row['stt'] == stt), None)
        if row is None:
            return self._send(HTTPStatus.NOT_FOUND, {'error': 'not_found'})
        jd = self.jds[row['jd_id']]
        cv = json.loads((SYNTHETIC_CV_DIR / f'{row["cv_id"]}.json').read_text(encoding='utf-8'))
        return self._send(
            HTTPStatus.OK,
            {
                'row': {key: row[key] for key in ('stt', 'jd_id', 'cv_id', 'label', 'confidence', 'reason')},
                'jd': jd,
                'cv': cv,
                'skills': skill_checks(jd, cv, self.traits),
                'cv_months': experience_months(cv, date.today()),
            },
        )

    def do_POST(self):
        if self.path != '/api/labels':
            return self._send(HTTPStatus.NOT_FOUND, {'error': 'not_found'})
        try:
            data = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))))
            stt, label = int(data['stt']), int(data['label'])
            confidence, reason = str(data['confidence']), ' '.join(str(data['reason']).split())
        except (KeyError, TypeError, ValueError):
            return self._send(HTTPStatus.BAD_REQUEST, {'error': 'Dữ liệu không hợp lệ.'})
        if not 0 <= label <= 4 or confidence not in CONFIDENCE or not reason:
            return self._send(HTTPStatus.BAD_REQUEST, {'error': 'Cần điểm 0–4, mức chắc chắn và một dòng lý do.'})
        if excel_is_open():
            return self._send(HTTPStatus.CONFLICT, {'error': 'Phiếu đang mở trong Excel. Đóng Excel rồi lưu lại.'})
        try:
            save_label(stt, label, confidence, reason[:300])
        except KeyError:
            return self._send(HTTPStatus.NOT_FOUND, {'error': 'Không có dòng này trong phiếu.'})
        return self._send(HTTPStatus.OK, {'saved': stt})


def main():
    try:
        server = ThreadingHTTPServer((HOST, PORT), LabelHandler)
    except OSError:
        raise SystemExit(
            f'Cổng {PORT} đang được dùng: trang chấm có lẽ đã chạy sẵn, chỉ cần mở '
            f'http://{HOST}:{PORT}. Nếu không mở được, dừng tiến trình đang giữ cổng '
            f'(lsof -iTCP:{PORT} -sTCP:LISTEN) rồi chạy lại.'
        ) from None
    LabelHandler.jds, LabelHandler.traits = load_jds(), load_traits()
    print(f'Đã sao lưu phiếu: {backup_sheet()}')
    print(f'Trang chấm: http://{HOST}:{PORT}  (Ctrl+C để dừng)')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
