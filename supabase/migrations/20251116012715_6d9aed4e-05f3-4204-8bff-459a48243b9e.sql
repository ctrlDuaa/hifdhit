-- Ensure mistakes table has REPLICA IDENTITY FULL for complete real-time updates
ALTER TABLE mistakes REPLICA IDENTITY FULL;