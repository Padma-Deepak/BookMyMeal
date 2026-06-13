FROM python:3.12-slim

# Install Node.js 22 via NodeSource
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python deps (cached layer)
COPY backend/requirements.txt backend/
RUN python -m venv .venv && .venv/bin/pip install --no-cache-dir -r backend/requirements.txt

# Node deps (cached layer)
COPY frontend/package*.json frontend/
RUN npm --prefix frontend install

# Copy all source
COPY . .

# Build frontend and collect Django static files
RUN npm --prefix frontend run build && \
    .venv/bin/python backend/manage.py collectstatic --noinput

CMD ["bash", "start.sh"]
