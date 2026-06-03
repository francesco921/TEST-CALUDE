import { GoogleAuth } from 'google-auth-library';
import { google } from 'googleapis';

const SPREADSHEET_ID = '1XaPyj6djYszXIrz2rFTDLCSimEYqpF4zUBQnKzwCko4';
const SHEET_NAME = 'TEST EMAIL REVIEWERS';
const MAILERLITE_API_KEY = process.env.MAILERLITE_API_KEY || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI0IiwianRpIjoiYzZiZGRhNWY0NjRmMTY2ZGZjMGMwNzg5OWZlMDU1Mzc3YmIxMjViM2IyNjI5OWZmMjFlY2FkMDc1YTExOTA4NmQwMTJjMTRhNjM2YThkN2YiLCJpYXQiOjE3ODA0ODMxOTEuMDMxNjU0LCJuYmYiOjE3ODA0ODMxOTEuMDMxNjU5LCJleHAiOjQ5MzYxNTY3OTEuMDI2OTMzLCJzdWIiOiIyMTMwNTE1Iiwic2NvcGVzIjpbXX0.IsUhaPco3Wi1BjpSiBw3Rl_-5akD31qvy7wkWo5PHb-5djjWQMOfK-k4cuW4sGfGJQbjGO0BDm5HAv_IB1zxZl3159cukGhV3mMabkWx9m0gWTRvncRt9BTfpBm9vgudWJ_MoB3fmXGEXvWazEo5G_iPACxljtKFSMhVxqM2zwaJCxMvZRHzYwp41C9gAp18oPGx414jzIzCw-GL2Jz-Sbp8RMZmj3uDUG-LIMqhIaHCdqvN_xMqOrYbhhwTxeyme60kWPghcwuvYfYl_XOS_E9vbKTs1q-At2Xwi36qN_JgWI7IGGNLeTKiL5bHmM92dUbc5483fCDPDmA6oAAH3Rq4DNYKadCKzuhwa4XGG_ktXRySFCJM8slSisaqrqVAOf9_mLDBjJ00ATkGgdRKHvSO99aPeRwhTpycnL7L-OcU6t98TRS0zkTD_DITXjgdWq-MkzQg57pMZKctQ7uKK77NFzii6pfq1BDBpTBGJoA7uIJAhkXkr1DB2h5mV_dpJSE557h3Wr9oR-83kxE92SAAxO1t-c0sKklhrPs-fTsWyBIx9DlWMKoElguW5kK2h01NlLW_tSDfqBpXIDbiitCHTPj5hDpQI7lCeYA0m4_nUpxEKxMXD2my6YWHM0aPcD1iVhzEGY_61ixB49GATHADjhzYygOysCyzfirU5OM';
const MAILERLITE_ELIGIBLE_GROUP = '189248790428910730'; // TEST EMAIL REVIEWERS group
const MAILERLITE_REJECTED_GROUP = '189249053456860332';

const credentials = {
  type: 'service_account',
  project_id: 'genuine-tower-402418',
  private_key_id: '54eab65066605ffed6fb91e078fd8f8e866d9519',
  private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n').replace(/"/g, ''),
  client_email: 'test-replit@genuine-tower-402418.iam.gserviceaccount.com',
  client_id: '102008945130618995266',
  token_uri: 'https://oauth2.googleapis.com/token',
};

function generateReaderCode() {
  const num = Math.floor(10000 + Math.random() * 90000);
  return `BR-${num}`;
}

async function addToMailerLite(name, email, readerCode, groupId, fields = {}) {
  const payload = {
    email,
    fields: {
      name,
      reader_code: readerCode,
      ...fields
    },
    groups: [groupId],
    status: 'active'
  };

  const res = await fetch('https://connect.mailerlite.com/api/subscribers', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MAILERLITE_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return await res.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      name,
      email,
      has_paypal,      // "Yes" or "No"
      paypal_email,
      has_amazon,      // "Yes" or "No"
      amazon_fifty     // "Yes" or "No"
    } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'name and email are required' });
    }

    const isEligible = 
      has_paypal?.toLowerCase() === 'yes' &&
      has_amazon?.toLowerCase() === 'yes' &&
      amazon_fifty?.toLowerCase() === 'yes';

    const eligible = isEligible ? 'ELIGIBLE' : 'NON ELIGIBLE';
    const readerCode = generateReaderCode();
    const today = new Date().toISOString().split('T')[0];

    // Write to Google Sheets
    const auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [[
          name,
          email,
          isEligible ? (paypal_email || '') : '',
          has_amazon?.toLowerCase() === 'yes' ? 'YES' : 'NO',
          amazon_fifty?.toLowerCase() === 'yes' ? 'YES' : 'NO',
          eligible,
          isEligible ? readerCode : '',
          '',  // LIST_TAG - to be assigned manually
          '0', // BOOKS_SENT
          '0', // BOOKS_REVIEWED
          '0', // BOOKS_PAID
          today,
          ''   // NOTES
        ]]
      }
    });

    // Add to MailerLite
    const groupId = isEligible ? MAILERLITE_ELIGIBLE_GROUP : MAILERLITE_REJECTED_GROUP;
    
    if (groupId && MAILERLITE_API_KEY) {
      await addToMailerLite(name, email, isEligible ? readerCode : '', groupId, {
        paypal_email: isEligible ? (paypal_email || '') : '',
        eligible: eligible
      });
    }

    res.status(200).json({
      success: true,
      eligible,
      reader_code: isEligible ? readerCode : null,
      name,
      email
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
