import Dexie, { Table } from 'dexie';

export interface LocalWord {
  id: number; // unique ID for each word (referenced by first_word_id/last_word_id)
  location: string; // unique word key in Surah:Ayah format
  surah: number;
  ayah: number;
  word: number; // position of the word within the ayah
  text: string; // word text to render
}

export interface LocalMushafPage {
  page_number: number;
  line_number: number; // line number on the page
  line_type: 'ayah' | 'surah_name' | 'basmallah'; // type of line
  is_centered: boolean; // center-aligned (true) or fully justified (false)
  first_word_id: number; // ID of first word on this line
  last_word_id: number; // ID of last word on this line
  surah_number?: number; // identifies the Surah displayed on this line
}

export interface LocalPageInfo {
  page_number: number; // 1-604
}

class MushafLocalDb extends Dexie {
  words!: Table<LocalWord, number>;
  pages!: Table<LocalMushafPage, number>;
  pageInfo!: Table<LocalPageInfo, number>;

  constructor() {
    super('mushafLocal');
    this.version(3).stores({
      // Quran script words table
      words: 'id, surah, ayah, location, word',
      // Mushaf layout pages table  
      pages: '++id, page_number, line_number, line_type, surah_number, first_word_id, last_word_id',
      // Page info for quick lookups
      pageInfo: 'page_number',
    });
  }
}

export const mushafLocalDb = new MushafLocalDb();

export async function clearLocalMushaf() {
  await mushafLocalDb.transaction('rw', mushafLocalDb.words, mushafLocalDb.pages, mushafLocalDb.pageInfo, async () => {
    await mushafLocalDb.words.clear();
    await mushafLocalDb.pages.clear();
    await mushafLocalDb.pageInfo.clear();
  });
}
