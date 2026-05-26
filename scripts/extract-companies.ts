/**
 * Extract company + title from bio_summary for attendees with company = 'None'.
 * Run: npx ts-node --project scripts/tsconfig.json scripts/extract-companies.ts
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const MODEL = "anthropic/claude-sonnet-4-5";
const EVENT_SLUG = "esade-2026";
const DELAY_MS = 500;

function loadEnvLocal(): void {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    console.error("Missing .env.local");
    process.exit(1);
  }
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseJson<T>(raw: string): T | null {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (jsonMatch?.[1] ?? trimmed).trim();
  try {
    return JSON.parse(candidate) as T;
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface ExtractResult {
  company: string | null;
  title: string | null;
}

async function main() {
  loadEnvLocal();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openRouterKey = process.env.OPENROUTER_API_KEY;

  if (!supabaseUrl || !serviceKey || !openRouterKey) {
    console.error(
      "Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENROUTER_API_KEY in .env.local"
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const openrouter = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: openRouterKey,
  });

  const { data: attendees, error } = await supabase
    .from("attendees")
    .select("id, name, bio_summary, title, company")
    .eq("event_slug", EVENT_SLUG)
    .eq("company", "None")
    .not("bio_summary", "is", null);

  if (error) {
    console.error("Query failed:", error.message);
    process.exit(1);
  }

  const rows = (attendees ?? []).filter(
    (a) => a.bio_summary && String(a.bio_summary).trim()
  );

  console.log(`Found ${rows.length} attendees with company = 'None' and a bio.\n`);

  let updated = 0;
  let notFound = 0;

  for (let i = 0; i < rows.length; i++) {
    const attendee = rows[i];
    const bio = String(attendee.bio_summary).trim();

    const userPrompt = `Extract the current company and job title from this bio. 
Return ONLY valid JSON: {"company": "...", "title": "..."}
If you cannot determine, return {"company": null, "title": null}

Bio: ${bio}`;

    let extracted: ExtractResult | null = null;

    try {
      const response = await openrouter.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: "system",
            content: "You return only valid JSON. No markdown.",
          },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 256,
      });

      const raw = response.choices[0]?.message?.content ?? "";
      extracted = parseJson<ExtractResult>(raw);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`✗ ${attendee.name} → error: ${msg}`);
      notFound++;
      if (i < rows.length - 1) await sleep(DELAY_MS);
      continue;
    }

    const company =
      extracted?.company && String(extracted.company).trim()
        ? String(extracted.company).trim()
        : null;
    const title =
      extracted?.title && String(extracted.title).trim()
        ? String(extracted.title).trim()
        : null;

    if (!company) {
      console.log(`✗ ${attendee.name} → not found`);
      notFound++;
    } else {
      const payload: { company: string; title?: string } = { company };
      if (title) payload.title = title;

      const { error: updateError } = await supabase
        .from("attendees")
        .update(payload)
        .eq("id", attendee.id);

      if (updateError) {
        console.log(`✗ ${attendee.name} → update failed: ${updateError.message}`);
        notFound++;
      } else {
        console.log(
          `✓ ${attendee.name} → ${company} / ${title ?? attendee.title ?? "—"}`
        );
        updated++;
      }
    }

    if (i < rows.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\nDone. Updated: ${updated} · Not found: ${notFound}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
