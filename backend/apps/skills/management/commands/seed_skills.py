from django.core.management.base import BaseCommand

from apps.skills.models import Skill, SkillGroup

SEED_SKILLS = [
    ('ReactJS', 'Frontend', ['React', 'React.js']),
    ('Vue.js', 'Frontend', ['VueJS', 'Vue']),
    ('HTML/CSS', 'Frontend', ['HTML', 'CSS', 'HTML5', 'CSS3']),
    ('Tailwind CSS', 'Frontend', ['TailwindCSS']),
    ('TypeScript', 'Frontend', ['TS']),
    ('Django', 'Backend', ['Django REST Framework', 'DRF']),
    ('Node.js', 'Backend', ['NodeJS', 'Express.js']),
    ('FastAPI', 'Backend', []),
    ('REST API', 'Backend', ['RESTful API']),
    ('JWT Authentication', 'Backend', ['JWT', 'JSON Web Token']),
    ('PostgreSQL', 'Database', ['Postgres']),
    ('MySQL', 'Database', []),
    ('MongoDB', 'Database', ['Mongo']),
    ('SQL', 'Database', []),
    ('Docker', 'DevOps', ['Docker Compose']),
    ('CI/CD', 'DevOps', ['GitHub Actions', 'Jenkins']),
    ('Linux', 'DevOps', []),
    ('Nginx', 'DevOps', []),
    ('Manual Testing', 'Testing', ['Test Case']),
    ('Postman', 'Testing', []),
    ('Unit Testing', 'Testing', ['Pytest', 'Jest']),
    ('Selenium', 'Testing', []),
    ('Pandas', 'Data', []),
    ('Power BI', 'Data', ['PowerBI']),
    ('Data Analysis', 'Data', []),
    ('Excel', 'Data', ['Microsoft Excel']),
    ('Machine Learning', 'AI', ['ML']),
    ('scikit-learn', 'AI', ['sklearn']),
    ('NLP', 'AI', ['Natural Language Processing']),
    ('Deep Learning', 'AI', ['TensorFlow', 'PyTorch']),
    ('Flutter', 'Mobile', []),
    ('React Native', 'Mobile', ['ReactNative']),
    ('Android (Kotlin)', 'Mobile', ['Kotlin']),
    ('iOS (Swift)', 'Mobile', ['Swift']),
]


class Command(BaseCommand):
    help = 'Seed the skills table with the standard skill catalog (single source of truth for skills).'

    def handle(self, *args, **options):
        created, updated = 0, 0
        for name, group_name, aliases in SEED_SKILLS:
            group, _ = SkillGroup.objects.get_or_create(name=group_name)
            _, was_created = Skill.objects.update_or_create(
                name=name,
                defaults={'group': group, 'aliases': aliases, 'is_active': True},
            )
            created += was_created
            updated += not was_created
        self.stdout.write(self.style.SUCCESS(f'Skills seeded: {created} created, {updated} updated.'))
