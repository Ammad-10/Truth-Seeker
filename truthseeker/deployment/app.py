"""
TruthSeeker — Flask REST API
==============================
Serves the trained model via REST API endpoints.
Connect this to your existing React frontend.

Endpoints:
  POST /api/verify        — analyze text/image
  GET  /api/health        — health check
  GET  /api/history       — get verification history (auth required)

Start:
  python app.py
  # Production:
  gunicorn -w 4 -b 0.0.0.0:5000 app:app
"""

import os
import io
import json
import base64
import time
import uuid
import sqlite3
import hashlib
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import quote as url_quote

from flask import Flask, request, jsonify, g
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager, create_access_token,
    jwt_required, get_jwt_identity,
)

# OCR (optional — install pytesseract + tesseract-ocr system package)
try:
    import pytesseract
    from PIL import Image
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False

# NewsAPI (optional — set NEWSAPI_KEY env var)
import requests as http_requests

# Inference engine
import sys
sys.path.insert(0, str(Path(__file__).parent.parent / "training"))
from inference import TruthSeekerInference

# ─── App setup ────────────────────────────────────────────────────────────────

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000", "http://localhost:8080", "http://localhost:5173", "https://yoursite.com"])   # ← add your domain

app.config["JWT_SECRET_KEY"]       = os.getenv("JWT_SECRET", "change-this-in-production-" + uuid.uuid4().hex)
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=24)

jwt = JWTManager(app)

CACHE = {}
REQUEST_COUNTS = {}

from dotenv import load_dotenv

# Load .env from deployment folder, truthseeker folder, and repo root
_deployment_dir = Path(__file__).resolve().parent
_truthseeker_dir = _deployment_dir.parent
_repo_root_dir = _truthseeker_dir.parent
load_dotenv(_deployment_dir / ".env")
load_dotenv(_truthseeker_dir / ".env")
load_dotenv(_repo_root_dir / ".env")

# Model path: env or default relative to repo (truthseeker/model_output/final_model)
_default_model = Path(__file__).resolve().parent.parent / "model_output" / "final_model"
_model_path_raw       = os.getenv("MODEL_PATH", str(_default_model))
MODEL_PATH            = str((_deployment_dir / _model_path_raw).resolve()) if not Path(_model_path_raw).is_absolute() else _model_path_raw
_base_model_path_raw  = os.getenv("TRUTHSEEKER_BASE_MODEL_PATH") or os.getenv("BASE_MODEL_PATH")
if _base_model_path_raw and not Path(_base_model_path_raw).is_absolute():
    os.environ["TRUTHSEEKER_BASE_MODEL_PATH"] = str((_deployment_dir / _base_model_path_raw).resolve())
GOOGLE_FACT_CHECK_KEY = os.getenv("GOOGLE_FACT_CHECK_KEY")
GROQ_API_KEY          = os.getenv("GROQ_API_KEY")
GROQ_MODEL            = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
DB_PATH               = os.getenv("DB_PATH", str(Path(__file__).resolve().parent.parent / "truthseeker.db"))
INVERT_MODEL_PROBS    = os.getenv("TRUTHSEEKER_INVERT_MODEL_PROBS", "false").strip().lower() in ("1", "true", "yes", "on")

if not GROQ_API_KEY:
    print("⚠️ Warning: GROQ_API_KEY missing from environment (.env). Groq reasoning will be neutral.")

# Load model once at startup
print(f"Loading model from {MODEL_PATH}…")
try:
    engine = TruthSeekerInference(MODEL_PATH)
    print("✅ Model loaded.")
except Exception as e:
    print(f"⚠️  Model not loaded: {e} — using mock mode.")
    engine = None


# ─── Database ─────────────────────────────────────────────────────────────────

def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH, detect_types=sqlite3.PARSE_DECLTYPES)
        g.db.row_factory = sqlite3.Row
    return g.db

@app.teardown_appcontext
def close_db(error):
    db = g.pop("db", None)
    if db is not None:
        db.close()

def init_db():
    db = sqlite3.connect(DB_PATH)
    db.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS verifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            input_type TEXT,
            input_text TEXT,
            nlp_confidence INTEGER,
            api_evidence INTEGER,
            credibility_score INTEGER,
            verdict TEXT,
            reasoning TEXT,
            linguistic_flags TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS live_trends (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            topic TEXT,
            hit_count INTEGER DEFAULT 1,
            last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    for col_sql in [
        "ALTER TABLE verifications ADD COLUMN topic TEXT",
        "ALTER TABLE verifications ADD COLUMN model_score INTEGER",
        "ALTER TABLE verifications ADD COLUMN news_api_score INTEGER",
        "ALTER TABLE verifications ADD COLUMN google_fc_score INTEGER",
        "ALTER TABLE verifications ADD COLUMN groq_score INTEGER",
        "ALTER TABLE verifications ADD COLUMN groq_reasoning TEXT",
    ]:
        try:
            db.execute(col_sql + ";")
        except sqlite3.OperationalError:
            pass
    db.commit()
    db.close()

init_db()


# ─── Helpers ──────────────────────────────────────────────────────────────────

def ocr_extract(image_data: str) -> str:
    """Extract text from base64-encoded image using Tesseract."""
    if not OCR_AVAILABLE:
        return "[OCR not available — install pytesseract and tesseract-ocr]"
    try:
        img_bytes = base64.b64decode(image_data)
        img = Image.open(io.BytesIO(img_bytes))
        text = pytesseract.image_to_string(img, lang="eng")
        return text.strip()
    except Exception as e:
        return f"[OCR error: {e}]"


def api_check_gdelt(text: str) -> dict:
    """Check claims against GDELT. Returns evidence score 0-100 and related sources."""
    keywords = " ".join(text.split()[:8])
    try:
        resp = http_requests.get(
            "https://api.gdeltproject.org/api/v2/doc/doc",
            params={
                "query": keywords,
                "timespan": "30d",
                "mode": "artlist",
                "maxrecords": 10,
                "format": "json"
            },
            timeout=5,
        )
        data = resp.json()
        articles = data.get("articles", [])
        count = len(articles)
        sources = [{"title": a.get("title", "Article"), "url": a.get("url", ""), "domain": a.get("domain", "")} for a in articles[:5] if a.get("url")]
        
        score = 20
        if count >= 8: score = 100
        elif count >= 5: score = 75
        elif count >= 2: score = 55
        elif count >= 1: score = 40
        return {"score": min(100, score), "sources": sources}
    except Exception:
        return {"score": 50, "sources": []}


def mock_nlp(text: str) -> dict:
    """Mock NLP result when model not loaded (dev mode)."""
    score = min(95, max(10, 60 + len(text) % 30))
    return {
        "label": "REAL" if score > 50 else "FAKE",
        "nlp_confidence": score,
        "real_prob": score / 100,
        "fake_prob": 1 - score / 100,
        "inference_ms": 12.5,
    }

def api_check_google_fact_check(text: str) -> dict:
    """Check claims against Google Fact Check Tools API. Returns dict with score 0-100."""
    if not GOOGLE_FACT_CHECK_KEY:
        return {"found": False, "score": 50, "summary": "API key missing", "url": ""}

    query = text[:100]
    try:
        url = f"https://factchecktools.googleapis.com/v1alpha1/claims:search?query={url_quote(query)}&key={GOOGLE_FACT_CHECK_KEY}"
        resp = http_requests.get(url, timeout=5)
        data = resp.json()
        claims = data.get("claims", [])
        if not claims:
            return {"found": False, "score": 50, "summary": "No matching fact checks found.", "url": ""}

        # Analyse ratings from all returned claims
        true_keywords  = ["true", "correct", "accurate", "mostly true"]
        false_keywords = ["false", "pants on fire", "incorrect", "fake", "wrong", "misleading"]
        mixed_keywords = ["mixture", "half true", "partly", "unproven", "unverified"]

        score_sum, count = 0, 0
        for c in claims[:5]:  # cap at 5 claims
            review = c.get("claimReview", [{}])[0]
            rating = (review.get("textualRating") or "").lower()
            if any(k in rating for k in true_keywords):
                score_sum += 85
            elif any(k in rating for k in false_keywords):
                score_sum += 15
            elif any(k in rating for k in mixed_keywords):
                score_sum += 50
            else:
                score_sum += 50  # unknown rating
            count += 1

        avg_score = round(score_sum / max(count, 1))

        first_review = claims[0].get("claimReview", [{}])[0]
        publisher = first_review.get("publisher", {}).get("name", "Fact checker")
        rating_text = first_review.get("textualRating", "Unknown")

        return {
            "found": True,
            "score": avg_score,
            "summary": f"{publisher} rated this '{rating_text}'. Analysed {count} fact-check(s).",
            "url": first_review.get("url", "")
        }
    except Exception as e:
        return {"found": False, "score": 50, "summary": f"Error checking fact-check database.", "url": ""}

def detect_topic(text: str) -> str:
    text_lower = text.lower()
    
    topics = {
        "health": ["vaccine", "cure", "disease", "covid", "cancer", 
                   "drug", "medical", "virus", "health", "doctor"],
        "political": ["president", "election", "congress", "senate",
                      "government", "policy", "democrat", "republican", 
                      "minister", "parliament"],
        "finance": ["stock", "revenue", "billion", "trillion", "market",
                    "fed", "interest rate", "gdp", "economy", "shares"],
        "science": ["nasa", "research", "study", "scientists", "telescope",
                    "breakthrough", "discovery", "mit", "physics"],
        "conspiracy": ["microchip", "5g", "illuminati", "staged", "lying",
                       "coverup", "secret", "they dont want", "hidden"],
        "sports": ["championship", "goal", "match", "tournament", "player",
                   "transfer", "league", "coach", "win", "score"],
    }
    
    for topic, keywords in topics.items():
        if any(kw in text_lower for kw in keywords):
            return topic
    
    return "general"

TOPIC_PROMPTS = {
    "health": """You are a medical fact-checker. Analyze this health claim with focus on:
- Is this claim supported by WHO, CDC, or peer-reviewed research?
- Does it promote dangerous health behavior?
- Are there known scientific consensus positions that contradict this?""",

    "political": """You are a political fact-checker. Analyze this claim with focus on:
- Is this attributed to a real person or institution?
- Can this be verified through official government sources?
- Is there clear political bias or agenda in the framing?""",

    "finance": """You are a financial fact-checker. Analyze this claim with focus on:
- Are the numbers realistic and verifiable?
- Does this match known company reports or economic data?
- Could this be market manipulation or misleading financial information?""",

    "science": """You are a science fact-checker. Analyze this claim with focus on:
- Is this supported by peer-reviewed research or institutional sources?
- Does it contradict established scientific consensus?
- Are the claims exaggerated beyond what research actually shows?""",

    "conspiracy": """You are a misinformation analyst. Analyze this claim with focus on:
- Does this exhibit common conspiracy theory patterns?
- Is there verifiable evidence or only anecdotal claims?
- Does it promote distrust of legitimate institutions without evidence?""",

    "sports": """You are a sports fact-checker. Analyze this claim with focus on:
- Can this be verified through official league or team sources?
- Are the statistics or results realistic?
- Is this breaking news or a known historical fact?""",

    "general": """You are a general fact-checker. Analyze this claim with focus on:
- Is this verifiable through credible mainstream news sources?
- Are there logical inconsistencies in the claim?
- What is the most likely truth based on available evidence?"""
}

BASE_PROMPT = """
Claim: "{claim}"
Topic: {topic}

TruthSeeker ML Model: {model_score}% fake probability — {model_label}
NewsAPI Evidence Score: {news_score}%
Google Fact Check: {factcheck_result}

{topic_prompt}

Respond in this exact JSON format:
{{
  "verdict": "REAL",
  "reasoning": [
    "point 1",
    "point 2",
    "point 3"
  ],
  "confidence": 80,
  "topic": "{topic}"
}}
NOTE: The 'verdict' MUST be exactly one of: REAL, FAKE, UNVERIFIED, or NEEDS REVIEW. The reasoning should be list of strings.
"""

def build_groq_prompt(claim, topic, model_score, model_label, news_score, factcheck_result):
    return BASE_PROMPT.format(
        claim=claim,
        topic=topic,
        model_score=model_score,
        model_label=model_label,
        news_score=news_score,
        factcheck_result=factcheck_result,
        topic_prompt=TOPIC_PROMPTS[topic]
    )

def synthesize_groq(text, user_topic, ml_label, ml_conf, news_ev, fact_check):
    """Use Groq to synthesize evidence with topic detection. Returns {score, reasoning, verdict, topic}."""
    if not GROQ_API_KEY or (isinstance(GROQ_API_KEY, str) and GROQ_API_KEY.strip().lower() in ("", "your_key", "your-groq-api-key")):
        return {"score": 50, "confidence": 50, "reasoning": "Groq API key is missing or not set. Add a valid GROQ_API_KEY to your .env file.", "verdict": "UNVERIFIED", "topic": "general"}
    
    # 1. Topic resolution
    if not user_topic or user_topic.lower() == "auto":
        topic = detect_topic(text)
    else:
        topic = user_topic.lower()
        if topic not in TOPIC_PROMPTS:
            topic = "general"
            
    try:
        prompt = build_groq_prompt(
            claim=text,
            topic=topic,
            model_score=ml_conf,
            model_label=ml_label,
            news_score=news_ev,
            factcheck_result=fact_check['summary']
        )

        response = http_requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": GROQ_MODEL,
                "messages": [
                    {"role": "system", "content": "You are TruthSeeker's fact-checking reasoning layer. Respond only with valid JSON."},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.3,
                "max_tokens": 400,
                "response_format": {"type": "json_object"},
            },
            timeout=20,
        )
        response.raise_for_status()
        data = response.json()
        response_text = data.get("choices", [{}])[0].get("message", {}).get("content", "{}")
        
        try:
            parsed = json.loads(response_text)
            groq_conf = max(0, min(100, int(parsed.get("confidence", 50))))
            verdict = str(parsed.get("verdict", "UNVERIFIED")).upper()
            if verdict not in ["REAL", "FAKE", "NEEDS REVIEW"]:
                verdict = "UNVERIFIED"
                
            reasoning_list = parsed.get("reasoning", [])
            if isinstance(reasoning_list, list):
                reasoning = "\n".join(f"• {r}" for r in reasoning_list)
            else:
                reasoning = str(reasoning_list)

            # Map (verdict, confidence) -> credibility score (0-100, higher = more credible)
            if verdict == "REAL":
                groq_score = groq_conf
            elif verdict == "FAKE":
                groq_score = 100 - groq_conf
            else:
                groq_score = 50

            return {"score": groq_score, "confidence": groq_conf, "reasoning": reasoning, "verdict": verdict, "topic": topic}
        except json.JSONDecodeError:
            return {"score": 50, "confidence": 50, "reasoning": "Failed to parse Groq JSON response.", "verdict": "UNVERIFIED", "topic": topic}

    except Exception as e:
        err_str = str(e).lower()
        if "401" in err_str or "403" in err_str or "invalid api key" in err_str or "unauthorized" in err_str:
            return {"score": 50, "confidence": 50, "reasoning": "Groq API key is invalid or not allowed. Set a valid GROQ_API_KEY in your .env file.", "verdict": "UNVERIFIED", "topic": topic}
        if "429" in err_str or "rate_limit" in err_str or "quota" in err_str:
            return {"score": 50, "confidence": 50, "reasoning": "Groq quota or rate limit is exhausted for this API key/model. Check Groq Console limits or update GROQ_MODEL.", "verdict": "UNVERIFIED", "topic": topic}
        return {"score": 50, "confidence": 50, "reasoning": "Error computing reasoning via Groq. Please try again later.", "verdict": "UNVERIFIED", "topic": topic}


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return jsonify({
        "status":        "ok",
        "model_loaded":  engine is not None,
        "ocr_available": OCR_AVAILABLE,
        "gdelt":         False,
        "model_output_inverted": INVERT_MODEL_PROBS,
        "timestamp":     datetime.utcnow().isoformat(),
    })


@app.post("/api/verify")
def verify():
    """Main verification endpoint."""
    data     = request.get_json()
    text_in  = data.get("text", "").strip()
    user_topic = data.get("topic", "Auto").strip()
    image_b64 = data.get("image", "")   # base64 image
    force_refresh = bool(data.get("force_refresh", False))
    input_type = "image" if image_b64 else "text"

    # OCR if image
    if image_b64:
        text_in = ocr_extract(image_b64)

    if not text_in:
        return jsonify({"error": "No text or image provided"}), 400

    ip = request.remote_addr
    now = time.time()
    
    # ─── Simple Rate Limiting (10 requests per minute) ────────
    if ip:
        reqs = [t for t in REQUEST_COUNTS.get(ip, []) if now - t < 60]
        if len(reqs) >= 10:
            return jsonify({"error": "Rate limit exceeded. Try again in a minute."}), 429
        reqs.append(now)
        REQUEST_COUNTS[ip] = reqs

    # ─── Caching ──────────────────────────────────────────────
    text_hash = hashlib.md5(f"{text_in}:{user_topic}".encode()).hexdigest()
    if (not force_refresh) and text_hash in CACHE:
        cached_result = CACHE[text_hash].copy()
        cached_result["cached"] = True
        return jsonify(cached_result)

    # ─── NLP Inference ─────────────────────────────────────────
    t0 = time.time()
    nlp = engine.predict(text_in) if engine else mock_nlp(text_in)
    model_fake_prob = float(nlp.get("fake_prob", 0.5))
    model_real_prob = float(nlp.get("real_prob", 1 - model_fake_prob))
    if engine and INVERT_MODEL_PROBS:
        model_fake_prob, model_real_prob = model_real_prob, model_fake_prob

    # Model requirements: fake% + binary label (REAL/FAKE)
    model_fake_pct = int(round(model_fake_prob * 100))
    model_real_pct = 100 - model_fake_pct
    model_label = "FAKE" if model_fake_pct >= 50 else "REAL"
    # For final scoring we use model credibility (0-100, higher = more credible)
    model_score = model_real_pct

    # ─── External evidence APIs disabled for now ──────────────
    # GDELT and Google Fact Check are parked temporarily. Keep neutral values
    # so existing UI/database fields remain stable while scoring is model+Groq.
    # gdelt_result = api_check_gdelt(text_in)
    gdelt_result = {"score": 50, "sources": []}
    news_api_score = gdelt_result["score"]
    gdelt_sources = gdelt_result["sources"]

    # fact_check = api_check_google_fact_check(text_in)
    fact_check = {
        "found": False,
        "score": 50,
        "summary": "External fact-check APIs are disabled for now.",
        "url": "",
    }
    google_fc_score = fact_check["score"]

    # ─── Groq Reasoning + Score (50% weight) ───────────────────
    groq_result = synthesize_groq(text_in, user_topic, model_label, model_fake_pct, news_api_score, fact_check)
    groq_score = groq_result["score"]
    groq_confidence = groq_result.get("confidence", 50)
    groq_reasoning = groq_result["reasoning"]
    groq_verdict = groq_result["verdict"]
    topic_used = groq_result["topic"]

    # ─── Fixed Weights While External APIs Are Disabled ───────
    weights = {'model': 0.50, 'news': 0.00, 'factcheck': 0.00, 'groq': 0.50}

    # ─── Final Credibility Score ──────────────────────────────
    cred_score = round(
        model_score    * weights['model'] +
        news_api_score * weights['news'] +
        google_fc_score * weights['factcheck'] +
        groq_score      * weights['groq']
    )
    cred_score = max(0, min(100, cred_score))

    # 3-tier verdict: FAKE < 40, NEEDS REVIEW 40–75, REAL > 75
    if cred_score < 40:
        verdict = "FAKE"
    elif cred_score <= 75:
        verdict = "NEEDS REVIEW"
    else:
        verdict = "REAL"

    # ─── Linguistic Flags ─────────────────────────────────────
    flags = []
    tl = text_in.lower()
    if any(w in tl for w in ["shocking", "breaking", "urgent", "bombshell"]): flags.append("CLICKBAIT")
    if sum(1 for c in text_in if c.isupper()) / max(len(text_in), 1) > 0.3:  flags.append("EXCESSIVE_CAPS")
    if text_in.count("!") > 2:  flags.append("EMOTIONAL_PUNCTUATION")
    if any(w in tl for w in ["they don't want you to know", "mainstream media won't tell"]): flags.append("CONSPIRACY_LANGUAGE")

    result = {
        "credibility_score": cred_score,
        "verdict":           verdict,
        "label":             model_label,
        "topic":             topic_used,
        # Individual sub-scores
        "model_score":       model_score,
        "model_fake_pct":    model_fake_pct,
        "model_raw_fake_pct": int(round(float(nlp.get("raw_fake_prob", model_fake_prob)) * 100)),
        "model_calibration": nlp.get("calibration", []),
        "model_output_inverted": INVERT_MODEL_PROBS,
        "news_api_score":    news_api_score,
        "google_fc_score":   google_fc_score,
        "gemini_score":      groq_score,
        "gemini_verdict":    groq_verdict,
        "gemini_confidence": groq_confidence,
        "groq_score":        groq_score,
        "groq_verdict":      groq_verdict,
        "groq_confidence":   groq_confidence,
        # Details
        "fact_check":        fact_check,
        "fact_check_summary": fact_check.get("summary", ""),
        "gemini_reasoning":  groq_reasoning,
        "groq_reasoning":    groq_reasoning,
        "gdelt_sources":     gdelt_sources,
        "linguistic_flags":  flags,
        "input_type":        input_type,
        "ocr_text":          text_in if input_type == "image" else None,
        "inference_ms":      nlp.get("inference_ms", 0),
        "total_ms":          round((time.time() - t0) * 1000, 2),
    }

    # Save to local DB
    try:
        db = get_db()
        db.execute(
            """INSERT INTO verifications
               (input_type, input_text, nlp_confidence, api_evidence,
                credibility_score, verdict, reasoning, linguistic_flags, topic,
                model_score, news_api_score, google_fc_score, groq_score, groq_reasoning)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (input_type, text_in[:500], model_score, news_api_score,
             cred_score, verdict, groq_reasoning[:2000], ",".join(flags), topic_used,
             model_score, news_api_score, google_fc_score, groq_score, groq_reasoning[:5000] if groq_reasoning else None)
        )
        db.commit()
    except Exception:
        pass

    CACHE[text_hash] = result
    return jsonify(result)


@app.post("/api/register")
def register():
    from werkzeug.security import generate_password_hash
    data = request.get_json()
    username = data.get("username", "").strip()
    email    = data.get("email", "").strip()
    password = data.get("password", "")
    if not all([username, email, password]):
        return jsonify({"error": "All fields required"}), 400
    try:
        db = get_db()
        db.execute(
            "INSERT INTO users (username, email, password_hash) VALUES (?,?,?)",
            (username, email, generate_password_hash(password))
        )
        db.commit()
        token = create_access_token(identity=username)
        return jsonify({"token": token, "username": username}), 201
    except sqlite3.IntegrityError:
        return jsonify({"error": "Username or email already exists"}), 409


@app.post("/api/login")
def login():
    from werkzeug.security import check_password_hash
    data     = request.get_json()
    email    = data.get("email", "").strip()
    password = data.get("password", "")
    db       = get_db()
    user     = db.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Invalid credentials"}), 401
    token = create_access_token(identity=user["username"])
    return jsonify({"token": token, "username": user["username"], "role": user["role"]})


@app.get("/api/history")
@jwt_required()
def history():
    db   = get_db()
    rows = db.execute(
        "SELECT * FROM verifications ORDER BY created_at DESC LIMIT 50"
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.get("/api/trends")
def trends():
    db   = get_db()
    rows = db.execute(
        "SELECT verdict, COUNT(*) as count FROM verifications GROUP BY verdict"
    ).fetchall()
    return jsonify([dict(r) for r in rows])


# ─── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_ENV", "production") == "development"
    print(f"🚀 TruthSeeker API starting on port {port}")
    app.run(host="0.0.0.0", port=port, debug=debug)
