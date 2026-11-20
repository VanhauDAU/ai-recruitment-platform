"""Nhận diện kỹ năng theo taxonomy `skills.Skill` (tên và alias).

Kỹ năng chỉ được nhận khi tên hoặc alias xuất hiện nguyên văn trong văn bản, và
luôn kèm câu chứa nó làm bằng chứng: bộ nhận diện không suy ra kỹ năng mà CV
không viết (kế hoạch mục 6b). Khớp ngữ nghĩa bằng vector thêm ở bước chấm điểm.

Kỹ năng thuộc nhóm "Phẩm chất cá nhân" và nhóm "Tên vị trí" vẫn được nhận nhưng
`counted = False`. Rubric và công thức chấm không đếm phẩm chất cá nhân; còn tên
vị trí ("Fullstack", "Kế toán") là nghề chứ không phải kỹ năng, CV không liệt kê
nó ở mục kỹ năng, và việc đúng nghề đã được đo bằng phép so chức danh.
"""

import re
import unicodedata
from dataclasses import dataclass

from apps.skills.selectors import active_skill_terms

TRAIT_GROUP = 'Phẩm chất cá nhân'
POSITION_GROUP = 'Tên vị trí'
UNCOUNTED_GROUPS = (TRAIT_GROUP, POSITION_GROUP)
# Tên rất ngắn ("AI", "C#") dễ trùng chữ thường trong câu, nên phải đúng hoa thường.
CASE_SENSITIVE_MAX_CHARS = 2
# Ký tự được xem là một phần của tên công nghệ: không cắt "C#" khỏi "C#.NET",
# không nhận "Java" bên trong "JavaScript".
_TERM_BOUNDARY_BEFORE = r'(?<![\w+#])'
_TERM_BOUNDARY_AFTER = r'(?![\w+#])'


def skill_key(name):
    """Khóa so khớp: NFC, chữ thường, gộp khoảng trắng."""
    return ' '.join(unicodedata.normalize('NFC', str(name)).casefold().split())


@dataclass(frozen=True)
class CatalogSkill:
    id: int
    name: str
    group: str

    @property
    def counted(self):
        return self.group not in UNCOUNTED_GROUPS


def _alternation(terms, flags):
    if not terms:
        return None
    ordered = sorted(terms, key=len, reverse=True)
    body = '|'.join(re.escape(term).replace(r'\ ', r'\s+') for term in ordered)
    return re.compile(f'{_TERM_BOUNDARY_BEFORE}(?:{body}){_TERM_BOUNDARY_AFTER}', flags)


class SkillCatalog:
    """Danh mục kỹ năng nạp một lần, dùng cho nhiều tài liệu."""

    def __init__(self, rows):
        self._by_key = {}
        self._by_id = {}
        short, long = set(), set()
        for skill_id, name, aliases, group in rows:
            skill = CatalogSkill(skill_id, name, group or '')
            self._by_id[skill_id] = skill
            for term in (name, *(aliases or [])):
                term = ' '.join(unicodedata.normalize('NFC', str(term)).split())
                if not term:
                    continue
                key = skill_key(term)
                self._by_key.setdefault(key, skill)
                if len(term) <= CASE_SENSITIVE_MAX_CHARS:
                    short.add(term)
                else:
                    long.add(term)
        self._patterns = [
            pattern
            for pattern in (_alternation(long, re.IGNORECASE), _alternation(short, 0))
            if pattern is not None
        ]

    @classmethod
    def load(cls):
        return cls(active_skill_terms())

    def terms_by_skill(self):
        """[(kỹ năng, [khóa tên và alias])] theo id."""
        terms = {}
        for key, skill in self._by_key.items():
            terms.setdefault(skill.id, []).append(key)
        return [
            (self._by_id[skill_id], terms.get(skill_id, [])) for skill_id in sorted(self._by_id)
        ]

    def get(self, skill_id):
        return self._by_id.get(skill_id)

    def resolve(self, name):
        """Kỹ năng có tên hoặc alias đúng bằng `name`; None nếu không có trong danh mục."""
        return self._by_key.get(skill_key(name))

    def find(self, sentences):
        """Kỹ năng nhắc tới trong các câu, theo thứ tự xuất hiện: [(kỹ năng, câu đầu tiên)]."""
        found = {}
        for sentence in sentences:
            text = unicodedata.normalize('NFC', sentence)
            hits = sorted(
                (match.start(), match.group())
                for pattern in self._patterns
                for match in pattern.finditer(text)
            )
            for _, term in hits:
                skill = self.resolve(term)
                if skill is not None and skill.id not in found:
                    found[skill.id] = (skill, sentence)
        return list(found.values())


# Câu dùng làm bằng chứng phải là một câu kể việc đã làm, không phải một mục liệt kê.
MIN_EVIDENCE_WORDS = 4


def skill_entry(skill, source, evidence='', **extra):
    return {
        'skill_id': skill.id,
        'name': skill.name,
        'group': skill.group,
        'counted': skill.counted,
        'source': source,
        'evidence': evidence,
        **extra,
    }


def cv_skills(catalog, *, declared_names=(), listings=(), sentences=()):
    """Kỹ năng của một CV, mỗi kỹ năng kèm nguồn và bằng chứng.

    Nguồn (`source`), theo thứ tự ưu tiên:
    - `declared`: tên khai ở mục kỹ năng (`declared_names`);
    - `listed`: dòng liệt kê ngắn ngoài mục kỹ năng (`listings`: cột bên của PDF,
      dòng chức danh);
    - `text`: chỉ thấy trong câu nội dung (`sentences`).

    Bằng chứng là câu nội dung đầu tiên (từ `MIN_EVIDENCE_WORDS` từ) nhắc tới kỹ
    năng. Kỹ năng chỉ có trong danh sách thì `evidence` rỗng: "không minh chứng"
    theo rubric, không lấy chính danh sách làm bằng chứng.
    """
    statements = [sentence for sentence in sentences if len(sentence.split()) >= MIN_EVIDENCE_WORDS]
    mentions = catalog.find(statements)
    evidence = {skill.id: sentence for skill, sentence in mentions}
    candidates = [(catalog.resolve(name), 'declared') for name in declared_names]
    candidates += [(skill, 'listed') for skill, _ in catalog.find(listings)]
    candidates += [(skill, 'text') for skill, _ in mentions]
    found = {}
    for skill, source in candidates:
        if skill is not None and skill.id not in found:
            found[skill.id] = skill_entry(skill, source, evidence.get(skill.id, ''))
    return list(found.values())
