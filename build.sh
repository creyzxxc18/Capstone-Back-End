#!/usr/bin/env bash
# exit on error
set -o errexit

pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py migrate

echo "from django.contrib.auth import get_user_model; \
User = get_user_model(); \
import os; \
username = os.getenv('DJANGO_SUPERUSER_USERNAME'); \
email = os.getenv('DJANGO_SUPERUSER_EMAIL'); \
password = os.getenv('DJANGO_SUPERUSER_PASSWORD'); \
first_name = os.getenv('DJANGO_SUPERUSER_FIRST_NAME'); \
last_name = os.getenv('DJANGO_SUPERUSER_LAST_NAME'); \
if not User.objects.filter(email=email).exists(): \
    User.objects.create_superuser(email=email, username=username, password=password, first_name=first_name, last_name=last_name); \
    print('Superuser created successfully!'); \
else: \
    print('Superuser already exists.')" | python manage.py shell