// One-time, local OAuth setup for sebastiandrumm.dk. Never prints tokens.
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');

async function main() {
  const filename = process.argv[2];
  if (!filename) throw new Error('Brug: node scripts/connect-google-calendar.js <downloadet-oauth-klient.json>');
  const credentials = JSON.parse(fs.readFileSync(filename, 'utf8')).installed;
  if (!credentials?.client_id || !credentials.client_secret) throw new Error('Download en separat OAuth-klient af typen Desktop app til SebastianDrumm DK.');
  const redirect = 'http://127.0.0.1:53682/oauth2callback';
  const auth = new OAuth2Client(credentials.client_id, credentials.client_secret, redirect);
  const verifier = await auth.generateCodeVerifierAsync();
  const state = crypto.randomBytes(32).toString('hex');
  let consumed = false;
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
    const url = new URL(req.url, redirect);
    if (url.pathname === '/done') {
      res.end('Google Kalender er tilsluttet lokalt. Du kan lukke denne fane.');
      server.close();
      return;
    }
    if (url.pathname !== '/oauth2callback') { res.writeHead(404).end(); return; }
    if (consumed || url.searchParams.get('state') !== state || !url.searchParams.get('code')) {
      res.writeHead(400).end('Godkendelsen kunne ikke bekræftes. Start opsætningen igen.');
      return;
    }
    consumed = true;
    try {
      const { tokens } = await auth.getToken({ code: url.searchParams.get('code'), codeVerifier: verifier.codeVerifier });
      auth.setCredentials(tokens);
      const profile = await auth.request({ url: 'https://openidconnect.googleapis.com/v1/userinfo' });
      if (profile.data.email !== 'sedrumm@gmail.com' || !profile.data.email_verified || !tokens.refresh_token) {
        throw new Error('Godkend med sedrumm@gmail.com og tillad offline-adgang.');
      }
      const folder = path.resolve(__dirname, '../tmp');
      fs.mkdirSync(folder, { recursive: true });
      const output = path.join(folder, 'google-calendar.env');
      const data = { EVENT_CALENDAR_PROVIDER: 'google', GOOGLE_CALENDAR_ACCOUNT: 'sedrumm@gmail.com', GOOGLE_CALENDAR_ID: 'primary',
        GOOGLE_CALENDAR_CLIENT_ID: credentials.client_id, GOOGLE_CALENDAR_CLIENT_SECRET: credentials.client_secret,
        GOOGLE_CALENDAR_REFRESH_TOKEN: tokens.refresh_token };
      fs.writeFileSync(output, Object.entries(data).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n', { mode: 0o600 });
      console.log(`Forbundet som sedrumm@gmail.com. Servervariabler er gemt i ${output}. Del ikke filen eller dens indhold i chat/Git.`);
      res.writeHead(303, { Location: '/done' }).end();
    } catch {
      res.writeHead(400).end('Google-godkendelsen mislykkedes. Kontrollér konto og tilladelser, og start opsætningen igen.');
      server.close();
    }
  });
  server.listen(53682, '127.0.0.1', () => console.log(auth.generateAuthUrl({
    access_type: 'offline', prompt: 'consent', login_hint: 'sedrumm@gmail.com', state,
    scope: ['openid', 'email', 'https://www.googleapis.com/auth/calendar.events.owned'],
    code_challenge: verifier.codeChallenge, code_challenge_method: 'S256'
  })));
  setTimeout(() => server.close(), 30 * 60 * 1000).unref();
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
