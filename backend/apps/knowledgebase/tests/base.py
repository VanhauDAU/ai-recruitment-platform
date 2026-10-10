from apps.accounts.models import User
from apps.knowledgebase.models import KnowledgeArticle, KnowledgeCategory
from apps.knowledgebase.services import (
    approve_revision,
    create_article,
    publish_revision,
    submit_revision,
)


class PublishedKnowledgeMixin:
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.actor = User.objects.create_superuser(
            email=f'{cls.__name__.lower()}@example.com',
            password='Password@123',
        )
        cls.category = KnowledgeCategory.objects.get(slug='tai-khoan-va-dang-nhap')

    @classmethod
    def publish_article(
        cls,
        *,
        category=None,
        title='Làm thế nào để đăng nhập an toàn?',
        body='<h2>Các bước đăng nhập</h2><p>Nhập email và mật khẩu của bạn.</p>',
        article_type=KnowledgeArticle.ArticleType.FAQ,
        order=0,
    ):
        article, revision = create_article(
            actor=cls.actor,
            category=category or cls.category,
            article_type=article_type,
            title=title,
            body=body,
            source_reference='/login',
            order=order,
            seo_title=f'Hướng dẫn: {title}',
            seo_description='Hướng dẫn đã được kiểm duyệt.',
        )
        article, revision = submit_revision(
            article=article,
            revision_number=revision.number,
            actor=cls.actor,
            expected_revision_token=article.revision_token,
        )
        article, revision = approve_revision(
            article=article,
            revision_number=revision.number,
            actor=cls.actor,
            expected_revision_token=article.revision_token,
        )
        return publish_revision(
            article=article,
            revision_number=revision.number,
            actor=cls.actor,
            expected_revision_token=article.revision_token,
        )
