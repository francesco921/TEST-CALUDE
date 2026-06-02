import { GoogleAuth } from 'google-auth-library';
import { google } from 'googleapis';
import FormData from 'form-data';
import fetch from 'node-fetch';

const SPREADSHEET_ID = '1XaPyj6djYszXIrz2rFTDLCSimEYqpF4zUBQnKzwCko4';
const IMGBB_API_KEY = process.env.IMGBB_API_KEY || 'ca4bae83ebeca95e9fed1cb76865e528';

const credentials = {
  type: 'service_account',
  project_id: 'genuine-tower-402418',
  private_key_id: '54eab65066605ffed6fb91e078fd8f8e866d9519',
  private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n').replace(/"/g, ''),
  client_email: 'test-replit@genuine-tower-402418.iam.gserviceaccount.com',
  client_id: '102008945130618995266',
  token_uri: 'https://oauth2.googleapis.com/token',
};

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { readerCode, fullName, email, bookId, bookTitle, imageBase64 } = req.body;

    // Upload image to imgbb
    const form = new FormData();
    form.append('key', IMGBB_API_KEY);
    form.append('image', imageBase64);
    form.append('name', `${readerCode}_${bookId}_${Date.now()}`);

    const imgRes = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: form });
    const imgData = await imgRes.json();

    if (!imgData.success) throw new Error('Image upload failed: ' + JSON.stringify(imgData));

    const screenshotLink = imgData.data.url;

    // Write to Google Sheets
    const auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });

    const assId = `ASS-${Date.now()}`;
    const today = new Date().toISOString().split('T')[0];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'ASSIGNMENTS',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [[
          assId, readerCode, fullName, '', bookId, bookTitle,
          today, screenshotLink, 'PENDING', '2.5', ''
        ]]
      }
    });

    res.status(200).json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
