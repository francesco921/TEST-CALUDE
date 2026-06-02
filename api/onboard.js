import { GoogleAuth } from 'google-auth-library';
import { google } from 'googleapis';

const SPREADSHEET_ID = '1XaPyj6djYszXIrz2rFTDLCSimEYqpF4zUBQnKzwCko4';

const credentials = {
  type: 'service_account',
  project_id: 'genuine-tower-402418',
  private_key_id: '54eab65066605ffed6fb91e078fd8f8e866d9519',
  private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n').replace(/"/g, ''),
  client_email: 'test-replit@genuine-tower-402418.iam.gserviceaccount.com',
  client_id: '102008945130618995266',
  token_uri: 'https://oauth2.googleapis.com/token',
};

function generateCode() {
  const num = Math.floor(Math.random() * 90000) + 10000;
  return `BR-${num}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { fullName, hasPaypal, paypalEmail, hasAmazon, amazonFifty } = req.body;

    const eligible = hasPaypal === 'yes' && hasAmazon === 'yes' && amazonFifty === 'yes'
      ? 'ELIGIBLE' : 'NON ELIGIBLE';

    const readerCode = generateCode();

    const auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Foglio1',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [[
          fullName,
          '',
          'NEW',
          '',
          eligible === 'ELIGIBLE' ? paypalEmail : '',
          hasAmazon === 'yes' ? 'YES' : 'NO',
          amazonFifty === 'yes' ? 'YES' : 'NO',
          eligible,
          readerCode,
          '', '', '0', ''
        ]]
      }
    });

    res.status(200).json({ success: true, code: readerCode, eligible });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
