#!/usr/bin/env bash
# exit on error
set -o errexit

pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py migrate

# Add this line temporarily to create your admin
python manage.py createsuperuser --no-input || true