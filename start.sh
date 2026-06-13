#!/bin/bash
set -e

echo "==> Running database migrations..."
.venv/bin/python backend/manage.py migrate --noinput

echo "==> Starting gunicorn..."
exec .venv/bin/gunicorn bookmymeal.wsgi \
    --chdir backend \
    --bind 0.0.0.0:${PORT:-8000} \
    --workers 2 \
    --timeout 120 \
    --access-logfile -
