'use client';

import * as React from 'react';
import { QuranStation } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Radio,
  Loader2,
  RotateCcw,
} from 'lucide-react';

interface LiveAudioPlayerProps {
  station: QuranStation;
  isPlaying: boolean;
  isLoading: boolean;
  volume: number;
  isMuted: boolean;
  onTogglePlay: () => void;
  onVolumeChange: (val: number) => void;
  onToggleMute: () => void;
  onReconnect: () => void;
}

export function LiveAudioPlayer({
  station,
  isPlaying,
  isLoading,
  volume,
  isMuted,
  onTogglePlay,
  onVolumeChange,
  onToggleMute,
  onReconnect,
}: LiveAudioPlayerProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 sm:p-7 shadow-sm flex flex-col justify-between">
      {/* Background soft ambient gradient */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top station info bar */}
      <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1 max-w-xl">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-[11px] font-medium border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40"
            >
              {station.category === 'radio' && 'إذاعة رسمية'}
              {station.category === 'reciter' && 'مصحف مرتل'}
              {station.category === 'tafsir' && 'تفسير وخواطر'}
            </Badge>

            {station.country && (
              <span className="text-xs text-muted-foreground font-medium">
                {station.country}
              </span>
            )}
          </div>

          <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground">
            {station.name}
          </h2>

          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {station.description}
          </p>
        </div>

        {/* Live indicator badge */}
        <div className="flex items-center gap-2">
          {isPlaying ? (
            <div className="flex items-center gap-2 rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
              </span>
              <span>بث حي مباشر</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-full border border-border/80 bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-slate-400" />
              <span>جاهز للتشغيل</span>
            </div>
          )}
        </div>
      </div>

      {/* Center: Live Waveform Visualizer & Animation */}
      <div className="relative z-10 my-6 sm:my-8 flex flex-col items-center justify-center">
        <div className="flex items-center justify-center gap-1.5 h-12 w-full max-w-md">
          {[
            'animate-wave-1',
            'animate-wave-2',
            'animate-wave-3',
            'animate-wave-4',
            'animate-wave-5',
            'animate-wave-2',
            'animate-wave-1',
            'animate-wave-3',
            'animate-wave-4',
            'animate-wave-2',
            'animate-wave-5',
            'animate-wave-1',
            'animate-wave-3',
            'animate-wave-4',
            'animate-wave-2',
            'animate-wave-1',
          ].map((animClass, idx) => (
            <span
              key={idx}
              className={`w-1 rounded-full bg-emerald-600 dark:bg-emerald-500 transition-all duration-300 ${
                isPlaying ? animClass : 'h-1.5 opacity-30'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Bottom control row */}
      <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border/70">
        {/* Play/Pause primary action */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-center sm:justify-start">
          <Button
            size="lg"
            onClick={onTogglePlay}
            disabled={isLoading}
            className="h-12 px-6 rounded-full font-semibold gap-2.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all hover:scale-105 active:scale-95"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>جاري الاتصال...</span>
              </>
            ) : isPlaying ? (
              <>
                <Pause className="h-5 w-5 fill-current" />
                <span>إيقاف مؤقت</span>
              </>
            ) : (
              <>
                <Play className="h-5 w-5 fill-current" />
                <span>تشغيل الإذاعة</span>
              </>
            )}
          </Button>

          {/* Reconnect button if stream stalled */}
          <Button
            variant="outline"
            size="icon"
            onClick={onReconnect}
            title="تحديث اتصال البث"
            className="h-10 w-10 rounded-full border-border/80 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        {/* Volume & Audio settings */}
        <div className="flex items-center gap-3 w-full sm:w-auto min-w-[200px] justify-center sm:justify-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleMute}
            className="h-9 w-9 text-muted-foreground hover:text-foreground shrink-0"
            title={isMuted ? 'إلغاء الكتم' : 'كتم الصوت'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="h-4 w-4 text-rose-500" />
            ) : (
              <Volume2 className="h-4 w-4 text-emerald-600" />
            )}
          </Button>

          <div className="w-28 sm:w-36">
            <Slider
              value={[isMuted ? 0 : volume]}
              min={0}
              max={1}
              step={0.01}
              onValueChange={([val]) => onVolumeChange(val)}
              className="py-1 cursor-pointer"
            />
          </div>

          <span className="text-xs font-mono text-muted-foreground w-9 text-left">
            {isMuted ? '0%' : `${Math.round(volume * 100)}%`}
          </span>
        </div>
      </div>
    </div>
  );
}
