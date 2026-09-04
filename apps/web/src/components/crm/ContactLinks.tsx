import { Mail, Phone, MessageCircle } from "lucide-react";

/**
 * Quick contact affordances for a person: e-mail, phone and WhatsApp.
 * Server component — just links, no state.
 */
export function ContactLinks({
  email,
  phone,
  className = "",
}: {
  email?: string | null;
  phone?: string | null;
  className?: string;
}) {
  const digits = (phone ?? "").replace(/\D/g, "");
  const wa = digits.length >= 10 ? (digits.length <= 11 ? `55${digits}` : digits) : null;

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {email && (
        <a
          href={`mailto:${email}`}
          title={email}
          aria-label={`Enviar e-mail para ${email}`}
          className="grid size-10 place-items-center rounded-md text-muted transition-colors hover:bg-canvas hover:text-ink"
        >
          <Mail className="size-4" />
        </a>
      )}
      {phone && (
        <a
          href={`tel:${digits}`}
          title={phone}
          aria-label={`Ligar para ${phone}`}
          className="grid size-10 place-items-center rounded-md text-muted transition-colors hover:bg-canvas hover:text-ink"
        >
          <Phone className="size-4" />
        </a>
      )}
      {wa && (
        <a
          href={`https://wa.me/${wa}`}
          target="_blank"
          rel="noreferrer"
          title="Abrir no WhatsApp"
          aria-label="Abrir conversa no WhatsApp"
          className={/* tokens-allow: WhatsApp brand green */ "grid size-10 place-items-center rounded-md text-muted transition-colors hover:bg-canvas hover:text-[#25D366]"}
        >
          <MessageCircle className="size-4" />
        </a>
      )}
    </span>
  );
}
