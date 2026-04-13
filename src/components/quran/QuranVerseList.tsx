import { QuranVerse } from '@/services/quranApi';
import { QuranVerseDisplay } from './QuranVerseDisplay';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface Props {
  verses: QuranVerse[] | undefined;
  loading?: boolean;
  error?: Error | null;
  showTranslation?: boolean;
  className?: string;
}

export const QuranVerseList = ({ verses, loading, error, showTranslation = false, className }: Props) => {
  if (loading) {
    return (
      <div className={cn('space-y-6', className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-10 w-full" />
            {showTranslation && <Skeleton className="h-6 w-3/4 mx-auto" />}
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        <p className="font-medium">Failed to load verses</p>
        <p className="text-sm mt-1">{error.message}</p>
      </div>
    );
  }

  if (!verses || verses.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No verses available
      </div>
    );
  }

  return (
    <div className={cn('space-y-4 divide-y divide-border/50', className)}>
      {verses.map((verse) => (
        <QuranVerseDisplay
          key={verse.verse_key}
          verse={verse}
          showTranslation={showTranslation}
          className="pt-4 first:pt-0"
        />
      ))}
    </div>
  );
};
