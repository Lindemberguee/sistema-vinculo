/** Data the public page loader resolves once and threads to every block renderer. */
export interface RenderContext {
  host: string;
  organizationId: string;
  org: {
    displayName: string;
    /**
     * Tenant visual identity. Canonical keys: `primaryColor` (single accent hex)
     * + `buttonRadius` + `logoUrl`. `secondaryColor`/`accentColor` are legacy —
     * still accepted in stored JSON but nothing consumes them.
     */
    branding: {
      primaryColor?: string;
      buttonRadius?: "full" | "md" | "none";
      logoUrl?: string | null;
      /** @deprecated unused — kept for backward compat with old rows */
      secondaryColor?: string;
      /** @deprecated unused */
      accentColor?: string;
    };
  };
  campaign: {
    slug: string;
    title: string;
    summary: string | null;
    raisedCents: number;
    goalCents: number | null;
    donorsCount: number;
    minAmountCents: number;
    suggestedAmountsCents: number[];
    allowRecurring: boolean;
    allowTip: boolean;
    dedicationEnabled: boolean;
    allowAmbassadors: boolean;
  };
  /** Public key for browser-side card tokenization. */
  pagarmePublicKey: string;
  /** ~platform fee rate for the "cover the fee" tip default (display only). */
  platformFeeBps: number;
  /** Plan allows hiding the "Feito com a plataforma" footer. When false, it's forced on. */
  removeBranding: boolean;
}
