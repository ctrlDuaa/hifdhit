import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MemorizationSessionState } from '@/types/memorization';
import { MemorizationAyah } from '@/hooks/useMemorizationSession';
import { RecitationRecorder } from '@/components/memorization/RecitationRecorder';
import { CheckpointMushafView } from '@/components/memorization/CheckpointMushafView';

interface Props {
  state: MemorizationSessionState;
  chunkAyahs: MemorizationAyah[];
  onResult: (gotIt: boolean) => void;
}

export const ConsolidationCheckpoint = ({ state, chunkAyahs, onResult }: Props) => {
  const chunk = state.chunks[state.currentChunkIndex];

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-start justify-center p-4 bg-background">
      <Card className="w-full max-w-3xl shadow-lg border-border/50 my-4">
        <CardContent className="p-6 md:p-8 space-y-6 text-center">
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Consolidation Checkpoint</h2>
            <p className="text-foreground text-sm">
              Recite the full chunk from memory using the mushaf page below
            </p>
          </div>

          <Badge variant="secondary" className="text-sm px-4 py-1.5">
            Ayah {chunk.ayahStart === chunk.ayahEnd ? chunk.ayahStart : `${chunk.ayahStart}–${chunk.ayahEnd}`}
          </Badge>

          <CheckpointMushafView
            surahId={state.config.surahId}
            startAyah={chunk.ayahStart}
            endAyah={chunk.ayahEnd}
          />

          <p className="text-xs text-muted-foreground italic">
            Hover over a word to reveal it for checking
          </p>

          <div className="pt-2">
            <RecitationRecorder
              resetKey={`checkpoint-${chunk.chunkIndex}-${chunk.ayahStart}-${chunk.ayahEnd}`}
              variant="inline"
              title="Want to self-check your recitation?"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button onClick={() => onResult(true)} size="lg" className="w-full bg-[#C6A477] hover:bg-[#b8956a] text-white">
              I Got It
            </Button>
            <Button onClick={() => onResult(false)} variant="outline" size="lg" className="w-full">
              Another Round
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
