'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { STATIONS } from '@/lib/stations-data';
import { QuranStation, RecordingClip } from '@/lib/types';
import { getBestAudioMimeType, processAudioRecording } from '@/lib/audio-recorder';
import { getAllRecordingClips, saveRecordingClip, deleteRecordingClip } from '@/lib/storage';

import { HeaderNavbar } from '@/components/HeaderNavbar';
import { LiveAudioPlayer } from '@/components/LiveAudioPlayer';
import { StationSelector } from '@/components/StationSelector';
import { AudioRecorderHUD } from '@/components/AudioRecorderHUD';
import { AudioTrimmerModal } from '@/components/AudioTrimmerModal';
import { PrayerTimesCard } from '@/components/PrayerTimesCard';
import { DailyAyahCard } from '@/components/DailyAyahCard';
import { SleepTimerModal } from '@/components/SleepTimerModal';
import { RecordingsSheet } from '@/components/RecordingsSheet';

export default function QuranStreamPage() {
  // Audio Playback State
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [currentStation, setCurrentStation] = React.useState<QuranStation>(STATIONS[0]);
  const [isPlaying, setIsPlaying] = React.useState<boolean>(false);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [volume, setVolume] = React.useState<number>(0.9);
  const [isMuted, setIsMuted] = React.useState<boolean>(false);

  // Sleep Timer State
  const [sleepTimerMinutes, setSleepTimerMinutes] = React.useState<number | null>(null);
  const [sleepTimerModalOpen, setSleepTimerModalOpen] = React.useState<boolean>(false);
  const sleepTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Recording State (100% Client-Side)
  const [isRecording, setIsRecording] = React.useState<boolean>(false);
  const [isRecordingPaused, setIsRecordingPaused] = React.useState<boolean>(false);
  const [recordingSource, setRecordingSource] = React.useState<'radio' | 'mic'>('radio');
  const [elapsedSeconds, setElapsedSeconds] = React.useState<number>(0);
  const [audioLevel, setAudioLevel] = React.useState<number>(0);

  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const recordedChunksRef = React.useRef<Blob[]>([]);
  const recordingTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = React.useRef<number>(0);
  const micStreamRef = React.useRef<MediaStream | null>(null);
  const vuIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  // Library & Trimmer Modals State
  const [savedClips, setSavedClips] = React.useState<RecordingClip[]>([]);
  const [selectedClipForTrim, setSelectedClipForTrim] = React.useState<RecordingClip | null>(null);
  const [trimmerModalOpen, setTrimmerModalOpen] = React.useState<boolean>(false);
  const [librarySheetOpen, setLibrarySheetOpen] = React.useState<boolean>(false);

  // Prayer Info for Navbar
  const [nextPrayerName, setNextPrayerName] = React.useState<string>('');
  const [nextPrayerTimeRemaining, setNextPrayerTimeRemaining] = React.useState<string>('');

  // Load saved recordings from IndexedDB on mount
  React.useEffect(() => {
    getAllRecordingClips().then((clips) => {
      setSavedClips(clips);
    });
  }, []);

  // Handle stream source changes
  const changeStation = (station: QuranStation) => {
    setCurrentStation(station);
    setIsLoading(true);

    if (audioRef.current) {
      audioRef.current.src = station.streamUrl;
      audioRef.current.load();
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setIsLoading(false);
          toast.success(`تم الاتصال بمحطة: ${station.name}`);
        })
        .catch((err) => {
          console.warn('Playback error:', err);
          setIsPlaying(false);
          setIsLoading(false);
        });
    }
  };

  // Play / Pause toggle
  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      setIsLoading(true);
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setIsLoading(false);
        })
        .catch((err) => {
          console.error('Play error:', err);
          setIsPlaying(false);
          setIsLoading(false);
          toast.error('تعذر تشغيل البث، جاري إعادة المحاولة...');
          // Try reloading stream
          audioRef.current?.load();
          audioRef.current?.play().catch(console.error);
        });
    }
  };

  // Volume & Mute handling
  const handleVolumeChange = (newVal: number) => {
    setVolume(newVal);
    if (audioRef.current) {
      audioRef.current.volume = newVal;
    }
    if (newVal > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    audioRef.current.muted = nextMute;
  };

  const handleReconnect = () => {
    if (!audioRef.current) return;
    setIsLoading(true);
    audioRef.current.src = currentStation.streamUrl;
    audioRef.current.load();
    audioRef.current
      .play()
      .then(() => {
        setIsPlaying(true);
        setIsLoading(false);
        toast.success('تم تجديد الاتصال بالبث');
      })
      .catch(() => {
        setIsLoading(false);
        toast.error('فشل تجديد الاتصال بالخادم');
      });
  };

  // Sleep Timer logic
  const handleSelectSleepTimer = (minutes: number | null) => {
    if (sleepTimerRef.current) {
      clearInterval(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }

    setSleepTimerMinutes(minutes);

    if (minutes !== null && minutes > 0) {
      let remainingSeconds = minutes * 60;
      toast.info(`تم تفعيل مؤقت النوم: ستتوقف الإذاعة بعد ${minutes} دقيقة`);

      sleepTimerRef.current = setInterval(() => {
        remainingSeconds -= 1;
        if (remainingSeconds <= 0) {
          if (audioRef.current) {
            audioRef.current.pause();
            setIsPlaying(false);
          }
          if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
          setSleepTimerMinutes(null);
          toast.info('تم إيقاف تشغيل الإذاعة بواسطة مؤقت النوم');
        } else {
          setSleepTimerMinutes(Math.ceil(remainingSeconds / 60));
        }
      }, 1000);
    } else {
      toast.info('تم إيقاف مؤقت النوم');
    }
  };

  // 100% Client-Side Audio Recording Pipeline
  const startRecording = async () => {
    if (isRecording) return;

    try {
      recordedChunksRef.current = [];
      let recordStream: MediaStream | null = null;

      if (recordingSource === 'radio') {
        if (!isPlaying) {
          togglePlay();
        }

        // Capture from audio element
        const audioWithCapture = audioRef.current as unknown as {
          captureStream?: () => MediaStream;
          mozCaptureStream?: () => MediaStream;
        };

        if (typeof audioWithCapture?.captureStream === 'function') {
          recordStream = audioWithCapture.captureStream();
        } else if (typeof audioWithCapture?.mozCaptureStream === 'function') {
          recordStream = audioWithCapture.mozCaptureStream();
        }

        if (!recordStream || recordStream.getAudioTracks().length === 0) {
          // Fallback to mic or display audio capture
          toast.info('تسجيل صوتي للبث عبر متصفحك...');
          recordStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          micStreamRef.current = recordStream;
        }
      } else {
        // Microphone recording
        recordStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = recordStream;
      }

      if (!recordStream) {
        throw new Error('لم يتم العثور على مسار صوتي للتسجيل');
      }

      const { mimeType, format } = getBestAudioMimeType();
      const recorder = new MediaRecorder(recordStream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const durationMs = Math.max(1000, Date.now() - startTimeRef.current);
        const durationSec = durationMs / 1000;

        try {
          const finalBlob = await processAudioRecording(
            recordedChunksRef.current,
            durationMs,
            format
          );

          const clip: RecordingClip = {
            id: `rec-${Date.now()}`,
            stationId: currentStation.id,
            stationName: currentStation.name,
            timestamp: Date.now(),
            duration: durationSec,
            blob: finalBlob,
            url: URL.createObjectURL(finalBlob),
            sizeBytes: finalBlob.size,
            format,
          };

          // Save to persistent IndexedDB
          await saveRecordingClip(clip);
          setSavedClips((prev) => [clip, ...prev]);

          // Open Trimmer/Review modal immediately
          setSelectedClipForTrim(clip);
          setTrimmerModalOpen(true);
          toast.success('اكتمل التسجيل بنجاح! يمكنك الآن المعاينة والتقليم.');
        } catch (err) {
          console.error('Error finalizing audio clip:', err);
          toast.error('حدث خطأ أثناء معالجة الملف الصوتي.');
        } finally {
          setIsRecording(false);
          setIsRecordingPaused(false);
          setElapsedSeconds(0);
          setAudioLevel(0);
          if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach((t) => t.stop());
            micStreamRef.current = null;
          }
        }
      };

      recorder.start(250); // 250ms chunks
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setIsRecordingPaused(false);
      setElapsedSeconds(0);

      // Start elapsed timer
      recordingTimerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);

      // Start VU level simulation
      vuIntervalRef.current = setInterval(() => {
        setAudioLevel(Math.floor(Math.random() * 55) + 35);
      }, 100);

      toast.success('بدأ التسجيل... اضغط "حفظ ومعاينة" عند الانتهاء.');
    } catch (err) {
      console.error('Failed to start recording:', err);
      toast.error('تعذر بدء التسجيل الصوتي. يرجى التحقق من أذونات الصوت في المتصفح.');
      setIsRecording(false);
    }
  };

  const handlePauseToggle = () => {
    if (!mediaRecorderRef.current) return;
    if (isRecording && !isRecordingPaused) {
      mediaRecorderRef.current.pause();
      setIsRecordingPaused(true);
      toast.info('تم إيقاف التسجيل مؤقتاً');
    } else if (isRecordingPaused) {
      mediaRecorderRef.current.resume();
      setIsRecordingPaused(false);
      toast.info('تم استئناف التسجيل');
    }
  };

  const stopRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (vuIntervalRef.current) {
      clearInterval(vuIntervalRef.current);
      vuIntervalRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleDeleteClip = async (id: string) => {
    await deleteRecordingClip(id);
    setSavedClips((prev) => prev.filter((c) => c.id !== id));
    toast.info('تم حذف التسجيل بنجاح');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-emerald-500/20">
      {/* Hidden native audio element */}
      <audio
        ref={audioRef}
        src={currentStation.streamUrl}
        preload="auto"
        onPlaying={() => {
          setIsPlaying(true);
          setIsLoading(false);
        }}
        onWaiting={() => setIsLoading(true)}
        onError={() => {
          setIsPlaying(false);
          setIsLoading(false);
        }}
      />

      {/* Top Navbar */}
      <HeaderNavbar
        libraryCount={savedClips.length}
        onOpenLibrary={() => setLibrarySheetOpen(true)}
        onOpenSleepTimer={() => setSleepTimerModalOpen(true)}
        sleepTimerMinutes={sleepTimerMinutes}
        nextPrayerName={nextPrayerName}
        nextPrayerTimeRemaining={nextPrayerTimeRemaining}
      />

      {/* Main Container */}
      <main className="flex-1 w-full max-w-[1500px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">
          {/* Main Stage (Right in RTL, 8 columns on desktop) */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            {/* Live Audio Player */}
            <LiveAudioPlayer
              station={currentStation}
              isPlaying={isPlaying}
              isLoading={isLoading}
              volume={volume}
              isMuted={isMuted}
              onTogglePlay={togglePlay}
              onVolumeChange={handleVolumeChange}
              onToggleMute={toggleMute}
              onReconnect={handleReconnect}
            />

            {/* Audio Recorder HUD (100% Client-Side) */}
            <AudioRecorderHUD
              isRecording={isRecording}
              isPaused={isRecordingPaused}
              elapsedSeconds={elapsedSeconds}
              audioLevel={audioLevel}
              recordingSource={recordingSource}
              onSourceChange={setRecordingSource}
              onStart={startRecording}
              onPauseToggle={handlePauseToggle}
              onStop={stopRecording}
              disabled={isLoading}
            />

            {/* Station Selector Cards */}
            <StationSelector
              currentStationId={currentStation.id}
              onSelectStation={changeStation}
              disabled={isRecording}
            />
          </div>

          {/* Sidebar (Left in RTL, 4 columns on desktop) */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            {/* Accurate Prayer Times Card */}
            <PrayerTimesCard
              onNextPrayerChange={(name, remaining) => {
                setNextPrayerName(name);
                setNextPrayerTimeRemaining(remaining);
              }}
            />

            {/* Daily Quran Ayah in Amiri Calligraphy */}
            <DailyAyahCard />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/70 py-4 text-center text-xs text-muted-foreground bg-card/40">
        <p>&copy; {new Date().getFullYear()} إذاعة القرآن الكريم &bull; استماع وتسجيل مباشر من المتصفح بدون خوادم</p>
      </footer>

      {/* Audio Trimmer & Export Modal */}
      <AudioTrimmerModal
        clip={selectedClipForTrim}
        open={trimmerModalOpen}
        onClose={() => setTrimmerModalOpen(false)}
        onDiscard={handleDeleteClip}
        onSaveToLibrary={(updatedClip) => {
          saveRecordingClip(updatedClip);
          setSavedClips((prev) =>
            prev.map((c) => (c.id === updatedClip.id ? updatedClip : c))
          );
        }}
      />

      {/* Saved Recitations Library Sheet */}
      <RecordingsSheet
        open={librarySheetOpen}
        onOpenChange={setLibrarySheetOpen}
        clips={savedClips}
        onDelete={handleDeleteClip}
        onSelectForTrim={(clip) => {
          setSelectedClipForTrim(clip);
          setTrimmerModalOpen(true);
        }}
      />

      {/* Sleep Timer Modal */}
      <SleepTimerModal
        open={sleepTimerModalOpen}
        onOpenChange={setSleepTimerModalOpen}
        activeMinutes={sleepTimerMinutes}
        onSelectTimer={handleSelectSleepTimer}
      />
    </div>
  );
}
