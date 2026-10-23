'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Copy, Check, Sparkles, RefreshCw } from 'lucide-react';
import { DailyAyah } from '@/lib/types';

const AYAT_LIST: DailyAyah[] = [
  {
    text: 'وَإِذَا سَأَلَكَ عِبَادِي عَنِّي فَإِنِّي قَرِيبٌ ۖ أُجِيبُ دَعْوَةَ الدَّاعِ إِذَا دَعَانِ ۖ فَلْيَسْتَجِيبُوا لِي وَلْيُؤْمِنُوا بِي لَعَلَّهُمْ يَرْشُدُونَ',
    surahName: 'سورة البقرة',
    ayahNumber: 186,
  },
  {
    text: 'أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ',
    surahName: 'سورة الرعد',
    ayahNumber: 28,
  },
  {
    text: 'وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا وَيَرْزُقْهُ مِنْ حَيْثُ لَا يَحْتَسِبُ ۚ وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ',
    surahName: 'سورة الطلاق',
    ayahNumber: 2,
  },
  {
    text: 'فَاذْكُرُونِي أَذْكُرْكُمْ وَاشْكُرُوا لِي وَلَا تَكْفُرُونِ',
    surahName: 'سورة البقرة',
    ayahNumber: 152,
  },
  {
    text: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا',
    surahName: 'سورة الشرح',
    ayahNumber: 6,
  },
  {
    text: 'رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا وَهَبْ لَنَا مِن لَّدُنكَ رَحْمَةً ۚ إِنَّكَ أَنتَ الْوَهَّابُ',
    surahName: 'سورة آل عمران',
    ayahNumber: 8,
  },
];

export function DailyAyahCard() {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    // Pick based on day of month
    const day = new Date().getDate();
    setCurrentIndex(day % AYAT_LIST.length);
  }, []);

  const currentAyah = AYAT_LIST[currentIndex];

  const handleCopy = () => {
    const textToCopy = `"${currentAyah.text}" [${currentAyah.surahName}: ${currentAyah.ayahNumber}]`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast.success('تم نسخ الآية الكريمة بنجاح');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNextAyah = () => {
    setCurrentIndex((prev) => (prev + 1) % AYAT_LIST.length);
  };

  return (
    <Card className="border-border/80 shadow-xs bg-card overflow-hidden relative">
      <CardHeader className="pb-2 pt-4 px-4 sm:px-5 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-emerald-600" />
          <CardTitle className="text-sm font-bold">آية وتدبر</CardTitle>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextAyah}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="آية أخرى"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="نسخ الآية"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="px-4 sm:px-5 pb-4 space-y-3">
        {/* Quranic Verse rendered in Amiri Quran font */}
        <div className="p-3.5 rounded-xl bg-muted/20 border border-border/50 text-center">
          <p className="font-quran text-lg sm:text-xl leading-loose text-foreground font-medium select-text">
            &ldquo;{currentAyah.text}&rdquo;
          </p>

          <span className="block mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 font-sans">
            [{currentAyah.surahName}: {currentAyah.ayahNumber}]
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
