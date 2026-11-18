"""Xuất `profile_json` ra JSONL (một dòng một tài liệu) cho các script ở `ml/`.

python manage.py matching_export_dataset jobs
python manage.py matching_export_dataset cvs [--email-domain synthetic.procv.test]
python manage.py matching_export_dataset files /đường/dẫn/thư/mục
"""

import json

from django.core.management.base import BaseCommand, CommandError

from apps.cvs.services import SYNTHETIC_EMAIL_DOMAIN

from ...selectors import cvs_for_profile, jobs_for_profile
from ...services.dataset import export_cvs, export_files, export_jobs, export_skills


class Command(BaseCommand):
    help = 'Xuất profile_json của tin, CV hoặc tệp CV ra JSONL (chỉ đọc).'

    def add_arguments(self, parser):
        parser.add_argument('kind', choices=['jobs', 'cvs', 'files', 'skills'])
        parser.add_argument('directory', nargs='?', help='Thư mục PDF/DOCX (với kind=files).')
        parser.add_argument('--email-domain', default=SYNTHETIC_EMAIL_DOMAIN)

    def handle(self, *args, kind, directory, email_domain, **options):
        if kind == 'files' and not directory:
            raise CommandError('kind=files cần đường dẫn thư mục.')
        rows = {
            'jobs': lambda: export_jobs(jobs_for_profile()),
            'cvs': lambda: export_cvs(cvs_for_profile(email_domain)),
            'files': lambda: export_files(directory),
            'skills': export_skills,
        }[kind]()
        for row in rows:
            self.stdout.write(json.dumps(row, ensure_ascii=False))
