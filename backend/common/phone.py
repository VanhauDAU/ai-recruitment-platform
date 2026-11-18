"""Vietnamese mobile numbers in one canonical form (+84xxxxxxxxx)."""


def canonical_vn_mobile(value):
    """Return ``+84`` + 9 digits for a valid Vietnamese mobile, else ``None``."""
    compact = ''.join(character for character in (value or '').strip() if character not in ' .-()')
    if compact.startswith('0'):
        compact = f'+84{compact[1:]}'
    subscriber = compact[3:]
    if (
        len(compact) != 12
        or not compact.startswith('+84')
        or not subscriber.isdigit()
        or subscriber[0] not in '35789'
    ):
        return None
    return compact


def same_phone(left, right):
    """Two numbers are the same line, whatever format each was stored in."""
    if not left or not right:
        return False
    canonical_left, canonical_right = canonical_vn_mobile(left), canonical_vn_mobile(right)
    if canonical_left and canonical_right:
        return canonical_left == canonical_right
    return left.strip() == right.strip()
