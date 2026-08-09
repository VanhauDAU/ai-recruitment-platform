from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import IntegrityError, connection, transaction
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase
from django.utils import timezone

BEFORE = [('employers', '0020_remove_campaign_insight_fields')]
AFTER = [('employers', '0022_employer_verification_notification')]
UPDATE_REQUEST_BEFORE = [('employers', '0029_campaign_policy_hold')]
UPDATE_REQUEST_AFTER = [('employers', '0030_company_update_request_requester_scope')]
SMS_FOUNDATION_BEFORE = [('employers', '0030_company_update_request_requester_scope')]
SMS_FOUNDATION_AFTER = [('employers', '0031_employer_sms_provider_foundation')]


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


class CompanyUpdateRequestScopeMigrationTests(TransactionTestCase):
    def _migrate(self, targets):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(targets)
        return executor

    def test_backfills_submission_time_and_scopes_pending_constraint_to_requester(self):
        before_executor = self._migrate(UPDATE_REQUEST_BEFORE)
        old_apps = before_executor.loader.project_state(UPDATE_REQUEST_BEFORE).apps
        Company = old_apps.get_model('employers', 'Company')
        UpdateRequest = old_apps.get_model('employers', 'CompanyUpdateRequest')
        first_user = get_user_model().objects.create_user(
            email='request-scope-first@example.com',
            password='Password@123',
            role='employer',
        )
        second_user = get_user_model().objects.create_user(
            email='request-scope-second@example.com',
            password='Password@123',
            role='employer',
        )
        company = Company.objects.create(
            public_id='co-request-scope-migration',
            slug='request-scope-migration',
            company_name='Request scope migration',
            created_by_id=first_user.pk,
        )
        existing = UpdateRequest.objects.create(
            public_id='cur-request-scope-existing',
            company_id=company.pk,
            requested_by_id=first_user.pk,
            changes={'address': 'Hà Nội'},
        )
        created_at = existing.created_at

        after_executor = self._migrate(UPDATE_REQUEST_AFTER)
        new_apps = after_executor.loader.project_state(UPDATE_REQUEST_AFTER).apps
        ScopedRequest = new_apps.get_model('employers', 'CompanyUpdateRequest')
        migrated = ScopedRequest.objects.get(pk=existing.pk)

        self.assertEqual(migrated.submitted_at, created_at)
        ScopedRequest.objects.create(
            public_id='cur-request-scope-second',
            company_id=company.pk,
            requested_by_id=second_user.pk,
            changes={'address': 'Đà Nẵng'},
        )
        with self.assertRaises(IntegrityError), transaction.atomic():
            ScopedRequest.objects.create(
                public_id='cur-request-scope-duplicate',
                company_id=company.pk,
                requested_by_id=first_user.pk,
                changes={'address': 'Huế'},
            )

    def tearDown(self):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        self._migrate(executor.loader.graph.leaf_nodes())


class EmployerSmsFoundationMigrationTests(TransactionTestCase):
    def _migrate(self, targets):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(targets)
        return executor

    def test_invalidates_active_legacy_otp_without_rewriting_existing_phone_proof(self):
        before_executor = self._migrate(SMS_FOUNDATION_BEFORE)
        old_apps = before_executor.loader.project_state(SMS_FOUNDATION_BEFORE).apps
        RecruiterProfile = old_apps.get_model('employers', 'RecruiterProfile')
        PhoneOtp = old_apps.get_model('employers', 'PhoneOtp')
        user = get_user_model().objects.create_user(
            email='sms-migration@example.com',
            password='Password@123',
            role='employer',
        )
        verified_at = timezone.now() - timedelta(days=90)
        recruiter = RecruiterProfile.objects.create(
            public_id='rec-sms-migration',
            user_id=user.pk,
            verified_phone='0901234567',
            phone_verified_at=verified_at,
        )
        active_legacy = PhoneOtp.objects.create(
            user_id=user.pk,
            phone='0987654321',
            code_hash='legacy-hash',
            expires_at=timezone.now() + timedelta(minutes=5),
        )

        after_executor = self._migrate(SMS_FOUNDATION_AFTER)
        new_apps = after_executor.loader.project_state(SMS_FOUNDATION_AFTER).apps
        MigratedRecruiter = new_apps.get_model('employers', 'RecruiterProfile')
        MigratedOtp = new_apps.get_model('employers', 'PhoneOtp')
        Event = new_apps.get_model('employers', 'EmployerPhoneVerificationEvent')
        migrated_recruiter = MigratedRecruiter.objects.get(pk=recruiter.pk)
        migrated_otp = MigratedOtp.objects.get(pk=active_legacy.pk)

        self.assertEqual(migrated_recruiter.verified_phone, '0901234567')
        self.assertEqual(migrated_recruiter.phone_verified_at, verified_at)
        self.assertIsNotNone(migrated_otp.invalidated_at)
        self.assertEqual(migrated_otp.invalidation_reason, 'migration_cutover')
        self.assertTrue(migrated_otp.public_id.startswith('poc_'))
        self.assertTrue(
            Event.objects.filter(
                challenge_public_id=migrated_otp.public_id,
                event_type='legacy_invalidated',
                reason_code='migration_cutover',
            ).exists()
        )

    def tearDown(self):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        self._migrate(executor.loader.graph.leaf_nodes())
