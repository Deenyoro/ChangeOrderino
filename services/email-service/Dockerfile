# ==========================================
# Email Service Dockerfile
# ==========================================
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/

# Create non-root user
RUN useradd -m -u 1000 emailworker && \
    chown -R emailworker:emailworker /app

USER emailworker

# Set Python path
ENV PYTHONPATH=/app

# Health check (check if worker process is running)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD ps aux | grep -v grep | grep "python -m app.main" || exit 1

# Run the worker
CMD ["python", "-m", "app.main"]
