import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { MemorizationSessionConfig } from '@/types/memorization';
import { useSurahList } from '@/hooks/useQuranData';
import { Skeleton } from '@/components/ui/skeleton';
import { HifdhCollectionPicker } from './HifdhCollectionPicker';
import { Separator } from '@/components/ui/separator';

interface Props {
  onStart: (config: MemorizationSessionConfig) => void;
  loading?: boolean;
  onBack?: () => void;
  initialSurahId?: number;
  initialAyahStart?: number;
}

export const MemorizationSetup = ({ onStart, loading: startLoading, onBack, initialSurahId, initialAyahStart }: Props) => {
  const { data: chapters, isLoading: chaptersLoading } = useSurahList();
  const [surahId, setSurahId] = useState(initialSurahId || 1);
  const [chunkSize, setChunkSize] = useState(3);
  const [customChunk, setCustomChunk] = useState('');
  const [overrideSurah, setOverrideSurah] = useState(false);
  const [overrideAyah, setOverrideAyah] = useState(false);
  const [customAyahStart, setCustomAyahStart] = useState<string>('');

  useEffect(() => {
    if (initialSurahId) setSurahId(initialSurahId);
  }, [initialSurahId]);

  const selectedSurah = chapters?.find(s => s.id === surahId);
  const maxAyahs = selectedSurah?.verses_count || 7;
  const effectiveChunkSize = chunkSize === -1 ? parseInt(customChunk) || 1 : chunkSize;

  const isContinuing = !!initialSurahId && !!initialAyahStart && !overrideSurah;
  const parsedCustomAyah = parseInt(customAyahStart);
  const validCustomAyah = !isNaN(parsedCustomAyah) && parsedCustomAyah >= 1 && parsedCustomAyah <= maxAyahs;
  const ayahStart = isContinuing
    ? (overrideAyah && validCustomAyah ? parsedCustomAyah : initialAyahStart!)
    : (overrideAyah && validCustomAyah ? parsedCustomAyah : 1);

  const handleSurahChange = (val: string) => {
    setSurahId(parseInt(val));
  };

  const handleStart = () => {
    const remainingAyahs = maxAyahs - ayahStart + 1;
    const blockSize = Math.min(effectiveChunkSize, remainingAyahs);
    onStart({
      surahId,
      surahName: selectedSurah?.name_arabic || selectedSurah?.name_simple || '',
      ayahStart,
      ayahEnd: ayahStart + blockSize - 1,
      repetitions: 3,
      chunkSize: blockSize,
      showTranslation: false,
      showTransliteration: false,
    });
  };

  const handleHifdhSelect = (verses: { surahId: number; ayah: number }[]) => {
    if (verses.length === 0) return;
    // Group by surah — use the first surah group for a session
    const firstSurah = verses[0].surahId;
    const surahVerses = verses.filter(v => v.surahId === firstSurah).sort((a, b) => a.ayah - b.ayah);
    const surah = chapters?.find(s => s.id === firstSurah);
    onStart({
      surahId: firstSurah,
      surahName: surah?.name_arabic || surah?.name_simple || '',
      ayahStart: surahVerses[0].ayah,
      ayahEnd: surahVerses[surahVerses.length - 1].ayah,
      repetitions: 3,
      chunkSize: surahVerses.length,
      showTranslation: false,
      showTransliteration: false,
    });
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-lg shadow-lg border-border/50">
        <CardHeader className="text-center space-y-3 pb-2">
          {onBack && (
            <Button variant="ghost" size="sm" className="self-start -ml-2 text-muted-foreground" onClick={onBack}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Back to Dashboard
            </Button>
          )}
          <CardTitle className="text-2xl">
            {isContinuing ? 'Continue Memorization' : 'Start Memorization'}
          </CardTitle>
          <CardDescription>
            {isContinuing
              ? <>{selectedSurah?.name_simple || `Surah ${surahId}`} — starting from Ayah {ayahStart} · <button type="button" onClick={() => setOverrideSurah(true)} className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors">Change Surah</button></>
              : 'Configure your guided memorization session'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-4">
          {!isContinuing && (
            <div className="space-y-2">
              <Label>Surah</Label>
              {chaptersLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={String(surahId)} onValueChange={handleSurahChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-80">
                    {(chapters || []).map(s => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.id}. {s.name_arabic} — {s.name_simple} ({s.verses_count} ayat)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Chunk Size</Label>
            <Select value={String(chunkSize)} onValueChange={v => setChunkSize(parseInt(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Ayah</SelectItem>
                <SelectItem value="3">3 Ayat</SelectItem>
                <SelectItem value="5">5 Ayat</SelectItem>
                <SelectItem value="-1">Custom</SelectItem>
              </SelectContent>
            </Select>
            {chunkSize === -1 && (
              <Input type="number" min={1} max={20} placeholder="Enter chunk size" value={customChunk} onChange={e => setCustomChunk(e.target.value)} className="mt-2" />
            )}
          </div>

          <Separator />

          <HifdhCollectionPicker onSelectVerses={handleHifdhSelect} />

          <Button onClick={handleStart} className="w-full bg-[#C6A477] hover:bg-[#b8956a] text-white" size="lg" disabled={startLoading || chaptersLoading}>
            {startLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading verses...
              </>
            ) : (
              isContinuing ? 'Continue Memorization' : 'Start Memorization'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
