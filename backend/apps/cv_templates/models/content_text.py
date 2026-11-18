"""Rich text and inline text styles inside the canonical CV document.

Text is stored as plain-text blocks plus typed marks, never HTML, so every
renderer (editor, catalogue snapshot, PDF) can draw it without sanitizing markup.
"""

import re

# Font được đóng gói (OFL) và chọn được trong editor (CVT-2).
CV_FONT_FAMILIES = ('Inter', 'Roboto', 'Be Vietnam Pro', 'Lora')
HEX_COLOR_RE = re.compile(r'^#[0-9A-Fa-f]{6}$')
RICH_TEXT_FORMATS = frozenset({'rich_text_v1', 'rich_text_v2'})
SAFE_RICH_TEXT_TYPES = frozenset({'bullet', 'paragraph'})
SAFE_RICH_TEXT_MARKS = frozenset(
    {
        'bold',
        'italic',
        'underline',
        'font_family',
        'font_size_pt',
        'color',
    }
)
BOOLEAN_MARKS = ('bold', 'italic', 'underline')

# The same mark rules apply to a field style and to a rich-text run; only the
# wording differs so the editor can point at the right control.
INLINE_STYLE_MARK_ERRORS = {
    'boolean': 'Boolean field style marks must be boolean.',
    'font_family': 'Contains an unsupported field style font.',
    'font_size': 'Field style font size must be between 8 and 32 pt.',
    'color': 'Field style color must be a six-digit hex color.',
}
RICH_TEXT_MARK_ERRORS = {
    'boolean': 'Boolean rich-text marks must be boolean.',
    'font_family': 'Unsupported rich-text font family.',
    'font_size': 'Rich-text font size must be between 8 and 32 pt.',
    'color': 'Rich-text color must be a six-digit hex color.',
}


def _invalid_mark(marks):
    """Name of the first mark rule ``marks`` breaks, or ``None`` when every mark is valid."""
    if any(key in marks and not isinstance(marks[key], bool) for key in BOOLEAN_MARKS):
        return 'boolean'
    if 'font_family' in marks and marks['font_family'] not in CV_FONT_FAMILIES:
        return 'font_family'
    if 'font_size_pt' in marks and (
        not isinstance(marks['font_size_pt'], (int, float)) or not 8 <= marks['font_size_pt'] <= 32
    ):
        return 'font_size'
    if 'color' in marks and (
        not isinstance(marks['color'], str) or not HEX_COLOR_RE.fullmatch(marks['color'])
    ):
        return 'color'
    return None


def validate_inline_text_styles(styles, errors):
    path = 'content_json.inline_text_styles'
    if not isinstance(styles, dict):
        errors[path] = 'Must be an object.'
        return
    for style_id, marks in styles.items():
        if not isinstance(style_id, str) or not style_id or not isinstance(marks, dict):
            errors[path] = 'Contains an invalid field style.'
            return
        if set(marks).difference(SAFE_RICH_TEXT_MARKS):
            errors[path] = 'Contains an unsupported field style mark.'
            return
        invalid = _invalid_mark(marks)
        if invalid:
            errors[path] = INLINE_STYLE_MARK_ERRORS[invalid]
            return


def validate_rich_text(description, path, errors):
    if description is None:
        return
    if not isinstance(description, dict) or description.get('format') not in RICH_TEXT_FORMATS:
        errors[f'{path}.description'] = 'Must use rich_text_v1 or rich_text_v2.'
        return
    content_path = f'{path}.description.content'
    blocks = description.get('content')
    if not isinstance(blocks, list):
        errors[content_path] = 'Must be a list.'
        return
    for block in blocks:
        if not isinstance(block, dict) or block.get('type') not in SAFE_RICH_TEXT_TYPES:
            errors[content_path] = 'Contains an unsafe rich-text block.'
            return
        text = block.get('text')
        if not isinstance(text, str) or '<' in text or '>' in text:
            errors[content_path] = 'Rich text must be plain text blocks, not HTML.'
            return
        # v1 is unstyled plain text; v2 adds styled runs that must spell the block text.
        if description.get('format') == 'rich_text_v1':
            continue
        runs = block.get('runs')
        if (
            not isinstance(runs, list)
            or ''.join(run.get('text', '') for run in runs if isinstance(run, dict)) != text
        ):
            errors[content_path] = 'rich_text_v2 text must equal the concatenated runs.'
            return
        for run in runs:
            if not isinstance(run, dict) or not isinstance(run.get('text'), str):
                errors[content_path] = 'rich_text_v2 runs must contain text.'
                return
            marks = run.get('marks', {})
            if not isinstance(marks, dict) or set(marks).difference(SAFE_RICH_TEXT_MARKS):
                errors[content_path] = 'rich_text_v2 contains unsupported marks.'
                return
            invalid = _invalid_mark(marks)
            if invalid:
                errors[content_path] = RICH_TEXT_MARK_ERRORS[invalid]
                return
