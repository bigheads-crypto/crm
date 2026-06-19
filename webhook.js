const http = require('http');
const crypto = require('crypto');
const { execSync } = require('child_process');

const SECRET = process.env.SECRET || 'twoj_tajny_klucz';

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/webhook') {
    res.writeHead(404); res.end(); return;
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    const sig = 'sha256=' + crypto
      .createHmac('sha256', SECRET)
      .update(body)
      .digest('hex');

    if (req.headers['x-hub-signature-256'] !== sig) {
      res.writeHead(401); res.end('Unauthorized'); return;
    }

    res.writeHead(200); res.end('OK');
    console.log('Push otrzymany — git pull...');
    try {
      execSync('git checkout package-lock.json && git pull origin main && npm install', { stdio: 'inherit' });
      console.log('Gotowe');
    } catch (err) {
      console.error('Błąd:', err.message);
    }
  });
});

server.listen(9998, () => console.log('Webhook działa na porcie 9998'));
