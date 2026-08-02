from __future__ import annotations

import re

MIN_SEGMENT_CHARS = 180
MAX_SEGMENT_CHARS = 240

_WHITESPACE = re.compile(r"\s+")
_SENTENCE_END = re.compile(r"[.!?…]+[\"'”’)]*\s")
_CLAUSE_END = re.compile(r"[,;:]\s")


def split_for_speech(
    text: str,
    *,
    minimum: int = MIN_SEGMENT_CHARS,
    maximum: int = MAX_SEGMENT_CHARS,
) -> list[str]:
    """Split prose into bounded chunks, preferring sentence boundaries.

    The upper bound keeps each model turn short enough that an interactive
    request can preempt background article generation. A short final chunk is
    intentionally folded into the previous one only when that remains within
    the hard upper bound.
    """
    if minimum < 1 or maximum < minimum:
        raise ValueError("Invalid speech segment bounds.")

    remaining = _WHITESPACE.sub(" ", text).strip()
    if not remaining:
        return []

    segments: list[str] = []
    while len(remaining) > maximum:
        window = remaining[: maximum + 1]
        cut = _last_boundary(_SENTENCE_END, window, minimum, maximum)
        if cut is None:
            cut = _last_boundary(_CLAUSE_END, window, minimum, maximum)
        if cut is None:
            cut = window.rfind(" ", minimum, maximum + 1)
        if cut is None or cut < minimum:
            cut = maximum

        segment = remaining[:cut].strip()
        if not segment:
            cut = maximum
            segment = remaining[:cut]
        segments.append(segment)
        remaining = remaining[cut:].strip()

    if remaining:
        segments.append(remaining)
    return segments


def _last_boundary(
    pattern: re.Pattern[str], window: str, minimum: int, maximum: int
) -> int | None:
    cuts = [match.end() for match in pattern.finditer(window)]
    eligible = [cut for cut in cuts if minimum <= cut <= maximum]
    return eligible[-1] if eligible else None
