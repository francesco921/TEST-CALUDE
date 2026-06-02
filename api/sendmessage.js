const MANYCHAT_TOKEN = process.env.MANYCHAT_TOKEN || '294079850459361:64763e1aa336ca6a4cf8cee68671b6dd';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { subscriber_id, message } = req.body;
    if (!subscriber_id || !message) return res.status(400).json({ error: 'subscriber_id and message required' });

    const response = await fetch('https://api.manychat.com/fb/sending/sendContent', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MANYCHAT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        subscriber_id,
        data: {
          version: 'v2',
          content: {
            messages: [{ type: 'text', text: message }]
          }
        },
        message_tag: 'ACCOUNT_UPDATE'
      })
    });

    const data = await response.json();
    if (data.status === 'success') {
      res.status(200).json({ success: true });
    } else {
      res.status(400).json({ error: data.message || JSON.stringify(data) });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
