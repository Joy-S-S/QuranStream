import fixWebmDuration from 'fix-webm-duration';

export function getBestAudioMimeType(): { mimeType: string; format: 'mp3' | 'webm' | 'm4a' } {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return { mimeType: '', format: 'webm' };
  }

  const supported = (t: string) => {
    try {
      return MediaRecorder.isTypeSupported(t);
    } catch {
      return false;
    }
  };

  if (supported('audio/mp4;codecs=mp4a.40.2') || supported('audio/mp4')) {
    return { mimeType: 'audio/mp4', format: 'm4a' };
  }
  if (supported('audio/webm;codecs=opus')) {
    return { mimeType: 'audio/webm;codecs=opus', format: 'webm' };
  }
  if (supported('audio/webm')) {
    return { mimeType: 'audio/webm', format: 'webm' };
  }

  return { mimeType: '', format: 'webm' };
}

export function downloadAudioBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

export async function processAudioRecording(
  chunks: Blob[],
  durationMs: number,
  format: 'mp3' | 'webm' | 'm4a'
): Promise<Blob> {
  const rawBlob = new Blob(chunks, {
    type: format === 'm4a' ? 'audio/mp4' : 'audio/webm',
  });

  if (format === 'webm' && typeof fixWebmDuration === 'function') {
    try {
      const fixedBlob = await new Promise<Blob>((resolve) => {
        fixWebmDuration(rawBlob, durationMs, (fixed: Blob) => {
          resolve(fixed);
        });
      });
      return fixedBlob;
    } catch (e) {
      console.warn('fixWebmDuration fallback:', e);
    }
  }

  return rawBlob;
}
