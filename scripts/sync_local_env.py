#!/usr/bin/env python3
"""Rewrite backend/.env and frontend/.env to mirror their .env.example.

The template supplies layout, comments and the default for any missing key;
existing local values are kept. Keys the template no longer declares are
dropped and listed by name only. Values are never printed.

    python3 scripts/sync_local_env.py            # sync both services
    python3 scripts/sync_local_env.py --check    # exit 1 if a sync is needed
"""

from __future__ import annotations

import argparse
import sys

from check_env_sync import DECLARATION_PATTERN, LOCAL_ENV_FILES, ROOT, parse_env_file


def render(template_text: str, local_values: dict[str, str]) -> str:
    lines = []
    for line in template_text.splitlines():
        match = DECLARATION_PATTERN.match(line)
        if match and match.group(1) in local_values:
            line = f'{match.group(1)}={local_values[match.group(1)]}'
        lines.append(line)
    return '\n'.join(lines) + '\n'


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--check', action='store_true', help='report only, do not write')
    args = parser.parse_args()

    out_of_sync = False
    for template, local in LOCAL_ENV_FILES.items():
        template_path, local_path = ROOT / template, ROOT / local
        template_text = template_path.read_text(encoding='utf-8')
        if not local_path.is_file():
            print(f'{local}: missing; create it with `cp {template} {local}`')
            out_of_sync = True
            continue

        declarations, _ = parse_env_file(local_path)
        template_keys, _ = parse_env_file(template_path)
        local_values = {key: item.value for key, item in declarations.items()}
        rendered = render(template_text, local_values)
        if rendered == local_path.read_text(encoding='utf-8'):
            print(f'{local}: in sync')
            continue

        out_of_sync = True
        added = sorted(set(template_keys) - set(declarations))
        dropped = sorted(set(declarations) - set(template_keys))
        if not args.check:
            local_path.write_text(rendered, encoding='utf-8')
        print(f'{local}: {"needs sync" if args.check else "synced"}')
        if added:
            print(f'  added with template defaults: {", ".join(added)}')
        if dropped:
            print(f'  dropped (not in template): {", ".join(dropped)}')
    return 1 if args.check and out_of_sync else 0


if __name__ == '__main__':
    sys.exit(main())
