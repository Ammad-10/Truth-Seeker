# TruthSeeker — AI Fake News Detection System

**Stack:** Python · PyTorch · DistilBERT · LoRA · Flask · Docker · AWS SageMaker · Groq LLM · React · Supabase

End-to-end fake news detection system — every layer designed and deployed independently.

---

## What It Does

TruthSeeker takes raw news text, runs it through a fine-tuned transformer, synthesises reasoning with a large language model, and returns a credibility verdict with a breakdown of contributing scores.

- Fine-tuned DistilBERT with LoRA adapters trained on AWS SageMaker
- Flask REST API with request caching and rate limiting, containerised with Docker
- React + Vite frontend with protected routes and Supabase authentication
- Groq LLM integration for real-time topic-aware reasoning
- Linguistic flag analysis: clickbait, excessive caps, emotional punctuation, conspiracy phrasing
- Verification history and trend analytics stored in SQLite

---

## Architecture

```
User
 │
 ▼
React / Vite Frontend  (TypeScript · Tailwind · Radix UI · Supabase Auth)
 │
 ▼  POST /api/verify
Flask REST API  (Python · Flask · JWT)
 ├── TruthSeekerInference  ──►  DistilBERT + LoRA adapter  (PyTorch · PEFT)
 └── Groq Reasoning Layer  ──►  llama-3.3-70b-versatile
 │
 ▼
SQLite  (users · verifications · live_trends)
```

---

## Scoring

| Source | Weight |
|---|---|
| Local ML model (DistilBERT + LoRA) | 50% |
| Groq LLM reasoning | 50% |

| Credibility Score | Verdict |
|---|---|
| 0 – 39 | FAKE |
| 40 – 75 | NEEDS REVIEW |
| 76 – 100 | REAL |

---

## Quick Start

### Backend

```bash
cd truthseeker/deployment
python -m venv .venv
source .venv/bin/activate
pip install --index-url https://download.pytorch.org/whl/cpu torch
pip install -r requirements.txt
python app.py
```

Health check:

```bash
curl http://localhost:5000/api/health
```

### Frontend

```bash
cd Website
npm install
npm run dev
```

Open `http://localhost:5173`

---

## Environment

Create `truthseeker/deployment/.env`:

```env
MODEL_PATH=../model_output/sagemaker_clean_2026_04_24/extracted/final_model
TRUTHSEEKER_BASE_MODEL_PATH=../model_output/base_models/distilbert-base-uncased
TRUTHSEEKER_INVERT_MODEL_PROBS=false
GROQ_API_KEY=your-groq-api-key
GROQ_MODEL=llama-3.3-70b-versatile
GOOGLE_FACT_CHECK_KEY=
```

If `TRUTHSEEKER_BASE_MODEL_PATH` is not set, the backend falls back to downloading `distilbert-base-uncased` via Hugging Face Transformers.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | API status, model loading, OCR availability |
| `POST` | `/api/verify` | Analyse text, return score + verdict + reasoning |
| `POST` | `/api/register` | Create a local user account |
| `POST` | `/api/login` | Authenticate and return a JWT |
| `GET` | `/api/history` | Recent verifications (JWT required) |
| `GET` | `/api/trends` | Verdict counts from verification history |

---

## Project Structure

```
.
├── truthseeker/
│   ├── deployment/
│   │   ├── app.py              # Flask API
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   ├── training/
│   │   └── inference.py        # DistilBERT + LoRA inference engine
│   └── model_output/
│       └── sagemaker_clean_2026_04_24/   # Trained LoRA adapter
└── Website/
    ├── src/
    │   ├── pages/              # Verify · Results · History · Trends
    │   └── lib/modelApi.ts     # API client
    └── supabase/               # Schema · Edge Functions
```

---

## Demo Flow

1. Start the Flask API (`python app.py`)
2. Start the Vite frontend (`npm run dev`)
3. Sign in through the website
4. Open **Verify**, paste article-style news text, click **Analyze**
5. Review credibility score, verdict, model score, Groq reasoning, and linguistic flags
6. Open **History** and **Trends** to see saved results

---

## Notes

- The model performs best on full article-style text; very short claims skew toward `NEEDS REVIEW`
- External fact-check APIs (GDELT, Google Fact Check) are wired up but parked at neutral scores
- OCR image input requires optional Tesseract dependencies
- Production deployment can use Gunicorn: `gunicorn -w 4 -b 0.0.0.0:5000 app:app`
