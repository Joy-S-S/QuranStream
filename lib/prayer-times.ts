import { PrayerTimings, PrayerTimeInfo } from './types';
import { formatPrayerTime } from './utils';

export interface CityPreset {
  id: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  method: number;
}

export const CITIES: CityPreset[] = [
  { id: 'cairo', name: 'القاهرة', country: 'مصر', latitude: 30.0444, longitude: 31.2357, method: 5 },
  { id: 'alexandria', name: 'الإسكندرية', country: 'مصر', latitude: 31.2001, longitude: 29.9187, method: 5 },
  { id: 'makkah', name: 'مكة المكرمة', country: 'السعودية', latitude: 21.3891, longitude: 39.8579, method: 4 },
  { id: 'medina', name: 'المدينة المنورة', country: 'السعودية', latitude: 24.5247, longitude: 39.5692, method: 4 },
  { id: 'riyadh', name: 'الرياض', country: 'السعودية', latitude: 24.7136, longitude: 46.6753, method: 4 },
  { id: 'jerusalem', name: 'القدس الشريف', country: 'فلسطين', latitude: 31.7683, longitude: 35.2137, method: 3 },
  { id: 'dubai', name: 'دبي', country: 'الإمارات', latitude: 25.2048, longitude: 55.2708, method: 8 },
];

const DEFAULT_TIMINGS: PrayerTimings = {
  Fajr: '04:45',
  Sunrise: '06:12',
  Dhuhr: '11:45',
  Asr: '14:55',
  Maghrib: '17:18',
  Isha: '18:38',
};

export async function fetchPrayerTimings(city: CityPreset): Promise<PrayerTimings> {
  const cacheKey = `prayer_timings_${city.id}_${new Date().toISOString().slice(0, 10)}`;
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // invalid cache
      }
    }
  }

  try {
    const dateStr = new Date().toISOString().slice(0, 10);
    const url = `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${city.latitude}&longitude=${city.longitude}&method=${city.method}`;
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error('Failed to fetch prayer times');
    const data = await res.json();
    const timings: PrayerTimings = data.data.timings;

    if (typeof window !== 'undefined') {
      localStorage.setItem(cacheKey, JSON.stringify(timings));
    }
    return timings;
  } catch (error) {
    console.warn('Aladhan API unavailable, using default timings:', error);
    return DEFAULT_TIMINGS;
  }
}

export function calculateNextPrayer(timings: PrayerTimings): {
  prayers: PrayerTimeInfo[];
  nextPrayer: PrayerTimeInfo | null;
  timeRemainingStr: string;
} {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const prayerDefs = [
    { key: 'Fajr', arabic: 'الفجر' },
    { key: 'Sunrise', arabic: 'الشروق' },
    { key: 'Dhuhr', arabic: 'الظهر' },
    { key: 'Asr', arabic: 'العصر' },
    { key: 'Maghrib', arabic: 'المغرب' },
    { key: 'Isha', arabic: 'العشاء' },
  ] as const;

  let nextPrayerIndex = -1;
  let minDifference = Infinity;

  const prayers: PrayerTimeInfo[] = prayerDefs.map((p, idx) => {
    const time24 = timings[p.key as keyof PrayerTimings] || '00:00';
    const [h, m] = time24.split(':').map(Number);
    const prayerMinutes = h * 60 + m;

    let diff = prayerMinutes - currentMinutes;
    if (diff < 0) {
      diff += 24 * 60; // Next day
    }

    if (diff > 0 && diff < minDifference && p.key !== 'Sunrise') {
      minDifference = diff;
      nextPrayerIndex = idx;
    }

    return {
      name: p.key,
      arabicName: p.arabic,
      time: formatPrayerTime(time24),
      isNext: false,
    };
  });

  if (nextPrayerIndex === -1) {
    nextPrayerIndex = 0; // Fajr next day
  }

  prayers[nextPrayerIndex].isNext = true;

  const hoursRemaining = Math.floor(minDifference / 60);
  const minutesRemaining = minDifference % 60;
  const timeRemainingStr = `${hoursRemaining > 0 ? `${hoursRemaining} س و ` : ''}${minutesRemaining} د`;

  return {
    prayers,
    nextPrayer: prayers[nextPrayerIndex],
    timeRemainingStr,
  };
}
