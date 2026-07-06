// server.js
// Простой сервер верификации: сайт с полями "ник" + "код"
// Код может либо генерировать сам сайт (тогда игрок вводит /verify и видит код в игре),
// либо код кладёт твой плагин через POST /api/register-code.

const express = require('express');
const path = require('path');
const { Rcon } = require('rcon-client'); // npm install rcon-client

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Хранилище кодов (в памяти; для продакшена лучше SQLite/Redis) ---
// nickname -> { code, expiresAt }
const pendingCodes = new Map();

const CODE_TTL_MS = 10 * 60 * 1000; // код живёт 10 минут

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 цифр
}

// --- Настройки RCON (замени на свои после включения RCON на сервере) ---
const RCON_CONFIG = {
  host: process.env.RCON_HOST || '127.0.0.1',
  port: Number(process.env.RCON_PORT) || 27050,
  password: process.env.RCON_PASSWORD || '015ff3565fffhdcc3',
};

async function runRconCommand(command) {
  const rcon = await Rcon.connect(RCON_CONFIG);
  try {
    const response = await rcon.send(command);
    return response;
  } finally {
    await rcon.end();
  }
}

// --------------------------------------------------------------------
// 1) Плагин на майнкрафт-сервере сам генерирует код (когда игрок пишет
//    /verify в игре) и присылает его сюда через HTTP. Защищено секретным
//    ключом, чтобы левые люди не могли слать левые коды.
// --------------------------------------------------------------------
const PLUGIN_SECRET = process.env.PLUGIN_SECRET || 'change_me_too';

app.post('/api/register-code', (req, res) => {
  const auth = req.headers['x-plugin-secret'];
  if (auth !== PLUGIN_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const { nickname, code } = req.body;
  if (!nickname || !code) {
    return res.status(400).json({ error: 'nickname и code обязательны' });
  }

  pendingCodes.set(nickname.toLowerCase(), {
    code: String(code),
    expiresAt: Date.now() + CODE_TTL_MS,
  });

  return res.json({ ok: true });
});

// --------------------------------------------------------------------
// 2) Форма на сайте: игрок вводит ник + код, который ему выдал сервер.
// --------------------------------------------------------------------
app.post('/api/verify', async (req, res) => {
  const { nickname, code } = req.body;
  if (!nickname || !code) {
    return res.status(400).json({ error: 'nickname и code обязательны' });
  }

  const key = nickname.toLowerCase();
  const entry = pendingCodes.get(key);

  if (!entry) {
    return res.status(400).json({ error: 'Код не найден. Сначала получи код на сервере.' });
  }
  if (Date.now() > entry.expiresAt) {
    pendingCodes.delete(key);
    return res.status(400).json({ error: 'Код истёк, запроси новый.' });
  }
  if (entry.code !== String(code).trim()) {
    return res.status(400).json({ error: 'Неверный код.' });
  }

  pendingCodes.delete(key);

  // Успех — делаем нужное действие на сервере через RCON
  try {
    await runRconCommand(`minecraft:whitelist add ${nickname}`);
    // сюда же можно добавить lp user ${nickname} parent add verified и т.д.
  } catch (err) {
    console.error('RCON error:', err);
    return res.status(500).json({ error: 'Не удалось выполнить команду на сервере (проверь RCON).' });
  }

  return res.json({ ok: true, message: `Игрок ${nickname} успешно верифицирован!` });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Verify server running on port ${PORT}`));
