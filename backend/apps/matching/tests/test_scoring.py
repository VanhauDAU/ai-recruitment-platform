"""Công thức `hybrid-v3` và phần giải thích, chạy với `HashingEncoder` (không cần torch).

Ngoài kiểm tra từng tiêu chí, có ba nhóm test chống hồi quy theo kế hoạch mục 6b:
- golden: điểm của các cặp cố định không được đổi ngầm (đổi công thức thì đổi
  `SCORING_VERSION` và cập nhật số ở đây);
- nhiễu: đổi thứ tự câu hay thêm một câu không liên quan không làm điểm lệch quá 3;
- không bịa: mọi bằng chứng hiển thị phải là một câu có thật trong CV.
"""

import json

import numpy as np
from django.test import SimpleTestCase

from ..services.documents import document_text
from ..services.encoder import HASHING_MODEL_VERSION, HashingEncoder
from ..services.explain import explain
from ..services.extraction import cv_profile
from ..services.scoring import LANGUAGE_REQUIRED_CAP, ScoringError, score_match
from ..services.scoring.criteria import _years_score, position_level
from ..services.scoring.skill_groups import alternative_groups
from .test_extraction import TODAY, builder_document, rich, section
from .test_skills import catalog

ENCODER = HashingEncoder()


def job_profile(
    *, skills=None, languages=(), band='2', education='university', position='employee'
):
    requirement_texts = [
        'Có ít nhất 2 năm kinh nghiệm phát triển giao diện bằng ReactJS.',
        'Viết test tự động cho giao diện web.',
    ]
    skills = skills or [
        {
            'skill_id': 1,
            'name': 'ReactJS',
            'importance': 'required',
            'weight': 1.0,
            'counted': True,
        },
        {'skill_id': 2, 'name': 'Java', 'importance': 'preferred', 'weight': 1.0, 'counted': True},
    ]
    texts = [('title', 'Frontend Developer')] + [
        ('requirement', text) for text in requirement_texts
    ]
    texts += [('skill', skill['name']) for skill in skills if skill['counted']]
    return {
        'kind': 'job',
        'language': 'vi',
        'title': 'Frontend Developer',
        'skills': [{**skill, 'group': '', 'source': 'job', 'evidence': ''} for skill in skills],
        'experience': {'months': 24, 'band': band},
        'education': {'level': education},
        'position_level': position,
        'languages': list(languages),
        'locations': [{'province_id': 1, 'name': 'Hà Nội'}],
        'work_types': [],
        'chunks': [{'index': i, 'section': s, 'text': t} for i, (s, t) in enumerate(texts)],
        'quality': {'missing': []},
    }


def frontend_cv(*extra_sections, months_start='2024-11'):
    return cv_profile(
        builder_document(
            section(
                'experience',
                {
                    'role': 'Frontend Developer',
                    'company': 'Công ty A',
                    'start_date': months_start,
                    'end_date': None,
                    'description': rich(
                        'Phát triển giao diện bán hàng bằng ReactJS cho hơn 1 triệu người dùng.',
                        'Viết test tự động cho giao diện web bằng Jest.',
                    ),
                },
            ),
            section('education', {'degree': 'Cử nhân CNTT', 'institution': 'ĐH B'}),
            section('skills', {'name': 'ReactJS', 'level': 4}),
            *extra_sections,
        ),
        catalog(),
        today=TODAY,
    )


def run(cv, job, **options):
    def encoded(profile, kind):
        chunks = [{'section': c['section'], 'text': c['text']} for c in profile['chunks']]
        return chunks, ENCODER.encode([c['text'] for c in chunks], kind=kind)

    cv_chunks, cv_vectors = encoded(cv, 'passage')
    job_chunks, job_vectors = encoded(job, 'query')
    result = score_match(
        cv,
        job,
        cv_chunks=cv_chunks,
        cv_vectors=cv_vectors,
        job_chunks=job_chunks,
        job_vectors=job_vectors,
        cv_document_vector=ENCODER.encode([document_text(cv)], kind='passage')[0],
        job_document_vector=ENCODER.encode([document_text(job)], kind='query')[0],
        model_version=HASHING_MODEL_VERSION,
        **options,
    )
    return explain(result)


def components(result):
    return {c['key']: (c['score'], c['status']) for c in result['components']}


class EncoderTests(SimpleTestCase):
    def test_hashing_vectors_are_unit_length_and_repeatable(self):
        first = ENCODER.encode(['Phát triển ReactJS', 'Kế toán thuế'], kind='query')
        self.assertEqual(first.shape, (2, 768))
        np.testing.assert_allclose(np.linalg.norm(first, axis=1), 1.0, rtol=1e-6)
        np.testing.assert_array_equal(
            first, ENCODER.encode(['Phát triển ReactJS', 'Kế toán thuế'], kind='passage')
        )
        self.assertEqual(ENCODER.encode([], kind='query').shape, (0, 768))


class CriteriaTests(SimpleTestCase):
    def test_years_steps(self):
        self.assertEqual(_years_score('3', 36), 100)
        self.assertEqual(_years_score('3', 24), 60)
        self.assertEqual(_years_score('3', 12), 20)
        self.assertEqual(_years_score('none', 0), 100)

    def test_position_distance_counts_both_directions(self):
        def score(required, own):
            data = type(
                'Data', (), {'job': {'position_level': required}, 'cv': {'position_level': own}}
            )
            return position_level(data).score

        self.assertEqual(score('employee', 'employee'), 100)
        self.assertEqual(score('employee', 'intern'), 70)
        self.assertEqual(score('employee', 'supervisor'), 40)
        self.assertEqual(score('intern', 'director'), 10)

    def test_preferred_skill_weighs_half(self):
        result = run(frontend_cv(), job_profile())
        # ReactJS (cần có, w = 1) khớp, Java (nên có, w = 0,5) thiếu → 1 / 1,5.
        self.assertEqual(components(result)['skills'], (67, 'ok'))
        self.assertEqual(result['skills']['missing'], [{'name': 'Java', 'importance': 'preferred'}])

    def test_missing_criteria_are_dropped_and_lower_confidence(self):
        cv = frontend_cv()
        cv['education']['level'] = ''
        result = run(cv, job_profile())
        self.assertEqual(components(result)['education'], (None, 'insufficient_data'))
        self.assertEqual(result['overall']['confidence'], 'medium')
        self.assertIn('missing_education_info', [s['code'] for s in result['suggestions']])

    def test_missing_required_language_caps_the_overall_score(self):
        job = job_profile(languages=[{'code': 'en', 'level': 'working', 'required': True}])
        result = run(frontend_cv(), job)
        self.assertLessEqual(result['overall']['score'], LANGUAGE_REQUIRED_CAP)
        self.assertTrue(result['flags']['language_cap_applied'])
        self.assertEqual(result['suggestions'][0]['code'], 'missing_required_language')
        with_language = frontend_cv(
            section('languages', {'name': 'Tiếng Anh', 'value': 'IELTS 6.5'})
        )
        self.assertEqual(components(run(with_language, job))['languages'], (100, 'ok'))

    def test_location_is_not_a_scored_criterion(self):
        result = run(frontend_cv(), job_profile())
        self.assertEqual(
            [c['key'] for c in result['components']],
            ['skills', 'experience', 'education', 'position_level', 'languages'],
        )
        self.assertAlmostEqual(sum(c['weight'] for c in result['components']), 1.0)
        self.assertEqual(result['schema_version'], 2)

    def test_skill_written_differently_only_counts_when_semantic_matching_is_on(self):
        # CV không khai "Kiểm thử giao diện web" nhưng có câu gần như trùng chữ.
        job = job_profile(
            skills=[
                {
                    'skill_id': 9,
                    'name': 'test tự động cho giao diện web',
                    'importance': 'required',
                    'weight': 1.0,
                    'counted': True,
                }
            ]
        )
        default = run(frontend_cv(), job)
        self.assertEqual(default['skills']['matched'], [])
        self.assertEqual(components(default)['skills'], (0, 'ok'))

        enabled = run(frontend_cv(), job, ablation=('semantic_skills',))
        self.assertEqual([s['match_type'] for s in enabled['skills']['matched']], ['semantic'])
        self.assertEqual(components(enabled)['skills'], (100, 'ok'))

    def test_unknown_ablation_is_rejected(self):
        with self.assertRaises(ValueError):
            run(frontend_cv(), job_profile(), ablation=('typo',))

    def test_cv_without_skills_or_experience_is_refused(self):
        empty = cv_profile(builder_document(section('education', {'degree': 'Cử nhân'})), catalog())
        empty['experience']['months'] = None
        with self.assertRaises(ScoringError) as raised:
            run(empty, job_profile())
        self.assertEqual(raised.exception.code, 'cv_insufficient_content')


class NoInventionTests(SimpleTestCase):
    def test_every_evidence_is_a_real_cv_sentence(self):
        cv = frontend_cv()
        result = run(cv, job_profile())
        sentences = {chunk['text'] for chunk in cv['chunks']}
        evidences = [s['evidence'] for s in result['skills']['matched'] if s['evidence']]
        evidences += [r['evidence'] for r in result['requirements'] if r['evidence']]
        self.assertTrue(evidences)
        for evidence in evidences:
            self.assertIn(evidence, sentences)

    def test_suggestions_only_name_skills_the_job_asks_for(self):
        result = run(frontend_cv(), job_profile())
        job_skills = {'ReactJS', 'Java'}
        for suggestion in result['suggestions']:
            self.assertLessEqual(set(suggestion['params'].get('skills', [])), job_skills)
        self.assertIn('Kết quả là ước lượng', result['disclaimer'])

    def test_listed_skill_without_a_sentence_is_marked_unproven(self):
        cv = frontend_cv(section('skills', {'name': 'Java', 'level': 3}))
        result = run(cv, job_profile())
        java = next(s for s in result['skills']['matched'] if s['name'] == 'Java')
        self.assertEqual((java['match_type'], java['evidence']), ('exact', ''))
        self.assertIn('skills_without_evidence', [s['code'] for s in result['suggestions']])


class StabilityTests(SimpleTestCase):
    def test_same_input_gives_identical_result(self):
        cv, job = frontend_cv(), job_profile()
        self.assertEqual(
            json.dumps(run(cv, job), sort_keys=True), json.dumps(run(cv, job), sort_keys=True)
        )

    def test_reordering_and_an_unrelated_sentence_barely_move_the_score(self):
        cv, job = frontend_cv(), job_profile()
        baseline = run(cv, job)['overall']['score']
        noisy = json.loads(json.dumps(cv))
        noisy['chunks'] = list(reversed(noisy['chunks'])) + [
            {'index': 99, 'section': 'activities', 'text': 'Thích đọc sách và chạy bộ cuối tuần.'}
        ]
        self.assertLessEqual(abs(run(noisy, job)['overall']['score'] - baseline), 3)

    def test_golden_scores(self):
        """Điểm cố định của ba cặp; đổi công thức chấm thì phải đổi SCORING_VERSION."""
        senior_job = job_profile(band='5', position='team_lead')
        cases = {
            'strong': (frontend_cv(), job_profile()),
            'junior_for_senior': (frontend_cv(months_start='2026-05'), senior_job),
            'other_field': (accountant_cv(), job_profile()),
        }
        scores = {name: run(cv, job)['overall']['score'] for name, (cv, job) in cases.items()}
        self.assertEqual(scores, GOLDEN_SCORES)
        self.assertGreater(scores['strong'], scores['junior_for_senior'])
        self.assertGreater(scores['junior_for_senior'], scores['other_field'])


GOLDEN_SCORES = {'strong': 84, 'junior_for_senior': 71, 'other_field': 0}


def accountant_cv():
    return cv_profile(
        builder_document(
            section(
                'experience',
                {
                    'role': 'Kế toán viên',
                    'company': 'Công ty C',
                    'start_date': '2022-01',
                    'end_date': '2025-12',
                    'description': rich('Lập báo cáo thuế hằng quý và đối chiếu công nợ.'),
                },
            ),
            section('education', {'degree': 'Cử nhân Kế toán', 'institution': 'ĐH D'}),
            headline='Kế toán viên',
        ),
        catalog(),
        today=TODAY,
    )


class RelevanceDiscountTests(SimpleTestCase):
    """Học vấn, cấp bậc, ngoại ngữ chỉ được tính đủ khi CV đúng lĩnh vực của tin."""

    def test_other_field_keeps_true_component_scores_but_a_lower_total(self):
        discounted = run(accountant_cv(), job_profile())
        plain = run(accountant_cv(), job_profile(), ablation=('no_relevance_discount',))

        self.assertTrue(discounted['flags']['relevance_discount_applied'])
        self.assertFalse(plain['flags']['relevance_discount_applied'])
        # Điểm từng tiêu chí là giá trị thật: đủ bậc học vẫn là 100 ở cả hai.
        self.assertEqual(components(discounted)['education'], (100, 'ok'))
        self.assertEqual(components(discounted), components(plain))
        self.assertLess(discounted['overall']['score'], plain['overall']['score'])
        self.assertLess(discounted['overall']['relevance'], 50)
        summaries = {c['key']: c['summary'] for c in discounted['components']}
        self.assertIn('chỉ được tính một phần', summaries['education'])
        self.assertNotIn('chỉ được tính một phần', summaries['skills'])
        self.assertNotIn(
            'chỉ được tính một phần',
            {c['key']: c['summary'] for c in plain['components']}['education'],
        )

    def test_related_cv_is_not_discounted(self):
        result = run(frontend_cv(), job_profile())
        self.assertFalse(result['flags']['relevance_discount_applied'])
        self.assertEqual(
            result['overall']['score'],
            run(frontend_cv(), job_profile(), ablation=('no_relevance_discount',))['overall'][
                'score'
            ],
        )


class SkillGroupTests(SimpleTestCase):
    """Kỹ năng tin viết dạng lựa chọn ("một trong", "hoặc") được chấm theo nhóm."""

    def job(self, *requirements):
        skills = [
            {'skill_id': pk, 'name': name, 'importance': 'required', 'weight': 1.0, 'counted': True}
            for pk, name in ((1, 'ReactJS'), (2, 'Java'), (7, 'C#'))
        ]
        job = job_profile(skills=skills)
        start = len(job['chunks'])
        job['chunks'] += [
            {'index': start + offset, 'section': 'requirement', 'text': text}
            for offset, text in enumerate(requirements)
        ]
        return job

    def test_one_skill_of_an_alternative_group_is_enough(self):
        job = self.job('Thành thạo ít nhất một trong các ngôn ngữ: Java, C#.')
        cv = frontend_cv(section('skills', {'name': 'Java', 'level': 3}))
        grouped = run(cv, job, catalog=catalog())
        # Hai đơn vị chấm: ReactJS và nhóm (Java, C#); CV có ReactJS và Java.
        self.assertEqual(components(grouped)['skills'], (100, 'ok'))
        self.assertEqual(grouped['skills']['missing'], [])
        self.assertIn('2/2 kỹ năng', grouped['components'][0]['summary'])
        for plain in (run(cv, job), run(cv, job, catalog=catalog(), ablation=('no_skill_groups',))):
            self.assertEqual(components(plain)['skills'], (67, 'ok'))
            self.assertEqual([skill['name'] for skill in plain['skills']['missing']], ['C#'])

    def test_unmet_group_is_one_requirement_and_is_named_as_a_choice(self):
        job = self.job('Có kinh nghiệm với Java hoặc C#.')
        result = run(frontend_cv(), job, catalog=catalog())
        self.assertEqual(components(result)['skills'], (50, 'ok'))
        self.assertEqual(
            result['skills']['missing'],
            [
                {'name': 'Java', 'importance': 'required', 'group': 1},
                {'name': 'C#', 'importance': 'required', 'group': 1},
            ],
        )
        self.assertIn('1/2 kỹ năng', result['components'][0]['summary'])
        suggestion = next(
            s for s in result['suggestions'] if s['code'] == 'missing_required_skills'
        )
        self.assertIn('Java hoặc C#', suggestion['message'])

    def test_skill_required_on_its_own_elsewhere_is_not_grouped(self):
        # ReactJS đã được đòi riêng ở một câu khác, nên "ReactJS hoặc Java" không gom được.
        job = self.job('Dùng ReactJS hoặc Java đều được.')
        result = run(frontend_cv(), job, catalog=catalog())
        self.assertEqual(components(result)['skills'], (33, 'ok'))
        self.assertEqual(alternative_groups(job['skills'], ['Chỉ nhắc Java, C#.'], catalog()), [])
