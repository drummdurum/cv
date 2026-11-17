const https = require('https');
const http = require('http');
const { randomUUID } = require('crypto');

const postJson = (url, apiKey, payload, endpoint = '/emails/contact', method = 'POST') => new Promise((resolve, reject) => {
  const body = payload === undefined ? '' : JSON.stringify(payload);
  const target = new URL(endpoint, `${url.replace(/\/+$/, '')}/`);
  const request = (target.protocol === 'http:' ? http : https).request({
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port || (target.protocol === 'http:' ? 80 : 443),
    path: target.pathname,
    method,
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

  request.setTimeout(endpoint === '/calendar/replies/sync' ? 45000 : 10000, () => request.destroy(new Error('Mailservice timed out')));
  request.on('error', reject);
  if (body) request.write(body);
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

const sendCalendarInvitation = async payload => {
  const endpoint = process.env.MAIL_CALENDAR_ENDPOINT || '/emails/calendar';
  if (!endpoint || !endpoint.startsWith('/') || endpoint.startsWith('//') || /[?#]/.test(endpoint)) {
    throw new Error('MAIL_CALENDAR_ENDPOINT skal konfigureres til mailservicens kalenderendepunkt.');
  }
  const config = getConfig();
  return postJson(config.serviceUrl, config.apiKey, payload, endpoint);
};

const getCalendarInvitationStatus = async requestId => {
  const config = getConfig();
  return postJson(config.serviceUrl, config.apiKey, undefined,
    `/emails/calendar/${encodeURIComponent(requestId)}`, 'GET');
};

const syncCalendarReplies = async () => {
  const config = getConfig();
  return postJson(config.serviceUrl, config.apiKey, {}, '/calendar/replies/sync');
};

module.exports = { sendContactEmails, sendCalendarInvitation, getCalendarInvitationStatus, syncCalendarReplies };
