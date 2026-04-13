import { QuranChapter } from '@/services/quranApi';
import { Badge } from '@/components/ui/badge';

interface Props {
  chapter: QuranChapter | undefined;
  loading?: boolean;
}

export const SurahHeader = ({ chapter, loading }: Props) => {
  if (loading || !chapter) {
    return (
      <div className="text-center py-4 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded mx-auto mb-2" />
        <div className="h-4 w-24 bg-muted rounded mx-auto" />
      </div>
    );
  }

  return (
    <div className="text-center py-4 space-y-2">
      <h2 className="text-3xl font-arabic" dir="rtl">{chapter.name_arabic}</h2>
      <p className="text-lg text-foreground font-medium">{chapter.name_simple}</p>
      <div className="flex items-center justify-center gap-2">
        <Badge variant="secondary">{chapter.verses_count} Ayat</Badge>
        {chapter.revelation_place && (
          <Badge variant="outline" className="capitalize">{chapter.revelation_place}</Badge>
        )}
      </div>
    </div>
  );
};
