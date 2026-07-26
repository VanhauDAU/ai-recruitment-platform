from django.contrib.auth import get_user_model
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase

BEFORE = [('employers', '0020_remove_campaign_insight_fields')]
AFTER = [('employers', '0022_employer_verification_notification')]


class EmployerVerificationMigrationTests(TransactionTestCase):
    def _migrate(self, targets):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(targets)
        return executor

    def test_legacy_documents_backfill_before_public_id_contract(self):
        before_executor = self._migrate(BEFORE)
        old_apps = before_executor.loader.project_state(BEFORE).apps
        Company = old_apps.get_model('employers', 'Company')
        CompanyDocument = old_apps.get_model('employers', 'CompanyDocument')
        RecruiterProfile = old_apps.get_model('employers', 'RecruiterProfile')

        user = get_user_model().objects.create_user(
            email='employer-verification-migration@example.com',
            password='Password@123',
            role='employer',
        )
        company = Company.objects.create(
            public_id='co-verification-migration',
            slug='verification-migration',
            company_name='Verification Migration Co',
            created_by_id=user.pk,
        )
        recruiter = RecruiterProfile.objects.create(
            public_id='rec-verification-migration',
            user_id=user.pk,
            company_id=company.pk,
            company_role='owner',
        )
        legacy_document = CompanyDocument.objects.create(
            company_id=company.pk,
            recruiter_id=recruiter.pk,
            uploaded_by_id=user.pk,
            doc_type='business_registration',
            file_url='employers/legacy-registration.pdf',
            file_name='legacy-registration.pdf',
            status='pending',
        )

        after_executor = self._migrate(AFTER)
        new_apps = after_executor.loader.project_state(AFTER).apps
        VerificationCase = new_apps.get_model(
            'employers',
            'EmployerVerificationCase',
        )
        VersionedDocument = new_apps.get_model('employers', 'CompanyDocument')

        case = VerificationCase.objects.get(recruiter_id=recruiter.pk)
        migrated_document = VersionedDocument.objects.get(pk=legacy_document.pk)
        self.assertEqual(case.status, 'in_review')
        self.assertEqual(migrated_document.verification_case_id, case.pk)
        self.assertTrue(migrated_document.public_id.startswith('doc_'))
        self.assertTrue(migrated_document.is_current)
        self.assertEqual(migrated_document.version, 1)

    def tearDown(self):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        self._migrate(executor.loader.graph.leaf_nodes())
