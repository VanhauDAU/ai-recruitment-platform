"""Công thức `hybrid-v1` và phần giải thích, chạy với `HashingEncoder` (không cần torch).

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
        self.assertEqual(components(result)['location'], (None, 'insufficient_data'))
        self.assertEqual(result['overall']['confidence'], 'low')
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

    def test_location_is_left_out_when_comparing_with_human_labels(self):
        keys = [
            c['key']
            for c in run(frontend_cv(), job_profile(), include_location=False)['components']
        ]
        self.assertNotIn('location', keys)

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
            'other_field': (
                cv_profile(
                    builder_document(
                        section(
                            'experience',
                            {
                                'role': 'Kế toán viên',
                                'company': 'Công ty C',
                                'start_date': '2022-01',
                                'end_date': '2025-12',
                                'description': rich(
                                    'Lập báo cáo thuế hằng quý và đối chiếu công nợ.'
                                ),
                            },
                        ),
                        section('education', {'degree': 'Cử nhân Kế toán', 'institution': 'ĐH D'}),
                    ),
                    catalog(),
                    today=TODAY,
                ),
                job_profile(),
            ),
        }
        scores = {name: run(cv, job)['overall']['score'] for name, (cv, job) in cases.items()}
        self.assertEqual(scores, GOLDEN_SCORES)
        self.assertGreater(scores['strong'], scores['junior_for_senior'])
        self.assertGreater(scores['junior_for_senior'], scores['other_field'])


GOLDEN_SCORES = {'strong': 84, 'junior_for_senior': 71, 'other_field': 39}
