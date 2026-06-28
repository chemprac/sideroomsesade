# Sideroom — Project Context

## Shared context (auto-loaded from Obsidian vault)

@~/Documents/angkan-brain/_claude-context/master-context.md
@~/Documents/angkan-brain/_claude-context/sideroom-context.md
@~/Documents/angkan-brain/01-sideroom/app-overview.md
@~/Documents/angkan-brain/01-sideroom/tech-stack.md
@~/Documents/angkan-brain/01-sideroom/decisions-log.md
@~/Documents/angkan-brain/01-sideroom/roadmap.md

## Rules for this project
- Deliver all output as Cursor prompts, not raw code
- Default enrichment model: Gemini 2.0/2.5 Flash (never Opus)
- max_tokens: 8000 in match-engine.ts
- Batch size: 30 attendees per scoring call
