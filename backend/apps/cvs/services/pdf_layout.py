"""Thứ tự đọc của một trang PDF, dựng lại từ vị trí chữ trên trang.

Thư viện đọc PDF trả chữ theo thứ tự vẽ trong tệp, không theo vị trí. Mẫu CV hai
cột thường vẽ hết cột này rồi mới tới cột kia, hoặc vẽ mọi tiêu đề mục sau cùng,
nên tiêu đề rời khỏi nội dung của nó và chữ rơi vào sai mục. Module này chỉ dùng
tọa độ từng ký tự (không phụ thuộc thư viện đọc PDF nào):

1. `build_segments`: gom ký tự thành đoạn chữ liền nhau trên một dòng. Khoảng
   trống ngang lớn (khe giữa hai cột) tách thành hai đoạn.
2. `reading_order`: tìm khe dọc trống chia vùng thành cột trái và cột phải. Dòng
   chạy ngang qua khe (tên, tiêu đề trang) chia trang thành các dải; trong mỗi dải
   đọc hết cột trái rồi mới sang cột phải. Không có khe thì thử cắt ngang ở khoảng
   trống rộng nhất, cuối cùng mới đọc từng hàng từ trên xuống.
3. Cột hẹp chỉ gồm ngày tháng (mẫu CV ghi thời gian bên lề từng việc) không phải
   một cột nội dung: ngày được ghép vào dòng cùng hàng ở cột bên cạnh.

Đơn vị là point của PDF; trục y hướng xuống (top < bottom).
"""

import re
import statistics
from dataclasses import dataclass

# Tính theo chiều cao dòng: khoảng trống trong một từ, giữa hai từ, giữa hai cột.
SPACE_GAP = 0.25
SEGMENT_GAP = 1.5
MIN_GUTTER = 0.6
# Khoảng trống dọc đủ lớn để coi là ranh giới giữa hai khối (không phải giãn dòng).
BLOCK_GAP = 1.2
MIN_COLUMN_SEGMENTS = 3
# Tỷ lệ đoạn được phép chạy ngang qua khe (dòng tên, tiêu đề đầu trang).
MAX_SPANNING_RATIO = 0.15
DATE_COLUMN_RATIO = 0.7
# pdfium thay dấu gạch nối cuối dòng bằng ký tự này.
LINE_END_HYPHEN = '￾'
_DATE_HINT = re.compile(r'(?:19|20)\d{2}|\b(?:nay|hiện tại|present|now|current)\b', re.IGNORECASE)


@dataclass
class Segment:
    left: float
    top: float
    right: float
    bottom: float
    text: str

    @property
    def height(self):
        return self.bottom - self.top

    def same_row(self, other):
        overlap = min(self.bottom, other.bottom) - max(self.top, other.top)
        return overlap >= 0.5 * min(self.height, other.height)

    def joined(self, other, separator):
        return Segment(
            min(self.left, other.left),
            min(self.top, other.top),
            max(self.right, other.right),
            max(self.bottom, other.bottom),
            f'{self.text}{separator}{other.text}',
        )


def _rows(segments):
    """Các hàng từ trên xuống; mỗi hàng là danh sách đoạn từ trái sang phải."""
    rows = []
    for segment in sorted(segments, key=lambda item: (item.top, item.left)):
        if rows and segment.same_row(rows[-1][0]):
            rows[-1].append(segment)
        else:
            rows.append([segment])
    return [sorted(row, key=lambda item: item.left) for row in rows]


def build_segments(chars):
    """Đoạn chữ của một trang từ các ký tự `(ký tự, left, top, right, bottom)` theo thứ tự trong tệp."""
    runs, current, spaced, glyph = [], None, False, (0.0, 0.0)
    for char, left, top, right, bottom in chars:
        if char == LINE_END_HYPHEN:
            char = '-'
        if char.isspace() or right <= left or bottom <= top:
            spaced = spaced or char.isspace()
            continue
        piece = Segment(left, top, right, bottom, char)
        # Chữ ghép ("ffi") là một hình vẽ: các ký tự của nó mang cùng một khung.
        if current is not None and current.same_row(piece) and (left, right) == glyph:
            current.text += char
            continue
        glyph = (left, right)
        gap = left - current.right if current else 0
        if (
            current is not None
            and current.same_row(piece)
            and -0.5 * piece.height <= gap <= SEGMENT_GAP * piece.height
        ):
            separator = ' ' if spaced or gap > SPACE_GAP * piece.height else ''
            current = runs[-1] = current.joined(piece, separator)
        else:
            current = piece
            runs.append(piece)
        spaced = False

    # Ghép các mảnh nằm sát nhau trên cùng hàng mà tệp vẽ không liền nhau.
    segments = []
    for row in _rows(runs):
        for piece in row:
            last = segments[-1] if segments else None
            if (
                last is not None
                and last.same_row(piece)
                and 0 <= piece.left - last.right <= SEGMENT_GAP * piece.height
            ):
                segments[-1] = last.joined(piece, ' ')
            else:
                segments.append(piece)
    return segments


def _line_height(segments):
    return statistics.median(segment.height for segment in segments)


def _gutter(segments):
    """(x giữa khe, các đoạn chạy ngang qua khe) của khe dọc rộng nhất, hoặc None."""
    minimum = MIN_GUTTER * _line_height(segments)
    allowed = int(MAX_SPANNING_RATIO * len(segments))
    edges = sorted({edge for segment in segments for edge in (segment.left, segment.right)})
    best = None
    for start, end in zip(edges, edges[1:], strict=False):
        if end - start < minimum:
            continue
        middle = (start + end) / 2
        spanning = [segment for segment in segments if segment.left < middle < segment.right]
        left = sum(1 for segment in segments if segment.right <= middle)
        right = sum(1 for segment in segments if segment.left >= middle)
        if len(spanning) > allowed or min(left, right) < MIN_COLUMN_SEGMENTS:
            continue
        # Ít dòng chạy ngang hơn thì khe chắc chắn hơn; bằng nhau thì lấy khe rộng hơn.
        key = (-len(spanning), end - start)
        if best is None or key > best[0]:
            best = (key, middle, spanning)
    return None if best is None else best[1:]


def _is_date_column(segments):
    dated = sum(1 for segment in segments if _DATE_HINT.search(segment.text))
    return dated >= DATE_COLUMN_RATIO * len(segments)


def _by_rows(segments):
    """Đọc từng hàng từ trên xuống; các đoạn cùng hàng nối thành một dòng."""
    lines = []
    for row in _rows(segments):
        line = row[0]
        for piece in row[1:]:
            line = line.joined(piece, '  ')
        lines.append(line)
    return lines


def _split_at_widest_gap(segments):
    """(phần trên, phần dưới) nếu có khoảng trống ngang đủ lớn chạy suốt vùng, không thì None."""
    ordered = sorted(segments, key=lambda item: item.top)
    reach, widest, cut = ordered[0].bottom, BLOCK_GAP * _line_height(segments), None
    for index, segment in enumerate(ordered[1:], start=1):
        if segment.top - reach > widest:
            widest, cut = segment.top - reach, index
        reach = max(reach, segment.bottom)
    return None if cut is None else (ordered[:cut], ordered[cut:])


def reading_order(segments):
    """Các dòng của trang theo thứ tự người đọc."""
    if len(segments) < 2:
        return list(segments)
    gutter = _gutter(segments)
    if gutter is None:
        parts = _split_at_widest_gap(segments)
        if parts is None:
            return _by_rows(segments)
        return reading_order(parts[0]) + reading_order(parts[1])

    middle, spanning = gutter
    columns = [segment for segment in segments if not segment.left < middle < segment.right]
    lines, start = [], float('-inf')
    # Mỗi dòng chạy ngang kết thúc một dải; dải cuối kéo tới hết trang.
    for limit in [*sorted(spanning, key=lambda item: item.top), None]:
        end = float('inf') if limit is None else limit.top
        band = [segment for segment in columns if start <= segment.top < end]
        left = [segment for segment in band if segment.right <= middle]
        right = [segment for segment in band if segment.left >= middle]
        if left and right and (_is_date_column(left) or _is_date_column(right)):
            lines += _by_rows(band)
        else:
            lines += reading_order(left) + reading_order(right)
        if limit is not None:
            lines.append(limit)
            start = limit.top
    return lines


def page_text(chars):
    """Văn bản của một trang theo thứ tự đọc, mỗi dòng một hàng."""
    return '\n'.join(line.text for line in reading_order(build_segments(chars)))
