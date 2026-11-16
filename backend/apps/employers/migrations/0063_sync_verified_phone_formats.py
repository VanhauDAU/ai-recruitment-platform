"""Store each verified phone once, in +84 form, on every field that must match it.

Accounts verified before the canonical form (or seeded) kept the same line as
0xxx in one field and +84xxx in another, or left the login phone empty, so
some screens said "not verified". A contact number that is a different line
is left alone: that one does need a new verification.
"""

from django.db import migrations


def _canonical(value):
    compact = ''.join(character for character in (value or '').strip() if character not in ' .-()')
    if compact.startswith('0'):
        compact = f'+84{compact[1:]}'
    subscriber = compact[3:]
    if len(compact) != 12 or not compact.startswith('+84') or not subscriber.isdigit():
        return None
    return compact


def sync_phones(apps, schema_editor):
    RecruiterProfile = apps.get_model('employers', 'RecruiterProfile')
    User = apps.get_model('accounts', 'User')
    taken = {}
    profiles = RecruiterProfile.objects.filter(phone_verified_at__isnull=False).exclude(
        verified_phone__isnull=True
    )
    for profile in profiles.exclude(verified_phone=''):
        canonical = _canonical(profile.verified_phone)
        if canonical is None:
            continue
        taken.setdefault(canonical, []).append(profile.pk)
    for canonical, pks in taken.items():
        if len(pks) > 1:
            continue  # the same line on two accounts: leave for support to resolve
        profile = RecruiterProfile.objects.select_related('user').get(pk=pks[0])
        changed = []
        if profile.verified_phone != canonical:
            profile.verified_phone = canonical
            changed.append('verified_phone')
        contact = _canonical(profile.contact_phone)
        if not profile.contact_phone or contact == canonical:
            if profile.contact_phone != canonical:
                profile.contact_phone = canonical
                changed.append('contact_phone')
        if changed:
            RecruiterProfile.objects.filter(pk=profile.pk).update(
                **{field: getattr(profile, field) for field in changed}
            )
        user = profile.user
        if not user.phone or _canonical(user.phone) == canonical:
            if user.phone != canonical:
                User.objects.filter(pk=user.pk).update(phone=canonical)


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0034_remove_admin_rbac'),
        ('employers', '0062_company_handover_event'),
    ]

    operations = [migrations.RunPython(sync_phones, migrations.RunPython.noop)]
