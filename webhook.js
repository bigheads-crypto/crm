const http = require('http');
const crypto = require('crypto');
const { execSync } = require('child_process');

const SECRET = process.env.SECRET || 'twoj_tajny_klucz';
// Opcjonalne nadpisanie nazwy kontenera crm. Domyślnie wyszukiwany po labelu compose.
const CRM_CONTAINER = process.env.CRM_CONTAINER || '';

function run(cmd) {
  execSync(cmd, { stdio: 'inherit' });
}

function deploy() {
  console.log('Push otrzymany — git pull...');
  // package-lock bywa modyfikowany lokalnie przez npm install w kontenerze — reset przed pull.
  run('git checkout package-lock.json && git pull origin main');

  // Znajdź kontener crm (po labelu compose) i zrestartuj go.
  // Restart kontenera crm uruchamia: npm install --include=dev && npm run build && npm run start
  // z najnowszym kodem z wolumenu — to jest właściwy "deploy" produkcyjny.
  const target =
    CRM_CONTAINER ||
    execSync('docker ps -q -f "label=com.docker.compose.service=crm"').toString().trim();

  if (!target) {
    console.error('Nie znaleziono kontenera crm do restartu (sprawdź docker socket / label).');
    return;
  }

  console.log('Restart kontenera crm:', target);
  run(`docker restart ${target}`);
  console.log('Gotowe — przebudowa w toku w kontenerze crm.');
}

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
    try {
      deploy();
    } catch (err) {
      console.error('Błąd:', err.message);
    }
  });
});

server.listen(9998, () => console.log('Webhook działa na porcie 9998'));
