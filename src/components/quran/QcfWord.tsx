import React from 'react';
import { getQcfFontFamily, QCF_FALLBACK_FONT_FAMILY } from '@/hooks/useQcfFontLoader';

export interface QcfWordData {
  /** QCF V2 glyph string — must be injected as HTML, not text. */
  code_v2?: string;
  /** Unicode QPC Hafs text — used for fallback + end-of-ayah markers. */
  text_qpc_hafs?: string;
  /** Mushaf page that this word belongs to. Each page has its own font. */
  page_number: number;
  /** "word" | "end" — end marks the ayah number glyph at end of verse. */
  char_type_name?: string;
}

interface QcfWordProps {
  word: QcfWordData;
  isFontLoaded: boolean;
  /** Optional wrapper className for highlight overlays etc. */
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  innerClassName?: string;
}

/**
 * Renders a single Quranic word.
 *
 *  - end-of-ayah markers always render with the Unicode UthmanicHafs font
 *    (the QCF page font's "end" glyph isn't well-suited as plain text).
 *  - Once the page's QCF V2 font is loaded, words render via `code_v2`
 *    using `dangerouslySetInnerHTML` (the QF docs require HTML injection).
 *  - Until the font loads, we render `text_qpc_hafs` with UthmanicHafs at
 *    slightly reduced opacity so the verse stays readable immediately.
 */
export const QcfWord: React.FC<QcfWordProps> = ({
  word,
  isFontLoaded,
  className,
  style,
  title,
  innerClassName,
}) => {
  const isEnd = word.char_type_name === 'end';

  // End-of-ayah marker → Unicode font
  if (isEnd) {
    return (
      <span
        className={className}
        style={style}
        title={title}
      >
        <span
          className={innerClassName}
          style={{ fontFamily: QCF_FALLBACK_FONT_FAMILY }}
        >
          {word.text_qpc_hafs ?? ''}
        </span>
      </span>
    );
  }

  // QCF V2 glyph (font ready) → HTML injection
  if (isFontLoaded && word.code_v2) {
    return (
      <span
        className={className}
        style={style}
        title={title}
      >
        <span
          className={innerClassName}
          style={{ fontFamily: getQcfFontFamily(word.page_number) }}
          dangerouslySetInnerHTML={{ __html: word.code_v2 }}
        />
      </span>
    );
  }

  // Fallback while font loads
  return (
    <span className={className} style={style} title={title}>
      <span
        className={innerClassName}
        style={{ fontFamily: QCF_FALLBACK_FONT_FAMILY, opacity: 0.85 }}
      >
        {word.text_qpc_hafs ?? ''}
      </span>
    </span>
  );
};

export default QcfWord;
