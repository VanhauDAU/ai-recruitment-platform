from django.urls import path

from .views import SkillGroupListView, SkillListView


urlpatterns = [
    path('', SkillListView.as_view(), name='skill-list'),
    path('groups/', SkillGroupListView.as_view(), name='skill-group-list'),
]
