from django.db import models
from django.utils.translation import gettext_lazy


class PositionLevel(models.TextChoices):
    EMPLOYEE = 'employee', gettext_lazy('Nhân viên')
    TEAM_LEAD = 'team_lead', gettext_lazy('Trưởng nhóm')
    MANAGER = 'manager', gettext_lazy('Trưởng / Phó phòng')
    SUPERVISOR = 'supervisor', gettext_lazy('Quản lý / Giám sát')
    BRANCH_MANAGER = 'branch_manager', gettext_lazy('Trưởng chi nhánh')
    VICE_DIRECTOR = 'vice_director', gettext_lazy('Phó giám đốc')
    DIRECTOR = 'director', gettext_lazy('Giám đốc')
    INTERN = 'intern', gettext_lazy('Thực tập sinh')


class BudgetSource(models.TextChoices):
    COMPANY = 'company', gettext_lazy('Công ty')
    PERSONAL = 'personal', gettext_lazy('Cá nhân')
