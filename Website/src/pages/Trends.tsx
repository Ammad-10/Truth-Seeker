/**
 * Live Trends Page – Truth Seeker
 * 
 * Shows trending verification statistics, recent activity,
 * and verdict distribution across the platform.
 */

import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { motion } from "framer-motion";
import {
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  BarChart3,
  Clock,
  Activity,
  Newspaper,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import Navbar from "@/components/Navbar";

type Verification = {
  id: string;
  headline: string | null;
  credibility_score: number;
  verdict: string;
  created_at: string;
  ai_confidence: number;
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  }),
};

const verdictConfig: Record<string, { icon: LucideIcon; color: string; bg: string; label: string }> = {
  verified: { icon: CheckCircle2, color: "text-verdict-verified", bg: "bg-verdict-verified/10", label: "Verified" },
  suspicious: { icon: AlertTriangle, color: "text-verdict-suspicious", bg: "bg-verdict-suspicious/10", label: "Suspicious" },
  fake: { icon: XCircle, color: "text-verdict-fake", bg: "bg-verdict-fake/10", label: "Likely Fake" },
};

const Trends = () => {
  const [recentVerifications, setRecentVerifications] = useState<Verification[]>([]);
  const [stats, setStats] = useState({ total: 0, verified: 0, suspicious: 0, fake: 0, avgScore: 0 });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  const fetchTrends = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("verifications")
      .select("id, headline, credibility_score, verdict, created_at, ai_confidence")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) {
      const items = data as unknown as Verification[];
      setRecentVerifications(items.slice(0, 10));

      const total = items.length;
      const verified = items.filter((v) => v.verdict === "verified").length;
      const suspicious = items.filter((v) => v.verdict === "suspicious").length;
      const fake = items.filter((v) => v.verdict === "fake").length;
      const avgScore = total > 0 ? Math.round(items.reduce((a, v) => a + v.credibility_score, 0) / total) : 0;

      setStats({ total, verified, suspicious, fake, avgScore });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchTrends();
    }
  }, [fetchTrends, user]);

  const getTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="pointer-events-none fixed -top-40 left-0 h-[500px] w-[500px] rounded-full bg-primary/5 blur-3xl" />
      <div className="pointer-events-none fixed bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-accent/5 blur-3xl" />

      <main className="container mx-auto max-w-5xl px-4 py-12">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <span className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            <Activity className="h-3.5 w-3.5" />
            Live Data
          </span>
          <h1 className="font-display text-3xl font-bold">Live Trends</h1>
          <p className="mt-1 text-muted-foreground">
            Real-time verification statistics and recent activity
          </p>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mr-3" />
            Loading trends...
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Total Checks", value: stats.total, icon: BarChart3, color: "text-primary" },
                { label: "Verified", value: stats.verified, icon: CheckCircle2, color: "text-verdict-verified" },
                { label: "Suspicious", value: stats.suspicious, icon: AlertTriangle, color: "text-verdict-suspicious" },
                { label: "Likely Fake", value: stats.fake, icon: XCircle, color: "text-verdict-fake" },
              ].map((s, i) => (
                <motion.div key={s.label} initial="hidden" animate="visible" variants={fadeUp} custom={i + 1}>
                  <Card className="border-border/50 hover-lift">
                    <CardContent className="flex items-center gap-4 p-5">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-muted ${s.color}`}>
                        <s.icon className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{s.label}</p>
                        <p className="font-display text-2xl font-bold">{s.value}</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Verdict Distribution + Avg Score */}
            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={5}>
                <Card className="border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Verdict Distribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { key: "verified", label: "Verified", count: stats.verified, color: "bg-verdict-verified" },
                      { key: "suspicious", label: "Suspicious", count: stats.suspicious, color: "bg-verdict-suspicious" },
                      { key: "fake", label: "Likely Fake", count: stats.fake, color: "bg-verdict-fake" },
                    ].map((item) => {
                      const pct = stats.total > 0 ? Math.round((item.count / stats.total) * 100) : 0;
                      return (
                        <div key={item.key}>
                          <div className="mb-1.5 flex items-center justify-between text-sm">
                            <span className="font-medium">{item.label}</span>
                            <span className="text-muted-foreground">{item.count} ({pct}%)</span>
                          </div>
                          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full rounded-full ${item.color} transition-all duration-700`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={6}>
                <Card className="border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <BarChart3 className="h-5 w-5 text-primary" />
                      Average Credibility
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center justify-center py-8">
                    <div className="relative flex h-32 w-32 items-center justify-center">
                      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r="52" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
                        <circle
                          cx="60" cy="60" r="52" fill="none"
                          stroke="hsl(var(--primary))"
                          strokeWidth="10"
                          strokeDasharray={`${(stats.avgScore / 100) * 327} 327`}
                          strokeLinecap="round"
                          className="transition-all duration-1000"
                        />
                      </svg>
                      <span className="font-display text-3xl font-bold">{stats.avgScore}%</span>
                    </div>
                    <p className="mt-4 text-sm text-muted-foreground">
                      Average credibility score across all checks
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Recent Activity */}
            <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={7} className="mt-8">
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Newspaper className="h-5 w-5 text-primary" />
                    Recent Verifications
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {recentVerifications.length === 0 ? (
                    <div className="flex flex-col items-center py-12 text-center">
                      <Clock className="h-10 w-10 text-muted-foreground/40" />
                      <p className="mt-3 text-sm text-muted-foreground">No verifications yet. Be the first!</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recentVerifications.map((v) => {
                        const config = verdictConfig[v.verdict] || verdictConfig.suspicious;
                        const Icon = config.icon;
                        return (
                          <div
                            key={v.id}
                            className="flex items-center gap-4 rounded-xl border border-border/50 p-4 transition-colors hover:bg-muted/50 cursor-pointer"
                            onClick={() => navigate("/results", {
                              state: {
                                result: {
                                  credibility_score: v.credibility_score,
                                  verdict: v.verdict,
                                  ai_analysis: { confidence: v.ai_confidence, reasoning: "" },
                                  cross_reference: { score: 0, summary: "" },
                                },
                                headline: v.headline,
                                text: "",
                              },
                            })}
                          >
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${config.bg}`}>
                              <Icon className={`h-5 w-5 ${config.color}`} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-sm">
                                {v.headline || "(No headline)"}
                              </p>
                              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {getTimeAgo(v.created_at)}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge variant="secondary" className="font-display font-bold">
                                {v.credibility_score}%
                              </Badge>
                              <Badge className={`${config.bg} ${config.color} border-0`}>
                                {config.label}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </main>
    </div>
  );
};

export default Trends;
