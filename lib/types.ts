export interface QuranStation {
  id: string;
  name: string;
  description: string;
  streamUrl: string;
  category: 'radio' | 'reciter' | 'tafsir';
  reciter?: string;
  country?: string;
}

export interface RecordingClip {
  id: string;
  stationId: string;
  stationName: string;
  timestamp: number;
  duration: number; // in seconds
  blob: Blob;
  url: string;
  sizeBytes: number;
  format: 'mp3' | 'webm' | 'm4a';
}

export interface PrayerTimings {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
}

export interface PrayerTimeInfo {
  name: string;
  arabicName: string;
  time: string;
  isNext: boolean;
  timeRemaining?: string;
}

export interface DailyAyah {
  text: string;
  surahName: string;
  ayahNumber: number;
  translation?: string;
}
