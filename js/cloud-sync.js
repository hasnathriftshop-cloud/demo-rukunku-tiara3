/**
 * ============================================================================
 * RukunKu - Google Sheets & Cloud Sync Module (Dual-Database Edition)
 * Mendukung 2 Database Mandiri & Terpisah:
 * 1. Scope 'rt'     : Data Warga, Iuran 12 Bulan, Kas RT, Petugas Blok, Setoran
 * 2. Scope 'masjid' : Kas Masuk/Keluar Masjid Sabilillah, Kotak Amal, Inventaris Aset
 * ============================================================================
 */

const CloudSync = {
  // URL Web App Google Apps Script default lingkungan RT 05 / RW 02 Perum Tiara Candi 3
  DEFAULT_GAS_URL_RT: 'https://script.google.com/macros/s/AKfycbxN-hWB9wZLcKLuUEA2dXX2D23DPrTHPYYkJwmmViq2EdFbwvg0KYEXvAUQFL1FU6JW6w/exec',
  DEFAULT_GAS_URL_MASJID: 'https://script.google.com/macros/s/AKfycbw1GcSR545yTDc-tM71kukD3sa0_hMmbJ87kQ_wnSg9K7irKLffC6NOZKx4Beu33n3G/exec', // Dikosongkan default, diisi pengurus saat deploy Code_Masjid.gs
  
  // Storage Keys Terpisah
  STORAGE_KEY_URL_RT: 'rukunku_gas_url',
  STORAGE_KEY_URL_MASJID: 'rukunku_masjid_gas_url',
  STORAGE_KEY_LAST_SYNC_RT: 'rukunku_last_sync_time',
  STORAGE_KEY_LAST_SYNC_MASJID: 'rukunku_masjid_last_sync_time',

  // Alias Kompatibilitas Legacy
  STORAGE_KEY_URL: 'rukunku_gas_url',
  STORAGE_KEY_LAST_SYNC: 'rukunku_last_sync_time',
  DEFAULT_GAS_URL: 'https://script.google.com/macros/s/AKfycbwCPlpqo5DMqRgnz1QCksWw6M3tBPwCU0-LX0iDZnZcluMN6CDo6C6qRCSOdJIfFXFJYg/exec',

  currentScope: null, // 'rt' | 'masjid' (null = otomatis deteksi role aktif)
  status: {
    rt: 'disconnected', // 'disconnected' | 'connected' | 'syncing' | 'error'
    masjid: 'disconnected'
  },
  lastSyncTime: {
    rt: null,
    masjid: null
  },
  hasPulledOnce: {
    rt: false,
    masjid: false
  },
  debounceTimer: null,
  lastPullTimestamp: {
    rt: 0,
    masjid: 0
  },

  init() {
    this.lastSyncTime.rt = localStorage.getItem(this.STORAGE_KEY_LAST_SYNC_RT) || null;
    this.lastSyncTime.masjid = localStorage.getItem(this.STORAGE_KEY_LAST_SYNC_MASJID) || null;

    // Inisialisasi status awal berdasarkan keberadaan URL yang tersimpan
    this.status.rt = this.getGasUrl('rt') ? 'connected' : 'disconnected';
    this.status.masjid = this.getGasUrl('masjid') ? 'connected' : 'disconnected';

    this.updateStatusUI();

    // Auto-pull update awal dari cloud database sesuai scope aktif saat startup
    const activeScope = this.getActiveScope();
    if (this.getGasUrl(activeScope)) {
      this.pullFromSheets({ silent: true }, activeScope);
    }
    // Jika scope bukan masjid (misal warga) dan database masjid terkonfigurasi, tarik juga data kas masjid untuk transparansi warga
    if (activeScope !== 'masjid' && this.getGasUrl('masjid')) {
      this.pullFromSheets({ silent: true }, 'masjid');
    }

    // Auto-refresh data saat user kembali membuka tab browser RukunKu
    window.addEventListener('focus', () => {
      const sc = this.getActiveScope();
      if (this.getGasUrl(sc) && Date.now() - (this.lastPullTimestamp[sc] || 0) > 5000 && this.status[sc] !== 'syncing') {
        this.pullFromSheets({ silent: true }, sc);
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        const sc = this.getActiveScope();
        if (this.getGasUrl(sc) && Date.now() - (this.lastPullTimestamp[sc] || 0) > 5000 && this.status[sc] !== 'syncing') {
          this.pullFromSheets({ silent: true }, sc);
        }
      }
    });

    // Smart Background Polling: cek data baru dari Google Sheets setiap 25 detik saat tab aktif
    setInterval(() => {
      if (document.visibilityState === 'visible') {
        const sc = this.getActiveScope();
        if (this.getGasUrl(sc) && this.status[sc] !== 'syncing' && Date.now() - (this.lastPullTimestamp[sc] || 0) > 20000) {
          this.pullFromSheets({ silent: true }, sc);
        }
      }
    }, 25000);
  },

  // Deteksi Scope Aktif ('rt' vs 'masjid')
  getActiveScope() {
    if (this.currentScope) return this.currentScope;
    if (window.AppState && window.AppState.currentRole === 'admin_masjid') {
      return 'masjid';
    }
    return 'rt';
  },

  // Dapatkan URL Web App Apps Script berdasarkan Scope
  getGasUrl(scope) {
    const targetScope = scope || this.getActiveScope();
    if (targetScope === 'masjid') {
      return localStorage.getItem(this.STORAGE_KEY_URL_MASJID) || this.DEFAULT_GAS_URL_MASJID || '';
    }
    return localStorage.getItem(this.STORAGE_KEY_URL_RT) || this.DEFAULT_GAS_URL_RT || '';
  },

  // Simpan URL Web App Apps Script ke LocalStorage berdasarkan Scope
  setGasUrl(url, scope) {
    const targetScope = scope || this.getActiveScope();
    const cleanUrl = (url || '').trim();
    const storageKey = targetScope === 'masjid' ? this.STORAGE_KEY_URL_MASJID : this.STORAGE_KEY_URL_RT;
    if (cleanUrl) {
      localStorage.setItem(storageKey, cleanUrl);
      this.status[targetScope] = 'connected';
    } else {
      localStorage.removeItem(storageKey);
      this.status[targetScope] = 'disconnected';
    }
    this.updateStatusUI();
  },

  getLastSyncTime(scope) {
    const targetScope = scope || this.getActiveScope();
    const storageKey = targetScope === 'masjid' ? this.STORAGE_KEY_LAST_SYNC_MASJID : this.STORAGE_KEY_LAST_SYNC_RT;
    return localStorage.getItem(storageKey) || this.lastSyncTime[targetScope] || null;
  },

  setLastSyncTime(isoString, scope) {
    const targetScope = scope || this.getActiveScope();
    const storageKey = targetScope === 'masjid' ? this.STORAGE_KEY_LAST_SYNC_MASJID : this.STORAGE_KEY_LAST_SYNC_RT;
    if (isoString) {
      localStorage.setItem(storageKey, isoString);
      this.lastSyncTime[targetScope] = isoString;
    } else {
      localStorage.removeItem(storageKey);
      this.lastSyncTime[targetScope] = null;
    }
  },

  // Buka Modal Sinkronisasi dengan Tab Scope yang Sesuai
  openSyncModal(scope = null) {
    const targetScope = scope || (window.AppState && window.AppState.currentRole === 'admin_masjid' ? 'masjid' : 'rt');
    this.currentScope = targetScope;
    this.switchScopeUI(targetScope);
    if (window.App && typeof window.App.openModal === 'function') {
      window.App.openModal('modalCloudSync');
    }
  },

  // Beralih Tampilan Tab Scope di dalam Modal
  switchScopeUI(scope) {
    this.currentScope = scope;
    const btnRt = document.getElementById('btnCloudScopeRt');
    const btnMasjid = document.getElementById('btnCloudScopeMasjid');
    const inputGasUrl = document.getElementById('inputGasUrl');
    const scopeDesc = document.getElementById('modalCloudScopeDesc');
    const guideName = document.getElementById('modalCloudGuideName');
    const modalTitle = document.getElementById('modalCloudTitle');

    if (btnRt && btnMasjid) {
      if (scope === 'masjid') {
        btnMasjid.classList.add('active');
        btnMasjid.style.background = '#059669';
        btnMasjid.style.color = '#ffffff';
        btnMasjid.style.borderColor = '#059669';

        btnRt.classList.remove('active');
        btnRt.style.background = '#ffffff';
        btnRt.style.color = '#64748b';
        btnRt.style.borderColor = '#cbd5e1';
      } else {
        btnRt.classList.add('active');
        btnRt.style.background = '#0f766e';
        btnRt.style.color = '#ffffff';
        btnRt.style.borderColor = '#0f766e';

        btnMasjid.classList.remove('active');
        btnMasjid.style.background = '#ffffff';
        btnMasjid.style.color = '#64748b';
        btnMasjid.style.borderColor = '#cbd5e1';
      }
    }

    if (inputGasUrl) {
      inputGasUrl.value = this.getGasUrl(scope);
    }

    if (scope === 'masjid') {
      if (modalTitle) modalTitle.innerHTML = '<span>🕌 Cloud Database: Masjid Sabilillah</span>';
      if (scopeDesc) {
        scopeDesc.innerHTML = `
          Hubungkan pembukuan <strong>Masjid Sabilillah</strong> ke spreadsheet terpisah. Data kas masuk, infaq Jumat, kotak ahad, pengeluaran takmir, dan inventaris aset tersimpan aman di Google Sheets khusus DKM tanpa membebani data warga RT.
        `;
      }
      if (guideName) {
        guideName.innerHTML = `
          Salin isi kode dari file <code>google-apps-script/Code_Masjid.gs</code> ke Apps Script spreadsheet khusus masjid Anda.
        `;
      }
    } else {
      if (modalTitle) modalTitle.innerHTML = '<span>🏢 Cloud Database: Lingkungan RT</span>';
      if (scopeDesc) {
        scopeDesc.innerHTML = `
          Hubungkan administrasi <strong>Lingkungan RT</strong> ke spreadsheet terpisah. Data kependudukan warga, matriks iuran 12 bulan, buku kas RT, akun petugas penagih blok, dan setoran kas tersimpan otomatis di Google Drive pengurus.
        `;
      }
      if (guideName) {
        guideName.innerHTML = `
          Salin isi kode dari file <code>google-apps-script/Code_RT.gs</code> ke Apps Script spreadsheet khusus lingkungan RT Anda.
        `;
      }
    }

    this.updateStatusUI();
  },

  // Update Status Pill in Header and Modal
  updateStatusUI() {
    const isMasjidRole = window.AppState && window.AppState.currentRole === 'admin_masjid';
    const headerScope = isMasjidRole ? 'masjid' : 'rt';
    const headerGasUrl = this.getGasUrl(headerScope);
    const headerStatus = this.status[headerScope] || 'disconnected';

    // 1. Header Pill Update
    const cloudPill = document.getElementById('cloudSyncPill');
    const cloudDot = document.getElementById('cloudSyncDot');
    const cloudText = document.getElementById('cloudSyncText');

    if (cloudPill) {
      if (!headerGasUrl) {
        if (cloudDot) cloudDot.style.background = '#94a3b8';
        if (cloudText) cloudText.textContent = isMasjidRole ? 'Kas Masjid: DB Lokal' : 'Mode: Database Lokal';
        cloudPill.title = isMasjidRole
          ? 'Database Masjid belum terhubung ke Google Sheets. Klik untuk mengonfigurasi.'
          : 'Database RT belum terhubung ke Google Sheets. Klik untuk mengonfigurasi.';
      } else if (headerStatus === 'syncing') {
        if (cloudDot) cloudDot.style.background = '#f59e0b';
        if (cloudText) cloudText.textContent = isMasjidRole ? 'Menyinkronkan Masjid...' : 'Menyinkronkan RT...';
        cloudPill.title = 'Sedang menyinkronkan data dengan Google Sheets...';
      } else if (headerStatus === 'connected') {
        if (cloudDot) cloudDot.style.background = isMasjidRole ? '#059669' : '#10b981';
        if (cloudText) cloudText.textContent = isMasjidRole ? 'Cloud Kas Masjid Aktif' : 'Google Sheet Terhubung';
        cloudPill.title = isMasjidRole
          ? 'Terhubung ke Google Sheets Masjid Sabilillah. Klik untuk detail / sync manual.'
          : 'Terhubung ke Google Sheets Lingkungan RT. Klik untuk detail / sync manual.';
      } else if (headerStatus === 'error') {
        if (cloudDot) cloudDot.style.background = '#ef4444';
        if (cloudText) cloudText.textContent = isMasjidRole ? 'Sync Masjid Gagal' : 'Sync RT Gagal';
        cloudPill.title = 'Gagal berkomunikasi dengan Google Sheets. Periksa URL Anda.';
      }
    }

    // 2. Modal Status Box Update (Sesuai tab scope yang sedang dilihat di modal)
    const modalScope = this.getActiveScope();
    const modalGasUrl = this.getGasUrl(modalScope);
    const modalStatus = this.status[modalScope] || 'disconnected';
    const modalStatusBox = document.getElementById('modalCloudStatus');
    const lastSyncEl = document.getElementById('cloudLastSyncText');
    const lastSyncVal = this.getLastSyncTime(modalScope);

    if (modalStatusBox) {
      const scopeBadgeName = modalScope === 'masjid' ? 'Masjid Sabilillah' : 'Lingkungan RT';
      if (!modalGasUrl) {
        modalStatusBox.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 14px;">
            <div style="display: flex; align-items: center; gap: 10px; color: #64748b; font-size: 13px;">
              <span style="width: 10px; height: 10px; border-radius: 50%; background: #94a3b8; display: inline-block;"></span>
              <span>Database Lokal (${scopeBadgeName}) &mdash; Data tersimpan di memori browser ini.</span>
            </div>
            <span style="font-size: 11px; color: #94a3b8; font-weight: 600;">Offline / Lokal</span>
          </div>
        `;
      } else if (modalStatus === 'syncing') {
        modalStatusBox.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 10px 14px;">
            <div style="display: flex; align-items: center; gap: 10px; color: #92400e; font-weight: 600; font-size: 13px;">
              <span style="width: 10px; height: 10px; border-radius: 50%; background: #f59e0b; display: inline-block; animation: pulse 1.5s infinite;"></span>
              <span>Menyinkronkan data ${scopeBadgeName} dengan Google Sheets...</span>
            </div>
            <span style="font-size: 11px; color: #d97706; font-weight: 600;">Syncing</span>
          </div>
        `;
      } else if (modalStatus === 'connected') {
        modalStatusBox.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 10px 14px;">
            <div style="display: flex; align-items: center; gap: 10px; color: #065f46; font-weight: 600; font-size: 13px;">
              <span style="width: 10px; height: 10px; border-radius: 50%; background: #10b981; display: inline-block;"></span>
              <span>Cloud Google Sheets (${scopeBadgeName}) Terhubung & Aktif</span>
            </div>
            <span style="font-size: 11px; color: #047857; font-weight: 700; background: #d1fae5; padding: 2px 8px; border-radius: 999px;">Online</span>
          </div>
        `;
      } else if (modalStatus === 'error') {
        modalStatusBox.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 10px 14px;">
            <div style="display: flex; align-items: center; gap: 10px; color: #991b1b; font-weight: 600; font-size: 13px;">
              <span style="width: 10px; height: 10px; border-radius: 50%; background: #ef4444; display: inline-block;"></span>
              <span>Gagal Terhubung ke Cloud ${scopeBadgeName}</span>
            </div>
            <span style="font-size: 11px; color: #b91c1c; font-weight: 600;">Error</span>
          </div>
        `;
      }
    }

    if (lastSyncEl) {
      if (lastSyncVal) {
        lastSyncEl.textContent = `Sinkron terakhir: ${new Date(lastSyncVal).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
      } else {
        lastSyncEl.textContent = 'Belum pernah disinkronkan';
      }
    }
  },

  // Test Connection untuk Scope Tertentu
  async testConnection(url, scope = null) {
    const targetScope = scope || this.getActiveScope();
    const targetUrl = (url || this.getGasUrl(targetScope)).trim();
    if (!targetUrl) {
      alert("Masukkan URL Web App Google Apps Script terlebih dahulu!");
      return false;
    }

    this.status[targetScope] = 'syncing';
    this.updateStatusUI();

    try {
      const pingUrl = targetUrl + (targetUrl.includes('?') ? '&' : '?') + 'action=ping&t=' + Date.now();
      const res = await fetch(pingUrl, { method: 'GET', mode: 'cors' });
      const data = await res.json();

      if (data && data.status === 'success') {
        this.status[targetScope] = 'connected';
        this.setGasUrl(targetUrl, targetScope);
        this.updateStatusUI();
        const scopeLabel = targetScope === 'masjid' ? 'Masjid Sabilillah' : 'Lingkungan RT';
        alert(`✅ Koneksi Berhasil!\n\nGoogle Apps Script untuk ${scopeLabel} aktif dan siap digunakan sebagai database online.`);
        return true;
      } else {
        throw new Error(data.message || 'Respons tidak valid dari server');
      }
    } catch (err) {
      this.status[targetScope] = 'error';
      this.updateStatusUI();
      const scopeLabel = targetScope === 'masjid' ? 'Masjid' : 'RT';
      alert(`❌ Gagal terhubung ke Google Apps Script (${scopeLabel}).\n\nPastikan:\n1. URL berakhiran /exec\n2. Saat Deploy, akses diatur ke 'Anyone'\n\nPesan error: ` + err.message);
      return false;
    }
  },

  // Pull Data from Google Sheets (GET action=getData) sesuai Scope
  async pullFromSheets(options = {}, scope = null) {
    const targetScope = scope || this.getActiveScope();
    const gasUrl = this.getGasUrl(targetScope);
    if (!gasUrl) return false;

    this.lastPullTimestamp[targetScope] = Date.now();
    this.status[targetScope] = 'syncing';
    this.updateStatusUI();

    try {
      const getUrl = gasUrl + (gasUrl.includes('?') ? '&' : '?') + 'action=getData&t=' + Date.now();
      const res = await fetch(getUrl, { method: 'GET', mode: 'cors' });
      const json = await res.json();

      if (json && json.status === 'success' && json.data) {
        const cloudData = json.data;
        const currentLocal = DB.load();

        if (targetScope === 'masjid') {
          // =================================================================
          // MERGE KHUSUS MASJID: Tidak menyentuh data kependudukan RT sama sekali
          // =================================================================
          const merged = {
            ...currentLocal,
            masjidSettings: cloudData.masjidSettings || currentLocal.masjidSettings,
            masjidAdmin: cloudData.masjidAdmin || currentLocal.masjidAdmin,
            masjidTransactions: Array.isArray(cloudData.masjidTransactions) ? cloudData.masjidTransactions : (currentLocal.masjidTransactions || []),
            masjidAssets: Array.isArray(cloudData.masjidAssets) ? cloudData.masjidAssets : (currentLocal.masjidAssets || [])
          };

          DB.save(merged, { skipSync: true });
          this.hasPulledOnce.masjid = true;
          this.status.masjid = 'connected';
          this.setLastSyncTime(new Date().toISOString(), 'masjid');

          if (window.App) {
            window.App.data = merged;
            if (typeof window.App.renderMasjidDashboard === 'function') window.App.renderMasjidDashboard();
            if (typeof window.App.renderMasjidKas === 'function') window.App.renderMasjidKas();
            if (typeof window.App.renderMasjidAset === 'function') window.App.renderMasjidAset();
            if (typeof window.App.renderMasjidLaporan === 'function') window.App.renderMasjidLaporan();
            if (typeof window.App.renderWargaMasjidTransparansi === 'function') window.App.renderWargaMasjidTransparansi();
          }

          this.updateStatusUI();
          if (!options.silent) {
            alert("✅ Data kas & inventaris aset Masjid Sabilillah berhasil ditarik dan diperbarui dari Google Sheets!");
          }
          return true;
        }

        // ===================================================================
        // MERGE KHUSUS LINGKUNGAN RT:
        // ===================================================================
        const hasCloudResidents = Array.isArray(cloudData.residents) && cloudData.residents.length > 0;
        const residentsToUse = hasCloudResidents
          ? cloudData.residents.map(cr => {
              const localMatch = (currentLocal.residents || []).find(lr => lr.id === cr.id);
              const mergedFamily = (cr.familyMembers || []).map((cfm, idx) => {
                const lfm = (localMatch && localMatch.familyMembers)
                  ? (localMatch.familyMembers.find(m => m.id === cfm.id) || localMatch.familyMembers[idx])
                  : null;
                return {
                  ...cfm,
                  fotoKtp: cfm.fotoKtp || (lfm && lfm.fotoKtp ? lfm.fotoKtp : '')
                };
              });

              let finalFamily = mergedFamily.length > 0 ? mergedFamily : (cr.familyMembers || []);
              if (localMatch && Array.isArray(localMatch.familyMembers) && localMatch.familyMembers.length > finalFamily.length) {
                finalFamily = localMatch.familyMembers;
              }

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

        let cleanCategories = currentLocal.categories;
        if (cloudData.categories && typeof cloudData.categories === 'object') {
          cleanCategories = {
            masuk: Array.isArray(cloudData.categories.masuk) ? cloudData.categories.masuk : (currentLocal.categories?.masuk || []),
            keluar: Array.isArray(cloudData.categories.keluar) ? cloudData.categories.keluar : (currentLocal.categories?.keluar || [])
          };
        }

        const isMasjidTxFn = (t) => {
          if (!t) return false;
          const id = String(t.id || '').toUpperCase();
          if (id.startsWith('MSJ-') || id.startsWith('MSJ_')) return true;
          if (t.kantong && String(t.kantong).trim() !== '') return true;
          const kat = String(t.kategori || '').toLowerCase();
          const jud = String(t.judul || t.uraian || '').toLowerCase();
          const kw = ['kotak amal', 'jariyah', 'infaq', 'infak', 'wakaf', 'marbot', 'muazin', 'masjid', 'zis', 'zakat', 'dkm', 'phbi'];
          return kw.some(k => kat.includes(k) || jud.includes(k));
        };

        const rawTxs = Array.isArray(cloudData.transactions) ? cloudData.transactions : (currentLocal.transactions || []);
        const rtOnlyTxs = [];
        const extraMasjidTxs = [];

        rawTxs.forEach(t => {
          if (isMasjidTxFn(t)) {
            extraMasjidTxs.push(t);
          } else {
            rtOnlyTxs.push(t);
          }
        });

        if (cleanCategories) {
          ['masuk', 'keluar'].forEach(catType => {
            if (Array.isArray(cleanCategories[catType])) {
              cleanCategories[catType] = cleanCategories[catType].filter(c => {
                const lower = String(c || '').toLowerCase();
                return !['kotak amal', 'jariyah', 'infaq', 'infak', 'wakaf', 'marbot', 'muazin', 'masjid', 'zis', 'zakat'].some(kw => lower.includes(kw));
              });
            }
          });
        }

        const currentMasjidTxs = Array.isArray(currentLocal.masjidTransactions) ? [...currentLocal.masjidTransactions] : [];
        extraMasjidTxs.forEach(t => {
          const exists = currentMasjidTxs.some(m => 
            (m.id && t.id && String(m.id) === String(t.id)) ||
            (m.tanggal === t.tanggal && Number(m.nominal) === Number(t.nominal) && (m.uraian === t.judul || m.uraian === t.uraian))
          );
          if (!exists) {
            currentMasjidTxs.unshift({
              id: (t.id && String(t.id).startsWith('MSJ-')) ? t.id : `MSJ-${(t.tanggal || '').replace(/-/g, '')}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
              tanggal: t.tanggal || new Date().toISOString().slice(0, 10),
              tipe: t.tipe || 'masuk',
              kantong: t.kantong || 'Kas Umum',
              kategori: t.kategori || 'Lainnya',
              uraian: t.judul || t.uraian || 'Kas Masjid',
              pihak: t.pihak || (t.tipe === 'keluar' ? 'DKM' : 'Hamba Allah'),
              nominal: Number(t.nominal) || 0,
              metode: t.metode || 'Tunai',
              keterangan: t.keterangan || ''
            });
          }
        });

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
          transactions: rtOnlyTxs,
          duesMatrix: cloudData.duesMatrix || currentLocal.duesMatrix,
          talangan: Array.isArray(cloudData.talangan) ? cloudData.talangan : (currentLocal.talangan || []),
          collectors: cleanCollectors,
          setoranBlok: Array.isArray(cloudData.setoranBlok) ? cloudData.setoranBlok : (currentLocal.setoranBlok || []),
          // Data masjid selalu dipastikan terjaga utuh dari currentLocal (tidak tertimpa oleh sync RT)
          masjidSettings: currentLocal.masjidSettings || {},
          masjidAdmin: currentLocal.masjidAdmin || {},
          masjidTransactions: currentMasjidTxs,
          masjidAssets: Array.isArray(currentLocal.masjidAssets) ? currentLocal.masjidAssets : []
        };

        DB.save(merged, { skipSync: true });
        this.hasPulledOnce.rt = true;
        this.status.rt = 'connected';
        this.setLastSyncTime(new Date().toISOString(), 'rt');

        if (window.App) {
          window.App.data = merged;
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
            } catch (renderErr) {
              console.warn("[CloudSync] Background render error:", renderErr);
            }
          } else {
            try {
              if (typeof window.App.updateSettingsUI === 'function') window.App.updateSettingsUI();
              if (typeof window.App.renderBlockOptions === 'function') window.App.renderBlockOptions();
            } catch (e) {}
          }
        }

        this.updateStatusUI();
        if (!options.silent) {
          alert("✅ Data warga & kas RT berhasil ditarik dan diperbarui dari Google Sheets!");
        }
        return true;
      } else {
        throw new Error(json.message || 'Gagal memuat data dari cloud');
      }
    } catch (err) {
      console.warn(`Gagal sinkronisasi dari Google Sheets (${targetScope}):`, err);
      this.status[targetScope] = 'error';
      this.updateStatusUI();
      if (!options.silent) {
        const scopeLabel = targetScope === 'masjid' ? 'Masjid' : 'RT';
        alert(`⚠️ Gagal menarik data dari Google Sheets (${scopeLabel}). Aplikasi tetap menggunakan data lokal.`);
      }
      return false;
    }
  },

  // Push Snapshot Data ke Google Sheets (POST action=syncAll) sesuai Scope
  async pushToSheets(scope = null) {
    const targetScope = scope || this.getActiveScope();
    const gasUrl = this.getGasUrl(targetScope);
    if (!gasUrl) {
      alert("Harap masukkan URL Web App Google Apps Script terlebih dahulu!");
      return;
    }

    if (targetScope === 'masjid') {
      if (!confirm("Kirim seluruh data kas & inventaris aset Masjid Sabilillah ke Google Sheets Masjid? Data di sheet Masjid_Kas, Masjid_Aset, dan Pengaturan_Masjid akan disinkronkan.")) {
        return;
      }

      this.status.masjid = 'syncing';
      this.updateStatusUI();

      const localData = DB.load();
      const payload = {
        action: 'syncAll',
        data: {
          masjidSettings: localData.masjidSettings || {},
          masjidAdmin: localData.masjidAdmin || {},
          masjidTransactions: localData.masjidTransactions || [],
          masjidAssets: localData.masjidAssets || []
        }
      };

      try {
        const res = await fetch(gasUrl, {
          method: 'POST',
          mode: 'cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });

        const json = await res.json();
        if (json && json.status === 'success') {
          this.status.masjid = 'connected';
          this.setLastSyncTime(new Date().toISOString(), 'masjid');
          this.updateStatusUI();
          alert("🎉 Berhasil! Seluruh data kas dan inventaris Masjid Sabilillah telah tersimpan di Google Sheets Masjid Anda.");
        } else {
          throw new Error(json.message || 'Gagal menyimpan ke Google Sheets Masjid');
        }
      } catch (err) {
        this.status.masjid = 'error';
        this.updateStatusUI();
        alert("❌ Terjadi kesalahan saat mengirim data ke Google Sheets Masjid: " + err.message);
      }
      return;
    }

    // Push Scope RT:
    if (!confirm("Kirim seluruh data lingkungan RT (warga, transaksi, iuran, talangan, petugas, setoran) ke Google Sheets RT? Data di Spreadsheet RT akan disinkronkan.")) {
      return;
    }

    this.status.rt = 'syncing';
    this.updateStatusUI();

    const localData = DB.load();
    if (localData.residents && Array.isArray(localData.residents)) {
      localData.residents.forEach(r => {
        if (!r.password) r.password = '123456';
      });
    }

    const payload = {
      action: 'syncAll',
      data: {
        settings: localData.settings,
        blocks: localData.blocks,
        categories: localData.categories,
        residents: localData.residents,
        transactions: (localData.transactions || []).filter(t => !this.isMasjidTx(t)),
        duesMatrix: localData.duesMatrix,
        talangan: localData.talangan,
        collectors: localData.collectors,
        setoranBlok: localData.setoranBlok
      }
    };

    try {
      const res = await fetch(gasUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (json && json.status === 'success') {
        this.status.rt = 'connected';
        this.setLastSyncTime(new Date().toISOString(), 'rt');
        this.updateStatusUI();
        alert("🎉 Berhasil! Seluruh data warga, kas, dan iuran RT telah tersimpan di Google Sheets RT Anda.");
      } else {
        throw new Error(json.message || 'Gagal menyimpan ke Google Sheets RT');
      }
    } catch (err) {
      this.status.rt = 'error';
      this.updateStatusUI();
      alert("❌ Terjadi kesalahan saat mengirim data ke Google Sheets RT: " + err.message);
    }
  },

  // Immediate push snapshot ke Google Sheets sesuai scope aktif
  async syncNow(scope = null) {
    const targetScope = scope || this.getActiveScope();
    const gasUrl = this.getGasUrl(targetScope);
    if (!gasUrl) return;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    try {
      const localData = DB.load();
      let payloadData;

      if (targetScope === 'masjid') {
        payloadData = {
          masjidSettings: localData.masjidSettings || {},
          masjidAdmin: localData.masjidAdmin || {},
          masjidTransactions: localData.masjidTransactions || [],
          masjidAssets: localData.masjidAssets || []
        };
      } else {
        payloadData = {
          settings: localData.settings,
          blocks: localData.blocks,
          categories: localData.categories,
          residents: localData.residents,
          transactions: (localData.transactions || []).filter(t => !this.isMasjidTx(t)),
          duesMatrix: localData.duesMatrix,
          talangan: localData.talangan,
          collectors: localData.collectors,
          setoranBlok: localData.setoranBlok
        };
      }

      await fetch(gasUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'syncAll', data: payloadData })
      });
      this.status[targetScope] = 'connected';
      this.setLastSyncTime(new Date().toISOString(), targetScope);
      this.updateStatusUI();
    } catch (err) {
      console.warn(`Background immediate sync error (${targetScope}):`, err);
    }
  },

  // Debounced auto-sync saat data lokal berubah
  autoSyncBackground() {
    const targetScope = this.getActiveScope();
    const gasUrl = this.getGasUrl(targetScope);
    if (!gasUrl) return;

    // PENGAMAN: Jangan auto-sync jika pengunjung baru belum pernah menarik data dari Cloud
    const lastSync = this.getLastSyncTime(targetScope);
    if (!this.hasPulledOnce[targetScope] && !lastSync) {
      console.log(`[CloudSync] Auto-sync (${targetScope}) ditangguhkan sampai pull awal selesai.`);
      return;
    }

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(async () => {
      await this.syncNow(targetScope);
    }, 1200);
  },

  // =========================================================================
  // SINGLE-ENTITY DIRECT SYNC METHODS: LINGKUNGAN RT
  // =========================================================================

  // Tambah / Update data warga langsung ke Google Sheets RT (sheet Warga)
  async saveResidentDirect(resident) {
    const gasUrl = this.getGasUrl('rt');
    if (!gasUrl || !resident) return false;
    try {
      this.status.rt = 'syncing';
      this.updateStatusUI();
      const res = await fetch(gasUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'saveResident', resident })
      });
      const json = await res.json();
      if (json && json.status === 'success') {
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
        this.status.rt = 'connected';
        this.setLastSyncTime(new Date().toISOString(), 'rt');
        this.updateStatusUI();
        return true;
      }
    } catch (err) {
      console.warn("Direct save resident failed:", err);
    }
    return false;
  },

  // Hapus data warga langsung di Google Sheets RT
  async deleteResidentDirect(residentId) {
    const gasUrl = this.getGasUrl('rt');
    if (!gasUrl || !residentId) return false;
    try {
      this.status.rt = 'syncing';
      this.updateStatusUI();
      const res = await fetch(gasUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'deleteResident', residentId })
      });
      const json = await res.json();
      if (json && json.status === 'success') {
        this.status.rt = 'connected';
        this.setLastSyncTime(new Date().toISOString(), 'rt');
        this.updateStatusUI();
        return true;
      }
    } catch (err) {
      console.warn("Direct delete resident failed:", err);
    }
    return false;
  },

  // Tambah / Update data petugas penagih langsung ke Google Sheets RT (sheet Petugas)
  async saveCollectorDirect(collector) {
    const gasUrl = this.getGasUrl('rt');
    if (!gasUrl || !collector) return false;
    try {
      this.status.rt = 'syncing';
      this.updateStatusUI();
      const res = await fetch(gasUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'saveCollector', collector })
      });
      const json = await res.json();
      if (json && json.status === 'success') {
        this.status.rt = 'connected';
        this.setLastSyncTime(new Date().toISOString(), 'rt');
        this.updateStatusUI();
        return true;
      }
    } catch (err) {
      console.warn("Direct save collector failed:", err);
    }
    return false;
  },

  // Hapus data petugas penagih langsung di Google Sheets RT
  async deleteCollectorDirect(collectorId) {
    const gasUrl = this.getGasUrl('rt');
    if (!gasUrl || !collectorId) return false;
    try {
      this.status.rt = 'syncing';
      this.updateStatusUI();
      const res = await fetch(gasUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'deleteCollector', collectorId })
      });
      const json = await res.json();
      if (json && json.status === 'success') {
        this.status.rt = 'connected';
        this.setLastSyncTime(new Date().toISOString(), 'rt');
        this.updateStatusUI();
        return true;
      }
    } catch (err) {
      console.warn("Direct delete collector failed:", err);
    }
    return false;
  },

  // Tambah / Update setoran kas blok langsung ke Google Sheets RT (sheet Setoran)
  async saveSetoranDirect(setoran) {
    const gasUrl = this.getGasUrl('rt');
    if (!gasUrl || !setoran) return false;
    try {
      this.status.rt = 'syncing';
      this.updateStatusUI();
      const res = await fetch(gasUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'saveSetoran', setoran })
      });
      const json = await res.json();
      if (json && json.status === 'success') {
        this.status.rt = 'connected';
        this.setLastSyncTime(new Date().toISOString(), 'rt');
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
    const gasUrl = this.getGasUrl('rt');
    if (!gasUrl || !base64Data) return null;
    try {
      this.status.rt = 'syncing';
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
      this.status.rt = 'connected';
      this.updateStatusUI();
      if (json && json.status === 'success' && json.url) {
        return json.url;
      }
    } catch (err) {
      console.warn("Direct upload to Google Drive failed:", err);
      this.status.rt = 'error';
      this.updateStatusUI();
    }
    return null;
  },

  // Helper identifikasi transaksi masjid
  isMasjidTx(t) {
    if (!t) return false;
    if (window.App && typeof window.App.isMasjidTx === 'function') {
      return window.App.isMasjidTx(t);
    }
    const id = String(t.id || '').toUpperCase();
    if (id.startsWith('MSJ-') || id.startsWith('MSJ_')) return true;
    if (t.kantong && String(t.kantong).trim() !== '') return true;
    const kat = String(t.kategori || '').toLowerCase();
    const jud = String(t.judul || t.uraian || '').toLowerCase();
    const kw = ['kotak amal', 'jariyah', 'infaq', 'infak', 'wakaf', 'marbot', 'muazin', 'masjid', 'zis', 'zakat', 'dkm', 'phbi'];
    return kw.some(k => kat.includes(k) || jud.includes(k));
  },

  // Tambah transaksi kas masuk / keluar RT langsung ke Google Sheets RT
  async saveTransactionDirect(transaction) {
    if (this.isMasjidTx(transaction)) {
      return this.saveMasjidTransactionDirect(transaction);
    }
    const gasUrl = this.getGasUrl('rt');
    if (!gasUrl || !transaction) return false;
    try {
      this.status.rt = 'syncing';
      this.updateStatusUI();
      const res = await fetch(gasUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'addTransaction', transaction })
      });
      const json = await res.json();
      this.status.rt = 'connected';
      this.setLastSyncTime(new Date().toISOString(), 'rt');
      this.updateStatusUI();
      if (json && json.status === 'success') {
        return json.transaction || true;
      }
      return true;
    } catch (err) {
      console.warn("Direct save transaction RT failed:", err);
      this.status.rt = 'error';
      this.updateStatusUI();
      return false;
    }
  },

  // Update status checklist iuran warga per bulan langsung ke Google Sheets RT (sheet Iuran)
  async updateDuesDirect(residentId, month, status) {
    const gasUrl = this.getGasUrl('rt');
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
      console.warn("Direct update dues RT failed:", err);
      return false;
    }
  },

  // =========================================================================
  // SINGLE-ENTITY DIRECT SYNC METHODS: MASJID SABILILLAH
  // =========================================================================

  // Tambah transaksi kas masuk / keluar langsung ke Google Sheets Masjid
  async saveMasjidTransactionDirect(transaction) {
    const gasUrl = this.getGasUrl('masjid');
    if (!gasUrl || !transaction) return false;
    try {
      this.status.masjid = 'syncing';
      this.updateStatusUI();
      const res = await fetch(gasUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'addTransaction', transaction })
      });
      const json = await res.json();
      this.status.masjid = 'connected';
      this.setLastSyncTime(new Date().toISOString(), 'masjid');
      this.updateStatusUI();
      return json && json.status === 'success';
    } catch (err) {
      console.warn("Direct save masjid transaction failed:", err);
      this.status.masjid = 'error';
      this.updateStatusUI();
      return false;
    }
  },

  // Hapus transaksi kas masjid langsung di Google Sheets Masjid
  async deleteMasjidTransactionDirect(id) {
    const gasUrl = this.getGasUrl('masjid') || this.getGasUrl('rt');
    if (!gasUrl || !id) return false;
    try {
      this.status.masjid = 'syncing';
      this.updateStatusUI();
      const res = await fetch(gasUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'deleteMasjidTransaction', id })
      });
      const json = await res.json();
      this.status.masjid = 'connected';
      this.setLastSyncTime(new Date().toISOString(), 'masjid');
      this.updateStatusUI();
      return json && json.status === 'success';
    } catch (err) {
      console.warn("Direct delete masjid transaction failed:", err);
      return false;
    }
  },

  // Tambah / Edit aset inventaris masjid langsung ke Google Sheets Masjid
  async saveMasjidAssetDirect(asset) {
    const gasUrl = this.getGasUrl('masjid') || this.getGasUrl('rt');
    if (!gasUrl || !asset) return false;
    try {
      this.status.masjid = 'syncing';
      this.updateStatusUI();
      const res = await fetch(gasUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'saveMasjidAsset', asset })
      });
      const json = await res.json();
      this.status.masjid = 'connected';
      this.setLastSyncTime(new Date().toISOString(), 'masjid');
      this.updateStatusUI();
      return json && json.status === 'success';
    } catch (err) {
      console.warn("Direct save masjid asset failed:", err);
      return false;
    }
  },

  // Hapus aset inventaris masjid langsung di Google Sheets Masjid
  async deleteMasjidAssetDirect(id) {
    const gasUrl = this.getGasUrl('masjid') || this.getGasUrl('rt');
    if (!gasUrl || !id) return false;
    try {
      this.status.masjid = 'syncing';
      this.updateStatusUI();
      const res = await fetch(gasUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'deleteMasjidAsset', id })
      });
      const json = await res.json();
      this.status.masjid = 'connected';
      this.setLastSyncTime(new Date().toISOString(), 'masjid');
      this.updateStatusUI();
      return json && json.status === 'success';
    } catch (err) {
      console.warn("Direct delete masjid asset failed:", err);
      return false;
    }
  },

  // Kosongkan seluruh data kas & aset masjid di Google Sheets Masjid (Mulai dari Nol)
  async resetMasjidDataDirect() {
    const gasUrl = this.getGasUrl('masjid') || this.getGasUrl('rt');
    if (!gasUrl) return false;
    try {
      this.status.masjid = 'syncing';
      this.updateStatusUI();
      const res = await fetch(gasUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'resetMasjidData' })
      });
      const json = await res.json();
      this.status.masjid = 'connected';
      this.setLastSyncTime(new Date().toISOString(), 'masjid');
      this.updateStatusUI();
      return json && json.status === 'success';
    } catch (err) {
      console.warn("Direct reset masjid data failed:", err);
      return false;
    }
  }
};

window.CloudSync = CloudSync;

// Inisialisasi saat DOM siap
if (document.readyState !== 'loading') {
  CloudSync.init();
} else {
  document.addEventListener('DOMContentLoaded', () => {
    CloudSync.init();
  });
}
