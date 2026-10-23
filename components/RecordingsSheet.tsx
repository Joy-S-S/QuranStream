'use client';

import * as React from 'react';
import { RecordingClip } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Bookmark,
  Download,
  Trash2,
  Play,
  Pause,
  Clock,
  HardDrive,
  FileAudio,
  Search,
} from 'lucide-react';
import { downloadAudioBlob } from '@/lib/audio-recorder';
import { formatTime, formatFileSize } from '@/lib/utils';

interface RecordingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clips: RecordingClip[];
  onDelete: (id: string) => void;
  onSelectForTrim: (clip: RecordingClip) => void;
}

export function RecordingsSheet({
  open,
  onOpenChange,
  clips,
  onDelete,
  onSelectForTrim,
}: RecordingsSheetProps) {
  const [playingId, setPlayingId] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const activeAudioRef = React.useRef<HTMLAudioElement | null>(null);

  const filteredClips = clips.filter((c) =>
    c.stationName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handlePlayToggle = (clip: RecordingClip) => {
    if (playingId === clip.id) {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
      }
      setPlayingId(null);
    } else {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
      }
      const audio = new Audio(clip.url);
      activeAudioRef.current = audio;
      audio.play().catch(console.error);
      setPlayingId(clip.id);
      audio.onended = () => setPlayingId(null);
    }
  };

  const handleDownload = (clip: RecordingClip) => {
    const filename = `${clip.stationName}_${new Date(clip.timestamp).toISOString().slice(0, 10)}.${clip.format === 'm4a' ? 'm4a' : 'mp3'}`;
    downloadAudioBlob(clip.blob, filename);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0 text-right">
        <SheetHeader className="p-5 border-b text-right">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bookmark className="h-5 w-5 text-emerald-600" />
              <SheetTitle className="text-base font-bold">مكتبة التسجيلات القرآنية</SheetTitle>
              <Badge variant="secondary" className="text-xs bg-emerald-50 text-emerald-700 font-bold">
                {clips.length}
              </Badge>
            </div>
          </div>
          <SheetDescription className="text-xs text-muted-foreground mt-1">
            التلاوات المحفوظة محلياً في متصفحك بجودة عالية مع إمكانية التحميل والاستماع.
          </SheetDescription>

          {/* Search box if clips exist */}
          {clips.length > 2 && (
            <div className="relative mt-3">
              <Search className="absolute right-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث في التسجيلات..."
                className="h-9 pr-9 text-xs"
              />
            </div>
          )}
        </SheetHeader>

        {/* Clips list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredClips.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
              <FileAudio className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-foreground">لا توجد تسجيلات محفوظة</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
                اضغط على زر التسجيل أثناء استماعك للإذاعة لحفظ تلاوة خاشعة.
              </p>
            </div>
          ) : (
            filteredClips.map((clip) => {
              const isPlaying = playingId === clip.id;
              const dateStr = new Date(clip.timestamp).toLocaleDateString('ar-EG', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={clip.id}
                  className="rounded-xl border border-border/80 bg-card p-3.5 shadow-xs transition-all hover:border-emerald-500/50 flex flex-col gap-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold truncate text-foreground">
                        {clip.stationName}
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{dateStr}</p>

                      <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground mt-1.5">
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="h-3 w-3 text-emerald-600" />
                          {formatTime(clip.duration)}
                        </span>
                        <span className="flex items-center gap-1">
                          <HardDrive className="h-3 w-3 text-slate-500" />
                          {formatFileSize(clip.sizeBytes)}
                        </span>
                        <Badge variant="outline" className="text-[9px] uppercase px-1.5 py-0 font-bold">
                          {clip.format}
                        </Badge>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(clip.id)}
                      className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                      title="حذف التسجيل"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePlayToggle(clip)}
                      className={`flex-1 h-8 text-xs gap-1.5 ${
                        isPlaying ? 'border-emerald-600 text-emerald-700 bg-emerald-50' : ''
                      }`}
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="h-3.5 w-3.5 fill-current text-emerald-600" />
                          <span>إيقاف</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5 fill-current text-emerald-600" />
                          <span>استماع</span>
                        </>
                      )}
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        onSelectForTrim(clip);
                        onOpenChange(false);
                      }}
                      className="h-8 px-2.5 text-xs"
                      title="تقليم وتعديل"
                    >
                      <span>تقليم</span>
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => handleDownload(clip)}
                      className="h-8 px-3 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>تحميل</span>
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
