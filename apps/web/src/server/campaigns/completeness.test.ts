import { describe, expect, it } from "vitest";
import { campaignCompleteness, type CampaignCompletenessInput } from "./completeness";

const EMPTY: CampaignCompletenessInput = {
  slogan: null,
  category: "NONE",
  summary: null,
  story: null,
  galleryMedia: [],
  goalCents: null,
  superGoalCents: null,
  endsAt: null,
  notifyEmails: [],
  faq: [],
  updatesCount: 0,
  sdgGoals: [],
  budget: [],
  rewardsCount: 0,
};

describe("campaignCompleteness", () => {
  it("is 0% when nothing optional is filled", () => {
    expect(campaignCompleteness(EMPTY).pct).toBe(0);
  });

  it("is 100% when every optional field is filled", () => {
    const full: CampaignCompletenessInput = {
      slogan: "Ajude a mudar vidas",
      category: "HEALTH",
      summary: "Resumo",
      story: "<p>História</p>",
      galleryMedia: [{ type: "image", url: "https://x/y.jpg" }],
      goalCents: 100000,
      superGoalCents: 200000,
      endsAt: new Date(),
      notifyEmails: ["ong@example.com"],
      faq: [{ q: "?", a: "!" }],
      updatesCount: 2,
      sdgGoals: [1, 4],
      budget: [{ label: "Projeto", amountCents: 8000 }],
      rewardsCount: 1,
    };
    expect(campaignCompleteness(full).pct).toBe(100);
  });

  it("scores each section independently", () => {
    const c = campaignCompleteness({ ...EMPTY, slogan: "x", category: "HEALTH" });
    const essencial = c.sections.find((s) => s.key === "essencial")!;
    expect(essencial.done).toBe(2);
    expect(essencial.total).toBe(5);
    expect(c.sections.find((s) => s.key === "arrecadacao")!.done).toBe(0);
  });

  it("an empty gallery array does not count as filled", () => {
    const c = campaignCompleteness({ ...EMPTY, galleryMedia: [] });
    expect(c.sections.find((s) => s.key === "essencial")!.done).toBe(0);
  });
});
