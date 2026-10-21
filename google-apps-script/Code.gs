/**
 * RukunKu - Google Sheets & Apps Script Cloud Sync Module
 * Enables real-time synchronization between RukunKu and Google Spreadsheet
 */

const CloudSync = {
  // URL Web App Google Apps Script default lingkungan RT 05 / RW 02 Perum Tiara Candi 3
  DEFAULT_GAS_URL: 'https://script.google.com/macros/s/AKfycbxN-hWB9wZLcKLuUEA2dXX2D23DPrTHPYYkJwmmViq2EdFbwvg0KYEXvAUQFL1FU6JW6w/exec',
  STORAGE_KEY_URL: 'rukunku_gas_url',
  STORAGE_KEY_LAST_SYNC: 'rukunku_last_sync_time',
  
  status: 'disconnected', // 'disconnected' | 'connected' | 'syncing' | 'error'
  lastSyncTime: null,
  hasPulledOnce: false,
  debounceTimer: null,
  lastPullTimestamp: 0,

  init() {
    this.lastSyncTime = localStorage.getItem(this.STORAGE_KEY_LAST_SYNC) || null;
    this.updateStatusUI();

    const gasUrl = this.getGasUrl();
    if (gasUrl) {
      // Auto-pull updates on startup from Google Sheets
      this.pullFromSheets({ silent: true });
    }

    // Auto-refresh data saat user kembali membuka tab browser RukunKu
    window.addEventListener('focus', () => {
      if (this.getGasUrl() && Date.now() - this.lastPullTimestamp > 5000 && this.status !== 'syncing') {
        this.pullFromSheets({ silent: true });
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.getGasUrl() && Date.now() - this.lastPullTimestamp > 5000 && this.status !== 'syncing') {
        this.pullFromSheets({ silent: true });
      }
    });

    // Smart Background Polling: cek data baru dari Google Sheets setiap 25 detik saat tab aktif
    setInterval(() => {
      if (document.visibilityState === 'visible' && this.getGasUrl() && this.status !== 'syncing' && Date.now() - this.lastPullTimestamp > 20000) {
        this.pullFromSheets({ silent: true });
      }
    }, 25000);
  },

  getGasUrl() {
    return localStorage.getItem(this.STORAGE_KEY_URL) || this.DEFAULT_GAS_URL || '';
  },

  setGasUrl(url) {
    const cleanUrl = (url || '').trim();
    if (cleanUrl) {
      localStorage.setItem(this.STORAGE_KEY_URL, cleanUrl);
    } else {
      localStorage.removeItem(this.STORAGE_KEY_URL);
    }
    this.updateStatusUI();
  },

  // Update Status Pill in Header and Modal
  updateStatusUI() {
    const gasUrl = this.getGasUrl();
    const cloudPill = document.getElementById('cloudSyncPill');
    const cloudDot = document.getElementById('cloudSyncDot');
    const cloudText = document.getElementById('cloudSyncText');
    const modalStatusBox = document.getElementById('modalCloudStatus');
    const lastSyncEl = document.getElementById('cloudLastSyncText');

    if (!cloudPill) return;

    if (!gasUrl) {
      this.status = 'disconnected';
      if (cloudDot) cloudDot.style.background = '#94a3b8';
      if (cloudText) cloudText.textContent = 'Mode: Database Lokal';
      cloudPill.title = 'Belum terhubung ke Google Sheets. Klik untuk mengonfigurasi.';
      
      if (modalStatusBox) {
        modalStatusBox.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px; color: #64748b;">
            <span style="width: 10px; height: 10px; border-radius: 50%; background: #94a3b8; display: inline-block;"></span>
            <span>Database Lokal Aktif (Data tersimpan di browser ini)</span>
          </div>
        `;
      }
    } else if (this.status === 'syncing') {
      if (cloudDot) cloudDot.style.background = '#f59e0b';
      if (cloudText) cloudText.textContent = 'Menyinkronkan...';
    } else if (this.status === 'connected') {
      if (cloudDot) cloudDot.style.background = '#10b981';
      if (cloudText) cloudText.textContent = 'Google Sheet Terhubung';
      cloudPill.title = 'Terhubung ke Google Sheets. Klik untuk detail / sync manual.';
      
      if (modalStatusBox) {
        modalStatusBox.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 12px 14px;">
            <div style="display: flex; align-items: center; gap: 10px; color: #065f46; font-weight: 600; font-size: 13px;">
              <span style="width: 10px; height: 10px; border-radius: 50%; background: #10b981; display: inline-block;"></span>
              <span>Terhubung ke Cloud Google Sheets</span>
            </div>
            <span style="font-size: 11px; color: #047857;">Aktif</span>
          </div>
        `;
      }
    } else if (this.status === 'error') {
      if (cloudDot) cloudDot.style.background = '#ef4444';
      if (cloudText) cloudText.textContent = 'Sync Gagal';
      cloudPill.title = 'Gagal berkomunikasi dengan Google Sheets. Periksa URL Anda.';
    }

    if (lastSyncEl && this.lastSyncTime) {
      lastSyncEl.textContent = `Sinkronisasi terakhir: ${new Date(this.lastSyncTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    }
  },

  // Immediate push snapshot to Google Sheets
  async syncNow() {
    const gasUrl = this.getGasUrl();
    if (!gasUrl) return;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    try {
      const localData = DB.load();
      await fetch(gasUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'syncAll', data: localData })
      });
      this.status = 'connected';
      this.lastSyncTime = new Date().toISOString();
      localStorage.setItem(this.STORAGE_KEY_LAST_SYNC, this.lastSyncTime);
      this.updateStatusUI();
    } catch (err) {
      console.warn("Background immediate sync error:", err);
    }
  },

  // Debounced background auto-sync when changes occur
  autoSyncBackground() {
    const gasUrl = this.getGasUrl();
    if (!gasUrl) return;

    // PENGAMAN: Jangan auto-sync jika pengunjung baru belum pernah berhasil menarik data dari Cloud
    // Ini mencegah browser baru tanpa cache menimpa data Cloud dengan data demo default.
    if (!this.hasPulledOnce && !localStorage.getItem(this.STORAGE_KEY_LAST_SYNC)) {
      console.log("[CloudSync] Auto-sync ditangguhkan sampai pull awal dari cloud selesai.");
      return;
    }

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(async () => {
      await this.syncNow();
    }, 1200);
  },

  // Test Connection
  async testConnection(url) {
    const targetUrl = (url || this.getGasUrl()).trim();
    if (!targetUrl) {
      alert("Masukkan URL Web App Google Apps Script terlebih dahulu!");
      return false;
    }

    this.status = 'syncing';
    this.updateStatusUI();

    try {
      const pingUrl = targetUrl + (targetUrl.includes('?') ? '&' : '?') + 'action=ping&t=' + Date.now();
      const res = await fetch(pingUrl, { method: 'GET', mode: 'cors' });
      const data = await res.json();

      if (data && data.status === 'success') {
        this.status = 'connected';
        this.setGasUrl(targetUrl);
        this.updateStatusUI();
        alert("✅ Koneksi Berhasil! Google Apps Script siap digunakan sebagai database RukunKu.");
        return true;
      } else {
        throw new Error(data.message || 'Respons tidak valid');
      }
    } catch (err) {
      this.status = 'error';
      this.updateStatusUI();
      alert("❌ Gagal terhubung ke Google Apps Script.\n\nPastikan:\n1. URL berakhiran /exec\n2. Saat Deploy, akses diatur ke 'Anyone'\n\nPesan error: " + err.message);
      return false;
    }
  },

  // Pull Data from Google Sheets (GET action=getData)
  async pullFromSheets(options = {}) {
    const gasUrl = this.getGasUrl();
    if (!gasUrl) return;

    this.lastPullTimestamp = Date.now();
    this.status = 'syncing';
    this.updateStatusUI();

    try {
      const getUrl = gasUrl + (gasUrl.includes('?') ? '&' : '?') + 'action=getData&t=' + Date.now();
      const res = await fetch(getUrl, { method: 'GET', mode: 'cors' });
      const json = await res.json();

      if (json && json.status === 'success' && json.data) {
        const cloudData = json.data;
        const currentLocal = DB.load();

        // Cek apakah di Google Sheets sudah ada data warga nyata
        const hasCloudResidents = Array.isArray(cloudData.residents) && cloudData.residents.length > 0;
        const residentsToUse = hasCloudResidents
          ? cloudData.residents.map(cr => {
              const localMatch = (currentLocal.residents || []).find(lr => lr.id === cr.id);
              
              // Gabungkan familyMembers agar fotoKtp lokal tidak terhapus jika cloud mengembalikan string kosong
              const mergedFamily = (cr.familyMembers || []).map((cfm, idx) => {
                const lfm = (localMatch && localMatch.familyMembers)
                  ? (localMatch.familyMembers.find(m => m.id === cfm.id) || localMatch.familyMembers[idx])
                  : null;
                return {
                  ...cfm,
                  fotoKtp: cfm.fotoKtp || (lfm && lfm.fotoKtp ? lfm.fotoKtp : '')
                };
              });

              // Pertahankan daftar anggota keluarga lokal jika lokal memiliki data lebih lengkap/baru
              let finalFamily = mergedFamily.length > 0 ? mergedFamily : (cr.familyMembers || []);
              if (localMatch && Array.isArray(localMatch.familyMembers) && localMatch.familyMembers.length > finalFamily.length) {
                finalFamily = localMatch.familyMembers;
              }

              // Pastikan jumlahAnggota tidak turun kembali menjadi 1 jika di lokal atau cloud ada angka lebih besar
              const safeJumlah = Math.max(
                Number(cr.jumlahAnggota) || 1,
                Number(localMatch ? localMatch.jumlahAnggota : 1) || 1,
                finalFamily.length || 1
              );

              return {
                ...cr,
                jumlahAnggota: safeJumlah,
                password: cr.password || (localMatch && localMatch.password ? localMatch.password : '123456'),
                fotoKk: cr.fotoKk || (localMatch && localMatch.fotoKk ? localMatch.fotoKk : ''),
                familyMembers: finalFamily
              };
            })
          : (currentLocal.residents || []);

        // Pastikan categories memiliki format array yang aman
        let cleanCategories = currentLocal.categories;
        if (cloudData.categories && typeof cloudData.categories === 'object') {
          cleanCategories = {
            masuk: Array.isArray(cloudData.categories.masuk) ? cloudData.categories.masuk : (currentLocal.categories?.masuk || []),
            keluar: Array.isArray(cloudData.categories.keluar) ? cloudData.categories.keluar : (currentLocal.categories?.keluar || [])
          };
        }

        // Pastikan phone bertipe string dan assignedBlocks bertipe array
        const cleanCollectors = Array.isArray(cloudData.collectors)
          ? cloudData.collectors.map(c => ({
              ...c,
              phone: String(c.phone || '').replace(/^'/, ''),
              assignedBlocks: Array.isArray(c.assignedBlocks) ? c.assignedBlocks : [String(c.blokTugas || '')]
            }))
          : (currentLocal.collectors || []);

        const merged = {
          ...currentLocal,
          settings: cloudData.settings || currentLocal.settings,
          blocks: (cloudData.blocks && Array.isArray(cloudData.blocks) && cloudData.blocks.length > 0) ? cloudData.blocks : currentLocal.blocks,
          categories: cleanCategories,
          residents: residentsToUse,
          transactions: Array.isArray(cloudData.transactions) ? cloudData.transactions : (currentLocal.transactions || []),
          duesMatrix: cloudData.duesMatrix || currentLocal.duesMatrix,
          talangan: Array.isArray(cloudData.talangan) ? cloudData.talangan : (currentLocal.talangan || []),
          collectors: cleanCollectors,
          setoranBlok: Array.isArray(cloudData.setoranBlok) ? cloudData.setoranBlok : (currentLocal.setoranBlok || []),
          masjidSettings: cloudData.masjidSettings || currentLocal.masjidSettings,
          masjidAdmin: cloudData.masjidAdmin || currentLocal.masjidAdmin,
          masjidTransactions: (Array.isArray(cloudData.masjidTransactions) && cloudData.masjidTransactions.length > 0) ? cloudData.masjidTransactions : (currentLocal.masjidTransactions || []),
          masjidAssets: (Array.isArray(cloudData.masjidAssets) && cloudData.masjidAssets.length > 0) ? cloudData.masjidAssets : (currentLocal.masjidAssets || [])
        };

        // Simpan ke local tanpa trigger auto-sync balik ke server
        DB.save(merged, { skipSync: true });
        this.hasPulledOnce = true;

        if (window.App) {
          window.App.data = merged;
          // Hanya re-render view utama jika user sudah login
          if (window.AppState && window.AppState.currentUser) {
            try {
              if (typeof window.App.updateSettingsUI === 'function') window.App.updateSettingsUI();
              if (typeof window.App.renderBlockOptions === 'function') window.App.renderBlockOptions();
              if (typeof window.App.renderDashboard === 'function') window.App.renderDashboard();
              if (typeof window.App.renderResidents === 'function') window.App.renderResidents();
              if (typeof window.App.renderTransactions === 'function') window.App.renderTransactions();
              if (typeof window.App.renderDuesMatrix === 'function') window.App.renderDuesMatrix();
              if (typeof window.App.renderTalangan === 'function') window.App.renderTalangan();
              if (typeof window.App.renderFinancialReport === 'function') window.App.renderFinancialReport();
              if (typeof window.App.renderSetoranBlok === 'function') window.App.renderSetoranBlok();
              if (typeof window.App.renderKelolaPetugasPage === 'function') window.App.renderKelolaPetugasPage();
              if (typeof window.App.renderPetugasList === 'function') window.App.renderPetugasList();
              if (typeof window.App.updateNotificationBadge === 'function') window.App.updateNotificationBadge();
              if (window.AppState.currentRole === 'admin_masjid') {
                if (typeof window.App.renderMasjidDashboard === 'function') window.App.renderMasjidDashboard();
                if (typeof window.App.renderMasjidKas === 'function') window.App.renderMasjidKas();
                if (typeof window.App.renderMasjidAset === 'function') window.App.renderMasjidAset();
                if (typeof window.App.renderMasjidLaporan === 'function') window.App.renderMasjidLaporan();
              }
            } catch (renderErr) {
              console.warn("[CloudSync] Background render error:", renderErr);
            }
          } else {
            // Jika user masih di halaman login / register, cukup update opsi blok registrasi & judul lingkungan
            try {
              if (typeof window.App.updateSettingsUI === 'function') window.App.updateSettingsUI();
              if (typeof window.App.renderBlockOptions === 'function') window.App.renderBlockOptions();
            } catch (e) {}
          }
        }

        this.status = 'connected';
        this.lastSyncTime = new Date().toISOString();
        localStorage.setItem(this.STORAGE_KEY_LAST_SYNC, this.lastSyncTime);
        this.updateStatusUI();

        if (!options.silent) {
          alert("✅ Data berhasil ditarik dan diperbarui dari Google Sheets!");
        }
      } else {
        throw new Error(json.message || 'Gagal memuat data dari cloud');
      }
    } catch (err) {
      console.warn("Gagal sinkronisasi dari Google Sheets:", err);
      this.status = 'error';
      this.updateStatusUI();
      if (!options.silent) {
        alert("⚠️ Gagal menarik data dari Google Sheets. Aplikasi tetap menggunakan data lokal.");
      }
    }
  },

  // Push Local Data Snapshot to Google Sheets (POST action=syncAll)
  async pushToSheets() {
    const gasUrl = this.getGasUrl();
    if (!gasUrl) {
      alert("Harap masukkan URL Web App Google Apps Script terlebih dahulu!");
      return;
    }

    if (!confirm("Kirim seluruh data lokal (warga, transaksi, iuran, talangan, petugas, setoran) ke Google Sheets? Data di Spreadsheet akan disinkronkan.")) {
      return;
    }

    this.status = 'syncing';
    this.updateStatusUI();

    const localData = DB.load();
    if (localData.residents && Array.isArray(localData.residents)) {
      localData.residents.forEach(r => {
        if (!r.password) r.password = '123456';
      });
    }
    const payload = {
      action: 'syncAll',
      data: localData
    };

    try {
      const res = await fetch(gasUrl, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (json && json.status === 'success') {
        this.status = 'connected';
        this.lastSyncTime = new Date().toISOString();
        localStorage.setItem(this.STORAGE_KEY_LAST_SYNC, this.lastSyncTime);
        this.updateStatusUI();
        alert("🎉 Berhasil! Seluruh data warga, kas, dan iuran telah tersimpan di Google Sheets Anda.");
      } else {
        throw new Error(json.message || 'Gagal menyimpan ke Google Sheets');
      }
    } catch (err) {
      this.status = 'error';
      this.updateStatusUI();
      alert("❌ Terjadi kesalahan saat mengirim data ke Google Sheets: " + err.message);
    }
  },

  // =========================================================================
  // SINGLE-ENTITY DIRECT SYNC METHODS (Aman dari Konflik Antar Perangkat)
  // =========================================================================

  // Tambah / Update data warga langsung ke Google Sheets (sheet Warga)
  async saveResidentDirect(resident) {
    const gasUrl = this.getGasUrl();
    if (!gasUrl || !resident) return false;
    try {
      this.status = 'syncing';
      this.updateStatusUI();
      const res = await fetch(gasUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'saveResident', resident })
      });
      const json = await res.json();
      if (json && json.status === 'success') {
        // Jika server mengembalikan resident dengan URL Google Drive, update data lokal segera
        if (json.resident) {
          const currentLocal = DB.load();
          const rIdx = (currentLocal.residents || []).findIndex(r => r.id === json.resident.id);
          if (rIdx !== -1) {
            const preservedJumlah = Math.max(
              Number(currentLocal.residents[rIdx].jumlahAnggota) || 1,
              Number(json.resident.jumlahAnggota) || 1,
              (json.resident.familyMembers ? json.resident.familyMembers.length : 1)
            );
            currentLocal.residents[rIdx] = {
              ...currentLocal.residents[rIdx],
              ...json.resident,
              jumlahAnggota: preservedJumlah
            };
            DB.save(currentLocal, { skipSync: true });
            if (window.App) {
              window.App.data = currentLocal;
              if (typeof window.App.renderWargaProfile === 'function') window.App.renderWargaProfile();
              if (typeof window.App.renderResidents === 'function') window.App.renderResidents();
            }
          }
        }
        this.status = 'connected';
        this.lastSyncTime = new Date().toISOString();
        localStorage.setItem(this.STORAGE_KEY_LAST_SYNC, this.lastSyncTime);
        this.updateStatusUI();
        return true;
      }
    } catch (err) {
      console.warn("Direct save resident failed:", err);
    }
    return false;
  },

  // Hapus data warga langsung di Google Sheets
  async deleteResidentDirect(residentId) {
    const gasUrl = this.getGasUrl();
    if (!gasUrl || !residentId) return false;
    try {
      this.status = 'syncing';
      this.updateStatusUI();
      const res = await fetch(gasUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'deleteResident', residentId })
      });
      const json = await res.json();
      if (json && json.status === 'success') {
        this.status = 'connected';
        this.lastSyncTime = new Date().toISOString();
        localStorage.setItem(this.STORAGE_KEY_LAST_SYNC, this.lastSyncTime);
        this.updateStatusUI();
        return true;
      }
    } catch (err) {
      console.warn("Direct delete resident failed:", err);
    }
    return false;
  },

  // Tambah / Update data petugas penagih langsung ke Google Sheets (sheet Petugas)
  async saveCollectorDirect(collector) {
    const gasUrl = this.getGasUrl();
    if (!gasUrl || !collector) return false;
    try {
      this.status = 'syncing';
      this.updateStatusUI();
      const res = await fetch(gasUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'saveCollector', collector })
      });
      const json = await res.json();
      if (json && json.status === 'success') {
        this.status = 'connected';
        this.lastSyncTime = new Date().toISOString();
        localStorage.setItem(this.STORAGE_KEY_LAST_SYNC, this.lastSyncTime);
        this.updateStatusUI();
        return true;
      }
    } catch (err) {
      console.warn("Direct save collector failed:", err);
    }
    return false;
  },

  // Hapus data petugas penagih langsung di Google Sheets
  async deleteCollectorDirect(collectorId) {
    const gasUrl = this.getGasUrl();
    if (!gasUrl || !collectorId) return false;
    try {
      this.status = 'syncing';
      this.updateStatusUI();
      const res = await fetch(gasUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'deleteCollector', collectorId })
      });
      const json = await res.json();
      if (json && json.status === 'success') {
        this.status = 'connected';
        this.lastSyncTime = new Date().toISOString();
        localStorage.setItem(this.STORAGE_KEY_LAST_SYNC, this.lastSyncTime);
        this.updateStatusUI();
        return true;
      }
    } catch (err) {
      console.warn("Direct delete collector failed:", err);
    }
    return false;
  },

  // Tambah / Update setoran kas blok langsung ke Google Sheets (sheet Setoran)
  async saveSetoranDirect(setoran) {
    const gasUrl = this.getGasUrl();
    if (!gasUrl || !setoran) return false;
    try {
      this.status = 'syncing';
      this.updateStatusUI();
      const res = await fetch(gasUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'saveSetoran', setoran })
      });
      const json = await res.json();
      if (json && json.status === 'success') {
        this.status = 'connected';
        this.lastSyncTime = new Date().toISOString();
        localStorage.setItem(this.STORAGE_KEY_LAST_SYNC, this.lastSyncTime);
        this.updateStatusUI();
        return true;
      }
    } catch (err) {
      console.warn("Direct save setoran failed:", err);
    }
    return false;
  },

  // Upload file bebas atau foto bukti transfer langsung ke Google Drive
  async uploadFileToDrive(base64Data, fileName, folderName = 'Bukti Transfer Iuran') {
    const gasUrl = this.getGasUrl();
    if (!gasUrl || !base64Data) return null;
    try {
      this.status = 'syncing';
      this.updateStatusUI();
      const res = await fetch(gasUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'uploadFile',
          fileData: base64Data,
          fileName: fileName,
          folderName: folderName
        })
      });
      const json = await res.json();
      this.status = 'connected';
      this.updateStatusUI();
      if (json && json.status === 'success' && json.url) {
        return json.url;
      }
    } catch (err) {
      console.warn("Direct upload to Google Drive failed:", err);
      this.status = 'error';
      this.updateStatusUI();
    }
    return null;
  },

  // Tambah / Update transaksi kas masuk / keluar langsung ke Google Sheets & Google Drive
  async saveTransactionDirect(transaction) {
    const gasUrl = this.getGasUrl();
    if (!gasUrl || !transaction) return false;
    try {
      this.status = 'syncing';
      this.updateStatusUI();
      const res = await fetch(gasUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'addTransaction', transaction })
      });
      const json = await res.json();
      this.status = 'connected';
      this.lastSyncTime = new Date().toISOString();
      localStorage.setItem(this.STORAGE_KEY_LAST_SYNC, this.lastSyncTime);
      this.updateStatusUI();
      if (json && json.status === 'success') {
        return json.transaction || true;
      }
      return true;
    } catch (err) {
      console.warn("Direct save transaction failed:", err);
      this.status = 'error';
      this.updateStatusUI();
      return false;
    }
  },

  // Update status checklist iuran warga per bulan langsung ke Google Sheets (sheet Iuran)
  async updateDuesDirect(residentId, month, status) {
    const gasUrl = this.getGasUrl();
    if (!gasUrl || !residentId) return false;
    try {
      await fetch(gasUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'updateDues', residentId, month, status })
      });
      return true;
    } catch (err) {
      console.warn("Direct update dues failed:", err);
      return false;
    }
  }
};

window.CloudSync = CloudSync;

// Bootstrap bulletproof DOM ready
if (document.readyState !== 'loading') {
  CloudSync.init();
} else {
  document.addEventListener('DOMContentLoaded', () => {
    CloudSync.init();
  });
}
