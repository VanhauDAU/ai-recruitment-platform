# 05 - Hướng dẫn cài đặt & chạy local

## Yêu cầu
- Python 3.13, Node.js 20+, PostgreSQL 16

## Backend

```bash
cd backend
python3.13 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # chỉnh DB_USER/DB_PASSWORD nếu khác
python manage.py migrate
python manage.py seed_skills
python manage.py createsuperuser
python manage.py runserver 8000
```

## Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev   # http://localhost:5173
```

## PostgreSQL (macOS, Homebrew)

```bash
brew services start postgresql@16
createdb ai_career_coach
```
