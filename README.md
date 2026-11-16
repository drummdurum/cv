# Sebastian Drumm CV Website

## Selvstændig eventdel

### Kør med Docker Compose

`docker-compose.yml` starter både appen og MongoDB. Opret en lokal `.env` med `MONGO_ROOT_PASSWORD` og `EVENT_COOKIE_SECRET` (se `.env.example`), og kør:

```bash
docker compose up --build -d
```

Åbn `http://localhost:3010/event`. MongoDBs data ligger i Docker-volumen `mongo_data`. `docker compose down` stopper containerne uden at slette data. Echo gRPC kan nås på `localhost:50051`. Begge porte er kun bundet til din egen computer. Hvis du allerede har en `.env` til mailservice, så tilføj blot de to nye variabler til den.


Åbn `/event` for eventoversigten og `/event/:id` for et event. Eventdelen har eget layout og ingen links til CV-siden. Eksempeldata og spørgsmål ligger i `event/data.js`.

Sæt `MONGODB_URI` til en MongoDB-forbindelsesstreng og eventuelt `MONGODB_DB` til databasenavnet (standard: `sebastian_event`). Personer med navn og mail oprettes én gang i `participants`, mens deres tilmeldinger til konkrete events ligger i `enrollments`. En genkendt person kan derfor tilmelde sig et andet event med ét klik. Chatbeskeder og stemmer gemmes også i MongoDB. Uden en fungerende database er tilmelding og chat utilgængelige; resten af CV-siden starter stadig.

Afstemningen og chatten bruger WebSockets på `/event/ws`. Deltageren tilmelder sig med navn og mail. Serveren gemmer et deltager-id i en signeret, HttpOnly-cookie; mailen ligger kun i databasen. Sæt `EVENT_COOKIE_SECRET` til en lang, tilfældig værdi i drift, så identiteten overlever genstart. Uden bekræftelse af mail eller login kan en bruger stadig slette sin cookie og registrere sig med en anden mail. Man kan ændre sin stemme, og resultatet opdateres hos alle tilsluttede.

Deltagerlisten opdateres live via Server-Sent Events på `/event/api/attendees/live`. Den viser kun navne og antal for det aktuelle event.

Eventformularerne bruger et signeret CSRF-token, og WebSocket-forbindelser accepteres kun fra tilladte origins. Standardlisten omfatter `localhost:3010` og `sebastiandrumm.dk`; tilføj andre domæner via `EVENT_ALLOWED_ORIGINS` (kommasepareret). Appen sætter sikkerhedsheaders med Helmet. `package-lock.json` er versionsstyret; brug `npm ci` for reproducerbar installation.

Echo bruger `event/echo.proto` og en gRPC-server på port `50051` (kan ændres med `GRPC_PORT`). Websiden kalder `/event/api/echo`, som videresender beskeden til gRPC-serveren. Den separate klient kan prøves med `npm run event:echo -- "Hej"`; en tom besked giver gRPC-status `INVALID_ARGUMENT`.

På `/event` har quizzerne deres egen sektion med direkte links til `/event/quiz/:id`. Der er tre quizzer med 20 spørgsmål hver i `event/questions.json`: RPA, Systemintegration og Large Systems. Quizserveren bruger bidirektionel gRPC-streaming via `event/quiz.proto`: `Question`, `Score` efter hvert svar og `RoundEnd` til sidst. Express bygger bro mellem browseren og gRPC-streamen; `game_id` er `quiz-hub`, mens `player_id` er deltagerens id. Slutscore gemmes i MongoDB. En separat kommandolinjeklient kan prøves med `npm run event:quiz -- rpa` (eller `systemintegration` / `large-systems`).

Et moderne CV website bygget med Node.js, Express, EJS og Tailwind CSS.

## 📋 Forudsætninger

- Node.js (version 14 eller nyere)
- npm (kommer med Node.js)

## 🚀 Installation

1. **Installer dependencies:**
   ```bash
   npm install
   ```

2. **Generer Tailwind CSS:**
   ```bash
   npx tailwindcss -i ./public/css/input.css -o ./public/css/output.css
   ```

## 💻 Kør Projektet

### Development mode (med auto-reload):
Åbn to terminaler:

**Terminal 1 - Start serveren:**
```bash
npm run dev
```

**Terminal 2 - Watch Tailwind CSS changes:**
```bash
npm run build:css
```

### Production mode:
```bash
npm start
```

Websitet vil være tilgængeligt på `http://localhost:3000`

## 📁 Projekt Struktur

```
CV sebastian/
├── public/
│   └── css/
│       ├── input.css      # Tailwind source fil
│       └── output.css     # Genereret CSS (ikke i git)
├── views/
│   ├── layout.ejs         # Hoved layout template
│   ├── index.ejs          # Forside med projekter
│   ├── jobs.ejs           # Erhvervserfaring
│   └── fritid.ejs         # Fritid og interesser
├── server.js              # Express server
├── package.json           # Dependencies
├── tailwind.config.js     # Tailwind konfiguration
└── README.md
```

## 🎨 Sider

- **Forside** (`/`) - Præsentation, kompetencer og projekter
- **Erfaring** (`/jobs`) - Arbejdserfaring og uddannelse
- **Fritid** (`/fritid`) - Interesser og personlige projekter

## 🛠️ Teknologier

- **Backend:** Node.js, Express
- **Template Engine:** EJS
- **Styling:** Tailwind CSS
- **Dev Tools:** Nodemon

## 📝 Tilpasning

For at tilpasse CV'et til dine egne informationer:

1. Rediger content i EJS filerne under `views/`
2. Opdater farver i `tailwind.config.js`
3. Tilføj dine egne projekter og erfaring

## 🎯 Features

- ✅ Responsive design
- ✅ Moderne UI med Tailwind CSS
- ✅ Tre separate sider (Forside, Jobs, Fritid)
- ✅ Mobil menu
- ✅ Projekt kategorier (Praktik, Skole, Produktion)
- ✅ Kontakt information
- ✅ Social media links

## � Deployment til Railway

Projektet er klar til deployment på Railway. Se [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md) for detaljeret guide.

**Quick deploy:**
```bash
# Via Railway CLI
npm install -g @railway/cli
railway login
railway init
railway up
```

Eller connect dit GitHub repository direkte via Railway dashboard.

## �📞 Kontakt

- **Email:** sebastiandrumm@gmail.com
- **Telefon:** 50 34 38 06

---

Lavet med ❤️ af Sebastian Drumm
