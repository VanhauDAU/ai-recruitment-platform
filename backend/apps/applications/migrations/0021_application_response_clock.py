"""One response clock counted from the submission.

``submitted_at`` duplicated ``applied_at`` once the in-place CV swap was
removed. ``auto_reject_due_floor`` keeps a warned window after an undo near the
automatic rejection deadline.
"""

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('applications', '0020_candidate_block_company'),
    ]

    operations = [
        migrations.RemoveField(model_name='application', name='submitted_at'),
        migrations.AddField(
            model_name='application',
            name='auto_reject_due_floor',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
