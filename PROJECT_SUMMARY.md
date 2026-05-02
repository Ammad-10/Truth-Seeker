# TruthSeeker Project Summary

## Overview

TruthSeeker is a fake news detection project that combines a trained NLP model, external reasoning, and a web interface to estimate the credibility of news-like text. The project is organized as a full-stack application:

- A React/Vite frontend in `Website/`
- A Flask model API in `truthseeker/deployment/`
- A DistilBERT + LoRA inference layer in `truthseeker/training/`
- Local model artifacts and SQLite storage in `truthseeker/`
- Supabase SQL and Edge Function files in `Website/supabase/`

The main user flow is: sign in, submit news text on the Verify page, receive a credibility score and verdict, then view saved analysis history and trends.

## Main Features

- News text verification through `/api/verify`
- Credibility scoring from the local ML model and Groq reasoning
- Three-level verdict output: `REAL`, `NEEDS REVIEW`, or `FAKE`
- Topic-aware reasoning for health, politics, finance, science, conspiracy, sports, and general claims
- Linguistic warning flags for clickbait, excessive caps, emotional punctuation, and conspiracy-style phrasing
- Local verification history stored in SQLite
- Protected frontend routes for Verify, Results, History, and Trends
- Optional OCR path for image input when Tesseract dependencies are installed
- Supabase schema support for authentication and verification history

## Repository Structure

```text
.
├── README.md
├── LOCAL_DEPLOYMENT_COMMANDS.md
├── PROJECT_SUMMARY.md
├── Website/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Index.tsx
│   │   │   ├── Auth.tsx
│   │   │   ├── Verify.tsx
│   │   │   ├── Results.tsx
│   │   │   ├── History.tsx
│   │   │   ├── Trends.tsx
│   │   │   └── About.tsx
│   │   ├── components/
│   │   ├── integrations/supabase/
│   │   └── lib/modelApi.ts
│   ├── supabase/
│   │   ├── schema.sql
│   │   ├── setup_truthseeker.sql
│   │   ├── migrations/
│   │   └── functions/
│   └── package.json
└── truthseeker/
    ├── training/
    │   └── inference.py
    ├── deployment/
    │   ├── app.py
    │   ├── Dockerfile
    │   ├── requirements.txt
    │   └── truthseeker.db
    ├── model_output/
    │   ├── base_models/
    │   └── sagemaker_clean_2026_04_24/
    └── truthseeker.db
```

## Frontend

The frontend is a Vite React application using TypeScript, Tailwind CSS, shadcn-style UI components, Radix UI, React Router, TanStack Query, Supabase, and Vitest.

Important files:

- `Website/src/App.tsx` defines the application routes.
- `Website/src/lib/modelApi.ts` sends verification requests to the Flask API.
- `Website/src/pages/Verify.tsx` handles the user verification workflow.
- `Website/src/pages/Results.tsx` displays the credibility score, verdict, reasoning, and sub-scores.
- `Website/src/pages/History.tsx` shows saved verification records.
- `Website/src/pages/Trends.tsx` shows aggregate verification trends.

Frontend routes:

| Route | Purpose | Protected |
| --- | --- | --- |
| `/` | Landing/home page | No |
| `/auth` | Authentication page | No |
| `/verify` | Submit news text for analysis | Yes |
| `/results` | Display verification result | Yes |
| `/history` | View previous verifications | Yes |
| `/trends` | View trend summary | Yes |
| `/about` | Project information | No |

The frontend reads the backend URL from `VITE_MODEL_API_URL`. If it is not set, it defaults to:

```text
http://localhost:5000
```

## Backend API

The Flask backend is implemented in `truthseeker/deployment/app.py`. It loads environment variables, initializes the local SQLite database, loads the model through `TruthSeekerInference`, and exposes REST endpoints for verification, authentication, history, and trends.

Main endpoints:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Checks API status, model loading, OCR availability, and configuration |
| `POST` | `/api/verify` | Analyzes text or image input and returns credibility results |
| `POST` | `/api/register` | Creates a local SQLite user account |
| `POST` | `/api/login` | Authenticates a local SQLite user and returns a JWT |
| `GET` | `/api/history` | Returns recent verification records, JWT required |
| `GET` | `/api/trends` | Returns verdict counts from local verification history |

The API includes simple request caching and rate limiting. Verification results are stored in the local `verifications` table when possible.

## Model and Inference

Model inference is handled by `truthseeker/training/inference.py`.

The inference engine:

- Loads a tokenizer and sequence classification model
- Supports LoRA adapter models through PEFT
- Prefers a local DistilBERT base model when available
- Cleans input text before prediction
- Produces fake and real probabilities
- Classifies output into `REAL`, `NEEDS REVIEW`, or `FAKE`
- Reports inference latency in milliseconds

The current local deployment points to:

```text
MODEL_PATH=../model_output/sagemaker_clean_2026_04_24/extracted/final_model
TRUTHSEEKER_BASE_MODEL_PATH=../model_output/base_models/distilbert-base-uncased
TRUTHSEEKER_INVERT_MODEL_PROBS=true
```

These paths are documented in `LOCAL_DEPLOYMENT_COMMANDS.md`.

## Scoring Logic

The active `/api/verify` flow uses:

- 50 percent local model credibility score
- 50 percent Groq reasoning score
- 0 percent external news API score
- 0 percent Google Fact Check score

External GDELT and Google Fact Check integrations are currently parked with neutral score values, so existing response fields remain stable.

Final verdict mapping:

| Credibility Score | Verdict |
| --- | --- |
| `0-39` | `FAKE` |
| `40-75` | `NEEDS REVIEW` |
| `76-100` | `REAL` |

The response includes the final score, verdict, model score, model fake percentage, Groq score, Groq verdict, Groq reasoning, topic, fact-check placeholder data, GDELT placeholder sources, flags, and timing fields.

## Data Storage

The local Flask backend initializes these SQLite tables:

- `users`
- `verifications`
- `live_trends`

The Supabase schema in `Website/supabase/schema.sql` defines:

- `public.users`, linked to `auth.users`
- `public.verifications`
- Row Level Security policies so users can insert and view their own verifications

This means the project contains both a local SQLite-backed API path and Supabase-backed frontend/database assets.

## Local Development

Backend:

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

Frontend:

```bash
cd Website
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

## Environment Variables

Common backend variables:

| Variable | Purpose |
| --- | --- |
| `MODEL_PATH` | Path to the trained final model or LoRA adapter |
| `TRUTHSEEKER_BASE_MODEL_PATH` | Local DistilBERT base model path |
| `TRUTHSEEKER_INVERT_MODEL_PROBS` | Whether to invert model fake/real probabilities |
| `GROQ_API_KEY` | Enables Groq reasoning |
| `GROQ_MODEL` | Optional Groq model override, defaults to `llama-3.3-70b-versatile` |
| `GOOGLE_FACT_CHECK_KEY` | Optional Google Fact Check API key, currently disabled in active scoring |
| `JWT_SECRET` | Secret used for Flask JWT tokens |
| `DB_PATH` | Optional SQLite database path |
| `PORT` | Flask API port, defaults to `5000` |

Common frontend variable:

| Variable | Purpose |
| --- | --- |
| `VITE_MODEL_API_URL` | URL of the Flask model API |

## Testing and Quality Commands

Frontend scripts available in `Website/package.json`:

```bash
npm run dev
npm run build
npm run lint
npm run test
npm run preview
```

The frontend includes Vitest setup files under `Website/src/test/`.

## Deployment Notes

The backend includes a Dockerfile in `truthseeker/deployment/Dockerfile` and can be run directly with Flask for local development. The file header in `app.py` also notes a production-style Gunicorn command:

```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

The repository is documented for local deployment and demo use. The included model package contains the trained TruthSeeker LoRA adapter; the larger DistilBERT base model is kept out of Git and can be downloaded or supplied locally.

## Current Limitations and Future Work

- External fact-check APIs are disabled in the active scoring path.
- Groq reasoning requires a valid `GROQ_API_KEY`.
- OCR requires optional Tesseract dependencies.
- The model is strongest on full article-style news text rather than very short claims.
- Local SQLite auth and Supabase auth both exist, so production architecture should choose one source of truth.
- Additional evaluation metrics, model cards, and dataset provenance details would strengthen the documentation for academic or production review.

## Quick Demo Flow

1. Start the Flask API on `http://localhost:5000`.
2. Start the Vite frontend on `http://localhost:5173`.
3. Log in through the website.
4. Open the Verify page.
5. Paste full article-style news text.
6. Run analysis.
7. Review the score, verdict, topic, model output, and Groq reasoning.
8. Open History and Trends to confirm the result was saved.
