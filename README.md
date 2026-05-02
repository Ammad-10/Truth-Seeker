# TruthSeeker

TruthSeeker is a local fake-news verification app. It runs a React website, a Flask model API, a trained DistilBERT + LoRA adapter, and a Groq reasoning layer.

This repository is for local deployment and demo use. It does not include cloud training instructions.

## What Is Included

- React/Vite frontend in `Website/`
- Flask API in `truthseeker/deployment/`
- Inference engine in `truthseeker/training/inference.py`
- Trained LoRA adapter package in `truthseeker/model_output/sagemaker_clean_2026_04_24/`
- Supabase schema and Edge Function files in `Website/supabase/`
- Local deployment commands in `LOCAL_DEPLOYMENT_COMMANDS.md`
- Project summary in `PROJECT_SUMMARY.md`

## What Is Not Committed

These files are intentionally ignored:

- `.env` files and API keys
- SQLite databases
- Python virtual environments
- `node_modules`
- frontend build output
- the large local DistilBERT base model under `truthseeker/model_output/base_models/`

The trained project adapter is small and is included. The base DistilBERT model is large, so it should be downloaded or placed locally when running the backend.

## Local Backend

From the project root:

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

Expected response should include:

```json
{
  "status": "ok",
  "model_loaded": true
}
```

## Local Frontend

Open a second terminal from the project root:

```bash
cd Website
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

## Environment

Create or update `truthseeker/deployment/.env`:

```env
MODEL_PATH=../model_output/sagemaker_clean_2026_04_24/extracted/final_model
TRUTHSEEKER_INVERT_MODEL_PROBS=false
GROQ_API_KEY=your-groq-api-key
GROQ_MODEL=llama-3.3-70b-versatile
GOOGLE_FACT_CHECK_KEY=
```

Optional local base-model override:

```env
TRUTHSEEKER_BASE_MODEL_PATH=../model_output/base_models/distilbert-base-uncased
```

If the base model folder is not present, the backend can fall back to downloading `distilbert-base-uncased` through Transformers.

## Demo Flow

1. Start the Flask API.
2. Start the Vite website.
3. Log in through the website.
4. Open `Verify`.
5. Paste full article-style news text.
6. Click `Analyze`.
7. Review the credibility score, verdict, model score, Groq reasoning, and history entry.

## Notes

- Groq is used for reasoning synthesis.
- External fact-check APIs are disabled by default.
- The model works best with article-style text.
- Very short claims are calibrated toward review instead of extreme confidence.
