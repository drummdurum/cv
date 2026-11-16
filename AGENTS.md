# Projektguide til fremtidige assistenter

Læs denne fil, før du ændrer projektet. `README.md` har flere oplysninger om opsætning og funktioner.

## Projektet

Dette er Sebastian Drumms CV-side med en selvstændig eventdel. Serveren er Node.js med Express (`server.js`), siderne er EJS, og statiske filer ligger i `public/`. CV-siden bruger Tailwind CSS. Eventdelen har sit eget layout og CSS og er ikke koblet til CV-navigationen.

## Vigtige filer og mapper

| Sted | Formål |
| --- | --- |
| `server.js` | Express-ruter, sikkerhed, API'er og opstart af HTTP, gRPC og database. |
| `views/` | EJS-visninger til CV-siden. |
| `views/event/index.ejs` | Eventoversigt på `/event`. |
| `views/event/detail.ejs` | Fælles eventside på `/event/:id`. |
| `views/event/quiz.ejs` | Quizside på `/event/quiz/:id`. |
| `event/data.js` | Eventernes id, titel, dato, sted, beskrivelse og afstemning. |
| `event/questions.json` | Quizspørgsmål. |
| `event/` | Logik til database, deltagere, chat, afstemning, sikkerhed og gRPC. |
| `public/event/event.css` og `public/event/event.js` | Fælles udseende og browserlogik for eventdelen. |
| `public/event/christmas.css` | Særligt juletema og animation til julefrokosten. |
| `public/css/` | Tailwind-kilde og genereret CSS til CV-siden. |
| `docker-compose.yml` og `Dockerfile` | Lokal drift med app og MongoDB. |
| `tests/e2e/` | Playwright-tests. |

## Eventdelen

Ruten `/event/:id` slår eventets id op i `event/data.js` og renderer `views/event/detail.ejs`. Julefrokosten har id **`julefrokst`**, så den ønskede adresse er `http://localhost:3010/event/julefrokst`. Behold denne stavemåde i ruten, medmindre Sebastian beder om at ændre den. Juletemaet aktiveres kun for dette event i `detail.ejs` og `public/event/christmas.css`. Dato, tid og sted er foreløbig pladsholdere i `event/data.js`.

Julefrokosten har et videovindue ved siden af introen og den runde juledekoration. Det bevæger sig langsomt på store skærme, og videoen forsøger at starte automatisk uden lyd. YouTube-indlejringen ligger i `views/event/detail.ejs`, udseendet i `public/event/christmas.css`, og `server.js` tillader den i Content Security Policy.

Eventtilmelding, chat og stemmer bruger MongoDB. Chat og afstemning bruger WebSockets; deltagerlisten bruger Server-Sent Events. Quiz og Echo bruger gRPC. Se `README.md` for detaljer om miljøvariabler, sikkerhed og API'er.

## Samarbejde og lokal kørsel

Sebastian sørger **selv for at starte projektet med Docker og køre tests**. Lad derfor være med at starte Docker, serveren eller tests som en automatisk del af arbejdet. Beskriv relevante testkommandoer og hvad der bør kontrolleres, så Sebastian kan gøre det selv. Sig tydeligt, hvis en ændring ikke er testet. Du må stadig læse kode og foretage statiske kontroller, når det hjælper med at løse opgaven.

Den lokale Docker-opsætning kræver `.env` med `MONGO_ROOT_PASSWORD` og `EVENT_COOKIE_SECRET` (se `.env.example`). Sebastian kan starte den med `docker compose up --build -d` og åbne `http://localhost:3010/event`. Den eksisterende testkommando er `npm run test:e2e`.

Respekter eksisterende lokale ændringer. Flere filer kan være ændrede eller endnu ikke versionsstyrede; overskriv dem ikke uden at se indholdet først.
