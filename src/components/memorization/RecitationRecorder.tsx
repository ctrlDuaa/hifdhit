import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Play, Pause, Trash2, MicOff, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Props {
  /** Optional: reset recording state when this key changes (e.g., when ayah changes) */
  resetKey?: string | number;
  /** Visual layout */
  variant?: 'card' | 'inline';
  className?: string;
}

/**
 * Self-contained voice recorder for the user to record their own recitation
 * and immediately play it back. Audio is held only in memory (object URL) and
 * is discarded when the component unmounts or resetKey changes — never uploaded.
 *
 * Includes a live waveform visualization captured during recording, and a
 * click/drag-to-seek scrubber during playback.
 */
export const RecitationRecorder = ({ resetKey, variant = 'card', className }: Props) => {
  const { toast } = useToast();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);

  // Waveform / analyser refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const peaksRef = useRef<number[]>([]);
  const playbackRafRef = useRef<number | null>(null);

  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [micError, setMicError] = useState<'denied' | 'unavailable' | null>(null);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);

  // Ref to always hold the latest audioUrl for unmount cleanup
  const latestAudioUrlRef = useRef<string | null>(null);

  // Keep ref synced with latest audioUrl so unmount cleanup can revoke it
  useEffect(() => {
    latestAudioUrlRef.current = audioUrl;
  }, [audioUrl]);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopAnalyser = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch {}
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
  };

  const stopPlaybackRaf = () => {
    if (playbackRafRef.current !== null) {
      cancelAnimationFrame(playbackRafRef.current);
      playbackRafRef.current = null;
    }
  };

  const revokeUrl = (url: string | null) => {
    if (url) URL.revokeObjectURL(url);
  };

  // Unmount cleanup
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch {}
      }
      stopStream();
      clearTimer();
      stopAnalyser();
      stopPlaybackRaf();
      audioRef.current?.pause();
      audioRef.current = null;
      revokeUrl(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On resetKey change, stop and clear everything
  useEffect(() => {
    if (recording) {
      try { mediaRecorderRef.current?.stop(); } catch {}
      stopStream();
      clearTimer();
      stopAnalyser();
      setRecording(false);
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    stopPlaybackRaf();
    setPlaying(false);
    setElapsed(0);
    setMicError(null);
    setPeaks([]);
    peaksRef.current = [];
    setDuration(0);
    setPosition(0);
    setPlaybackRate(1.0);
    revokeUrl(audioUrl);
    setAudioUrl(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const startRecording = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setMicError('unavailable');
      toast({ title: 'Recording not supported in this browser', variant: 'destructive' });
      return;
    }
    // Discard any previous recording
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    stopPlaybackRaf();
    setPlaying(false);
    revokeUrl(audioUrl);
    setAudioUrl(null);
    setElapsed(0);
    setMicError(null);
    setPeaks([]);
    peaksRef.current = [];
    setDuration(0);
    setPosition(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stopStream();
        clearTimer();
        stopAnalyser();
      };
      mr.start();
      setRecording(true);
      const startedAt = Date.now();
      timerRef.current = window.setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAt) / 1000));
      }, 250);

      // Live waveform via Web Audio API
      try {
        const AC: typeof AudioContext =
          (window as any).AudioContext || (window as any).webkitAudioContext;
        const ctx = new AC();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);
        audioCtxRef.current = ctx;
        analyserRef.current = analyser;

        const buf = new Uint8Array(analyser.fftSize);
        let lastPush = 0;
        const tick = (t: number) => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / buf.length);
          if (t - lastPush > 60) {
            peaksRef.current.push(Math.min(1, rms * 2.4));
            // Cap to avoid runaway memory on long recordings
            if (peaksRef.current.length > 1200) {
              peaksRef.current = peaksRef.current.slice(-1200);
            }
            setPeaks(peaksRef.current.slice());
            lastPush = t;
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (e) {
        // Waveform is optional; recording still works without it.
        console.warn('[recitation-recorder] waveform analyser unavailable', e);
      }
    } catch (err) {
      const isDenied = err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError');
      setMicError(isDenied ? 'denied' : 'unavailable');
      console.error('[recitation-recorder] mic permission denied or unavailable', err);
      toast({
        title: isDenied ? 'Microphone access denied' : 'Microphone unavailable',
        description: isDenied
          ? 'Please allow microphone access in your browser settings to record your recitation.'
          : 'Your microphone could not be accessed. Please check your device.',
        variant: 'destructive',
      });
    }
  }, [audioUrl, toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    setRecording(false);
  }, []);

  const ensureAudio = useCallback(() => {
    if (!audioUrl) return null;
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
      return audioRef.current;
    }
    const a = new Audio(audioUrl);
    a.playbackRate = playbackRate;
    a.preload = 'metadata';
    const trackPosition = () => {
      setPosition(a.currentTime || 0);
      if (!a.paused && !a.ended) {
        playbackRafRef.current = requestAnimationFrame(trackPosition);
      }
    };
    a.addEventListener('play', () => {
      setPlaying(true);
      stopPlaybackRaf();
      playbackRafRef.current = requestAnimationFrame(trackPosition);
    });
    a.addEventListener('pause', () => {
      setPlaying(false);
      stopPlaybackRaf();
      setPosition(a.currentTime || 0);
    });
    a.addEventListener('ended', () => {
      setPlaying(false);
      stopPlaybackRaf();
      setPosition(a.duration || 0);
    });
    // MediaRecorder webm blobs often report Infinity duration.
    // Trick: seek far ahead to force the browser to compute it.
    const settleDuration = () => {
      if (a.duration === Infinity || isNaN(a.duration)) {
        const onDur = () => {
          if (a.duration !== Infinity && !isNaN(a.duration)) {
            a.removeEventListener('durationchange', onDur);
            setDuration(a.duration);
            try { a.currentTime = 0; } catch {}
          }
        };
        a.addEventListener('durationchange', onDur);
        try { a.currentTime = 1e101; } catch {}
      } else {
        setDuration(a.duration);
      }
    };
    a.addEventListener('loadedmetadata', settleDuration);
    audioRef.current = a;
    return a;
  }, [audioUrl, playbackRate]);

  const togglePlayback = useCallback(() => {
    const a = ensureAudio();
    if (!a) return;
    if (a.paused || a.ended) {
      if (a.ended) {
        try { a.currentTime = 0; } catch {}
      }
      a.play().catch(() => setPlaying(false));
    } else {
      a.pause();
    }
  }, [ensureAudio]);

  const seekToFraction = useCallback((frac: number) => {
    const a = ensureAudio();
    if (!a) return;
    const clamped = Math.max(0, Math.min(1, frac));
    const dur = duration || a.duration;
    if (!dur || dur === Infinity || isNaN(dur)) {
      // Fallback: use elapsed if duration not yet known
      const fallback = elapsed || 0;
      if (fallback > 0) {
        try { a.currentTime = clamped * fallback; setPosition(a.currentTime); } catch {}
      }
      return;
    }
    try {
      a.currentTime = clamped * dur;
      setPosition(a.currentTime);
    } catch {}
  }, [duration, elapsed, ensureAudio]);

  const discardRecording = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    stopPlaybackRaf();
    revokeUrl(audioUrl);
    setAudioUrl(null);
    setPlaying(false);
    setElapsed(0);
    setPeaks([]);
    peaksRef.current = [];
    setDuration(0);
    setPosition(0);
  }, [audioUrl]);

  const formatTime = (s: number) => {
    if (!isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // ─── Waveform component ─────────────────────────────────────────
  const Waveform = ({ heightClass = 'h-10' }: { heightClass?: string }) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const draggingRef = useRef(false);

    const handleFromEvent = (clientX: number) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const frac = (clientX - rect.left) / rect.width;
      seekToFraction(frac);
    };

    const canSeek = !!audioUrl && !recording;
    const total = duration || elapsed || 0;
    const progressFrac = total > 0 ? Math.min(1, position / total) : 0;

    // Show empty placeholder when no peaks yet
    const visualPeaks = peaks.length > 0 ? peaks : [];
    // Resample/cap visible bars for cleaner look
    const MAX_BARS = 64;
    let bars: number[] = visualPeaks;
    if (visualPeaks.length > MAX_BARS) {
      bars = [];
      const stride = visualPeaks.length / MAX_BARS;
      for (let i = 0; i < MAX_BARS; i++) {
        const start = Math.floor(i * stride);
        const end = Math.floor((i + 1) * stride);
        let max = 0;
        for (let j = start; j < end; j++) {
          if (visualPeaks[j] > max) max = visualPeaks[j];
        }
        bars.push(max);
      }
    }

    return (
      <div
        ref={containerRef}
        className={cn(
          'relative w-full rounded-md bg-muted/40 overflow-hidden select-none',
          heightClass,
          canSeek ? 'cursor-pointer' : 'cursor-default',
        )}
        onMouseDown={canSeek ? (e) => { draggingRef.current = true; handleFromEvent(e.clientX); } : undefined}
        onMouseMove={canSeek ? (e) => { if (draggingRef.current) handleFromEvent(e.clientX); } : undefined}
        onMouseUp={() => { draggingRef.current = false; }}
        onMouseLeave={() => { draggingRef.current = false; }}
        onTouchStart={canSeek ? (e) => { draggingRef.current = true; handleFromEvent(e.touches[0].clientX); } : undefined}
        onTouchMove={canSeek ? (e) => { if (draggingRef.current) handleFromEvent(e.touches[0].clientX); } : undefined}
        onTouchEnd={() => { draggingRef.current = false; }}
        role={canSeek ? 'slider' : undefined}
        aria-label="Seek recitation playback"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progressFrac * 100)}
      >
        {/* Bars */}
        <div className="absolute inset-0 flex items-center gap-[2px] px-1">
          {bars.length === 0 ? (
            <div className="w-full h-px bg-border/60" />
          ) : (
            bars.map((p, i) => {
              const h = Math.max(6, Math.round(p * 100));
              const barFrac = bars.length > 1 ? i / (bars.length - 1) : 0;
              const played = canSeek && barFrac <= progressFrac;
              return (
                <span
                  key={i}
                  className={cn(
                    'flex-1 rounded-sm transition-colors',
                    recording
                      ? 'bg-destructive/70'
                      : played
                        ? 'bg-[#C6A477]'
                        : 'bg-muted-foreground/40',
                  )}
                  style={{ height: `${h}%` }}
                />
              );
            })
          )}
        </div>

        {/* Playhead */}
        {canSeek && bars.length > 0 && (
          <div
            className="absolute top-0 bottom-0 w-px bg-[#C6A477] pointer-events-none"
            style={{ left: `${progressFrac * 100}%` }}
          />
        )}
      </div>
    );
  };

  const permissionBody = micError ? (
    <>
      <MicOff className="w-5 h-5 text-destructive" />
      <span className="text-xs font-medium text-center leading-snug">
        {micError === 'denied'
          ? 'Microphone access was denied'
          : 'Microphone is not available'}
      </span>
      <span className="text-[11px] text-muted-foreground text-center leading-snug">
        {micError === 'denied'
          ? 'Allow microphone access in your browser settings, then try again.'
          : 'Please check your device or try a different browser.'}
      </span>
      <Button
        variant="outline"
        size="sm"
        className="rounded-full border-[#C6A477] text-[#C6A477] hover:bg-[#C6A477]/10 gap-1.5"
        onClick={startRecording}
      >
        <RotateCcw className="w-3.5 h-3.5" />
        Retry
      </Button>
    </>
  ) : (
    <>
      <span className="text-[11px] text-muted-foreground uppercase tracking-wide">My Recitation</span>

      {/* Waveform + time row */}
      {(recording || audioUrl) && (
        <div className="w-full flex flex-col gap-1">
          <Waveform heightClass={variant === 'card' ? 'h-9' : 'h-10'} />
          <div className="flex items-center justify-between text-[10px] text-muted-foreground tabular-nums px-0.5">
            <span>
              {recording
                ? formatTime(elapsed)
                : formatTime(position)}
            </span>
            <span>
              {recording
                ? ''
                : formatTime(duration || elapsed)}
            </span>
          </div>
        </div>
      )}

      {/* Playback speed toggles */}
      {!recording && audioUrl && (
        <div className="flex items-center gap-1">
          {([0.75, 1, 1.25] as const).map((rate) => (
            <button
              key={rate}
              onClick={() => {
                setPlaybackRate(rate);
                if (audioRef.current) {
                  audioRef.current.playbackRate = rate;
                }
              }}
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-md border transition-colors',
                playbackRate === rate
                  ? 'border-[#C6A477] text-[#C6A477] bg-[#C6A477]/10'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {rate}x
            </button>
          ))}
        </div>
      )}

      {!recording && !audioUrl && (
        <span className="text-xs text-muted-foreground">Tap to record</span>
      )}

      <div className="flex items-center gap-1.5">
        {!recording && !audioUrl && (
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full border-[#C6A477] text-[#C6A477] hover:bg-[#C6A477]/10"
            onClick={startRecording}
            title="Start recording"
          >
            <Mic className="w-4 h-4" />
          </Button>
        )}
        {recording && (
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full border-destructive text-destructive hover:bg-destructive/10"
            onClick={stopRecording}
            title="Stop recording"
          >
            <Square className="w-4 h-4 fill-current" />
          </Button>
        )}
        {!recording && audioUrl && (
          <>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={togglePlayback}
              title={playing ? 'Pause' : 'Play'}
            >
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-full border-[#C6A477] text-[#C6A477] hover:bg-[#C6A477]/10"
              onClick={startRecording}
              title="Record again"
            >
              <Mic className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-muted-foreground hover:text-destructive"
              onClick={discardRecording}
              title="Discard"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>
    </>
  );

  if (variant === 'inline') {
    return (
      <div className={cn('flex flex-col items-stretch gap-2 w-full max-w-sm mx-auto', className)}>
        <div className="flex flex-col items-center gap-2">
          {permissionBody}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-border/50 bg-card shadow-sm p-3 flex flex-col items-stretch gap-2',
        micError && 'border-destructive/30',
        className,
      )}
    >
      <div className="flex flex-col items-center gap-2">
        {permissionBody}
      </div>
    </div>
  );
};
