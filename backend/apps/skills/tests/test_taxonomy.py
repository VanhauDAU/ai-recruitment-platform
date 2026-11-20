import json
from io import StringIO
from tempfile import NamedTemporaryFile

from django.core.management import call_command
from django.test import TestCase

from apps.skills.models import Skill, SkillGroup
from apps.skills.selectors import skills_by_names
from apps.skills.services import apply_skill_merge

MERGE = {
    'aliases': {'Excel': ['Excel nâng cao'], 'Golang': ['Go']},
    'groups': {'Phẩm chất cá nhân': ['Cẩn thận', 'Trung thực']},
}


class ApplySkillMergeTests(TestCase):
    def test_adds_aliases_groups_and_missing_skills(self):
        Skill.objects.create(name='Excel', aliases=['Microsoft Excel'])

        report = apply_skill_merge(MERGE)

        self.assertEqual(
            Skill.objects.get(name='Excel').aliases, ['Microsoft Excel', 'Excel nâng cao']
        )
        self.assertEqual(Skill.objects.get(name='Golang').aliases, ['Go'])
        group = SkillGroup.objects.get(name='Phẩm chất cá nhân')
        self.assertEqual(
            sorted(group.skills.values_list('name', flat=True)), ['Cẩn thận', 'Trung thực']
        )
        self.assertEqual(
            report,
            {
                'skills_created': 3,
                'aliases_added': 2,
                'groups_created': 1,
                'skills_grouped': 2,
                'aliases_split': 0,
                'conflicts': [],
            },
        )
        # Tin ghi theo cách viết khác vẫn về đúng kỹ năng chuẩn.
        self.assertEqual(skills_by_names(['Excel nâng cao'])['excel nâng cao'].name, 'Excel')

    def test_running_twice_changes_nothing(self):
        apply_skill_merge(MERGE)

        report = apply_skill_merge(MERGE)

        self.assertEqual(Skill.objects.count(), 4)
        self.assertEqual(
            {key: report[key] for key in ('skills_created', 'aliases_added', 'skills_grouped')},
            {'skills_created': 0, 'aliases_added': 0, 'skills_grouped': 0},
        )

    def test_reports_a_variant_that_is_already_its_own_skill(self):
        Skill.objects.create(name='Go')

        report = apply_skill_merge(MERGE)

        self.assertEqual(report['conflicts'], ['Go'])
        self.assertEqual(Skill.objects.get(name='Golang').aliases, [])
        self.assertTrue(Skill.objects.filter(name='Go').exists())

    def test_split_turns_a_too_broad_alias_into_its_own_skill(self):
        group = SkillGroup.objects.create(name='AI')
        Skill.objects.create(name='Deep Learning', aliases=['DL', 'PyTorch'], group=group)

        report = apply_skill_merge({'split': {'Deep Learning': ['PyTorch', 'TensorFlow']}})

        self.assertEqual(Skill.objects.get(name='Deep Learning').aliases, ['DL'])
        self.assertEqual(
            list(
                Skill.objects.filter(name__in=['PyTorch', 'TensorFlow']).values_list(
                    'group__name', flat=True
                )
            ),
            ['AI', 'AI'],
        )
        self.assertEqual((report['aliases_split'], report['skills_created']), (1, 2))
        # Tin ghi "PyTorch" giờ về kỹ năng PyTorch, không về Deep Learning.
        self.assertEqual(skills_by_names(['PyTorch'])['pytorch'].name, 'PyTorch')
        self.assertEqual(
            apply_skill_merge({'split': {'Deep Learning': ['PyTorch']}})['aliases_split'], 0
        )

    def test_command_reads_the_table_from_a_file(self):
        out = StringIO()
        with NamedTemporaryFile('w', suffix='.json', encoding='utf-8') as source:
            json.dump(MERGE, source, ensure_ascii=False)
            source.flush()
            call_command('apply_skill_merge', source.name, stdout=out)

        self.assertEqual(json.loads(out.getvalue())['aliases_added'], 2)
