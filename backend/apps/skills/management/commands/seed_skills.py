from django.core.management.base import BaseCommand

from apps.skills.models import Skill

SEED_SKILLS = [
    ('ReactJS', Skill.Category.FRONTEND, ['React', 'React.js']),
    ('Vue.js', Skill.Category.FRONTEND, ['VueJS', 'Vue']),
    ('HTML/CSS', Skill.Category.FRONTEND, ['HTML', 'CSS', 'HTML5', 'CSS3']),
    ('Tailwind CSS', Skill.Category.FRONTEND, ['TailwindCSS']),
    ('TypeScript', Skill.Category.FRONTEND, ['TS']),
    ('Django', Skill.Category.BACKEND, ['Django REST Framework', 'DRF']),
    ('Node.js', Skill.Category.BACKEND, ['NodeJS', 'Express.js']),
    ('FastAPI', Skill.Category.BACKEND, []),
    ('REST API', Skill.Category.BACKEND, ['RESTful API']),
    ('JWT Authentication', Skill.Category.BACKEND, ['JWT', 'JSON Web Token']),
    ('PostgreSQL', Skill.Category.DATABASE, ['Postgres']),
    ('MySQL', Skill.Category.DATABASE, []),
    ('MongoDB', Skill.Category.DATABASE, ['Mongo']),
    ('SQL', Skill.Category.DATABASE, []),
    ('Docker', Skill.Category.DEVOPS, ['Docker Compose']),
    ('CI/CD', Skill.Category.DEVOPS, ['GitHub Actions', 'Jenkins']),
    ('Linux', Skill.Category.DEVOPS, []),
    ('Nginx', Skill.Category.DEVOPS, []),
    ('Manual Testing', Skill.Category.TESTING, ['Test Case']),
    ('Postman', Skill.Category.TESTING, []),
    ('Unit Testing', Skill.Category.TESTING, ['Pytest', 'Jest']),
    ('Selenium', Skill.Category.TESTING, []),
    ('Pandas', Skill.Category.DATA, []),
    ('Power BI', Skill.Category.DATA, ['PowerBI']),
    ('Data Analysis', Skill.Category.DATA, []),
    ('Excel', Skill.Category.DATA, ['Microsoft Excel']),
    ('Machine Learning', Skill.Category.AI, ['ML']),
    ('scikit-learn', Skill.Category.AI, ['sklearn']),
    ('NLP', Skill.Category.AI, ['Natural Language Processing']),
    ('Deep Learning', Skill.Category.AI, ['TensorFlow', 'PyTorch']),
    ('Flutter', Skill.Category.MOBILE, []),
    ('React Native', Skill.Category.MOBILE, ['ReactNative']),
    ('Android (Kotlin)', Skill.Category.MOBILE, ['Kotlin']),
    ('iOS (Swift)', Skill.Category.MOBILE, ['Swift']),
]


class Command(BaseCommand):
    help = 'Seed the skills table with the standard skill catalog (single source of truth for skills).'

    def handle(self, *args, **options):
        created, updated = 0, 0
        for name, category, aliases in SEED_SKILLS:
            _, was_created = Skill.objects.update_or_create(
                name=name,
                defaults={'category': category, 'aliases': aliases, 'is_active': True},
            )
            created += was_created
            updated += not was_created
        self.stdout.write(self.style.SUCCESS(f'Skills seeded: {created} created, {updated} updated.'))
