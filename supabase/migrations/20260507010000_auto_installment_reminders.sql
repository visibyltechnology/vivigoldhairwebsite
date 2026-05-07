-- Generate cron secret inside the DB (never appears in any file)
INSERT INTO public.settings (key, value)
VALUES ('cron_config', jsonb_build_object('reminder_secret', gen_random_uuid()::text))
ON CONFLICT (key) DO UPDATE
  SET value = jsonb_build_object('reminder_secret', gen_random_uuid()::text);

-- Remove any existing job with this name before re-scheduling
SELECT cron.unschedule('daily-installment-reminders') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'daily-installment-reminders'
);

-- Daily at 07:00 UTC (08:00 WAT / Lagos time)
SELECT cron.schedule(
  'daily-installment-reminders',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://iivgirvlatkcwklflmzc.supabase.co/functions/v1/installment-reminders?days=3',
    headers := jsonb_build_object(
      'Content-Type',           'application/json',
      'X-Reminder-Cron-Secret', (
        SELECT value->>'reminder_secret'
        FROM   public.settings
        WHERE  key = 'cron_config'
        LIMIT  1
      )
    ),
    body    := '{"auto":true}'::jsonb
  );
  $$
);
