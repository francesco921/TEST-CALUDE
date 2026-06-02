import { GoogleAuth } from 'google-auth-library';
import { google } from 'googleapis';
import { Readable } from 'stream';

const SPREADSHEET_ID = '1XaPyj6djYszXIrz2rFTDLCSimEYqpF4zUBQnKzwCko4';

const credentials = {
  type: 'service_account',
  project_id: 'genuine-tower-402418',
  private_key_id: '54eab65066605ffed6fb91e078fd8f8e866d9519',
  private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
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
    const { readerCode, fullName, email, bookId, bookTitle, imageBase64, imageMime } = req.body;

    const auth = new GoogleAuth({ credentials, scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive'
    ]});

    const drive = google.drive({ version: 'v3', auth });
    const sheets = google.sheets({ version: 'v4', auth });

    // Upload image to Drive folder "SCREENSHOTS"
    const buffer = Buffer.from(imageBase64, 'base64');
    const stream = Readable.from(buffer);
    const filename = `${readerCode}_${bookId}_${Date.now()}.jpg`;

    // Find or create SCREENSHOTS folder
    let folderId;
    const folderSearch = await drive.files.list({
      q: "name='SCREENSHOTS' and mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: 'files(id)'
    });
    if (folderSearch.data.files.length > 0) {
      folderId = folderSearch.data.files[0].id;
    } else {
      const folder = await drive.files.create({
        requestBody: { name: 'SCREENSHOTS', mimeType: 'application/vnd.google-apps.folder' },
        fields: 'id'
      });
      folderId = folder.data.id;
    }

    const uploaded = await drive.files.create({
      requestBody: { name: filename, parents: [folderId] },
      media: { mimeType: imageMime || 'image/jpeg', body: stream },
      fields: 'id, webViewLink'
    });

    // Make file publicly viewable
    await drive.permissions.create({
      fileId: uploaded.data.id,
      requestBody: { role: 'reader', type: 'anyone' }
    });

    const screenshotLink = `https://drive.google.com/uc?id=${uploaded.data.id}`;

    // Generate assignment ID
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
