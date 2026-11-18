from django.core.exceptions import ValidationError as DjangoValidationError
from django.test import SimpleTestCase
from rest_framework.exceptions import NotFound

from common.api.exceptions import DomainError, api_exception_handler


class Conflict(DomainError):
    status_code = 409
    code = 'stale'

    def payload(self):
        return {'code': self.code, 'revision': {'number': 3}}


class ApiExceptionHandlerTests(SimpleTestCase):
    def handle(self, exc):
        return api_exception_handler(exc, {})

    def test_field_errors_keep_their_field_keys(self):
        response = self.handle(DjangoValidationError({'title': ['Bắt buộc.']}))
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data, {'title': ['Bắt buộc.']})

    def test_non_field_errors_become_detail_list(self):
        response = self.handle(DjangoValidationError(['Sai A.', 'Sai B.']))
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data, {'detail': ['Sai A.', 'Sai B.']})

    def test_domain_error_payload_keeps_value_types(self):
        response = self.handle(Conflict('stale'))
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data, {'code': 'stale', 'revision': {'number': 3}})

    def test_default_domain_error_payload(self):
        response = self.handle(DomainError('Không hợp lệ.'))
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data, {'code': 'domain_error', 'detail': 'Không hợp lệ.'})

    def test_drf_exceptions_use_the_default_handler(self):
        response = self.handle(NotFound())
        self.assertEqual(response.status_code, 404)

    def test_unknown_exceptions_are_left_to_django(self):
        self.assertIsNone(self.handle(RuntimeError('boom')))
