import { useState } from 'react';
import { useVerseTafsir } from '@/hooks/useQuranData';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  verseKey: string | undefined;
}

export const TafsirBlock = ({ verseKey }: Props) => {
  const [open, setOpen] = useState(false);
  const { data, isLoading, error } = useVerseTafsir(open ? verseKey : undefined);

  if (!verseKey) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground">
          <span className="flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" />
            Tafsir
          </span>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="p-4 rounded-lg bg-muted/30 text-sm text-muted-foreground mt-1">
          {isLoading && <Skeleton className="h-16 w-full" />}
          {error && <p className="text-destructive">Failed to load tafsir</p>}
          {data && (
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{
                __html: data.tafsir?.text || data.text || 'No tafsir available',
              }}
            />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
