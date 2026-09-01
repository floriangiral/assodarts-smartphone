/**
 * Landing page Stripe redirects to after hosted onboarding or Checkout.
 *
 * It is intentionally public and does nothing but tell the person they can go
 * back to Assodarts — the real state change happens through the webhook.
 */
const MESSAGES: Record<string, { title: string; body: string; tone: string }> = {
  paid: {
    title: "Paiement confirmé",
    body:
      "Votre paiement a bien été enregistré. Revenez dans Assodarts, votre ligne passe au vert.",
    tone: "#1f9d63",
  },
  cancelled: {
    title: "Paiement annulé",
    body: "Aucun montant n'a été débité. Vous pouvez réessayer depuis l'application.",
    tone: "#c2410c",
  },
  done: {
    title: "Compte transmis à Stripe",
    body:
      "Stripe vérifie les informations du club. Revenez dans Assodarts pour suivre l'activation.",
    tone: "#1E3A5F",
  },
  refresh: {
    title: "Lien expiré",
    body: "Relancez l'activation depuis Assodarts pour obtenir un nouveau lien sécurisé.",
    tone: "#c2410c",
  },
};

Deno.serve((req) => {
  const state = new URL(req.url).searchParams.get("state") ?? "done";
  const message = MESSAGES[state] ?? MESSAGES.done;

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${message.title} · Assodarts</title>
<style>
  :root { color-scheme: light; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    background: linear-gradient(160deg, #1E3A5F, #0F2540);
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    padding: 24px;
  }
  .card {
    background: #fff; border-radius: 22px; padding: 32px 26px; max-width: 380px;
    text-align: center; box-shadow: 0 24px 60px rgba(0,0,0,.28);
  }
  .dot { width: 56px; height: 56px; border-radius: 50%; margin: 0 auto 18px;
         background: ${message.tone}1a; display: grid; place-items: center;
         font-size: 26px; color: ${message.tone}; }
  h1 { font-size: 21px; margin: 0 0 10px; color: #0F2540; }
  p { font-size: 15px; line-height: 1.5; margin: 0; color: #55606f; }
</style>
</head>
<body>
  <main class="card">
    <div class="dot">●</div>
    <h1>${message.title}</h1>
    <p>${message.body}</p>
  </main>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});
