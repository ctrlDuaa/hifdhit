import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Play, Pause, Trash2 } from 'lucide-react';
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
 */
export const RecitationRecorder = ({ resetKey, variant = 'card', className }: Props) => {
  const { toast } = useToast();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);

  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  // Cleanup helpers
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

  const revokeUrl = (url: string | null) => {
    if (url) URL.revokeObjectURL(url);
  };

  // Reset everything when resetKey changes
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch {}
      }
      stopStream();
      clearTimer();
      audioRef.current?.pause();
      audioRef.current = null;
      revokeUrl(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // On resetKey change, stop and clear everything
    if (recording) {
      try { mediaRecorderRef.current?.stop(); } catch {}
      stopStream();
      clearTimer();
      setRecording(false);
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlaying(false);
    setElapsed(0);
    revokeUrl(audioUrl);
    setAudioUrl(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const startRecording = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      toast({ title: 'Recording not supported in this browser', variant: 'destructive' });
      return;
    }
    // Discard any previous recording
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlaying(false);
    revokeUrl(audioUrl);
    setAudioUrl(null);
    setElapsed(0);

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
      };
      mr.start();
      setRecording(true);
      const startedAt = Date.now();
      timerRef.current = window.setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAt) / 1000));
      }, 250);
    } catch (err) {
      console.error('[recitation-recorder] mic permission denied or unavailable', err);
      toast({
        title: 'Microphone unavailable',
        description: 'Please allow microphone access to record your recitation.',
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

  const togglePlayback = useCallback(() => {
    if (!audioUrl) return;
    if (!audioRef.current) {
      const a = new Audio(audioUrl);
      a.addEventListener('ended', () => setPlaying(false));
      a.addEventListener('pause', () => setPlaying(false));
      a.addEventListener('play', () => setPlaying(true));
      audioRef.current = a;
    }
    const a = audioRef.current;
    if (a.paused) {
      a.play().catch(() => setPlaying(false));
    } else {
      a.pause();
    }
  }, [audioUrl]);

  const discardRecording = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    revokeUrl(audioUrl);
    setAudioUrl(null);
    setPlaying(false);
    setElapsed(0);
  }, [audioUrl]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const body = (
    <>
      <span className="text-[11px] text-muted-foreground uppercase tracking-wide">My Recitation</span>

      {recording ? (
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
          <span className="text-sm font-semibold tabular-nums">{formatTime(elapsed)}</span>
        </div>
      ) : audioUrl ? (
        <span className="text-sm font-semibold tabular-nums">{formatTime(elapsed)}</span>
      ) : (
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
      <div className={cn('flex items-center justify-center gap-2 flex-wrap', className)}>
        {body}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-border/50 bg-card shadow-sm p-3 flex flex-col items-center gap-2',
        className,
      )}
    >
      {body}
    </div>
  );
};
