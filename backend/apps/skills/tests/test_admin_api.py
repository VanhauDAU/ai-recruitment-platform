from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.accounts.models import AdminAccessAuditLog
from apps.accounts.tests.factories import make_admin
from apps.employers.tests.factories import make_company, make_employer, publish_job
from apps.jobs.models import JobSkill
from apps.matching.models import MatchDocument
from apps.skills.domain import TRAIT_GROUP, duplicate_key
from apps.skills.models import USAGE_RELATIONS, Skill, SkillGroup

# Phân trang (COUNT + trang) và quyền admin; không tăng theo số kỹ năng.
ADMIN_SKILL_LIST_BUDGET = 4


class AdminSkillApiTestCase(APITestCase):
    def setUp(self):
        self.admin = make_admin()
        self.client.force_authenticate(self.admin)
        self.backend = SkillGroup.objects.create(name='Backend')

    def list(self, **params):
        response = self.client.get(reverse('admin-skill-list'), params)
        self.assertEqual(response.status_code, 200)
        return response.data

    def make_job(self, suffix, *skills):
        employer = make_employer(f'employer-{suffix}@example.com')
        job = publish_job(make_company(employer, name=f'Công ty {suffix}'), employer)
        for skill in skills:
            JobSkill.objects.create(job=job, skill=skill)
        return job


class AdminSkillListTests(AdminSkillApiTestCase):
    def test_only_admins_can_reach_the_catalog(self):
        self.client.force_authenticate(make_employer('employer@example.com'))

        response = self.client.get(reverse('admin-skill-list'))

        self.assertEqual(response.status_code, 403)

    def test_lists_usage_and_cleanup_filters(self):
        python = Skill.objects.create(name='Python', group=self.backend)
        react = Skill.objects.create(name='ReactJS', source=Skill.Source.EMPLOYER)
        Skill.objects.create(name='React.js')
        self.make_job('a', python, react)

        rows = {row['name']: row for row in self.list()['results']}
        ungrouped = [row['name'] for row in self.list(ungrouped='true')['results']]
        duplicates = [row['name'] for row in self.list(duplicates='true')['results']]
        employer = [row['name'] for row in self.list(source='employer')['results']]

        self.assertEqual(rows['Python']['usage'], {'jobs': 1, 'cvs': 0, 'candidates': 0})
        self.assertEqual(rows['Python']['group_name'], 'Backend')
        self.assertEqual(ungrouped, ['React.js', 'ReactJS'])
        self.assertEqual(duplicates, ['React.js', 'ReactJS'])
        self.assertEqual(employer, ['ReactJS'])

    def test_search_matches_aliases(self):
        Skill.objects.create(name='Node.js', aliases=['NodeJS'])

        names = [row['name'] for row in self.list(search='nodejs')['results']]

        self.assertEqual(names, ['Node.js'])

    def test_summary_counts_what_needs_cleaning(self):
        Skill.objects.create(name='ReactJS', source=Skill.Source.EMPLOYER)
        Skill.objects.create(name='React.js')
        Skill.objects.create(name='Cobol', is_active=False)

        response = self.client.get(reverse('admin-skill-summary'))

        self.assertEqual(
            response.data,
            {'total': 3, 'ungrouped': 2, 'duplicates': 2, 'employer': 1, 'hidden': 1},
        )

    def test_list_query_count_stays_flat(self):
        for index in range(12):
            Skill.objects.create(name=f'Kỹ năng {index}', group=self.backend)

        with CaptureQueriesContext(connection) as queries:
            self.list()

        self.assertLessEqual(len(queries), ADMIN_SKILL_LIST_BUDGET)


class AdminSkillWriteTests(AdminSkillApiTestCase):
    def test_creates_a_skill_marked_as_added_by_admin(self):
        response = self.client.post(
            reverse('admin-skill-list'),
            {'name': '  Go  lang ', 'aliases': ['Golang', 'golang', 'Go lang']},
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        skill = Skill.objects.get(pk=response.data['id'])
        self.assertEqual(
            (skill.name, skill.aliases, skill.source), ('Go lang', ['Golang'], 'admin')
        )
        self.assertTrue(AdminAccessAuditLog.objects.filter(action='skill.create').exists())

    def test_names_that_collide_on_slug_get_their_own_slug(self):
        Skill.objects.create(name='C')

        response = self.client.post(reverse('admin-skill-list'), {'name': 'C++'}, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['slug'], 'c-2')

    def test_alias_already_owned_by_another_skill_is_rejected(self):
        Skill.objects.create(name='React', aliases=['ReactJS'])
        skill = Skill.objects.create(name='Vue')

        response = self.client.patch(
            reverse('admin-skill-detail', args=[skill.pk]), {'aliases': ['reactjs']}, format='json'
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('React', str(response.data['aliases']))

    def test_bulk_update_assigns_a_group(self):
        skills = [Skill.objects.create(name=name) for name in ('Django', 'Flask')]

        response = self.client.post(
            reverse('admin-skill-bulk-update'),
            {'ids': [skill.pk for skill in skills], 'group': self.backend.pk},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['ungrouped'], 0)
        self.assertEqual(Skill.objects.filter(group=self.backend).count(), 2)


class AdminSkillMergeTests(AdminSkillApiTestCase):
    def setUp(self):
        super().setUp()
        self.target = Skill.objects.create(name='ReactJS', aliases=['React'])
        self.source = Skill.objects.create(name='React.js', aliases=['React 18'])

    def merge(self):
        return self.client.post(
            reverse('admin-skill-merge', args=[self.source.pk]),
            {'target': self.target.pk},
            format='json',
        )

    def test_usage_relations_cover_every_table_that_references_a_skill(self):
        related = {relation.get_accessor_name() for relation in Skill._meta.related_objects}

        self.assertEqual(related, set(USAGE_RELATIONS.values()))

    def test_only_superusers_can_merge(self):
        self.assertEqual(self.merge().status_code, 403)
        self.assertTrue(Skill.objects.filter(pk=self.source.pk).exists())

    def test_merge_moves_rows_keeps_old_names_and_updates_match_profiles(self):
        self.client.force_authenticate(make_admin('root@example.com', superuser=True))
        moved = self.make_job('moved', self.source)
        both = self.make_job('both', self.source, self.target)
        document = MatchDocument.objects.create(
            kind=MatchDocument.Kind.JOB,
            job=moved,
            content_hash='x',
            extractor_version='v',
            model_version='m',
            profile_json={'skills': [{'skill_id': self.source.pk, 'name': 'React.js'}]},
        )

        preview = self.client.get(
            reverse('admin-skill-merge-preview', args=[self.source.pk]),
            {'target': self.target.pk},
        )
        response = self.merge()

        self.assertEqual(preview.data['moved']['jobs'], 1)
        self.assertEqual(preview.data['dropped']['jobs'], 1)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Skill.objects.filter(pk=self.source.pk).exists())
        self.assertEqual(response.data['aliases'], ['React', 'React.js', 'React 18'])
        self.assertEqual(moved.job_skills.get().skill, self.target)
        self.assertEqual(both.job_skills.get().skill, self.target)
        document.refresh_from_db()
        self.assertEqual(document.profile_json['skills'][0]['skill_id'], self.target.pk)
        self.assertEqual(document.profile_json['skills'][0]['name'], 'ReactJS')

    def test_cannot_merge_a_skill_into_itself(self):
        self.client.force_authenticate(make_admin('root@example.com', superuser=True))
        self.target = self.source

        self.assertEqual(self.merge().status_code, 400)


class AdminSkillGroupTests(AdminSkillApiTestCase):
    def test_system_groups_cannot_be_renamed_or_hidden(self):
        trait = SkillGroup.objects.create(name=TRAIT_GROUP)
        url = reverse('admin-skill-group-detail', args=[trait.pk])

        renamed = self.client.patch(url, {'name': 'Kỹ năng mềm'}, format='json')
        hidden = self.client.patch(url, {'is_active': False}, format='json')
        listed = self.client.get(reverse('admin-skill-group-list'))

        self.assertEqual(renamed.status_code, 400)
        self.assertEqual(renamed.data['code'], 'skill_group_locked')
        self.assertEqual(hidden.status_code, 400)
        system = next(row for row in listed.data if row['name'] == TRAIT_GROUP)
        self.assertTrue(system['is_system'])

    def test_group_cannot_become_its_own_ancestor(self):
        child = SkillGroup.objects.create(name='Django', parent=self.backend)

        response = self.client.patch(
            reverse('admin-skill-group-detail', args=[self.backend.pk]),
            {'parent': child.pk},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('parent', response.data)


class DuplicateKeyTests(APITestCase):
    def test_separators_are_ignored_but_language_symbols_are_kept(self):
        self.assertEqual(duplicate_key('React.js'), duplicate_key('React JS'))
        self.assertNotEqual(duplicate_key('C++'), duplicate_key('C'))
        self.assertNotEqual(duplicate_key('C#'), duplicate_key('C'))
