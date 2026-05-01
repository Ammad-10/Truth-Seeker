const DEFAULT_MODEL_API_URL = "http://localhost:5000";

export const MODEL_API_URL =
  (import.meta.env.VITE_MODEL_API_URL as string | undefined)?.replace(/\/$/, "") ||
  DEFAULT_MODEL_API_URL;

export type VerifyPayload = {
  headline?: string;
  text: string;
  topic?: string;
  force_refresh?: boolean;
};

export type ModelVerifyResponse = {
  credibility_score: number;
  verdict: string;
  label: string;
  topic?: string;
  model_score?: number;
  model_fake_pct?: number;
  model_output_inverted?: boolean;
  news_api_score?: number;
  google_fc_score?: number;
  gemini_score?: number;
  gemini_verdict?: string;
  gemini_confidence?: number;
  groq_score?: number;
  groq_verdict?: string;
  groq_confidence?: number;
  fact_check?: {
    found?: boolean;
    score?: number;
    summary?: string;
    url?: string;
  };
  fact_check_summary?: string;
  gemini_reasoning?: string;
  groq_reasoning?: string;
  gdelt_sources?: Array<{
    title?: string;
    url?: string;
    domain?: string;
  }>;
  linguistic_flags?: string[];
  inference_ms?: number;
  total_ms?: number;
};

export const verifyNews = async (payload: VerifyPayload): Promise<ModelVerifyResponse> => {
  const response = await fetch(`${MODEL_API_URL}/api/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Model API request failed with status ${response.status}`);
  }

  return data as ModelVerifyResponse;
};
