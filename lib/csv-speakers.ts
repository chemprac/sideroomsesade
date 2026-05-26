import { fixEncoding } from "./csv-attendees";

export interface CsvSpeakerRow {
  name: string;
  title: string;
  company: string;
  session_title: string;
  session_topic: string;
  day: string;
  time: string;
  role: string;
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

function headerIndex(headers: string[], names: string[]): number {
  for (const n of names) {
    const idx = headers.indexOf(n);
    if (idx >= 0) return idx;
  }
  return -1;
}

export function parseSpeakersCsv(raw: string): CsvSpeakerRow[] {
  const text = fixEncoding(raw).replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) =>
    fixEncoding(h).trim().toLowerCase()
  );

  const idx = {
    name: headerIndex(headers, ["name"]),
    title: headerIndex(headers, ["title"]),
    company: headerIndex(headers, ["company"]),
    session_title: headerIndex(headers, ["session_title", "session title"]),
    session_topic: headerIndex(headers, ["session_topic", "session topic"]),
    day: headerIndex(headers, ["day"]),
    time: headerIndex(headers, ["time"]),
    role: headerIndex(headers, ["role"]),
  };

  if (idx.name === -1) return [];

  const rows: CsvSpeakerRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const name = fixEncoding(cols[idx.name] ?? "").trim();
    if (!name) continue;
    rows.push({
      name,
      title: fixEncoding(cols[idx.title] ?? "").trim(),
      company: fixEncoding(cols[idx.company] ?? "").trim(),
      session_title: fixEncoding(cols[idx.session_title] ?? "").trim(),
      session_topic: fixEncoding(cols[idx.session_topic] ?? "").trim(),
      day: fixEncoding(cols[idx.day] ?? "").trim(),
      time: fixEncoding(cols[idx.time] ?? "").trim(),
      role: fixEncoding(cols[idx.role] ?? "").trim(),
    });
  }
  return rows;
}
