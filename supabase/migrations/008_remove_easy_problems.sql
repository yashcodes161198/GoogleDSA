-- Remove easy problems from the catalog (dataset is medium/hard only).
DELETE FROM problems WHERE difficulty = 'EASY';
