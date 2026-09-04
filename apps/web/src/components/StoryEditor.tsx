"use client";

import { useRef, useState } from "react";
import { Bold, Italic, Strikethrough, List, ListOrdered, Link2, Heading2, Quote } from "lucide-react";
import { cn } from "@/components/ui";

/**
 * Small dependency-free WYSIWYG for the campaign story. Edits a contentEditable
 * region with document.execCommand and mirrors the HTML into a hidden input; the
 * server action sanitizes it (sanitizeRichText) before persisting.
 */
export function StoryEditor({ name, defaultValue }: { name: string; defaultValue: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState(defaultValue);
  const [focused, setFocused] = useState(false);

  const sync = () => setHtml(ref.current?.innerHTML ?? "");
  const exec = (cmd: string, value?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, value);
    sync();
  };
  const onLink = () => {
    const url = window.prompt("Endereço do link (https://…)");
    if (url) exec("createLink", url);
  };

  const btn = "grid size-7 place-items-center rounded text-muted transition-colors hover:bg-surface hover:text-ink";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border bg-surface transition-colors",
        focused ? "border-brand-500" : "border-line-strong",
      )}
    >
      <div className="flex flex-wrap items-center gap-0.5 border-b border-line bg-canvas p-1">
        <button type="button" title="Negrito" aria-label="Negrito" className={btn} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")}>
          <Bold className="size-3.5" />
        </button>
        <button type="button" title="Itálico" aria-label="Itálico" className={btn} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")}>
          <Italic className="size-3.5" />
        </button>
        <button type="button" title="Tachado" aria-label="Tachado" className={btn} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("strikeThrough")}>
          <Strikethrough className="size-3.5" />
        </button>
        <span className="mx-1 h-4 w-px bg-line-strong" />
        <button type="button" title="Subtítulo" aria-label="Subtítulo" className={btn} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("formatBlock", "<h3>")}>
          <Heading2 className="size-3.5" />
        </button>
        <button type="button" title="Citação" aria-label="Citação" className={btn} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("formatBlock", "<blockquote>")}>
          <Quote className="size-3.5" />
        </button>
        <button type="button" title="Lista" aria-label="Lista com marcadores" className={btn} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertUnorderedList")}>
          <List className="size-3.5" />
        </button>
        <button type="button" title="Lista numerada" aria-label="Lista numerada" className={btn} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertOrderedList")}>
          <ListOrdered className="size-3.5" />
        </button>
        <span className="mx-1 h-4 w-px bg-line-strong" />
        <button type="button" title="Inserir link" aria-label="Inserir link" className={btn} onMouseDown={(e) => e.preventDefault()} onClick={onLink}>
          <Link2 className="size-3.5" />
        </button>
      </div>

      <div
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-label="História da campanha"
        contentEditable
        suppressContentEditableWarning
        onInput={sync}
        onBlur={() => {
          sync();
          setFocused(false);
        }}
        onFocus={() => setFocused(true)}
        dangerouslySetInnerHTML={{ __html: defaultValue }}
        className="min-h-[220px] px-3.5 py-3 text-sm leading-relaxed text-ink outline-none [&_a]:text-brand-600 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-line-strong [&_blockquote]:pl-3 [&_blockquote]:text-muted [&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
      />

      <input type="hidden" name={name} value={html} />
    </div>
  );
}
