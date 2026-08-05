#!/usr/bin/env python3
"""Validate repository-local links in tracked and new Markdown files.

The checker deliberately stays offline: external URLs and site-absolute paths
are left untouched so historical references do not make documentation CI
depend on third-party availability.
"""

from __future__ import annotations

import difflib
import html
import os
import posixpath
import re
import subprocess
import sys
import unicodedata
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlsplit


REPOSITORY_ROOT = Path(__file__).resolve().parent.parent
FENCE_START_RE = re.compile(r" {0,3}(`{3,}|~{3,})")
REFERENCE_DEFINITION_RE = re.compile(
    r" {0,3}\[([^\]\n]+)\]:[ \t]*(.*)$"
)
FULL_REFERENCE_RE = re.compile(
    r"!?\[([^\]\n]*)\]\[([^\]\n]*)\]"
)
SHORT_REFERENCE_RE = re.compile(r"!?\[([^\]\n]+)\]")
ATX_HEADING_RE = re.compile(r" {0,3}(#{1,6})(?:[ \t]+(.*)|[ \t]*)$")
SETEXT_HEADING_RE = re.compile(r" {0,3}(=+|-+)[ \t]*$")
EXPLICIT_ANCHOR_RE = re.compile(
    r"""<(?:a|div|h[1-6]|span)\b[^>]*\b(?:id|name)\s*=\s*
        (?:"([^"]+)"|'([^']+)')""",
    re.IGNORECASE | re.VERBOSE,
)
SCHEME_RE = re.compile(r"^[A-Za-z][A-Za-z0-9+.-]*:")
MARKDOWN_ESCAPE_RE = re.compile(r"\\([!\"#$%&'()*+,\-./:;<=>?@\[\\\]^_`{|}~ ])")


@dataclass(frozen=True)
class LinkDestination:
    source: str
    line: int
    destination: str
    kind: str


@dataclass(frozen=True)
class ReferenceDefinition:
    destination: str
    line: int


@dataclass(frozen=True)
class Issue:
    source: str
    line: int
    destination: str
    message: str

    def format(self) -> str:
        return (
            f"{self.source}:{self.line}: {self.message} "
            f"(target: {self.destination!r})"
        )


@dataclass
class CheckStats:
    markdown_files: int = 0
    destinations: int = 0
    internal: int = 0
    external: int = 0
    reference_uses: int = 0


def git_worktree_paths() -> list[str]:
    """Return tracked and untracked, non-ignored paths in the worktree."""
    result = subprocess.run(
        [
            "git",
            "-C",
            str(REPOSITORY_ROOT),
            "ls-files",
            "--cached",
            "--others",
            "--exclude-standard",
            "-z",
        ],
        check=True,
        capture_output=True,
    )
    return [
        entry.decode("utf-8", errors="surrogateescape")
        for entry in result.stdout.split(b"\0")
        if entry
    ]


def is_escaped(value: str, index: int) -> bool:
    backslashes = 0
    index -= 1
    while index >= 0 and value[index] == "\\":
        backslashes += 1
        index -= 1
    return backslashes % 2 == 1


def strip_blockquote_prefix(line: str) -> str:
    return re.sub(r"^(?: {0,3}>[ \t]?)+", "", line)


def mask_html_comments(line: str, in_comment: bool) -> tuple[str, bool]:
    """Mask HTML comments without changing character offsets."""
    characters = list(line)
    cursor = 0
    while cursor < len(line):
        if in_comment:
            end = line.find("-->", cursor)
            if end == -1:
                characters[cursor:] = " " * (len(line) - cursor)
                return "".join(characters), True
            characters[cursor : end + 3] = " " * (end + 3 - cursor)
            cursor = end + 3
            in_comment = False
            continue

        start = line.find("<!--", cursor)
        if start == -1:
            break
        end = line.find("-->", start + 4)
        if end == -1:
            characters[start:] = " " * (len(line) - start)
            return "".join(characters), True
        characters[start : end + 3] = " " * (end + 3 - start)
        cursor = end + 3

    return "".join(characters), in_comment


def visible_markdown_lines(text: str) -> list[str]:
    """Mask fenced code and HTML comments while preserving line numbers."""
    visible: list[str] = []
    fence_character: str | None = None
    fence_length = 0
    in_comment = False

    for original_line in text.splitlines():
        container_line = strip_blockquote_prefix(original_line)
        if fence_character is not None:
            closing_re = re.compile(
                rf" {{0,3}}{re.escape(fence_character)}"
                rf"{{{fence_length},}}[ \t]*$"
            )
            if closing_re.fullmatch(container_line):
                fence_character = None
                fence_length = 0
            visible.append("")
            continue

        fence_match = FENCE_START_RE.match(container_line)
        if fence_match:
            marker = fence_match.group(1)
            fence_character = marker[0]
            fence_length = len(marker)
            visible.append("")
            continue

        masked_line, in_comment = mask_html_comments(
            original_line, in_comment
        )
        visible.append(masked_line)

    return visible


def mask_inline_code(line: str) -> str:
    """Mask complete inline-code spans while retaining brackets around them."""
    characters = list(line)
    cursor = 0
    while cursor < len(line):
        start = line.find("`", cursor)
        if start == -1:
            break
        run_end = start
        while run_end < len(line) and line[run_end] == "`":
            run_end += 1
        marker = line[start:run_end]
        end = line.find(marker, run_end)
        if end == -1:
            cursor = run_end
            continue
        characters[start : end + len(marker)] = " " * (
            end + len(marker) - start
        )
        cursor = end + len(marker)
    return "".join(characters)


def unescape_markdown(value: str) -> str:
    return MARKDOWN_ESCAPE_RE.sub(r"\1", value)


def parse_destination(value: str) -> str | None:
    """Extract a Markdown destination, excluding an optional title."""
    value = value.lstrip()
    if not value:
        return ""

    if value.startswith("<"):
        cursor = 1
        while cursor < len(value):
            if value[cursor] == ">" and not is_escaped(value, cursor):
                return unescape_markdown(value[1:cursor])
            cursor += 1
        return None

    cursor = 0
    parenthesis_depth = 0
    while cursor < len(value):
        character = value[cursor]
        if character == "\\" and cursor + 1 < len(value):
            cursor += 2
            continue
        if character.isspace() and parenthesis_depth == 0:
            break
        if character == "(":
            parenthesis_depth += 1
        elif character == ")":
            if parenthesis_depth == 0:
                break
            parenthesis_depth -= 1
        cursor += 1

    if parenthesis_depth:
        return None
    return unescape_markdown(value[:cursor])


def find_label_start(line: str, closing_bracket: int) -> int | None:
    depth = 0
    cursor = closing_bracket - 1
    while cursor >= 0:
        character = line[cursor]
        if is_escaped(line, cursor):
            cursor -= 1
            continue
        if character == "]":
            depth += 1
        elif character == "[":
            if depth == 0:
                return cursor
            depth -= 1
        cursor -= 1
    return None


def find_inline_link_end(line: str, opening_parenthesis: int) -> int | None:
    depth = 1
    quote: str | None = None
    angle_destination = False
    seen_non_whitespace = False
    cursor = opening_parenthesis + 1

    while cursor < len(line):
        character = line[cursor]
        if character == "\\" and cursor + 1 < len(line):
            cursor += 2
            continue
        if angle_destination:
            if character == ">":
                angle_destination = False
            cursor += 1
            continue
        if quote is not None:
            if character == quote:
                quote = None
            cursor += 1
            continue
        if not seen_non_whitespace and character.isspace():
            cursor += 1
            continue
        if not seen_non_whitespace and character == "<":
            angle_destination = True
            seen_non_whitespace = True
            cursor += 1
            continue
        if (
            character in {"'", '"'}
            and cursor > opening_parenthesis + 1
            and line[cursor - 1].isspace()
        ):
            quote = character
            cursor += 1
            continue

        seen_non_whitespace = True
        if character == "(":
            depth += 1
        elif character == ")":
            depth -= 1
            if depth == 0:
                return cursor
        cursor += 1
    return None


def inline_links(line: str) -> list[tuple[int, int, str]]:
    """Return (start, end-exclusive, destination) for inline links."""
    links: list[tuple[int, int, str]] = []
    cursor = 0
    while cursor < len(line):
        closing_bracket = line.find("](", cursor)
        if closing_bracket == -1:
            break
        if is_escaped(line, closing_bracket):
            cursor = closing_bracket + 2
            continue
        label_start = find_label_start(line, closing_bracket)
        if label_start is None or is_escaped(line, label_start):
            cursor = closing_bracket + 2
            continue
        opening_parenthesis = closing_bracket + 1
        link_end = find_inline_link_end(line, opening_parenthesis)
        if link_end is None:
            cursor = closing_bracket + 2
            continue
        destination = parse_destination(
            line[opening_parenthesis + 1 : link_end]
        )
        if destination is not None:
            links.append((label_start, link_end + 1, destination))
        cursor = link_end + 1
    return links


def normalize_reference_label(label: str) -> str:
    label = html.unescape(unescape_markdown(label))
    return " ".join(label.split()).casefold()


def reference_definitions(
    lines: list[str],
) -> tuple[dict[str, ReferenceDefinition], set[int]]:
    definitions: dict[str, ReferenceDefinition] = {}
    definition_lines: set[int] = set()

    for index, line in enumerate(lines):
        match = REFERENCE_DEFINITION_RE.fullmatch(line)
        if not match or match.group(1).lstrip().startswith("^"):
            continue
        destination = parse_destination(match.group(2))
        consumed_line = index
        if destination is None and not match.group(2).strip():
            next_index = index + 1
            if next_index < len(lines) and re.match(r"^[ \t]+", lines[next_index]):
                destination = parse_destination(lines[next_index])
                consumed_line = next_index
        if destination is None:
            continue

        normalized_label = normalize_reference_label(match.group(1))
        if not normalized_label:
            continue
        definitions.setdefault(
            normalized_label,
            ReferenceDefinition(destination=destination, line=index + 1),
        )
        definition_lines.add(index)
        if consumed_line != index:
            definition_lines.add(consumed_line)

    return definitions, definition_lines


def replace_ranges_with_spaces(
    line: str, ranges: list[tuple[int, int]]
) -> str:
    characters = list(line)
    for start, end in ranges:
        characters[start:end] = " " * (end - start)
    return "".join(characters)


def document_links(
    source: str, text: str
) -> tuple[list[LinkDestination], list[Issue], int]:
    visible_lines = visible_markdown_lines(text)
    link_lines = [mask_inline_code(line) for line in visible_lines]
    definitions, definition_lines = reference_definitions(link_lines)
    destinations = [
        LinkDestination(
            source=source,
            line=definition.line,
            destination=definition.destination,
            kind="reference definition",
        )
        for definition in definitions.values()
    ]
    issues: list[Issue] = []
    reference_uses = 0

    for index, line in enumerate(link_lines):
        extracted_inline = inline_links(line)
        for _, _, destination in extracted_inline:
            destinations.append(
                LinkDestination(
                    source=source,
                    line=index + 1,
                    destination=destination,
                    kind="inline link",
                )
            )

        usage_line = replace_ranges_with_spaces(
            line, [(start, end) for start, end, _ in extracted_inline]
        )
        if index in definition_lines:
            usage_line = " " * len(usage_line)

        full_ranges: list[tuple[int, int]] = []
        for match in FULL_REFERENCE_RE.finditer(usage_line):
            label = match.group(2) or match.group(1)
            normalized_label = normalize_reference_label(label)
            if normalized_label.startswith("^"):
                continue
            reference_uses += 1
            full_ranges.append(match.span())
            if normalized_label not in definitions:
                issues.append(
                    Issue(
                        source=source,
                        line=index + 1,
                        destination=label,
                        message="reference link has no definition",
                    )
                )

        shortcut_line = replace_ranges_with_spaces(usage_line, full_ranges)
        for match in SHORT_REFERENCE_RE.finditer(shortcut_line):
            normalized_label = normalize_reference_label(match.group(1))
            if normalized_label in definitions:
                reference_uses += 1

    return destinations, issues, reference_uses


def plain_heading_text(value: str) -> str:
    """Approximate the visible inline text GitHub uses to build heading IDs."""
    value = html.unescape(value)
    value = re.sub(r"<(https?://[^>]+)>", r"\1", value)
    value = re.sub(r"<[^>]+>", "", value)
    value = re.sub(r"(`+)(.*?)\1", r"\2", value)
    value = re.sub(r"!\[([^\]]*)\]\([^)]*\)", r"\1", value)
    value = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", value)
    value = re.sub(r"!\[([^\]]*)\]\[[^\]]*\]", r"\1", value)
    value = re.sub(r"\[([^\]]+)\]\[[^\]]*\]", r"\1", value)
    value = unescape_markdown(value)
    return value.replace("*", "").replace("_", "").replace("~", "")


def github_slug(value: str) -> str:
    value = plain_heading_text(value).strip().lower()
    slug: list[str] = []
    for character in value:
        category = unicodedata.category(character)
        if (
            category[0] in {"L", "M", "N"}
            or category == "Pc"
            or character == "-"
        ):
            slug.append(character)
        elif character.isspace():
            slug.append("-")
    return "".join(slug)


def markdown_anchors(text: str) -> set[str]:
    lines = visible_markdown_lines(text)
    bases_in_use: set[str] = set()
    anchors: set[str] = set()

    def add_heading(value: str) -> None:
        base = github_slug(value)
        if not base:
            return
        candidate = base
        suffix = 0
        while candidate in bases_in_use:
            suffix += 1
            candidate = f"{base}-{suffix}"
        bases_in_use.add(candidate)
        anchors.add(candidate)

    for index, original_line in enumerate(lines):
        line = strip_blockquote_prefix(original_line)
        for explicit_match in EXPLICIT_ANCHOR_RE.finditer(line):
            anchors.add(explicit_match.group(1) or explicit_match.group(2))

        heading_match = ATX_HEADING_RE.fullmatch(line)
        if heading_match:
            heading = heading_match.group(2) or ""
            heading = re.sub(r"[ \t]+#+[ \t]*$", "", heading)
            add_heading(heading)
            continue

        if (
            index + 1 < len(lines)
            and line.strip()
            and SETEXT_HEADING_RE.fullmatch(
                strip_blockquote_prefix(lines[index + 1])
            )
        ):
            add_heading(line.strip())

    return anchors


class MarkdownLinkChecker:
    def __init__(self, tracked_paths: list[str]) -> None:
        existing_paths = {
            path
            for path in tracked_paths
            if os.path.lexists(REPOSITORY_ROOT / path)
        }
        self.files = existing_paths
        self.directories = {"."}
        for tracked_path in existing_paths:
            for parent in PurePosixPath(tracked_path).parents:
                self.directories.add(parent.as_posix())
        self.all_targets = self.files | self.directories
        self.case_index: dict[str, list[str]] = {}
        for target in self.all_targets:
            self.case_index.setdefault(target.casefold(), []).append(target)
        self.anchor_cache: dict[str, set[str]] = {}

    def check_destination(self, link: LinkDestination) -> Issue | None:
        destination = link.destination.strip()
        if (
            destination.startswith("//")
            or destination.startswith("/")
            or SCHEME_RE.match(destination)
        ):
            return None

        try:
            parsed = urlsplit(destination)
        except ValueError:
            return Issue(
                source=link.source,
                line=link.line,
                destination=link.destination,
                message="cannot parse link destination",
            )

        decoded_path = unquote(parsed.path)
        fragment = unquote(parsed.fragment)
        if "\0" in decoded_path:
            return Issue(
                source=link.source,
                line=link.line,
                destination=link.destination,
                message="link target contains a null byte",
            )

        if decoded_path:
            target = posixpath.normpath(
                posixpath.join(
                    posixpath.dirname(link.source), decoded_path
                )
            )
        else:
            target = link.source

        expects_directory = bool(decoded_path) and decoded_path.endswith("/")
        if target not in self.all_targets:
            case_matches = self.case_index.get(target.casefold(), [])
            if case_matches:
                expected = ", ".join(sorted(case_matches))
                return Issue(
                    source=link.source,
                    line=link.line,
                    destination=link.destination,
                    message=f"target case mismatch; expected {expected!r}",
                )

            basename = PurePosixPath(target).name.casefold()
            moved_candidates = sorted(
                candidate
                for candidate in self.all_targets
                if PurePosixPath(candidate).name.casefold() == basename
            )
            suggestion = ""
            if moved_candidates:
                suggestion = (
                    "; possible moved target: "
                    + ", ".join(moved_candidates[:3])
                )
            return Issue(
                source=link.source,
                line=link.line,
                destination=link.destination,
                message=f"repository target does not exist{suggestion}",
            )

        if expects_directory and target not in self.directories:
            return Issue(
                source=link.source,
                line=link.line,
                destination=link.destination,
                message="target ends with '/' but is not a repository directory",
            )

        if not fragment:
            return None

        markdown_target: str | None = None
        if target in self.files and target.casefold().endswith(".md"):
            markdown_target = target
        elif target in self.directories:
            readme_target = posixpath.join(target, "README.md")
            if readme_target in self.files:
                markdown_target = readme_target

        if markdown_target is None:
            return None

        anchors = self.anchors_for(markdown_target)
        if fragment in anchors:
            return None

        suggestions = difflib.get_close_matches(
            fragment, sorted(anchors), n=3, cutoff=0.6
        )
        suggestion = (
            f"; closest: {', '.join('#' + item for item in suggestions)}"
            if suggestions
            else ""
        )
        return Issue(
            source=link.source,
            line=link.line,
            destination=link.destination,
            message=(
                f"anchor #{fragment!s} does not exist in "
                f"{markdown_target!r}{suggestion}"
            ),
        )

    def anchors_for(self, markdown_path: str) -> set[str]:
        if markdown_path not in self.anchor_cache:
            text = (REPOSITORY_ROOT / markdown_path).read_text(
                encoding="utf-8"
            )
            self.anchor_cache[markdown_path] = markdown_anchors(text)
        return self.anchor_cache[markdown_path]


def main() -> int:
    try:
        tracked_paths = git_worktree_paths()
    except (OSError, subprocess.CalledProcessError) as error:
        print(f"Unable to list repository files: {error}", file=sys.stderr)
        return 2

    markdown_paths = sorted(
        path for path in tracked_paths if path.casefold().endswith(".md")
    )
    checker = MarkdownLinkChecker(tracked_paths)
    stats = CheckStats(markdown_files=len(markdown_paths))
    issues: list[Issue] = []

    for markdown_path in markdown_paths:
        source_path = REPOSITORY_ROOT / markdown_path
        try:
            text = source_path.read_text(encoding="utf-8")
        except (OSError, UnicodeError) as error:
            issues.append(
                Issue(
                    source=markdown_path,
                    line=1,
                    destination=markdown_path,
                    message=f"cannot read Markdown file: {error}",
                )
            )
            continue

        destinations, document_issues, reference_uses = document_links(
            markdown_path, text
        )
        issues.extend(document_issues)
        stats.reference_uses += reference_uses
        for destination in destinations:
            stats.destinations += 1
            raw_destination = destination.destination.strip()
            if (
                raw_destination.startswith("//")
                or raw_destination.startswith("/")
                or SCHEME_RE.match(raw_destination)
            ):
                stats.external += 1
                continue
            stats.internal += 1
            issue = checker.check_destination(destination)
            if issue is not None:
                issues.append(issue)

    if issues:
        for issue in sorted(
            issues, key=lambda item: (item.source, item.line, item.destination)
        ):
            print(issue.format(), file=sys.stderr)
        print(
            "Markdown link check failed: "
            f"{len(issues)} issue(s), {stats.internal} internal destination(s) "
            f"checked across {stats.markdown_files} Markdown file(s).",
            file=sys.stderr,
        )
        return 1

    print(
        "Markdown link check passed: "
        f"{stats.internal} internal destination(s) checked across "
        f"{stats.markdown_files} Markdown file(s); "
        f"{stats.external} external destination(s) skipped"
        f"; {stats.reference_uses} reference-style use(s) resolved."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
