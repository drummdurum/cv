# Railway Deployment Guide

## 🚂 Deploy til Railway

### Forudsætninger
1. En Railway konto (gratis på [railway.app](https://railway.app))
2. Git installeret på din computer
3. GitHub konto (valgfrit, men anbefales)

### Deployment Metoder

#### Metode 1: Via GitHub (Anbefalet)

1. **Opret et GitHub repository:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit - CV website"
   git branch -M main
   git remote add origin https://github.com/DIT-BRUGERNAVN/cv-website.git
   git push -u origin main
   ```

2. **Deploy på Railway:**
   - Gå til [railway.app](https://railway.app)
   - Log ind med GitHub
   - Klik på "New Project"
   - Vælg "Deploy from GitHub repo"
   - Vælg dit repository
   - Railway detecter automatisk Node.js og deployer

3. **Åbn din app:**
   - Klik på dit projekt
   - Gå til "Settings" > "Generate Domain"
   - Din app er nu live på en .railway.app URL!

#### Metode 2: Via Railway CLI

1. **Installer Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login:**
   ```bash
   railway login
   ```

3. **Initialize projekt:**
   ```bash
   railway init
   ```

4. **Deploy:**
   ```bash
   railway up
   ```

5. **Åbn din app:**
   ```bash
   railway open
   ```

### 🔧 Konfiguration

Projektet er allerede konfigureret til Railway med:
- ✅ `railway.json` - Railway configuration
- ✅ Build script der genererer Tailwind CSS
- ✅ Start command i package.json
- ✅ Node.js version specified i engines
- ✅ Production-ready dependencies

### 📝 Vigtige Noter

- Railway bruger environment variable `PORT` (allerede håndteret i server.js)
- Tailwind CSS bliver bygget automatisk under deployment
- Første deployment er gratis, men Railway har begrænsninger på free tier
- Din app får automatisk HTTPS

### 🔄 Continuous Deployment

Hvis du bruger GitHub metoden:
- Hver gang du pusher til `main` branch, deployer Railway automatisk
- Railway viser build logs og deployment status
- Rollback er muligt via Railway dashboard

### 🌐 Custom Domain (Valgfrit)

1. Gå til dit projekt på Railway
2. Klik på "Settings"
3. Scroll ned til "Domains"
4. Tilføj dit custom domain
5. Opdater DNS records hos din domain provider

### 💡 Tips

- Check build logs hvis noget går galt
- Railway free tier har 500 timer/måned
- Du kan tilføje environment variables via Railway dashboard
- Enable "Watch Paths" for at kun re-deploy ved ændringer i specifikke filer

### 🆘 Troubleshooting

**Hvis build fejler:**
- Check Railway build logs
- Verificer at alle dependencies er i package.json
- Sørg for at Node.js version er kompatibel

**Hvis app crasher:**
- Check Railway deployment logs
- Verificer at PORT environment variable bruges korrekt
- Test lokalt først med `npm start`

---

Happy deploying! 🚀
