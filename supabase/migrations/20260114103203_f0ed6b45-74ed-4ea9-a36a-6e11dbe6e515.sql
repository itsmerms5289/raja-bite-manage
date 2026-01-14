-- Create settings table for storing app settings like UPI QR code
CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can view settings
CREATE POLICY "Anyone can view settings"
  ON public.app_settings
  FOR SELECT
  USING (true);

-- Only managers can update settings
CREATE POLICY "Managers can update settings"
  ON public.app_settings
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'manager'
  ));

-- Only managers can insert settings
CREATE POLICY "Managers can insert settings"
  ON public.app_settings
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'manager'
  ));

-- Insert default UPI QR setting
INSERT INTO public.app_settings (key, value) VALUES ('upi_qr_url', NULL);