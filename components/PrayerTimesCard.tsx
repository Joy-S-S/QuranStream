'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CITIES, CityPreset, calculateNextPrayer, fetchPrayerTimings } from '@/lib/prayer-times';
import { PrayerTimings, PrayerTimeInfo } from '@/lib/types';
import { Clock, MapPin, Navigation } from 'lucide-react';

interface PrayerTimesCardProps {
  onNextPrayerChange?: (name: string, remaining: string) => void;
}

export function PrayerTimesCard({ onNextPrayerChange }: PrayerTimesCardProps) {
  const [selectedCity, setSelectedCity] = React.useState<CityPreset>(CITIES[0]); // Cairo default
  const [timings, setTimings] = React.useState<PrayerTimings | null>(null);
  const [prayersInfo, setPrayersInfo] = React.useState<PrayerTimeInfo[]>([]);
  const [nextPrayer, setNextPrayer] = React.useState<PrayerTimeInfo | null>(null);
  const [timeRemaining, setTimeRemaining] = React.useState<string>('');

  // Load timings when city changes
  React.useEffect(() => {
    let active = true;
    fetchPrayerTimings(selectedCity).then((data) => {
      if (active) {
        setTimings(data);
      }
    });
    return () => {
      active = false;
    };
  }, [selectedCity]);

  // Recalculate next prayer every minute
  React.useEffect(() => {
    if (!timings) return;
    const update = () => {
      const res = calculateNextPrayer(timings);
      setPrayersInfo(res.prayers);
      setNextPrayer(res.nextPrayer);
      setTimeRemaining(res.timeRemainingStr);

      if (onNextPrayerChange && res.nextPrayer) {
        onNextPrayerChange(res.nextPrayer.arabicName, res.timeRemainingStr);
      }
    };

    update();
    const interval = setInterval(update, 30000); // every 30s
    return () => clearInterval(interval);
  }, [timings, onNextPrayerChange]);

  const handleCityChange = (cityId: string) => {
    const found = CITIES.find((c) => c.id === cityId);
    if (found) {
      setSelectedCity(found);
    }
  };

  const handleUseGeolocation = () => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const customCity: CityPreset = {
            id: 'my-location',
            name: 'موقعي الحالي',
            country: 'تحديد تلقائي',
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            method: 5,
          };
          setSelectedCity(customCity);
        },
        (err) => {
          console.warn('Geolocation denied:', err);
        }
      );
    }
  };

  return (
    <Card className="border-border/80 shadow-xs bg-card">
      <CardHeader className="pb-3 pt-4 px-4 sm:px-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-emerald-600" />
            <CardTitle className="text-sm font-bold">مواقيت الصلاة</CardTitle>
          </div>

          {/* City selector dropdown */}
          <div className="flex items-center gap-1.5">
            <Select value={selectedCity.id} onValueChange={handleCityChange}>
              <SelectTrigger className="h-8 text-xs gap-1.5 w-[130px] border-border/80 bg-background/50">
                <MapPin className="h-3 w-3 text-muted-foreground" />
                <SelectValue placeholder="اختر المدينة" />
              </SelectTrigger>
              <SelectContent align="end">
                {CITIES.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    {c.name} ({c.country})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <button
              type="button"
              onClick={handleUseGeolocation}
              className="h-8 w-8 rounded-md border border-border/80 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title="تحديد الموقع التلقائي (GPS)"
            >
              <Navigation className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Next prayer countdown pill */}
        {nextPrayer && (
          <div className="flex items-center justify-between bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 rounded-xl px-3 py-1.5 mt-2 text-xs">
            <div className="flex items-center gap-1.5 text-emerald-900 dark:text-emerald-200 font-medium">
              <span>الصلاة القادمة:</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-300">
                {nextPrayer.arabicName} ({nextPrayer.time})
              </span>
            </div>
            <Badge variant="secondary" className="bg-emerald-600 text-white text-[10px] py-0 px-2 font-mono">
              باقي {timeRemaining}
            </Badge>
          </div>
        )}
      </CardHeader>

      <CardContent className="px-4 sm:px-5 pb-4">
        {/* Prayers Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          {prayersInfo.map((p) => (
            <div
              key={p.name}
              className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all ${
                p.isNext
                  ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 font-semibold shadow-xs'
                  : 'border-border/60 bg-muted/20 text-muted-foreground'
              }`}
            >
              <span className="text-[11px] font-medium">{p.arabicName}</span>
              <span className={`font-mono text-xs ${p.isNext ? 'font-bold text-emerald-700 dark:text-emerald-300' : 'text-foreground'}`}>
                {p.time}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
