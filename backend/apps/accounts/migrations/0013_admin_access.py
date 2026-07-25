import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0012_employer_two_factor_methods'),
    ]

    operations = [
        migrations.CreateModel(
            name='AdminPermission',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(max_length=64, unique=True)),
                ('module', models.CharField(max_length=32)),
                ('label', models.CharField(max_length=120)),
                ('description', models.TextField(blank=True)),
                ('is_active', models.BooleanField(default=True)),
                ('deprecated_at', models.DateTimeField(blank=True, null=True)),
            ],
            options={'ordering': ['code']},
        ),
        migrations.CreateModel(
            name='Department',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('public_id', models.CharField(editable=False, max_length=64, unique=True)),
                ('code', models.SlugField(max_length=64, unique=True)),
                ('name', models.CharField(max_length=120)),
                ('description', models.TextField(blank=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'ordering': ['name', 'code']},
        ),
        migrations.CreateModel(
            name='AdminAccessAuditLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('public_id', models.CharField(editable=False, max_length=64, unique=True)),
                ('source', models.CharField(max_length=20)),
                ('actor_identifier', models.CharField(blank=True, max_length=255)),
                ('action', models.CharField(max_length=64)),
                ('target_type', models.CharField(max_length=32)),
                ('target_public_id', models.CharField(blank=True, max_length=64)),
                ('payload', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('actor', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='admin_access_audit_logs', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at', '-id'],
                'indexes': [models.Index(fields=['created_at'], name='admin_audit_created_idx')],
            },
        ),
        migrations.CreateModel(
            name='AdminRole',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('public_id', models.CharField(editable=False, max_length=64, unique=True)),
                ('code', models.SlugField(max_length=64)),
                ('name', models.CharField(max_length=120)),
                ('description', models.TextField(blank=True)),
                ('rank', models.PositiveSmallIntegerField(default=0)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('department', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='roles', to='accounts.department')),
                ('permissions', models.ManyToManyField(blank=True, related_name='roles', to='accounts.adminpermission')),
            ],
            options={
                'ordering': ['department__name', '-rank', 'name'],
                'constraints': [models.UniqueConstraint(fields=('department', 'code'), name='uq_admin_role_department_code')],
            },
        ),
        migrations.CreateModel(
            name='AdminMembership',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('public_id', models.CharField(editable=False, max_length=64, unique=True)),
                ('is_primary', models.BooleanField(default=False)),
                ('is_active', models.BooleanField(default=True)),
                ('assigned_at', models.DateTimeField(auto_now_add=True)),
                ('revoked_at', models.DateTimeField(blank=True, null=True)),
                ('assigned_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='admin_memberships_assigned', to=settings.AUTH_USER_MODEL)),
                ('revoked_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='admin_memberships_revoked', to=settings.AUTH_USER_MODEL)),
                ('role', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='memberships', to='accounts.adminrole')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='admin_memberships', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-is_primary', '-role__rank', 'assigned_at', 'id'],
                'constraints': [
                    models.UniqueConstraint(condition=models.Q(('is_active', True)), fields=('user', 'role'), name='uq_admin_membership_active_user_role'),
                    models.UniqueConstraint(condition=models.Q(('is_active', True), ('is_primary', True)), fields=('user',), name='uq_admin_membership_active_primary'),
                ],
            },
        ),
    ]
