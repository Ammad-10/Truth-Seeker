/**
 * Landing Page – Truth Seeker
 * 
 * Premium landing page with:
 * - Animated hero with gradient accents
 * - 3-step "How It Works" flow
 * - Verdict type cards
 * - Statistics section
 * - Polished footer
 */

import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, Search, BarChart3, Upload, Brain, CheckCircle2, AlertTriangle, XCircle, ArrowRight, Zap, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/ThemeProvider";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.6, ease: "easeOut" as const },
  }),
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const Index = () => {
  const { theme, toggleTheme } = useTheme();
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* ─── Navbar ─── */}
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary glow-primary">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold tracking-tight">
              Truth Seeker
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/about">
              <Button variant="ghost" size="sm">About</Button>
            </Link>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleTheme}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Link to="/auth">
              <Button variant="outline" size="sm">Log In</Button>
            </Link>
            <Link to="/auth?signup=true">
              <Button size="sm" className="gap-1.5">
                Get Started <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative py-28 md:py-40">
        {/* Background effects */}
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[700px] w-[700px] -translate-x-1/2 rounded-full bg-primary/8 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-0 h-[500px] w-[500px] rounded-full bg-accent/8 blur-3xl" />
        <div className="pointer-events-none absolute top-20 left-10 h-[300px] w-[300px] rounded-full bg-primary/5 blur-3xl" />

        <div className="container relative mx-auto px-4 text-center">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
              <Zap className="h-3.5 w-3.5" />
              AI-Powered Fake News Detection
            </span>
          </motion.div>

          <motion.h1
            className="mx-auto mt-6 max-w-4xl font-display text-5xl font-bold leading-[1.1] tracking-tight md:text-7xl"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={1}
          >
            Don't Get Fooled.{" "}
            <span className="gradient-text">Verify the Truth.</span>
          </motion.h1>

          <motion.p
            className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground md:text-xl"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={2}
          >
            Paste any news article or upload an image — our AI analyzes
            linguistic patterns and cross-references trusted sources to give you
            a credibility score in seconds.
          </motion.p>

          <motion.div
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={3}
          >
            <Link to="/verify">
              <Button size="lg" className="gap-2 text-base shadow-lg glow-primary">
                <Search className="h-5 w-5" /> Try Now — It's Free
              </Button>
            </Link>
            <Link to="/auth?signup=true">
              <Button size="lg" variant="outline" className="text-base">
                Create Account
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="relative border-t border-border/50 bg-card/50 py-24">
        <div className="container mx-auto px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="text-center"
          >
            <span className="mb-3 inline-block rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Simple Process
            </span>
            <h2 className="font-display text-3xl font-bold md:text-4xl">
              How It Works
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
              Three simple steps to verify any piece of news
            </p>
          </motion.div>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {[
              {
                icon: Upload,
                title: "1. Input",
                desc: "Paste a news headline and article body, or upload an image of the news. We'll extract the text for you.",
              },
              {
                icon: Brain,
                title: "2. Analysis",
                desc: "Our AI examines linguistic cues, sentiment, and writing patterns to classify the content as real or fake.",
              },
              {
                icon: BarChart3,
                title: "3. Score",
                desc: "Receive a credibility score combining AI confidence with cross-referenced sources. See a clear verdict.",
              },
            ].map((step, i) => (
              <motion.div
                key={step.title}
                className="group relative rounded-2xl border border-border/50 bg-background p-8 text-center hover-lift"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={fadeUp}
                custom={i}
              >
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground group-hover:scale-110">
                  <step.icon className="h-7 w-7" />
                </div>
                <h3 className="font-display text-xl font-semibold">{step.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {step.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Verdict Types ─── */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="text-center"
          >
            <h2 className="font-display text-3xl font-bold md:text-4xl">
              Clear Verdicts You Can Trust
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
              Every analysis ends with a clear, actionable verdict
            </p>
          </motion.div>

          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: CheckCircle2,
                label: "Verified",
                color: "text-verdict-verified",
                bg: "bg-verdict-verified/10",
                borderColor: "border-verdict-verified/20",
                desc: "High confidence the news is accurate and corroborated by trusted sources.",
              },
              {
                icon: AlertTriangle,
                label: "Suspicious",
                color: "text-verdict-suspicious",
                bg: "bg-verdict-suspicious/10",
                borderColor: "border-verdict-suspicious/20",
                desc: "Mixed signals — some red flags detected. Proceed with caution and verify independently.",
              },
              {
                icon: XCircle,
                label: "Likely Fake",
                color: "text-verdict-fake",
                bg: "bg-verdict-fake/10",
                borderColor: "border-verdict-fake/20",
                desc: "Strong indicators of fabricated content. Linguistic patterns and sources suggest misinformation.",
              },
            ].map((v, i) => (
              <motion.div
                key={v.label}
                className={`rounded-2xl border ${v.borderColor} p-8 ${v.bg} hover-lift`}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={fadeUp}
                custom={i}
              >
                <v.icon className={`h-10 w-10 ${v.color}`} />
                <h3 className={`mt-4 font-display text-xl font-bold ${v.color}`}>
                  {v.label}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{v.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Stats ─── */}
      <section className="relative border-t border-border/50 bg-card/50 py-24">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
          >
            <h2 className="font-display text-3xl font-bold md:text-4xl">
              Why This Matters
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
              Misinformation is one of the biggest challenges of our time
            </p>
          </motion.div>

          <div className="mx-auto mt-14 grid max-w-3xl gap-8 md:grid-cols-3">
            {[
              { stat: "86%", label: "of internet users have been exposed to fake news" },
              { stat: "6×", label: "faster fake news spreads compared to real news" },
              { stat: "$78B", label: "annual economic cost of misinformation globally" },
            ].map((s, i) => (
              <motion.div
                key={s.stat}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i + 1}
                className="group"
              >
                <p className="font-display text-5xl font-bold gradient-text md:text-6xl">{s.stat}</p>
                <p className="mt-3 text-sm text-muted-foreground">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <motion.div
            className="relative overflow-hidden rounded-3xl bg-primary p-12 text-center md:p-20"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
          >
            <div className="pointer-events-none absolute -top-20 -right-20 h-[300px] w-[300px] rounded-full bg-primary-foreground/10 blur-3xl" />
            <h2 className="relative font-display text-3xl font-bold text-primary-foreground md:text-4xl">
              Ready to Fight Misinformation?
            </h2>
            <p className="relative mx-auto mt-4 max-w-md text-primary-foreground/80">
              Join thousands of users who verify news before sharing. It takes seconds.
            </p>
            <div className="relative mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link to="/verify">
                <Button size="lg" variant="secondary" className="gap-2 text-base font-semibold">
                  <Search className="h-5 w-5" /> Start Verifying
                </Button>
              </Link>
              <Link to="/auth?signup=true">
                <Button size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 text-base">
                  Create Free Account
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border/50 py-10">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 md:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
              <Shield className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display text-sm font-semibold">Truth Seeker</span>
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link to="/about" className="hover:text-foreground transition-colors">About</Link>
            <Link to="/verify" className="hover:text-foreground transition-colors">Verify News</Link>
            <Link to="/auth" className="hover:text-foreground transition-colors">Sign In</Link>
          </div>
          <p className="text-xs text-muted-foreground">© 2026 Truth Seeker. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
