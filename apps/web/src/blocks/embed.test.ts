import { describe, expect, it } from "vitest";
import { resolveEmbed } from "./embed";

describe("resolveEmbed", () => {
  it("converts a YouTube watch URL to a nocookie embed", () => {
    const r = resolveEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(r).toEqual({ ok: true, provider: "YouTube", src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" });
  });

  it("handles youtu.be short links", () => {
    expect(resolveEmbed("https://youtu.be/abc123").src).toBe("https://www.youtube-nocookie.com/embed/abc123");
  });

  it("converts a vimeo.com link to the player URL", () => {
    expect(resolveEmbed("https://vimeo.com/76979871").src).toBe("https://player.vimeo.com/video/76979871");
  });

  it("adds embedded=true to a Google Forms URL", () => {
    const r = resolveEmbed("https://docs.google.com/forms/d/e/XYZ/viewform");
    expect(r.ok).toBe(true);
    expect(r.src).toContain("embedded=true");
  });

  it("accepts a Google Maps embed URL but not a plain maps link", () => {
    expect(resolveEmbed("https://www.google.com/maps/embed?pb=!1m18").ok).toBe(true);
    expect(resolveEmbed("https://www.google.com/maps/place/Sao+Paulo").ok).toBe(false);
  });

  it("wraps a soundcloud track URL in the player", () => {
    const r = resolveEmbed("https://soundcloud.com/artist/track");
    expect(r.src).toContain("w.soundcloud.com/player");
    expect(r.src).toContain(encodeURIComponent("https://soundcloud.com/artist/track"));
  });

  it("rejects non-https and unknown hosts", () => {
    expect(resolveEmbed("http://www.youtube.com/watch?v=x").ok).toBe(false);
    expect(resolveEmbed("https://evil.example/page").ok).toBe(false);
    expect(resolveEmbed("not a url").ok).toBe(false);
  });

  it("rejects a data: URL", () => {
    expect(resolveEmbed("data:text/html,<script>alert(1)</script>").ok).toBe(false);
  });
});
