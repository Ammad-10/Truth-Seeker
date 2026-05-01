/**
 * About Page – Truth Seeker
 * 
 * Public-facing information about the project:
 * - How the platform works
 * - Mission and values
 * - Team credits
 */

import { motion } from "framer-motion";
import { Shield, Brain, Users, Sparkles, Eye, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Navbar from "@/components/Navbar";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  }),
};

const About = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto max-w-3xl px-4 py-12">
        {/* Decorative background */}
        <div className="pointer-events-none fixed -top-40 right-0 h-[500px] w-[500px] rounded-full bg-primary/5 blur-3xl" />
        <div className="pointer-events-none fixed bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-accent/5 blur-3xl" />

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative">
          <span className="mb-4 inline-block rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            About Us
          </span>
          <h1 className="font-display text-3xl font-bold md:text-4xl">About Truth Seeker</h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Combating misinformation with AI-powered analysis and source cross-referencing.
          </p>
        </motion.div>

        <div className="relative mt-10 space-y-6">
          {/* Our Mission */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <Card className="overflow-hidden border-border/50 bg-card/80 backdrop-blur-sm transition-shadow hover:shadow-lg">
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <CardTitle>Our Mission</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <p>
                  In an era where misinformation spreads six times faster than the truth, we believe
                  everyone deserves access to tools that help distinguish fact from fiction.
                </p>
                <p>
                  Truth Seeker was built to empower individuals, journalists, and organizations
                  to quickly verify the credibility of news content before sharing it further.
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* How It Works */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}>
            <Card className="overflow-hidden border-border/50 bg-card/80 backdrop-blur-sm transition-shadow hover:shadow-lg">
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Brain className="h-5 w-5 text-primary" />
                </div>
                <CardTitle>How It Works</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <p>
                  Truth Seeker uses a multi-layered approach to verify news. Our AI engine analyzes
                  linguistic patterns, sentiment, writing style, and structural cues commonly found
                  in fabricated content.
                </p>
                <p>
                  The system looks for sensationalist language, emotional manipulation, lack of
                  attributed sources, and inconsistencies in writing quality — all indicators that
                  research has linked to misinformation.
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Privacy & Security */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={2}>
            <Card className="overflow-hidden border-border/50 bg-card/80 backdrop-blur-sm transition-shadow hover:shadow-lg">
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Lock className="h-5 w-5 text-primary" />
                </div>
                <CardTitle>Privacy & Security</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <p>
                  Your submitted articles are analyzed in real-time and only stored in your personal
                  verification history. We never share your data with third parties.
                </p>
                <p>
                  All communication is encrypted, and your account is protected with secure
                  authentication. You can delete your verification history at any time.
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Team */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={3}>
            <Card className="overflow-hidden border-border/50 bg-card/80 backdrop-blur-sm transition-shadow hover:shadow-lg">
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <CardTitle>Team</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground leading-relaxed">
                <p>
                  Built as part of a capstone project on combating misinformation using NLP and AI
                  technologies. Our team is passionate about making the internet a more trustworthy place.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default About;
