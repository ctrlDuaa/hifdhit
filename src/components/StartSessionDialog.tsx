import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useSessionSystem } from '@/hooks/useSessionSystem';
import { useNavigate } from 'react-router-dom';
import { Copy, Check, Plus, Trash2, ChevronsUpDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSurahList } from '@/hooks/useQuranData';

interface SurahRange {
  surahNumber: string;
  startAyah: string;
  endAyah: string;
  completeSurah: boolean;
}

export const StartSessionDialog = () => {
  const [open, setOpen] = useState(false);
  const [ranges, setRanges] = useState<SurahRange[]>([
    { surahNumber: '1', startAyah: '', endAyah: '', completeSurah: false }
  ]);
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const {
    createSession,
    loading,
    currentSession
  } = useSessionSystem();
  const { data: chaptersData } = useSurahList();
  const surahs = (chaptersData || []).map(ch => ({
    number: ch.id,
    name: ch.name_simple,
    numberOfAyahs: ch.verses_count,
  }));
  const { toast } = useToast();
  const navigate = useNavigate();

  const getMaxAyahs = (surahNum: string) => {
    const surah = surahs.find(s => s.number === parseInt(surahNum));
    return surah?.numberOfAyahs || 1;
  };

  const updateRange = (index: number, field: keyof SurahRange, value: string | boolean) => {
    setRanges(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === 'surahNumber') {
        updated[index].startAyah = '';
        updated[index].endAyah = '';
        updated[index].completeSurah = false;
      }
      if (field === 'completeSurah' && value === true) {
        const max = getMaxAyahs(updated[index].surahNumber);
        updated[index].startAyah = '1';
        updated[index].endAyah = String(max);
      }
      return updated;
    });
  };

  const addRange = () => {
    setRanges(prev => [...prev, { surahNumber: '1', startAyah: '', endAyah: '', completeSurah: false }]);
  };

  const removeRange = (index: number) => {
    setRanges(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateSession = async () => {
    for (let i = 0; i < ranges.length; i++) {
      const r = ranges[i];
      if (!r.startAyah || !r.endAyah) {
        toast({ title: "Ayah Range Required", description: `Please fill in the ayah range for Surah ${r.surahNumber} (range ${i + 1}).`, variant: "destructive" });
        return;
      }
      if (parseInt(r.endAyah) < parseInt(r.startAyah)) {
        toast({ title: "Invalid Range", description: `End ayah must be ≥ start ayah in range ${i + 1}.`, variant: "destructive" });
        return;
      }
    }

    // Primary surah is the first range
    const primary = ranges[0];
    const sessionRanges = ranges.map(r => ({
      surah_number: parseInt(r.surahNumber),
      starting_ayah: parseInt(r.startAyah),
      ending_ayah: parseInt(r.endAyah),
    }));

    const code = await createSession(
      'Revision Session',
      parseInt(primary.surahNumber),
      parseInt(primary.startAyah),
      parseInt(primary.endAyah),
      sessionRanges
    );
    if (code) {
      setSessionCode(code);
    }
  };

  const handleCopyCode = () => {
    if (sessionCode) {
      navigator.clipboard.writeText(sessionCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Copied!", description: "Session code copied to clipboard." });
    }
  };

  const handleJoinSession = () => {
    if (currentSession) {
      navigate(`/session/${currentSession.id}`);
      setOpen(false);
      setSessionCode(null);
    }
  };

  const resetForm = () => {
    setRanges([{ surahNumber: '1', startAyah: '', endAyah: '', completeSurah: false }]);
    setSessionCode(null);
  };

  return (
    <Dialog open={open} onOpenChange={isOpen => {
      setOpen(isOpen);
      if (!isOpen) resetForm();
    }}>
      <DialogTrigger asChild>
        <Button size="lg" className="w-full bg-[#fbf6ed] text-slate-800 hover:text-white">
          <Plus className="w-4 h-4 mr-2" />
          Start New Session
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Start Revision Session</DialogTitle>
          <DialogDescription>
            Create a new session and share the code with your revision partner.
          </DialogDescription>
        </DialogHeader>

        {!sessionCode ? (
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Surah Ranges</Label>
                <Button type="button" variant="outline" size="sm" onClick={addRange} className="h-7 text-xs">
                  <Plus className="w-3 h-3 mr-1" />
                  Add Surah
                </Button>
              </div>

              {ranges.map((range, index) => {
                const maxAyahs = getMaxAyahs(range.surahNumber);
                const selectedSurah = surahs.find(s => s.number === parseInt(range.surahNumber));
                return (
                  <div key={index} className="border rounded-lg p-3 space-y-3 relative">
                    {ranges.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRange(index)}
                        className="absolute top-2 right-2 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <div className="text-xs font-medium text-muted-foreground">
                      Range {index + 1}{index === 0 ? ' (primary)' : ''}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Surah</Label>
                      <SurahSearchSelect
                        surahs={surahs}
                        value={range.surahNumber}
                        onChange={v => updateRange(index, 'surahNumber', v)}
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`complete-surah-${index}`}
                        checked={range.completeSurah}
                        onCheckedChange={checked => updateRange(index, 'completeSurah', !!checked)}
                      />
                      <Label htmlFor={`complete-surah-${index}`} className="text-xs cursor-pointer">
                        Complete Surah {selectedSurah ? `(${maxAyahs} ayat)` : ''}
                      </Label>
                    </div>
                    {!range.completeSurah && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Start Ayah</Label>
                            <Input
                              type="number"
                              min="1"
                              max={maxAyahs}
                              value={range.startAyah}
                              onChange={e => updateRange(index, 'startAyah', e.target.value)}
                              placeholder="Start"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">End Ayah</Label>
                            <Input
                              type="number"
                              min="1"
                              max={maxAyahs}
                              value={range.endAyah}
                              onChange={e => updateRange(index, 'endAyah', e.target.value)}
                              placeholder="End"
                            />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">Max: {maxAyahs} ayat in this surah</p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <Button
              onClick={handleCreateSession}
              disabled={loading || ranges.some(r => !r.startAyah || !r.endAyah)}
              className="w-full bg-[#c6a477]"
            >
              {loading ? 'Creating...' : 'Create Session'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-lg text-center bg-[#fbf6ed]">
              <p className="text-sm mb-2 text-[#c6a477]">Your Session Code</p>
              <div className="flex items-center justify-center gap-2">
                <code className="text-3xl font-bold tracking-widest" style={{ color: '#C6A477' }}>
                  {sessionCode}
                </code>
                <Button size="sm" variant="ghost" onClick={handleCopyCode}>
                  {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="text-black">✓ Session created successfully!</p>
              <p className="text-black">✓ Share this code with your partner</p>
              <p className="text-black">✓ They can join using "Join Session"</p>
            </div>

            <Button onClick={handleJoinSession} className="w-full bg-[#c6a477]">
              Enter Session
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// Searchable surah dropdown component
const SurahSearchSelect = ({
  surahs,
  value,
  onChange,
}: {
  surahs: { number: number; name: string; numberOfAyahs: number }[];
  value: string;
  onChange: (v: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedSurah = surahs.find(s => s.number === parseInt(value));

  const filtered = surahs.filter(s =>
    search === ''
      ? true
      : s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.number.toString().includes(search)
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch(''); }}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        <span className="truncate">
          {selectedSurah ? `${selectedSurah.number}. ${selectedSurah.name}` : 'Select a surah'}
        </span>
        <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-[200] rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="p-2 border-b">
            <Input
              placeholder="Search surah..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 text-sm"
              autoFocus
            />
          </div>
          <div className="max-h-[200px] overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No surah found.</p>
            ) : (
              filtered.map(surah => (
                <button
                  key={surah.number}
                  type="button"
                  onClick={() => {
                    onChange(surah.number.toString());
                    setOpen(false);
                    setSearch('');
                  }}
                  className={`flex w-full items-center rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground ${
                    surah.number === parseInt(value) ? 'bg-accent text-accent-foreground' : ''
                  }`}
                >
                  {surah.number}. {surah.name}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
