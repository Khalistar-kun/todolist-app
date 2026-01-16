-- Show the current log_activity function code

SELECT
  'Current log_activity() function definition:' as info,
  pg_get_functiondef(p.oid) as function_code
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'log_activity';
