import { GoogleAuth } from 'google-auth-library';
import { google } from 'googleapis';

const SPREADSHEET_ID = '1XaPyj6djYszXIrz2rFTDLCSimEYqpF4zUBQnKzwCko4';
const MANYCHAT_TOKEN = '294079850459361:64763e1aa336ca6a4cf8cee68671b6dd';

const credentials = {
  type: 'service_account',
  project_id: 'genuine-tower-402418',
  private_key_id: '54eab65066605ffed6fb91e078fd8f8e866d9519',
  private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n').replace(/"/g, ''),
  client_email: 'test-replit@genuine-tower-402418.iam.gserviceaccount.com',
  client_id: '102008945130618995266',
  token_uri: 'https://oauth2.googleapis.com/token',
};

async function findManyChat(name) {
  try {
    const res = await fetch(`https://api.manychat.com/fb/subscriber/findByName?name=${encodeURIComponent(name)}`, {
      headers: { 'Authorization': `Bearer ${MANYCHAT_TOKEN}` }
    });
    const data = await res.json();
    if (data.status === 'success' && data.data && data.data.length > 0) {
      return String(data.data[0].id);
    }
    return null;
  } catch(e) {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });

    // Read all readers
    const readersRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Foglio1'
    });

    const rows = readersRes.data.values || [];
    if (rows.length < 2) return res.status(200).json({ updated: 0 });

    const headers = rows[0];
    const nameIdx = 0;
    const idIdx = 1;

    // Find rows without MESSENGER_ID
    const toResolve = [];
    rows.slice(1).forEach((row, i) => {
      const name = row[nameIdx] || '';
      const existingId = row[idIdx] || '';
      if (name && !existingId) {
        toResolve.push({ rowIndex: i + 2, name }); // +2 for header and 1-based
      }
    });

    // Resolve in batches of 5 to avoid rate limits
    const results = [];
    for (let i = 0; i < toResolve.length; i += 5) {
      const batch = toResolve.slice(i, i + 5);
      const resolved = await Promise.all(batch.map(async item => ({
        ...item,
        id: await findManyChat(item.name)
      })));
      results.push(...resolved);
      if (i + 5 < toResolve.length) await new Promise(r => setTimeout(r, 500));
    }

    // Update rows with found IDs
    const updates = results.filter(r => r.id);
    for (const item of updates) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Foglio1!B${item.rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[item.id]] }
      });
    }

    res.status(200).json({
      success: true,
      total: toResolve.length,
      updated: updates.length,
      not_found: toResolve.length - updates.length,
      details: results.map(r => ({ name: r.name, id: r.id || 'NOT FOUND' }))
    });

  } catch(e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
