-- Create product-videos storage bucket (100MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-videos',
  'product-videos',
  true,
  104857600,
  ARRAY['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 104857600,
  allowed_mime_types = ARRAY['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'];

CREATE POLICY "Public read access for product videos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-videos');

CREATE POLICY "Authenticated users can upload product videos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-videos');

CREATE POLICY "Authenticated users can update product videos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-videos');

CREATE POLICY "Authenticated users can delete product videos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-videos');

-- Default installment interest rates
INSERT INTO public.settings (key, value)
VALUES (
  'installment_rates',
  '{"two_parts": 10, "three_parts": 20, "four_parts": 30}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
