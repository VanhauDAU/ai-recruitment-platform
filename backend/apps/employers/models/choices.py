from django.db import models


class PositionLevel(models.TextChoices):
    EMPLOYEE = 'employee', 'Nhân viên'
    TEAM_LEAD = 'team_lead', 'Trưởng nhóm'
    MANAGER = 'manager', 'Trưởng / Phó phòng'
    SUPERVISOR = 'supervisor', 'Quản lý / Giám sát'
    BRANCH_MANAGER = 'branch_manager', 'Trưởng chi nhánh'
    VICE_DIRECTOR = 'vice_director', 'Phó giám đốc'
    DIRECTOR = 'director', 'Giám đốc'
    INTERN = 'intern', 'Thực tập sinh'


class BudgetSource(models.TextChoices):
    COMPANY = 'company', 'Công ty'
    PERSONAL = 'personal', 'Cá nhân'
