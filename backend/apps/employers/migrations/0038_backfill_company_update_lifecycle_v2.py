from django.db import migrations


def _base_values_for_request(
    request,
    company,
    company_industry_model,
    company_image_model,
):
    values = {}
    assignments = company_industry_model.objects.filter(company_id=company.pk)
    industry_ids = list(assignments.order_by('industry_id').values_list('industry_id', flat=True))
    primary_id = assignments.filter(is_primary=True).values_list('industry_id', flat=True).first()
    gallery_ids = list(
        company_image_model.objects.filter(company_id=company.pk)
        .order_by('id')
        .values_list('id', flat=True)
    )
    for field in request.changes or {}:
        if field == 'industries':
            values[field] = industry_ids
        elif field == 'primary_industry':
            values[field] = primary_id
        elif field in {'gallery_additions', 'gallery_deletions'}:
            values[field] = gallery_ids
        elif field.endswith('_pending'):
            continue
        elif hasattr(company, field):
            values[field] = getattr(company, field)
    return values


def backfill_company_update_lifecycle(apps, schema_editor):
    request_model = apps.get_model('employers', 'CompanyUpdateRequest')
    revision_model = apps.get_model('employers', 'CompanyUpdateRevision')
    event_model = apps.get_model('employers', 'CompanyUpdateEvent')
    document_model = apps.get_model('employers', 'CompanyDocument')
    media_model = apps.get_model('employers', 'CompanyMediaUpload')
    company_industry_model = apps.get_model('employers', 'CompanyIndustry')
    company_image_model = apps.get_model('employers', 'CompanyImage')
    tax_evidence_model = apps.get_model('employers', 'CompanyTaxLookupEvidence')

    for request in request_model.objects.select_related('company').order_by('pk').iterator():
        company = request.company
        request.status = 'submitted' if request.status == 'pending' else request.status
        request.revision = 1
        request.base_company_updated_at = company.updated_at or request.submitted_at
        request.base_values = _base_values_for_request(
            request,
            company,
            company_industry_model,
            company_image_model,
        )
        request.save(
            update_fields=[
                'status',
                'revision',
                'base_company_updated_at',
                'base_values',
            ]
        )
        revision = revision_model.objects.create(
            public_id=f'cuv_migrated_{request.pk}',
            update_request_id=request.pk,
            number=1,
            submitted_by_id=request.requested_by_id,
            changes=request.changes,
            reason=request.reason,
            proof_type=request.proof_type,
            base_company_updated_at=request.base_company_updated_at,
            base_values=request.base_values,
            submitted_at=request.submitted_at,
        )
        request.current_revision_id = revision.pk
        request.save(update_fields=['current_revision'])
        documents = document_model.objects.filter(update_request_id=request.pk)
        media_uploads = media_model.objects.filter(update_request_id=request.pk)
        revision.documents.add(*documents)
        revision.media_uploads.add(*media_uploads)
        documents.update(update_revision_id=revision.pk)
        media_uploads.update(update_revision_id=revision.pk)
        tax_evidence_model.objects.filter(update_request_id=request.pk).update(workflow_revision=1)
        event_model.objects.create(
            public_id=f'cue_migrated_{request.pk}',
            update_request_id=request.pk,
            actor_id=request.requested_by_id,
            event_type='submitted',
            revision_number=1,
            payload={'migrated': True, 'source': 'pre_v2_current_snapshot'},
        )


def restore_legacy_company_update_statuses(apps, schema_editor):
    request_model = apps.get_model('employers', 'CompanyUpdateRequest')
    request_model.objects.filter(status__in=['submitted', 'in_review', 'changes_requested']).update(
        status='pending'
    )
    request_model.objects.filter(status__in=['withdrawn', 'cancelled']).update(status='rejected')


class Migration(migrations.Migration):
    dependencies = [
        ('employers', '0037_company_update_lifecycle_v2'),
    ]

    operations = [
        migrations.RunPython(
            backfill_company_update_lifecycle,
            restore_legacy_company_update_statuses,
        ),
    ]
