"""Đổi báo cáo JUnit của pytest thành tệp thời lượng cho pytest-split.

    python scripts/ci/pytest_durations.py backend/.test_durations pytest-results-*.xml

pytest-split chia test thành các shard có tổng thời gian gần bằng nhau theo tệp
`backend/.test_durations` ({node id: giây}). CI xuất tệp mới từ JUnit của lần chạy
gần nhất làm artifact; khi thời gian lệch nhiều (shard chênh nhau quá 30 giây), chép
tệp đó đè lên bản commit. Test chưa có trong tệp được tính bằng thời gian trung bình.

JUnit ghi `classname="apps.jobs.tests.test_x.JobTests"` và `name="test_y"`; node id
của pytest là `apps/jobs/tests/test_x.py::JobTests::test_y`. Hàm test không nằm trong
class thì classname dừng ở module.
"""

import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2] / 'backend'


def node_id(classname, name):
    parts = classname.split('.')
    for cut in range(len(parts), 0, -1):
        module = Path(*parts[:cut]).with_suffix('.py')
        if (BACKEND / module).is_file():
            return '::'.join([module.as_posix(), *parts[cut:], name])
    return None


def main(output, reports):
    durations = {}
    for report in reports:
        for case in ET.parse(report).getroot().iter('testcase'):
            if case.find('skipped') is not None:
                continue
            nid = node_id(case.get('classname', ''), case.get('name', ''))
            if nid:
                durations[nid] = round(float(case.get('time') or 0), 3)
    Path(output).write_text(json.dumps(dict(sorted(durations.items())), indent=0) + '\n', encoding='utf-8')
    print(f'{len(durations)} test, tổng {sum(durations.values()):.0f}s -> {output}')


if __name__ == '__main__':
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2:])
