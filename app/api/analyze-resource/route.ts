import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { friendlyGeminiError, resolveGeminiKey, resolveModel } from "@/lib/gemini";
import { RESOURCE_ANALYSIS_PROMPT } from "@/lib/idea-gen";

export const runtime = "nodejs";
export const maxDuration = 120;

const ALLOWED = /^(application\/pdf|image\/(png|jpe?g|webp)|text\/(plain|html))$/;

export async function POST(req: Request) {
  let body: { fileData?: string; model?: string; apiKey?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const m = /^data:([^;,]+);base64,(.+)$/.exec(body.fileData ?? "");
  if (!m) return NextResponse.json({ error: "No readable file was sent." }, { status: 400 });
  if (!ALLOWED.test(m[1])) return NextResponse.json({ error: `AI analysis supports PDF, PNG/JPG and TXT/HTML files, not ${m[1]}.` }, { status: 400 });
  if (m[2].length * 0.75 > 3.2 * 1024 * 1024) {
    return NextResponse.json({ error: "That file is too large to analyze. Keep it under about 2.5 MB." }, { status: 413 });
  }
  const apiKey = resolveGeminiKey(body.apiKey);
  if (!apiKey) return NextResponse.json({ error: "AI analysis needs a Gemini API key. Add one in API & Mail Settings." }, { status: 400 });

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: resolveModel(body.model),
      contents: [{ role: "user", parts: [{ text: RESOURCE_ANALYSIS_PROMPT }, { inlineData: { mimeType: m[1], data: m[2] } }] }],
    });
    const notes = response.text?.trim();
    if (!notes) return NextResponse.json({ error: "Gemini returned no notes for that file." }, { status: 502 });
    return NextResponse.json({ notes });
  } catch (err) {
    return NextResponse.json({ error: friendlyGeminiError(err) }, { status: 502 });
  }
}
