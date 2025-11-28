-- Drop existing permissive policies for channels
DROP POLICY IF EXISTS "Anyone can add channels" ON public.channels;
DROP POLICY IF EXISTS "Anyone can delete channels" ON public.channels;
DROP POLICY IF EXISTS "Anyone can update channels" ON public.channels;
DROP POLICY IF EXISTS "Channels are viewable by everyone" ON public.channels;

-- Create new secure policies for channels
CREATE POLICY "Public read access for channels" ON public.channels FOR SELECT USING (true);
CREATE POLICY "Admins can insert channels" ON public.channels FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update channels" ON public.channels FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete channels" ON public.channels FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Drop existing permissive policies for locations
DROP POLICY IF EXISTS "Anyone can add locations" ON public.locations;
DROP POLICY IF EXISTS "Anyone can delete locations" ON public.locations;
DROP POLICY IF EXISTS "Anyone can update locations" ON public.locations;
DROP POLICY IF EXISTS "Locations are viewable by everyone" ON public.locations;

-- Create new secure policies for locations
CREATE POLICY "Public read access for locations" ON public.locations FOR SELECT USING (true);
CREATE POLICY "Admins can insert locations" ON public.locations FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update locations" ON public.locations FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete locations" ON public.locations FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Drop existing permissive policies for trainings
DROP POLICY IF EXISTS "Anyone can delete trainings" ON public.trainings;
DROP POLICY IF EXISTS "Anyone can insert trainings" ON public.trainings;
DROP POLICY IF EXISTS "Anyone can update trainings" ON public.trainings;
DROP POLICY IF EXISTS "Trainings are viewable by everyone" ON public.trainings;

-- Create new secure policies for trainings
CREATE POLICY "Public read access for trainings" ON public.trainings FOR SELECT USING (true);
CREATE POLICY "Admins can insert trainings" ON public.trainings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update trainings" ON public.trainings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete trainings" ON public.trainings FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Drop existing permissive policies for processed_images
DROP POLICY IF EXISTS "Allow public delete" ON public.processed_images;
DROP POLICY IF EXISTS "Allow public insert" ON public.processed_images;
DROP POLICY IF EXISTS "Allow public read" ON public.processed_images;

-- Create new secure policies for processed_images
CREATE POLICY "Public read access for processed_images" ON public.processed_images FOR SELECT USING (true);
CREATE POLICY "Admins can insert processed_images" ON public.processed_images FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update processed_images" ON public.processed_images FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete processed_images" ON public.processed_images FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));