# PKL Connect — SMK Ma'arif NU 1 Sumpiuh

Aplikasi pemetaan PKL 2026/2027. Frontend statis untuk GitHub → Vercel, database dan autentikasi Google di Supabase. Tidak memerlukan PHP, MySQL, VPS, atau hosting server berbayar.

## Coba sekarang

Buka `demo-preview.html` di Chrome/Edge. File ini mandiri, tidak memerlukan npm atau server. Pilih **Siswa**, gunakan NIS `2600001`; untuk panel pengelolaan pilih **Admin**. NIS dummy tersedia dari `2600001` sampai `2600210`.

Mode demo selalu menampilkan banner DEMO. Semua identitas fiktif; perubahan disimpan hanya pada browser. Gunakan **Keluar** untuk berganti peran, dan **Pulihkan demo** untuk mengembalikan kondisi awal. Demo tidak menguji Google OAuth atau konkurensi antarperangkat. Untuk perangkat berbeda, gunakan mode live di bawah.

## Fitur

- 210 siswa dummy (30 per kelas XI TAB 1–7), NIS unik.
- 121 DU/DI: 40 TAB, 11 TAV, 30 TKJ, 40 TKR, sesuai master yang diberikan.
- Kuota terpisah Gelombang 1 dan 2, filter wilayah/jurusan, pencarian, status ketersediaan.
- Login Google live dengan email yang sudah terdaftar di master siswa.
- Panel admin: kuota, siswa, pilihan, pengajuan, pengaturan, izin individual, log, dan ekspor CSV yang dapat dibuka di Excel.
- Reset pilihan tanpa menghapus siswa; pindah tempat atomik; pengajuan tidak memesan kursi tujuan.
- Pilihan dikunci, boleh mengganti langsung, atau perlu persetujuan; batas perubahan/tenggat/override individual.
- Bukti pilihan dapat dicetak melalui browser; ini bukan surat penempatan resmi.

## Deploy demo gratis lewat GitHub dan Vercel

1. Ekstrak paket. Buat repository di akun GitHub pribadi, misalnya `pkl-connect`.
2. Upload **isi folder proyek** sehingga `package.json`, `vercel.json`, `public/`, `database/`, dan `scripts/` berada di root repository. Jangan upload ZIP sebagai satu file. Folder `node_modules/` tidak perlu diupload.
3. Di Vercel: **Add New → Project → Import Git Repository**, pilih repository tersebut.
4. Framework preset **Other**, Root Directory `./`, Build Command `npm run build`, Output Directory `dist`. `vercel.json` sudah mengaturnya; Install Command gunakan default.
5. Jangan isi variabel Supabase untuk demo. Klik **Deploy**. Website terbuka dalam mode demo dengan data browser.

Paket ini belum membuat repository GitHub atau project Vercel pada akun Anda. URL `*.vercel.app` akan diberikan oleh Vercel setelah deploy. Setelah terhubung, perubahan/push GitHub memicu deployment baru.

## Aktifkan database bersama dan login Google

### 1. Buat Supabase Free

Buka https://supabase.com/dashboard dan buat proyek **Free**. Pilih region yang sesuai, misalnya Singapore bila tersedia. Catat Project URL dan **publishable key** dari pengaturan API; legacy `anon` key juga didukung. Jangan gunakan `service_role` atau secret key.

Di **SQL Editor**, jalankan satu kali, berurutan:

1. `database/01_schema.sql`
2. `database/02_seed.sql`

Seed live sengaja menutup seluruh alokasi dan periode. Kuota kosong tetap NULL. Beberapa nilai terisi lama melebihi kapasitas; sistem tidak menghapus atau menormalkannya diam-diam. File MySQL dari paket dummy sebelumnya tidak digunakan di Supabase; gunakan SQL PostgreSQL di proyek ini.

### 2. Siapkan Google OAuth

Ikuti panduan resmi https://supabase.com/docs/guides/auth/social-login/auth-google.

1. Buat project pada Google Cloud Console; siapkan Google Auth Platform/consent screen, nama aplikasi dan email kontak.
2. Buat OAuth Client jenis **Web application**.
3. Authorized JavaScript origins: tambahkan URL Vercel produksi, misalnya `https://pkl-connect.vercel.app`.
4. Authorized redirect URI: gunakan callback yang ditampilkan oleh Supabase, biasanya `https://PROJECT_ID.supabase.co/auth/v1/callback`.
5. Pada Supabase **Authentication → Sign In / Providers → Google**, aktifkan Google dan isi Client ID serta Client Secret dari Google. Secret hanya dimasukkan ke Supabase, bukan frontend/GitHub.
6. Pada Supabase **Authentication → URL Configuration**, isi Site URL dengan URL Vercel, dan tambahkan redirect URL yang sama diakhiri `/`. Untuk tes lokal tambahkan `http://localhost:3000/`.
7. Jika consent masih Testing, tambahkan akun penguji di Google. Sebelum dibuka kepada seluruh siswa, konfigurasi audience/publishing status mengikuti panduan Google. Aktifkan hanya provider yang diperlukan; aplikasi ini memakai Google.

### 3. Masukkan dua environment variables di Vercel

Pada **Project → Settings → Environment Variables**:

| Nama | Nilai |
|---|---|
| `SUPABASE_URL` | `https://PROJECT_ID.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable key (`sb_publishable_…`) atau legacy anon key |

Isi untuk Production. Preview/Development hanya bila Anda memang menyiapkan callback untuk environment tersebut. Pilih **Redeploy**: konfigurasi dibaca saat build, bukan runtime. Jika hanya satu variabel terisi, build gagal agar tidak beralih ke demo diam-diam. Tidak ada password database atau service-role key di frontend.

### 4. Jadikan akun Anda admin

1. Buka website live dan **Masuk dengan Google** menggunakan email calon admin. Pertama kali muncul “akun belum terdaftar”; ini normal.
2. Buka `database/03_admin_setup.sql`, ganti `GANTI_EMAIL_ADMIN@gmail.com` dengan email tersebut.
3. Jalankan SQL tersebut di Supabase SQL Editor.
4. Pada website klik **Cek lagi**. Panel admin akan terbuka.

Tidak ada akun/password admin bawaan pada mode live. Tombol masuk sebagai Admin hanya ada di demo. Jangan berikan akses dashboard/SQL Editor Supabase kepada siswa.

### 5. Persiapkan data sebelum pendaftaran

1. **Data siswa → Edit/Tambah**: daftarkan nama, NIS, kelas, jurusan dan email Google asli. Email harus sesuai persis (perbandingan tidak membedakan huruf besar/kecil). Email dummy `example.test` tidak bisa digunakan login Google.
2. Nonaktifkan siswa dummy yang tidak dipakai. Saat mengedit siswa dummy menjadi data nyata, penanda is_dummy pada database tetap penanda asal seed; identitas/login ditentukan oleh email dan status aktif.
3. **Tempat & kuota → Atur** untuk gelombang yang benar: periksa kapasitas dan saldo terisi impor, centang **sudah dikonfirmasi**, lalu **buka pilihan**. Kolom kosong perlu diverifikasi apakah benar nol; jangan menganggapnya nol tanpa pemeriksaan.
4. Atasi data yang melebihi kuota dengan kapasitas yang telah disetujui sekolah atau rekonsiliasi saldo. Jangan sekadar menghapus saldo lama supaya tersedia.
5. **Pengaturan**: buka periode, pilih kebijakan perubahan, batas perubahan, dan tenggat. Default yang disarankan: persetujuan admin, satu perubahan berhasil.
6. Uji menggunakan dua akun siswa dan akun admin. Semua pilihan sungguhan menggunakan RPC PostgreSQL yang memeriksa kuota di server.

Pengaturan tanggal memakai waktu lokal perangkat dan disimpan sebagai UTC. Gelombang 1 dan 2 tidak berbagi kapasitas: KUOTA sumber diasumsikan berlaku masing-masing gelombang. Konfirmasi asumsi ini dengan sekolah.

## Aturan pengelolaan

| Kebutuhan | Cara |
|---|---|
| Siswa boleh memilih ulang | Pilihan siswa → Reset, sertakan alasan. Kursi lama dilepas, profil/riwayat tetap tersimpan. |
| Siswa tertentu boleh mengganti | Data siswa → Izin, atur override dan tambahan kesempatan untuk gelombang aktif. |
| Seluruh siswa tidak boleh mengganti | Pengaturan → Pilihan dikunci. Admin tetap bisa memindahkan dengan alasan dan kuota valid. |
| Pindah memerlukan persetujuan | Pengaturan → Persetujuan admin; admin memproses melalui Pengajuan pindah. |
| Siswa menunggu keputusan | Pilihan lama tetap aktif; target belum dipesan. Jika penuh saat disetujui, transaksi gagal dan pilihan lama tetap aktif. |
| Nonaktifkan siswa | Edit siswa, nonaktifkan. Kursi tidak otomatis dilepas; lakukan reset secara terpisah bila perlu. |
| Mulai tahun baru | Buat periode/master baru melalui migrasi; tidak menghapus data tahun sebelumnya. Versi ini menyediakan tahun 2026/2027. |

Reset tidak mengosongkan hitungan perubahan yang telah dipakai. Admin dapat memberi tambahan kesempatan secara eksplisit. Tidak ada tombol hapus massal atau hard delete untuk operasional normal.

## Saldo impor dan kuota

Rumus: **terisi = saldo impor terkonfirmasi + jumlah pilihan aktif baru**. Sisa dihitung setiap kali, bukan counter yang disimpan terpisah. Nilai negatif terlihat di admin; siswa melihat 0.

Pendaftaran siswa lama dari tabel belum diketahui nama/NIS-nya. Karena itu saldo tersebut tidak dihubungkan secara fiktif dengan siswa dummy. Ketika detail siswa lama dipindahkan ke sistem, pemilik database perlu melakukan migrasi/reconciliation: kurangi saldo agregat sejumlah detail yang berhasil dimasukkan dalam transaksi yang sama. Mengimpor detail tanpa mengurangi saldo akan menghitung ganda. Fitur migrasi detail pendaftar lama otomatis belum disediakan.

Baris PT. Jalur Lintas Maritim Tambak mengandung teks total dan formula rusak. Nilai 121 bukan dianggap sebagai jumlah pendaftar; terisi efektif tetap NULL, dengan nilai sumber dipertahankan.

## Pengembangan lokal

Node.js 22+ diperlukan untuk build; PHP/XAMPP tidak diperlukan.

```sh
npm install
npm run build
npm run dev
```

Buka http://localhost:3000. Untuk live lokal, atur dua environment variables melalui terminal sebelum build. `.env.example` adalah contoh; skrip tidak otomatis membaca `.env`. Pada PowerShell:

```powershell
$env:SUPABASE_URL="https://PROJECT_ID.supabase.co"
$env:SUPABASE_PUBLISHABLE_KEY="sb_publishable_GANTI"
npm run build
npm run dev
```

`npm test` menjalankan tes aturan demo, fungsi SQL dalam PostgreSQL lokal via PGlite dengan stub Supabase Auth, dan interaksi DOM pada demo mandiri. Jalankan build terlebih dahulu jika source berubah.

## Keamanan dan verifikasi

Tabel berada di schema `pkl_private`, tidak diekspos langsung dan RLS aktif. Hanya RPC `pkl_snapshot` dan `pkl_action` yang diberikan kepada role authenticated; RPC menentukan siswa dari email terverifikasi pada sesi server, bukan ID/NIS yang dikirim form. Admin ditentukan dari UUID dalam tabel admin. Snapshot siswa hanya berisi identitas dan pilihan mereka sendiri, serta master tempat sesuai jurusan. Seluruh mutasi serial menggunakan advisory transaction lock dan menulis log audit.

Untuk skala sekolah, satu lock aplikasi membuat transaksi kuota sederhana dan konsisten. Jika volume meningkat jauh, perlu evaluasi penguncian per alokasi. Jangan menulis pilihan langsung dari SQL/admin tool tanpa mengikuti aturan transaksi, kecuali migrasi yang direncanakan.

12 tes lulus pada paket ini. Tes mencakup: hak akses, submit ulang, perebutan kursi terakhir secara berurutan, reset, kegagalan persetujuan saat target penuh, batas perubahan, override, tenggat, kecocokan jurusan, manipulasi student_id, pencegahan penurunan kuota di bawah pendaftaran aktif, serta interaksi DOM siswa memilih → admin reset dan penampilan error form. Build mode demo dan konfigurasi mode live juga berhasil. Belum dilakukan pengujian load multi-session pada Supabase sungguhan, login Google end-to-end, atau visual QA lintas browser.

## Paket gratis: batas yang perlu dipahami

Dokumentasi diperiksa 13 Oktober 2026:

- Vercel Hobby gratis dengan batas penggunaan, untuk penggunaan **personal nonkomersial**. Penggunaan operasional sekolah tidak otomatis memenuhi kategori personal; cek ketentuan/kesesuaian penggunaan Anda. https://vercel.com/docs/plans/hobby dan https://vercel.com/docs/limits/fair-use-guidelines
- Supabase Free menyediakan 500 MB database dan 50.000 MAU; proyek dapat dijeda setelah satu minggu tidak aktif, maksimal dua proyek aktif. https://supabase.com/pricing
- Tidak perlu domain berbayar; gunakan domain default hosting. Google OAuth memerlukan konfigurasi proyek Google, bukan VPS.
- Jangan menganggap paket gratis sebagai jaminan layanan selalu tersedia. Sebelum periode PKL dibuka, cek proyek Supabase aktif. Ekspor rekap secara berkala; backup otomatis bukan fitur Free yang dijamin paket ini.

Jika Vercel Hobby tidak sesuai penggunaan Anda, frontend statis yang sama dapat dipindahkan ke penyedia hosting statis lain; database/login Supabase tetap dipakai. Berkas `dist/` adalah hasil build untuk diupload, setelah URL callback disesuaikan. Source bisa dipakai tanpa ketergantungan pada API Vercel.
