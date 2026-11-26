"""Lệnh `matching_evaluate`: chấm cặp CV–tin của tập đánh giá bằng mã của sản phẩm."""

import json
from io import StringIO
from unittest.mock import patch

from django.core.management import call_command

from ..models import MatchAnalysis, MatchDocument
from .test_api import MatchingApiBase


class MatchingEvaluateTests(MatchingApiBase):
    def evaluate(self, pairs, *flags):
        output = StringIO()
        with patch('sys.stdin', StringIO(json.dumps(pairs))):
            call_command('matching_evaluate', '-', *flags, stdout=output)
        return [json.loads(line) for line in output.getvalue().splitlines()]

    def test_scores_pairs_like_the_product_without_touching_the_database(self):
        pairs = [{'jd': self.job.public_id, 'cv': 'CV-901'}]

        rows = self.evaluate(pairs)

        self.assertEqual([(row['jd'], row['cv']) for row in rows], [(self.job.public_id, 'CV-901')])
        row = rows[0]
        self.assertEqual(row['model_version'], 'hashing-v1')
        self.assertGreater(row['score'], 0)
        self.assertEqual(row['components']['skills'], 100)
        self.assertNotIn('result', row)
        self.assertIsNotNone(row['document_similarity'])
        self.assertFalse(MatchDocument.objects.exists())
        self.assertFalse(MatchAnalysis.objects.exists())

    def test_same_score_as_the_candidate_facing_analysis(self):
        self.request()
        analysis = MatchAnalysis.objects.get()
        components = {c['key']: c['score'] for c in analysis.result_json['components']}

        row = self.evaluate([{'jd': self.job.public_id, 'cv': 'CV-901'}])[0]

        self.assertEqual(row['components'], components)
        self.assertEqual(row['score'], analysis.overall_score)

    def test_detail_adds_the_full_result_and_ablation_changes_the_formula(self):
        pairs = [{'jd': self.job.public_id, 'cv': 'CV-901'}]

        row = self.evaluate(pairs, '--detail', '--ablation', 'no_relevance_discount')[0]

        self.assertEqual(row['result']['overall']['score'], row['score'])
        self.assertFalse(row['result']['flags']['relevance_discount_applied'])

    def test_reports_pairs_it_cannot_find(self):
        rows = self.evaluate(
            [{'jd': 'job_missing', 'cv': 'CV-901'}, {'jd': self.job.public_id, 'cv': 'CV-000'}]
        )

        self.assertEqual([row['error'] for row in rows], ['job_not_found', 'cv_not_found'])

    def test_rule_baseline_adds_the_rule_recommender_score(self):
        row = self.evaluate([{'jd': self.job.public_id, 'cv': 'CV-901'}], '--rule-baseline')[0]

        # Tin yêu cầu ReactJS và CV khai ReactJS: luật cộng 6 điểm kỹ năng trở lên.
        self.assertGreaterEqual(row['rule_score'], 6)

    def test_scores_a_cv_outside_the_database_and_extra_calibration_marks(self):
        generated = {
            'headline': 'Frontend Developer',
            'summary': 'Lập trình viên giao diện với hai năm làm sản phẩm thương mại điện tử.',
            'experience': [
                {
                    'role': 'Frontend Developer',
                    'company': 'Công ty A',
                    'start_date': '2024-01',
                    'end_date': None,
                    'highlights': [
                        'Phát triển giao diện bán hàng bằng ReactJS cho một triệu người dùng.'
                    ],
                }
            ],
            'education': {'degree': 'Cử nhân Công nghệ thông tin', 'institution': 'Đại học B'},
            'projects': [],
            'certifications': [],
            'skills': [{'name': 'ReactJS', 'level': 4}],
            'languages': [],
        }
        payload = {
            'pairs': [{'jd': self.job.public_id, 'cv': 'TR-00-00'}],
            'cvs': [{'id': 'TR-00-00', 'language': 'vi', 'data': generated}],
            # Mốc đặt cao tới mức mọi cosine đều quy về 0: điểm chỉ có thể giảm.
            'marks': {'strict': {'document': [0.98, 0.99], 'title': [0.98, 0.99]}},
        }

        row = self.evaluate(payload, '--rule-baseline')[0]

        self.assertEqual(row['cv'], 'TR-00-00')
        self.assertEqual(row['components']['skills'], 100)
        self.assertLess(row['variants']['strict'], row['score'])
        self.assertNotIn('rule_score', row)
        self.assertFalse(MatchDocument.objects.exists())
