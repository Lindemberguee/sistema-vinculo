/**
 * Pure "how filled in is this campaign" scorer for the editor's side rail.
 * Each section lists a few optional-but-recommended fields; required fields
 * (title, slug…) are excluded since they're always present after creation.
 */

export interface CampaignCompletenessInput {
  slogan: string | null;
  category: string;
  summary: string | null;
  story: string | null;
  galleryMedia: unknown;
  goalCents: number | null;
  superGoalCents: number | null;
  endsAt: Date | null;
  notifyEmails: string[];
  faq: unknown;
  updatesCount: number;
  sdgGoals: number[];
  budget: unknown;
  rewardsCount: number;
}

export interface CompletenessSection {
  key: string;
  label: string;
  done: number;
  total: number;
}

export interface Completeness {
  pct: number;
  sections: CompletenessSection[];
}

export function campaignCompleteness(c: CampaignCompletenessInput): Completeness {
  const gallery = Array.isArray(c.galleryMedia) ? c.galleryMedia : [];
  const faq = Array.isArray(c.faq) ? c.faq : [];
  const budget = Array.isArray(c.budget) ? c.budget : [];

  const sections: CompletenessSection[] = [
    {
      key: "essencial",
      label: "Essencial",
      done: [!!c.slogan, c.category !== "NONE", !!c.summary, !!c.story, gallery.length > 0].filter(Boolean).length,
      total: 5,
    },
    {
      key: "arrecadacao",
      label: "Arrecadação",
      done: [c.goalCents != null, c.superGoalCents != null, c.endsAt != null].filter(Boolean).length,
      total: 3,
    },
    {
      key: "impacto",
      label: "Impacto",
      done: [c.sdgGoals.length > 0, budget.length > 0].filter(Boolean).length,
      total: 2,
    },
    {
      key: "recompensas",
      label: "Recompensas",
      done: c.rewardsCount > 0 ? 1 : 0,
      total: 1,
    },
    {
      key: "comunicacao",
      label: "Comunicação",
      done: [faq.length > 0, c.updatesCount > 0].filter(Boolean).length,
      total: 2,
    },
    {
      key: "ajustes",
      label: "Ajustes",
      done: c.notifyEmails.length > 0 ? 1 : 0,
      total: 1,
    },
  ];

  const done = sections.reduce((a, s) => a + s.done, 0);
  const total = sections.reduce((a, s) => a + s.total, 0);
  return { pct: total ? Math.round((done / total) * 100) : 0, sections };
}
