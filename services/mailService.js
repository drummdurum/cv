const https = require('https');
const { randomUUID } = require('crypto');

const postJson = (url, apiKey, payload) => new Promise((resolve, reject) => {
  const body = JSON.stringify(payload);
  const target = new URL('/emails/contact', `${url.replace(/\/+$/, '')}/`);
  const request = https.request({
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port || 443,
    path: target.pathname,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(body),
      'x-api-key': apiKey
    }
  }, (response) => {
    let responseBody = '';
    response.setEncoding('utf8');
    response.on('data', chunk => { responseBody += chunk; });
    response.on('end', () => {
      if (response.statusCode >= 200 && response.statusCode < 300) {
        try {
          resolve(responseBody ? JSON.parse(responseBody) : {});
        } catch (error) {
          resolve({});
        }
        return;
      }
      const details = responseBody.trim().slice(0, 500);
      reject(new Error(`Mailservice fejlede med status ${response.statusCode}${details ? `: ${details}` : ''}`));
    });
  });

  request.setTimeout(10000, () => request.destroy(new Error('Mailservice timed out')));
  request.on('error', reject);
  request.write(body);
  request.end();
});

const getConfig = () => {
  const apiKey = process.env.MAIL_SERVICE_API_KEY;
  const configuredUrl = process.env.MAIL_SERVICE_URL;
  if (!apiKey || !configuredUrl) throw new Error('MAIL_SERVICE_API_KEY and MAIL_SERVICE_URL must be configured');
  const serviceUrl = /^https?:\/\//i.test(configuredUrl) ? configuredUrl : `https://${configuredUrl}`;
  try {
    const parsedUrl = new URL(serviceUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error();
  } catch (error) {
    throw new Error('MAIL_SERVICE_URL must be a valid HTTP(S) URL');
  }
  return { apiKey, serviceUrl };
};

const sendContactEmails = async ({ name, email, message }) => {
  const config = getConfig();
  return postJson(config.serviceUrl, config.apiKey, {
    requestId: randomUUID(),
    name,
    email,
    subject: 'Besked fra CV-siden',
    message
  });
};

module.exports = { sendContactEmails };
