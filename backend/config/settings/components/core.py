"""Lõi Django: đường dẫn, bí mật, app, middleware, DB, mật khẩu, i18n."""

from pathlib import Path

from decouple import Csv

from config.env import config

# Build paths inside the project like this: BASE_DIR / 'subdir'.
# components/core.py -> components -> settings -> config -> backend
BASE_DIR = Path(__file__).resolve().parents[3]


ENVIRONMENT = config('ENVIRONMENT', default='development').strip().lower()
IS_PRODUCTION = ENVIRONMENT == 'production'
_DEFAULT_SECRET_KEY = 'django-insecure-dev-key-change-me-at-least-32-characters'

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = config('SECRET_KEY', default=_DEFAULT_SECRET_KEY)

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = config('DEBUG', default=True, cast=bool)
DJANGO_ADMIN_ENABLED = config('DJANGO_ADMIN_ENABLED', default=DEBUG, cast=bool)

ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1', cast=Csv())

# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.postgres',
    # Third-party
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'drf_spectacular',
    'corsheaders',
    # Local apps
    'apps.accounts',
    'apps.skills',
    'apps.candidates',
    'apps.employers',
    'apps.locations',
    'apps.cv_templates',
    'apps.cvs',
    'apps.jobs',
    'apps.applications',
    'apps.ai_core',
    'apps.matching',
    'apps.campaigns',
    'apps.dashboard',
    'apps.sitecontent',
    'apps.blog',
    'apps.privacy',
    'apps.knowledgebase',
    'apps.uploads',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'common.http.security.ApiSecurityHeadersMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'common.http.security.AuthCookieOriginMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    # Chọn ngôn ngữ theo Accept-Language do frontend gửi (vi/en, ADR-0023).
    'django.middleware.locale.LocaleMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    # Sau CORS/Locale: phản hồi 503 vẫn có header CORS và thông báo đúng ngôn ngữ.
    'apps.sitecontent.api.middleware.MaintenanceModeMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'


# Database
# https://docs.djangoproject.com/en/5.1/ref/settings/#databases

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('DB_NAME', default='ai_career_coach'),
        'USER': config('DB_USER', default='postgres'),
        'PASSWORD': config('DB_PASSWORD', default='postgres'),
        'HOST': config('DB_HOST', default='localhost'),
        'PORT': config('DB_PORT', default='5432'),
        # JIT của PostgreSQL (bật mặc định từ v11) biên dịch các query có biểu
        # thức CASE/subquery lớn — danh sách tin của admin tốn ~160ms chỉ để
        # biên dịch dù đọc vài dòng (348ms → 42ms/request khi tắt). Workload
        # OLTP của Django không có query phân tích dài để JIT bù lại chi phí.
        'OPTIONS': {'options': '-c jit=off'},
    }
}

AUTH_USER_MODEL = 'accounts.User'

# `USERNAME_FIELD='email'` cố ý KHÔNG unique toàn cục: mô hình tách tài khoản
# theo cổng (giống TopCV) cho phép cùng email tồn tại ở khác role. Các cổng app
# tự resolve theo (email, role) khi đăng nhập, nên bỏ qua cảnh báo mặc định của
# Django về USERNAME_FIELD không unique.
SILENCED_SYSTEM_CHECKS = ['auth.E003', 'auth.W004']


# Password validation
# https://docs.djangoproject.com/en/5.1/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {'min_length': 8},
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/5.1/topics/i18n/

# Mặc định tiếng Việt; LocaleMiddleware đổi theo Accept-Language của từng request.
# Không dùng tiền tố ngôn ngữ trong URL: API và route giữ nguyên hợp đồng.
LANGUAGE_CODE = 'vi'

LANGUAGES = [
    ('vi', 'Tiếng Việt'),
    ('en', 'English'),
]

LOCALE_PATHS = [BASE_DIR / 'locale']

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.1/howto/static-files/
