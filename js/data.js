/**
 * RukunKu - Master Data & LocalStorage Management
 * Lingkungan RT 05 / RW 02 Perum Tiara Candi 3
 */

const DEFAULT_DATA = {
  settings: {
    rtName: "RT 05 / RW 02",
    perumahan: "Perum Tiara Candi 3",
    kelurahan: "Sukamaju",
    kecamatan: "Cilodong",
    kota: "Kota Depok",
    ketuaRt: "Bpk. Bambang Sutrisno",
    bendahara: "Ibu Siti Rahmawati",
    sekretaris: "Bpk. Arif Wijaya",
    contactWaKetua: "6281234567801",
    iuranWajibBulanan: 150000,
    iuranSosialKematian: 20000,
    nomorRekeningRT: "BCA 873-019-2810 a/n KAS RT 05 TIARA CANDI 3"
  },
  
  // Master Daftar Blok Lingkungan (Bisa ditambah, diedit, dan dihapus oleh pengurus)
  blocks: [
    "Blok A1",
    "Blok A2",
    "Blok B1",
    "Blok B2",
    "Blok C1",
    "Blok C2"
  ],

  // Akun Pengurus / Admin
  adminUser: {
    username: "admin",
    password: "123",
    name: "Bpk. Bambang Sutrisno (Ketua RT)"
  },

  // Akun Petugas Penagih Blok (Diangkat dari warga masing-masing blok)
  collectors: [
    {
      id: "COL-A",
      residentId: "W-002",
      nama: "Bpk. Hendra Pratama",
      blokAsal: "Blok A1 No. 12",
      username: "petugas_a",
      password: "123",
      phone: "6281398765432",
      blokTugas: "Blok A",
      assignedBlocks: ["Blok A1", "Blok A2", "Blok A"],
      role: "petugas"
    },
    {
      id: "COL-B",
      residentId: "W-005",
      nama: "Bpk. Wawan Kurniawan",
      blokAsal: "Blok B1 No. 03",
      username: "petugas_b",
      password: "123",
      phone: "6281223344556",
      blokTugas: "Blok B",
      assignedBlocks: ["Blok B1", "Blok B2", "Blok B"],
      role: "petugas"
    },
    {
      id: "COL-C",
      residentId: "W-009",
      nama: "Bpk. Hadi Santoso",
      blokAsal: "Blok C1 No. 02",
      username: "petugas_c",
      password: "123",
      phone: "6281299887766",
      blokTugas: "Blok C",
      assignedBlocks: ["Blok C1", "Blok C2", "Blok C"],
      role: "petugas"
    }
  ],

  // Riwayat Serah Terima Setoran Kas Blok ke Bendahara Utama
  setoranBlok: [
    {
      id: "STR-2026-10-001",
      collectorId: "COL-C",
      collectorName: "Bpk. Gunawan Wibowo",
      blokTugas: "Blok C",
      periodeBulan: 10,
      periodeTahun: 2026,
      jumlahKkTerbayar: 4,
      nominalTotal: 600000,
      tanggalSetor: "2026-10-10",
      status: "Diterima Bendahara",
      catatan: "Setoran tunai iuran 4 KK Blok C (Rumah C1 No 01-02, C2 No 01-02)",
      tanggalDiterima: "2026-10-10 14:30",
      diterimaOleh: "Ibu Siti Rahmawati (Bendahara Utama)"
    }
  ],
  
  // Kepala Keluarga & Data Warga Administrasi
  residents: [
    {
      id: "W-001",
      nama: "Bambang Sutrisno",
      nik: "3275011405780001",
      noKk: "3275011201080005",
      blok: "A1",
      noRumah: "01",
      alamat: "Blok A1 No. 01",
      phone: "6281234567801",
      jumlahAnggota: 4,
      statusHunian: "Pemilik Tetap",
      pekerjaan: "PNS Pemda",
      statusAktif: true,
      tanggalMasuk: "2018-03-10",
      avatarBg: "bg-pastel-teal"
    },
    {
      id: "W-002",
      nama: "Hendra Pratama",
      nik: "3275012208850003",
      noKk: "3275011806140012",
      blok: "A1",
      noRumah: "12",
      alamat: "Blok A1 No. 12",
      phone: "6281398765432",
      jumlahAnggota: 3,
      statusHunian: "Pemilik Tetap",
      pekerjaan: "Karyawan BUMN",
      statusAktif: true,
      tanggalMasuk: "2019-07-21",
      avatarBg: "bg-pastel-blue"
    },
    {
      id: "W-003",
      nama: "Agus Setiawan",
      nik: "3275010903820004",
      noKk: "3275012509120033",
      blok: "A2",
      noRumah: "04",
      alamat: "Blok A2 No. 04",
      phone: "6285612348901",
      jumlahAnggota: 5,
      statusHunian: "Pemilik Tetap",
      pekerjaan: "Wiraswasta",
      statusAktif: true,
      tanggalMasuk: "2017-11-05",
      avatarBg: "bg-pastel-yellow"
    },
    {
      id: "W-004",
      nama: "Dedi Supriyadi",
      nik: "3275011710790002",
      noKk: "3275010408100019",
      blok: "A2",
      noRumah: "09",
      alamat: "Blok A2 No. 09",
      phone: "6287788990011",
      jumlahAnggota: 4,
      statusHunian: "Pemilik Tetap",
      pekerjaan: "Guru SMA",
      statusAktif: true,
      tanggalMasuk: "2018-01-15",
      avatarBg: "bg-pastel-rose"
    },
    {
      id: "W-005",
      nama: "Wawan Kurniawan",
      nik: "3275012804860005",
      noKk: "3275011902160027",
      blok: "B1",
      noRumah: "03",
      alamat: "Blok B1 No. 03",
      phone: "6281223344556",
      jumlahAnggota: 4,
      statusHunian: "Pemilik Tetap",
      pekerjaan: "Software Engineer",
      statusAktif: true,
      tanggalMasuk: "2020-09-01",
      avatarBg: "bg-pastel-purple"
    },
    {
      id: "W-006",
      nama: "Eko Prasetyo",
      nik: "3275010512880007",
      noKk: "3275013011170045",
      blok: "B1",
      noRumah: "08",
      alamat: "Blok B1 No. 08",
      phone: "6281567890123",
      jumlahAnggota: 2,
      statusHunian: "Kontrak",
      pekerjaan: "Dokter Umum",
      statusAktif: true,
      tanggalMasuk: "2023-02-14",
      avatarBg: "bg-pastel-teal"
    },
    {
      id: "W-007",
      nama: "Fajar Nugraha",
      nik: "3275011909890008",
      noKk: "3275011105180056",
      blok: "B2",
      noRumah: "05",
      alamat: "Blok B2 No. 05",
      phone: "6289876543210",
      jumlahAnggota: 3,
      statusHunian: "Pemilik Tetap",
      pekerjaan: "Konsultan Pajak",
      statusAktif: true,
      tanggalMasuk: "2021-06-10",
      avatarBg: "bg-pastel-blue"
    },
    {
      id: "W-008",
      nama: "Guntur Wicaksono",
      nik: "3275012401840009",
      noKk: "3275010304130078",
      blok: "B2",
      noRumah: "11",
      alamat: "Blok B2 No. 11",
      phone: "6282112345678",
      jumlahAnggota: 5,
      statusHunian: "Pemilik Tetap",
      pekerjaan: "Manajer Operasional",
      statusAktif: true,
      tanggalMasuk: "2019-04-18",
      avatarBg: "bg-pastel-yellow"
    },
    {
      id: "W-009",
      nama: "Hadi Santoso",
      nik: "3275011207830010",
      noKk: "3275012209110090",
      blok: "C1",
      noRumah: "02",
      alamat: "Blok C1 No. 02",
      phone: "6281334455667",
      jumlahAnggota: 4,
      statusHunian: "Pemilik Tetap",
      pekerjaan: "Notaris",
      statusAktif: true,
      tanggalMasuk: "2018-08-20",
      avatarBg: "bg-pastel-rose"
    },
    {
      id: "W-010",
      nama: "Dani Ardiansyah",
      nik: "3275011803920011",
      noKk: "3275011401200102",
      blok: "C1",
      noRumah: "06",
      alamat: "Blok C1 No. 06",
      phone: "6285712349088",
      jumlahAnggota: 2,
      statusHunian: "Kontrak",
      pekerjaan: "Desainer Grafis",
      statusAktif: true,
      tanggalMasuk: "2024-01-10",
      avatarBg: "bg-pastel-purple"
    },
    {
      id: "W-011",
      nama: "Joko Susilo",
      nik: "3275010101800012",
      noKk: "3275010802090115",
      blok: "C2",
      noRumah: "03",
      alamat: "Blok C2 No. 03",
      phone: "6281789012345",
      jumlahAnggota: 3,
      statusHunian: "Pemilik Tetap",
      pekerjaan: "Akuntan Publik",
      statusAktif: true,
      tanggalMasuk: "2020-11-25",
      avatarBg: "bg-pastel-teal"
    },
    {
      id: "W-012",
      nama: "Rian Firmansyah",
      nik: "3275011606910013",
      noKk: "3275012708190128",
      blok: "C2",
      noRumah: "10",
      alamat: "Blok C2 No. 10",
      phone: "6285211223344",
      jumlahAnggota: 3,
      statusHunian: "Pemilik Tetap",
      pekerjaan: "Arsitek",
      statusAktif: true,
      tanggalMasuk: "2022-03-30",
      avatarBg: "bg-pastel-blue"
    }
  ],

  // Kategori Transaksi
  categories: {
    masuk: [
      "Iuran Bulanan",
      "Dana Kematian / Sosial",
      "Donasi / Sumbangan Warga",
      "Iuran Acara / 17 Agustus",
      "Sewa Tenda & Fasilitas RT",
      "Pelunasan Talangan / Kasbon",
      "Lain-lain"
    ],
    keluar: [
      "Honor Satpam & Keamanan",
      "Kebersihan & Truk Sampah",
      "Perbaikan Fasilitas & Lampu Jalan",
      "Konsumsi Kerja Bakti / Rapat",
      "Santunan Duka / Warga Sakit",
      "Talangan Sementara Warga",
      "Operasional Sekretariat & ATK",
      "Lain-lain"
    ]
  },

  // Transaksi Kas Masuk & Kas Keluar
  transactions: [
    {
      id: "TX-2026-10-001",
      tanggal: "2026-10-17",
      waktu: "14:20",
      tipe: "masuk",
      kategori: "Iuran Bulanan",
      judul: "Iuran Warga - Bpk. Hendra",
      keterangan: "Iuran kebersihan & keamanan Oktober 2026",
      residentId: "W-002",
      blok: "Blok A1/12",
      nominal: 150000,
      metode: "Transfer BCA",
      status: "Approved",
      kwitansi: "KW-2026-10-001",
      pencatat: "Bendahara (Ibu Siti)"
    },
    {
      id: "TX-2026-10-002",
      tanggal: "2026-10-16",
      waktu: "11:45",
      tipe: "keluar",
      kategori: "Perbaikan Fasilitas & Lampu Jalan",
      judul: "Penggantian 4 Titik Lampu LED Gang B & C",
      keterangan: "Pembelian lampu Philips 24W & kabel instalasi",
      residentId: null,
      blok: "Fasilitas Umum",
      nominal: 450000,
      metode: "Kas Tunai",
      status: "Approved",
      kwitansi: "KW-2026-10-002",
      pencatat: "Bendahara (Ibu Siti)"
    },
    {
      id: "TX-2026-10-003",
      tanggal: "2026-10-15",
      waktu: "09:10",
      tipe: "masuk",
      kategori: "Iuran Bulanan",
      judul: "Iuran Warga - Bpk. Agus Setiawan",
      keterangan: "Iuran bulanan + donasi taman lingkungan",
      residentId: "W-003",
      blok: "Blok A2/04",
      nominal: 250000,
      metode: "QRIS RT",
      status: "Approved",
      kwitansi: "KW-2026-10-003",
      pencatat: "Bendahara (Ibu Siti)"
    },
    {
      id: "TX-2026-10-004",
      tanggal: "2026-10-14",
      waktu: "16:30",
      tipe: "keluar",
      kategori: "Kebersihan & Truk Sampah",
      judul: "Iuran Truk Sampah Kebersihan Oktober",
      keterangan: "Pembayaran rutin jasa pengangkutan sampah perumahan",
      residentId: null,
      blok: "Operasional Lingkungan",
      nominal: 1200000,
      metode: "Transfer Bank",
      status: "Approved",
      kwitansi: "KW-2026-10-004",
      pencatat: "Bendahara (Ibu Siti)"
    },
    {
      id: "TX-2026-10-005",
      tanggal: "2026-10-12",
      waktu: "20:00",
      tipe: "masuk",
      kategori: "Dana Kematian / Sosial",
      judul: "Dana Sosial Warga - Bpk. Wawan",
      keterangan: "Partisipasi dana santunan sosial",
      residentId: "W-005",
      blok: "Blok B1/03",
      nominal: 50000,
      metode: "Transfer Mandiri",
      status: "Approved",
      kwitansi: "KW-2026-10-005",
      pencatat: "Bendahara (Ibu Siti)"
    },
    {
      id: "TX-2026-10-006",
      tanggal: "2026-10-10",
      waktu: "08:00",
      tipe: "keluar",
      kategori: "Honor Satpam & Keamanan",
      judul: "Honor 2 Petugas Keamanan Periode Awal Bulan",
      keterangan: "Gaji Pak Slamet & Pak Joko (Satpam RT 05)",
      residentId: null,
      blok: "Pos Keamanan",
      nominal: 3000000,
      metode: "Kas Tunai",
      status: "Approved",
      kwitansi: "KW-2026-10-006",
      pencatat: "Bendahara (Ibu Siti)"
    },
    {
      id: "TX-2026-10-007",
      tanggal: "2026-10-09",
      waktu: "10:15",
      tipe: "masuk",
      kategori: "Iuran Bulanan",
      judul: "Iuran Warga - Bpk. Bambang Sutrisno",
      keterangan: "Iuran wajib bulanan Oktober",
      residentId: "W-001",
      blok: "Blok A1/01",
      nominal: 150000,
      metode: "Transfer BCA",
      status: "Approved",
      kwitansi: "KW-2026-10-007",
      pencatat: "Bendahara (Ibu Siti)"
    },
    {
      id: "TX-2026-10-008",
      tanggal: "2026-10-08",
      waktu: "13:00",
      tipe: "masuk",
      kategori: "Pelunasan Talangan / Kasbon",
      judul: "Cicilan Talangan Berobat Bpk. Wawan",
      keterangan: "Pembayaran cicilan ke-1 dana talangan darurat",
      residentId: "W-005",
      blok: "Blok B1/03",
      nominal: 500000,
      metode: "Transfer BCA",
      status: "Approved",
      kwitansi: "KW-2026-10-008",
      pencatat: "Bendahara (Ibu Siti)"
    },
    {
      id: "TX-2026-10-009",
      tanggal: "2026-10-05",
      waktu: "09:30",
      tipe: "masuk",
      kategori: "Iuran Bulanan",
      judul: "Iuran Warga - Bpk. Hadi Santoso",
      keterangan: "Iuran bulanan Oktober (Lunas)",
      residentId: "W-009",
      blok: "Blok C1/02",
      nominal: 150000,
      metode: "QRIS RT",
      status: "Approved",
      kwitansi: "KW-2026-10-009",
      pencatat: "Bendahara (Ibu Siti)"
    },
    {
      id: "TX-2026-10-010",
      tanggal: "2026-10-04",
      waktu: "17:15",
      tipe: "keluar",
      kategori: "Konsumsi Kerja Bakti / Rapat",
      judul: "Snack & Konsumsi Kerja Bakti Saluran Air",
      keterangan: "Konsumsi air mineral, kopi, gorengan warga kerja bakti",
      residentId: null,
      blok: "Lingkungan RT",
      nominal: 350000,
      metode: "Kas Tunai",
      status: "Approved",
      kwitansi: "KW-2026-10-010",
      pencatat: "Bendahara (Ibu Siti)"
    },
    {
      id: "TX-2026-10-011",
      tanggal: "2026-10-03",
      waktu: "11:00",
      tipe: "masuk",
      kategori: "Iuran Bulanan",
      judul: "Iuran Warga - Bpk. Guntur Wicaksono",
      keterangan: "Konfirmasi transfer iuran via m-banking",
      residentId: "W-008",
      blok: "Blok B2/11",
      nominal: 150000,
      metode: "Transfer Mandiri",
      status: "Pending",
      kwitansi: "KW-2026-10-011",
      pencatat: "Warga (Verifikasi Menunggu)"
    }
  ],

  // Catatan Utang, Piutang & Talangan Warga
  talangan: [
    {
      id: "TL-001",
      residentId: "W-005",
      namaPeminjam: "Bpk. Wawan Kurniawan",
      blok: "Blok B1/03",
      phone: "6281223344556",
      nominalTotal: 1500000,
      terbayar: 500000,
      sisa: 1000000,
      tanggalPinjam: "2026-09-15",
      jatuhTempo: "2026-11-15",
      keperluan: "Talangan darurat berobat anggota keluarga masuk RS",
      status: "Cicil",
      keterangan: "Disetujui bersama Ketua RT & Bendahara dengan tenor 3x cicil.",
      riwayatBayar: [
        {
          tanggal: "2026-10-08",
          nominal: 500000,
          metode: "Transfer BCA",
          pencatat: "Ibu Siti Rahmawati"
        }
      ]
    },
    {
      id: "TL-002",
      residentId: "W-010",
      namaPeminjam: "Bpk. Dani Ardiansyah",
      blok: "Blok C1/06",
      phone: "6285712349088",
      nominalTotal: 300000,
      terbayar: 0,
      sisa: 300000,
      tanggalPinjam: "2026-09-01",
      jatuhTempo: "2026-10-31",
      keperluan: "Kelonggaran iuran 2 bulan (Agustus - September)",
      status: "Belum Lunas",
      keterangan: "Kelonggaran pembayaran tempo akhir bulan Oktober.",
      riwayatBayar: []
    },
    {
      id: "TL-003",
      residentId: null,
      namaPeminjam: "Pak Joko (Petugas Satpam)",
      blok: "Pos Keamanan",
      phone: "6281234567999",
      nominalTotal: 500000,
      terbayar: 500000,
      sisa: 0,
      tanggalPinjam: "2026-08-10",
      jatuhTempo: "2026-09-10",
      keperluan: "Kasbon perbaikan motor operasional patroli",
      status: "Lunas",
      keterangan: "Sudah dipotong saat penerimaan honor bulan September.",
      riwayatBayar: [
        {
          tanggal: "2026-09-05",
          nominal: 500000,
          metode: "Potong Honor",
          pencatat: "Ibu Siti Rahmawati"
        }
      ]
    }
  ],

  // Iuran Matrix Per Resident (Tahun 2026, Bulan 1 sampai 12)
  duesMatrix: {
    "W-001": { 1: "Lunas", 2: "Lunas", 3: "Lunas", 4: "Lunas", 5: "Lunas", 6: "Lunas", 7: "Lunas", 8: "Lunas", 9: "Lunas", 10: "Lunas", 11: "Belum", 12: "Belum" },
    "W-002": { 1: "Lunas", 2: "Lunas", 3: "Lunas", 4: "Lunas", 5: "Lunas", 6: "Lunas", 7: "Lunas", 8: "Lunas", 9: "Lunas", 10: "Lunas", 11: "Belum", 12: "Belum" },
    "W-003": { 1: "Lunas", 2: "Lunas", 3: "Lunas", 4: "Lunas", 5: "Lunas", 6: "Lunas", 7: "Lunas", 8: "Lunas", 9: "Lunas", 10: "Lunas", 11: "Belum", 12: "Belum" },
    "W-004": { 1: "Lunas", 2: "Lunas", 3: "Lunas", 4: "Lunas", 5: "Lunas", 6: "Lunas", 7: "Lunas", 8: "Lunas", 9: "Lunas", 10: "Belum", 11: "Belum", 12: "Belum" },
    "W-005": { 1: "Lunas", 2: "Lunas", 3: "Lunas", 4: "Lunas", 5: "Lunas", 6: "Lunas", 7: "Lunas", 8: "Lunas", 9: "Lunas", 10: "Lunas", 11: "Belum", 12: "Belum" },
    "W-006": { 1: "Lunas", 2: "Lunas", 3: "Lunas", 4: "Lunas", 5: "Lunas", 6: "Lunas", 7: "Lunas", 8: "Lunas", 9: "Lunas", 10: "Belum", 11: "Belum", 12: "Belum" },
    "W-007": { 1: "Lunas", 2: "Lunas", 3: "Lunas", 4: "Lunas", 5: "Lunas", 6: "Lunas", 7: "Lunas", 8: "Lunas", 9: "Lunas", 10: "Lunas", 11: "Belum", 12: "Belum" },
    "W-008": { 1: "Lunas", 2: "Lunas", 3: "Lunas", 4: "Lunas", 5: "Lunas", 6: "Lunas", 7: "Lunas", 8: "Lunas", 9: "Lunas", 10: "Pending", 11: "Belum", 12: "Belum" },
    "W-009": { 1: "Lunas", 2: "Lunas", 3: "Lunas", 4: "Lunas", 5: "Lunas", 6: "Lunas", 7: "Lunas", 8: "Lunas", 9: "Lunas", 10: "Lunas", 11: "Belum", 12: "Belum" },
    "W-010": { 1: "Lunas", 2: "Lunas", 3: "Lunas", 4: "Lunas", 5: "Lunas", 6: "Lunas", 7: "Lunas", 8: "Belum", 9: "Belum", 10: "Belum", 11: "Belum", 12: "Belum" },
    "W-011": { 1: "Lunas", 2: "Lunas", 3: "Lunas", 4: "Lunas", 5: "Lunas", 6: "Lunas", 7: "Lunas", 8: "Lunas", 9: "Lunas", 10: "Lunas", 11: "Belum", 12: "Belum" },
    "W-012": { 1: "Lunas", 2: "Lunas", 3: "Lunas", 4: "Lunas", 5: "Lunas", 6: "Lunas", 7: "Lunas", 8: "Lunas", 9: "Lunas", 10: "Belum", 11: "Belum", 12: "Belum" }
  },

  // Daily Cash Flow for Chart Bars (1 to 14 October matching the 14 bars in the screenshot)
  dailyFlowOctober: [
    { day: 1, label: "1", amountIn: 1500000, amountOut: 0, isHighlight: false },
    { day: 2, label: "2", amountIn: 2200000, amountOut: 300000, isHighlight: false },
    { day: 3, label: "3", amountIn: 2600000, amountOut: 0, isHighlight: false },
    { day: 4, label: "4", amountIn: 1300000, amountOut: 350000, isHighlight: false },
    { day: 5, label: "5", amountIn: 2400000, amountOut: 0, isHighlight: false },
    { day: 6, label: "6", amountIn: 1350000, amountOut: 0, isHighlight: false },
    { day: 7, label: "7", amountIn: 950000, amountOut: 0, isHighlight: false },
    { day: 8, label: "8", amountIn: 1550000, amountOut: 0, isHighlight: false },
    { day: 9, label: "9", amountIn: 1894830, amountOut: 150000, isHighlight: true, tooltip: "Rp 1.894.830", sub: "Pemasukan Tertinggi" },
    { day: 10, label: "10", amountIn: 1400000, amountOut: 3000000, isHighlight: false },
    { day: 11, label: "11", amountIn: 1050000, amountOut: 0, isHighlight: false },
    { day: 12, label: "12", amountIn: 2450000, amountOut: 0, isHighlight: false },
    { day: 13, label: "13", amountIn: 1350000, amountOut: 0, isHighlight: false },
    { day: 14, label: "14", amountIn: 900000, amountOut: 1200000, isHighlight: false }
  ],

  // =========================================================================
  // MODUL KHUSUS: DASHBOARD KEUANGAN & ADMINISTRASI MASJID SABILILLAH
  // =========================================================================
  masjidSettings: {
    namaMasjid: "Masjid Sabilillah",
    tagline: "Dewan Kemakmuran Masjid (DKM) Masjid Sabilillah",
    alamat: "Jl. Tiara Utama Blok A-B, Perumahan Tiara Candi 3",
    kelurahan: "Sukamaju",
    kecamatan: "Cilodong",
    kota: "Kota Depok",
    ketuaDkm: "H. Ahmad Fauzi",
    bendahara: "H. Sudirman",
    sekretaris: "Ust. M. Ridwan",
    marbot: "Bpk. Subur & Bpk. Warsito",
    nomorRekening: "BSI: 712-345-6789 a.n DKM Masjid Sabilillah",
    qrisUrl: "",
    contactWa: "6281234567809",
    saldoAwal: 0
  },

  masjidAdmin: {
    username: "masjid",
    password: "123"
  },

  masjidTransactions: [],

  masjidAssets: []
};

// Storage helper functions
const DB = {
  KEY: "rukunku_app_data_v1",

  load() {
    try {
      const saved = localStorage.getItem(this.KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const data = { ...DEFAULT_DATA, ...parsed };
        
        // Ensure blocks exist
        if (!data.blocks || !Array.isArray(data.blocks) || data.blocks.length === 0) {
          const fromRes = [...new Set((data.residents || []).map(r => r.blok).filter(Boolean))];
          data.blocks = fromRes.length > 0 ? fromRes : [...DEFAULT_DATA.blocks];
        }

        // Ensure residents have password, fotoKk, and familyMembers
        if (data.residents && Array.isArray(data.residents)) {
          data.residents.forEach(r => {
            if (!r.password) r.password = "123456";
            if (typeof r.fotoKk === 'undefined') r.fotoKk = "";
            if (!r.familyMembers || !Array.isArray(r.familyMembers) || r.familyMembers.length === 0) {
              r.familyMembers = [
                {
                  id: `${r.id}-fm-1`,
                  nama: r.nama,
                  hubungan: "Kepala Keluarga",
                  nik: r.nik || "",
                  jenisKelamin: "Laki-laki",
                  tanggalLahir: "",
                  punyaKtp: !!r.nik,
                  fotoKtp: ""
                }
              ];
            }
            r.jumlahAnggota = Math.max(Number(r.jumlahAnggota) || 1, (r.familyMembers ? r.familyMembers.length : 1));
          });
        }

        if (!data.adminUser) {
          data.adminUser = { ...DEFAULT_DATA.adminUser };
        }

        // Ensure collectors exist
        if (!data.collectors || !Array.isArray(data.collectors)) {
          data.collectors = Array.isArray(DEFAULT_DATA.collectors) ? JSON.parse(JSON.stringify(DEFAULT_DATA.collectors)) : [];
        }

        // Ensure setoranBlok exists
        if (!data.setoranBlok || !Array.isArray(data.setoranBlok)) {
          data.setoranBlok = Array.isArray(DEFAULT_DATA.setoranBlok) ? JSON.parse(JSON.stringify(DEFAULT_DATA.setoranBlok)) : [];
        }

        // Ensure categories exist
        if (!data.categories || !Array.isArray(data.categories.masuk) || !Array.isArray(data.categories.keluar)) {
          data.categories = JSON.parse(JSON.stringify(DEFAULT_DATA.categories));
        }

        // Ensure masjid data exists
        if (!data.masjidSettings) {
          data.masjidSettings = JSON.parse(JSON.stringify(DEFAULT_DATA.masjidSettings));
        }
        if (!data.masjidAdmin) {
          data.masjidAdmin = JSON.parse(JSON.stringify(DEFAULT_DATA.masjidAdmin));
        }
        if (!Array.isArray(data.masjidTransactions)) {
          data.masjidTransactions = [];
        }
        if (!Array.isArray(data.masjidAssets)) {
          data.masjidAssets = [];
        }

        return data;
      }
    } catch (e) {
      console.error("Gagal membaca LocalStorage, memuat data default:", e);
    }
    
    // First time visitor on this browser:
    // Write directly to localStorage WITHOUT calling DB.save (so auto-sync to cloud is NOT triggered!)
    try {
      localStorage.setItem(this.KEY, JSON.stringify(DEFAULT_DATA));
    } catch(e) {}
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  },

  save(data, options = {}) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(data));
      // Auto-sync in background if Google Sheets is connected and skipSync is not set
      if (!options.skipSync && window.CloudSync && typeof window.CloudSync.autoSyncBackground === 'function') {
        window.CloudSync.autoSyncBackground();
      }
      return true;
    } catch (e) {
      console.error("Gagal menyimpan ke LocalStorage:", e);
      return false;
    }
  },

  reset() {
    localStorage.removeItem(this.KEY);
    return this.load();
  },

  exportJSON() {
    const data = this.load();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `Backup_RukunKu_RT05_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  },

  importJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.residents && parsed.transactions) {
        this.save(parsed);
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }
};

window.DB = DB;
window.DEFAULT_DATA = DEFAULT_DATA;
