# Sebastian Drumm CV Website

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
