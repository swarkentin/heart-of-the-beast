// The combat log: a rolling, client-side record of what the server says happened.
import { useEffect, useRef, useState } from "react";
import type { ApiCombatEvent } from "../api";
import { LOG_LIMIT, linesFor, type LogLine, type LogTone } from "./logLines.ts";

export { relabel, type LogLine } from "./logLines.ts";

/** Notes are client-side lines (rooms entered, run rewards). They show as system lines unless they carry a tone. */
export function useCombatLog(events: ApiCombatEvent[], notes: { key: string; text: string; tone?: LogTone }[]): LogLine[] {
  const [lines, setLines] = useState<LogLine[]>([]);
  const seen = useRef(new Set<string>());
  const round = useRef(0);
  const noteKey = notes.map(note => note.key).join("|");
  useEffect(() => {
    const fresh = notes.filter(note => !seen.current.has("note:" + note.key));
    if (fresh.length === 0) return;
    for (const note of fresh) seen.current.add("note:" + note.key);
    setLines(current => [...current, ...fresh.map(note => ({ key: "note:" + note.key, tone: note.tone ?? "system", text: note.text }))].slice(-LOG_LIMIT));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteKey]);
  useEffect(() => {
    const next = linesFor(events, seen.current, round.current);
    for (const key of next.keys) seen.current.add(key);
    round.current = next.lastRound;
    if (next.lines.length > 0) setLines(current => [...current, ...next.lines].slice(-LOG_LIMIT));
  }, [events]);
  return lines;
}
