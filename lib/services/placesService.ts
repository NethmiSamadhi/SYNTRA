// lib/services/placesService.ts
const PROXY_URL = 'https://overpass-proxy-six.vercel.app/api/nearby';

export interface PlaceResult {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  types: string[];
}

export interface PlaceSearchParams {
  latitude: number;
  longitude: number;
  radius?: number;
  type?: string;
  keyword?: string;
}

const TYPE_TO_OSM_TAG: Record<string, string> = {
  shopping_mall: 'shop=mall',
  restaurant: 'amenity=restaurant',
  supermarket: 'shop=supermarket',
  electronics_store: 'shop=electronics',
  clothing_store: 'shop=clothes',
  store: 'shop',
  lodging: 'tourism=hotel',
  attraction: 'tourism=attraction',
};

const BUSY_TYPES = ['restaurant', 'clothing_store', 'electronics_store'];

function buildQuery(params: PlaceSearchParams) {
  const { latitude, longitude, type = 'store', keyword } = params;
  const isBusy = BUSY_TYPES.indexOf(type) !== -1;
  const radius = params.radius || (isBusy ? 1500 : 2500);
  const limit = isBusy ? 8 : 12;

  const osmTag = TYPE_TO_OSM_TAG[type] || 'shop';
  const [tagKey, tagValue] = osmTag.split('=');
  const tagFilter = tagValue ? `["${tagKey}"="${tagValue}"]` : `["${tagKey}"]`;
  const nameFilter = keyword ? `["name"~"${keyword.replace(/["\\]/g, '')}",i]` : '';

  const query = `[out:json][timeout:15];(node${tagFilter}${nameFilter}(around:${radius},${latitude},${longitude}););out body ${limit};`;
  return { query, radius, type };
}

async function callProxy(query: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 18000);
  try {
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) return { ok: false as const, status: response.status };
    const data = await response.json();
    return { ok: true as const, data };
  } catch (e) {
    clearTimeout(timeoutId);
    return { ok: false as const, status: 0 };
  }
}

function parseElements(data: any, type: string): PlaceResult[] {
  const elements = data.elements || [];
  const results: PlaceResult[] = [];
  for (const el of elements) {
    if (!el.tags?.name) continue;
    const houseNumber = el.tags['addr:housenumber'] || '';
    const street = el.tags['addr:street'];
    const address = street ? `${houseNumber} ${street}`.trim() : 'Address not available';
    results.push({ id: String(el.id), name: el.tags.name, address, lat: el.lat, lng: el.lon, types: [type] });
  }
  return results;
}

export async function searchNearbyPlaces(params: PlaceSearchParams): Promise<PlaceResult[]> {
  const built = buildQuery(params);
  let attempt = await callProxy(built.query);

  if (!attempt.ok && attempt.status === 429) {
    await new Promise((r) => setTimeout(r, 4000));
    attempt = await callProxy(built.query);
  } else if (!attempt.ok && attempt.status === 504) {
    await new Promise((r) => setTimeout(r, 1500));
    attempt = await callProxy(built.query);
  }

  if (!attempt.ok) return [];

  let results = parseElements(attempt.data, built.type);

  if (results.length === 0) {
    const wider = buildQuery({ ...params, radius: built.radius * 3 });
    const widerAttempt = await callProxy(wider.query);
    if (widerAttempt.ok) results = parseElements(widerAttempt.data, wider.type);
  }

  return results;
}

export function budgetToPriceLevel(budgetAmount: number): number {
  if (budgetAmount < 500) return 1;
  if (budgetAmount < 2000) return 2;
  if (budgetAmount < 5000) return 3;
  return 4;
}