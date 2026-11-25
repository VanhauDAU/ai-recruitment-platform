"""Quy tắc thuần của danh mục kỹ năng, dùng chung cho model, service và app đối sánh."""

import re
import unicodedata

# Bộ đối sánh nhận diện hai nhóm này theo tên để không tính điểm: phẩm chất cá nhân
# không nằm trong rubric, còn tên vị trí là nghề chứ không phải kỹ năng. Vì vậy
# admin không được đổi tên hay ẩn chúng.
TRAIT_GROUP = 'Phẩm chất cá nhân'
POSITION_GROUP = 'Tên vị trí'
UNCOUNTED_GROUPS = (TRAIT_GROUP, POSITION_GROUP)

# Ký tự bỏ qua khi tìm kỹ năng có thể trùng: "React.js", "React JS", "react-js" cùng
# một khóa. Giữ "+" và "#" để "C++", "C#" không bị coi là trùng với "C".
_DUPLICATE_SEPARATORS = re.compile(r'[\s.\-_/]+')


def duplicate_key(name):
    """Khóa gom các cách viết gần giống nhau của một kỹ năng."""
    text = unicodedata.normalize('NFC', str(name)).casefold()
    return _DUPLICATE_SEPARATORS.sub('', text)


def normalize_skill_name(name):
    """Khóa so khớp tên kỹ năng (`Skill.normalized_name`): gộp khoảng trắng, chữ thường."""
    return ' '.join(str(name).split()).lower()
