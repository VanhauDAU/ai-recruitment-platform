"""Nhóm kỹ năng thay thế nhau của một tin (`hybrid-v3`).

Tin thường viết "ít nhất một trong các ngôn ngữ: Golang, Node.js, Python, PHP" hay
"MySQL hoặc PostgreSQL", nhưng danh sách kỹ năng của tin liệt kê từng kỹ năng riêng,
nên chấm theo danh sách sẽ đòi ứng viên có đủ cả bốn. Ở đây các kỹ năng của tin cùng
nằm trong một câu yêu cầu có từ báo hiệu lựa chọn được gom thành một nhóm; CV có một
kỹ năng trong nhóm là đáp ứng cả nhóm (xem `criteria.skills`).

Quy tắc:
- chỉ gom kỹ năng thuộc danh sách kỹ năng được đếm của tin, nhận trong câu bằng danh
  mục (tên và alias, `SkillCatalog.find`);
- nhóm phải có từ hai kỹ năng trở lên;
- kỹ năng còn được nhắc ở một câu yêu cầu không có từ lựa chọn thì vẫn là bắt buộc
  riêng, không vào nhóm nào;
- mỗi kỹ năng thuộc nhiều nhất một nhóm (câu đầu tiên nhắc tới nó).

Nhóm được tính lúc chấm từ các câu yêu cầu đã lưu, nên không đổi hồ sơ trích xuất.
"""

import re

# Từ báo hiệu các kỹ năng trong câu là lựa chọn hoặc ví dụ, không phải đòi đủ tất cả.
_ALTERNATIVE = re.compile(
    r'(?<!\w)(?:hoặc|hay là|một trong|ít nhất một|ít nhất 1|tương đương|tương tự|như|ví dụ|chẳng hạn'
    r'|or|one of|at least one|either|equivalent|similar|such as|e\.g\.)(?!\w)',
    re.IGNORECASE,
)


def alternative_groups(job_skills, requirement_texts, catalog):
    """Các nhóm kỹ năng thay thế nhau của một tin: [(skill_id, ...)]."""
    counted = {skill['skill_id'] for skill in job_skills if skill['counted']}
    mentions = [
        (bool(_ALTERNATIVE.search(text)), [skill.id for skill, _ in catalog.find([text]) if skill.id in counted])
        for text in requirement_texts
    ]  # fmt: skip
    standalone = {skill_id for optional, ids in mentions if not optional for skill_id in ids}
    groups, used = [], set(standalone)
    for optional, ids in mentions:
        members = tuple(skill_id for skill_id in ids if skill_id not in used)
        if optional and len(members) >= 2:
            groups.append(members)
            used.update(members)
    return groups
