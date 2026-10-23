'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Mic,
  Radio,
  Circle,
  Pause,
  Play,
  Square,
  Sparkles,
} from 'lucide-react';
import { formatTime } from '@/lib/utils';

interface AudioRecorderHUDProps {
  isRecording: boolean;
  isPaused: boolean;
  elapsedSeconds: number;
  audioLevel: number; // 0 to 100
  recordingSource: 'radio' | 'mic';
  onSourceChange: (source: 'radio' | 'mic') => void;
  onStart: () => void;
  onPauseToggle: () => void;
  onStop: () => void;
  disabled?: boolean;
}

export function AudioRecorderHUD({
  isRecording,
  isPaused,
  elapsedSeconds,
  audioLevel,
  recordingSource,
  onSourceChange,
  onStart,
  onPauseToggle,
  onStop,
  disabled,
}: AudioRecorderHUDProps) {
  const isActive = isRecording || isPaused;

  return (
    <Card className="p-4 sm:p-5 border-border/80 shadow-xs bg-card">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Left: Source selector & Status */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          {/* Source toggles if idle */}
          {!isActive && (
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/60 border border-border/60 text-xs w-full sm:w-auto justify-center">
              <button
                type="button"
                onClick={() => onSourceChange('radio')}
                disabled={disabled}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all ${
                  recordingSource === 'radio'
                    ? 'bg-card text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Radio className="h-3.5 w-3.5 text-emerald-600" />
                <span>تسجيل البث المباشر</span>
              </button>

              <button
                type="button"
                onClick={() => onSourceChange('mic')}
                disabled={disabled}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all ${
                  recordingSource === 'mic'
                    ? 'bg-card text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Mic className="h-3.5 w-3.5 text-emerald-600" />
                <span>تسجيل صوتي (مايكروفون)</span>
              </button>
            </div>
          )}

          {/* Active status indicator */}
          {isActive && (
            <div className="flex items-center gap-2">
              <div
                className={`h-2.5 w-2.5 rounded-full ${
                  isRecording ? 'bg-rose-500 animate-ping' : 'bg-amber-500'
                }`}
              />
              <span className="text-xs font-semibold text-foreground">
                {isRecording ? 'جاري التسجيل...' : 'التسجيل متوقف مؤقتاً'}
              </span>
              <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700">
                {recordingSource === 'radio' ? 'بث الإذاعة' : 'المايكروفون'}
              </Badge>
            </div>
          )}
        </div>

        {/* Center: Live Timer & Audio level bar */}
        <div className="flex items-center gap-4">
          <div className="text-center sm:text-right">
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block">
              مدة التسجيل
            </span>
            <span className="font-mono text-xl sm:text-2xl font-bold text-foreground">
              {formatTime(elapsedSeconds)}
            </span>
          </div>

          {/* VU Level bar */}
          <div className="flex flex-col gap-1 w-24 sm:w-32">
            <span className="text-[9px] text-muted-foreground">مستوى الصوت</span>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 transition-all duration-75 rounded-full"
                style={{ width: `${Math.min(100, Math.max(0, audioLevel))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right: Record Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
          {!isActive ? (
            <Button
              size="default"
              onClick={onStart}
              disabled={disabled}
              className="gap-2 rounded-full px-6 h-10 text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all hover:scale-105 active:scale-95"
            >
              <Circle className="h-2.5 w-2.5 fill-current animate-pulse text-white" />
              <span>بدء تسجيل مقطع</span>
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant={isPaused ? 'default' : 'secondary'}
                size="sm"
                onClick={onPauseToggle}
                className="gap-1.5 rounded-full px-4 h-9 font-medium text-xs border"
              >
                {isPaused ? (
                  <>
                    <Play className="h-3.5 w-3.5 fill-current text-emerald-600" />
                    <span>استئناف</span>
                  </>
                ) : (
                  <>
                    <Pause className="h-3.5 w-3.5 text-amber-500" />
                    <span>إيقاف مؤقت</span>
                  </>
                )}
              </Button>

              <Button
                variant="destructive"
                size="sm"
                onClick={onStop}
                className="gap-1.5 rounded-full px-4 h-9 font-semibold text-xs shadow-xs"
              >
                <Square className="h-3 w-3 fill-current" />
                <span>حفظ ومعاينة</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
