import { QuranVerse } from '@/services/quranApi';
import { cn } from '@/lib/utils';

interface Props {
  verse: QuranVerse;
  showTranslation?: boolean;
  showVerseNumber?: boolean;
  highlightWords?: number[];
  className?: string;
  onWordClick?: (wordIndex: number) => void;
}

export const QuranVerseDisplay = ({
  verse,
  showTranslation = false,
  showVerseNumber = true,
  highlightWords = [],
  className,
  onWordClick,
}: Props) => {
  const verseNumber = parseInt(verse.verse_key.split(':')[1]);

  return (
    <div className={cn('space-y-2', className)}>
      {/* Arabic text */}
      <div className="text-center py-3" dir="rtl">
        <span className="text-2xl md:text-3xl leading-loose font-arabic" style={{ lineHeight: '2.5' }}>
          {verse.words && verse.words.length > 0 ? (
            <span className="flex flex-wrap justify-center gap-x-2 gap-y-1">
              {verse.words
                .filter(w => w.char_type_name !== 'end')
                .map((word, i) => (
                  <span
                    key={word.id || i}
                    className={cn(
                      'cursor-default transition-colors',
                      highlightWords.includes(i) && 'bg-primary/20 rounded px-1',
                      onWordClick && 'cursor-pointer hover:text-primary'
                    )}
                    onClick={() => onWordClick?.(i)}
                  >
                    {word.text_uthmani}
                  </span>
                ))}
            </span>
          ) : (
            <span>{verse.text_uthmani}</span>
          )}
          {showVerseNumber && (
            <span className="text-muted-foreground text-lg mx-2">﴿{verseNumber}﴾</span>
          )}
        </span>
      </div>

      {/* Translation */}
      {showTranslation && verse.translations && verse.translations.length > 0 && (
        <p className="text-center text-sm text-muted-foreground italic bg-muted/30 rounded-lg p-3">
          {verse.translations[0].text.replace(/<[^>]*>/g, '')}
        </p>
      )}
    </div>
  );
};
