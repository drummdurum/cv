# Kalenderinvitationer

Når en deltager tilmelder sig et event med `startsAt`, opretter CV-appen en personlig iCalendar REQUEST og sender den via bouldeMailService. Status gemmes i `enrollments.invitation`. Mailfejl fjerner aldrig tilmeldingen.

## Opsætning

Deploy både API og worker fra `C:\Users\sedru\vs\bouldeMailService` samt den opdaterede CV-app. Der er ikke foretaget deployment eller afsendt rigtige mails under udviklingen.

CV-appens miljø skal indeholde de eksisterende `MAIL_SERVICE_URL` og `MAIL_SERVICE_API_KEY` (CV-nøglen), samt:

```dotenv
MAIL_CALENDAR_ENDPOINT=/emails/calendar
EVENT_ORGANIZER_EMAIL=no-reply@sebastiandrumm.dk
```

Organizer-adressen SKAL svare til adressen i mailworkerens `RESEND_FROM` eller `SMTP_FROM`. For lokal Mailpit med den eksisterende SMTP-afsender bruges `EVENT_ORGANIZER_EMAIL=no-reply@boulde.local`. Fra CV-appens Docker-container kan en mailservice på værtsmaskinen nås via `MAIL_SERVICE_URL=http://host.docker.internal:3101`. API og worker skal bruge samme Redis, kønavn og MongoDB. Mailservicens lokale Compose kræver eksplicit `MAIL_PROVIDER=smtp` for Mailpit.

Gløgg har start 4. december 2026 kl. 18.30 dansk tid. Sluttidspunkt er ikke angivet; kalenderen indeholder derfor kun starttidspunktet. Tilføj `endsAt` i eventdata når tidspunktet kendes. Events uden `startsAt` og quizzer sender ingen invitation.

## Flow og status

På `/event` har hvert event et adminpanel “Kalenderinvitationer”. Indtast den eksisterende `EVENT_ADMIN_KEY` og tryk Tjek kalenderinvitationer for at opdatere status fra mailservicen. Panelet vises når EVENT_ADMIN_KEY er mindst 32 tegn. Oversigten viser navn, status og afsendelsestid i dansk tidszone, højst de første 100 tilmeldte. Svaret caches ikke, adminnøglen vises ikke igen, og kontrollen sender ingen mails. Ved utilgængelig mailservice markeres den gemte status som ikke opdateret.

`POST /emails/calendar` i mailservicen modtager requestId, recipient, name, subject og calendar (method, filename og content). Et stabilt kalender-UID af event-id og deltager-id giver et deterministisk, app-afgrænset kø-id. BullMQ deduplikerer køjobs, og den permanente afsendelseslog forhindrer genafsendelse af afsluttede invitationer efter køoprydning.

Mailworkeren kontrollerer kalenderens organizer og attendee mod mailens afsender og modtager, og sender en enkelt mail med tekst, HTML og kalenderinvitation. SMTP bruger Nodemailers kalenderdel. Resend bruger en base64-kodet .ics-vedhæftning med `text/calendar; charset=utf-8; method=REQUEST`. Mailklienten bestemmer, hvordan invitationen vises.

Knappen Tjek invitation og genindlæsning henter den faktiske status fra det nøglebeskyttede `GET /emails/calendar/:requestId`. CV-API'et tillader kun den signerede deltager at hente eller anmode om sin egen invitation. En deltager uden invitation kan trykke Prøv at sende invitation. Sidevisning alene sender ingen mail. Der er ingen masseafsendelse.

Statusser: `not_sent` (afsendelse er ikke startet), `sending` (behandles), `queued` (i kø), `sent` (mailtransporten har accepteret mailen), `failed` (jobbet er fejlet), `unknown` (udfald ukendt). Sent beviser hverken levering, læsning eller accept i kalenderen. Worker genforsøger midlertidige fejl op til fem gange. Ukendte udfald genudsendes ikke automatisk fra CV-appen. Hvis processen stopper før køoprettelse, kan sending/unknown kræve manuel afklaring. SMTP kan som andre mailtransporter give dubletter ved nedbrud efter transportaccept men før logning.

## Kontrol, som Sebastian selv kører

Verificeret 17. november 2026: 17 unit tests og 1 integrationstest i mailservicen består. CV-appens 9 browser/gRPC-tests inklusive kalenderflow består; 1 test med rigtig mail er sprunget over. Kalenderflowet blev kørt med isolerede Docker-databaser og SMTP/Mailpit, inklusive kontrol af .ics-indhold, korrekt dansk starttid, vedvarende sendestatus, deduplikering og adgangskontrol. Ingen eksterne mails blev sendt.

Start mailservicen efter dens README og CV-projektet med `docker compose up --build -d`. Kør mailservicens `npm test` (inklusive tests/calendar.test.ts) og `npm run build`; kør CV-projektets `npm run test:e2e`.

Kontrollér ny tilmelding, kendt deltager, genindlæsning og dobbelte klik. Tjek status fra queued til sent. Kontrollér .ics-filen i Mailpit og kalenderens dato/tid i en rigtig mailklient. Afprøv forkert organizer og utilgængelig mailservice: tilmeldingen skal bevares, og status må ikke fejlagtigt vise sendt. Kontrollér at en anden deltager ikke kan hente eller sende din invitation.
