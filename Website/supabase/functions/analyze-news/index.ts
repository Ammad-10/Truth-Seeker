/**
 * Edge Function: analyze-news
 * 
 * Core verification pipeline for Truth Seeker (Cloud deployment).
 * 
 * Credibility Score = (Model × 0.50) + (Groq × 0.50)
 * 
 * This function:
 * 1. Sends text to the TruthSeeker Flask API for fake/real classification (50%)
 * 2. Keeps external evidence APIs disabled for now
 * 3. Uses Groq for reasoning synthesis + score (50%)
 * 4. Saves everything to the verifications table
 * 5. Returns the full analysis result to the client
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type GdeltArticle = {
  title?: string;
  url?: string;
  domain?: string;
};

type GdeltResponse = {
  articles?: GdeltArticle[];
};

type FactCheckReview = {
  textualRating?: string;
  url?: string;
  publisher?: {
    name?: string;
  };
};

type FactCheckClaim = {
  claimReview?: FactCheckReview[];
};

type FactCheckResponse = {
  claims?: FactCheckClaim[];
};

// ─── Helper: GDELT API (disabled for now) ─────────────────────────────

async function crossReferenceGDELT(text: string): Promise<{ score: number; summary: string, sources: GdeltArticle[] }> {
  const keywords = text.split(/\s+/).slice(0, 8).join(" ");
  try {
    const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
    url.searchParams.append("query", keywords);
    url.searchParams.append("mode", "artlist");
    url.searchParams.append("maxrecords", "10");
    url.searchParams.append("format", "json");

    const resp = await fetch(url.toString());
    const data = await resp.json() as GdeltResponse;
    const articles = data.articles || [];
    const total = articles.length;

    let score: number;
    if (total >= 8) score = 85;
    else if (total >= 5) score = 70;
    else if (total >= 2) score = 55;
    else if (total >= 1) score = 40;
    else score = 20;

    const domains = articles.slice(0, 5).map((a) => a.domain || (a.url ? new URL(a.url).hostname : "")).filter(Boolean).join(", ");
    const sources = articles.slice(0, 5).map((a) => ({
      title: a.title || "Article",
      url: a.url || "",
      domain: a.domain || (a.url ? new URL(a.url).hostname : "")
    })).filter((s) => s.url);

    return {
      score,
      summary: total > 0
        ? `Found ${Math.min(total, 5)} related articles from: ${domains}.`
        : "No matching articles found in GDELT database.",
      sources
    };
  } catch (error) {
    return { score: 50, summary: "Error checking GDELT API.", sources: [] };
  }
}

// ─── Helper: Google Fact Check API (disabled for now) ────────────────

async function checkGoogleFactCheck(text: string): Promise<{ score: number; found: boolean; summary: string; url: string }> {
  const GOOGLE_KEY = Deno.env.get("GOOGLE_FACT_CHECK_KEY");
  if (!GOOGLE_KEY) return { score: 50, found: false, summary: "Google Fact Check API not configured.", url: "" };

  const query = text.substring(0, 100);
  try {
    const resp = await fetch(
      `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${encodeURIComponent(query)}&key=${GOOGLE_KEY}`
    );
    const data = await resp.json() as FactCheckResponse;
    const claims = data.claims || [];

    if (!claims.length) {
      return { score: 50, found: false, summary: "No matching fact checks found.", url: "" };
    }

    const trueKw = ["true", "correct", "accurate", "mostly true"];
    const falseKw = ["false", "pants on fire", "incorrect", "fake", "wrong", "misleading"];
    const mixedKw = ["mixture", "half true", "partly", "unproven", "unverified"];

    let scoreSum = 0, count = 0;
    for (const c of claims.slice(0, 5)) {
      const review = c.claimReview?.[0] || {};
      const rating = (review.textualRating || "").toLowerCase();
      if (trueKw.some((k: string) => rating.includes(k))) scoreSum += 85;
      else if (falseKw.some((k: string) => rating.includes(k))) scoreSum += 15;
      else if (mixedKw.some((k: string) => rating.includes(k))) scoreSum += 50;
      else scoreSum += 50;
      count++;
    }

    const avgScore = Math.round(scoreSum / Math.max(count, 1));
    const firstReview = claims[0].claimReview?.[0] || {};

    return {
      score: avgScore,
      found: true,
      summary: `${firstReview.publisher?.name || "Fact checker"} rated this '${firstReview.textualRating || "Unknown"}'. Analysed ${count} fact-check(s).`,
      url: firstReview.url || "",
    };
  } catch {
    return { score: 50, found: false, summary: "Error checking Google Fact Check.", url: "" };
  }
}

// ─── Shared Setup: Topics ──────────────────────────────────────────

const TOPIC_PROMPTS: Record<string, string> = {
  health: `You are a medical fact-checker. Analyze this health claim with focus on:
- Is this claim supported by WHO, CDC, or peer-reviewed research?
- Does it promote dangerous health behavior?
- Are there known scientific consensus positions that contradict this?`,
  political: `You are a political fact-checker. Analyze this claim with focus on:
- Is this attributed to a real person or institution?
- Can this be verified through official government sources?
- Is there clear political bias or agenda in the framing?`,
  finance: `You are a financial fact-checker. Analyze this claim with focus on:
- Are the numbers realistic and verifiable?
- Does this match known company reports or economic data?
- Could this be market manipulation or misleading financial information?`,
  science: `You are a science fact-checker. Analyze this claim with focus on:
- Is this supported by peer-reviewed research or institutional sources?
- Does it contradict established scientific consensus?
- Are the claims exaggerated beyond what research actually shows?`,
  conspiracy: `You are a misinformation analyst. Analyze this claim with focus on:
- Does this exhibit common conspiracy theory patterns?
- Is there verifiable evidence or only anecdotal claims?
- Does it promote distrust of legitimate institutions without evidence?`,
  sports: `You are a sports fact-checker. Analyze this claim with focus on:
- Can this be verified through official league or team sources?
- Are the statistics or results realistic?
- Is this breaking news or a known historical fact?`,
  general: `You are a general fact-checker. Analyze this claim with focus on:
- Is this verifiable through credible mainstream news sources?
- Are there logical inconsistencies in the claim?
- What is the most likely truth based on available evidence?`
};

function detectTopic(text: string): string {
  const textLower = text.toLowerCase();
  const topics: Record<string, string[]> = {
    health: ["vaccine", "cure", "disease", "covid", "cancer", "drug", "medical", "virus", "health", "doctor"],
    political: ["president", "election", "congress", "senate", "government", "policy", "democrat", "republican", "minister", "parliament"],
    finance: ["stock", "revenue", "billion", "trillion", "market", "fed", "interest rate", "gdp", "economy", "shares"],
    science: ["nasa", "research", "study", "scientists", "telescope", "breakthrough", "discovery", "mit", "physics"],
    conspiracy: ["microchip", "5g", "illuminati", "staged", "lying", "coverup", "secret", "they dont want", "hidden"],
    sports: ["championship", "goal", "match", "tournament", "player", "transfer", "league", "coach", "win", "score"]
  };

  for (const [topic, keywords] of Object.entries(topics)) {
    if (keywords.some(kw => textLower.includes(kw))) return topic;
  }
  return "general";
}

const BASE_PROMPT = `Claim: "{claim}"
Topic: {topic}

TruthSeeker ML Model: {model_score}% fake probability — {model_label}
NewsAPI Evidence Score: {news_score}%
Google Fact Check: {factcheck_result}

{topic_prompt}

Respond in this exact JSON format:
{
  "verdict": "REAL",
  "reasoning": [
    "point 1",
    "point 2",
    "point 3"
  ],
  "confidence": 80,
  "topic": "{topic}"
}
NOTE: The 'verdict' MUST be exactly one of: REAL, FAKE, UNVERIFIED, or NEEDS REVIEW. The reasoning should be list of strings.`;

// ─── Helper: Groq Reasoning + Score (50% weight) ──────────────────

async function synthesizeGroq(
  text: string, userTopic: string, mlLabel: string, mlConf: number, newsScore: number, factCheck: { summary: string }
): Promise<{ score: number; reasoning: string; verdict: string; topic: string }> {
  const GROQ_KEY = Deno.env.get("GROQ_API_KEY");
  const GROQ_MODEL = Deno.env.get("GROQ_MODEL") || "llama-3.3-70b-versatile";
  if (!GROQ_KEY) return { score: 50, reasoning: "Groq API key not configured.", verdict: "UNVERIFIED", topic: "general" };

  let topic = userTopic?.toLowerCase() || "auto";
  if (topic === "auto") {
    topic = detectTopic(text);
  } else if (!(topic in TOPIC_PROMPTS)) {
    topic = "general";
  }

  const prompt = BASE_PROMPT
    .replace(/{claim}/g, text)
    .replace(/{topic}/g, topic)
    .replace(/{model_score}/g, mlConf.toString())
    .replace(/{model_label}/g, mlLabel)
    .replace(/{news_score}/g, newsScore.toString())
    .replace(/{factcheck_result}/g, factCheck.summary)
    .replace(/{topic_prompt}/g, TOPIC_PROMPTS[topic]);

  try {
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: "You are TruthSeeker's fact-checking reasoning layer. Respond only with valid JSON." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 400,
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      throw new Error(`Groq request failed with status ${resp.status}: ${await resp.text()}`);
    }

    const data = await resp.json();
    const responseText = data.choices?.[0]?.message?.content || "{}";

    try {
      const parsed = JSON.parse(responseText);
      const score = Math.max(0, Math.min(100, parseInt(parsed.confidence) || 50));
      let verdict = String(parsed.verdict || "UNVERIFIED").toUpperCase();
      if (!["REAL", "FAKE", "NEEDS REVIEW"].includes(verdict)) verdict = "UNVERIFIED";

      let reasoning = "";
      if (Array.isArray(parsed.reasoning)) {
        reasoning = parsed.reasoning.map((r: string) => `• ${r}`).join("\n");
      } else {
        reasoning = String(parsed.reasoning || "");
      }
      return { score, reasoning, verdict, topic };
    } catch {
      return { score: 50, reasoning: "Failed to parse Groq JSON response.", verdict: "UNVERIFIED", topic };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("401") || message.includes("403") || message.includes("unauthorized")) {
      return { score: 50, reasoning: "Groq API key is invalid or not allowed. Set a valid GROQ_API_KEY.", verdict: "UNVERIFIED", topic };
    }
    if (message.includes("429") || message.includes("rate_limit") || message.includes("quota")) {
      return { score: 50, reasoning: "Groq quota or rate limit is exhausted for this API key/model. Check Groq Console limits or update GROQ_MODEL.", verdict: "UNVERIFIED", topic };
    }
    return { score: 50, reasoning: "Error getting Groq reasoning.", verdict: "UNVERIFIED", topic };
  }
}


// ─── Main Handler ─────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { headline, text, topic: userTopic } = await req.json();

    if (!text || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "No text provided for analysis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const MODEL_API_URL = Deno.env.get("MODEL_API_URL");
    if (!MODEL_API_URL) {
      throw new Error("MODEL_API_URL is not configured.");
    }

    // ─── Step 1: NLP Analysis (50% weight) ───
    const aiResponse = await fetch(`${MODEL_API_URL}/api/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `${headline ? headline + " " : ""}${text}` }),
    });

    if (!aiResponse.ok) throw new Error("Model analysis failed");
    const modelResult = await aiResponse.json();

    const classification = modelResult.label || (modelResult.verdict === "FAKE" ? "FAKE" : "REAL");
    const modelScore = modelResult.model_score ?? modelResult.nlp_confidence ?? 50;

    // ─── Step 2: External evidence APIs disabled for now ───
    // const newsResult = await crossReferenceGDELT(`${headline || ""} ${text}`.trim());
    const newsResult = {
      score: 50,
      summary: "External news APIs are disabled for now.",
      sources: [],
    };

    // const factCheckResult = await checkGoogleFactCheck(`${headline || ""} ${text}`.trim());
    const factCheckResult = {
      score: 50,
      found: false,
      summary: "External fact-check APIs are disabled for now.",
      url: "",
    };

    // ─── Step 3: Groq Reasoning + Score (50% weight) ───
    const groqResult = await synthesizeGroq(
      `${headline || ""} ${text}`.trim(), userTopic,
      classification, modelScore, newsResult.score, factCheckResult
    );

    // ─── Step 4: Calculate Credibility Score ───
    const weights = { model: 0.50, news: 0.00, factcheck: 0.00, groq: 0.50 };

    const credibilityScore = Math.max(0, Math.min(100, Math.round(
      modelScore * weights.model +
      newsResult.score * weights.news +
      factCheckResult.score * weights.factcheck +
      groqResult.score * weights.groq
    )));

    let verdict: string;
    if (credibilityScore >= 70) verdict = "verified";
    else if (credibilityScore >= 40) verdict = "suspicious";
    else verdict = "fake";

    // ─── Step 5: Save to Database ───
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);

      if (user) {
        await supabase.from("verifications").insert({
          user_id: user.id,
          headline: headline || "",
          article_text: text.substring(0, 5000),
          credibility_score: credibilityScore,
          verdict,
          topic: groqResult.topic,
          ai_confidence: modelScore,
          ai_reasoning: groqResult.reasoning.substring(0, 2000),
          source_score: newsResult.score,
          source_summary: factCheckResult.summary,
          model_score: modelScore,
          news_api_score: newsResult.score,
          google_fc_score: factCheckResult.score,
          groq_score: groqResult.score,
          groq_reasoning: groqResult.reasoning.substring(0, 2000),
          groq_verdict: groqResult.verdict,
        });
      }
    }

    // ─── Step 6: Return Result ───
    return new Response(
      JSON.stringify({
        credibility_score: credibilityScore,
        verdict,
        label: classification,
        model_score: modelScore,
        news_api_score: newsResult.score,
        google_fc_score: factCheckResult.score,
        gemini_score: groqResult.score,
        gemini_verdict: groqResult.verdict,
        groq_score: groqResult.score,
        groq_verdict: groqResult.verdict,
        topic: groqResult.topic,
        news_summary: newsResult.summary,
        gdelt_sources: newsResult.sources,
        fact_check: {
          found: factCheckResult.found,
          score: factCheckResult.score,
          summary: factCheckResult.summary,
          url: factCheckResult.url,
        },
        gemini_reasoning: groqResult.reasoning,
        groq_reasoning: groqResult.reasoning,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("analyze-news error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
