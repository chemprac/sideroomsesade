const SKIP_SINGLE_NAMES = new Set([
  "daniel",
  "simon",
  "patrik",
  "roman",
  "debbie",
]);

export interface CsvAttendeeRow {
  name: string;
  company: string;
  linkedin: string;
  notes: string;
}

export function fixEncoding(text: string): string {
  if (!text) return text;

  try {
    const bytes = Uint8Array.from(text, (c) => c.charCodeAt(0) & 0xff);
    const decoded = new TextDecoder("utf-8").decode(bytes);
    if (!decoded.includes("Ã") && !decoded.includes("â")) return decoded;
  } catch {
    /* fall through */
  }

  return text
    .replace(/Ã©/g, "é")
    .replace(/Ã¨/g, "è")
    .replace(/Ã¡/g, "á")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ãº/g, "ú")
    .replace(/Ã±/g, "ñ")
    .replace(/Ã¤/g, "ä")
    .replace(/Ã¶/g, "ö")
    .replace(/Ã¼/g, "ü")
    .replace(/Ã§/g, "ç")
    .replace(/Ã /g, "à")
    .replace(/â€™/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€/g, '"')
    .replace(/Â/g, "");
}

export function parseCsvContent(raw: string): CsvAttendeeRow[] {
  const text = fixEncoding(raw).replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) =>
    fixEncoding(h).trim().toLowerCase()
  );

  const nameIdx = headers.findIndex((h) => h === "name");
  const companyIdx = headers.findIndex((h) => h === "company");
  const linkedinIdx = headers.findIndex(
    (h) => h === "linkedin" || h === "linkedin url"
  );
  const notesIdx = headers.findIndex((h) => h === "notes");

  if (nameIdx === -1) return [];

  const rows: CsvAttendeeRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    rows.push({
      name: fixEncoding(cols[nameIdx] ?? "").trim(),
      company: fixEncoding(cols[companyIdx] ?? "").trim(),
      linkedin: fixEncoding(cols[linkedinIdx] ?? "").trim(),
      notes: fixEncoding(cols[notesIdx] ?? "").trim(),
    });
  }

  return rows;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export function shouldSkipRow(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "blank name";

  const lower = trimmed.toLowerCase();
  if (lower.includes("(2)") || lower.includes("duplicate")) {
    return "duplicate marker in name";
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    if (SKIP_SINGLE_NAMES.has(words[0].toLowerCase())) {
      return `single-word name: ${trimmed}`;
    }
    return `single-word name: ${trimmed}`;
  }

  return null;
}

export function extractLinkedInId(url: string): string | null {
  if (!url) return null;
  try {
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    const path = new URL(normalized).pathname;
    const segments = path.split("/").filter(Boolean);
    const slug = segments[segments.length - 1];
    if (!slug || slug === "in") return null;
    return slug;
  } catch {
    const match = url.match(/linkedin\.com\/in\/([^/?]+)/i);
    return match?.[1] ?? null;
  }
}

export function splitName(fullName: string): {
  first_name: string;
  last_name: string;
} {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { first_name: parts[0], last_name: "" };
  }
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(" "),
  };
}
