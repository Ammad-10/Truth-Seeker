/**
 * Edge Function: extract-text
 * 
 * Extracts text from uploaded news images by forwarding
 * to the TruthSeeker Flask API (which uses Tesseract OCR).
 * 
 * The client sends a base64-encoded image, and this function
 * forwards it to the backend for OCR processing.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image } = await req.json();

    if (!image) {
      return new Response(
        JSON.stringify({ error: "No image provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const MODEL_API_URL = Deno.env.get("MODEL_API_URL");
    if (!MODEL_API_URL) {
      throw new Error("MODEL_API_URL is not configured. Set it to your TruthSeeker Flask API URL.");
    }

    // Forward image to TruthSeeker Flask API for OCR + verification
    const response = await fetch(`${MODEL_API_URL}/api/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image }),
    });

    if (!response.ok) {
      throw new Error("Text extraction failed");
    }

    const data = await response.json();
    const extractedText = data.ocr_text || "";

    return new Response(
      JSON.stringify({ text: extractedText }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("extract-text error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
