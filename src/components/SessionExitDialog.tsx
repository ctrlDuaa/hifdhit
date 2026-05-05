import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/runtimeClient';
import { useAuth } from '@/hooks/useAuth';

const surahNames = [
  "Al-Fatihah", "Al-Baqarah", "Ali 'Imran", "An-Nisa", "Al-Ma'idah", "Al-An'am", "Al-A'raf", "Al-Anfal", "At-Tawbah", "Yunus",
  "Hud", "Yusuf", "Ar-Ra'd", "Ibrahim", "Al-Hijr", "An-Nahl", "Al-Isra", "Al-Kahf", "Maryam", "Taha",
  "Al-Anbiya", "Al-Hajj", "Al-Mu'minun", "An-Nur", "Al-Furqan", "Ash-Shu'ara", "An-Naml", "Al-Qasas", "Al-'Ankabut", "Ar-Rum",
  "Luqman", "As-Sajdah", "Al-Ahzab", "Saba", "Fatir", "Ya-Sin", "As-Saffat", "Sad", "Az-Zumar", "Ghafir",
  "Fussilat", "Ash-Shuraa", "Az-Zukhruf", "Ad-Dukhan", "Al-Jathiyah", "Al-Ahqaf", "Muhammad", "Al-Fath", "Al-Hujurat", "Qaf",
  "Adh-Dhariyat", "At-Tur", "An-Najm", "Al-Qamar", "Ar-Rahman", "Al-Waqi'ah", "Al-Hadid", "Al-Mujadila", "Al-Hashr", "Al-Mumtahanah",
  "As-Saf", "Al-Jumu'ah", "Al-Munafiqun", "At-Taghabun", "At-Talaq", "At-Tahrim", "Al-Mulk", "Al-Qalam", "Al-Haqqah", "Al-Ma'arij",
  "Nuh", "Al-Jinn", "Al-Muzzammil", "Al-Muddaththir", "Al-Qiyamah", "Al-Insan", "Al-Mursalat", "An-Naba", "An-Nazi'at", "'Abasa",
  "At-Takwir", "Al-Infitar", "Al-Mutaffifin", "Al-Inshiqaq", "Al-Buruj", "At-Tariq", "Al-A'la", "Al-Ghashiyah", "Al-Fajr", "Al-Balad",
  "Ash-Shams", "Al-Layl", "Ad-Duha", "Ash-Sharh", "At-Tin", "Al-'Alaq", "Al-Qadr", "Al-Bayyinah", "Az-Zalzalah", "Al-'Adiyat",
  "Al-Qari'ah", "At-Takathur", "Al-'Asr", "Al-Humazah", "Al-Fil", "Quraysh", "Al-Ma'un", "Al-Kawthar", "Al-Kafirun", "An-Nasr",
  "Al-Masad", "Al-Ikhlas", "Al-Falaq", "An-Nas"
];

const getSurahName = (num: number) => surahNames[num - 1] || `Surah ${num}`;

interface SurahRange {
  surahNumber: number;
  startAyah: number;
  endAyah: number;
}

interface PerSurahCompletion {
  entireSurah: boolean;
  startAyah: string;
  endAyah: string;
}

interface SessionExitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionData: {
    surahNumber: number;
    startAyah: number;
    endAyah: number;
    sessionRanges?: SurahRange[];
  };
  sessionId: string;
  onComplete: (revisedRanges?: { surahNumber: number; startAyah: number; endAyah: number }[]) => void;
}

export const SessionExitDialog = ({
  open,
  onOpenChange,
  sessionData,
  sessionId,
  onComplete,
}: SessionExitDialogProps) => {
  const [completionStatus, setCompletionStatus] = useState<'yes' | 'no' | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const ranges: SurahRange[] =
    sessionData.sessionRanges && sessionData.sessionRanges.length > 0
      ? sessionData.sessionRanges
      : [{ surahNumber: sessionData.surahNumber, startAyah: sessionData.startAyah, endAyah: sessionData.endAyah }];

  // Per-surah completion state for "no" flow
  const [perSurah, setPerSurah] = useState<PerSurahCompletion[]>(() =>
    ranges.map(r => ({
      entireSurah: true,
      startAyah: String(r.startAyah),
      endAyah: String(r.endAyah),
    }))
  );

  const updatePerSurah = (index: number, field: keyof PerSurahCompletion, value: string | boolean) => {
    setPerSurah(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === 'entireSurah' && value === true) {
        updated[index].startAyah = String(ranges[index].startAyah);
        updated[index].endAyah = String(ranges[index].endAyah);
      }
      return updated;
    });
  };

  const handleSubmit = async () => {
    if (!user || !completionStatus) return;

    setLoading(true);
    try {
      // Build the actual ranges to mark as revised
      let revisedRanges: SurahRange[];

      if (completionStatus === 'yes') {
        revisedRanges = ranges;
      } else {
        // Use per-surah completion data
        revisedRanges = ranges.map((r, i) => {
          const ps = perSurah[i];
          if (ps.entireSurah) {
            return r;
          }
          const start = parseInt(ps.startAyah) || r.startAyah;
          const end = parseInt(ps.endAyah) || r.startAyah;
          return { surahNumber: r.surahNumber, startAyah: start, endAyah: end };
        }).filter(r => r.endAyah >= r.startAyah);
      }

      if (revisedRanges.length === 0) {
        onComplete(undefined);
        onOpenChange(false);
        return;
      }

      // Mark ayahs as revised
      const now = new Date().toISOString();
      const progressUpdates = revisedRanges.flatMap(r => {
        const updates = [];
        for (let ayah = r.startAyah; ayah <= r.endAyah; ayah++) {
          updates.push({
            user_id: user.id,
            surah_number: r.surahNumber,
            ayah_number: ayah,
            status: 'revised' as const,
            updated_at: now,
          });
        }
        return updates;
      });

      if (progressUpdates.length > 0) {
        const { error } = await supabase
          .from('progress')
          .upsert(progressUpdates, {
            onConflict: 'user_id,surah_number,ayah_number',
            ignoreDuplicates: false,
          });
        if (error) throw error;
      }

      await supabase
        .from('private_sessions')
        .update({ updated_at: now })
        .eq('id', sessionId);

      const totalAyahs = progressUpdates.length;
      const surahCount = new Set(revisedRanges.map(r => r.surahNumber)).size;

      toast({
        title: "Progress Updated!",
        description: `Marked ${totalAyahs} ayat across ${surahCount} surah${surahCount > 1 ? 's' : ''} as revised.`,
      });

      onComplete(revisedRanges);
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating progress:', error);
      toast({
        title: "Error",
        description: "Failed to update progress. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const rangeLabel = ranges.length === 1
    ? `${getSurahName(ranges[0].surahNumber)}, ayat ${ranges[0].startAyah}–${ranges[0].endAyah}`
    : ranges.map(r => `${getSurahName(r.surahNumber)} (${r.startAyah}–${r.endAyah})`).join(', ');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Session Complete</DialogTitle>
          <DialogDescription>
            Did you finish reciting {rangeLabel}?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <RadioGroup value={completionStatus || ''} onValueChange={v => setCompletionStatus(v as 'yes' | 'no')}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="yes" />
              <Label htmlFor="yes" className="cursor-pointer">
                Yes, I completed all verses
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="no" />
              <Label htmlFor="no" className="cursor-pointer">
                No, I didn't complete all verses
              </Label>
            </div>
          </RadioGroup>

          {completionStatus === 'no' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                For each surah, choose what you completed:
              </p>
              {ranges.map((r, i) => (
                <div key={i} className="border rounded-lg p-3 space-y-2">
                  <div className="font-medium text-sm">{getSurahName(r.surahNumber)}</div>
                  <div className="text-xs text-muted-foreground">
                    Session range: ayat {r.startAyah}–{r.endAyah}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`entire-${i}`}
                      checked={perSurah[i]?.entireSurah ?? true}
                      onCheckedChange={checked => updatePerSurah(i, 'entireSurah', !!checked)}
                    />
                    <Label htmlFor={`entire-${i}`} className="text-xs cursor-pointer">
                      Entire range ({r.startAyah}–{r.endAyah})
                    </Label>
                  </div>
                  {!(perSurah[i]?.entireSurah ?? true) && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Start Ayah</Label>
                        <Input
                          type="number"
                          min={r.startAyah}
                          max={r.endAyah}
                          value={perSurah[i]?.startAyah || ''}
                          onChange={e => updatePerSurah(i, 'startAyah', e.target.value)}
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">End Ayah</Label>
                        <Input
                          type="number"
                          min={r.startAyah}
                          max={r.endAyah}
                          value={perSurah[i]?.endAyah || ''}
                          onChange={e => updatePerSurah(i, 'endAyah', e.target.value)}
                          className="h-8"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                onComplete(undefined);
                onOpenChange(false);
              }}
            >
              Skip
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!completionStatus || loading}
            >
              {loading ? 'Updating...' : 'Update Progress'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
