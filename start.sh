#!/bin/bash
set -e

echo "==> Running database migrations..."
.venv/bin/python backend/manage.py migrate --noinput

echo "==> Checking if database needs seeding..."
NEEDS_SEED=$(.venv/bin/python backend/manage.py shell -c "from django.contrib.auth import get_user_model; print('yes' if not get_user_model().objects.exists() else 'no')" 2>/dev/null | tail -1)

if [ "$NEEDS_SEED" = "yes" ]; then
    echo "==> No users found — seeding demo data..."
    .venv/bin/python backend/manage.py shell < backend/seed.py
else
    echo "==> Users already exist — skipping seed."
fi

echo "==> Starting gunicorn..."
exec .venv/bin/gunicorn bookmymeal.wsgi \
    --chdir backend \
    --bind 0.0.0.0:${PORT:-8000} \
    --workers 2 \
    --timeout 120 \
    --access-logfile -
