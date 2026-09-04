import sanitizeHtml from "sanitize-html";

/**
 * Allowlist sanitizer for the `richText` block. Runs on the server before a page
 * is saved/published AND defensively at render time, so campaign HTML can never
 * carry script, event handlers, or unknown tags onto the public page or into the
 * authenticated panel origin.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "hr",
    "h1", "h2", "h3", "h4",
    "strong", "b", "em", "i", "u", "s", "mark", "sub", "sup",
    "ul", "ol", "li",
    "blockquote", "figure", "figcaption",
    "a", "span",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    span: ["style"],
    "*": ["class"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { a: ["http", "https", "mailto", "tel"] },
  // Keep only harmless inline text styling.
  allowedStyles: {
    "*": {
      "text-align": [/^(left|right|center|justify)$/],
      "font-weight": [/^(normal|bold|[1-9]00)$/],
      "font-style": [/^(normal|italic)$/],
      "text-decoration": [/^(none|underline|line-through)$/],
    },
  },
  transformTags: {
    // External links open safely.
    a: (tagName, attribs) => ({
      tagName,
      attribs: attribs.href?.startsWith("http")
        ? { ...attribs, target: "_blank", rel: "noopener noreferrer nofollow" }
        : attribs,
    }),
  },
  disallowedTagsMode: "discard",
};

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html ?? "", OPTIONS);
}
