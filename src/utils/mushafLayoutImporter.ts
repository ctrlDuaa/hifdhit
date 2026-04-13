import initSqlJs from 'sql.js';
import { mushafLocalDb, LocalMushafPage, LocalWord, LocalPageInfo } from '@/db/mushafLocalDb';

export async function importMushafLayout(
  layoutBuffer: ArrayBuffer,
  onProgress?: (percent: number, status?: string) => void
) {
  const SQL = await initSqlJs({ locateFile: () => `/sql-wasm.wasm` });
  const sqlite = new SQL.Database(new Uint8Array(layoutBuffer));

  onProgress?.(10, 'Validating Mushaf layout database...');

  // Validate schema
  const tablesStmt = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'");
  const tables: string[] = [];
  while (tablesStmt.step()) {
    const row = tablesStmt.getAsObject() as any;
    tables.push(row.name);
  }
  tablesStmt.free();

  if (!tables.includes('pages')) {
    throw new Error('Invalid Mushaf layout database: missing "pages" table');
  }

  // Get total pages count
  const countStmt = sqlite.prepare('SELECT COUNT(DISTINCT page_number) as count FROM pages');
  countStmt.step();
  const countRow = countStmt.getAsObject() as any;
  const totalPages = Number(countRow.count);
  countStmt.free();

  onProgress?.(20, `Found ${totalPages} pages in Mushaf layout...`);

  // Import pages data
  const pagesStmt = sqlite.prepare(`
    SELECT page_number, line_number, line_type, is_centered, 
           first_word_id, last_word_id, surah_number 
    FROM pages ORDER BY page_number, line_number
  `);
  
  const pages: LocalMushafPage[] = [];
  const pageInfoSet = new Set<number>();
  
  while (pagesStmt.step()) {
    const row = pagesStmt.getAsObject() as any;
    const pageData: LocalMushafPage = {
      page_number: Number(row.page_number),
      line_number: Number(row.line_number),
      line_type: String(row.line_type) as 'ayah' | 'surah_name' | 'basmallah',
      is_centered: Boolean(row.is_centered),
      first_word_id: Number(row.first_word_id),
      last_word_id: Number(row.last_word_id),
      surah_number: row.surah_number ? Number(row.surah_number) : undefined,
    };
    pages.push(pageData);
    pageInfoSet.add(pageData.page_number);
  }
  pagesStmt.free();

  // Create page info records
  const pageInfos: LocalPageInfo[] = Array.from(pageInfoSet).map(page_number => ({
    page_number
  }));

  onProgress?.(80, 'Saving Mushaf layout to local database...');

  // Save to local database
  await mushafLocalDb.transaction('rw', mushafLocalDb.pages, mushafLocalDb.pageInfo, async () => {
    await mushafLocalDb.pages.bulkPut(pages);
    await mushafLocalDb.pageInfo.bulkPut(pageInfos);
  });

  onProgress?.(100, 'Mushaf layout imported successfully!');
  sqlite.close();
}

export async function importQuranScript(
  scriptBuffer: ArrayBuffer,
  onProgress?: (percent: number, status?: string) => void
) {
  const SQL = await initSqlJs({ locateFile: () => `/sql-wasm.wasm` });
  const sqlite = new SQL.Database(new Uint8Array(scriptBuffer));

  onProgress?.(10, 'Validating Quran script database...');

  // Validate schema
  const tablesStmt = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'");
  const tables: string[] = [];
  while (tablesStmt.step()) {
    const row = tablesStmt.getAsObject() as any;
    tables.push(row.name);
  }
  tablesStmt.free();

  if (!tables.includes('words')) {
    throw new Error('Invalid Quran script database: missing "words" table');
  }

  // Get total words count
  const countStmt = sqlite.prepare('SELECT COUNT(*) as count FROM words');
  countStmt.step();
  const countRow = countStmt.getAsObject() as any;
  const totalWords = Number(countRow.count);
  countStmt.free();

  onProgress?.(20, `Found ${totalWords} words in Quran script...`);

  // Import words data
  const wordsStmt = sqlite.prepare(`
    SELECT id, location, surah, ayah, word, text 
    FROM words ORDER BY id
  `);
  
  const words: LocalWord[] = [];
  
  while (wordsStmt.step()) {
    const row = wordsStmt.getAsObject() as any;
    const wordData: LocalWord = {
      id: Number(row.id),
      location: String(row.location),
      surah: Number(row.surah),
      ayah: Number(row.ayah),
      word: Number(row.word),
      text: String(row.text),
    };
    words.push(wordData);
  }
  wordsStmt.free();

  onProgress?.(80, 'Saving Quran script to local database...');

  // Save to local database
  await mushafLocalDb.transaction('rw', mushafLocalDb.words, async () => {
    await mushafLocalDb.words.bulkPut(words);
  });

  onProgress?.(100, 'Quran script imported successfully!');
  sqlite.close();
}