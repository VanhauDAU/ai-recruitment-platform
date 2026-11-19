import json
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase

from apps.employers.models import Company
from apps.jobs.models import Job, JobLanguageRequirement, JobSkill, Language
from apps.jobs.tests.factories import open_visibility_window
from apps.skills.models import Skill, SkillGroup

from ..models import jobs_for_profile
from ..services.extraction import EXTRACTOR_VERSION, ExtractionError, job_profile
from ..services.extraction.job import role_title

REQUIREMENTS = (
    '<p>Yêu cầu ứng viên:</p><ul>'
    '<li>Có ít nhất 2 năm kinh nghiệm phát triển ReactJS.</li>'
    '<li>Giới tính: Nam, độ tuổi 25 - 30.</li>'
    '<li>Thành thạo Excel</li></ul><p>Required Skills</p>'
)


class JobProfileTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        employer = get_user_model().objects.create_user(
            email='profile-employer@example.com', password='password', role='employer'
        )
        company = Company.objects.create(company_name='Profile Co', created_by=employer)
        cls.job = Job.objects.create(
            posted_by=employer,
            company=company,
            title='Frontend Developer (ReactJS)',
            description='<ul><li>Phát triển giao diện thương mại điện tử cho hàng triệu khách hàng.</li></ul>'
            * 3,
            requirements=REQUIREMENTS,
            experience_years=Job.ExperienceYears.TWO,
            education_level=Job.EducationLevel.UNIVERSITY,
            position_level=Job.PositionLevel.EMPLOYEE,
            status=Job.Status.ACTIVE,
            **open_visibility_window(),
        )
        traits = SkillGroup.objects.create(name='Phẩm chất cá nhân')
        react = Skill.objects.create(name='ReactJS')
        careful = Skill.objects.create(name='Cẩn thận', group=traits)
        JobSkill.objects.create(job=cls.job, skill=react, importance=JobSkill.Importance.REQUIRED)
        JobSkill.objects.create(
            job=cls.job, skill=careful, importance=JobSkill.Importance.PREFERRED
        )
        JobLanguageRequirement.objects.create(
            job=cls.job,
            language=Language.objects.get(code='en'),
            proficiency_level=JobLanguageRequirement.ProficiencyLevel.WORKING,
            is_required=True,
        )

    def profile(self):
        return job_profile(jobs_for_profile().get(pk=self.job.pk))

    def test_profile_uses_structured_fields(self):
        profile = self.profile()
        self.assertEqual(profile['language'], 'vi')
        self.assertEqual(profile['experience'], {'months': 24, 'band': '2'})
        self.assertEqual(profile['education'], {'level': 'university'})
        self.assertEqual(
            profile['languages'], [{'code': 'en', 'level': 'working', 'required': True}]
        )
        self.assertEqual(
            [(skill['name'], skill['importance'], skill['counted']) for skill in profile['skills']],
            [('ReactJS', 'required', True), ('Cẩn thận', 'preferred', False)],
        )

    def test_requirement_chunks_skip_subheadings_and_protected_attributes(self):
        requirements = [
            c['text'] for c in self.profile()['chunks'] if c['section'] == 'requirement'
        ]
        self.assertEqual(
            requirements,
            ['Có ít nhất 2 năm kinh nghiệm phát triển ReactJS.', 'Thành thạo Excel'],
        )

    def test_loading_profiles_does_not_query_per_job(self):
        jobs = list(jobs_for_profile())
        with self.assertNumQueries(0):
            for job in jobs:
                job_profile(job)

    def test_title_chunk_keeps_only_the_role(self):
        cases = {
            'Kế Toán Quản Trị - Tuyển Nữ (Thu Nhập 15-20 Triệu) - Hóc Môn': 'Kế Toán Quản Trị',
            'Fullstack Developer (NodeJS/PHP/Go) – E-Commerce': 'Fullstack Developer',
            'Senior Data Engineer | Thưởng Sign On': 'Senior Data Engineer',
            'Event Executive|Chuyên Viên Tổ Chức Sự Kiện': 'Event Executive',
            'Nhân Viên An Ninh': 'Nhân Viên An Ninh',
        }
        for title, role in cases.items():
            with self.subTest(title=title):
                self.assertEqual(role_title(title), role)
        self.assertEqual(
            self.profile()['chunks'][0],
            {'index': 0, 'section': 'title', 'text': 'Frontend Developer'},
        )

    def test_too_short_job_is_refused(self):
        Job.objects.filter(pk=self.job.pk).update(description='Ngắn', requirements='')
        with self.assertRaises(ExtractionError) as raised:
            self.profile()
        self.assertEqual(raised.exception.code, 'job_text_too_short')

    def test_export_command_writes_one_json_line_per_job(self):
        output = StringIO()
        call_command('matching_export_dataset', 'jobs', stdout=output)
        rows = [json.loads(line) for line in output.getvalue().splitlines()]
        self.assertEqual([row['job_public_id'] for row in rows], [self.job.public_id])
        self.assertEqual(rows[0]['extractor_version'], EXTRACTOR_VERSION)
        skills = StringIO()
        call_command('matching_export_dataset', 'skills', stdout=skills)
        self.assertIn('reactjs', json.loads(skills.getvalue().splitlines()[0])['terms'])
