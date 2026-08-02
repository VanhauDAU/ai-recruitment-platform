from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class VoicePreset:
    id: str
    engine_name: str
    label: str
    gender: str
    region: str
    default_style: str

    def public_dict(self) -> dict:
        value = asdict(self)
        value.pop("engine_name")
        return value


# ID là contract ổn định của ProCV; engine_name có thể đổi theo upstream mà
# không buộc frontend/API công khai đổi theo.
VOICE_PRESETS = (
    VoicePreset("north-male-news", "Minh Đức", "Minh Đức", "male", "Bắc", "tin_tuc"),
    VoicePreset(
        "north-male-natural", "Phạm Tuyên", "Phạm Tuyên", "male", "Bắc", "tu_nhien"
    ),
    VoicePreset(
        "south-male-story", "Thái Sơn", "Thái Sơn", "male", "Nam", "doc_truyen"
    ),
    VoicePreset(
        "south-male-natural", "Xuân Vĩnh", "Xuân Vĩnh", "male", "Nam", "tu_nhien"
    ),
    VoicePreset(
        "north-male-story", "Thanh Bình", "Thanh Bình", "male", "Bắc", "doc_truyen"
    ),
    VoicePreset(
        "north-female-natural", "Trúc Ly", "Trúc Ly", "female", "Bắc", "tu_nhien"
    ),
    VoicePreset(
        "north-female-story", "Ngọc Linh", "Ngọc Linh", "female", "Bắc", "doc_truyen"
    ),
    VoicePreset(
        "north-female-natural-2",
        "Đoan Trang",
        "Đoan Trang",
        "female",
        "Bắc",
        "tu_nhien",
    ),
    VoicePreset("north-female-news", "Mai Anh", "Mai Anh", "female", "Bắc", "tin_tuc"),
    VoicePreset(
        "south-female-story", "Thục Đoan", "Thục Đoan", "female", "Nam", "doc_truyen"
    ),
    VoicePreset(
        "south-male-news", "Minh Triết", "Minh Triết", "male", "Nam", "tin_tuc"
    ),
    VoicePreset(
        "south-female-news", "Thùy Dung", "Thùy Dung", "female", "Nam", "tin_tuc"
    ),
    VoicePreset(
        "central-male-natural", "Quang Sơn", "Quang Sơn", "male", "Trung", "tu_nhien"
    ),
    VoicePreset(
        "central-female-natural",
        "Ngọc Trân",
        "Ngọc Trân",
        "female",
        "Trung",
        "tu_nhien",
    ),
)

VOICE_BY_ID = {voice.id: voice for voice in VOICE_PRESETS}
DEFAULT_VOICE_ID = "north-male-natural"
STYLES = (
    {"id": "tu_nhien", "label": "Tự nhiên"},
    {"id": "tin_tuc", "label": "Rõ ràng"},
    {"id": "doc_truyen", "label": "Kể chuyện"},
)
STYLE_IDS = {style["id"] for style in STYLES}
