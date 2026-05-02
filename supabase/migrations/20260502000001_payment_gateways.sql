-- Add Korapay keys and payment gateway toggles to settings
INSERT INTO public.settings (key, value)
VALUES
  ('korapay_keys', '{"public_key":"", "secret_key":""}'::jsonb),
  ('payment_gateways', '{"flutterwave":{"enabled":true},"korapay":{"enabled":false}}'::jsonb)
ON CONFLICT (key) DO NOTHING;
