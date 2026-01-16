-- Additional Supabase Schema Updates for CI-Connect App
-- Run this SQL in your Supabase project SQL editor after the initial setup

-- Add missing columns to posts table
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;

-- Add read column to messages table for compatibility
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT FALSE;

-- Enable RLS for post_likes and post_comments if not already enabled
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.networking_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view all post likes" ON post_likes;
DROP POLICY IF EXISTS "Users can insert their own likes" ON post_likes;
DROP POLICY IF EXISTS "Users can delete their own likes" ON post_likes;
DROP POLICY IF EXISTS "Users can view all post comments" ON post_comments;
DROP POLICY IF EXISTS "Users can insert their own comments" ON post_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON post_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON post_comments;
DROP POLICY IF EXISTS "Users can view their networking requests" ON networking_requests;
DROP POLICY IF EXISTS "Users can insert their own networking requests" ON networking_requests;
DROP POLICY IF EXISTS "Users can update networking requests they received" ON networking_requests;
DROP POLICY IF EXISTS "Users can update likes on posts" ON posts;
DROP POLICY IF EXISTS "Users can update read status on received messages" ON messages;
-- Storage policies
DROP POLICY IF EXISTS "Users can view post images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload post images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own post images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own post images" ON storage.objects;

-- RLS Policies for post_likes
CREATE POLICY "Users can view all post likes" ON post_likes FOR SELECT USING (true);
CREATE POLICY "Users can insert their own likes" ON post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own likes" ON post_likes FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for post_comments
CREATE POLICY "Users can view all post comments" ON post_comments FOR SELECT USING (true);
CREATE POLICY "Users can insert their own comments" ON post_comments FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users can update their own comments" ON post_comments FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Users can delete their own comments" ON post_comments FOR DELETE USING (auth.uid() = author_id);

-- RLS Policies for networking_requests
CREATE POLICY "Users can view their networking requests" ON networking_requests FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can insert their own networking requests" ON networking_requests FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can update networking requests they received" ON networking_requests FOR UPDATE USING (auth.uid() = receiver_id);

-- Update RLS policies if needed (assuming they are already set)
-- For posts with new columns
CREATE POLICY "Users can update likes on posts" ON posts FOR UPDATE USING (true) WITH CHECK (true);

-- For messages read status
CREATE POLICY "Users can update read status on received messages" ON messages FOR UPDATE USING (auth.uid() = receiver_id);

-- Create storage bucket for post images (if not already exists)
INSERT INTO storage.buckets (id, name, public) VALUES ('post-images', 'post-images', true) ON CONFLICT (id) DO NOTHING;

-- Storage policies for post-images bucket
CREATE POLICY "Users can view post images" ON storage.objects FOR SELECT USING (bucket_id = 'post-images');
CREATE POLICY "Users can upload post images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'post-images' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can update their own post images" ON storage.objects FOR UPDATE USING (bucket_id = 'post-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own post images" ON storage.objects FOR DELETE USING (bucket_id = 'post-images' AND auth.uid()::text = (storage.foldername(name))[1]);