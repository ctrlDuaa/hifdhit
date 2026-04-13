-- Create feature_requests table
CREATE TABLE public.feature_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  request_text text NOT NULL,
  user_email text,
  user_name text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.feature_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can insert feature requests"
ON public.feature_requests
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can view their own feature requests"
ON public.feature_requests
FOR SELECT
USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update their own feature requests"
ON public.feature_requests
FOR UPDATE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_feature_requests_updated_at
BEFORE UPDATE ON public.feature_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();