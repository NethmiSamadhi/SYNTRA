export const config = {
  maxDuration: 30,
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Missing query' });
  }

  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept-Encoding': 'identity',
        'Accept': '*/*',
        'User-Agent': 'curl/8.0',
      },
      body: 'data=' + encodeURIComponent(query),
    });

    const text = await response.text();

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Overpass returned an error',
        status: response.status,
        body: text.slice(0, 500),
      });
    }

    const data = JSON.parse(text);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch from Overpass', details: String(error) });
  }
}