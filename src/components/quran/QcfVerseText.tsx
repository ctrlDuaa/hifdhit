import { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

export interface QcfWord {
  id?: number | string;
  code_v2?: string;
  text_qpc_hafs?: string;
  page_number?: number;
  line_number?: number;
  char_type_name?: string;
  // Optional pass-through for highlighting / interactivity
  surah?: number;
  ayah?: number;
  position?: number;
}

interface QuranWordProps {
  word: QcfWord;
  isPageFontLoaded: boolean;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

/**
 * Renders a single QCF V2 glyph word with safe fallback.
 * - Ayah end markers always use UthmanicHafs (Unicode) with text_qpc_hafs.
 * - Glyph words use code_v2 + p{page}-v2 once that page font is loaded.
 * - Until the font loads (or if it fails), text_qpc_hafs is shown so nothing breaks.
 */
export const QuranWord = ({ word, isPageFontLoaded, className, style, title }: QuranWordProps) => {
  const isEnd = word.char_type_name === 'end';
  const fallbackText = word.text_qpc_hafs ?? '';

  if (isEnd) {
    return (
      <span
        className={cn('qcf-end', className)}
        style={{ fontFamily: "'UthmanicHafs', serif", ...style }}
        title={title}
      >
        {fallbackText}
      </span>
    );
  }

  const canRenderGlyph = isPageFontLoaded && !!word.code_v2 && typeof word.page_number === 'number';

  if (canRenderGlyph) {
    return (
      <span
        className={cn('qcf-word', className)}
        style={{ fontFamily: `'p${word.page_number}-v2'`, ...style }}
        title={title}
        // code_v2 contains private-use glyph codepoints encoded as HTML entities
        dangerouslySetInnerHTML={{ __html: word.code_v2! }}
      />
    );
  }

  return (
    <span
      className={cn('qcf-fallback', className)}
      style={{ fontFamily: "'UthmanicHafs', serif", ...style }}
      title={title}
    >
      {fallbackText}
    </span>
  );
};

interface QcfVerseTextProps {
  words: QcfWord[];
  loadedPages: Set<number>;
  className?: string;
  style?: CSSProperties;
  /** Render override per word (for mistake highlighting, click handlers, etc.) */
  wordWrapper?: (word: QcfWord, index: number, child: React.ReactNode) => React.ReactNode;
}

/**
 * Renders an ordered sequence of QCF V2 words preserving RTL layout.
 */
export const QcfVerseText = ({
  words,
  loadedPages,
  className,
  style,
  wordWrapper,
}: QcfVerseTextProps) => {
  return (
    <span
      className={cn('qcf-verse', className)}
      style={{
        direction: 'rtl',
        textAlign: 'right',
        unicodeBidi: 'bidi-override',
        ...style,
      }}
    >
      {words.map((w, i) => {
        const child = (
          <QuranWord
            key={w.id ?? i}
            word={w}
            isPageFontLoaded={
              typeof w.page_number === 'number' ? loadedPages.has(w.page_number) : false
            }
          />
        );
        const wrapped = wordWrapper ? wordWrapper(w, i, child) : child;
        return <span key={w.id ?? i}>{wrapped} </span>;
      })}
    </span>
  );
};
