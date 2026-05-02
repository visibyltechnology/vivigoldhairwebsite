-- Create the product-images storage bucket (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

-- Allow anyone to view/download images (public bucket)
CREATE POLICY "Public read access for product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- Allow authenticated admins to upload images
CREATE POLICY "Authenticated users can upload product images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images');

-- Allow authenticated admins to update images
CREATE POLICY "Authenticated users can update product images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images');

-- Allow authenticated admins to delete images
CREATE POLICY "Authenticated users can delete product images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images');
