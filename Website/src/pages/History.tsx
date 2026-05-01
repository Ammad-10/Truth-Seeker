/**
 * Verification History Dashboard – Truth Seeker
 */

import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, XCircle, Search, Filter, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";

type Verification = {
  id: string;
  headline: string;
  credibility_score: number;
  verdict: string;
  created_at: string;
  ai_confidence: number;
  source_score: number;
  ai_reasoning: string;
  source_summary: string;
  article_text: string;
};

const verdictIcons: Record<string, LucideIcon> = {
  verified: CheckCircle2,
  suspicious: AlertTriangle,
  fake: XCircle,
};

const verdictColors: Record<string, string> = {
  verified: "text-verdict-verified",
  suspicious: "text-verdict-suspicious",
  fake: "text-verdict-fake",
};

const History = () => {
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchHistory = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase
      .from("verifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (filter !== "all") {
      query = query.eq("verdict", filter);
    }

    const { data, error } = await query;
    if (error) {
      toast({ title: "Supabase fetch error", description: error.message, variant: "destructive" });
      console.error("Supabase fetch error:", error);
    }
    if (data) {
      setVerifications(data as unknown as Verification[]);
    }
    setLoading(false);
  }, [filter, toast, user]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleRowClick = (v: Verification) => {
    navigate("/results", {
      state: {
        result: {
          credibility_score: v.credibility_score,
          verdict: v.verdict,
          ai_analysis: { confidence: v.ai_confidence, reasoning: v.ai_reasoning },
          cross_reference: { score: v.source_score, summary: v.source_summary },
        },
        headline: v.headline,
        text: v.article_text,
      },
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="pointer-events-none fixed -top-40 right-0 h-[500px] w-[500px] rounded-full bg-primary/5 blur-3xl" />

      <main className="container mx-auto max-w-4xl px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="mb-2 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                Dashboard
              </span>
              <h1 className="font-display text-3xl font-bold">Verification History</h1>
              <p className="mt-1 text-muted-foreground">Your past news verifications</p>
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[160px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="suspicious">Suspicious</SelectItem>
                <SelectItem value="fake">Likely Fake</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card className="mt-8 border-border/50 shadow-lg overflow-hidden">
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mr-3" />
                  Loading...
                </div>
              ) : verifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                    <Search className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <p className="mt-4 font-medium">No verifications yet.</p>
                  <p className="mt-1 text-sm text-muted-foreground">Start by verifying your first article</p>
                  <Button className="mt-6" onClick={() => navigate("/verify")}>
                    Verify Your First Article
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Headline</TableHead>
                      <TableHead className="text-center">Score</TableHead>
                      <TableHead className="text-center">Verdict</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {verifications.map((v) => {
                      const Icon = verdictIcons[v.verdict] || AlertTriangle;
                      return (
                        <TableRow
                          key={v.id}
                          className="cursor-pointer transition-colors hover:bg-muted/50"
                          onClick={() => handleRowClick(v)}
                        >
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {new Date(v.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="max-w-[300px] truncate font-medium">
                            {v.headline || "(No headline)"}
                          </TableCell>
                          <TableCell className="text-center font-display font-bold">
                            {v.credibility_score}%
                          </TableCell>
                          <TableCell className="text-center">
                            <div className={`inline-flex items-center gap-1.5 ${verdictColors[v.verdict]}`}>
                              <Icon className="h-4 w-4" />
                              <span className="text-sm font-medium capitalize">
                                {v.verdict === "fake" ? "Likely Fake" : v.verdict}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
};

export default History;
