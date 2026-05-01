/**
 * News Verification Page – Truth Seeker (Core Feature)
 */

import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { motion } from "framer-motion";
import { recognize } from "tesseract.js";
import { FileText, ImageIcon, Upload, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import { MODEL_API_URL, verifyNews } from "@/lib/modelApi";

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : "Unknown error");

const getFriendlyFunctionError = (message: string) => {
  const lower = message.toLowerCase();
  if (lower.includes("failed to fetch") || lower.includes("networkerror")) {
    return `The local model API is not reachable. Start the Flask backend at ${MODEL_API_URL} and try again.`;
  }
  if (lower.includes("functionsfetcherror")) {
    return "Supabase edge functions are not deployed yet. Auth is ready, but OCR and verification are still being connected.";
  }
  if (lower.includes("model_api_url")) {
    return "The verification backend is not connected yet. Add MODEL_API_URL in Supabase secrets after the model API is deployed.";
  }
  if (lower.includes("text extraction failed")) {
    return "OCR is wired up, but the Tesseract backend is not reachable yet.";
  }
  return message;
};

const extractTextInBrowser = async (image: string) => {
  const result = await recognize(image, "eng", {
    logger: () => undefined,
  });
  return result.data.text.trim();
};

const toHistoryVerdict = (verdict: string) => {
  const normalized = verdict.toLowerCase();
  if (normalized === "real" || normalized === "verified") return "verified";
  if (normalized === "fake") return "fake";
  return "suspicious";
};

const Verify = () => {
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [mode, setMode] = useState<"text" | "image">("text");
  const [topic, setTopic] = useState("Auto"); // New Topic State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session } = useAuth();

  const functionHeaders = session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : undefined;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setExtracting(true);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });

      try {
        const { data, error } = await supabase.functions.invoke("extract-text", {
          headers: functionHeaders,
          body: { image: base64 },
        });
        if (error) throw error;
        setExtractedText(data.text || "");
        toast({ title: "Text extracted", description: "OCR completed using the server OCR pipeline." });
      } catch (serverError: unknown) {
        const browserText = await extractTextInBrowser(base64);
        setExtractedText(browserText);
        toast({
          title: "Text extracted",
          description: "Server OCR is not ready yet, so browser OCR was used instead.",
        });
        console.warn("Falling back to browser OCR:", serverError);
      }
    } catch (error: unknown) {
      toast({
        title: "Extraction failed",
        description: getFriendlyFunctionError(getErrorMessage(error)),
        variant: "destructive",
      });
    } finally {
      setExtracting(false);
    }
  };

  const handleAnalyze = async () => {
    const textToAnalyze = mode === "text" ? body : extractedText;
    const headlineToAnalyze = mode === "text" ? headline : "";

    if (!textToAnalyze.trim()) {
      toast({ title: "No text to analyze", description: "Please enter some text or upload an image first.", variant: "destructive" });
      return;
    }

    setAnalyzing(true);

    try {
      const analysisData = await verifyNews({
        headline: headlineToAnalyze,
        text: textToAnalyze,
        topic: topic || "Auto",
      });

      const result = {
        credibility_score: analysisData.credibility_score,
        verdict: analysisData.verdict,
        topic: analysisData.topic,
        model_analysis: {
          label: analysisData.label,
          score: analysisData.model_score,
          flags: analysisData.linguistic_flags || [],
        },
        news_api: {
          score: analysisData.news_api_score,
        },
        google_factcheck: {
          score: analysisData.google_fc_score,
          summary: analysisData.fact_check?.summary,
          url: analysisData.fact_check?.url,
        },
        gemini: {
          score: analysisData.gemini_score ?? analysisData.groq_score,
          reasoning: analysisData.gemini_reasoning ?? analysisData.groq_reasoning,
          verdict: analysisData.gemini_verdict ?? analysisData.groq_verdict,
        },
        gdelt_sources: analysisData.gdelt_sources || [],
      };

      if (session?.user) {
        const { error: historyError } = await supabase.from("verifications").insert({
          user_id: session.user.id,
          headline: headlineToAnalyze,
          article_text: textToAnalyze,
          credibility_score: analysisData.credibility_score,
          verdict: toHistoryVerdict(analysisData.verdict),
          ai_confidence: analysisData.model_score ?? 0,
          ai_reasoning: analysisData.gemini_reasoning ?? analysisData.groq_reasoning ?? "",
          source_score: analysisData.news_api_score ?? 0,
          source_summary: analysisData.fact_check_summary ?? analysisData.fact_check?.summary ?? "",
          topic: analysisData.topic ?? "general",
          model_score: analysisData.model_score ?? null,
          news_api_score: analysisData.news_api_score ?? null,
          google_fc_score: analysisData.google_fc_score ?? null,
          groq_score: analysisData.groq_score ?? null,
          groq_reasoning: analysisData.groq_reasoning ?? null,
          groq_verdict: analysisData.groq_verdict ?? null,
        });

        if (historyError) {
          console.warn("Could not save verification history:", historyError);
        }
      }

      navigate("/results", { state: { result, headline: headlineToAnalyze, text: textToAnalyze } });
    } catch (error: unknown) {
      toast({
        title: "Analysis failed",
        description: getFriendlyFunctionError(getErrorMessage(error)),
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Background effects */}
      <div className="pointer-events-none fixed -top-40 right-0 h-[500px] w-[500px] rounded-full bg-primary/5 blur-3xl" />

      <main className="container mx-auto max-w-3xl px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span className="mb-3 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            Verification Tool
          </span>
          <h1 className="font-display text-3xl font-bold md:text-4xl">Verify News</h1>
          <p className="mt-2 text-muted-foreground">
            Paste an article or upload an image to check its credibility.
          </p>
          <div className="mt-4 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
            Local model API: {MODEL_API_URL}
          </div>

          <Card className="mt-8 border-border/50 shadow-lg glass">
            <CardContent className="pt-6">
              <Tabs value={mode} onValueChange={(v) => setMode(v as "text" | "image")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="text" className="gap-2">
                    <FileText className="h-4 w-4" /> Text Mode
                  </TabsTrigger>
                  <TabsTrigger value="image" className="gap-2">
                    <ImageIcon className="h-4 w-4" /> Image Mode
                  </TabsTrigger>
                </TabsList>

                <div className="mt-6 space-y-2">
                  <Label htmlFor="topic">Topic Context</Label>
                  <Select value={topic} onValueChange={setTopic}>
                    <SelectTrigger id="topic" className="w-full">
                      <SelectValue placeholder="Select a topic" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Auto">Auto-detect (Recommended)</SelectItem>
                      <SelectItem value="Health">⚕️ Health & Medical</SelectItem>
                      <SelectItem value="Political">🏛️ Political</SelectItem>
                      <SelectItem value="Finance">📈 Finance & Business</SelectItem>
                      <SelectItem value="Science">🔬 Science & Technology</SelectItem>
                      <SelectItem value="Conspiracy">🕵️ Conspiracy Theories</SelectItem>
                      <SelectItem value="Sports">⚽ Sports</SelectItem>
                      <SelectItem value="General">📰 General News</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <TabsContent value="text" className="mt-6 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="headline">News Headline</Label>
                    <Input
                      id="headline"
                      placeholder="Enter the news headline..."
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="body">Article Body</Label>
                    <Textarea
                      id="body"
                      placeholder="Paste the full news article text here..."
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      className="min-h-[200px]"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="image" className="mt-6 space-y-4">
                  <div
                    className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 p-10 transition-all hover:border-primary/50 hover:bg-muted/50"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                      <Upload className="h-7 w-7 text-primary" />
                    </div>
                    <p className="mt-3 text-sm font-medium">
                      {imageFile ? imageFile.name : "Click to upload a news image"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">JPG, PNG up to 10MB</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </div>

                  {extracting && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Extracting text from image...
                    </div>
                  )}

                  {extractedText && (
                    <div className="space-y-2">
                      <Label>Extracted Text (editable)</Label>
                      <Textarea
                        value={extractedText}
                        onChange={(e) => setExtractedText(e.target.value)}
                        className="min-h-[200px]"
                        placeholder="Extracted text will appear here..."
                      />
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <Button
                className="mt-6 w-full gap-2 shadow-lg glow-primary"
                size="lg"
                onClick={handleAnalyze}
                disabled={analyzing}
              >
                {analyzing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" /> Analyzing...
                  </>
                ) : (
                  <>
                    <Search className="h-5 w-5" /> Analyze
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
};

export default Verify;
