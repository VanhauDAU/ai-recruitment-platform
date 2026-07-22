"""Public HTTP views grouped by employers use case."""

from .campaigns import (
    RecruitmentCampaignDetailView,
    RecruitmentCampaignFromNeedView,
    RecruitmentCampaignListCreateView,
    RecruitmentCampaignOptionsView,
    RecruitmentCampaignReportView,
    RecruitmentCampaignStatusView,
    RecruitmentCampaignSuggestionsView,
)
from .catalogs import AllIndustryListView, CompanyCatalogView, IndustryListView
from .companies import CompanySearchView, CreateCompanyView, MyCompanyView
from .media import (
    CompanyCoverUploadView,
    CompanyGalleryDeleteView,
    CompanyGalleryUploadView,
    CompanyLogoUploadView,
)
from .memberships import JoinCompanyView
from .onboarding import (
    AcceptDpaView,
    PhoneAvailabilityView,
    RecruiterMeView,
    SendPhoneOtpView,
    VerifyPhoneOtpView,
)
from .recruitment_need import (
    RecruitmentNeedDetailView,
    RecruitmentNeedListCreateView,
    RecruitmentNeedView,
)
from .verification import (
    CompanyDocumentContentView,
    CompanyDocumentListCreateView,
    CompanyUpdateRequestListCreateView,
)

__all__ = [
    'AcceptDpaView',
    'AllIndustryListView',
    'CompanyCoverUploadView',
    'CompanyCatalogView',
    'CompanyDocumentListCreateView',
    'CompanyDocumentContentView',
    'CompanyGalleryDeleteView',
    'CompanyGalleryUploadView',
    'CompanyLogoUploadView',
    'CompanySearchView',
    'CompanyUpdateRequestListCreateView',
    'CreateCompanyView',
    'IndustryListView',
    'JoinCompanyView',
    'MyCompanyView',
    'PhoneAvailabilityView',
    'RecruiterMeView',
    'RecruitmentCampaignDetailView',
    'RecruitmentCampaignFromNeedView',
    'RecruitmentCampaignListCreateView',
    'RecruitmentCampaignOptionsView',
    'RecruitmentCampaignReportView',
    'RecruitmentCampaignStatusView',
    'RecruitmentCampaignSuggestionsView',
    'RecruitmentNeedView',
    'RecruitmentNeedListCreateView',
    'RecruitmentNeedDetailView',
    'SendPhoneOtpView',
    'VerifyPhoneOtpView',
]
