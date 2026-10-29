This is a Next.js project backed by Firebase.

Configurazione ambiente minima:

- NEXT_PUBLIC_SITE_URL: URL pubblico canonico del sito, usato nelle email per generare i link alle schede veicolo.
- SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM: configurazione SMTP per le email transazionali.
- In alternativa a SMTP puoi usare GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REFRESH_TOKEN per l'invio via Gmail API.
- FIREBASE_ADMIN_CLIENT_EMAIL e FIREBASE_ADMIN_PRIVATE_KEY: credenziali Admin SDK per le route server che leggono Firestore lato server.

Esempio rapido:

```env
NEXT_PUBLIC_SITE_URL=https://autotrade.hubmobility.it
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=mailer@example.com
SMTP_PASS=supersegreta
SMTP_FROM=AUTOTRADE <no-reply@example.com>
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Se vuoi mantenere il progetto su Firebase App Hosting o Vercel, imposta queste variabili nell'ambiente di deploy oltre che in locale.

## SEO e deploy Vercel

- Il dominio canonico SEO e `https://autotrade.hubmobility.it`, definito in `src/lib/site.ts`. `NEXT_PUBLIC_SITE_URL` deve usare lo stesso dominio per i link nelle email.
- Il catalogo pubblico e nella homepage, nella sezione `/#catalogo`. Il redirect permanente esistente da `/auto` resta invariato: non aggiungere questa URL di redirect alla sitemap.
- Homepage, catalogo e schede usano i dati server esistenti e mantengono i successivi aggiornamenti Firebase lato client. Il rendering visivo non e modificato.
- `/sitemap.xml` viene generata a ogni richiesta e include solo vetture con `stato = In vendita` e `adminOnly = false`. Non scrive al database. In caso di errore di lettura restituisce un errore server, non una sitemap apparentemente riuscita ma incompleta.
- Le schede vendute o non in vendita restano accessibili secondo il comportamento esistente, ma hanno `noindex` e non sono nella sitemap. Vetture inesistenti, riservate o trasferite restituiscono 404; non vengono reindirizzate alla homepage.
- Non sono introdotte nuove variabili: per una lettura server affidabile su Vercel sono raccomandate `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL` e `FIREBASE_ADMIN_PRIVATE_KEY`. Il fallback pubblico Firebase gia presente resta disponibile e dipende dalle regole e dagli indici esistenti. Non inserire credenziali nei file versionati o in chat.
- Prima del deploy eseguire `npm run typecheck` e `npm run build`: la configurazione esistente ignora gli errori TypeScript durante la sola build.
- Dopo il deploy controllare HTTP 200 su `/`, `/sitemap.xml`, `/robots.txt` e su una scheda presente nella sitemap; verificare canonical, metadata, HTML senza JavaScript e JSON-LD. Controllare anche il refresh diretto di una scheda e il 404 di una URL inesistente.
- In Search Console mantenere `/sitemap.xml`, usare Ispezione URL e Test URL pubblicato sulle schede. Sitemap e metadata corretti non garantiscono indicizzazione o tempi di scansione; non promettere risultati o posizionamento.