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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { book, list, dry_run } = req.method === 'POST' ? req.body : req.query;
    if (!book || !list) return res.status(400).json({ error: 'book and list params required' });

    const auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });

    // Read BOOKS sheet
    const booksRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: 'BOOKS'
    });
    const booksRows = booksRes.data.values || [];
    const booksHeaders = booksRows[0];
    const bookRow = booksRows.slice(1).find(r => r[0] === book);
    if (!bookRow) return res.status(404).json({ error: `Book ${book} not found` });
    const bookTitle = bookRow[1];
    const shareList = bookRow[2] ? bookRow[2].split(',').map(s => s.trim()) : [];
    if (!shareList.includes(list)) {
      return res.status(400).json({ error: `Book ${book} is not in list ${list}. Share lists: ${shareList.join(', ')}` });
    }

    // Read READERS sheet
    const readersRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: 'Foglio1'
    });
    const readersRows = readersRes.data.values || [];
    const eligibleReaders = readersRows.slice(1).filter(r => {
      const eligible = r[7] || '';
      const listTag = r[3] || '';
      return eligible === 'ELIGIBLE' && listTag === list;
    });

    // Read ASSIGNMENTS to check pending count and already assigned
    const assignRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: 'ASSIGNMENTS'
    });
    const assignRows = assignRes.data.values || [];
    const assignments = assignRows.slice(1);

    // Count pending per reader code and check who already has this book
    const pendingCount = {};
    const alreadyAssigned = new Set();
    assignments.forEach(a => {
      const readerCode = a[1]; // MESSENGER_ID used as reader code
      const bookId = a[4];
      const status = a[8];
      if (status === 'PENDING') {
        pendingCount[readerCode] = (pendingCount[readerCode] || 0) + 1;
      }
      if (bookId === book) alreadyAssigned.add(readerCode);
    });

    // Filter eligible readers
    const toAssign = [];
    const skipped = [];
    eligibleReaders.forEach(r => {
      const name = r[0];
      const messengerId = r[1] || '';
      const readerCode = r[8] || messengerId; // NOTES column has reader code
      const pending = pendingCount[readerCode] || 0;
      const alreadyHas = alreadyAssigned.has(readerCode);

      if (alreadyHas) {
        skipped.push({ name, reason: 'already has this book' });
      } else if (pending >= 2) {
        skipped.push({ name, reason: `${pending} books pending (max 2)` });
      } else {
        toAssign.push({ name, messengerId, readerCode });
      }
    });

    const submitLink = `https://test-calude.vercel.app/submit?book=${book}&title=${encodeURIComponent(bookTitle)}`;

    if (dry_run === 'true' || dry_run === true) {
      return res.status(200).json({
        success: true,
        dry_run: true,
        book, bookTitle, list,
        to_assign: toAssign,
        skipped,
        submit_link: submitLink,
        message_template: `Hi! Here's your next book to review: "${bookTitle}". Please read it and submit your review here: ${submitLink}`
      });
    }

    // Write assignments to sheet
    if (toAssign.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      const rows = toAssign.map((r, i) => [
        `ASS-${Date.now()}-${i}`,
        r.readerCode,
        r.name,
        list,
        book,
        bookTitle,
        today,
        '',
        'PENDING',
        '2.5',
        ''
      ]);
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'ASSIGNMENTS',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: rows }
      });
    }

    res.status(200).json({
      success: true,
      book, bookTitle, list,
      assigned: toAssign.length,
      skipped: skipped.length,
      to_assign: toAssign,
      skipped_details: skipped,
      submit_link: submitLink,
      message_template: `Hi! Here's your next book to review: "${bookTitle}". Please read it and submit your review here: ${submitLink}`
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
