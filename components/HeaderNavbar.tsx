'use client';

import * as React from 'react';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getArabicFormattedDate } from '@/lib/utils';
import {
  Moon,
  Sun,
  Bookmark,
  Timer,
  Radio,
  Calendar,
} from 'lucide-react';

interface HeaderNavbarProps {
  libraryCount: number;
  onOpenLibrary: () => void;
  onOpenSleepTimer: () => void;
  sleepTimerMinutes: number | null;
  nextPrayerName?: string;
  nextPrayerTimeRemaining?: string;
}

export function HeaderNavbar({
  libraryCount,
  onOpenLibrary,
  onOpenSleepTimer,
  sleepTimerMinutes,
  nextPrayerName,
  nextPrayerTimeRemaining,
}: HeaderNavbarProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [dates, setDates] = React.useState({ gregorian: '', hijri: '' });

  React.useEffect(() => {
    setMounted(true);
    setDates(getArabicFormattedDate());
    // Update at midnight
    const interval = setInterval(() => {
      setDates(getArabicFormattedDate());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-card/90 backdrop-blur-md shadow-xs">
      <div className="w-full max-w-[1500px] mx-auto flex h-16 items-center justify-between px-3 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 sm:h-11 sm:w-11 shrink-0 rounded-xl overflow-hidden bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shadow-xs">
            {/* If Logo.png exists, render image; else fallback icon */}
            <Image
              src="/Logo.png"
              alt="شعار إذاعة القرآن الكريم"
              width={44}
              height={44}
              className="object-contain p-0.5"
              onError={(e) => {
                // hide on error and show fallback
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <Radio className="h-5 w-5 text-emerald-600 dark:text-emerald-400 absolute" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                إذاعة القرآن الكريم
              </h1>
              <Badge variant="secondary" className="hidden sm:inline-flex text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 font-medium">
                بث مباشر
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground hidden sm:block">
              صوت الحق والإيمان على مدار الساعة
            </p>
          </div>
        </div>

        {/* Center: Hijri & Gregorian Date pill */}
        <div className="hidden lg:flex items-center gap-2 rounded-full border border-border/80 bg-background/60 px-3.5 py-1 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5 text-emerald-600" />
          <span className="font-medium text-foreground">{dates.hijri || '...'}</span>
          <span className="text-border">&bull;</span>
          <span>{dates.gregorian || '...'}</span>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {/* Next prayer indicator */}
          {nextPrayerName && (
            <div className="hidden md:flex items-center gap-1.5 rounded-full border border-border/80 bg-background/60 px-3 py-1 text-xs text-muted-foreground">
              <span>الصلاة القادمة:</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">{nextPrayerName}</span>
              <span className="text-muted-foreground/70 font-mono text-[11px]">({nextPrayerTimeRemaining})</span>
            </div>
          )}

          {/* Sleep Timer */}
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenSleepTimer}
            className="h-9 px-2.5 sm:px-3 text-xs gap-1.5 border-border/80"
            title="مؤقت النوم التلقائي"
          >
            <Timer className="h-4 w-4 text-emerald-600" />
            <span className="hidden sm:inline">مؤقت النوم</span>
            {sleepTimerMinutes !== null && (
              <Badge variant="secondary" className="mr-1 h-5 px-1.5 text-[10px] bg-emerald-50 text-emerald-700 font-bold">
                {sleepTimerMinutes} د
              </Badge>
            )}
          </Button>

          {/* Saved Recordings Library */}
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenLibrary}
            className="relative h-9 px-2.5 sm:px-3 text-xs gap-1.5 border-border/80"
            title="التسجيلات المحفوظة"
          >
            <Bookmark className="h-4 w-4 text-emerald-600" />
            <span className="hidden sm:inline">التسجيلات</span>
            {libraryCount > 0 && (
              <Badge variant="secondary" className="mr-1 h-5 min-w-5 rounded-full px-1.5 text-[10px] bg-emerald-600 text-white font-bold">
                {libraryCount}
              </Badge>
            )}
          </Button>

          {/* Theme Toggle */}
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
              title="تبديل المظهر"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
