from django.urls import path

from .api.views import (
    AcceptDpaView,
    AllIndustryListView,
    CompanyCoverUploadView,
    CompanyCatalogView,
    CompanyDocumentListCreateView,
    CompanyGalleryDeleteView,
    CompanyGalleryUploadView,
    CompanyLogoUploadView,
    CompanySearchView,
    CompanyUpdateRequestListCreateView,
    CreateCompanyView,
    IndustryListView,
    JoinCompanyView,
    MyCompanyView,
    PhoneAvailabilityView,
    RecruiterMeView,
    RecruitmentNeedView,
    RecruitmentNeedListCreateView,
    RecruitmentNeedDetailView,
    SendPhoneOtpView,
    VerifyPhoneOtpView,
)
from .api.views.registration import CompleteEmployerRegistrationView, EmployerRegisterView

urlpatterns = [
    path('register/', EmployerRegisterView.as_view(), name='employer-register'),
    path('onboarding/registration/', CompleteEmployerRegistrationView.as_view(), name='employer-registration-complete'),
    path('consulting-need/', RecruitmentNeedView.as_view(), name='employer-consulting-need'),
    path('recruitment-needs/', RecruitmentNeedListCreateView.as_view(), name='employer-recruitment-needs'),
    path('recruitment-needs/<str:public_id>/', RecruitmentNeedDetailView.as_view(), name='employer-recruitment-need-detail'),
    # Nhà tuyển dụng + onboarding
    path('me/', RecruiterMeView.as_view(), name='employer-me'),
    path('phone/check/', PhoneAvailabilityView.as_view(), name='employer-phone-check'),
    path('phone/send-otp/', SendPhoneOtpView.as_view(), name='employer-phone-send-otp'),
    path('phone/verify/', VerifyPhoneOtpView.as_view(), name='employer-phone-verify'),
    path('dpa/accept/', AcceptDpaView.as_view(), name='employer-dpa-accept'),
    # Công ty
    path('company/', MyCompanyView.as_view(), name='employer-company'),
    path('company/create/', CreateCompanyView.as_view(), name='employer-company-create'),
    path('company/search/', CompanySearchView.as_view(), name='employer-company-search'),
    path('company/catalogs/', CompanyCatalogView.as_view(), name='employer-company-catalogs'),
    path('company/join/', JoinCompanyView.as_view(), name='employer-company-join'),
    path('company/logo/', CompanyLogoUploadView.as_view(), name='employer-company-logo-upload'),
    path('company/cover/', CompanyCoverUploadView.as_view(), name='employer-company-cover-upload'),
    path('company/images/', CompanyGalleryUploadView.as_view(), name='employer-company-image-upload'),
    path('company/images/<int:pk>/', CompanyGalleryDeleteView.as_view(), name='employer-company-image-delete'),
    path('company/documents/', CompanyDocumentListCreateView.as_view(), name='employer-company-documents'),
    path('company/update-requests/', CompanyUpdateRequestListCreateView.as_view(), name='employer-company-update-requests'),
    # Danh mục lĩnh vực
    path('industries/', IndustryListView.as_view(), name='employer-industries'),
    path('industries/all/', AllIndustryListView.as_view(), name='employer-industries-all'),
]
