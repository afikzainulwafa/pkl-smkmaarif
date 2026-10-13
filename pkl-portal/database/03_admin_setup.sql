-- Jalankan setelah akun calon admin masuk dengan Google minimal sekali.
-- Ganti alamat contoh di bawah dengan email admin yang benar.
-- Role admin hanya ditambahkan dari SQL Editor oleh pemilik proyek Supabase.
do $$
declare admin_id uuid;
begin
 select id into admin_id from auth.users where lower(email)=lower('GANTI_EMAIL_ADMIN@gmail.com') and email_confirmed_at is not null;
 if admin_id is null then raise exception 'Email admin belum login atau email contoh belum diganti.'; end if;
 insert into pkl_private.admins(user_id) values(admin_id) on conflict do nothing;
end; $$;
