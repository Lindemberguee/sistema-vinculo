/**
 * Browser-side card tokenization. Raw card data goes straight from the browser
 * to Pagar.me and never touches our server (keeps us in PCI SAQ-A scope).
 */
export interface CardData {
  number: string;
  holderName: string;
  expMonth: number;
  expYear: number;
  cvv: string;
}

export async function tokenizeCard(publicKey: string, card: CardData): Promise<string> {
  const res = await fetch(`https://api.pagar.me/core/v5/tokens?appId=${encodeURIComponent(publicKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "card",
      card: {
        number: card.number.replace(/\s/g, ""),
        holder_name: card.holderName,
        exp_month: card.expMonth,
        exp_year: card.expYear,
        cvv: card.cvv,
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Falha ao validar o cartão: ${res.status} ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { id?: string };
  if (!json.id) throw new Error("Token de cartão não retornado pelo provedor");
  return json.id;
}
