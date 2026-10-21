# 📘 Panduan Integrasi Database Google Sheets & Google Apps Script untuk RukunKu

Dengan menghubungkan **RukunKu** ke **Google Sheets**, seluruh data warga, iuran, transaksi kas, dan catatan talangan tersimpan aman di cloud Google Drive Anda, dapat diakses dari banyak perangkat (laptop & smartphone), dan tetap 100% gratis!

---

## 🚀 Langkah 1: Buat Spreadsheet Baru

1. Buka browser dan kunjungi: **[https://sheets.new](https://sheets.new)**
2. Beri nama spreadsheet Anda, misalnya:  
   `Database RukunKu RT 05 RW 08`

---

## 💻 Langkah 2: Buka Google Apps Script

1. Pada menu atas Google Sheets, klik:  
   **Ekstensi** > **Apps Script**
2. Sebuah tab baru editor kode Google Apps Script akan terbuka.
3. Hapus seluruh isi kode bawaan (`function myFunction() { ... }`).
4. Buka berkas **`Code.gs`** yang ada di folder ini (`d:\ANTIGRAFITY\RukunKu\google-apps-script\Code.gs`), salin seluruh kodenya, dan tempelkan (*paste*) ke dalam editor Google Apps Script.
5. Klik ikon **Simpan** (💾) atau tekan `Ctrl + S`.
6. Beri nama proyek, misalnya: `RukunKu-API`.

---

## 🌐 Langkah 3: Deploy sebagai Web App (PENTING!)

Agar RukunKu dapat membaca dan menyimpan data ke Google Sheets, deploy script sebagai **Web App**:

1. Di pojok kanan atas editor Apps Script, klik tombol biru **Deploy** > **New deployment** (Penerapan baru).
2. Di sebelah kiri tulisan *"Select type"*, klik ikon gerigi ⚙️ lalu pilih **Web app**.
3. Isi konfigurasi sebagai berikut:
   - **Description**: `RukunKu API v1`
   - **Execute as**: **Me (emailanda@gmail.com)**
   - **Who has access**: **Anyone** *(Wajib pilih "Anyone" agar aplikasi RukunKu bisa berkomunikasi dengan aman)*
4. Klik tombol **Deploy**.
5. Jika muncul jendela otorisasi akun Google (*Authorization required*):
   - Klik **Authorize access**
   - Pilih akun Google Anda
   - Jika muncul peringatan *"Google hasn't verified this app"*, klik **Advanced** (Lanjutan) lalu klik **Go to RukunKu-API (unsafe)**
   - Klik **Allow** (Izinkan).
6. Setelah selesai, Anda akan mendapatkan **Web app URL** yang berakhiran `/exec`.  
   Contoh format:
   ```
   https://script.google.com/macros/s/AKfycbxXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/exec
   ```
7. Klik **Copy** pada Web app URL tersebut.

---

## 🔗 Langkah 4: Hubungkan ke Webapp RukunKu

1. Buka aplikasi **RukunKu** di browser Anda.
2. Klik tombol **"☁️ Cloud Sync"** di header atas, atau klik menu **"Database Google Sheets"** di sidebar kiri.
3. Tempelkan (*paste*) URL Web App yang sudah Anda salin ke kolom **"URL Web App Google Apps Script"**.
4. Klik tombol **"Tes Koneksi"** untuk memastikan koneksi berhasil.
5. Klik **"Kirim Data Lokal ke Google Sheet"** untuk pertama kali agar data warga, kas, dan iuran otomatis mengisi sheet Google Anda dengan rapi!

---

## 📊 Apa Saja yang Dibuat Otomatis di Google Sheets?

Sistem akan otomatis membuat 5 lembar kerja (*sheet*) dengan tata letak warna hijau tosca khas RukunKu:
1. **Warga**: 15 Kolom lengkap (ID, Nama Kepala Keluarga, NIK, No KK, Blok, Nomor Rumah, Alamat, Nomor WhatsApp, Jumlah Jiwa, Status Hunian, Pekerjaan, Status Aktif, Tanggal Masuk, Avatar Bg, **Password (Akun Warga)**).  
   *(Pengurus dapat melihat password warga langsung di Kolom O jika ada warga yang lupa password akunnya).*
2. **Transaksi**: ID Transaksi, Tanggal, Jenis (Masuk/Keluar), Kategori, Nominal, Metode, No Kwitansi.
3. **Iuran**: Matriks pembayaran 12 bulan (Januari - Desember) untuk setiap KK.
4. **Talangan**: Data peminjam kas RT, nominal, sisa pinjaman, jatuh tempo, dan status lunas.
5. **Pengaturan**: Informasi nama RT, RW, nama pengurus, nomor rekening RT, dan master daftar blok perumahan.

> 💡 **Tips Pembaruan Kolom Password:**  
> Jika spreadsheet Anda sudah terlanjur dibuat sebelum adanya kolom Password, Anda cukup membuka menu **Google Sheets & Cloud** di RukunKu lalu klik **"Kirim Data Lokal ke Sheet"**. Kolom Password (Kolom O) akan langsung otomatis dibuatkan dan seluruh password warga akan tersinkronkan.

---

## 🔄 Keuntungan Fitur Ini
* **Gratis Selamanya:** Tidak memerlukan biaya sewa server atau database hosting.
* **Akses Multi-Device:** Pengurus di lapangan bisa membuka dari HP, sementara Bendahara di rumah menginput dari laptop, data tersinkronisasi.
* **Mudah Dikelola:** Pengurus RT yang terbiasa menggunakan Excel/Spreadsheet dapat melihat dan mengedit data langsung dari Google Drive mereka.
* **Offline-Resilient:** Jika internet mati atau sedang offline, RukunKu tetap berjalan normal menggunakan database lokal (*LocalStorage*).
