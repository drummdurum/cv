# Stilguide til mails fra Sebastian Drumms CV-side

Mailene skal føles som en naturlig forlængelse af CV-siden: personlige, rolige og professionelle. Udtrykket er varmt og moderne frem for klassisk corporate. Designet skal være enkelt, luftigt og let at læse på både mobil og desktop.

## Visuel retning

- Brug en varm sandfarvet sidebaggrund (`#F5F0E6`).
- Placér indholdet i et hvidt kort med let afrundede hjørner, diskret kant og en blød skygge.
- Brug mørkegrå til overskrifter (`#1F2937`) og en lidt lysere grå til brødtekst (`#4B5563`).
- Brug terrakotta (`#A45C40`) som den primære accentfarve til knapper, links og små detaljer. Ved hover kan `#8F4F37` bruges.
- Hold farvebrugen afdæmpet. Terrakotta skal fremhæve handlinger og identitet, ikke dominere mailen.
- Brug en sikker sans-serif skrifttype, fx Arial, Helvetica eller systemets standardfont.
- Indholdet må højst være cirka 600 px bredt og skal have god luft mellem overskrift, tekst og handlinger.
- Undgå store illustrationer, farvegradienter, tunge grafiske elementer og mange forskellige accentfarver.

## Fast opbygning

1. En enkel header med navnet **Sebastian Drumm** og undertitlen **Full Stack Developer**.
2. Et tydeligt hovedindhold med kort overskrift og den vigtigste information først.
3. En eventuel primær knap i terrakotta med hvid tekst.
4. En diskret footer med kontaktoplysninger og link til `sebastiandrumm.dk`.

Logo er ikke nødvendigt. Navnet fungerer som det primære identitetselement. Emojis bør som udgangspunkt undgås i selve maildesignet.

## Sproglig stil

Skriv venligt, direkte og jordnært. Tonen skal være personlig uden at blive privat og professionel uden at blive formel eller stiv.

- Brug korte sætninger og korte afsnit.
- Skriv i første person, når mailen kommer fra Sebastian: “Jeg vender tilbage hurtigst muligt.”
- Henvend dig direkte til modtageren med “du”.
- Brug almindelige danske ord frem for salgssprog og tekniske floskler.
- Undgå overdreven entusiasme, udråbstegn og formuleringer som “fantastisk”, “eksklusiv” eller “vi er begejstrede”.
- Bekræft tydeligt, hvad der er sket, og hvad modtageren kan forvente nu.
- Svar på samme sprog som kontaktformularen blev sendt på. Brug naturligt britisk engelsk i den engelske version.

## Mail til Sebastian

Formålet er hurtigt overblik over en ny besked fra CV-siden.

- Emne: `Ny besked fra CV-siden – [navn]`
- Overskrift: `Ny besked fra din CV-side`
- Vis afsenderens navn og e-mail tydeligt før beskeden.
- Bevar linjeskift i den oprindelige besked.
- Gør afsenderens e-mail til et klikbart `mailto:`-link, så det er nemt at svare.
- Tilføj gerne en terrakottafarvet knap med teksten `Svar [navn]`.
- Tilføj tidspunkt og kilde diskret nederst, fx `Sendt via sebastiandrumm.dk`.

## Kvittering til afsenderen

Kvitteringen skal være kort og menneskelig.

- Emne: `Tak for din besked`
- Dansk tekst: `Hej [navn]. Tak for din besked. Jeg har modtaget den og vender tilbage hurtigst muligt. Venlig hilsen Sebastian Drumm`
- Engelsk tekst: `Hi [name]. Thank you for your message. I have received it and will get back to you as soon as possible. Best regards, Sebastian Drumm`
- Gentag ikke hele den indsendte besked, medmindre der er et konkret behov for det.
- Kvitteringen må ikke lyde som markedsføring eller en automatiseret kundeservicebesked.

## Tekniske krav til HTML-mailen

- Byg layoutet med tabeller og inline CSS, så det fungerer i almindelige mailklienter.
- Lav en læsbar tekstversion som fallback.
- Brug mindst 16 px brødtekst, tydelig linjeafstand og knapper med et tilstrækkeligt stort klikområde.
- Brug ikke JavaScript, formularer, eksterne webfonts eller baggrundsvideo.
- Sørg for god kontrast og meningsfuld linktekst.
- Mailen skal stadig være forståelig, hvis billeder eller ekstern styling blokeres.

## Kort prompt til en mailgenerator

> Skab en enkel, responsiv HTML-mail, som matcher Sebastian Drumms personlige CV-side. Brug varm sand (`#F5F0E6`) som baggrund, et luftigt hvidt indholdskort, mørkegrå tekst (`#1F2937`/`#4B5563`) og terrakotta (`#A45C40`) som afdæmpet accent og knapfarve. Identiteten er “Sebastian Drumm — Full Stack Developer”. Tonen skal være venlig, direkte, jordnær og professionel med korte afsnit og uden salgssprog. Brug inline CSS, sikre sans-serif fonte og et mobilvenligt layout på højst 600 px. Lav også en ren tekstversion.
