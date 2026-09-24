from django.contrib.admin.sites import AdminSite
from django.test import SimpleTestCase

from ..admin import UserAdmin
from ..models import User


class UserAdminIdentityProofTests(SimpleTestCase):
    def test_existing_identity_and_proof_fields_are_read_only(self):
        model_admin = UserAdmin(User, AdminSite())
        user = User(email='employer@example.com', role=User.Role.EMPLOYER)

        readonly = model_admin.get_readonly_fields(None, user)

        self.assertIn('email', readonly)
        self.assertIn('phone', readonly)
        self.assertIn('email_verified', readonly)

    def test_add_form_can_still_accept_email(self):
        model_admin = UserAdmin(User, AdminSite())

        self.assertNotIn('email', model_admin.get_readonly_fields(None, None))
