import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MemorizationSessionState } from '@/types/memorization';
import { MemorizationAyah } from '@/hooks/useMemorizationSession';
import { RecitationRecorder } from '@/components/memorization/RecitationRecorder';

interface Props {
  state: MemorizationSessionState;
  chunkAyahs: MemorizationAyah[];
  onResult: (gotIt: boolean) => void;
}

export const ConsolidationCheckpoint = ({ state, chunkAyahs, onResult }: Props) => {
  const chunk = state.chunks[state.currentChunkIndex];

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-lg shadow-lg border-border/50">
        <CardContent className="p-8 space-y-6 text-center">
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Consolidation Checkpoint</h2>
            <p className="text-foreground text-sm">
              Recite the full chunk from memory
            </p>
          </div>

          <Badge variant="secondary" className="text-sm px-4 py-1.5">
            Ayah {chunk.ayahStart === chunk.ayahEnd ? chunk.ayahStart : `${chunk.ayahStart}–${chunk.ayahEnd}`}
          </Badge>

          <div className="bg-muted/30 rounded-xl p-6 space-y-3">
            <p className="text-sm text-foreground mb-3">Try to recite these ayat together:</p>
            {chunkAyahs.map(ayah => (
              <div key={ayah.number} className="text-right py-2 border-b border-border/30 last:border-0">
                <p className="text-lg font-arabic leading-relaxed blur-sm hover:blur-none transition-all cursor-pointer" dir="rtl">
                  {ayah.text} ﴿{ayah.number}﴾
                </p>
              </div>
            ))}
            <p className="text-xs text-foreground italic mt-2">Hover to reveal text for checking</p>
          </div>

          <div className="pt-2">
            <RecitationRecorder
              resetKey={`checkpoint-${chunk.chunkIndex}-${chunk.ayahStart}-${chunk.ayahEnd}`}
              variant="inline"
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
