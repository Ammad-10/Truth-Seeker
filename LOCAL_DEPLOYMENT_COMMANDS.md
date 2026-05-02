# TruthSeeker Local Deployment Commands

Date: April 27, 2026

## What This Runs

This local setup runs:

- Flask model API at `http://localhost:5000`
- Vite website at `http://localhost:5173`
- Supabase for auth and verification history
- Groq for the optional reasoning layer

The website calls the Flask API through:

`VITE_MODEL_API_URL=http://localhost:5000`

## Backend API

From the project root:

```bash
cd truthseeker/deployment
python -m venv .venv
source .venv/bin/activate
pip install --index-url https://download.pytorch.org/whl/cpu torch
pip install -r requirements.txt
python app.py
```

The separate CPU Torch install matters on Manjaro/Python 3.14 because the default PyPI Torch wheel can pull very large CUDA packages.

Health check:

```bash
curl http://localhost:5000/api/health
```

Expected health response should include:

```json
{
  "status": "ok",
  "model_loaded": true
}
```

## Website

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

## Full Local Test

1. Log in through the website.
2. Go to `Verify`.
3. Paste an article-style news text.
4. Click `Analyze`.
5. Confirm the result page appears.
6. Open `History`.
7. Confirm the verification was saved.

## Current Model Paths

The Flask API is configured in `truthseeker/deployment/.env` to use:

```text
MODEL_PATH=../model_output/sagemaker_clean_2026_04_24/extracted/final_model
TRUTHSEEKER_BASE_MODEL_PATH=../model_output/base_models/distilbert-base-uncased
TRUTHSEEKER_INVERT_MODEL_PROBS=false
GROQ_API_KEY=your-groq-api-key
GROQ_MODEL=llama-3.3-70b-versatile
GOOGLE_FACT_CHECK_KEY=
```

These paths point to:

- the included trained LoRA adapter
- the locally downloaded DistilBERT base model

## Demo Note

This model is strongest on article-style news text.

For presentation, use full article-like examples. Keep short-claim robustness as documented future work.

External fact-check APIs are disabled by default, and reasoning uses `GROQ_API_KEY`.
