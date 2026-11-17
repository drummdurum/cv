# Kalenderinvitationer – enkel eventadministration

**Direkte Google Kalender:** Se `GOOGLE_CALENDAR_SETUP.md` for den separate opsætning til sebastiandrumm.dk. Med EVENT_CALENDAR_PROVIDER=google bruges Google til nye invitationer og kalendersvar; kontaktformularen og ældre mailinvitationer bruger stadig mailservicen. Nedenstående beskriver mailvarianten.

På `/event` findes under hvert event:

- Tjek kalenderinvitationer: opdaterer afsendelse, maillevering og kalendersvar.
- Send manglende invitationer: sender til tilmeldte uden invitation og prøver definitivt fejlede jobs igen. Allerede sendte og stadig uafklarede invitationer springes over. Knappen behandler de første 100 tilmeldte, som statusoversigten viser.
- Fjern gæst: lægger en kalenderaflysning i kø før tilmeldingen fjernes. Hvis køen ikke kan kontaktes, bliver tilmeldingen stående til næste forsøg.
- Aflys hele eventet: lukker for nye tilmeldinger og lægger kalenderaflysninger i kø. Ved fejl kan samme knap prøves igen for de resterende tilmeldte.

Adminpanelerne kræver `EVENT_ADMIN_KEY` på mindst 32 tegn. Der er ingen ny loginfunktion, rettelse af mailadresser eller adgang fra en ny browser.

## Gmail og maillevering

Arrangøren for nye invitationer er `sedrumm@gmail.com`. Svar går til den adresse. Mailen sendes fortsat fra den verificerede SMTP/Resend-afsender på vegne af arrangøren, med SENT-BY i kalenderfilen. Klienternes konkrete visning skal stadig afprøves i Gmail/Outlook/Apple Kalender.

CV-app:

```dotenv
MAIL_SERVICE_URL=https://din-mailservice
MAIL_SERVICE_API_KEY=din-cv-service-noegle
MAIL_CALENDAR_ENDPOINT=/emails/calendar
EVENT_ORGANIZER_EMAIL=sedrumm@gmail.com
EVENT_LEGACY_ORGANIZER_EMAIL=no-reply@sebastiandrumm.dk
```

Den sidste adresse skal være den faktiske organizer fra gamle invitationer uden gemt snapshot. Nye invitationer gemmer organizer og eventoplysninger selv. Gamle invitationer flyttes ikke automatisk til Gmail-arrangøren.

Mailservicens API:

```dotenv
CALENDAR_ORGANIZER_EMAIL=sedrumm@gmail.com
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
RESEND_WEBHOOK_SECRET=
```

Mailservicens worker får samme CALENDAR_ORGANIZER_EMAIL og sine eksisterende SMTP/Resend-variabler. Resend-afsenderen skal fortsat bruge et verificeret domæne; sæt ikke RESEND_FROM til Gmail-adressen.

Aktivér Gmail API i Google Cloud. Opret OAuth-klient og autorisér **sedrumm@gmail.com** med `https://www.googleapis.com/auth/gmail.readonly` og offline-adgang. Gem klient-id, klienthemmelighed og refresh token som servermiljøvariabler; del dem ikke i chat eller Git. OAuth-app i ekstern testtilstand kan have kortlivede refresh tokens, så brug en opsætning beregnet til fortsat personlig brug. Serveren kontrollerer, at OAuth-kontoen matcher arrangøren. Den ændrer eller sletter ingen mails.

Når admin trykker Tjek, læser mailservicen kalenderfiler fra de seneste 90 dage i Gmail. Beskeder behandles én gang og caches i mailservicens database. Der er ingen konstant baggrundssynkronisering. Ved mange beskeder/tidsgrænsen vises delvis kontrol, og du kan trykke igen. Kun REPLY-filer med korrekt organizer, kalender-UID, matchende mailafsender og modtager samt Gmail-bekræftet DMARC accepteres. Klienter, der ikke sender et svar, bliver stående som Intet kalendersvar. Svar ændrer ikke tilmeldingen på hjemmesiden.

For levering: opret Resend-webhook til `https://din-mailservice/webhooks/resend`, og vælg `email.delivered`, `email.bounced`, `email.delivery_delayed`, `email.failed` og `email.complained`. Gem webhookens signeringshemmelighed i RESEND_WEBHOOK_SECRET på API'et. Usignerede og for gamle signaturer afvises. Leveringsstatus er uafhængig af kalendersvar; leveret betyder modtagerens mailserver, ikke nødvendigvis indbakken. SMTP/Mailpit giver ingen bekræftet leveringsstatus.

Google-dokumentation: https://developers.google.com/workspace/gmail/api/auth/web-server
Resend-webhooks: https://resend.com/docs/dashboard/webhooks/introduction

## Tekniske rammer

Invite-id'et er stabilt for en tilmelding. Aflysning bruger samme kalender-UID, METHOD:CANCEL og en højere SEQUENCE. Genindmeldelse efter fjernelse får et nyt UID. Køen og afsendelsesloggen beskytter mod gentagne klik. En aflysningsmarkør forhindrer forsinkede første invitationer i at genoprette en aflyst aftale. Som med anden SMTP kan et nedbrud mellem transportaccept og logning give dubletter.

Gløgg er 4. december 2026 kl. 18.30–23.30 dansk tid. Kalenderfilen bruger DTSTART 17.30 UTC og DTEND 22.30 UTC. Events uden et startsAt sender ingen invitationer.

Deploy både CV og mailservicens API/worker. OAuth og webhook er implementeret, men den rigtige Gmail-konto/Resend-webhook er ikke tilsluttet under udviklingen. Der er ikke sendt rigtige mails eller ændret i Gmail.

## Tests

`npm test` i mailservicen tester kalenderkontrakt, REQUEST/CANCEL-transport, kø-genforsøg samt afvisning af falske eller irrelevante kalendersvar. CV har en særskilt `tests/e2e/calendar-lifecycle.spec.js`, der kræver isolerede Docker-testcontainere og Mailpit; den opretter bevidst testtilmeldinger og aflyser testeventet. Kør den aldrig mod drift.
