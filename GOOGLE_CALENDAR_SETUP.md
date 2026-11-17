# Google Kalender til sebastiandrumm.dk

Denne integration tilhører udelukkende CV/event-projektet på **sebastiandrumm.dk**. Den bruger det separate Google Cloud-projekt **SebastianDrumm DK**, id **sebastiandrumm-dk**. Den bruger ikke klienter, hemmeligheder eller tilladelser fra andre projekter.

## Engangsopsætning

1. Åbn https://console.cloud.google.com/apis/dashboard?project=sebastiandrumm-dk og aktivér Google Calendar API.
2. Opret OAuth-branding som `sebastiandrumm.dk`, med `sedrumm@gmail.com` som kontakt, og vælg External, da det er en personlig Gmail-konto. Kun arrangøren skal forbinde sin konto; vennerne skal ikke logge ind på hjemmesiden.
3. Opret en separat OAuth-klient af typen **Desktop app**, navn `sebastiandrumm.dk calendar setup`, og download klientens JSON til din egen computer. Dette er til den lokale engangsgodkendelse; hjemmesiden og kalenderens eventlinks bruger sebastiandrumm.dk. Der skal ikke sættes et andet webdomæne som redirect.
4. Tilføj `sedrumm@gmail.com` som testbruger, hvis OAuth-appen står i Testing. Google kræver en ny godkendelse, når et test-refresh-token udløber; for fortsat personlig brug skal publikationsstatus håndteres i Google Cloud. Tildel ikke flere scopes end dem, scriptet beder om.
5. Kør lokalt:

   ```powershell
   node scripts/connect-google-calendar.js "C:\sti\til\den-downloadede-klient.json"
   ```

   Åbn den viste Google-adresse. Scriptet bruger en midlertidig lokal callback på `http://127.0.0.1:53682/oauth2callback`, PKCE og engangs-state. Godkend selv med **sedrumm@gmail.com**. Der anmodes om `openid`, `email` og `calendar.events.owned`: læse/oprette/ændre/slette events i kalendere, du ejer. Der anmodes ikke om adgang til indbakken.

6. Scriptet skriver servervariabler til den Git-ignorerede fil `tmp/google-calendar.env`. Det udskriver ikke tokens. Kopiér variablerne til **CV-servicen** i Railway, og deploy den opdaterede kode:

   ```dotenv
   EVENT_CALENDAR_PROVIDER=google
   GOOGLE_CALENDAR_ACCOUNT=sedrumm@gmail.com
   GOOGLE_CALENDAR_ID=primary
   GOOGLE_CALENDAR_CLIENT_ID=...
   GOOGLE_CALENDAR_CLIENT_SECRET=...
   GOOGLE_CALENDAR_REFRESH_TOKEN=...
   ```

   Gem aldrig klient-JSON eller tokenfilen i Git eller chat. Kopiér ikke disse værdier til andre projekter. Brug et stabilt EVENT_ADMIN_KEY som hidtil.

## Brug

Nye tilmeldinger inviteres via Google, når EVENT_CALENDAR_PROVIDER=google. Google-eventet oprettes i arrangørens egen kalender med dato, tid, sted og et link til sebastiandrumm.dk. Der bruges ét fælles event pr. hjemmeside-event. Gæsterne kan ikke se hinandens mailadresser i Googles gæsteliste, ændre eventet eller invitere andre. Google kan sende opdateringsmails, når gæstelisten ændres.

Arrangøren får aftalen i sin egen kalender og inviteres ikke som gæst til sit eget event. Vennernes kalenderindstillinger bestemmer, om invitationen vises med det samme eller først efter et svar i mailen. API-godkendelse er ikke et bevis på maillevering.

På `/event` kan admin trykke **Invitér tilmeldte via Google Kalender** for at overflytte eksisterende tilmeldte. Det sender Google-invitationer og lægger aflysninger af gamle ICS-mailinvitationer i mailkøen, hvor de findes. Migrér først efter en test med arrangøren. Gamle mailinvitationer uden snapshot kræver den korrekte EVENT_LEGACY_ORGANIZER_EMAIL, hvis deres kalenderaftale skal kunne aflyses korrekt. Ukendt mailtransport kan forsinke den gamle aflysning, så gamle og nye aftaler kortvarigt kan eksistere samtidig.

Tjek-knappen læser accept/afslag direkte fra Google for Google-invitationer. Gmail-readonly OAuth og Resend-webhooks er ikke nødvendige til denne del. Kontaktformularen bruger fortsat mailservicen. Tidligere mailinvitationer bruger fortsat mailservicen, indtil de overflyttes.

Fjern gæst fjerner personen fra Google-eventet med notifikation. Hele-event-aflysning aflyser Google-eventet. Hvis arrangøren selv fjernes fra hjemmesidens deltagerliste, bliver eventet i arrangørens kalender; en arrangør fjernes ikke som en gæst. En aflyst Google-aftale genoprettes ikke automatisk. Der faldes aldrig automatisk tilbage til mailafsendelse ved Google-fejl.

## Kontrol

`node --test tests/google-calendar.test.js` tester kontoafgrænsning, korrekte tider, deltagerprivacy, samtidige tilmeldinger, dubletbeskyttelse, svar og aflysning med en simuleret Google API. Ingen rigtige invitationer sendes af denne test.

Efter OAuth og deployment: tilmeld først Sebastian alene og kontrollér, at Gløgg ligger 4. december 2026 kl. 18.30–23.30 i den rigtige kalender. Invitér derefter én aftalt testgæst, som accepterer/afslår. Kontrollér adminstatus og gæstefjernelse, før eksisterende deltagere overflyttes.
