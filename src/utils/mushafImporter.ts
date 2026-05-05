import { supabase } from '@/integrations/supabase/runtimeClient';




// Helper function to map character types
const mapCharType = (charType?: string): 'word' | 'end' | 'pause' | 'ruby' | 'bismillah' | 'sajdah' | 'hamza' | 'other' => {
  if (!charType) return 'word';
  
  const type = charType.toLowerCase();
  
  if (type.includes('word')) return 'word';
  if (type.includes('end')) return 'end';
  if (type.includes('pause')) return 'pause';
  if (type.includes('ruby')) return 'ruby';
  if (type.includes('bismillah')) return 'bismillah';
  if (type.includes('sajdah')) return 'sajdah';
  if (type.includes('hamza')) return 'hamza';
  
  return 'other';
};


// Clear all Mushaf data
export const clearMushafData = async (): Promise<void> => {
  console.log('Clearing all Mushaf data...');
  
  // Delete in reverse order due to foreign keys
  await supabase.from('mushaf_words').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('mushaf_lines').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('mushaf_pages').delete().neq('page_number', 0);
  
  console.log('All Mushaf data cleared!');
};