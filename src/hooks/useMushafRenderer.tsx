import { useState, useCallback } from 'react';
import { mushafLocalDb, LocalMushafPage, LocalWord } from '@/db/mushafLocalDb';

export interface RenderedLine {
  line_number: number;
  line_type: 'ayah' | 'surah_name' | 'basmallah';
  is_centered: boolean;
  content: string;
  surah_number?: number;
  words?: LocalWord[];
}

export interface RenderedPage {
  page_number: number;
  lines: RenderedLine[];
}

export const useMushafRenderer = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const renderPage = useCallback(async (pageNumber: number): Promise<RenderedPage | null> => {
    setLoading(true);
    setError(null);

    try {
      // Get all lines for this page
      const pageLines = await mushafLocalDb.pages
        .where('page_number')
        .equals(pageNumber)
        .sortBy('line_number');

      if (pageLines.length === 0) {
        throw new Error(`No data found for page ${pageNumber}`);
      }

      const renderedLines: RenderedLine[] = [];

      for (const line of pageLines) {
        let content = '';
        let words: LocalWord[] = [];

        if (line.line_type === 'ayah') {
          const lineWords = await mushafLocalDb.words
            .where('id')
            .between(line.first_word_id, line.last_word_id, true, true)
            .sortBy('id');

          words = lineWords;
          content = lineWords.map(word => word.text).join(' ');
        } else if (line.line_type === 'surah_name') {
          // For surah name, we would need a separate surahs table or hardcoded names
          // For now, use a placeholder
          content = `سورة ${line.surah_number ? getSurahName(line.surah_number) : 'Unknown'}`;
        } else if (line.line_type === 'basmallah') {
          content = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
        }

        renderedLines.push({
          line_number: line.line_number,
          line_type: line.line_type,
          is_centered: line.is_centered,
          content,
          surah_number: line.surah_number,
          words
        });
      }

      return {
        page_number: pageNumber,
        lines: renderedLines
      };
    } catch (err) {
      console.error('Error rendering page:', err);
      setError(err instanceof Error ? err.message : 'Failed to render page');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getPageCount = useCallback(async (): Promise<number> => {
    try {
      const count = await mushafLocalDb.pageInfo.count();
      return count;
    } catch (err) {
      console.error('Error getting page count:', err);
      return 0;
    }
  }, []);

  const checkPageExists = useCallback(async (pageNumber: number): Promise<boolean> => {
    try {
      const page = await mushafLocalDb.pageInfo.get(pageNumber);
      return !!page;
    } catch (err) {
      console.error('Error checking page existence:', err);
      return false;
    }
  }, []);

  return {
    renderPage,
    getPageCount,
    checkPageExists,
    loading,
    error
  };
};

// Helper function to get Surah names (simplified version)
function getSurahName(surahNumber: number): string {
  const surahNames: { [key: number]: string } = {
    1: 'الفاتحة',
    2: 'البقرة',
    3: 'آل عمران',
    4: 'النساء',
    5: 'المائدة',
    6: 'الأنعام',
    7: 'الأعراف',
    8: 'الأنفال',
    9: 'التوبة',
    10: 'يونس',
    11: 'هود',
    12: 'يوسف',
    13: 'الرعد',
    14: 'إبراهيم',
    15: 'الحجر',
    16: 'النحل',
    17: 'الإسراء',
    18: 'الكهف',
    19: 'مريم',
    20: 'طه',
    21: 'الأنبياء',
    22: 'الحج',
    23: 'المؤمنون',
    24: 'النور',
    25: 'الفرقان',
    26: 'الشعراء',
    27: 'النمل',
    28: 'القصص',
    29: 'العنكبوت',
    30: 'الروم',
    31: 'لقمان',
    32: 'السجدة',
    33: 'الأحزاب',
    34: 'سبأ',
    35: 'فاطر',
    36: 'يس',
    37: 'الصافات',
    38: 'ص',
    39: 'الزمر',
    40: 'غافر',
    41: 'فصلت',
    42: 'الشورى',
    43: 'الزخرف',
    44: 'الدخان',
    45: 'الجاثية',
    46: 'الأحقاف',
    47: 'محمد',
    48: 'الفتح',
    49: 'الحجرات',
    50: 'ق',
    51: 'الذاريات',
    52: 'الطور',
    53: 'النجم',
    54: 'القمر',
    55: 'الرحمن',
    56: 'الواقعة',
    57: 'الحديد',
    58: 'المجادلة',
    59: 'الحشر',
    60: 'الممتحنة',
    61: 'الصف',
    62: 'الجمعة',
    63: 'المنافقون',
    64: 'التغابن',
    65: 'الطلاق',
    66: 'التحريم',
    67: 'الملك',
    68: 'القلم',
    69: 'الحاقة',
    70: 'المعارج',
    71: 'نوح',
    72: 'الجن',
    73: 'المزمل',
    74: 'المدثر',
    75: 'القيامة',
    76: 'الإنسان',
    77: 'المرسلات',
    78: 'النبأ',
    79: 'النازعات',
    80: 'عبس',
    81: 'التكوير',
    82: 'الانفطار',
    83: 'المطففين',
    84: 'الانشقاق',
    85: 'البروج',
    86: 'الطارق',
    87: 'الأعلى',
    88: 'الغاشية',
    89: 'الفجر',
    90: 'البلد',
    91: 'الشمس',
    92: 'الليل',
    93: 'الضحى',
    94: 'الشرح',
    95: 'التين',
    96: 'العلق',
    97: 'القدر',
    98: 'البينة',
    99: 'الزلزلة',
    100: 'العاديات',
    101: 'القارعة',
    102: 'التكاثر',
    103: 'العصر',
    104: 'الهمزة',
    105: 'الفيل',
    106: 'قريش',
    107: 'الماعون',
    108: 'الكوثر',
    109: 'الكافرون',
    110: 'النصر',
    111: 'المسد',
    112: 'الإخلاص',
    113: 'الفلق',
    114: 'الناس'
  };
  
  return surahNames[surahNumber] || `سورة ${surahNumber}`;
}