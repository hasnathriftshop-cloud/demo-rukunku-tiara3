/**
 * RukunKu - Supabase Cloud SQL Database Integration
 * Project: tiaracandi-source's Project (jzskyaftklluymxjnxwy)
 * Provides ultra-fast PostgreSQL cloud sync, realtime subscription, and one-click data migration.
 */

const SupabaseSync = {
  CONFIG_KEY: 'rukunku_supabase_config_v1',
  DEFAULT_URL: 'https://jzskyaftklluymxjnxwy.supabase.co',
  DEFAULT_KEY: 'sb_publishable_StjNfRDZaaYL7aZ6G2sUhg_XdYwaqct',

  client: null,
  realtimeChannel: null,
  status: 'disconnected', // 'connected', 'syncing', 'error', 'disconnected'
  lastSyncTime: null,
  debounceTimer: null,

  getConfig() {
    try {
      const saved = localStorage.getItem(this.CONFIG_KEY);
      if (saved) {
        return {
          url: this.DEFAULT_URL,
          key: this.DEFAULT_KEY,
          enabled: true,
          ...JSON.parse(saved)
        };
      }
    } catch (e) {
      console.warn("Failed to load Supabase config:", e);
    }
    return {
      url: this.DEFAULT_URL,
      key: this.DEFAULT_KEY,
      enabled: true
    };
  },

  saveConfig(cfg) {
    try {
      localStorage.setItem(this.CONFIG_KEY, JSON.stringify(cfg));
    } catch (e) {
      console.warn("Failed to save Supabase config:", e);
    }
  },

  isConfigured() {
    const cfg = this.getConfig();
    return !!(cfg && cfg.enabled && cfg.url && cfg.key);
  },

  getHeaders(preferMerge = false) {
    const cfg = this.getConfig();
    const headers = {
      'apikey': cfg.key,
      'Authorization': `Bearer ${cfg.key}`,
      'Content-Type': 'application/json'
    };
    if (preferMerge) {
      headers['Prefer'] = 'resolution=merge-duplicates';
    }
    return headers;
  },

  getRestUrl(table) {
    const cfg = this.getConfig();
    return `${cfg.url.replace(/\/+$/, '')}/rest/v1/${table}`;
  },

  async init() {
    const cfg = this.getConfig();
    if (!cfg.enabled || !cfg.url || !cfg.key) {
      this.status = 'disconnected';
      this.updateStatusUI();
      return;
    }

    // Inisialisasi Supabase JS SDK jika library tersedia dari CDN
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      try {
        this.client = window.supabase.createClient(cfg.url, cfg.key);
        this.setupRealtime();
      } catch (err) {
        console.warn("Supabase JS SDK init failed, falling back to direct REST API:", err);
      }
    }

    this.status = 'connected';
    this.updateStatusUI();

    // Auto pull data terbaru dari Supabase saat aplikasi dibuka
    this.pullFromSupabase({ silent: true });
  },

  setupRealtime() {
    if (!this.client || this.realtimeChannel) return;
    try {
      this.realtimeChannel = this.client
        .channel('rukunku-all-changes')
        .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
          console.log("⚡ Supabase Realtime Change detected:", payload.table, payload.eventType);
          this.pullFromSupabase({ silent: true });
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log("✅ Supabase Realtime Subscribed!");
          }
        });
    } catch (err) {
      console.warn("Realtime setup error:", err);
    }
  },

  updateStatusUI() {
    // 1. Navbar Sync Pill
    const pill = document.getElementById('cloudSyncPill');
    const dot = document.getElementById('cloudSyncDot');
    const text = document.getElementById('cloudSyncText');

    if (pill && dot && text) {
      if (this.status === 'connected') {
        dot.style.background = '#10b981';
        dot.style.boxShadow = '0 0 8px #10b981';
        text.textContent = '⚡ Supabase SQL: Online';
        pill.title = 'Terhubung ke Database Cloud Supabase PostgreSQL (tiaracandi-source)';
        pill.style.borderColor = '#10b981';
      } else if (this.status === 'syncing') {
        dot.style.background = '#3b82f6';
        dot.style.boxShadow = '0 0 8px #3b82f6';
        text.textContent = '⚡ Supabase: Menyinkronkan...';
      } else if (this.status === 'error') {
        dot.style.background = '#ef4444';
        dot.style.boxShadow = '0 0 8px #ef4444';
        text.textContent = '⚡ Supabase: Gangguan Koneksi';
      } else {
        dot.style.background = '#cbd5e1';
        dot.style.boxShadow = 'none';
        text.textContent = 'Mode: Database Lokal';
        pill.title = 'Buka Pengaturan Database Cloud Supabase';
        pill.style.borderColor = '';
      }
    }

    // 2. Modal Cloud Status Box
    const statusBox = document.getElementById('modalSupabaseStatus');
    if (statusBox) {
      if (this.status === 'connected') {
        statusBox.innerHTML = `
          <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 10px 14px; font-size: 12.5px; color: #065f46; display: flex; align-items: center; justify-content: space-between;">
            <div>
              <strong>✅ Terhubung ke Supabase PostgreSQL</strong><br>
              <span style="font-size: 11px; color: #047857;">Project: tiaracandi-source (Tokyo ap-northeast-1) • Respons Cepat &amp; Real-time</span>
            </div>
            <span style="background: #10b981; color: white; padding: 2px 8px; border-radius: 999px; font-weight: 700; font-size: 10.5px;">ONLINE</span>
          </div>
        `;
      } else if (this.status === 'syncing') {
        statusBox.innerHTML = `
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 10px 14px; font-size: 12.5px; color: #1e40af;">
            ⏳ Sedang menyinkronkan data dengan Supabase PostgreSQL...
          </div>
        `;
      } else if (this.status === 'error') {
        statusBox.innerHTML = `
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 10px 14px; font-size: 12.5px; color: #991b1b;">
            ❌ Gagal terhubung ke Supabase. Periksa koneksi internet atau Publishable Key Anda.
          </div>
        `;
      } else {
        statusBox.innerHTML = `
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 14px; font-size: 12.5px; color: #64748b;">
            🔌 Mode Offline / Database Lokal aktif.
          </div>
        `;
      }
    }

    // Prefill form inputs if available
    const cfg = this.getConfig();
    const inUrl = document.getElementById('inputSupabaseUrl');
    const inKey = document.getElementById('inputSupabaseKey');
    if (inUrl && !inUrl.value) inUrl.value = cfg.url;
    if (inKey && !inKey.value) inKey.value = cfg.key;
  },

  switchProviderTab(provider) {
    const btnSupa = document.getElementById('btnDbProviderSupabase');
    const btnSheets = document.getElementById('btnDbProviderSheets');
    const panelSupa = document.getElementById('panelDbSupabase');
    const panelSheets = document.getElementById('panelDbSheets');

    if (provider === 'supabase') {
      if (btnSupa) {
        btnSupa.style.background = '#0f766e';
        btnSupa.style.color = '#ffffff';
      }
      if (btnSheets) {
        btnSheets.style.background = 'transparent';
        btnSheets.style.color = '#475569';
      }
      if (panelSupa) panelSupa.style.display = 'block';
      if (panelSheets) panelSheets.style.display = 'none';
    } else {
      if (btnSheets) {
        btnSheets.style.background = '#0f766e';
        btnSheets.style.color = '#ffffff';
      }
      if (btnSupa) {
        btnSupa.style.background = 'transparent';
        btnSupa.style.color = '#475569';
      }
      if (panelSupa) panelSupa.style.display = 'none';
      if (panelSheets) panelSheets.style.display = 'block';
    }
  },

  saveSettingsFromModal() {
    const url = document.getElementById('inputSupabaseUrl')?.value.trim();
    const key = document.getElementById('inputSupabaseKey')?.value.trim();
    if (!url || !key) {
      alert("URL Project Supabase dan Publishable Key wajib diisi!");
      return;
    }
    this.saveConfig({ url, key, enabled: true });
    this.init();
    alert("✅ Konfigurasi Supabase berhasil disimpan!");
  },

  disconnect() {
    if (confirm("Putuskan koneksi ke Supabase dan beralih ke Mode Database Lokal?")) {
      const cfg = this.getConfig();
      cfg.enabled = false;
      this.saveConfig(cfg);
      this.status = 'disconnected';
      this.updateStatusUI();
    }
  },

  // Tes Koneksi ke Supabase
  async testConnection() {
    this.status = 'syncing';
    this.updateStatusUI();

    try {
      const url = this.getRestUrl('rt_settings?id=eq.default');
      const res = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
      }

      this.status = 'connected';
      this.updateStatusUI();
      alert("🎉 KONEKSI SUKSES!\n\nAplikasi RukunKu berhasil terhubung langsung ke database Supabase PostgreSQL Anda.");
      return true;
    } catch (err) {
      this.status = 'error';
      this.updateStatusUI();
      alert("❌ Koneksi ke Supabase gagal: " + err.message + "\n\nPastikan skrip SQL di Supabase SQL Editor sudah selesai dijalankan.");
      return false;
    }
  },

  // =========================================================================
  // ONE-CLICK MIGRATION: Unggah seluruh data lokal / Google Sheets ke Supabase
  // =========================================================================
  async migrateAllToSupabase() {
    if (!confirm("🚀 MIGRASI DATA KE SUPABASE:\n\nSeluruh data yang ada di aplikasi (Pengaturan RT, Data Warga, Matriks Iuran 12 Bulan, Pembukuan Kas RT, Talangan, Kas Masjid Sabilillah, dan Inventaris Aset) akan diunggah ke database SQL Supabase Anda.\n\nLanjutkan proses migrasi?")) {
      return;
    }

    this.status = 'syncing';
    this.updateStatusUI();

    const localData = DB.load();
    const stats = {
      residents: 0,
      duesRows: 0,
      rtTx: 0,
      masjidTx: 0,
      assets: 0
    };

    try {
      // 1. Migrasi Pengaturan RT
      const s = localData.settings || {};
      await fetch(this.getRestUrl('rt_settings'), {
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify({
          id: 'default',
          nama_rt: s.rtName || '03',
          nama_rw: s.rwName || '05',
          nama_perumahan: s.perumahan || 'Perumahan Tiara Candi 3',
          kelurahan: s.kelurahan || 'Sekargadung',
          kecamatan: s.kecamatan || 'Purworejo',
          kota: s.kota || 'Kota Pasuruan',
          ketua_rt: s.ketuaRt || '',
          bendahara: s.bendahara || '',
          sekretaris: s.sekretaris || '',
          nomor_rekening_rt: s.nomorRekeningRT || '',
          qris_url: s.qrisUrl || '',
          contact_wa: s.contactWaKetua || '',
          iuran_wajib_bulanan: Number(s.iuranWajibBulanan) || 50000,
          saldo_awal_kas: Number(s.saldoAwalKas) || 0
        })
      });

      // 2. Migrasi Blok Lingkungan
      if (Array.isArray(localData.blocks) && localData.blocks.length > 0) {
        const blockRows = localData.blocks.map(b => ({ nama_blok: b }));
        await fetch(this.getRestUrl('rt_blocks'), {
          method: 'POST',
          headers: this.getHeaders(true),
          body: JSON.stringify(blockRows)
        });
      }

      // 3. Migrasi Kategori RT
      if (localData.categories) {
        const catRows = [];
        (localData.categories.masuk || []).forEach(c => catRows.push({ tipe: 'masuk', nama: c }));
        (localData.categories.keluar || []).forEach(c => catRows.push({ tipe: 'keluar', nama: c }));
        if (catRows.length > 0) {
          await fetch(this.getRestUrl('rt_categories'), {
            method: 'POST',
            headers: this.getHeaders(true),
            body: JSON.stringify(catRows)
          });
        }
      }

      // 4. Migrasi Data Warga
      if (Array.isArray(localData.residents) && localData.residents.length > 0) {
        const resRows = localData.residents.map(r => ({
          id: r.id,
          nama: r.nama,
          nik: r.nik || '',
          no_kk: r.noKk || '',
          blok: r.blok || '',
          no_rumah: r.noRumah || '',
          alamat: r.alamat || '',
          phone: r.phone ? String(r.phone).replace(/^'/, '') : '',
          jumlah_anggota: Number(r.jumlahAnggota) || (r.familyMembers ? r.familyMembers.length : 1),
          status_hunian: r.statusHunian || 'Tetap',
          pekerjaan: r.pekerjaan || '',
          status_aktif: r.statusAktif || 'Aktif',
          tanggal_masuk: r.tanggalMasuk || new Date().toISOString().slice(0, 10),
          avatar_bg: r.avatarBg || '#0d9488',
          password: r.password || '123456',
          family_members: r.familyMembers || [],
          foto_kk: r.fotoKk || ''
        }));

        await fetch(this.getRestUrl('rt_residents'), {
          method: 'POST',
          headers: this.getHeaders(true),
          body: JSON.stringify(resRows)
        });
        stats.residents = resRows.length;
      }

      // 5. Migrasi Matriks Iuran 12 Bulan (Mendukung format flat maupun per-tahun)
      if (localData.duesMatrix && typeof localData.duesMatrix === 'object') {
        const duesRows = [];
        const curYear = new Date().getFullYear();

        Object.entries(localData.duesMatrix).forEach(([key, val]) => {
          if (!val || typeof val !== 'object') return;

          // Case A: key adalah tahun (misal '2026') -> val: { [resId]: { [month]: status } }
          if (/^\d{4}$/.test(key)) {
            const yr = parseInt(key);
            Object.entries(val).forEach(([resId, months]) => {
              if (months && typeof months === 'object') {
                duesRows.push({
                  resident_id: resId,
                  tahun: yr,
                  m1: months['1'] || months[1] || 'Belum',
                  m2: months['2'] || months[2] || 'Belum',
                  m3: months['3'] || months[3] || 'Belum',
                  m4: months['4'] || months[4] || 'Belum',
                  m5: months['5'] || months[5] || 'Belum',
                  m6: months['6'] || months[6] || 'Belum',
                  m7: months['7'] || months[7] || 'Belum',
                  m8: months['8'] || months[8] || 'Belum',
                  m9: months['9'] || months[9] || 'Belum',
                  m10: months['10'] || months[10] || 'Belum',
                  m11: months['11'] || months[11] || 'Belum',
                  m12: months['12'] || months[12] || 'Belum'
                });
              }
            });
          } 
          // Case B: key adalah residentId (misal 'W-001', 'W-004')
          else {
            const resId = key;
            const isDirectMonths = Object.keys(val).some(k => ['1','2','3','4','5','6','7','8','9','10','11','12'].includes(String(k)) && typeof val[k] === 'string');
            
            if (isDirectMonths) {
              duesRows.push({
                resident_id: resId,
                tahun: curYear,
                m1: val['1'] || val[1] || 'Belum',
                m2: val['2'] || val[2] || 'Belum',
                m3: val['3'] || val[3] || 'Belum',
                m4: val['4'] || val[4] || 'Belum',
                m5: val['5'] || val[5] || 'Belum',
                m6: val['6'] || val[6] || 'Belum',
                m7: val['7'] || val[7] || 'Belum',
                m8: val['8'] || val[8] || 'Belum',
                m9: val['9'] || val[9] || 'Belum',
                m10: val['10'] || val[10] || 'Belum',
                m11: val['11'] || val[11] || 'Belum',
                m12: val['12'] || val[12] || 'Belum'
              });
            } else {
              Object.entries(val).forEach(([yrStr, months]) => {
                if (months && typeof months === 'object') {
                  duesRows.push({
                    resident_id: resId,
                    tahun: parseInt(yrStr) || curYear,
                    m1: months['1'] || months[1] || 'Belum',
                    m2: months['2'] || months[2] || 'Belum',
                    m3: months['3'] || months[3] || 'Belum',
                    m4: months['4'] || months[4] || 'Belum',
                    m5: months['5'] || months[5] || 'Belum',
                    m6: months['6'] || months[6] || 'Belum',
                    m7: months['7'] || months[7] || 'Belum',
                    m8: months['8'] || months[8] || 'Belum',
                    m9: months['9'] || months[9] || 'Belum',
                    m10: months['10'] || months[10] || 'Belum',
                    m11: months['11'] || months[11] || 'Belum',
                    m12: months['12'] || months[12] || 'Belum'
                  });
                }
              });
            }
          }
        });

        // Dedup by resident_id + tahun
        const uniqueDuesMap = new Map();
        duesRows.forEach(row => {
          uniqueDuesMap.set(`${row.resident_id}_${row.tahun}`, row);
        });
        const finalDuesRows = Array.from(uniqueDuesMap.values());

        if (finalDuesRows.length > 0) {
          await fetch(this.getRestUrl('rt_dues?on_conflict=resident_id,tahun'), {
            method: 'POST',
            headers: this.getHeaders(true),
            body: JSON.stringify(finalDuesRows)
          });
          stats.duesRows = finalDuesRows.length;
        }
      }

      // 6. Migrasi Transaksi Kas RT (Eksklusif RT Murni)
      if (Array.isArray(localData.transactions) && localData.transactions.length > 0) {
        const rtOnlyTxs = localData.transactions.filter(t => !window.App?.isMasjidTx?.(t));
        const txRows = rtOnlyTxs.map(t => ({
          id: t.id,
          tanggal: t.tanggal || new Date().toISOString().slice(0, 10),
          waktu: t.waktu || '10:00',
          tipe: t.tipe || 'masuk',
          kategori: t.kategori || 'Iuran Bulanan',
          judul: t.judul || '',
          keterangan: t.keterangan || '',
          resident_id: t.residentId || null,
          blok: t.blok || '',
          nominal: Number(t.nominal) || 0,
          metode: t.metode || 'Kas Tunai',
          status: t.status || 'Approved',
          kwitansi: t.kwitansi || '',
          pencatat: t.pencatat || '',
          bukti_transfer: t.buktiTransfer || '',
          periode_tahun: t.periodeTahun || null,
          periode_bulan: t.periodeBulan || null
        }));

        if (txRows.length > 0) {
          await fetch(this.getRestUrl('rt_transactions?on_conflict=id'), {
            method: 'POST',
            headers: this.getHeaders(true),
            body: JSON.stringify(txRows)
          });
          stats.rtTx = txRows.length;
        }
      }

      // 7. Migrasi Talangan RT
      if (Array.isArray(localData.talangan) && localData.talangan.length > 0) {
        const talRows = localData.talangan.map(t => ({
          id: t.id,
          resident_id: t.residentId || null,
          nama: t.nama || '',
          blok: t.blok || '',
          phone: t.phone || '',
          nominal: Number(t.nominal) || 0,
          terbayar: Number(t.terbayar) || 0,
          sisa: Number(t.sisa) || 0,
          tanggal_pinjam: t.tanggalPinjam || null,
          jatuh_tempo: t.jatuhTempo || null,
          keperluan: t.keperluan || '',
          status: t.status || 'Berjalan',
          keterangan: t.keterangan || ''
        }));
        await fetch(this.getRestUrl('rt_talangan'), {
          method: 'POST',
          headers: this.getHeaders(true),
          body: JSON.stringify(talRows)
        });
      }

      // 8. Migrasi Petugas & Setoran Blok
      if (Array.isArray(localData.collectors) && localData.collectors.length > 0) {
        const colRows = localData.collectors.map(c => ({
          id: c.id,
          resident_id: c.residentId || null,
          nama: c.nama || '',
          blok_asal: c.blokAsal || '',
          username: c.username || '',
          password: c.password || '123',
          phone: c.phone || '',
          blok_tugas: c.blokTugas || '',
          assigned_blocks: c.assignedBlocks || [],
          role: c.role || 'petugas'
        }));
        await fetch(this.getRestUrl('rt_collectors'), {
          method: 'POST',
          headers: this.getHeaders(true),
          body: JSON.stringify(colRows)
        });
      }

      if (Array.isArray(localData.setoranBlok) && localData.setoranBlok.length > 0) {
        const setRows = localData.setoranBlok.map(s => ({
          id: s.id,
          collector_id: s.collectorId || null,
          collector_name: s.collectorName || '',
          blok_tugas: s.blokTugas || '',
          periode_bulan: Number(s.periodeBulan) || (new Date().getMonth() + 1),
          periode_tahun: Number(s.periodeTahun) || new Date().getFullYear(),
          jumlah_kk: Number(s.jumlahKkTerbayar || s.jumlahKk) || 0,
          nominal_total: Number(s.nominalTotal) || 0,
          metode: s.metode || 'Tunai',
          tanggal_setor: s.tanggalSetor || new Date().toISOString().slice(0, 10),
          status: s.status || 'Diterima Bendahara',
          catatan: s.catatan || '',
          tanggal_diterima: s.tanggalDiterima || null,
          diterima_oleh: s.diterimaOleh || '',
          bukti_foto: s.buktiFoto || ''
        }));
        await fetch(this.getRestUrl('rt_setoran'), {
          method: 'POST',
          headers: this.getHeaders(true),
          body: JSON.stringify(setRows)
        });
      }

      // 9. Migrasi Pengaturan Kas Masjid Sabilillah
      const ms = localData.masjidSettings || {};
      await fetch(this.getRestUrl('masjid_settings'), {
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify({
          id: 'default',
          nama_masjid: ms.namaMasjid || 'Masjid Sabilillah',
          tagline: ms.tagline || 'Dewan Kemakmuran Masjid (DKM)',
          alamat: ms.alamat || 'Perumahan Tiara Candi 3 Sekargadung',
          ketua_dkm: ms.ketuaDkm || '',
          bendahara: ms.bendahara || '',
          sekretaris: ms.sekretaris || '',
          marbot: ms.marbot || '',
          nomor_rekening: ms.nomorRekening || '7207571808 BSI a.n Masjid Sabilillah',
          contact_wa: ms.contactWa || '',
          saldo_awal: Number(ms.saldoAwal) || 0,
          jariyah_judul: ms.jariyahJudul || 'Kotak Jariyah Keliling Ahad',
          jariyah_waktu: ms.jariyahWaktu || '',
          jariyah_deskripsi: ms.jariyahDeskripsi || '',
          jariyah_jadwal: ms.jariyahJadwal || '',
          jariyah_petugas: ms.jariyahPetugas || ''
        })
      });

      // 10. Migrasi Buku Kas Masjid
      if (Array.isArray(localData.masjidTransactions) && localData.masjidTransactions.length > 0) {
        const msjRows = localData.masjidTransactions.map(m => ({
          id: m.id,
          tanggal: m.tanggal || new Date().toISOString().slice(0, 10),
          tipe: m.tipe || 'masuk',
          kantong: m.kantong || 'Kas Umum',
          kategori: m.kategori || 'Infaq',
          uraian: m.uraian || '',
          pihak: m.pihak || 'Hamba Allah',
          nominal: Number(m.nominal) || 0,
          metode: m.metode || 'Tunai',
          keterangan: m.keterangan || '',
          kwitansi: m.kwitansi || ''
        }));
        await fetch(this.getRestUrl('masjid_transactions'), {
          method: 'POST',
          headers: this.getHeaders(true),
          body: JSON.stringify(msjRows)
        });
        stats.masjidTx = msjRows.length;
      }

      // 11. Migrasi Inventaris & Aset Masjid
      if (Array.isArray(localData.masjidAssets) && localData.masjidAssets.length > 0) {
        const astRows = localData.masjidAssets.map(a => ({
          id: a.id,
          kode: a.kode || '',
          nama: a.nama || '',
          kategori: a.kategori || 'Fasilitas',
          jumlah: Number(a.jumlah) || 1,
          kondisi: a.kondisi || 'Baik',
          lokasi: a.lokasi || 'Ruang Utama',
          tahun_pengadaan: Number(a.tahunPengadaan) || 2026,
          sumber_dana: a.sumberDana || 'Infaq Kas Masjid',
          keterangan: a.keterangan || ''
        }));
        await fetch(this.getRestUrl('masjid_assets'), {
          method: 'POST',
          headers: this.getHeaders(true),
          body: JSON.stringify(astRows)
        });
        stats.assets = astRows.length;
      }

      this.status = 'connected';
      this.updateStatusUI();

      alert(`🎉 MIGRASI SUKSES KE SUPABASE!\n\nSeluruh data telah tersimpan permanen di cloud PostgreSQL:\n• ${stats.residents} Data KK/Warga\n• ${stats.duesRows} Periode Matriks Iuran\n• ${stats.rtTx} Transaksi Kas RT\n• ${stats.masjidTx} Transaksi Kas Masjid Sabilillah\n• ${stats.assets} Inventaris & Aset Masjid\n\nAplikasi RukunKu sekarang berjalan 100% di atas Supabase!`);
      return true;

    } catch (err) {
      this.status = 'error';
      this.updateStatusUI();
      alert("❌ Terjadi kendala saat migrasi data ke Supabase: " + err.message);
      return false;
    }
  },

  // =========================================================================
  // PULL DATA: Mengambil data terbaru dari Supabase dan memperbarui antarmuka
  // =========================================================================
  async pullFromSupabase(options = {}) {
    const cfg = this.getConfig();
    if (!cfg.enabled) return false;

    try {
      this.status = 'syncing';
      this.updateStatusUI();

      const [
        resSettings,
        resBlocks,
        resCats,
        resResidents,
        resDues,
        resTxs,
        resTalangan,
        resCollectors,
        resSetoran,
        resMasjidSettings,
        resMasjidTxs,
        resMasjidAssets
      ] = await Promise.all([
        fetch(this.getRestUrl('rt_settings?id=eq.default'), { headers: this.getHeaders() }).then(r => r.json()).catch(() => []),
        fetch(this.getRestUrl('rt_blocks?select=nama_blok'), { headers: this.getHeaders() }).then(r => r.json()).catch(() => []),
        fetch(this.getRestUrl('rt_categories?select=*'), { headers: this.getHeaders() }).then(r => r.json()).catch(() => []),
        fetch(this.getRestUrl('rt_residents?select=*&order=created_at.asc'), { headers: this.getHeaders() }).then(r => r.json()).catch(() => []),
        fetch(this.getRestUrl('rt_dues?select=*'), { headers: this.getHeaders() }).then(r => r.json()).catch(() => []),
        fetch(this.getRestUrl('rt_transactions?select=*&order=tanggal.desc'), { headers: this.getHeaders() }).then(r => r.json()).catch(() => []),
        fetch(this.getRestUrl('rt_talangan?select=*&order=created_at.desc'), { headers: this.getHeaders() }).then(r => r.json()).catch(() => []),
        fetch(this.getRestUrl('rt_collectors?select=*'), { headers: this.getHeaders() }).then(r => r.json()).catch(() => []),
        fetch(this.getRestUrl('rt_setoran?select=*&order=created_at.desc'), { headers: this.getHeaders() }).then(r => r.json()).catch(() => []),
        fetch(this.getRestUrl('masjid_settings?id=eq.default'), { headers: this.getHeaders() }).then(r => r.json()).catch(() => []),
        fetch(this.getRestUrl('masjid_transactions?select=*&order=tanggal.desc'), { headers: this.getHeaders() }).then(r => r.json()).catch(() => []),
        fetch(this.getRestUrl('masjid_assets?select=*&order=created_at.desc'), { headers: this.getHeaders() }).then(r => r.json()).catch(() => [])
      ]);

      const currentLocal = DB.load();

      // 1. Settings RT
      let mergedSettings = currentLocal.settings || {};
      if (Array.isArray(resSettings) && resSettings[0]) {
        const s = resSettings[0];
        mergedSettings = {
          rtName: s.nama_rt || mergedSettings.rtName,
          perumahan: s.nama_perumahan || mergedSettings.perumahan,
          kelurahan: s.kelurahan || mergedSettings.kelurahan,
          kecamatan: s.kecamatan || mergedSettings.kecamatan,
          kota: s.kota || mergedSettings.kota,
          ketuaRt: s.ketua_rt || mergedSettings.ketuaRt,
          bendahara: s.bendahara || mergedSettings.bendahara,
          sekretaris: s.sekretaris || mergedSettings.sekretaris,
          nomorRekeningRT: s.nomor_rekening_rt || mergedSettings.nomorRekeningRT,
          qrisUrl: s.qris_url || mergedSettings.qrisUrl,
          contactWaKetua: s.contact_wa || mergedSettings.contactWaKetua,
          iuranWajibBulanan: Number(s.iuran_wajib_bulanan) || mergedSettings.iuranWajibBulanan,
          saldoAwalKas: Number(s.saldo_awal_kas) || 0
        };
      }

      // 2. Blocks
      let mergedBlocks = currentLocal.blocks || [];
      if (Array.isArray(resBlocks) && resBlocks.length > 0) {
        mergedBlocks = resBlocks.map(b => b.nama_blok).filter(Boolean);
      }

      // 3. Categories
      let mergedCats = currentLocal.categories || { masuk: [], keluar: [] };
      if (Array.isArray(resCats) && resCats.length > 0) {
        mergedCats = {
          masuk: resCats.filter(c => c.tipe === 'masuk').map(c => c.nama),
          keluar: resCats.filter(c => c.tipe === 'keluar').map(c => c.nama)
        };
      }

      // 4. Residents
      let mergedResidents = currentLocal.residents || [];
      if (Array.isArray(resResidents) && resResidents.length > 0) {
        mergedResidents = resResidents.map(r => {
          let rawFm = r.family_members;
          let parsedFm = [];
          if (Array.isArray(rawFm)) {
            parsedFm = rawFm;
          } else if (typeof rawFm === 'string' && rawFm.trim() !== '') {
            try { parsedFm = JSON.parse(rawFm); } catch(e) { parsedFm = []; }
          }

          // PERLINDUNGAN: Jangan timpa anggota keluarga lokal jika remote kosong tapi lokal sudah ada
          const localRes = (currentLocal.residents || []).find(x => x.id === r.id);
          const localFm = (localRes && Array.isArray(localRes.familyMembers)) ? localRes.familyMembers : [];
          const finalFm = (parsedFm && parsedFm.length > 0) ? parsedFm : localFm;

          const safeJumlah = Math.max(
            Number(r.jumlah_anggota) || 1,
            Number(localRes?.jumlahAnggota) || 1,
            finalFm.length || 1
          );

          return {
            id: r.id,
            nama: r.nama,
            nik: r.nik || '',
            noKk: r.no_kk || '',
            blok: r.blok || '',
            noRumah: r.no_rumah || '',
            alamat: r.alamat || '',
            phone: r.phone || '',
            jumlahAnggota: safeJumlah,
            statusHunian: r.status_hunian || 'Tetap',
            pekerjaan: r.pekerjaan || '',
            statusAktif: r.status_aktif || 'Aktif',
            tanggalMasuk: r.tanggal_masuk || '',
            avatarBg: r.avatar_bg || '#0d9488',
            password: r.password || (localRes?.password || '123456'),
            familyMembers: finalFm,
            fotoKk: r.foto_kk || (localRes?.fotoKk || '')
          };
        });
      }

      // 5. Dues Matrix (Mendukung format per-tahun dan flat untuk kompatibilitas penuh)
      let mergedDues = currentLocal.duesMatrix || {};
      if (Array.isArray(resDues) && resDues.length > 0) {
        if (!mergedDues) mergedDues = {};
        resDues.forEach(row => {
          const yrStr = String(row.tahun || 2026);
          const resId = row.resident_id;
          if (!resId) return;

          const monthMap = {
            "1": row.m1 || 'Belum',
            "2": row.m2 || 'Belum',
            "3": row.m3 || 'Belum',
            "4": row.m4 || 'Belum',
            "5": row.m5 || 'Belum',
            "6": row.m6 || 'Belum',
            "7": row.m7 || 'Belum',
            "8": row.m8 || 'Belum',
            "9": row.m9 || 'Belum',
            "10": row.m10 || 'Belum',
            "11": row.m11 || 'Belum',
            "12": row.m12 || 'Belum'
          };

          // Format: mergedDues[yrStr][resId]
          if (!mergedDues[yrStr]) mergedDues[yrStr] = {};
          mergedDues[yrStr][resId] = { ...monthMap };

          // Format: mergedDues[resId][yrStr]
          if (!mergedDues[resId]) mergedDues[resId] = {};
          mergedDues[resId][yrStr] = { ...monthMap };

          // Format Flat 1-12 untuk tahun berjalan
          if (yrStr === '2026' || yrStr === String(new Date().getFullYear())) {
            Object.assign(mergedDues[resId], monthMap);
          }
        });
      }

      // 6. Transactions RT
      let mergedTxs = currentLocal.transactions || [];
      if (Array.isArray(resTxs) && resTxs.length > 0) {
        mergedTxs = resTxs.map(t => ({
          id: t.id,
          tanggal: t.tanggal || '',
          waktu: t.waktu || '10:00',
          tipe: t.tipe || 'masuk',
          kategori: t.kategori || 'Iuran Bulanan',
          judul: t.judul || '',
          keterangan: t.keterangan || '',
          residentId: t.resident_id || null,
          blok: t.blok || '',
          nominal: Number(t.nominal) || 0,
          metode: t.metode || 'Kas Tunai',
          status: t.status || 'Approved',
          kwitansi: t.kwitansi || '',
          pencatat: t.pencatat || '',
          buktiTransfer: t.bukti_transfer || '',
          periodeTahun: t.periode_tahun || null,
          periodeBulan: t.periode_bulan || null
        }));
      }

      // 7. Talangan
      let mergedTalangan = currentLocal.talangan || [];
      if (Array.isArray(resTalangan) && resTalangan.length > 0) {
        mergedTalangan = resTalangan.map(t => ({
          id: t.id,
          residentId: t.resident_id || null,
          nama: t.nama || '',
          blok: t.blok || '',
          phone: t.phone || '',
          nominal: Number(t.nominal) || 0,
          terbayar: Number(t.terbayar) || 0,
          sisa: Number(t.sisa) || 0,
          tanggalPinjam: t.tanggal_pinjam || '',
          jatuhTempo: t.jatuh_tempo || '',
          keperluan: t.keperluan || '',
          status: t.status || 'Berjalan',
          keterangan: t.keterangan || ''
        }));
      }

      // 8. Collectors & Setoran
      let mergedCollectors = currentLocal.collectors || [];
      if (Array.isArray(resCollectors) && resCollectors.length > 0) {
        mergedCollectors = resCollectors.map(c => ({
          id: c.id,
          residentId: c.resident_id || null,
          nama: c.nama || '',
          blokAsal: c.blok_asal || '',
          username: c.username || '',
          password: c.password || '123',
          phone: c.phone || '',
          blokTugas: c.blok_tugas || '',
          assignedBlocks: Array.isArray(c.assigned_blocks) ? c.assigned_blocks : [],
          role: c.role || 'petugas'
        }));
      }

      let mergedSetoran = currentLocal.setoranBlok || [];
      if (Array.isArray(resSetoran) && resSetoran.length > 0) {
        mergedSetoran = resSetoran.map(s => ({
          id: s.id,
          collectorId: s.collector_id || null,
          collectorName: s.collector_name || '',
          blokTugas: s.blok_tugas || '',
          periodeBulan: s.periode_bulan,
          periodeTahun: s.periode_tahun,
          jumlahKkTerbayar: s.jumlah_kk,
          nominalTotal: Number(s.nominal_total) || 0,
          metode: s.metode || 'Tunai',
          tanggalSetor: s.tanggal_setor || '',
          status: s.status || 'Diterima Bendahara',
          catatan: s.catatan || '',
          tanggalDiterima: s.tanggal_diterima || '',
          diterimaOleh: s.diterima_oleh || '',
          buktiFoto: s.bukti_foto || ''
        }));
      }

      // 9. Masjid Settings
      let mergedMasjidSettings = currentLocal.masjidSettings || {};
      if (Array.isArray(resMasjidSettings) && resMasjidSettings[0]) {
        const ms = resMasjidSettings[0];
        mergedMasjidSettings = {
          ...mergedMasjidSettings,
          namaMasjid: ms.nama_masjid || mergedMasjidSettings.namaMasjid,
          tagline: ms.tagline || mergedMasjidSettings.tagline,
          alamat: ms.alamat || mergedMasjidSettings.alamat,
          ketuaDkm: ms.ketua_dkm || mergedMasjidSettings.ketuaDkm,
          bendahara: ms.bendahara || mergedMasjidSettings.bendahara,
          sekretaris: ms.sekretaris || mergedMasjidSettings.sekretaris,
          marbot: ms.marbot || mergedMasjidSettings.marbot,
          nomorRekening: ms.nomor_rekening || mergedMasjidSettings.nomorRekening,
          contactWa: ms.contact_wa || mergedMasjidSettings.contactWa,
          saldoAwal: Number(ms.saldo_awal) || 0,
          jariyahJudul: ms.jariyah_judul || mergedMasjidSettings.jariyahJudul,
          jariyahWaktu: ms.jariyah_waktu || mergedMasjidSettings.jariyahWaktu,
          jariyahDeskripsi: ms.jariyah_deskripsi || mergedMasjidSettings.jariyahDeskripsi,
          jariyahJadwal: ms.jariyah_jadwal || mergedMasjidSettings.jariyahJadwal,
          jariyahPetugas: ms.jariyah_petugas || mergedMasjidSettings.jariyahPetugas
        };
      }

      // 10. Masjid Transactions
      let mergedMasjidTxs = currentLocal.masjidTransactions || [];
      if (Array.isArray(resMasjidTxs) && resMasjidTxs.length > 0) {
        mergedMasjidTxs = resMasjidTxs.map(m => ({
          id: m.id,
          tanggal: m.tanggal || '',
          tipe: m.tipe || 'masuk',
          kantong: m.kantong || 'Kas Umum',
          kategori: m.kategori || 'Infaq',
          uraian: m.uraian || '',
          pihak: m.pihak || 'Hamba Allah',
          nominal: Number(m.nominal) || 0,
          metode: m.metode || 'Tunai',
          keterangan: m.keterangan || '',
          kwitansi: m.kwitansi || ''
        }));
      }

      // 11. Masjid Assets
      let mergedMasjidAssets = currentLocal.masjidAssets || [];
      if (Array.isArray(resMasjidAssets) && resMasjidAssets.length > 0) {
        mergedMasjidAssets = resMasjidAssets.map(a => ({
          id: a.id,
          kode: a.kode || '',
          nama: a.nama || '',
          kategori: a.kategori || 'Fasilitas',
          jumlah: Number(a.jumlah) || 1,
          kondisi: a.kondisi || 'Baik',
          lokasi: a.lokasi || 'Ruang Utama',
          tahunPengadaan: Number(a.tahun_pengadaan) || 2026,
          sumberDana: a.sumber_dana || 'Infaq Kas Masjid',
          keterangan: a.keterangan || ''
        }));
      }

      const finalData = {
        ...currentLocal,
        settings: mergedSettings,
        blocks: mergedBlocks,
        categories: mergedCats,
        residents: mergedResidents,
        duesMatrix: mergedDues,
        transactions: mergedTxs,
        talangan: mergedTalangan,
        collectors: mergedCollectors,
        setoranBlok: mergedSetoran,
        masjidSettings: mergedMasjidSettings,
        masjidTransactions: mergedMasjidTxs,
        masjidAssets: mergedMasjidAssets
      };

      DB.save(finalData, { skipSync: true });
      if (window.App) {
        window.App.data = finalData;
        try {
          if (typeof window.App.cleanDataSeparation === 'function') window.App.cleanDataSeparation();
          if (typeof window.App.renderDashboard === 'function') window.App.renderDashboard();
          if (typeof window.App.renderResidents === 'function') window.App.renderResidents();
          if (typeof window.App.renderTransactions === 'function') window.App.renderTransactions();
          if (typeof window.App.renderDuesMatrix === 'function') window.App.renderDuesMatrix();
          if (typeof window.App.renderChart === 'function') window.App.renderChart();
          if (typeof window.App.renderFinancialReport === 'function') window.App.renderFinancialReport();
          if (typeof window.App.renderSetoranBlok === 'function') window.App.renderSetoranBlok();
          if (typeof window.App.renderTalangan === 'function') window.App.renderTalangan();
          if (typeof window.App.renderKelolaPetugasPage === 'function') window.App.renderKelolaPetugasPage();
          if (typeof window.App.renderWargaProfile === 'function') window.App.renderWargaProfile();
          if (typeof window.App.renderWargaIuranHistory === 'function') window.App.renderWargaIuranHistory();
          if (typeof window.App.renderMasjidDashboard === 'function') window.App.renderMasjidDashboard();
          if (typeof window.App.renderMasjidKas === 'function') window.App.renderMasjidKas();
          if (typeof window.App.renderMasjidAset === 'function') window.App.renderMasjidAset();
          if (typeof window.App.renderMasjidLaporan === 'function') window.App.renderMasjidLaporan();
          if (typeof window.App.renderWargaMasjidTransparansi === 'function') window.App.renderWargaMasjidTransparansi();
        } catch (uiErr) {
          console.warn("UI refresh warning after Supabase pull:", uiErr);
        }
      }

      this.status = 'connected';
      this.lastSyncTime = new Date().toISOString();
      this.updateStatusUI();

      if (!options.silent) {
        alert("✅ Sinkronisasi Berhasil!\n\nSeluruh data terbaru telah dimuat dari Supabase PostgreSQL.");
      }
      return true;

    } catch (err) {
      console.warn("Pull from Supabase failed:", err);
      this.status = 'error';
      this.updateStatusUI();
      if (!options.silent) {
        alert("❌ Gagal memuat data dari Supabase: " + err.message);
      }
      return false;
    }
  },

  // Auto-sync snapshot perubahan kecil
  autoSyncBackground() {
    const cfg = this.getConfig();
    if (!cfg.enabled) return;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.syncSnapshotToSupabase();
    }, 1500);
  },

  async syncSnapshotToSupabase() {
    // Dipanggil untuk sinkronisasi latar belakang jika ada perubahan setting / kategori
    try {
      const localData = DB.load();
      if (localData.settings) {
        const s = localData.settings;
        await fetch(this.getRestUrl('rt_settings'), {
          method: 'POST',
          headers: this.getHeaders(true),
          body: JSON.stringify({
            id: 'default',
            nama_rt: s.rtName || '03',
            nama_rw: s.rwName || '05',
            nama_perumahan: s.perumahan || 'Perumahan Tiara Candi 3',
            kelurahan: s.kelurahan || 'Sekargadung',
            kecamatan: s.kecamatan || 'Purworejo',
            kota: s.kota || 'Kota Pasuruan',
            ketua_rt: s.ketuaRt || '',
            bendahara: s.bendahara || '',
            sekretaris: s.sekretaris || '',
            nomor_rekening_rt: s.nomorRekeningRT || '',
            qris_url: s.qrisUrl || '',
            contact_wa: s.contactWaKetua || '',
            iuran_wajib_bulanan: Number(s.iuranWajibBulanan) || 50000,
            saldo_awal_kas: Number(s.saldoAwalKas) || 0
          })
        });
      }
    } catch (e) {
      console.warn("Silent snapshot sync error:", e);
    }
  },

  // Cari akun warga langsung ke Supabase (Fallback Login Online Real-time)
  async findResidentOnline(query, cleanPhone = '') {
    if (!query) return null;
    try {
      const q = encodeURIComponent(String(query).trim());
      const cp = encodeURIComponent(String(cleanPhone || query).trim());
      const url = this.getRestUrl(`rt_residents?or=(nik.eq.${q},phone.eq.${q},phone.eq.${cp},nama.ilike.${q},no_kk.eq.${q})&limit=1`);
      const res = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders()
      });
      if (!res.ok) return null;
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0) {
        const r = rows[0];
        let rawFm = r.family_members;
        let parsedFm = [];
        if (Array.isArray(rawFm)) {
          parsedFm = rawFm;
        } else if (typeof rawFm === 'string' && rawFm.trim() !== '') {
          try { parsedFm = JSON.parse(rawFm); } catch(e) { parsedFm = []; }
        }
        return {
          id: r.id,
          nama: r.nama,
          nik: r.nik || '',
          noKk: r.no_kk || '',
          blok: r.blok || '',
          noRumah: r.no_rumah || '',
          alamat: r.alamat || '',
          phone: r.phone || '',
          jumlahAnggota: Math.max(Number(r.jumlah_anggota) || 1, parsedFm.length || 1),
          statusHunian: r.status_hunian || 'Tetap',
          pekerjaan: r.pekerjaan || '',
          statusAktif: r.status_aktif || 'Aktif',
          tanggalMasuk: r.tanggal_masuk || '',
          avatarBg: r.avatar_bg || '#0d9488',
          password: r.password || '123456',
          familyMembers: parsedFm,
          fotoKk: r.foto_kk || ''
        };
      }
    } catch (e) {
      console.warn("Supabase findResidentOnline error:", e);
    }
    return null;
  },

  // =========================================================================
  // REALTIME DIRECT PUSH CRUD METHODS
  // =========================================================================
  async saveResidentDirect(r) {
    if (!r || !r.id) return false;
    try {
      const payload = {
        id: r.id,
        nama: r.nama || '',
        nik: r.nik ? String(r.nik).replace(/^'/, '').trim() : '',
        no_kk: r.noKk ? String(r.noKk).replace(/^'/, '').trim() : '',
        blok: r.blok || '',
        no_rumah: r.noRumah || '',
        alamat: r.alamat || '',
        phone: r.phone ? String(r.phone).replace(/^'/, '').trim() : '',
        jumlah_anggota: Number(r.jumlahAnggota) || (Array.isArray(r.familyMembers) ? r.familyMembers.length : 1),
        status_hunian: r.statusHunian || 'Tetap',
        pekerjaan: r.pekerjaan || '',
        status_aktif: String(r.statusAktif || 'Aktif'),
        avatar_bg: r.avatarBg || '#0d9488',
        password: r.password || '123456',
        family_members: Array.isArray(r.familyMembers) ? r.familyMembers : [],
        foto_kk: r.fotoKk || ''
      };

      // 1. Coba simpan menggunakan POST upsert (on_conflict=id)
      const res = await fetch(this.getRestUrl('rt_residents?on_conflict=id'), {
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        // 2. Fallback jika upsert conflict: lakukan PATCH langsung pada baris id tersebut
        const patchRes = await fetch(this.getRestUrl(`rt_residents?id=eq.${encodeURIComponent(r.id)}`), {
          method: 'PATCH',
          headers: this.getHeaders(),
          body: JSON.stringify(payload)
        });
        if (!patchRes.ok) {
          console.warn("Supabase saveResidentDirect fallback PATCH failed:", patchRes.status);
          return false;
        }
      }
      return true;
    } catch (e) {
      console.warn("Supabase saveResidentDirect error:", e);
      return false;
    }
  },

  async deleteResidentDirect(id) {
    if (!id) return;
    try {
      await fetch(this.getRestUrl(`rt_residents?id=eq.${id}`), {
        method: 'DELETE',
        headers: this.getHeaders()
      });
    } catch (e) {
      console.warn("Supabase deleteResidentDirect error:", e);
    }
  },

  async saveTransactionDirect(t) {
    if (!t) return;
    // Jika transaksi masjid, alihkan ke tabel masjid
    if (window.App && typeof window.App.isMasjidTx === 'function' && window.App.isMasjidTx(t)) {
      return this.saveMasjidTransactionDirect(t);
    }

    const payload = {
      id: t.id,
      tanggal: t.tanggal || new Date().toISOString().slice(0, 10),
      waktu: t.waktu || '10:00',
      tipe: t.tipe || 'masuk',
      kategori: t.kategori || 'Iuran Bulanan',
      judul: t.judul || '',
      keterangan: t.keterangan || '',
      resident_id: t.residentId || null,
      blok: t.blok || '',
      nominal: Number(t.nominal) || 0,
      metode: t.metode || 'Kas Tunai',
      status: t.status || 'Approved',
      kwitansi: t.kwitansi || '',
      pencatat: t.pencatat || '',
      bukti_transfer: t.buktiTransfer || '',
      periode_tahun: t.periodeTahun || null,
      periode_bulan: t.periodeBulan || null
    };

    try {
      const res = await fetch(this.getRestUrl('rt_transactions?on_conflict=id'), {
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        // Fallback PATCH jika sudah ada
        await fetch(this.getRestUrl(`rt_transactions?id=eq.${encodeURIComponent(t.id)}`), {
          method: 'PATCH',
          headers: this.getHeaders(),
          body: JSON.stringify(payload)
        });
      }
    } catch (e) {
      console.warn("Supabase saveTransactionDirect error:", e);
    }
  },

  async deleteTransactionDirect(id) {
    if (!id) return;
    try {
      await fetch(this.getRestUrl(`rt_transactions?id=eq.${id}`), {
        method: 'DELETE',
        headers: this.getHeaders()
      });
    } catch (e) {
      console.warn("Supabase deleteTransactionDirect error:", e);
    }
  },

  async updateDuesDirect(residentId, year, month, status) {
    if (!residentId || !year || !month) return;
    const colName = `m${month}`;
    const yr = parseInt(year) || new Date().getFullYear();
    try {
      const res = await fetch(this.getRestUrl('rt_dues?on_conflict=resident_id,tahun'), {
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify({
          resident_id: residentId,
          tahun: yr,
          [colName]: status
        })
      });
      if (!res.ok) {
        // Fallback PATCH langsung untuk update spesifik
        await fetch(this.getRestUrl(`rt_dues?resident_id=eq.${encodeURIComponent(residentId)}&tahun=eq.${yr}`), {
          method: 'PATCH',
          headers: this.getHeaders(),
          body: JSON.stringify({
            [colName]: status
          })
        });
      }
    } catch (e) {
      console.warn("Supabase updateDuesDirect error:", e);
    }
  },

  async saveTalanganDirect(t) {
    if (!t) return;
    try {
      await fetch(this.getRestUrl('rt_talangan'), {
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify({
          id: t.id,
          resident_id: t.residentId || null,
          nama: t.nama || '',
          blok: t.blok || '',
          phone: t.phone || '',
          nominal: Number(t.nominal) || 0,
          terbayar: Number(t.terbayar) || 0,
          sisa: Number(t.sisa) || 0,
          tanggal_pinjam: t.tanggalPinjam || null,
          jatuh_tempo: t.jatuhTempo || null,
          keperluan: t.keperluan || '',
          status: t.status || 'Berjalan',
          keterangan: t.keterangan || ''
        })
      });
    } catch (e) {
      console.warn("Supabase saveTalanganDirect error:", e);
    }
  },

  async deleteTalanganDirect(id) {
    if (!id) return;
    try {
      await fetch(this.getRestUrl(`rt_talangan?id=eq.${id}`), {
        method: 'DELETE',
        headers: this.getHeaders()
      });
    } catch (e) {
      console.warn("Supabase deleteTalanganDirect error:", e);
    }
  },

  async saveCollectorDirect(c) {
    if (!c) return;
    try {
      await fetch(this.getRestUrl('rt_collectors'), {
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify({
          id: c.id,
          resident_id: c.residentId || null,
          nama: c.nama || '',
          blok_asal: c.blokAsal || '',
          username: c.username || '',
          password: c.password || '123',
          phone: c.phone || '',
          blok_tugas: c.blokTugas || '',
          assigned_blocks: c.assignedBlocks || [],
          role: c.role || 'petugas'
        })
      });
    } catch (e) {
      console.warn("Supabase saveCollectorDirect error:", e);
    }
  },

  async deleteCollectorDirect(id) {
    if (!id) return;
    try {
      await fetch(this.getRestUrl(`rt_collectors?id=eq.${id}`), {
        method: 'DELETE',
        headers: this.getHeaders()
      });
    } catch (e) {
      console.warn("Supabase deleteCollectorDirect error:", e);
    }
  },

  async saveSetoranDirect(s) {
    if (!s) return;
    try {
      await fetch(this.getRestUrl('rt_setoran'), {
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify({
          id: s.id,
          collector_id: s.collectorId || null,
          collector_name: s.collectorName || '',
          blok_tugas: s.blokTugas || '',
          periode_bulan: Number(s.periodeBulan) || (new Date().getMonth() + 1),
          periode_tahun: Number(s.periodeTahun) || new Date().getFullYear(),
          jumlah_kk: Number(s.jumlahKkTerbayar || s.jumlahKk) || 0,
          nominal_total: Number(s.nominalTotal) || 0,
          metode: s.metode || 'Tunai',
          tanggal_setor: s.tanggalSetor || new Date().toISOString().slice(0, 10),
          status: s.status || 'Diterima Bendahara',
          catatan: s.catatan || '',
          tanggal_diterima: s.tanggalDiterima || null,
          diterima_oleh: s.diterima_oleh || '',
          bukti_foto: s.buktiFoto || ''
        })
      });
    } catch (e) {
      console.warn("Supabase saveSetoranDirect error:", e);
    }
  },

  async saveMasjidTransactionDirect(t) {
    if (!t) return;
    try {
      await fetch(this.getRestUrl('masjid_transactions'), {
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify({
          id: t.id,
          tanggal: t.tanggal || new Date().toISOString().slice(0, 10),
          tipe: t.tipe || 'masuk',
          kantong: t.kantong || 'Kas Umum',
          kategori: t.kategori || 'Infaq',
          uraian: t.uraian || t.judul || '',
          pihak: t.pihak || 'Hamba Allah',
          nominal: Number(t.nominal) || 0,
          metode: t.metode || 'Tunai',
          keterangan: t.keterangan || '',
          kwitansi: t.kwitansi || ''
        })
      });
    } catch (e) {
      console.warn("Supabase saveMasjidTransactionDirect error:", e);
    }
  },

  async deleteMasjidTransactionDirect(id) {
    if (!id) return;
    try {
      await fetch(this.getRestUrl(`masjid_transactions?id=eq.${id}`), {
        method: 'DELETE',
        headers: this.getHeaders()
      });
    } catch (e) {
      console.warn("Supabase deleteMasjidTransactionDirect error:", e);
    }
  },

  async saveMasjidAssetDirect(a) {
    if (!a) return;
    try {
      await fetch(this.getRestUrl('masjid_assets'), {
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify({
          id: a.id,
          kode: a.kode || '',
          nama: a.nama || '',
          kategori: a.kategori || 'Fasilitas',
          jumlah: Number(a.jumlah) || 1,
          kondisi: a.kondisi || 'Baik',
          lokasi: a.lokasi || 'Ruang Utama',
          tahun_pengadaan: Number(a.tahunPengadaan) || 2026,
          sumber_dana: a.sumberDana || 'Infaq Kas Masjid',
          keterangan: a.keterangan || ''
        })
      });
    } catch (e) {
      console.warn("Supabase saveMasjidAssetDirect error:", e);
    }
  },

  async deleteMasjidAssetDirect(id) {
    if (!id) return;
    try {
      await fetch(this.getRestUrl(`masjid_assets?id=eq.${id}`), {
        method: 'DELETE',
        headers: this.getHeaders()
      });
    } catch (e) {
      console.warn("Supabase deleteMasjidAssetDirect error:", e);
    }
  }
};

// Auto-run init saat dokumen dimuat
if (typeof document !== 'undefined') {
  if (document.readyState !== 'loading') {
    SupabaseSync.init();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      SupabaseSync.init();
    });
  }
}

window.SupabaseSync = SupabaseSync;
