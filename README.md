This is a Next.js project backed by Firebase.

Configurazione ambiente minima:

- NEXT_PUBLIC_SITE_URL: URL pubblico canonico del sito, usato nelle email per generare i link alle schede veicolo.
- SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM: configurazione SMTP per le email transazionali.
- In alternativa a SMTP puoi usare GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REFRESH_TOKEN per l'invio via Gmail API.
- FIREBASE_ADMIN_CLIENT_EMAIL e FIREBASE_ADMIN_PRIVATE_KEY: credenziali Admin SDK per le route server che leggono Firestore lato server.

Esempio rapido:

```env
NEXT_PUBLIC_SITE_URL=https://hubcatalogo.vercel.app
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=mailer@example.com
SMTP_PASS=supersegreta
SMTP_FROM=AUTOTRADE <no-reply@example.com>
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Se vuoi mantenere il progetto su Firebase App Hosting o Vercel, imposta queste variabili nell'ambiente di deploy oltre che in locale.