/**
 * Results Page – Truth Seeker
 * Displays 4-axis credibility breakdown: Model, News API, Google Fact Check, Groq
 */

import { useLocation, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, XCircle, ArrowLeft, BarChart3, Brain, Globe, Newspaper, Bot, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import Navbar from "@/components/Navbar";

const CredibilityGauge = ({ score }: { score: number }) => {
  const radius = 80;
  const circumference = Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const getColor = () => {
    if (score >= 70) return "text-verdict-verified";
    if (score >= 40) return "text-verdict-suspicious";
    return "text-verdict-fake";
  };

  const getStrokeColor = () => {
    if (score >= 70) return "hsl(160, 84%, 39%)";
    if (score >= 40) return "hsl(38, 92%, 50%)";
    return "hsl(0, 72%, 51%)";
  };

  return (
    <div className="flex flex-col items-center">
      <svg width="220" height="130" viewBox="0 0 220 130">
        <path
          d="M 20 120 A 80 80 0 0 1 200 120"
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <motion.path
          d="M 20 120 A 80 80 0 0 1 200 120"
          fill="none"
          stroke={getStrokeColor()}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />
      </svg>
      <motion.p
        className={`-mt-16 font-display text-5xl font-bold ${getColor()}`}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5, type: "spring" }}
      >
        {score}%
      </motion.p>
      <p className="mt-2 text-sm text-muted-foreground">Credibility Score</p>
    </div>
  );
};

const ScoreBreakdownBar = ({ label, score, weight, delay }: { label: string; score: number; weight: string; delay: number }) => (
  <motion.div
    className="space-y-1"
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay }}
  >
    <div className="flex justify-between text-sm">
      <span className="font-medium">{label} <span className="text-muted-foreground text-xs">({weight})</span></span>
      <span className="font-semibold">{score ?? 0}%</span>
    </div>
    <Progress value={score ?? 0} className="mt-1" />
  </motion.div>
);

type GdeltSource = {
  title?: string;
  url?: string;
  domain?: string;
};

type ResultsState = {
  result?: {
    credibility_score: number;
    verdict: string;
    topic?: string;
    model_analysis?: {
      label?: string;
      score?: number;
      flags?: string[];
    };
    news_api?: {
      score?: number;
    };
    google_factcheck?: {
      score?: number;
      summary?: string;
      url?: string;
    };
    gemini?: {
      score?: number;
      reasoning?: string;
      verdict?: string;
    };
    groq?: {
      score?: number;
      reasoning?: string;
      verdict?: string;
    };
    gdelt_sources?: GdeltSource[];
    ai_analysis?: {
      confidence?: number;
      classification?: string;
      reasoning?: string;
    };
    cross_reference?: {
      score?: number;
      summary?: string;
      url?: string;
    };
  };
  headline?: string;
  text?: string;
};

const Results = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { result, headline } = (location.state as ResultsState) || {};

  if (!result) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto flex flex-col items-center justify-center px-4 py-20 text-center">
          <h2 className="font-display text-2xl font-bold">No Results Found</h2>
          <p className="mt-2 text-muted-foreground">Submit a news article for analysis first.</p>
          <Link to="/verify">
            <Button className="mt-6">Go to Verification</Button>
          </Link>
        </div>
      </div>
    );
  }

  const {
    credibility_score,
    verdict,
    topic,
    model_analysis,
    news_api,
    google_factcheck,
    gemini,
    groq,
    gdelt_sources = [],
    // Legacy fallback for old results from history
    ai_analysis,
    cross_reference,
  } = result;

  // Support both new and legacy data shapes
  const modelScore = model_analysis?.score ?? ai_analysis?.confidence ?? 0;
  const modelLabel = model_analysis?.label ?? ai_analysis?.classification ?? "UNKNOWN";
  const modelFlags = model_analysis?.flags ?? [];
  const newsScore = news_api?.score ?? cross_reference?.score ?? 0;
  const googleScore = google_factcheck?.score ?? 0;
  const googleSummary = google_factcheck?.summary ?? cross_reference?.summary ?? "";
  const googleUrl = google_factcheck?.url ?? cross_reference?.url ?? "";
  const geminiScore = gemini?.score ?? groq?.score ?? 0;
  const geminiReasoning = gemini?.reasoning ?? groq?.reasoning ?? ai_analysis?.reasoning ?? "";
  const geminiVerdict = gemini?.verdict ?? groq?.verdict ?? "UNVERIFIED";
  const topicContext = topic ?? "general";

  const getGeminiVerdictColor = (v: string) => {
    switch (v.toUpperCase()) {
      case "REAL": return "bg-green-500/10 text-green-500 border-green-500/20";
      case "FAKE": return "bg-red-500/10 text-red-500 border-red-500/20";
      default: return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    }
  };

  // 3-tier verdict: REAL / NEEDS REVIEW / FAKE (support legacy verified/suspicious)
  const verdictConfig: Record<string, { icon: LucideIcon; color: string; bg: string; border: string; label: string }> = {
    real: { icon: CheckCircle2, color: "text-verdict-verified", bg: "bg-verdict-verified/10", border: "border-verdict-verified/20", label: "REAL" },
    verified: { icon: CheckCircle2, color: "text-verdict-verified", bg: "bg-verdict-verified/10", border: "border-verdict-verified/20", label: "REAL" },
    "needs review": { icon: AlertTriangle, color: "text-verdict-suspicious", bg: "bg-verdict-suspicious/10", border: "border-verdict-suspicious/20", label: "NEEDS REVIEW" },
    suspicious: { icon: AlertTriangle, color: "text-verdict-suspicious", bg: "bg-verdict-suspicious/10", border: "border-verdict-suspicious/20", label: "NEEDS REVIEW" },
    fake: { icon: XCircle, color: "text-verdict-fake", bg: "bg-verdict-fake/10", border: "border-verdict-fake/20", label: "FAKE" },
  };

  const verdictKey = (verdict || "").toLowerCase().trim();
  const v = verdictConfig[verdictKey] || verdictConfig["needs review"];
  const VerdictIcon = v.icon;

  let weights = { model: 30, news: 20, factcheck: 20, gemini: 30 };
  switch (topicContext.toLowerCase()) {
    case 'health': weights = { model: 25, news: 20, factcheck: 30, gemini: 25 }; break;
    case 'political': weights = { model: 20, news: 25, factcheck: 25, gemini: 30 }; break;
    case 'finance': weights = { model: 35, news: 30, factcheck: 15, gemini: 20 }; break;
    case 'conspiracy': weights = { model: 30, news: 15, factcheck: 30, gemini: 25 }; break;
  }

  // Agreement Override
  if (geminiScore >= 75 && modelScore >= 75 && geminiVerdict === "REAL" && modelLabel === "REAL") {
    weights = { model: 30, news: 10, factcheck: 25, gemini: 35 };
  }

  const sourceSum = weights.news + weights.factcheck;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="pointer-events-none fixed -top-40 right-0 h-[500px] w-[500px] rounded-full bg-primary/5 blur-3xl" />

      <main className="container mx-auto max-w-3xl px-4 py-12">
        <Button variant="ghost" className="mb-6 gap-2" onClick={() => navigate("/verify")}>
          <ArrowLeft className="h-4 w-4" /> Back to Verify
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Credibility Score */}
          <Card className="overflow-hidden text-center border-border/50 shadow-lg glass">
            <CardContent className="pt-10 pb-8">
              <CredibilityGauge score={credibility_score} />
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <motion.div
                  className={`inline-flex items-center gap-2 rounded-full border px-5 py-2.5 ${v.bg} ${v.border}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.8 }}
                >
                  <VerdictIcon className={`h-5 w-5 ${v.color}`} />
                  <span className={`font-display text-lg font-bold ${v.color}`}>
                    {v.label === "FAKE" ? "❌ FAKE" : v.label === "REAL" ? "✅ REAL" : "⚠️ NEEDS REVIEW"}
                  </span>
                </motion.div>
                <span className="rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium capitalize text-muted-foreground">
                  Topic: {topicContext}
                </span>
              </div>
              {headline && (
                <p className="mt-4 text-sm text-muted-foreground italic">"{headline}"</p>
              )}

              {/* Score breakdown summary */}
              <div className="mt-8 mx-auto max-w-sm space-y-3 text-left">
                <ScoreBreakdownBar label="ML Model" score={modelScore} weight={`${weights.model}%`} delay={0.3} />
                <ScoreBreakdownBar label="News API" score={newsScore} weight={`${weights.news}%`} delay={0.4} />
                <ScoreBreakdownBar label="Google Fact Check" score={googleScore} weight={`${weights.factcheck}%`} delay={0.5} />
                <ScoreBreakdownBar label="Groq AI" score={geminiScore} weight={`${weights.gemini}%`} delay={0.6} />
              </div>
            </CardContent>
          </Card>

          {/* Detail Panels */}
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {/* Panel 1: Model Analysis (40%) */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
              <Card className="h-full border-border/50 hover-lift">
                <CardHeader className="flex flex-row items-center gap-3 pb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <Brain className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">Model Analysis <span className="text-xs text-muted-foreground font-normal">({weights.model}%)</span></CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm">
                      <span>Model Confidence</span>
                      <span className="font-semibold">{modelScore}%</span>
                    </div>
                    <Progress value={modelScore} className="mt-1.5" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Classification:</span>
                    <span className={`text-sm font-semibold ${modelLabel === "REAL" ? "text-verdict-verified" : "text-verdict-fake"}`}>
                      {modelLabel}
                    </span>
                  </div>
                  {modelFlags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {modelFlags.map((flag: string) => (
                        <span key={flag} className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                          {flag}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Panel 2: Source Verification (News API 20% + Google 20%) */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
              <Card className="h-full border-border/50 hover-lift">
                <CardHeader className="flex flex-row items-center gap-3 pb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <Globe className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">Source Verification <span className="text-xs text-muted-foreground font-normal">({sourceSum}%)</span></CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* News Database (GDELT) */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Newspaper className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium">News Database</span>
                      <span className="ml-auto text-sm font-semibold">{newsScore}%</span>
                    </div>
                    <Progress value={newsScore} className="mt-1" />
                  </div>
                  {gdelt_sources && gdelt_sources.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Related coverage found:</p>
                      <ul className="space-y-1">
                        {gdelt_sources.map((src: GdeltSource, i: number) => (
                          <li key={i} className="text-xs truncate">
                            <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline group flex items-center gap-1">
                              <span className="truncate">{src.title}</span>
                              <span className="opacity-0 group-hover:opacity-100 transition-opacity">↗</span>
                            </a>
                            <span className="text-[10px] text-muted-foreground">{src.domain}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {/* Google Fact Check */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium">Google Fact Check</span>
                      <span className="ml-auto text-sm font-semibold">{googleScore}%</span>
                    </div>
                    <Progress value={googleScore} className="mt-1" />
                  </div>
                  {googleSummary && (
                    <p className="text-sm leading-relaxed text-muted-foreground">{googleSummary}</p>
                  )}
                  {googleUrl && (
                    <a href={googleUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline mt-1 inline-block">
                      View Fact Check Source →
                    </a>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Panel 3: Groq AI Reasoning — full width */}
          <motion.div
            className="mt-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="border-border/50 hover-lift">
              <CardHeader className="flex flex-row items-center gap-3 pb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <CardTitle className="text-lg">AI Reasoning <span className="text-xs text-muted-foreground font-normal">(Groq – 30%)</span></CardTitle>
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold tracking-wide ${getGeminiVerdictColor(geminiVerdict)}`}>
                    {geminiVerdict}
                  </span>
                  <span className="rounded-full bg-secondary/50 px-2.5 py-0.5 text-xs font-medium text-secondary-foreground border">
                    {topicContext !== "general" ? `Topic: ${topicContext}` : 'Auto-detected'}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg bg-muted/30 p-4 text-sm leading-relaxed text-muted-foreground">
                  {geminiReasoning ? (
                    <ul className="list-none space-y-1.5">
                      {geminiReasoning
                        .split(/\n+/)
                        .filter((line) => line.trim())
                        .map((line, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-primary shrink-0">•</span>
                            <span>{line.replace(/^[•-]\s*/, "").trim()}</span>
                          </li>
                        ))}
                    </ul>
                  ) : (
                    "No AI reasoning available."
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Actions */}
          <div className="mt-8 flex gap-4">
            <Link to="/verify" className="flex-1">
              <Button variant="outline" className="w-full">Verify Another</Button>
            </Link>
            <Link to="/history" className="flex-1">
              <Button className="w-full gap-2">
                <BarChart3 className="h-4 w-4" /> View History
              </Button>
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default Results;
