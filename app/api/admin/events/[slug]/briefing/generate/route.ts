import { NextRequest } from "next/server";
import { verifyAdminSecret, unauthorizedResponse } from "@/lib/admin-auth";
import { generateEventBriefing } from "@/lib/briefing-generate";
import { createServerClient } from "@/lib/supabase";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!verifyAdminSecret(request)) return unauthorizedResponse();

  const { slug } = await params;
  const force = new URL(request.url).searchParams.get("force") === "true";

  const supabase = createServerClient();

  if (!force) {
    const { data: cached } = await supabase
      .from("event_briefings")
      .select("*")
      .eq("event_slug", slug)
      .maybeSingle();

    if (cached?.themes?.length) {
      const stream = new ReadableStream({
        start(controller) {
          const enc = new TextEncoder();
          controller.enqueue(
            enc.encode(`data: ${JSON.stringify({ log: "Using cached briefing." })}\n\n`)
          );
          controller.enqueue(
            enc.encode(
              `data: ${JSON.stringify({ done: true, briefing: cached })}\n\n`
            )
          );
          controller.close();
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (obj: object) => {
        controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      try {
        const briefing = await generateEventBriefing(supabase, slug, (msg) =>
          send({ log: msg })
        );
        send({ done: true, briefing });
      } catch (err) {
        send({
          log: `✗ ${err instanceof Error ? err.message : "Generation failed"}`,
          error: true,
        });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
