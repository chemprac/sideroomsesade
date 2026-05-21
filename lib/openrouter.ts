import OpenAI from "openai";

export const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

export const MODEL = "anthropic/claude-sonnet-4-6";

export class OpenRouterError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = "OpenRouterError";
  }
}

export async function chatJson(
  system: string,
  user: string,
  maxTokens = 4096
): Promise<string> {
  try {
    const response = await openrouter.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.4,
      max_tokens: maxTokens,
    });
    return response.choices[0]?.message?.content ?? "";
  } catch (err: unknown) {
    const status =
      err && typeof err === "object" && "status" in err
        ? (err as { status: number }).status
        : undefined;
    const message =
      err && typeof err === "object" && "message" in err
        ? String((err as { message: string }).message)
        : "OpenRouter request failed";
    throw new OpenRouterError(message, status);
  }
}

export function parseJson<T>(raw: string): T | null {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [
    null,
    trimmed,
  ];
  const candidate = (jsonMatch[1] ?? trimmed).trim();
  try {
    return JSON.parse(candidate) as T;
  } catch {
    return null;
  }
}
