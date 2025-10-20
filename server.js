// server.js
import express from 'express';
import crypto from 'crypto';
import { google } from 'googleapis';

const app = express();
app.use(express.json());

// === настройки из env ===
const BOT_TOKEN = process.env.BOT_TOKEN;             // токен твоего Telegram-бота (для проверки подписи initData)
const SHEET_ID  = process.env.SHEET_ID;              // ID таблицы Google (длинная строка из URL)
const SA_JSON   = process.env.GOOGLE_CREDENTIALS;    // JSON сервис-аккаунта (полный JSON в одной строке)

if (!SHEET_ID || !SA_JSON) {
  console.error('Missing SHEET_ID or GOOGLE_CREDENTIALS env vars');
}

// === Google Sheets клиент ===
function getSheetsClient() {
  const creds = JSON.parse(SA_JSON);
  const jwt = new google.auth.JWT(
    creds.client_email,
    null,
    creds.private_key,
    ['https://www.googleapis.com/auth/spreadsheets']
  );
  return google.sheets({ version: 'v4', auth: jwt });
}

// === Проверка подписи от Telegram WebApp (initData) ===
// (рекомендуется, но можно отключить на тесте)
function checkTelegramInitData(initData) {
  if (!BOT_TOKEN) return true; // если токена нет, пропускаем проверку (не рекомендуется)
  const data = new URLSearchParams(initData);
  const hash = data.get('hash');
  data.delete('hash');
  const sorted = [...data.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const calcHash = crypto.createHmac('sha256', secretKey).update(sorted).digest('hex');
  return calcHash === hash;
}

// === Приём заказа ===
app.post('/api/submit', async (req, res) => {
  try {
    // Тело приходит из твоего фронта: { date_ymd, user, items, initData }
    const { date_ymd, user, items, initData } = req.body || {};

    // 1) (опционально) проверка подписи Telegram WebApp
    if (initData && !checkTelegramInitData(initData)) {
      return res.status(401).json({ ok: false, message: 'Bad Telegram initData' });
    }

    // 2) валидация
    if (!date_ymd || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ ok: false, message: 'Invalid payload' });
    }

    // 3) готовим строки для листа Raw
    // Лист Raw должен иметь заголовки: date_ymd | user_id | user_name | item | qty
    const values = items.map(it => ([
      date_ymd,
      user?.id ?? '',
      `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim(),
      it.name,
      it.qty
    ]));

    // 4) пишем в таблицу
    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Raw!A:E',
      valueInputOption: 'RAW',
      requestBody: { values }
    });

    return res.json({ ok: true, message: 'saved', rows: values.length });
  } catch (e) {
    console.error('submit error', e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// healthcheck (полезно для Railway)
app.get('/healthz', (_, res) => res.send('ok'));

// статика твоего фронта:
app.use(express.static('public')); // если фронт лежит в /public

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('listening on', PORT));
