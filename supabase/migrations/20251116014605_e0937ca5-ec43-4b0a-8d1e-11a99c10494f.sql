-- Drop the old check constraint
ALTER TABLE mistakes DROP CONSTRAINT IF EXISTS mistakes_mistake_category_check;

-- Add the updated check constraint with the new 'incorrect' category
ALTER TABLE mistakes ADD CONSTRAINT mistakes_mistake_category_check 
CHECK (mistake_category IN ('incorrect', 'missed', 'tajweed', 'harakah'));