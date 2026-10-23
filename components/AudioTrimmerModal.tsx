'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { RecordingClip } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import * as SliderPrimitive from '@radix-ui/react-slider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Download,
  Scissors,
  Trash2,
  CheckCircle2,
  Play,
  Pause,
  RotateCcw,
  Clock,
  HardDrive,
  FileAudio,
} from 'lucide-react';
import { downloadAudioBlob } from '@/lib/audio-recorder';
import { formatTime, formatFileSize } from '@/lib/utils';

interface AudioTrimmerModalProps {
  clip: RecordingClip | null;
  open: boolean;
  onClose: () => void;
  onDiscard: (id: string) => void;
  onSaveToLibrary: (clip: RecordingClip) => void;
}

export function AudioTrimmerModal({
  clip,
  open,
  onClose,
  onDiscard,
  onSaveToLibrary,
}: AudioTrimmerModalProps) {
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const [name, setName] = React.useState('');
  const [duration, setDuration] = React.useState(0);
  const [trimRange, setTrimRange] = React.useState<[number, number]>([0, 100]);
  const [isPlayingTrim, setIsPlayingTrim] = React.useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = React.useState(false);

  React.useEffect(() => {
    if (clip) {
      const dateStr = new Date(clip.timestamp).toLocaleDateString('ar-EG', {
        month: 'short',
        day: 'numeric',
      });
      setName(`تسجيل_${clip.stationName}_${dateStr}`);
      setTrimRange([0, 100]);
      setDuration(clip.duration || 1);
      setIsPlayingTrim(false);
    }
  }, [clip]);

  if (!clip) return null;

  const handleLoadedMetadata = () => {
    if (audioRef.current && audioRef.current.duration && !isNaN(audioRef.current.duration)) {
      setDuration(audioRef.current.duration);
    }
  };

  const startTimeSec = (trimRange[0] / 100) * duration;
  const endTimeSec = (trimRange[1] / 100) * duration;
  const exportDurationSec = Math.max(0, endTimeSec - startTimeSec);
  const isTrimmed = trimRange[0] > 0 || trimRange[1] < 100;

  const handleRangeChange = (newRange: number[]) => {
    if (newRange.length === 2) {
      const [start, end] = newRange;
      setTrimRange([start, end]);

      if (audioRef.current) {
        if (start !== trimRange[0]) {
          audioRef.current.currentTime = (start / 100) * duration;
        } else if (end !== trimRange[1]) {
          audioRef.current.currentTime = (end / 100) * duration;
        }
      }
    }
  };

  const togglePlayTrimmed = () => {
    if (!audioRef.current) return;

    if (isPlayingTrim) {
      audioRef.current.pause();
      setIsPlayingTrim(false);
    } else {
      audioRef.current.currentTime = startTimeSec;
      audioRef.current.play();
      setIsPlayingTrim(true);

      const checkTime = () => {
        if (!audioRef.current) return;
        if (audioRef.current.currentTime >= endTimeSec || audioRef.current.paused) {
          audioRef.current.pause();
          setIsPlayingTrim(false);
        } else {
          requestAnimationFrame(checkTime);
        }
      };
      requestAnimationFrame(checkTime);
    }
  };

  const handleResetTrim = () => {
    setTrimRange([0, 100]);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  const handleDownload = () => {
    const filename = `${name.trim().replace(/\s+/g, '_') || 'quran_recording'}.${clip.format === 'm4a' ? 'm4a' : 'mp3'}`;
    downloadAudioBlob(clip.blob, filename);
    toast.success(`تم تحميل التسجيل: ${filename}`);
  };

  const handleSave = () => {
    onSaveToLibrary({
      ...clip,
      duration: exportDurationSec,
    });
    toast.success('تم حفظ التلاوة في مكتبة التسجيلات');
    onClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl w-full p-4 sm:p-6 max-h-[92vh] overflow-y-auto flex flex-col gap-4 border-border/80 shadow-2xl">
          {/* Header */}
          <DialogHeader className="space-y-1 text-right">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-bold">
              <FileAudio className="h-5 w-5 text-emerald-600" />
              <span>معاينة وتقليم التسجيل الصوتي</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              استمع إلى التلاوة المسجلة، وحدد المقطع المطلوب لقص وحفظ التسجيل مباشرة.
            </DialogDescription>
          </DialogHeader>

          {/* Hidden audio element for playback */}
          <audio
            ref={audioRef}
            src={clip.url}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlayingTrim(false)}
          />

          {/* Audio Visualizer & Player Box */}
          <div className="rounded-xl border border-border/80 bg-muted/30 p-5 flex flex-col items-center justify-center gap-4">
            <div className="flex items-center justify-center gap-1.5 h-10 w-full max-w-sm">
              {[
                'animate-wave-1',
                'animate-wave-2',
                'animate-wave-3',
                'animate-wave-4',
                'animate-wave-5',
                'animate-wave-2',
                'animate-wave-3',
                'animate-wave-1',
                'animate-wave-4',
                'animate-wave-2',
                'animate-wave-5',
                'animate-wave-3',
              ].map((anim, idx) => (
                <span
                  key={idx}
                  className={`w-1 rounded-full bg-emerald-600 transition-all ${
                    isPlayingTrim ? anim : 'h-2 opacity-40'
                  }`}
                />
              ))}
            </div>

            <Button
              size="lg"
              variant="outline"
              onClick={togglePlayTrimmed}
              className="gap-2 rounded-full px-6 h-10 border-emerald-300 dark:border-emerald-800 bg-card hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200"
            >
              {isPlayingTrim ? (
                <>
                  <Pause className="h-4 w-4 fill-current text-emerald-600" />
                  <span>إيقاف التشغيل</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-current text-emerald-600" />
                  <span>تشغيل المقطع المحدد</span>
                </>
              )}
            </Button>
          </div>

          {/* Trimmer Timeline */}
          <div className="rounded-xl border border-border/80 bg-card p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-semibold">
                <Scissors className="h-4 w-4 text-emerald-600" />
                <span>تقليم وتحديد المقطع</span>
                {isTrimmed && (
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 text-[10px] py-0 px-2 font-medium">
                    تم التحديد
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">مدة المقطع:</span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                  {formatTime(exportDurationSec)}
                </span>
                <span className="text-muted-foreground/60 text-[11px]">
                  (من إجمالي {formatTime(duration)})
                </span>
              </div>
            </div>

            {/* Slider track */}
            <div className="px-2 pt-2 pb-1">
              <SliderPrimitive.Root
                value={trimRange}
                min={0}
                max={100}
                step={0.1}
                minStepsBetweenThumbs={1}
                onValueChange={handleRangeChange}
                className="relative flex w-full touch-none select-none items-center py-2 cursor-pointer"
              >
                <SliderPrimitive.Track className="relative h-2.5 w-full grow overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <SliderPrimitive.Range className="absolute h-full bg-emerald-600 rounded-full" />
                </SliderPrimitive.Track>

                <SliderPrimitive.Thumb
                  className="block h-6 w-6 rounded-full border-2 border-emerald-600 bg-white shadow-md focus:outline-hidden cursor-grab active:cursor-grabbing flex items-center justify-center ring-2 ring-emerald-100 dark:ring-emerald-950"
                  aria-label="بداية المقطع"
                >
                  <div className="h-2 w-0.5 bg-emerald-600 rounded-full" />
                </SliderPrimitive.Thumb>

                <SliderPrimitive.Thumb
                  className="block h-6 w-6 rounded-full border-2 border-emerald-600 bg-white shadow-md focus:outline-hidden cursor-grab active:cursor-grabbing flex items-center justify-center ring-2 ring-emerald-100 dark:ring-emerald-950"
                  aria-label="نهاية المقطع"
                >
                  <div className="h-2 w-0.5 bg-emerald-600 rounded-full" />
                </SliderPrimitive.Thumb>
              </SliderPrimitive.Root>
            </div>

            {/* Time labels & Reset */}
            <div className="flex items-center justify-between text-xs pt-1.5 border-t border-border/50">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-600" />
                <span className="text-muted-foreground text-[11px]">البداية:</span>
                <span className="font-mono font-semibold text-foreground">
                  {formatTime(startTimeSec)}
                </span>
              </div>

              {isTrimmed && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetTrim}
                  className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>إعادة ضبط المقطع</span>
                </Button>
              )}

              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-600" />
                <span className="text-muted-foreground text-[11px]">النهاية:</span>
                <span className="font-mono font-semibold text-foreground">
                  {formatTime(endTimeSec)}
                </span>
              </div>
            </div>
          </div>

          {/* Metadata Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">اسم المقطع</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 text-xs"
                placeholder="اسم الملف..."
              />
            </div>

            <div className="flex items-center justify-start sm:justify-end gap-2.5 text-xs text-muted-foreground pt-1">
              <div className="flex items-center gap-1 rounded-md bg-muted px-2.5 py-1">
                <Clock className="h-3.5 w-3.5 text-slate-500" />
                <span className="font-mono">{formatTime(duration)}</span>
              </div>
              <div className="flex items-center gap-1 rounded-md bg-muted px-2.5 py-1">
                <HardDrive className="h-3.5 w-3.5 text-slate-500" />
                <span>{formatFileSize(clip.sizeBytes)}</span>
              </div>
              <Badge variant="outline" className="text-[10px] uppercase font-bold px-2 py-0.5">
                {clip.format}
              </Badge>
            </div>
          </div>

          {/* Action Footer */}
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDiscardOpen(true)}
              className="gap-1.5 h-9 text-xs border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900/50 dark:hover:bg-rose-950/30"
            >
              <Trash2 className="h-4 w-4" />
              <span>حذف التسجيل</span>
            </Button>

            <div className="flex items-center gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                className="gap-1.5 h-9 text-xs border-border/80"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>حفظ في المكتبة</span>
              </Button>

              <Button
                size="sm"
                onClick={handleDownload}
                className="gap-1.5 h-9 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs"
              >
                <Download className="h-4 w-4" />
                <span>تحميل الملف الصوتي</span>
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discard Confirmation Alert */}
      <Dialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
        <DialogContent className="max-w-md text-right">
          <DialogHeader>
            <DialogTitle>هل تريد حذف هذا التسجيل؟</DialogTitle>
            <DialogDescription>
              لن تتمكن من استعادة هذا التسجيل بعد حذفه من الذاكرة المحلية.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row-reverse justify-start gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmDiscardOpen(false)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                onDiscard(clip.id);
                setConfirmDiscardOpen(false);
                onClose();
              }}
            >
              تأكيد الحذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
