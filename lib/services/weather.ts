// lib/services/weather.ts
// Uses Open-Meteo — free, no API key required

export interface DailyForecast {
  date: string;
  maxTemp: number;
  minTemp: number;
  precipitationChance: number;
  condition: string;
}

function weatherCodeToCondition(code: number): string {
  if (code === 0) return 'Clear sky';
  if (code <= 3) return 'Partly cloudy';
  if (code <= 48) return 'Foggy';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rainy';
  if (code <= 77) return 'Snowy';
  if (code <= 82) return 'Rain showers';
  if (code <= 99) return 'Thunderstorm';
  return 'Unknown';
}

export async function getWeatherForecast(
  lat: number,
  lng: number,
  days: number
): Promise<DailyForecast[]> {
  try {
    const clampedDays = Math.min(Math.max(days, 1), 16);
    const url =
      'https://api.open-meteo.com/v1/forecast?latitude=' +
      lat +
      '&longitude=' +
      lng +
      '&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=' +
      clampedDays;

    const response = await fetch(url);
    if (!response.ok) return [];

    const data = await response.json();
    const daily = data.daily;
    if (!daily || !daily.time) return [];

    const forecasts: DailyForecast[] = [];
    for (let i = 0; i < daily.time.length; i++) {
      forecasts.push({
        date: daily.time[i],
        maxTemp: daily.temperature_2m_max[i],
        minTemp: daily.temperature_2m_min[i],
        precipitationChance: daily.precipitation_probability_max[i] || 0,
        condition: weatherCodeToCondition(daily.weathercode[i]),
      });
    }
    return forecasts;
  } catch {
    return [];
  }
}