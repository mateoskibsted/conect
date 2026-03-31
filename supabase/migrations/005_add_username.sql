-- Agregar nombre de usuario único a profiles
ALTER TABLE public.profiles ADD COLUMN username text;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_unique UNIQUE (username);
