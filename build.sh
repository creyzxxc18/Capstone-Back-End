#!/usr/bin/env bash
# Exit on error
set -o errexit

# Install dependencies
pip install -r requirements.txt

# Collect static files (CSS/JS) into the staticfiles folder
python manage.py collectstatic --no-input

# Run migrations (Optional if using ONLY Firebase, 
# but required if you use Django's built-in Admin/Users)
python manage.py migrate