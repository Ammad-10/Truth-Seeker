"""
TruthSeeker — Inference Engine
================================
Loads the trained DistilBERT+LoRA model and produces:
  • binary label (REAL / FAKE)
  • NLP confidence score (0-100)
  • Final credibility score formula: (NLP×0.4) + (API×0.6)

Usage:
  from inference import TruthSeekerInference
  engine = TruthSeekerInference("./model_output/final_model")
  result = engine.predict("Breaking: Scientists discover...")
"""

import json
import os
import re
import time
from pathlib import Path

import torch
import numpy as np
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from peft import PeftModel


class TruthSeekerInference:
    def __init__(self, model_path: str, device: str = None, base_model_path: str = None,
                 fake_threshold: float = 0.60,
                 review_low: float = 0.30, review_high: float = 0.75):
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.model_path = Path(model_path)
        self.base_model_path = Path(base_model_path) if base_model_path else None
        self.fake_threshold = fake_threshold
        self.review_low = review_low      # below this = REAL
        self.review_high = review_high    # above this = FAKE, between = NEEDS REVIEW

        # Load metadata
        meta_file = self.model_path / "model_meta.json"
        if meta_file.exists():
            with open(meta_file) as f:
                self.meta = json.load(f)
        else:
            self.meta = {"max_length": 512, "id2label": {"0": "FAKE", "1": "REAL"}}

        self.max_length = self.meta.get("max_length", 512)
        self.id2label   = {int(k): v for k, v in self.meta.get("id2label", {"0":"FAKE","1":"REAL"}).items()}

        # Load tokenizer & model
        self.tokenizer = AutoTokenizer.from_pretrained(str(self.model_path))

        # Handle LoRA adapter models
        is_lora = self.meta.get("lora", False)
        if is_lora:
            base_model_name = self.meta.get("model", "distilbert-base-uncased")
            base_model_path = self._resolve_base_model_path(base_model_name)
            local_base = Path(base_model_path).exists()
            base_model = AutoModelForSequenceClassification.from_pretrained(
                base_model_path, num_labels=2, id2label=self.id2label,
                label2id={v: k for k, v in self.id2label.items()},
                local_files_only=local_base,
            )
            self.model = PeftModel.from_pretrained(base_model, str(self.model_path), local_files_only=True)
        else:
            self.model = AutoModelForSequenceClassification.from_pretrained(str(self.model_path))

        self.model.to(self.device)
        self.model.eval()

    def _resolve_base_model_path(self, base_model_name: str) -> str:
        """Prefer a local base model copy so LoRA inference can run offline."""
        candidates = []
        if self.base_model_path:
            candidates.append(self.base_model_path)

        env_path = os.getenv("TRUTHSEEKER_BASE_MODEL_PATH") or os.getenv("BASE_MODEL_PATH")
        if env_path:
            candidates.append(Path(env_path))

        package_root = Path(__file__).resolve().parents[1]
        candidates.append(package_root / "model_output" / "base_models" / base_model_name)

        for candidate in candidates:
            if (candidate / "config.json").exists() and (
                (candidate / "model.safetensors").exists() or (candidate / "pytorch_model.bin").exists()
            ):
                return str(candidate)

        return base_model_name

    def _clean(self, text: str) -> str:
        text = re.sub(r"http\S+|www\S+", " ", text)
        text = re.sub(r"<[^>]+>", " ", text)
        text = re.sub(r"\s+", " ", text).strip().lower()
        return text

    def _calibrate_probs(self, original_text: str, fake_prob: float, real_prob: float) -> tuple[float, float, list]:
        """
        The fine-tuned model was trained mostly on article-style text, so raw softmax
        can be too confident on short claims. Calibrate short/sensational inputs
        toward review instead of letting them become fake=0 or real=100.
        """
        notes = []
        text = original_text or ""
        text_lower = text.lower()
        words = re.findall(r"\b[\w']+\b", text_lower)
        word_count = len(words)

        if word_count < 120:
            # Keep some model signal, but reduce extreme confidence on inputs that
            # are much shorter than the training articles.
            length_factor = max(0.25, word_count / 120)
            fake_prob = 0.5 + (fake_prob - 0.5) * length_factor
            notes.append("SHORT_TEXT_CALIBRATION")

        risk = 0.0
        if any(w in text_lower for w in ["shocking", "breaking", "urgent", "bombshell"]):
            risk += 0.10
        if text.count("!") > 2:
            risk += 0.10
        if sum(1 for c in text if c.isupper()) / max(len(text), 1) > 0.30:
            risk += 0.08
        if any(p in text_lower for p in [
            "they don't want you to know",
            "doctors don't want you to know",
            "doctors do not want you to know",
            "mainstream media won't tell",
            "secret cure",
            "miracle cure",
        ]):
            risk += 0.18

        if risk > 0:
            fake_prob = max(fake_prob, min(0.85, 0.35 + risk))
            notes.append("LINGUISTIC_RISK_CALIBRATION")

        fake_prob = max(0.0, min(1.0, fake_prob))
        real_prob = 1.0 - fake_prob
        return fake_prob, real_prob, notes

    def _classify(self, fake_prob: float, real_prob: float):
        """3-tier classification: REAL / NEEDS REVIEW / FAKE"""
        if fake_prob >= self.review_high:
            return "FAKE", fake_prob
        elif fake_prob >= self.review_low:
            return "NEEDS REVIEW", max(fake_prob, real_prob)
        else:
            return "REAL", real_prob

    @torch.no_grad()
    def predict(self, text: str) -> dict:
        """
        Returns:
          label           : "REAL", "NEEDS REVIEW", or "FAKE"
          nlp_confidence  : int 0-100 (model confidence in its label)
          real_prob       : float (raw probability of REAL)
          fake_prob       : float (raw probability of FAKE)
          inference_ms    : float (latency)
        """
        t0 = time.time()
        cleaned = self._clean(text)

        inputs = self.tokenizer(
            cleaned,
            return_tensors="pt",
            truncation=True,
            max_length=self.max_length,
            padding=True,
        ).to(self.device)

        outputs       = self.model(**inputs)
        probs         = torch.softmax(outputs.logits, dim=-1).cpu().numpy()[0]
        raw_fake_prob = float(probs[0])
        raw_real_prob = float(probs[1]) if len(probs) > 1 else float(1 - probs[0])
        fake_prob, real_prob, calibration_notes = self._calibrate_probs(text, raw_fake_prob, raw_real_prob)

        label, confidence = self._classify(fake_prob, real_prob)
        latency = (time.time() - t0) * 1000

        return {
            "label":          label,
            "nlp_confidence": round(confidence * 100),
            "real_prob":      real_prob,
            "fake_prob":      fake_prob,
            "raw_real_prob":  raw_real_prob,
            "raw_fake_prob":  raw_fake_prob,
            "calibration":    calibration_notes,
            "inference_ms":   round(latency, 2),
        }

    def credibility_score(self, nlp_confidence: int, api_evidence: int) -> int:
        """
        Official TruthSeeker formula:
          Score = (NLP_Confidence × 0.4) + (API_Evidence × 0.6)
        """
        return round(nlp_confidence * 0.4 + api_evidence * 0.6)

    def verdict(self, score: int) -> str:
        if score >= 70:  return "VERIFIED"
        if score >= 40:  return "SUSPICIOUS"
        return "FAKE"

    def batch_predict(self, texts: list, batch_size: int = 32) -> list:
        """Run inference on a list of texts efficiently."""
        results = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            cleaned = [self._clean(t) for t in batch]
            inputs  = self.tokenizer(
                cleaned,
                return_tensors="pt",
                truncation=True,
                max_length=self.max_length,
                padding=True,
            ).to(self.device)
            with torch.no_grad():
                outputs = self.model(**inputs)
            probs = torch.softmax(outputs.logits, dim=-1).cpu().numpy()
            for j, p in enumerate(probs):
                fake_prob = float(p[0])
                if fake_prob >= self.fake_threshold:
                    label = "FAKE"
                    conf = fake_prob
                else:
                    label = "REAL"
                    conf = float(p[1]) if len(p) > 1 else 1 - fake_prob
                results.append({
                    "text":           batch[j][:80],
                    "label":          label,
                    "nlp_confidence": round(conf * 100),
                })
        return results
