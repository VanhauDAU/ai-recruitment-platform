"""Ràng buộc dữ liệu của các bảng đối sánh và việc lưu vector bằng pgvector."""

from django.contrib.auth import get_user_model
from django.db import DataError, IntegrityError, transaction
from django.test import TestCase
from pgvector.django import CosineDistance

from apps.cv_templates.tests.factories import make_published_template
from apps.cvs.services import create_v2_cv
from apps.employers.models import Company
from apps.jobs.models import Job

from ..models import EMBEDDING_DIMENSIONS, MatchAnalysis, MatchChunk, MatchDocument

VERSIONS = {'extractor_version': 'extract-v1', 'model_version': 'e5-base-zs'}
HASH_A = 'a' * 64
HASH_B = 'b' * 64


def unit_vector(axis):
    vector = [0.0] * EMBEDDING_DIMENSIONS
    vector[axis] = 1.0
    return vector


class MatchingModelTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        users = get_user_model().objects
        cls.candidate = users.create_user(
            email='match-candidate@example.com',
            password='password',
            role='candidate',
            email_verified=True,
        )
        employer = users.create_user(
            email='match-employer@example.com', password='password', role='employer'
        )
        company = Company.objects.create(company_name='Match Co', created_by=employer)
        cls.job = Job.objects.create(
            posted_by=employer,
            company=company,
            title='Backend Developer',
            description='d',
            status=Job.Status.ACTIVE,
        )
        template, _version = make_published_template('Match template')
        cv = create_v2_cv(actor=cls.candidate, title='Match CV', template=template)
        cls.cv_version = cv.latest_version

    def cv_document(self, **overrides):
        fields = {
            'kind': MatchDocument.Kind.CV,
            'cv_version': self.cv_version,
            'content_hash': HASH_A,
            **VERSIONS,
            **overrides,
        }
        return MatchDocument.objects.create(**fields)

    def job_document(self, **overrides):
        fields = {
            'kind': MatchDocument.Kind.JOB,
            'job': self.job,
            'content_hash': HASH_A,
            **VERSIONS,
            **overrides,
        }
        return MatchDocument.objects.create(**fields)

    def analysis(self, **overrides):
        fields = {
            'user': self.candidate,
            'cv_version': self.cv_version,
            'job': self.job,
            'job_content_hash': HASH_A,
            'model_version': VERSIONS['model_version'],
            'scoring_version': 'hybrid-v1',
            **overrides,
        }
        return MatchAnalysis.objects.create(**fields)

    def test_document_vector_round_trips_and_ranks_by_cosine_distance(self):
        near = self.cv_document(embedding=unit_vector(0))
        far = self.job_document(embedding=unit_vector(1))

        ranked = list(
            MatchDocument.objects.annotate(
                distance=CosineDistance('embedding', unit_vector(0))
            ).order_by('distance')
        )

        self.assertEqual([document.pk for document in ranked], [near.pk, far.pk])
        self.assertAlmostEqual(ranked[0].distance, 0.0)
        self.assertAlmostEqual(ranked[1].distance, 1.0)
        self.assertEqual(len(ranked[0].embedding), EMBEDDING_DIMENSIONS)

    def test_document_rejects_vector_of_wrong_dimension(self):
        with self.assertRaises(DataError), transaction.atomic():
            self.cv_document(embedding=[1.0, 0.0, 0.0])

    def test_document_needs_exactly_the_source_its_kind_names(self):
        invalid = (
            lambda: self.cv_document(job=self.job),
            lambda: self.cv_document(cv_version=None),
            lambda: self.job_document(cv_version=self.cv_version),
            lambda: self.job_document(job=None),
        )
        for index, create in enumerate(invalid):
            with self.subTest(index=index), self.assertRaises(IntegrityError), transaction.atomic():
                create()

    def test_document_is_unique_per_source_content_and_versions(self):
        self.cv_document()
        self.job_document()
        for create in (self.cv_document, self.job_document):
            with self.assertRaises(IntegrityError), transaction.atomic():
                create()

        # Đổi mô hình hoặc đổi nội dung tin thì sinh hàng mới thay vì ghi đè.
        self.cv_document(model_version='e5-base-ft-1')
        self.job_document(content_hash=HASH_B)
        self.assertEqual(MatchDocument.objects.count(), 4)

    def test_chunks_are_ordered_and_positions_unique_per_document(self):
        document = self.cv_document()
        for position in (1, 0):
            MatchChunk.objects.create(
                document=document,
                position=position,
                section='experience',
                text=f'chunk {position}',
                embedding=unit_vector(position),
            )

        self.assertEqual([chunk.position for chunk in document.chunks.all()], [0, 1])
        with self.assertRaises(IntegrityError), transaction.atomic():
            MatchChunk.objects.create(
                document=document,
                position=0,
                section='experience',
                text='duplicate',
                embedding=unit_vector(2),
            )

    def test_analysis_gets_public_id_and_cache_key_is_unique(self):
        first = self.analysis()
        self.assertTrue(first.public_id.startswith('ma_'))
        with self.assertRaises(IntegrityError), transaction.atomic():
            self.analysis()

        # Mỗi thành phần của khóa cache đổi thì được phép có kết quả mới.
        for change in (
            {'job_content_hash': HASH_B},
            {'model_version': 'e5-base-ft-1'},
            {'scoring_version': 'hybrid-v2'},
        ):
            self.analysis(**change)
        self.assertEqual(MatchAnalysis.objects.count(), 4)

    def test_analysis_score_cannot_exceed_100(self):
        self.analysis(overall_score=100)
        with self.assertRaises(IntegrityError), transaction.atomic():
            self.analysis(job_content_hash=HASH_B, overall_score=101)

    def test_deleting_a_cached_document_keeps_the_analysis(self):
        document = self.cv_document()
        analysis = self.analysis(cv_document=document)

        document.delete()

        analysis.refresh_from_db()
        self.assertIsNone(analysis.cv_document)
