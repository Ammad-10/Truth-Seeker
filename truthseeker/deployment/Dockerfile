# TruthSeeker — Production Docker Image
# Build: docker build -t truthseeker-api .
# Run:   docker run -p 5000:5000 -e MODEL_PATH=/app/model -v ./model_output:/app/model truthseeker-api

FROM python:3.11-slim

# Install system dependencies (Tesseract OCR + poppler)
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first (layer caching)
COPY training/requirements.txt ./requirements.txt

# Install Python deps (CPU-only torch for inference — much smaller)
RUN pip install --no-cache-dir \
    torch==2.2.0+cpu \
    -f https://download.pytorch.org/whl/torch_stable.html && \
    pip install --no-cache-dir \
    transformers==4.39.0 \
    peft==0.10.0 \
    flask==3.0.2 \
    flask-cors==4.0.0 \
    flask-jwt-extended==4.6.0 \
    gunicorn==21.2.0 \
    pytesseract==0.3.10 \
    Pillow==10.2.0 \
    requests==2.31.0 \
    psycopg2-binary==2.9.9 \
    werkzeug

# Copy application code
COPY training/inference.py ./training/inference.py
COPY deployment/app.py ./app.py

# Model will be mounted as volume
ENV MODEL_PATH=/app/model
ENV PORT=5000
ENV FLASK_ENV=production

EXPOSE 5000

# Production: gunicorn with 4 workers
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "--timeout", "120", "app:app"]
