/**
 * Short, SwingCoach-style feedback wording ("Spine forward by 3"), loaded at
 * runtime from `static/config/feedback-wording.json` so it can be edited
 * without a rebuild.
 *
 * Each metric has a phrase for each direction it can be off (describing the
 * fault); `format` builds an item from the phrase and the metric's
 * whole-number score — how far it is from 0 (on target). Items are spoken
 * and shown grouped by phase: "Load: Spine forward by 3. Knees deep by 4."
 *
 * A metric missing from the file falls back to the scorecard wording, so a
 * gap or typo never breaks feedback.
 */
import { z } from "zod";
import { phaseName } from "$lib/features/live-practice/loop/readback";
import { displayScore, issueText, type MetricResultV3 } from "./score";

export const FEEDBACK_WORDING_URL = "/config/feedback-wording.json";
export const DEFAULT_FORMAT = "{phrase} by {n}";

export interface FeedbackWording {
  /** Template: {phrase} = the direction's phrase, {n} = the whole score. */
  readonly format: string;
  readonly metrics: Readonly<
    Record<string, { readonly low: string; readonly high: string }>
  >;
}

export const EMPTY_FEEDBACK_WORDING: FeedbackWording = {
  format: DEFAULT_FORMAT,
  metrics: {},
};

const phrase = z.string().trim().min(1).max(60);
const fileSchema = z.object({
  format: z
    .string()
    .refine((f) => f.includes("{phrase}"), "format must contain {phrase}")
    .optional(),
  metrics: z.record(z.object({ low: phrase, high: phrase })).optional(),
});

/** Validates a parsed file; invalid parts fall back with a warning. */
export function parseFeedbackWording(raw: unknown): {
  wording: FeedbackWording;
  warnings: string[];
} {
  const parsed = fileSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      wording: EMPTY_FEEDBACK_WORDING,
      warnings: parsed.error.issues.map(
        (i) => `${i.path.join(".") || "file"}: ${i.message}`,
      ),
    };
  }
  return {
    wording: {
      format: parsed.data.format ?? DEFAULT_FORMAT,
      metrics: parsed.data.metrics ?? {},
    },
    warnings: [],
  };
}

/** Loads the wording file (never throws; falls back to the scorecard text). */
export async function loadFeedbackWording(
  fetchImpl: typeof fetch = fetch,
  url: string = FEEDBACK_WORDING_URL,
): Promise<{ wording: FeedbackWording; warnings: string[] }> {
  try {
    const res = await fetchImpl(url, { cache: "no-store" });
    if (!res.ok) {
      return {
        wording: EMPTY_FEEDBACK_WORDING,
        warnings: [`feedback wording HTTP ${res.status}; using defaults`],
      };
    }
    return parseFeedbackWording(await res.json());
  } catch (err) {
    return {
      wording: EMPTY_FEEDBACK_WORDING,
      warnings: [`feedback wording unreadable (${String(err)})`],
    };
  }
}

/** The short phrase for an off-target metric, or null if not configured. */
function shortText(r: MetricResultV3, w: FeedbackWording): string | null {
  if (r.value === null || !r.direction || r.score === null) return null;
  const p = w.metrics[r.id]?.[r.direction];
  if (!p) return null;
  return w.format
    .replaceAll("{phrase}", p)
    .replaceAll("{n}", displayScore(r.score));
}

/**
 * One item for the card / review chips / Shots list: "Spine forward by 3"
 * (falls back to "Torso lean: leaning too far forward by 3").
 */
export function feedbackText(
  r: MetricResultV3,
  w: FeedbackWording = EMPTY_FEEDBACK_WORDING,
): string {
  return shortText(r, w) ?? issueText(r);
}

/**
 * The spoken readback for feedback items (already chosen + in shot order),
 * grouped by phase: "Load: Spine forward by 3. Knees deep by 4. Set point:
 * Set point low by 2." Items without configured wording use their cue.
 */
export function feedbackReadback(
  items: readonly MetricResultV3[],
  w: FeedbackWording = EMPTY_FEEDBACK_WORDING,
): string {
  const groups: { phase: string; parts: string[] }[] = [];
  for (const r of items) {
    const text = shortText(r, w) ?? r.cue ?? r.label;
    const last = groups.at(-1);
    if (last && last.phase === r.phase) last.parts.push(text);
    else groups.push({ phase: r.phase, parts: [text] });
  }
  return groups
    .map((g) => `${phaseName(g.phase)}: ${g.parts.join(". ")}.`)
    .join(" ");
}
