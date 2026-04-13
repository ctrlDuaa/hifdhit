import { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  /** Audio URL for the verse/chapter */
  src: string | undefined;
  /** Optional class for the container */
  className?: string;
  /** Compact mode (icon-only) */
  compact?: boolean;
}

export const VerseAudioPlayer = ({ src, className, compact }: Props) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!src) return;
    const audio = new Audio(src);
    audioRef.current = audio;
    audio.addEventListener('canplaythrough', () => setReady(true));
    audio.addEventListener('ended', () => setPlaying(false));
    audio.addEventListener('error', () => setReady(false));
    return () => { audio.pause(); audio.src = ''; };
  }, [src]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else { audio.play(); setPlaying(true); }
  }, [playing]);

  const replay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play();
    setPlaying(true);
  }, []);

  if (!src) return null;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Button
        variant="outline"
        size={compact ? 'icon' : 'sm'}
        onClick={toggle}
        disabled={!ready}
        className={compact ? 'h-8 w-8 rounded-full' : undefined}
      >
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        {!compact && (playing ? ' Pause' : ' Play')}
      </Button>
      {!compact && (
        <Button variant="ghost" size="sm" onClick={replay} disabled={!ready}>
          <RotateCcw className="w-3 h-3 mr-1" /> Replay
        </Button>
      )}
    </div>
  );
};
