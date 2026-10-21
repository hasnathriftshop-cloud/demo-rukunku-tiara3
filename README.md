# RukunKu - Webapp Manajemen Warga & Keuangan Lingkungan RT Terpadu

Webapp modern, responsif, dan mobile-friendly untuk pengelolaan administrasi data warga serta transparansi pembukuan kas lingkungan RT terpadu.

Desain antarmuka dirancang presisi sesuai konsep dashboard modern dengan perpaduan warna hijau tosca (*teal*), aksen kuning cerah (*yellow*), kurva tab melengkung (*inverted curved tabs*), dan grafik interaktif.

---

## 🌟 Fitur Utama

### 1. Halaman Login Berbasis Peran (*Role-Based Access*)
* **Pengurus / Bendahara RT:** Akses penuh untuk input data warga, mengelola tagihan iuran bulanan, mencatat kas masuk & kas keluar, mengelola catatan talangan/kasbon, dan mengunduh laporan LPJ resmi.
* **Warga (Kepala Keluarga):** Akses transparan bagi setiap kepala keluarga untuk memantau status iuran rumahnya sendiri, mengirim konfirmasi pembayaran, serta melihat mutasi kas RT secara *real-time*.
* **Peralihan Cepat (*Quick Role Switcher*):** Tombol *pill* di pojok kanan atas untuk berpindah antara mode Pengurus dan mode Warga dalam satu klik untuk kemudahan demonstrasi.

### 2. Manajemen Biodata & Data Warga (Administrasi)
* Pendataan Kepala Keluarga (KK), NIK (16 digit), No KK, Blok & Nomor Rumah, Alamat Lengkap, Nomor WhatsApp aktif, Jumlah Anggota Keluarga (Jiwa), Status Hunian (*Pemilik Tetap, Kontrak, Kos*), dan Profesi.
* Fitur pencarian cepat (*live search*), filter berdasarkan Blok (Blok A, B, C), dan tombol WhatsApp langsung (*one-click chat*) ke nomor warga.

### 3. Pencatatan Keuangan (Kas Masuk & Kas Keluar)
* **Kas Masuk:** Pencatatan iuran wajib bulanan, iuran sosial/kematian, donasi sukarela warga, pelunasan talangan, dan penerimaan lainnya lengkap dengan metode pembayaran (Transfer BCA, QRIS RT, Tunai).
* **Kas Keluar:** Pencatatan pengeluaran operasional (honor satpam, armada sampah DLHK, perbaikan lampu penerangan jalan, konsumsi kerja bakti, santunan duka).
* **Kwitansi Digital:** Cetak bukti tanda terima pembayaran resmi RT per transaksi.

### 4. Kategori Transaksi Keuangan
* Pengelompokan jenis penerimaan dan pengeluaran yang terstruktur dan mudah difilter.

### 5. History & Riwayat Transaksi
* Riwayat seluruh arus kas masuk dan keluar secara kronologis dengan informasi tanggal, waktu, nominal, metode, dan status verifikasi.

### 6. Catatan Utang, Piutang & Talangan Warga
* Modul khusus pencatatan kas RT yang dipinjamkan sementara (misal: talangan darurat berobat warga, kasbon petugas ronda, atau kelonggaran iuran).
* Memantau sisa saldo pinjaman, jatuh tempo, serta pencatatan cicilan/pelunasan bertahap yang otomatis terhubung ke kas masuk.

### 7. Laporan Keuangan & Download PDF
* Laporan Pertanggungjawaban (LPJ) resmi berformat standar rapat warga dengan Kop Surat RT 05 / RW 08, ringkasan eksekutif, tabel mutasi kas, serta lembar tanda tangan Ketua RT dan Bendahara.
* Tombol **"Download report"** di pojok kanan atas untuk langsung membuka pratinjau cetak dan mengunduh ke format PDF.

### 8. Integrasi Database Google Sheets & Google Apps Script (Cloud Sync)
* Mendukung penyimpanan cloud gratis berbasis Google Sheets via **Google Apps Script**.
* Sinkronisasi data multi-device (laptop pengurus & HP pengurus/warga).
* Tetap bekerja secara offline dengan database lokal (*LocalStorage*) dan otomatis melakukan background sync ketika terhubung.
* File script backend siap pakai dan panduan setup tersedia di folder `google-apps-script/`.

---

## 📱 Desain & Layout Responsive (Desktop & Mobile)

* **Tampilan Desktop (Laptop):** 
  * *Sidebar* di sisi kiri dengan gaya *inverted rounded cutout tab* yang menyatu mulus dengan area konten putih.
  * Grafik batang interaktif 14 hari dengan bar sorotan kuning dan kartu ringkasan melayang (*floating tooltip*).
  * Tata letak dua kolom: Transaksi terbaru di sisi kiri dan kartu progres capaian iuran di sisi kanan.
* **Tampilan Mobile (Smartphone):**
  * *Bottom Navigation Bar* di bagian bawah layar agar mudah diakses dengan satu tangan saat pengurus sedang berkeliling lingkungan atau saat ronda malam.
  * *Floating Action Button (+)* untuk mencatat kas masuk/keluar secara instan di lapangan.

---

## 🚀 Cara Menjalankan Aplikasi

Aplikasi dibangun murni menggunakan teknologi web modern (HTML5, CSS3 kustom, Vanilla JavaScript modern) tanpa dependensi runtime eksternal.

### Cara 1: Buka Langsung (Paling Cepat)
Cukup klik ganda (*double-click*) file:
```
d:\ANTIGRAFITY\RukunKu\index.html
```
atau jalankan file:
```
d:\ANTIGRAFITY\RukunKu\Start-Server.bat
```

### Cara 2: Menjalankan via Localhost Server
Jika ingin mengakses melalui server lokal (port 8080):
1. Jalankan `Start-Localhost-Server.bat`
2. Browser akan terbuka otomatis di `http://localhost:8080/`

---

## 📁 Struktur Direktori

```
d:\ANTIGRAFITY\RukunKu\
├── index.html                   # Halaman utama aplikasi (Single Page App)
├── Start-Server.bat             # Launcher instan Windows
├── Start-Localhost-Server.bat   # Launcher HTTP server lokal
├── start-http-server.ps1        # Script server HTTP PowerShell
├── css/
│   └── style.css                # Desain visual, inverted tab curves, responsive layout
├── js/
│   ├── data.js                  # Master data RT, LocalStorage, mock database
│   ├── cloud-sync.js            # Modul sinkronisasi cloud Google Sheets API
│   ├── report-pdf.js            # Generator LPJ resmi RT & cetak PDF/Kwitansi
│   └── app.js                   # Kontroler aplikasi, filter, role switch, CRUD
├── google-apps-script/
│   ├── Code.gs                  # Kode backend API Google Apps Script siap deploy
│   └── PANDUAN_SETUP_GOOGLE_SHEETS.md # Panduan langkah demi langkah integrasi
└── README.md                    # Dokumentasi lengkap aplikasi
```
