"""Persist the job form: the job row together with its nested rows.

Nested lists (skills, categories, locations, schedules, benefits, languages) and
the application contact are replaced as a whole whenever the form sends them.
Callers pass validated form data; the posting workflows in ``posting`` decide
who may write and when.
"""

from django.db import transaction

from ..models import (
    Job,
    JobApplicationContact,
    JobApplicationEmail,
    JobBenefit,
    JobCategoryAssignment,
    JobLanguageRequirement,
    JobLocation,
    JobSkill,
    JobWorkSchedule,
)
from .policy import auto_reject_default_days

# Form field -> row model; each field is also the reverse accessor on Job.
JOB_RELATIONS = {
    'job_skills': JobSkill,
    'category_assignments': JobCategoryAssignment,
    'job_locations': JobLocation,
    'work_schedules': JobWorkSchedule,
    'job_benefits': JobBenefit,
    'language_requirements': JobLanguageRequirement,
}
_UNCHANGED = object()


@transaction.atomic
def create_job_record(data):
    """Create a job and its nested rows from validated form data."""
    data = dict(data)
    if data.get('auto_reject_after_days') is None:
        data['auto_reject_after_days'] = auto_reject_default_days()
    relations = {field: data.pop(field, ()) for field in JOB_RELATIONS}
    contact = data.pop('application_contact', None)
    job = Job.objects.create(**data)
    _replace_relations(job, relations)
    _replace_application_contact(job, contact)
    return job


@transaction.atomic
def update_job_record(job, data):
    """Apply validated form data; nested lists left out of ``data`` stay as they are."""
    data = dict(data)
    relations = {field: data.pop(field, None) for field in JOB_RELATIONS}
    contact = data.pop('application_contact', _UNCHANGED)
    for field, value in data.items():
        setattr(job, field, value)
    job.save()
    _replace_relations(job, relations)
    if contact is not _UNCHANGED:
        _replace_application_contact(job, contact)
    return job


def _replace_relations(job, relations):
    for field, values in relations.items():
        if values is None:
            continue
        model = JOB_RELATIONS[field]
        getattr(job, field).all().delete()
        model.objects.bulk_create([model(job=job, **item) for item in values])


def _replace_application_contact(job, contact_data):
    JobApplicationContact.objects.filter(job=job).delete()
    if not contact_data:
        return
    contact_data = dict(contact_data)
    emails = contact_data.pop('emails')
    contact = JobApplicationContact.objects.create(job=job, **contact_data)
    JobApplicationEmail.objects.bulk_create(
        [JobApplicationEmail(contact=contact, **item) for item in emails]
    )
