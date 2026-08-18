export const config = {
  maxDuration: 15,
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'Missing q parameter' });

  try {
    const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(query);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SyntraTravelPlanner/1.0 (contact@example.com)',
        'Accept-Encoding': 'identity',
        'Accept': '*/*',
      },
    });

    const text = await response.text();
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Geocoding failed', body: text.slice(0, 300) });
    }

    const data = JSON.parse(text);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Geocoding error', details: String(error) });
  }
}