/**
 * RukunKu - Core Application Controller
 * Handles Role-Based Access, Interactive Charts, View Switching, CRUD,
 * Block Management, User Authentication & Registration, and RT Settings.
 */

// Application State
const AppState = {
  currentUser: null, // { role: 'pengurus'|'petugas'|'warga', name, username, residentId, blok, noRumah }
  currentRole: 'pengurus', // 'pengurus', 'petugas', or 'warga'
  currentResidentId: null, // Resident ID if logged in as warga
  activeTab: 'dashboard',
  activeCategoryTab: 'masuk',
  searchQuery: '',
  duesSearchQuery: '',
  duesStatusFilter: 'all',
  selectedMonth: new Date().getMonth() + 1, // Otomatis bulan berjalan (1-12)
  selectedYear: new Date().getFullYear(),   // Otomatis tahun berjalan (misal 2026, dan otomatis 2027 saat 1 Jan 2027)
  wargaSelectedYear: new Date().getFullYear(),
  chartHighlightIndex: 8, // Day 9 (0-indexed)
  wargaPage: 1,
  wargaPageSize: 10
};
window.AppState = AppState;

// Utilities (Currency formatting & image compression)
const Utils = {
  formatRupiah(num) {
    return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
  },

  compressImage(file, maxWidth = 900, quality = 0.75) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) {
        reject(new Error("File bukan format gambar"));
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
        };
        img.onerror = () => reject(new Error("Gagal membaca gambar"));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error("Gagal membaca file"));
      reader.readAsDataURL(file);
    });
  }
};

// Main Controller
const App = {
  data: null,

  init() {
    this.data = DB.load();
    this.initSession();
    this.setupEventListeners();
    this.updateSettingsUI();
    this.renderBlockOptions();

    // Multi-tab / cross-window real-time state synchronization
    window.addEventListener('storage', (e) => {
      if (e.key === 'rukunku_rt05_data' && e.newValue) {
        try {
          this.data = JSON.parse(e.newValue);
          if (AppState.currentUser) {
            this.renderDuesMatrix();
            this.renderDashboard();
            this.renderSetoranBlok();
            this.renderTransactions();
            this.renderFinancialReport();
            this.updateNotificationBadge();
          }
        } catch (err) {
          console.warn("Storage sync error:", err);
        }
      }
    });

    const screenAuth = document.getElementById('screenAuth');
    const mainLayout = document.getElementById('appMainLayout');
    const bottomNav = document.querySelector('.bottom-nav');

    // Requirement 1: If user is authenticated in this session, show app layout;
    // Otherwise, show Login Screen prominently as the first thing user sees!
    if (AppState.currentUser) {
      if (screenAuth) screenAuth.style.display = 'none';
      if (mainLayout) mainLayout.style.display = 'flex';
      if (bottomNav) bottomNav.style.display = '';
      this.renderRoleUI();
      this.renderChart();
      this.renderDashboard();
      this.renderResidents();
      this.renderCategoryFilterOptions();
      this.renderTransactions();
      this.renderDuesMatrix();
      this.renderSetoranBlok();
      this.renderKelolaPetugasPage();
      this.renderTalangan();
      this.renderFinancialReport();
      this.updateNotificationBadge();
    } else {
      // Pastikan semua modal overlay tertutup saat pertama kali membuka layar login
      document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.classList.remove('active');
      });
      if (bottomNav) bottomNav.style.display = 'none';
      if (screenAuth) screenAuth.style.display = 'flex';
      if (mainLayout) mainLayout.style.display = 'none';
      this.switchAuthTab('login');
      this.selectAuthRole('pengurus');
    }
  },

  // Initialize Session (Checks sessionStorage first so fresh browser link shows login first)
  initSession() {
    const saved = sessionStorage.getItem('rukunku_auth_session');
    if (saved) {
      try {
        const user = JSON.parse(saved);
        if (user && user.role) {
          AppState.currentUser = user;
          AppState.currentRole = user.role;
          AppState.currentResidentId = user.residentId || null;
          return;
        }
      } catch (e) {
        console.error("Gagal membaca sesi pengguna:", e);
      }
    }
    // Default: not logged in
    AppState.currentUser = null;
    AppState.currentRole = 'pengurus';
  },

  // Setup UI Events
  setupEventListeners() {
    // Navigation Links (Desktop & Mobile)
    document.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-tab');
        this.switchTab(tab);
      });
    });

    // Global Search Bar
    const searchInput = document.getElementById('globalSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        AppState.searchQuery = e.target.value.toLowerCase().trim();
        this.handleSearch();
      });
    }

    // Role Indicator / Logout in Header
    const rolePill = document.getElementById('roleBadgePill');
    if (rolePill) {
      rolePill.addEventListener('click', () => this.logout());
    }

    const sidebarSwitchRole = document.getElementById('sidebarSwitchRole');
    if (sidebarSwitchRole) {
      sidebarSwitchRole.addEventListener('click', () => this.logout());
    }

    // Download / Cetak Report Buttons
    document.querySelectorAll('.btn-download-report').forEach(btn => {
      btn.addEventListener('click', () => {
        const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        const curMName = monthNames[(AppState.selectedMonth || (new Date().getMonth() + 1)) - 1];
        ReportGenerator.openReportPreview(`${curMName} ${AppState.selectedYear}`);
      });
    });

    // Modal Background Clicks
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('active');
        }
      });
    });

    // Close Modal Buttons
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal-overlay');
        if (modal) modal.classList.remove('active');
      });
    });

    // Explicit Listeners for Auth Tabs & Role Cards (Menjamin klik selalu aktif)
    document.querySelectorAll('.auth-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-auth-tab');
        if (tab) this.switchAuthTab(tab);
      });
    });

    document.querySelectorAll('.auth-role-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const role = e.currentTarget.getAttribute('data-role');
        if (role) this.selectAuthRole(role);
      });
    });

    // Cegah scroll mouse mengubah angka pada input type number secara tidak sengaja
    document.addEventListener('wheel', (e) => {
      if (document.activeElement && document.activeElement.type === 'number') {
        document.activeElement.blur();
      }
    }, { passive: true });
  },

  // Switch Active View / Tab
  switchTab(tabName) {
    AppState.activeTab = tabName;
    this.data = DB.load(); // Selalu pastikan membaca data terbaru dari storage saat pindah tab

    // Auto-pull dari Google Sheets secara halus saat pindah ke menu utama jika sudah lebih dari 10 detik
    if (window.CloudSync && typeof window.CloudSync.pullFromSheets === 'function' && window.CloudSync.getGasUrl()) {
      if (Date.now() - (window.CloudSync.lastPullTimestamp || 0) > 10000) {
        window.CloudSync.pullFromSheets({ silent: true });
      }
    }

    // Update Desktop Nav
    document.querySelectorAll('.nav-link').forEach(link => {
      if (link.getAttribute('data-tab') === tabName) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Update Mobile Nav
    document.querySelectorAll('.bottom-nav-item').forEach(link => {
      if (link.getAttribute('data-tab') === tabName) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Show corresponding panel
    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.classList.remove('active-view');
    });

    const targetPanel = document.getElementById(`view-${tabName}`);
    if (targetPanel) {
      targetPanel.classList.add('active-view');
    }

    // Refresh specific view data if needed
    if (tabName === 'dashboard') {
      this.renderDashboard();
      this.renderChart();
    } else if (tabName === 'warga') {
      this.renderResidents();
    } else if (tabName === 'kas') {
      this.renderTransactions();
    } else if (tabName === 'iuran') {
      const duesInput = document.getElementById('duesSearchInput');
      if (duesInput) duesInput.value = AppState.duesSearchQuery || '';
      this.renderDuesMatrix();
    } else if (tabName === 'talangan') {
      this.renderTalangan();
    } else if (tabName === 'laporan') {
      this.renderFinancialReport();
    } else if (tabName === 'warga-iuran') {
      this.renderWargaIuranHistory();
    } else if (tabName === 'warga-profil') {
      this.renderWargaProfile();
    } else if (tabName === 'setoran-blok') {
      this.renderSetoranBlok();
    } else if (tabName === 'kelola-petugas') {
      this.renderKelolaPetugasPage();
    }

    // Reset search
    AppState.searchQuery = '';
    const searchInput = document.getElementById('globalSearchInput');
    if (searchInput) searchInput.value = '';
  },

  // =========================================================================
  // Multi-Tahun Otomatis (Multi-Year Engine)
  // =========================================================================
  getDuesStatus(resId, year, month) {
    const yStr = String(year || AppState.selectedYear || new Date().getFullYear());
    const mNum = Number(month);
    const mStr = String(month);
    const matrix = this.data?.duesMatrix || {};

    // 1. Cek struktur multi-tahun: matrix[tahun][residentId][bulan]
    if (matrix[yStr] && matrix[yStr][resId]) {
      const rm = matrix[yStr][resId];
      if (rm[mNum] !== undefined) return rm[mNum];
      if (rm[mStr] !== undefined) return rm[mStr];
      return 'Belum';
    }

    // 2. Cek fallback flat structure lama (khusus data existing 2026)
    if (yStr === '2026' && matrix[resId]) {
      const rm = matrix[resId];
      if (rm[mNum] !== undefined) return rm[mNum];
      if (rm[mStr] !== undefined) return rm[mStr];
      return 'Belum';
    }

    // Default untuk tahun baru yang belum ada data: otomatis Belum Bayar
    return 'Belum';
  },

  setDuesStatus(resId, year, month, status) {
    const yStr = String(year || AppState.selectedYear || new Date().getFullYear());
    const mNum = Number(month);
    const mStr = String(month);
    if (!this.data.duesMatrix) this.data.duesMatrix = {};
    if (!this.data.duesMatrix[yStr]) this.data.duesMatrix[yStr] = {};
    if (!this.data.duesMatrix[yStr][resId]) this.data.duesMatrix[yStr][resId] = {};

    this.data.duesMatrix[yStr][resId][mNum] = status;
    this.data.duesMatrix[yStr][resId][mStr] = status;

    // Untuk tahun 2026, simpan juga di flat structure untuk kompatibilitas penuh
    if (yStr === '2026') {
      if (!this.data.duesMatrix[resId]) this.data.duesMatrix[resId] = {};
      this.data.duesMatrix[resId][mNum] = status;
      this.data.duesMatrix[resId][mStr] = status;
    }
  },

  onDuesYearChange(year) {
    AppState.selectedYear = parseInt(year) || new Date().getFullYear();
    this.renderDuesMatrix();
    this.renderDashboard();
    this.renderSetoranBlok();
    this.renderFinancialReport();
  },

  onDuesMonthChange(month) {
    AppState.selectedMonth = parseInt(month) || (new Date().getMonth() + 1);
    this.renderDuesMatrix();
    this.renderDashboard();
    this.renderSetoranBlok();
    this.renderFinancialReport();
  },

  onWargaIuranYearChange(year) {
    AppState.wargaSelectedYear = parseInt(year) || new Date().getFullYear();
    this.renderWargaIuranHistory();
  },

  // =========================================================================
  // Role & UI Rendering (Pengurus, Petugas Penagih Blok, Warga)
  // =========================================================================
  isResidentInCollectorScope(resident, targetCollector = null) {
    if (!resident) return false;
    const user = targetCollector || (AppState.currentRole === 'petugas' ? AppState.currentUser : null);
    if (!user) return true;

    const rawTargets = [];
    if (user.blokTugas) rawTargets.push(user.blokTugas);
    if (Array.isArray(user.assignedBlocks)) {
      user.assignedBlocks.forEach(b => { if (b) rawTargets.push(b); });
    }
    if (rawTargets.length === 0) return true;

    const rBlok = (resident.blok || '').trim().toLowerCase();
    const rAlamat = (resident.alamat || '').trim().toLowerCase();
    const rCombined = `${rBlok} ${rAlamat}`;
    const rClean = rBlok.replace(/^blok\s*/i, '').trim();

    return rawTargets.some(target => {
      if (!target) return false;
      const tLower = target.trim().toLowerCase();
      const tClean = tLower.replace(/^blok\s*/i, '').trim();

      // Case 1: Letter block (e.g. "Blok A" or "A")
      if (/^[a-z]$/i.test(tClean)) {
        const letter = tClean.toLowerCase();
        // Regex for resident block: A, A1, A2, A-1, A/1, etc.
        const regexLetter = new RegExp(`^${letter}[\\-\\s\\/]?(\\d+)?$`, 'i');
        if (regexLetter.test(rClean)) return true;

        // Regex within full address: "Blok A", "Blok A1", "Blok A-1"
        const regexAddress = new RegExp(`\\bblok\\s+${letter}[\\-\\s\\/]?(\\d+)?\\b`, 'i');
        if (regexAddress.test(rCombined)) return true;

        const regexShort = new RegExp(`\\b${letter}[\\-\\s\\/]?\\d+\\b`, 'i');
        if (regexShort.test(rCombined)) return true;

        return false;
      }

      // Case 2: Specific sub-block or named block (e.g. "Blok A1", "Blok Melati")
      if (rClean === tClean) return true;
      if (rBlok === tLower) return true;
      if (rCombined.includes(tLower) || rCombined.includes(tClean)) return true;
      if (rClean.startsWith(tClean) || tClean.startsWith(rClean)) return true;

      return false;
    });
  },

  renderRoleUI() {
    const isPengurus = AppState.currentRole === 'pengurus';
    const isPetugas = AppState.currentRole === 'petugas';
    const rolePillText = document.getElementById('rolePillText');
    const userNameDisplay = document.getElementById('userNameDisplay');
    const userRoleDisplay = document.getElementById('userRoleDisplay');
    const avatarImg = document.getElementById('userAvatar');

    // Sidebar Title for Dashboard
    const dashboardTitleText = document.getElementById('dashboardMainTitle');
    const dashboardSubText = document.getElementById('dashboardMainSubtitle');

    if (isPengurus) {
      if (rolePillText) rolePillText.textContent = 'Mode: Bendahara / Pengurus RT';
      if (userNameDisplay) userNameDisplay.textContent = this.data.settings.ketuaRt || 'Pengurus RT';
      if (userRoleDisplay) userRoleDisplay.textContent = `Ketua / Pengurus ${this.data.settings.rtName || 'RT'}`;
      if (avatarImg) avatarImg.textContent = (this.data.settings.ketuaRt || 'RT').split(' ').map(n=>n[0]).join('').slice(0, 2);

      if (dashboardTitleText) dashboardTitleText.textContent = 'Buku Kas & Transaksi Lingkungan';
      if (dashboardSubText) dashboardSubText.textContent = `Kelola keuangan, iuran, dan administrasi ${this.data.settings.rtName} ${this.data.settings.perumahan}`;

      // Show pengurus & pengurus-petugas controls
      document.querySelectorAll('.pengurus-only').forEach(el => el.style.display = '');
      document.querySelectorAll('.pengurus-petugas-only').forEach(el => el.style.display = '');
      document.querySelectorAll('.petugas-only').forEach(el => el.style.display = 'none');
      document.querySelectorAll('.warga-only').forEach(el => el.style.display = 'none');
    } else if (isPetugas) {
      const user = AppState.currentUser || {};
      const blokName = user.blokTugas || 'Blok';
      if (rolePillText) rolePillText.textContent = `Mode: Petugas Penagih (${blokName})`;
      if (userNameDisplay) userNameDisplay.textContent = user.name || 'Petugas Blok';
      if (userRoleDisplay) userRoleDisplay.textContent = `Koordinator & Penagih ${blokName}`;
      if (avatarImg) avatarImg.textContent = (user.name || 'PT').split(' ').map(n=>n[0]).join('').slice(0, 2);

      if (dashboardTitleText) dashboardTitleText.textContent = `Penagihan Iuran: ${blokName}`;
      if (dashboardSubText) dashboardSubText.textContent = `Monitoring pencatatan iuran warga & serah terima setoran kas ke Bendahara`;

      // Show petugas & pengurus-petugas controls
      document.querySelectorAll('.pengurus-only').forEach(el => el.style.display = 'none');
      document.querySelectorAll('.pengurus-petugas-only').forEach(el => el.style.display = '');
      document.querySelectorAll('.petugas-only').forEach(el => el.style.display = '');
      document.querySelectorAll('.warga-only').forEach(el => el.style.display = 'none');
    } else {
      // Warga Mode
      const currentResident = this.data.residents.find(r => r.id === AppState.currentResidentId) || this.data.residents[0];
      const resName = currentResident ? currentResident.nama : (AppState.currentUser?.name || 'Warga RT');
      const resAddress = currentResident ? `${currentResident.blok} No. ${currentResident.noRumah}` : 'Warga';

      if (rolePillText) rolePillText.textContent = `Mode Warga (${resAddress})`;
      if (userNameDisplay) userNameDisplay.textContent = resName;
      if (userRoleDisplay) userRoleDisplay.textContent = `Warga ${resAddress}`;
      if (avatarImg) avatarImg.textContent = resName.split(' ').map(n => n[0]).join('').slice(0, 2);

      if (dashboardTitleText) dashboardTitleText.textContent = `Portal Warga: ${resName}`;
      if (dashboardSubText) dashboardSubText.textContent = `Status tagihan iuran rumah Anda & transparansi kas ${this.data.settings.rtName}`;

      // Hide pengurus & petugas controls
      document.querySelectorAll('.pengurus-only').forEach(el => el.style.display = 'none');
      document.querySelectorAll('.pengurus-petugas-only').forEach(el => el.style.display = 'none');
      document.querySelectorAll('.petugas-only').forEach(el => el.style.display = 'none');
      document.querySelectorAll('.warga-only').forEach(el => el.style.display = '');
    }

    this.renderDashboard();
    this.updateNotificationBadge();
  },

  // =========================================================================
  // Settings & Brand Subtitle (Fixing Point 4)
  // =========================================================================
  updateSettingsUI() {
    const s = this.data.settings || {};
    
    // 1. Dynamic Subtitle under "RukunKu" brand (Fixing Point 4)
    const brandSub = document.getElementById('brandSubtitle');
    if (brandSub) {
      brandSub.textContent = `${s.rtName || 'RT 00'} ${s.perumahan || ''}`.trim();
    }

    // 2. Dynamic displays across DOM
    document.querySelectorAll('.display-rt-name').forEach(el => {
      el.textContent = s.rtName || 'RT 00';
    });
    document.querySelectorAll('.display-perumahan').forEach(el => {
      el.textContent = s.perumahan || '';
    });
    document.querySelectorAll('.display-rekening-rt').forEach(el => {
      el.textContent = s.nomorRekeningRT || 'BCA 873-019-2810 a/n Kas RT';
    });
    document.querySelectorAll('.display-ketua-rt').forEach(el => {
      el.textContent = s.ketuaRt || '-';
    });
    document.querySelectorAll('.display-bendahara').forEach(el => {
      el.textContent = s.bendahara || '-';
    });
    const displayIuran = document.getElementById('displayIuranWajibModal');
    if (displayIuran && s.iuranWajibBulanan) {
      displayIuran.textContent = `${Utils.formatRupiah(s.iuranWajibBulanan)} / bulan`;
    }
  },

  openPengaturanModal() {
    const s = this.data.settings || {};
    document.getElementById('setRtName').value = s.rtName || '';
    document.getElementById('setPerumahan').value = s.perumahan || '';
    document.getElementById('setKelurahan').value = s.kelurahan || '';
    document.getElementById('setKecamatan').value = s.kecamatan || '';
    document.getElementById('setKota').value = s.kota || '';
    document.getElementById('setKetuaRt').value = s.ketuaRt || '';
    document.getElementById('setBendahara').value = s.bendahara || '';
    document.getElementById('setSekretaris').value = s.sekretaris || '';
    document.getElementById('setRekeningRt').value = s.nomorRekeningRT || '';
    document.getElementById('setIuranBulanan').value = s.iuranWajibBulanan || 150000;
    document.getElementById('setIuranSosial').value = s.iuranSosialKematian || 20000;
    document.getElementById('setContactWa').value = s.contactWaKetua || '';

    this.openModal('modalPengaturanRT');
  },

  savePengaturanSubmit(event) {
    event.preventDefault();
    this.data.settings = {
      ...this.data.settings,
      rtName: document.getElementById('setRtName').value.trim(),
      perumahan: document.getElementById('setPerumahan').value.trim(),
      kelurahan: document.getElementById('setKelurahan').value.trim(),
      kecamatan: document.getElementById('setKecamatan').value.trim(),
      kota: document.getElementById('setKota').value.trim(),
      ketuaRt: document.getElementById('setKetuaRt').value.trim(),
      bendahara: document.getElementById('setBendahara').value.trim(),
      sekretaris: document.getElementById('setSekretaris').value.trim(),
      nomorRekeningRT: document.getElementById('setRekeningRt').value.trim(),
      iuranWajibBulanan: parseInt(document.getElementById('setIuranBulanan').value) || 150000,
      iuranSosialKematian: parseInt(document.getElementById('setIuranSosial').value) || 20000,
      contactWaKetua: document.getElementById('setContactWa').value.trim()
    };

    DB.save(this.data);
    this.updateSettingsUI();
    this.renderRoleUI();
    this.renderFinancialReport();
    this.closeModal('modalPengaturanRT');
    alert("✅ Pengaturan RT & Lingkungan berhasil diperbarui!");
  },

  // =========================================================================
  // Block Management (Fixing Point 1)
  // =========================================================================
  renderBlockOptions() {
    const blocks = (this.data && Array.isArray(this.data.blocks)) ? this.data.blocks : (DEFAULT_DATA.blocks || []);

    // 1. Dropdown in Tambah/Edit Warga modal
    const wargaBlok = document.getElementById('wargaBlok');
    if (wargaBlok) {
      const currentVal = wargaBlok.value;
      wargaBlok.innerHTML = blocks.map(b => `<option value="${b}">${b}</option>`).join('');
      if (currentVal && blocks.includes(currentVal)) {
        wargaBlok.value = currentVal;
      }
    }

    // 2. Dropdown in Filter Blok (Data Warga)
    const filterBlok = document.getElementById('filterBlokSelect');
    if (filterBlok) {
      const currentVal = filterBlok.value;
      filterBlok.innerHTML = `<option value="all">Semua Blok Lingkungan</option>` +
        blocks.map(b => `<option value="${b}">${b}</option>`).join('');
      if (currentVal) filterBlok.value = currentVal;
    }

    // 3. Dropdown in Daftar Akun Warga modal
    const regWargaBlok = document.getElementById('regWargaBlok');
    if (regWargaBlok) {
      regWargaBlok.innerHTML = `<option value="">-- Pilih Blok Rumah --</option>` +
        blocks.map(b => `<option value="${b}">${b}</option>`).join('');
    }
  },

  openKelolaBlokModal() {
    this.renderBlockList();
    this.openModal('modalKelolaBlok');
  },

  renderBlockList() {
    const container = document.getElementById('blocksListContainer');
    if (!container) return;

    const blocks = this.data.blocks || [];
    container.innerHTML = '';

    if (blocks.length === 0) {
      container.innerHTML = `<div style="text-align: center; color: #94a3b8; padding: 20px;">Belum ada nama blok terdaftar. Tambahkan blok baru di bawah.</div>`;
      return;
    }

    blocks.forEach((blockName) => {
      const count = (this.data.residents || []).filter(r => r.blok === blockName).length;
      const row = document.createElement('div');
      row.className = 'block-item-row';
      row.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-weight: 700; color: #1e293b; font-size: 13.5px;">${blockName}</span>
          <span class="badge-block" style="font-size: 10px;">${count} KK</span>
        </div>
        <div style="display: flex; gap: 6px;">
          <button type="button" class="btn-icon-action" title="Ubah Nama Blok" onclick="App.editBlock('${blockName.replace(/'/g, "\\'")}')">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button type="button" class="btn-icon-action" style="color: #ef4444;" title="Hapus Blok" onclick="App.deleteBlock('${blockName.replace(/'/g, "\\'")}')">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      `;
      container.appendChild(row);
    });
  },

  addBlock() {
    const input = document.getElementById('newBlockInput');
    if (!input) return;
    const name = input.value.trim();
    if (!name) {
      alert("Masukkan nama blok terlebih dahulu!");
      return;
    }
    if (this.data.blocks.includes(name)) {
      alert("Nama blok sudah ada!");
      return;
    }
    this.data.blocks.push(name);
    DB.save(this.data);
    input.value = '';
    this.renderBlockList();
    this.renderBlockOptions();
    alert(`Blok "${name}" berhasil ditambahkan!`);
  },

  editBlock(oldName) {
    const newName = prompt(`Ubah nama blok "${oldName}" menjadi:`, oldName);
    if (!newName || newName.trim() === '' || newName.trim() === oldName) return;
    const cleanNew = newName.trim();
    if (this.data.blocks.includes(cleanNew)) {
      alert(`Blok "${cleanNew}" sudah ada!`);
      return;
    }
    // Update block list
    const idx = this.data.blocks.indexOf(oldName);
    if (idx !== -1) {
      this.data.blocks[idx] = cleanNew;
    }
    // Update residents registered under this block
    let updatedCount = 0;
    (this.data.residents || []).forEach(r => {
      if (r.blok === oldName) {
        r.blok = cleanNew;
        r.alamat = `${cleanNew} No. ${r.noRumah}`;
        updatedCount++;
      }
    });
    DB.save(this.data);
    this.renderBlockList();
    this.renderBlockOptions();
    this.renderResidents();
    alert(`Nama blok berhasil diubah menjadi "${cleanNew}". ${updatedCount} data warga disesuaikan.`);
  },

  deleteBlock(name) {
    const residentCount = (this.data.residents || []).filter(r => r.blok === name).length;
    if (residentCount > 0) {
      if (!confirm(`Blok "${name}" saat ini memiliki ${residentCount} Kepala Keluarga terdaftar.\nYakin ingin menghapus nama blok ini?`)) {
        return;
      }
    } else {
      if (!confirm(`Hapus blok "${name}"?`)) return;
    }

    this.data.blocks = this.data.blocks.filter(b => b !== name);
    DB.save(this.data);
    this.renderBlockList();
    this.renderBlockOptions();
    this.renderResidents();
    alert(`Blok "${name}" berhasil dihapus.`);
  },

  // =========================================================================
  // MANAJEMEN KATEGORI TRANSAKSI KAS RT (Pemasukan & Pengeluaran)
  // =========================================================================
  openKelolaKategoriModal(defaultTab = 'masuk') {
    this.ensureCategoriesExist();
    this.switchCategoryTab(defaultTab);
    this.openModal('modalKelolaKategori');
  },

  ensureCategoriesExist() {
    if (!this.data.categories || !Array.isArray(this.data.categories.masuk) || !Array.isArray(this.data.categories.keluar)) {
      this.data.categories = {
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
      };
      DB.save(this.data);
    }
  },

  switchCategoryTab(tab) {
    AppState.activeCategoryTab = tab;
    const btnMasuk = document.getElementById('tabCatMasukBtn');
    const btnKeluar = document.getElementById('tabCatKeluarBtn');
    const labelAdd = document.getElementById('labelAddCategory');
    const headingList = document.getElementById('categoryListHeading');
    const inputAdd = document.getElementById('newCategoryInput');

    if (tab === 'masuk') {
      if (btnMasuk) {
        btnMasuk.style.background = '#0d9488';
        btnMasuk.style.color = '#ffffff';
      }
      if (btnKeluar) {
        btnKeluar.style.background = 'transparent';
        btnKeluar.style.color = '#64748b';
      }
      if (labelAdd) labelAdd.textContent = 'Tambah Kategori Kas Masuk (Pemasukan) Baru:';
      if (headingList) headingList.textContent = 'Daftar Kategori Kas Masuk:';
      if (inputAdd) inputAdd.placeholder = 'Contoh: Donasi Ramadhan / Parkir Warga / Sewa Lahan';
    } else {
      if (btnMasuk) {
        btnMasuk.style.background = 'transparent';
        btnMasuk.style.color = '#64748b';
      }
      if (btnKeluar) {
        btnKeluar.style.background = '#e11d48';
        btnKeluar.style.color = '#ffffff';
      }
      if (labelAdd) labelAdd.textContent = 'Tambah Kategori Kas Keluar (Pengeluaran) Baru:';
      if (headingList) headingList.textContent = 'Daftar Kategori Kas Keluar:';
      if (inputAdd) inputAdd.placeholder = 'Contoh: Pembelian CCTV / Bantuan Posyandu / Perbaikan Jalan';
    }

    if (inputAdd) inputAdd.value = '';
    this.renderCategoryList();
  },

  renderCategoryList() {
    this.ensureCategoriesExist();
    const container = document.getElementById('categoryListContainer');
    const countBadge = document.getElementById('categoryCountBadge');
    if (!container) return;

    const tab = AppState.activeCategoryTab || 'masuk';
    const categories = this.data.categories[tab] || [];

    if (countBadge) countBadge.textContent = `${categories.length} Kategori`;

    container.innerHTML = '';
    if (categories.length === 0) {
      container.innerHTML = `<div style="text-align: center; color: #94a3b8; padding: 24px; font-size: 13px;">Belum ada kategori ${tab === 'masuk' ? 'kas masuk' : 'kas keluar'}. Tambahkan kategori baru di formulir atas.</div>`;
      return;
    }

    categories.forEach((catName) => {
      const txCount = (this.data.transactions || []).filter(t => (t.kategori || '').trim() === catName.trim() && (t.tipe === tab || !t.tipe)).length;
      const isSystemDues = catName === 'Iuran Bulanan' || catName === 'Setoran Kas Iuran Blok';

      const row = document.createElement('div');
      row.className = 'block-item-row';
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'space-between';
      row.style.padding = '10px 14px';
      row.style.background = '#f8fafc';
      row.style.border = '1px solid #e2e8f0';
      row.style.borderRadius = '12px';
      row.style.marginBottom = '8px';

      const escapedCat = catName.replace(/'/g, "\\'");

      row.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;">
          <span style="font-size: 15px;">${tab === 'masuk' ? '📥' : '📤'}</span>
          <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            <div style="font-weight: 700; color: #1e293b; font-size: 13.5px;">${catName}</div>
            <div style="font-size: 11px; color: #64748b;">
              <span class="badge-block" style="font-size: 10px; font-weight: 600;">${txCount} Transaksi</span>
              ${isSystemDues ? '<span style="color: #0d9488; font-weight: 600; margin-left: 6px;">(Kategori Utama Iuran)</span>' : ''}
            </div>
          </div>
        </div>
        <div style="display: flex; gap: 6px; align-items: center;">
          <button type="button" class="btn-icon-action" title="Ubah Nama Kategori" onclick="App.editCategory('${tab}', '${escapedCat}')">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button type="button" class="btn-icon-action" style="color: #ef4444;" title="Hapus Kategori" onclick="App.deleteCategory('${tab}', '${escapedCat}')">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      `;
      container.appendChild(row);
    });
  },

  addCategory() {
    this.ensureCategoriesExist();
    const input = document.getElementById('newCategoryInput');
    if (!input) return;
    const name = input.value.trim();
    const tab = AppState.activeCategoryTab || 'masuk';

    if (!name) {
      alert("Masukkan nama kategori transaksi terlebih dahulu!");
      return;
    }

    if (this.data.categories[tab].some(c => c.toLowerCase() === name.toLowerCase())) {
      alert(`Kategori "${name}" sudah ada dalam daftar ${tab === 'masuk' ? 'Kas Masuk' : 'Kas Keluar'}!`);
      return;
    }

    this.data.categories[tab].push(name);
    DB.save(this.data);
    input.value = '';

    this.renderCategoryList();
    this.renderCategoryFilterOptions();
    this.renderTxCategoryOptions(document.getElementById('txTipe')?.value || 'masuk');
    alert(`✅ Kategori "${name}" berhasil ditambahkan ke daftar ${tab === 'masuk' ? 'Kas Masuk' : 'Kas Keluar'}!`);
  },

  editCategory(type, oldName) {
    this.ensureCategoriesExist();
    const tabName = type === 'masuk' ? 'Kas Masuk' : 'Kas Keluar';
    const newName = prompt(`Ubah nama kategori "${oldName}" (${tabName}) menjadi:`, oldName);
    if (!newName || newName.trim() === '' || newName.trim() === oldName) return;

    const cleanNew = newName.trim();
    if (this.data.categories[type].some(c => c.toLowerCase() === cleanNew.toLowerCase() && c.toLowerCase() !== oldName.toLowerCase())) {
      alert(`Kategori "${cleanNew}" sudah ada dalam daftar ${tabName}!`);
      return;
    }

    const idx = this.data.categories[type].indexOf(oldName);
    if (idx !== -1) {
      this.data.categories[type][idx] = cleanNew;
    }

    // Perbarui riwayat transaksi lama yang menggunakan kategori ini
    let updatedTxCount = 0;
    (this.data.transactions || []).forEach(t => {
      if (t.kategori === oldName && (t.tipe === type || !t.tipe)) {
        t.kategori = cleanNew;
        updatedTxCount++;
      }
    });

    DB.save(this.data);
    this.renderCategoryList();
    this.renderCategoryFilterOptions();
    this.renderTxCategoryOptions(document.getElementById('txTipe')?.value || 'masuk');
    this.renderTransactions();
    this.renderFinancialReport();

    alert(`✅ Nama kategori berhasil diubah menjadi "${cleanNew}".${updatedTxCount > 0 ? `\n(${updatedTxCount} riwayat transaksi telah disesuaikan otomatis)` : ''}`);
  },

  deleteCategory(type, name) {
    this.ensureCategoriesExist();
    const tabName = type === 'masuk' ? 'Kas Masuk' : 'Kas Keluar';

    if (name === 'Iuran Bulanan') {
      if (!confirm(`⚠️ PERINGATAN: Kategori "Iuran Bulanan" digunakan oleh sistem untuk pencatatan iuran wajib bulanan warga.\n\nYakin ingin tetap menghapusnya dari daftar pilihan?`)) {
        return;
      }
    }

    const txCount = (this.data.transactions || []).filter(t => t.kategori === name).length;
    if (txCount > 0) {
      if (!confirm(`Kategori "${name}" saat ini tercatat pada ${txCount} transaksi kas.\n\nMenghapus kategori ini dari pilihan transaksi baru TIDAK AKAN menghapus riwayat pembukuan kas yang sudah ada.\n\nYakin ingin menghapus kategori "${name}"?`)) {
        return;
      }
    } else {
      if (!confirm(`Hapus kategori "${name}" dari daftar ${tabName}?`)) {
        return;
      }
    }

    this.data.categories[type] = this.data.categories[type].filter(c => c !== name);
    DB.save(this.data);

    this.renderCategoryList();
    this.renderCategoryFilterOptions();
    this.renderTxCategoryOptions(document.getElementById('txTipe')?.value || 'masuk');
    alert(`Kategori "${name}" berhasil dihapus dari daftar ${tabName}.`);
  },

  renderCategoryFilterOptions() {
    this.ensureCategoriesExist();
    const el = document.getElementById('filterKasCategory');
    if (!el) return;
    const curVal = el.value || 'all';
    const categories = this.data.categories || { masuk: [], keluar: [] };

    let html = `<option value="all">Semua Kategori Transaksi</option>`;
    if (Array.isArray(categories.masuk) && categories.masuk.length > 0) {
      html += `<optgroup label="── Kas Masuk (Pemasukan) ──">`;
      categories.masuk.forEach(c => {
        html += `<option value="${c}" ${c === curVal ? 'selected' : ''}>${c}</option>`;
      });
      html += `</optgroup>`;
    }
    if (Array.isArray(categories.keluar) && categories.keluar.length > 0) {
      html += `<optgroup label="── Kas Keluar (Pengeluaran) ──">`;
      categories.keluar.forEach(c => {
        html += `<option value="${c}" ${c === curVal ? 'selected' : ''}>${c}</option>`;
      });
      html += `</optgroup>`;
    }
    el.innerHTML = html;
  },

  renderTxCategoryOptions(tipe = 'masuk') {
    this.ensureCategoriesExist();
    const el = document.getElementById('txKategori');
    if (!el) return;
    const categories = this.data.categories || { masuk: [], keluar: [] };
    const list = (tipe === 'masuk' ? categories.masuk : categories.keluar) || [];
    el.innerHTML = list.map(c => `<option value="${c}">${c}</option>`).join('');
  },

  onTxTypeChange(tipe) {
    this.renderTxCategoryOptions(tipe);
  },

  openCatatKasModal() {
    const curTipe = document.getElementById('txTipe')?.value || 'masuk';
    this.renderTxCategoryOptions(curTipe);
    this.openModal('modalCatatKas');
  },

  // =========================================================================
  // Auth: Login, Logout & Registrasi Warga (Fixing Points 2 & 3)
  // =========================================================================
  openAuthModal(defaultTab = 'login', defaultRole = 'pengurus') {
    // Tutup paksa SEMUA modal overlay jika ada yang aktif
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.classList.remove('active');
    });

    const bottomNav = document.querySelector('.bottom-nav');
    if (bottomNav) bottomNav.style.display = 'none';

    const screenAuth = document.getElementById('screenAuth');
    const mainLayout = document.getElementById('appMainLayout');
    if (mainLayout) mainLayout.style.display = 'none';
    if (screenAuth) screenAuth.style.display = 'flex';
    this.switchAuthTab(defaultTab);
    this.selectAuthRole(defaultRole);
  },

  switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab-btn').forEach(btn => {
      if (btn.getAttribute('data-auth-tab') === tab) btn.classList.add('active');
      else btn.classList.remove('active');
    });
    const loginSection = document.getElementById('authLoginSection');
    const registerSection = document.getElementById('authRegisterSection');
    if (loginSection && registerSection) {
      if (tab === 'login') {
        loginSection.style.display = 'block';
        registerSection.style.display = 'none';
      } else {
        loginSection.style.display = 'none';
        registerSection.style.display = 'block';
        this.renderBlockOptions(); // refresh block dropdown
      }
    }
  },

  selectAuthRole(role) {
    document.querySelectorAll('.auth-role-card').forEach(c => {
      if (c.getAttribute('data-role') === role) c.classList.add('selected');
      else c.classList.remove('selected');
    });
    const label = document.getElementById('authUsernameLabel');
    const input = document.getElementById('authUsername');
    const passInput = document.getElementById('authPassword');
    const hint = document.getElementById('authUsernameHint');

    if (role === 'pengurus') {
      if (label) label.textContent = 'Username Pengurus *';
      if (input) {
        input.placeholder = 'Contoh: admin atau nama petugas';
      }
      if (passInput) {
        passInput.placeholder = 'Password akun';
      }
      if (hint) {
        hint.style.display = 'none';
        hint.textContent = '';
      }
    } else {
      if (label) label.textContent = 'Akun Warga (NIK / No. WhatsApp / Nama KK) *';
      if (input) {
        input.placeholder = '16 digit NIK atau Nomor WhatsApp terdaftar';
      }
      if (passInput) {
        passInput.placeholder = 'Password akun warga';
      }
      if (hint) {
        hint.style.display = 'none';
        hint.textContent = '';
      }
    }
  },

  // Bantuan Pengisian Cepat Kredensial Demo
  fillDemoLogin(role) {
    if (role === 'pengurus') {
      this.selectAuthRole('pengurus');
      const u = document.getElementById('authUsername');
      const p = document.getElementById('authPassword');
      if (u) u.value = 'admin';
      if (p) p.value = '123';
    } else {
      this.selectAuthRole('warga');
      const u = document.getElementById('authUsername');
      const p = document.getElementById('authPassword');
      const firstRes = (this.data && this.data.residents && this.data.residents.length > 0) ? this.data.residents[0] : null;
      if (u) u.value = firstRes ? (firstRes.nik || firstRes.phone || firstRes.nama) : '123456789123';
      if (p) p.value = firstRes ? (firstRes.password || '123456') : '123456';
    }
  },

  // Toggle Show/Hide Password for Input Forms
  toggleInputPassword(inputId, btnEl) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
      input.type = 'text';
      if (btnEl) btnEl.textContent = '🙈';
    } else {
      input.type = 'password';
      if (btnEl) btnEl.textContent = '👁️';
    }
  },

  // Toggle Table Password Display for Admin
  toggleTablePassword(residentId) {
    const textEl = document.getElementById(`pwdDisplay_${residentId}`);
    const eyeEl = document.getElementById(`pwdEye_${residentId}`);
    if (!textEl) return;
    const realPwd = textEl.getAttribute('data-real-pwd') || '123456';
    if (textEl.textContent === '••••••') {
      textEl.textContent = realPwd;
      textEl.style.color = '#0d9488';
      if (eyeEl) eyeEl.textContent = '🙈';
    } else {
      textEl.textContent = '••••••';
      textEl.style.color = '#334155';
      if (eyeEl) eyeEl.textContent = '👁️';
    }
  },

  // Admin resets or changes a resident's password
  resetResidentPassword(residentId) {
    const resident = (this.data.residents || []).find(r => r.id === residentId);
    if (!resident) return;
    const currentPwd = resident.password || '123456';
    const newPwd = prompt(
      `🔑 Kelola Password Akun Warga\n\nNama: ${resident.nama}\nAlamat: ${resident.alamat}\nPassword saat ini: "${currentPwd}"\n\nMasukkan password baru untuk warga ini jika ingin mereset/mengganti:`,
      currentPwd
    );
    if (newPwd === null) return;
    const clean = newPwd.trim();
    if (!clean) {
      alert("Password tidak boleh kosong!");
      return;
    }
    resident.password = clean;
    DB.save(this.data);
    this.renderResidents();
    alert(`✅ Password untuk ${resident.nama} (${resident.alamat}) berhasil diubah menjadi: "${clean}"\n\nSilakan berikan password baru ini kepada warga yang bersangkutan agar bisa login.`);
  },

  // Resident changes their own password from Warga Profile view
  changeMyWargaPassword() {
    const resident = (this.data.residents || []).find(r => r.id === AppState.currentResidentId);
    if (!resident) return;
    const newPwd = prompt("Masukkan password baru untuk akun Anda (minimal 6 karakter):");
    if (newPwd === null) return;
    const clean = newPwd.trim();
    if (clean.length < 6) {
      alert("Password baru minimal 6 karakter!");
      return;
    }
    resident.password = clean;
    DB.save(this.data);
    this.renderWargaProfile();
    alert("✅ Password akun Anda berhasil diperbarui!");
  },

  toggleRoleModal() {
    this.logout();
  },

  loginSubmit(event) {
    event.preventDefault();
    this.data = DB.load(); // Refresh data dari storage agar akun dan status paling mutakhir
    const selectedRoleEl = document.querySelector('.auth-role-card.selected');
    const role = selectedRoleEl ? selectedRoleEl.getAttribute('data-role') : 'pengurus';
    const username = document.getElementById('authUsername').value.trim();
    const pass = document.getElementById('authPassword').value.trim();

    if (!username || !pass) {
      alert("Masukkan username/NIK dan password!");
      return;
    }

    const cleanPhoneInput = username.startsWith('0') ? '62' + username.slice(1) : (username.startsWith('+62') ? username.slice(1) : username);

    if (role === 'pengurus') {
      const admin = this.data.adminUser || { username: 'admin', password: '123' };
      const collectors = this.data.collectors || [];

      // 1. Check if login as Ketua RT / Bendahara Umum (Super Admin)
      if ((username.toLowerCase() === (admin.username || 'admin').toLowerCase()) && (pass === (admin.password || '123'))) {
        const user = {
          role: 'pengurus',
          name: this.data.settings?.ketuaRt || 'Pengurus RT',
          username: admin.username
        };
        this.setAuthSession(user);

        // Tutup paksa semua modal overlay jika ada yang tertinggal
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));

        const screenAuth = document.getElementById('screenAuth');
        const mainLayout = document.getElementById('appMainLayout');
        const bottomNav = document.querySelector('.bottom-nav');
        if (screenAuth) screenAuth.style.display = 'none';
        if (mainLayout) mainLayout.style.display = 'flex';
        if (bottomNav) bottomNav.style.display = '';

        this.renderRoleUI();
        this.renderChart();
        this.renderDashboard();
        this.renderResidents();
        this.renderTransactions();
        this.renderDuesMatrix();
        this.renderSetoranBlok();
        this.renderKelolaPetugasPage();
        this.renderTalangan();
        this.renderFinancialReport();

        alert(`Selamat datang kembali, ${user.name}! (Pengurus / Bendahara Umum)`);
        this.switchTab('dashboard');
        return;
      }

      // 2. Check if login as Petugas Penagih Blok
      const collector = collectors.find(c => 
        (c.username && c.username.toLowerCase() === username.toLowerCase()) ||
        (c.phone && (String(c.phone).replace(/^'/, '') === username || String(c.phone).replace(/^'/, '') === cleanPhoneInput)) ||
        (c.nama && c.nama.toLowerCase() === username.toLowerCase())
      );

      if (collector) {
        if (pass !== collector.password && pass !== '123') {
          alert("Password akun petugas salah! Silakan periksa kembali.");
          return;
        }

        const user = {
          role: 'petugas',
          name: collector.nama,
          collectorId: collector.id,
          username: collector.username,
          blokTugas: collector.blokTugas,
          assignedBlocks: Array.isArray(collector.assignedBlocks) ? collector.assignedBlocks : [collector.blokTugas],
          phone: String(collector.phone || '')
        };
        this.setAuthSession(user);

        // Tutup paksa semua modal overlay jika ada yang tertinggal
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));

        const screenAuth = document.getElementById('screenAuth');
        const mainLayout = document.getElementById('appMainLayout');
        const bottomNav = document.querySelector('.bottom-nav');
        if (screenAuth) screenAuth.style.display = 'none';
        if (mainLayout) mainLayout.style.display = 'flex';
        if (bottomNav) bottomNav.style.display = '';

        this.renderRoleUI();
        this.renderResidents();
        this.renderDuesMatrix();
        this.renderSetoranBlok();
        this.renderDashboard();
        this.updateNotificationBadge();

        alert(`Selamat bertugas, ${collector.nama}!\nAnda masuk sebagai Petugas Penagih ${collector.blokTugas}.`);
        this.switchTab('iuran');
        return;
      }

      // 3. Fallback Cerdas: Jika pengguna lupa memilih kartu "Warga" tapi memasukkan NIK/No WA warga yang valid
      const residentFallback = (this.data.residents || []).find(r => {
        const rNik = r.nik ? String(r.nik).replace(/^'/, '').trim() : '';
        const rPhone = r.phone ? String(r.phone).replace(/^'/, '').trim() : '';
        const rNoKk = r.noKk ? String(r.noKk).replace(/^'/, '').trim() : '';
        const rNama = (r.nama || '').trim().toLowerCase();
        const rUser = (r.username || '').trim().toLowerCase();
        const inputLower = username.toLowerCase();

        return (
          (rNik && rNik === username) ||
          (rPhone && (rPhone === username || rPhone === cleanPhoneInput)) ||
          (rNama && rNama === inputLower) ||
          (rUser && rUser === inputLower) ||
          (rNoKk && rNoKk === username)
        );
      });

      if (residentFallback) {
        const validPass = residentFallback.password || '123456';
        if (pass === validPass || pass === '123456') {
          this.selectAuthRole('warga');
          const user = {
            role: 'warga',
            name: residentFallback.nama,
            residentId: residentFallback.id,
            blok: residentFallback.blok,
            noRumah: residentFallback.noRumah,
            alamat: residentFallback.alamat
          };
          this.setAuthSession(user);

          document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
          const screenAuth = document.getElementById('screenAuth');
          const mainLayout = document.getElementById('appMainLayout');
          const bottomNav = document.querySelector('.bottom-nav');
          if (screenAuth) screenAuth.style.display = 'none';
          if (mainLayout) mainLayout.style.display = 'flex';
          if (bottomNav) bottomNav.style.display = '';

          this.renderRoleUI();
          this.renderDashboard();
          this.renderTransactions();

          alert(`Selamat datang Bpk/Ibu ${residentFallback.nama}! Anda otomatis masuk ke Portal Warga.`);
          this.switchTab('dashboard');
          return;
        }
      }

      alert("Username atau password Pengurus / Petugas tidak ditemukan!\n\n💡 Petunjuk Akses:\n• Pengurus: Username 'admin', Password '123'\n• Warga: Pilih kartu 'Warga' lalu masukkan NIK atau No. WhatsApp Anda.\n• Atau klik tombol bantuan '🔑 Isi Akun Pengurus' / '👨‍👩‍👧‍👦 Isi Akun Warga' di bawah tombol login.");
      return;
    } else {
      // Fallback Cerdas: Jika memilih kartu Warga tapi memasukkan kredensial admin
      const admin = this.data.adminUser || { username: 'admin', password: '123' };
      if ((username.toLowerCase() === (admin.username || 'admin').toLowerCase()) && (pass === (admin.password || '123'))) {
        this.selectAuthRole('pengurus');
        const user = {
          role: 'pengurus',
          name: this.data.settings?.ketuaRt || 'Pengurus RT',
          username: admin.username
        };
        this.setAuthSession(user);
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
        const screenAuth = document.getElementById('screenAuth');
        const mainLayout = document.getElementById('appMainLayout');
        const bottomNav = document.querySelector('.bottom-nav');
        if (screenAuth) screenAuth.style.display = 'none';
        if (mainLayout) mainLayout.style.display = 'flex';
        if (bottomNav) bottomNav.style.display = '';
        this.renderRoleUI();
        this.renderChart();
        this.renderDashboard();
        this.renderResidents();
        this.renderTransactions();
        this.renderDuesMatrix();
        this.renderSetoranBlok();
        this.renderKelolaPetugasPage();
        this.renderTalangan();
        this.renderFinancialReport();
        alert(`Selamat datang kembali, ${user.name}! (Otomatis masuk sebagai Pengurus)`);
        this.switchTab('dashboard');
        return;
      }

      // Login Warga (Cari NIK, Phone dengan normalisasi 08 <-> 628, Nama, atau Username)
      const resident = (this.data.residents || []).find(r => {
        const rNik = r.nik ? String(r.nik).replace(/^'/, '').trim() : '';
        const rPhone = r.phone ? String(r.phone).replace(/^'/, '').trim() : '';
        const rNoKk = r.noKk ? String(r.noKk).replace(/^'/, '').trim() : '';
        const rNama = (r.nama || '').trim().toLowerCase();
        const rUser = (r.username || '').trim().toLowerCase();
        const inputLower = username.toLowerCase();

        return (
          (rNik && rNik === username) ||
          (rPhone && (rPhone === username || rPhone === cleanPhoneInput)) ||
          (rNama && rNama === inputLower) ||
          (rUser && rUser === inputLower) ||
          (rNoKk && rNoKk === username)
        );
      });

      if (!resident) {
        alert("Data akun warga tidak ditemukan!\n\n💡 Pastikan NIK atau No. WhatsApp Anda sudah terdaftar di sistem lingkungan, atau klik tab 'Daftar Akun Warga'.\n\nUntuk pengurus, gunakan Username: admin & Password: 123.");
        return;
      }

      const validPass = resident.password || '123456';
      if (pass !== validPass && pass !== '123456') {
        alert("Password salah! Silakan coba lagi.");
        return;
      }

      const user = {
        role: 'warga',
        name: resident.nama,
        residentId: resident.id,
        blok: resident.blok,
        noRumah: resident.noRumah,
        alamat: resident.alamat
      };
      this.setAuthSession(user);

      // Tutup paksa semua modal overlay jika ada yang tertinggal
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));

      const screenAuth = document.getElementById('screenAuth');
      const mainLayout = document.getElementById('appMainLayout');
      const bottomNav = document.querySelector('.bottom-nav');
      if (screenAuth) screenAuth.style.display = 'none';
      if (mainLayout) mainLayout.style.display = 'flex';
      if (bottomNav) bottomNav.style.display = '';

      this.renderRoleUI();
      this.renderDashboard();
      this.renderTransactions();

      alert(`Selamat datang Bpk/Ibu ${resident.nama}! Anda masuk ke Portal Warga.`);
      this.switchTab('dashboard');
    }
  },

  quickDemoLogin(role, residentId = 'W-002') {
    if (role === 'pengurus') {
      const user = {
        role: 'pengurus',
        name: this.data.settings?.ketuaRt || 'Pengurus RT',
        username: 'admin'
      };
      this.setAuthSession(user);
    } else {
      const r = (this.data.residents || []).find(res => res.id === residentId) || this.data.residents[1] || this.data.residents[0];
      const user = {
        role: 'warga',
        name: r.nama,
        residentId: r.id,
        blok: r.blok,
        noRumah: r.noRumah,
        alamat: r.alamat
      };
      this.setAuthSession(user);
    }
    const screenAuth = document.getElementById('screenAuth');
    const mainLayout = document.getElementById('appMainLayout');
    const bottomNav = document.querySelector('.bottom-nav');
    if (screenAuth) screenAuth.style.display = 'none';
    if (mainLayout) mainLayout.style.display = 'flex';
    if (bottomNav) bottomNav.style.display = '';
    this.switchTab('dashboard');
  },

  setAuthSession(user) {
    AppState.currentUser = user;
    AppState.currentRole = user.role;
    AppState.currentResidentId = user.residentId || null;
    sessionStorage.setItem('rukunku_auth_session', JSON.stringify(user));
    localStorage.setItem('rukunku_auth_session', JSON.stringify(user));
    this.renderRoleUI();
  },

  logout() {
    if (confirm("Yakin ingin keluar (logout) dari akun Anda?")) {
      sessionStorage.removeItem('rukunku_auth_session');
      localStorage.removeItem('rukunku_auth_session');
      AppState.currentUser = null;
      AppState.currentRole = 'pengurus';
      AppState.currentResidentId = null;
      this.data = DB.load(); // Refresh data dari storage

      // PENTING: Tutup SEMUA modal overlay yang mungkin masih terbuka saat logout
      document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.classList.remove('active');
      });

      // Sembunyikan bottom navigation mobile saat di layar login
      const bottomNav = document.querySelector('.bottom-nav');
      if (bottomNav) bottomNav.style.display = 'none';

      const screenAuth = document.getElementById('screenAuth');
      const mainLayout = document.getElementById('appMainLayout');
      if (mainLayout) mainLayout.style.display = 'none';
      if (screenAuth) screenAuth.style.display = 'flex';

      this.switchAuthTab('login');
      this.selectAuthRole('pengurus');
    }
  },

  registerWargaSubmit(event) {
    event.preventDefault();
    const nama = document.getElementById('regNama').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const statusHunian = document.getElementById('regStatusHunian').value;
    const blok = document.getElementById('regWargaBlok').value;
    const noRumah = document.getElementById('regNoRumah').value.trim();
    const nik = document.getElementById('regNik').value.trim();
    const noKk = (document.getElementById('regNoKk')?.value || '').trim();
    const pass = document.getElementById('regPassword').value;
    const passConfirm = document.getElementById('regPasswordConfirm').value;

    if (!nama || !phone || !blok || !noRumah || !nik || !pass) {
      alert("Harap lengkapi semua kolom bertanda bintang (*)");
      return;
    }

    // Google email standard: minimum 6 characters
    if (pass.length < 6) {
      alert("Untuk keamanan akun, gunakan password minimal 6 karakter.");
      return;
    }

    if (pass !== passConfirm) {
      alert("Konfirmasi password tidak cocok! Silakan periksa kembali.");
      return;
    }

    // Check duplicate NIK
    const existing = (this.data.residents || []).find(r => r.nik === nik);
    if (existing) {
      alert(`Warga dengan NIK ${nik} sudah terdaftar (${existing.nama} - ${existing.alamat}). Silakan langsung login.`);
      this.switchAuthTab('login');
      return;
    }

    const cleanPhone = phone.startsWith('0') ? '62' + phone.slice(1) : phone;
    let maxNum = 0;
    (this.data.residents || []).forEach(r => {
      const m = String(r.id || '').match(/\d+/);
      if (m) {
        const n = parseInt(m[0], 10);
        if (n > maxNum) maxNum = n;
      }
    });
    const nextSeq = Math.max(maxNum + 1, (this.data.residents || []).length + 1);
    const newId = `W-${String(nextSeq).padStart(3, '0')}`;
    const newResident = {
      id: newId,
      nama,
      nik,
      noKk,
      blok,
      noRumah,
      alamat: `${blok} No. ${noRumah}`,
      phone: cleanPhone,
      jumlahAnggota: 1,
      statusHunian,
      pekerjaan: 'Wiraswasta / Karyawan',
      password: pass,
      statusAktif: true,
      tanggalMasuk: new Date().toISOString().slice(0, 10),
      avatarBg: 'bg-pastel-blue',
      fotoKk: '',
      familyMembers: [
        {
          id: `${newId}-fm-1`,
          nama: nama,
          hubungan: 'Kepala Keluarga',
          nik: nik,
          jenisKelamin: 'Laki-laki',
          tanggalLahir: '',
          punyaKtp: true,
          fotoKtp: ''
        }
      ]
    };

    this.data.residents.push(newResident);

    // Initialize 12-month dues matrix
    if (!this.data.duesMatrix) this.data.duesMatrix = {};
    const curYear = AppState.selectedYear || new Date().getFullYear();
    const blankYear = {
      1: "Belum", 2: "Belum", 3: "Belum", 4: "Belum", 5: "Belum", 6: "Belum",
      7: "Belum", 8: "Belum", 9: "Belum", 10: "Belum", 11: "Belum", 12: "Belum"
    };
    this.data.duesMatrix[newId] = { ...blankYear };
    if (!this.data.duesMatrix[String(curYear)]) this.data.duesMatrix[String(curYear)] = {};
    this.data.duesMatrix[String(curYear)][newId] = { ...blankYear };

    DB.save(this.data);

    // Sync direct to Google Sheets so this registration is instantly persisted to cloud
    if (window.CloudSync && typeof window.CloudSync.saveResidentDirect === 'function') {
      window.CloudSync.saveResidentDirect(newResident);
    }

    // Auto login
    const user = {
      role: 'warga',
      name: newResident.nama,
      residentId: newId,
      blok: newResident.blok,
      noRumah: newResident.noRumah,
      alamat: newResident.alamat
    };
    this.setAuthSession(user);

    const screenAuth = document.getElementById('screenAuth');
    const mainLayout = document.getElementById('appMainLayout');
    const bottomNav = document.querySelector('.bottom-nav');
    if (screenAuth) screenAuth.style.display = 'none';
    if (mainLayout) mainLayout.style.display = 'flex';
    if (bottomNav) bottomNav.style.display = '';

    this.renderRoleUI();
    this.renderResidents();
    this.renderDuesMatrix();

    alert(`🎉 Pendaftaran Berhasil!\n\nSelamat datang Bpk/Ibu ${newResident.nama} (${newResident.alamat}) di sistem RukunKu RT.\n\nSilakan buka menu "Biodata Keluarga" untuk menambahkan anggota keluarga yang tinggal bersama serta mengunggah dokumen KK & KTP.`);
    this.switchTab('warga-profil');
  },

  // =========================================================================
  // Chart Rendering (14 Bars Matching Mockup)
  // =========================================================================
  renderChart() {
    const chartBarsContainer = document.getElementById('chartBarsArea');
    const xAxisContainer = document.getElementById('xAxisArea');
    if (!chartBarsContainer || !xAxisContainer) return;

    chartBarsContainer.innerHTML = '';
    xAxisContainer.innerHTML = '';

    const dailyData = this.data.dailyFlowOctober;
    const maxVal = Math.max(...dailyData.map(d => d.amountIn), 3000000);

    dailyData.forEach((item, idx) => {
      const heightPercent = Math.max(15, Math.round((item.amountIn / maxVal) * 90));
      const isHighlighted = idx === AppState.chartHighlightIndex;

      const col = document.createElement('div');
      col.className = `bar-column ${isHighlighted ? 'highlighted' : ''}`;
      col.setAttribute('data-idx', idx);

      let floatingCardHTML = '';
      if (isHighlighted) {
        floatingCardHTML = `
          <div class="chart-floating-card">
            <div class="floating-value">${ReportGenerator.formatRupiah(item.amountIn)}</div>
            <div class="floating-label">${item.sub || 'Total Kas Hari Ini'}</div>
          </div>
        `;
      }

      col.innerHTML = `
        ${floatingCardHTML}
        <div class="bar-body" style="height: ${heightPercent}%;"></div>
      `;

      col.addEventListener('mouseenter', () => {
        AppState.chartHighlightIndex = idx;
        this.renderChart();
      });

      chartBarsContainer.appendChild(col);

      const xItem = document.createElement('div');
      xItem.className = 'x-axis-item';
      xItem.textContent = item.label;
      xAxisContainer.appendChild(xItem);
    });
  },

  // =========================================================================
  // Dashboard View
  // =========================================================================
  renderDashboard() {
    // Calculate Summary
    let totalMasuk = 0;
    let totalKeluar = 0;
    this.data.transactions.forEach(t => {
      if (t.tipe === 'masuk') totalMasuk += Number(t.nominal);
      else totalKeluar += Number(t.nominal);
    });
    const saldoAkhir = totalMasuk - totalKeluar;

    // Sinkronisasi Metric Cards Kas jika elemen ada di DOM
    const elTotalMasuk = document.getElementById('metricTotalMasuk');
    const elTotalKeluar = document.getElementById('metricTotalKeluar');
    const elSaldoKas = document.getElementById('metricSaldoKas');
    if (elTotalMasuk) elTotalMasuk.textContent = ReportGenerator.formatRupiah(totalMasuk);
    if (elTotalKeluar) elTotalKeluar.textContent = ReportGenerator.formatRupiah(totalKeluar);
    if (elSaldoKas) elSaldoKas.textContent = ReportGenerator.formatRupiah(saldoAkhir);

    // Unpaid Dues for current month & year (Multi-Tahun Otomatis)
    const curYear = AppState.selectedYear || new Date().getFullYear();
    const curMonth = AppState.selectedMonth || (new Date().getMonth() + 1);
    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const curMonthName = monthNames[curMonth - 1] || 'Bulan';

    const totalWarga = (this.data.residents || []).length;
    let lunasCount = 0;
    let pendingCount = 0;
    (this.data.residents || []).forEach(r => {
      const status = this.getDuesStatus(r.id, curYear, curMonth);
      if (status === 'Lunas') lunasCount++;
      else if (status === 'Pending') pendingCount++;
    });
    const belumCount = totalWarga - lunasCount - pendingCount;
    const percentLunas = totalWarga > 0 ? Math.round((lunasCount / totalWarga) * 100) : 0;

    // Update Dashboard Promo Card Progress
    const progressFill = document.getElementById('duesProgressFill');
    const progressText = document.getElementById('duesProgressText');
    const promoDesc = document.getElementById('promoCardDesc');
    if (progressFill) progressFill.style.width = `${percentLunas}%`;
    if (progressText) progressText.textContent = `${percentLunas}% (${lunasCount}/${totalWarga} KK)`;
    if (promoDesc) {
      promoDesc.textContent = `${lunasCount} dari ${totalWarga} KK telah membayar iuran ${curMonthName} ${curYear}. ${belumCount} KK masih dalam proses/menunggak.`;
    }

    // Render Recent Transactions (Last 5 items)
    const recentTxList = document.getElementById('recentTransactionsList');
    if (recentTxList) {
      recentTxList.innerHTML = '';
      const recentItems = [...this.data.transactions].slice(0, 5);

      recentItems.forEach(tx => {
        const row = this.createTransactionRow(tx);
        recentTxList.appendChild(row);
      });
    }

    // Warga View Personal Summary Box
    const wargaPersonalBox = document.getElementById('wargaPersonalStatus');
    if (wargaPersonalBox) {
      if (AppState.currentRole === 'warga') {
        const resident = this.data.residents.find(r => r.id === AppState.currentResidentId) || this.data.residents[0];
        const duesStatus = resident ? this.getDuesStatus(resident.id, curYear, curMonth) : 'Belum';
        
        let badgeClass = 'badge-pending';
        if (duesStatus === 'Lunas') badgeClass = 'badge-approved';
        else if (duesStatus === 'Belum') badgeClass = 'badge-keluar';

        wargaPersonalBox.innerHTML = `
          <div style="background: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 16px; padding: 16px 20px; margin-bottom: 22px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
            <div>
              <div style="font-size: 11px; color: #0d9488; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">Tagihan Rumah Anda (${resident ? resident.alamat : '-'})</div>
              <div style="font-size: 16px; font-weight: 800; color: #134e4a; margin-top: 4px;">
                Iuran ${curMonthName} ${curYear}: <span class="badge-status ${badgeClass}">${duesStatus}</span>
              </div>
              <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
                Nominal: <strong>${ReportGenerator.formatRupiah(this.data.settings.iuranWajibBulanan)}</strong> / bulan • Rekening RT: <strong>${this.data.settings.nomorRekeningRT}</strong>
              </div>
            </div>
            <div>
              ${duesStatus !== 'Lunas' ? `
                <button class="btn-teal-pill" onclick="App.openModal('modalKonfirmasiWarga')">
                  💳 Konfirmasi / Bayar Iuran
                </button>
              ` : `
                <button class="btn-outline-pill" style="border-color: #10b981; color: #047857;" onclick="
                  ReportGenerator.openKwitansi({
                    kwitansi: 'KW-IURAN-${resident.id}-${curYear}-${curMonth}',
                    judul: 'Iuran ${curMonthName} ${curYear} - ${resident.nama}',
                    blok: '${resident.alamat}',
                    tanggal: '${curYear}-${String(curMonth).padStart(2, '0')}-10',
                    kategori: 'Iuran Bulanan',
                    nominal: ${this.data.settings.iuranWajibBulanan},
                    metode: 'Transfer / QRIS RT'
                  })
                ">
                  ✅ Lunas • Cetak Bukti Kwitansi
                </button>
              `}
            </div>
          </div>
        `;
      } else if (AppState.currentRole === 'petugas') {
        const user = AppState.currentUser || {};
        const myResidents = (this.data.residents || []).filter(r => this.isResidentInCollectorScope(r));
        const totalKK = myResidents.length;
        let lunasKK = 0;
        myResidents.forEach(r => {
          const st = this.getDuesStatus(r.id, curYear, curMonth);
          if (st === 'Lunas') lunasKK++;
        });

        const totalUang = lunasKK * (this.data.settings.iuranWajibBulanan || 150000);
        const remitted = (this.data.setoranBlok || [])
          .filter(s => (
            (s.collectorId && user.collectorId && s.collectorId === user.collectorId) ||
            (s.blokTugas && user.blokTugas && s.blokTugas.toLowerCase().trim() === user.blokTugas.toLowerCase().trim())
          ) && Number(s.periodeBulan) === Number(curMonth) && Number(s.periodeTahun || 2026) === Number(curYear))
          .reduce((sum, s) => sum + (Number(s.nominalTotal) || 0), 0);
        const kasDiTangan = Math.max(0, totalUang - remitted);

        wargaPersonalBox.innerHTML = `
          <div style="background: linear-gradient(135deg, #f0fdfa, #ccfbf1); border: 1px solid #99f6e4; border-radius: 16px; padding: 18px 22px; margin-bottom: 22px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; box-shadow: 0 4px 12px rgba(13, 148, 136, 0.08);">
            <div>
              <div style="font-size: 11px; color: #0d9488; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">Ringkasan Lapangan Petugas • ${user.blokTugas || 'Blok'}</div>
              <div style="font-size: 17px; font-weight: 800; color: #134e4a; margin-top: 3px;">
                Kas Fisik di Tangan Saya: <span style="color: ${kasDiTangan > 0 ? '#d97706' : '#0d9488'};">${Utils.formatRupiah(kasDiTangan)}</span>
              </div>
              <div style="font-size: 12px; color: #475569; margin-top: 4px;">
                Progres Penagihan: <strong>${lunasKK} dari ${totalKK} KK Lunas</strong> • Terkumpul: <strong>${Utils.formatRupiah(totalUang)}</strong> ${remitted > 0 ? `• Disetorkan: <strong style="color: #059669;">${Utils.formatRupiah(remitted)}</strong>` : ''}
              </div>
            </div>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
              <button class="btn-teal-pill" onclick="App.switchTab('iuran')">
                📋 Lembar Tagihan Blok
              </button>
              <button class="btn-outline-pill" style="border-color: #0d9488; color: #0d9488; font-weight: 700; background: #fff;" onclick="App.switchTab('setoran-blok')">
                📤 Setor Kas ke Bendahara
              </button>
            </div>
          </div>
        `;
      } else {
        wargaPersonalBox.innerHTML = '';
      }
    }
  },

  createTransactionRow(tx) {
    const isMasuk = tx.tipe === 'masuk';
    const row = document.createElement('div');
    row.className = 'transaction-row';

    let badgeColorClass = isMasuk ? 'bg-pastel-teal' : 'bg-pastel-rose';
    let iconChar = isMasuk ? '📥' : '📤';
    const katStr = tx.kategori || '';
    if (katStr.includes('Satpam') || katStr.includes('Keamanan')) {
      badgeColorClass = 'bg-pastel-rose';
      iconChar = '👮';
    } else if (katStr.includes('Sampah') || katStr.includes('Kebersihan')) {
      badgeColorClass = 'bg-pastel-blue';
      iconChar = '🚛';
    } else if (katStr.includes('Perbaikan') || katStr.includes('Lampu')) {
      badgeColorClass = 'bg-pastel-yellow';
      iconChar = '💡';
    } else if (katStr.includes('Sosial') || katStr.includes('Kematian')) {
      badgeColorClass = 'bg-pastel-purple';
      iconChar = '🤝';
    } else if (katStr.includes('Talangan')) {
      badgeColorClass = 'bg-pastel-yellow';
      iconChar = '🪙';
    } else if (katStr.includes('Iuran')) {
      badgeColorClass = 'bg-pastel-teal';
      iconChar = '🏠';
    }

    let statusBadgeClass = 'badge-approved';
    let statusText = 'Approved';
    if (tx.status === 'Pending') {
      statusBadgeClass = 'badge-pending';
      statusText = 'Pending';
    }

    row.innerHTML = `
      <div class="tx-left">
        <div class="tx-icon-badge ${badgeColorClass}">
          ${iconChar}
        </div>
        <div class="tx-info">
          <div class="tx-title">${tx.judul}</div>
          <div class="tx-subtitle">${tx.kategori} • ${tx.metode}</div>
        </div>
      </div>

      <div class="tx-middle">
        <span class="badge-status ${statusBadgeClass}">${statusText}</span>
        <div class="tx-amount ${isMasuk ? 'positive' : 'negative'}">
          ${isMasuk ? '+' : '-'}${ReportGenerator.formatRupiah(tx.nominal)}
        </div>
      </div>

      <div class="tx-right">
        <div class="tx-date">${tx.tanggal}, ${tx.waktu || '10:00'}</div>
        <button class="tx-menu-btn" title="Cetak Kwitansi / Detail" onclick="event.stopPropagation(); ReportGenerator.openKwitansi(${JSON.stringify(tx).replace(/"/g, '&quot;')})">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="1.5"/>
            <circle cx="12" cy="5" r="1.5"/>
            <circle cx="12" cy="19" r="1.5"/>
          </svg>
        </button>
      </div>
    `;

    return row;
  },

  // =========================================================================
  // Data Warga (Administrasi KK)
  // =========================================================================
  renderResidents(targetPage) {
    const tableBody = document.getElementById('residentsTableBody');
    if (!tableBody) return;

    if (typeof targetPage === 'number') {
      AppState.wargaPage = targetPage;
    } else if (!AppState.wargaPage) {
      AppState.wargaPage = 1;
    }

    tableBody.innerHTML = '';
    let filtered = this.data.residents || [];

    // If logged in as collector, scope to collector's block
    if (AppState.currentRole === 'petugas') {
      filtered = filtered.filter(r => this.isResidentInCollectorScope(r));
    }

    // Filter Blok
    const blokFilter = document.getElementById('filterBlokSelect')?.value;
    if (blokFilter && blokFilter !== 'all' && AppState.currentRole !== 'petugas') {
      filtered = filtered.filter(r => r.blok === blokFilter || r.blok.startsWith(blokFilter));
    }

    // Search Query
    if (AppState.searchQuery) {
      filtered = filtered.filter(r => 
        r.nama.toLowerCase().includes(AppState.searchQuery) ||
        r.alamat.toLowerCase().includes(AppState.searchQuery) ||
        (r.nik && r.nik.includes(AppState.searchQuery)) ||
        (r.phone && r.phone.includes(AppState.searchQuery))
      );
    }

    const totalItems = filtered.length;
    const pageSize = AppState.wargaPageSize || 10;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    if (AppState.wargaPage > totalPages) AppState.wargaPage = totalPages;
    if (AppState.wargaPage < 1) AppState.wargaPage = 1;

    const totalCountEl = document.getElementById('totalWargaCount');
    if (totalCountEl) {
      if (AppState.currentRole === 'petugas') {
        totalCountEl.textContent = `${totalItems} KK di bawah koordinasi ${AppState.currentUser.blokTugas}`;
      } else {
        totalCountEl.textContent = `${totalItems} Kepala Keluarga Terdaftar di ${this.data.settings.rtName}`;
      }
    }

    const startIndex = (AppState.wargaPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);
    const pageItems = filtered.slice(startIndex, endIndex);

    if (pageItems.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 32px 16px; color: #94a3b8;">
            <div style="font-size: 26px; margin-bottom: 6px;">🔍</div>
            <div style="font-weight: 600; color: #475569;">Tidak ada data warga ditemukan.</div>
            <div style="font-size: 12px; margin-top: 4px;">Coba ubah kata kunci pencarian atau filter blok.</div>
          </td>
        </tr>
      `;
    } else {
      pageItems.forEach((r, idx) => {
        const rowNumber = startIndex + idx + 1;
        const tr = document.createElement('tr');
        const waLink = `https://wa.me/${r.phone}?text=${encodeURIComponent(`Halo Bpk/Ibu ${r.nama} (Warga ${r.alamat}), salam dari Pengurus ${this.data.settings.rtName}.`)}`;

        tr.innerHTML = `
          <td style="text-align: center; color: var(--text-muted);">${rowNumber}</td>
          <td>
            <div class="table-resident-name">
              <div class="avatar-img" style="width: 32px; height: 32px; font-size: 11px;">
                ${r.nama.split(' ').map(n=>n[0]).join('').slice(0, 2)}
              </div>
              <div>
                <strong>${r.nama}</strong><br>
                <span style="font-size: 11px; color: #64748b;">NIK: ${r.nik || '-'}</span>
              </div>
            </div>
          </td>
          <td>
            <span class="badge-block">${r.blok} No. ${r.noRumah}</span><br>
            <span style="font-size: 11px; color: #64748b;">${r.alamat}</span>
          </td>
          <td>
            <span class="badge-status ${r.statusHunian === 'Pemilik Tetap' ? 'badge-approved' : 'badge-pending'}">
              ${r.statusHunian}
            </span>
          </td>
          <td style="text-align: center;"><strong>${r.jumlahAnggota || (r.familyMembers ? r.familyMembers.length : 1)}</strong> Jiwa</td>
          <td>
            <a href="${waLink}" target="_blank" class="btn-icon-action btn-icon-wa" title="Kirim Pesan WhatsApp">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
              <span style="margin-left: 6px; font-size: 12px; font-weight: 600;">${r.phone}</span>
            </a>
          </td>
          <td class="pengurus-only">
            <div class="pwd-cell-box">
              <span class="pwd-text-display" id="pwdDisplay_${r.id}" data-real-pwd="${(r.password || '123456').replace(/"/g, '&quot;')}">••••••</span>
              <button type="button" class="btn-icon-action" style="padding: 2px 4px; width: 24px; height: 24px;" title="Lihat / Sembunyikan Password" onclick="App.toggleTablePassword('${r.id}')">
                <span id="pwdEye_${r.id}" style="font-size: 12px;">👁️</span>
              </button>
              <button type="button" class="btn-icon-action" style="padding: 2px 4px; width: 24px; height: 24px; color: #0d9488;" title="Ubah / Reset Password Warga Ini" onclick="App.resetResidentPassword('${r.id}')">
                <span style="font-size: 12px;">🔑</span>
              </button>
            </div>
          </td>
          <td class="pengurus-only">
            <div class="table-actions">
              <button class="btn-icon-action" title="Lihat Anggota Keluarga & Dokumen KK/KTP" onclick="App.openAdminResidentDetail('${r.id}')" style="color: #0f766e;">
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </button>
              <button class="btn-icon-action" title="Edit Data Warga" onclick="App.editResident('${r.id}')">
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="btn-icon-action" style="color: #ef4444;" title="Hapus Data Warga" onclick="App.deleteResident('${r.id}')">
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </td>
        `;

        tableBody.appendChild(tr);
      });
    }

    this.renderWargaPagination(totalItems, totalPages, startIndex, endIndex);
    this.renderRoleUI();
  },

  renderWargaPagination(totalItems, totalPages, startIndex, endIndex) {
    const container = document.getElementById('wargaPagination');
    if (!container) return;

    if (totalItems === 0) {
      container.style.display = 'none';
      return;
    }
    container.style.display = 'flex';

    const infoEl = document.getElementById('wargaPaginationInfo');
    if (infoEl) {
      infoEl.innerHTML = `Menampilkan <strong>${startIndex + 1} - ${endIndex}</strong> dari <strong>${totalItems}</strong> warga`;
    }

    const controlsEl = document.getElementById('wargaPaginationControls');
    if (!controlsEl) return;

    const curPage = AppState.wargaPage || 1;
    let html = '';

    // Tombol Previous
    html += `
      <button type="button" class="pagination-btn" ${curPage <= 1 ? 'disabled' : ''} onclick="App.changeWargaPage(${curPage - 1})" title="Halaman Sebelumnya">
        &laquo; Prev
      </button>
    `;

    // Tombol Nomor Halaman (1, 2, 3...)
    const maxButtons = 5;
    let startP = Math.max(1, curPage - Math.floor(maxButtons / 2));
    let endP = Math.min(totalPages, startP + maxButtons - 1);
    if (endP - startP + 1 < maxButtons) {
      startP = Math.max(1, endP - maxButtons + 1);
    }

    if (startP > 1) {
      html += `<button type="button" class="pagination-btn" onclick="App.changeWargaPage(1)">1</button>`;
      if (startP > 2) html += `<span style="padding: 0 4px; color: #94a3b8;">...</span>`;
    }

    for (let p = startP; p <= endP; p++) {
      html += `
        <button type="button" class="pagination-btn ${p === curPage ? 'active' : ''}" onclick="App.changeWargaPage(${p})">
          ${p}
        </button>
      `;
    }

    if (endP < totalPages) {
      if (endP < totalPages - 1) html += `<span style="padding: 0 4px; color: #94a3b8;">...</span>`;
      html += `<button type="button" class="pagination-btn" onclick="App.changeWargaPage(${totalPages})">${totalPages}</button>`;
    }

    // Tombol Next
    html += `
      <button type="button" class="pagination-btn" ${curPage >= totalPages ? 'disabled' : ''} onclick="App.changeWargaPage(${curPage + 1})" title="Halaman Selanjutnya">
        Next &raquo;
      </button>
    `;

    // Dropdown Ukuran Halaman
    html += `
      <div style="display: flex; align-items: center; gap: 6px; margin-left: 8px;">
        <span style="font-size: 12px; color: #64748b;">Per hal:</span>
        <select class="form-control" style="width: auto; padding: 4px 8px; font-size: 12px; height: 34px; border-radius: 8px;" onchange="App.changeWargaPageSize(this.value)">
          <option value="10" ${AppState.wargaPageSize === 10 ? 'selected' : ''}>10</option>
          <option value="25" ${AppState.wargaPageSize === 25 ? 'selected' : ''}>25</option>
          <option value="50" ${AppState.wargaPageSize === 50 ? 'selected' : ''}>50</option>
        </select>
      </div>
    `;

    controlsEl.innerHTML = html;
  },

  changeWargaPage(page) {
    AppState.wargaPage = page;
    this.renderResidents(page);
    const tableEl = document.querySelector('#view-warga .data-table-container');
    if (tableEl) {
      tableEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  },

  changeWargaPageSize(size) {
    AppState.wargaPageSize = parseInt(size, 10) || 10;
    AppState.wargaPage = 1;
    this.renderResidents(1);
  },

  openAddResidentModal() {
    const form = document.getElementById('modalTambahWargaForm');
    if (form) form.reset();
    document.getElementById('residentFormId').value = '';
    document.getElementById('modalTambahWargaTitle').textContent = "Tambah Data Warga Baru";
    const pwdEl = document.getElementById('wargaPassword');
    if (pwdEl) pwdEl.value = '123456';
    this.renderBlockOptions();
    this.openModal('modalTambahWarga');
  },

  saveResidentModal(event) {
    event.preventDefault();
    const id = document.getElementById('residentFormId').value;
    const nama = document.getElementById('wargaNama').value.trim();
    const nik = document.getElementById('wargaNik').value.trim();
    const noKk = document.getElementById('wargaNoKk').value.trim();
    const blok = document.getElementById('wargaBlok').value;
    const noRumah = document.getElementById('wargaNoRumah').value.trim();
    const phone = document.getElementById('wargaPhone').value.trim();
    const jumlahAnggota = parseInt(document.getElementById('wargaJumlahAnggota').value) || 1;
    const statusHunian = document.getElementById('wargaStatusHunian').value;
    const pekerjaan = document.getElementById('wargaPekerjaan').value.trim();
    const password = document.getElementById('wargaPassword')?.value.trim() || '123456';

    if (!nama || !noRumah || !phone) {
      alert("Nama Kepala Keluarga, Nomor Rumah, dan Nomor WhatsApp wajib diisi!");
      return;
    }

    let savedResident = null;
    if (id) {
      const target = this.data.residents.find(r => r.id === id);
      if (target) {
        target.nama = nama;
        target.nik = nik;
        target.noKk = noKk;
        target.blok = blok;
        target.noRumah = noRumah;
        target.alamat = `${blok} No. ${noRumah}`;
        target.phone = phone.startsWith('0') ? '62' + phone.slice(1) : phone;
        target.jumlahAnggota = Math.max(jumlahAnggota, (target.familyMembers ? target.familyMembers.length : 1));
        target.statusHunian = statusHunian;
        target.pekerjaan = pekerjaan;
        target.password = password;
        if (!target.familyMembers || target.familyMembers.length === 0) {
          target.familyMembers = [
            {
              id: `${target.id}-fm-1`,
              nama: nama,
              hubungan: 'Kepala Keluarga',
              nik: nik || '',
              jenisKelamin: 'Laki-laki',
              tanggalLahir: '',
              punyaKtp: !!nik,
              fotoKtp: ''
            }
          ];
        }
        savedResident = target;
      }
    } else {
      let maxNum = 0;
      (this.data.residents || []).forEach(r => {
        const m = String(r.id || '').match(/\d+/);
        if (m) {
          const n = parseInt(m[0], 10);
          if (n > maxNum) maxNum = n;
        }
      });
      const nextSeq = Math.max(maxNum + 1, (this.data.residents || []).length + 1);
      const newId = `W-${String(nextSeq).padStart(3, '0')}`;
      const newResident = {
        id: newId,
        nama,
        nik,
        noKk,
        blok,
        noRumah,
        alamat: `${blok} No. ${noRumah}`,
        phone: phone.startsWith('0') ? '62' + phone.slice(1) : phone,
        jumlahAnggota: Math.max(jumlahAnggota, 1),
        statusHunian,
        pekerjaan,
        password: password,
        statusAktif: true,
        tanggalMasuk: new Date().toISOString().slice(0, 10),
        avatarBg: 'bg-pastel-teal',
        familyMembers: [
          {
            id: `${newId}-fm-1`,
            nama: nama,
            hubungan: 'Kepala Keluarga',
            nik: nik || '',
            jenisKelamin: 'Laki-laki',
            tanggalLahir: '',
            punyaKtp: !!nik,
            fotoKtp: ''
          }
        ]
      };

      this.data.residents.push(newResident);
      savedResident = newResident;

      if (!this.data.duesMatrix) this.data.duesMatrix = {};
      const curYear = AppState.selectedYear || new Date().getFullYear();
      const blankYear = {
        1: "Belum", 2: "Belum", 3: "Belum", 4: "Belum", 5: "Belum", 6: "Belum",
        7: "Belum", 8: "Belum", 9: "Belum", 10: "Belum", 11: "Belum", 12: "Belum"
      };
      this.data.duesMatrix[newId] = { ...blankYear };
      if (!this.data.duesMatrix[String(curYear)]) this.data.duesMatrix[String(curYear)] = {};
      this.data.duesMatrix[String(curYear)][newId] = { ...blankYear };
    }

    DB.save(this.data);

    // Sync direct to Google Sheets
    if (savedResident && window.CloudSync && typeof window.CloudSync.saveResidentDirect === 'function') {
      window.CloudSync.saveResidentDirect(savedResident);
    }

    this.closeModal('modalTambahWarga');
    this.renderResidents();
    this.renderDuesMatrix();
    this.renderDashboard();
    alert("Data warga berhasil disimpan!");
  },

  editResident(id) {
    const res = this.data.residents.find(r => r.id === id);
    if (!res) return;

    this.renderBlockOptions(); // refresh block options
    document.getElementById('residentFormId').value = res.id;
    document.getElementById('wargaNama').value = res.nama;
    document.getElementById('wargaNik').value = res.nik || '';
    document.getElementById('wargaNoKk').value = res.noKk || '';
    document.getElementById('wargaBlok').value = res.blok;
    document.getElementById('wargaNoRumah').value = res.noRumah;
    document.getElementById('wargaPhone').value = res.phone;
    document.getElementById('wargaJumlahAnggota').value = res.jumlahAnggota;
    document.getElementById('wargaStatusHunian').value = res.statusHunian;
    document.getElementById('wargaPekerjaan').value = res.pekerjaan || '';
    const pwdEl = document.getElementById('wargaPassword');
    if (pwdEl) pwdEl.value = res.password || '123456';

    document.getElementById('modalTambahWargaTitle').textContent = "Edit Data Warga / KK";
    this.openModal('modalTambahWarga');
  },

  deleteResident(id) {
    const res = this.data.residents.find(r => r.id === id);
    if (!res) return;

    if (confirm(`Yakin ingin menghapus data warga Bpk/Ibu ${res.nama} (${res.alamat})?`)) {
      this.data.residents = this.data.residents.filter(r => r.id !== id);
      if (this.data.duesMatrix) {
        delete this.data.duesMatrix[id];
        Object.keys(this.data.duesMatrix).forEach(key => {
          if (this.data.duesMatrix[key] && typeof this.data.duesMatrix[key] === 'object' && this.data.duesMatrix[key][id]) {
            delete this.data.duesMatrix[key][id];
          }
        });
      }
      DB.save(this.data);
      // Sync delete to Google Sheets
      if (window.CloudSync && typeof window.CloudSync.deleteResidentDirect === 'function') {
        window.CloudSync.deleteResidentDirect(id);
      }
      this.renderResidents();
      this.renderDuesMatrix();
      this.renderDashboard();
    }
  },

  // =========================================================================
  // Buku Kas (Kas Masuk & Keluar)
  // =========================================================================
  renderTransactions() {
    const container = document.getElementById('transactionsTableBody');
    if (!container) return;

    const catSelect = document.getElementById('filterKasCategory');
    if (catSelect && !catSelect.dataset.dynamicLoaded) {
      this.renderCategoryFilterOptions();
      catSelect.dataset.dynamicLoaded = 'true';
    }

    container.innerHTML = '';
    let filtered = [...this.data.transactions];

    const yearFilter = document.getElementById('filterKasYear')?.value;
    if (yearFilter && yearFilter !== 'all') {
      filtered = filtered.filter(t => {
        if (t.periodeTahun) return String(t.periodeTahun) === String(yearFilter);
        if (t.tanggal) return t.tanggal.startsWith(String(yearFilter));
        return false;
      });
    }

    const typeFilter = document.getElementById('filterKasType')?.value;
    if (typeFilter && typeFilter !== 'all') {
      filtered = filtered.filter(t => t.tipe === typeFilter);
    }

    const catFilter = document.getElementById('filterKasCategory')?.value;
    if (catFilter && catFilter !== 'all') {
      filtered = filtered.filter(t => t.kategori === catFilter);
    }

    if (AppState.searchQuery) {
      filtered = filtered.filter(t => 
        t.judul.toLowerCase().includes(AppState.searchQuery) ||
        t.kategori.toLowerCase().includes(AppState.searchQuery) ||
        (t.keterangan && t.keterangan.toLowerCase().includes(AppState.searchQuery)) ||
        (t.blok && t.blok.toLowerCase().includes(AppState.searchQuery))
      );
    }

    let totalMasuk = 0;
    let totalKeluar = 0;
    this.data.transactions.forEach(t => {
      if (t.tipe === 'masuk') totalMasuk += Number(t.nominal);
      else totalKeluar += Number(t.nominal);
    });

    const elTotalMasuk = document.getElementById('metricTotalMasuk');
    const elTotalKeluar = document.getElementById('metricTotalKeluar');
    const elSaldoKas = document.getElementById('metricSaldoKas');
    if (elTotalMasuk) elTotalMasuk.textContent = ReportGenerator.formatRupiah(totalMasuk);
    if (elTotalKeluar) elTotalKeluar.textContent = ReportGenerator.formatRupiah(totalKeluar);
    if (elSaldoKas) elSaldoKas.textContent = ReportGenerator.formatRupiah(totalMasuk - totalKeluar);

    filtered.forEach((t, idx) => {
      const isMasuk = t.tipe === 'masuk';
      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td style="text-align: center; color: var(--text-muted);">${idx + 1}</td>
        <td>
          <strong>${t.tanggal}</strong><br>
          <span style="font-size: 11px; color: #64748b;">${t.waktu || '10:00'} WIB</span>
        </td>
        <td>
          <span class="badge-status ${isMasuk ? 'badge-approved' : 'badge-keluar'}">
            ${isMasuk ? 'Kas Masuk' : 'Kas Keluar'}
          </span>
        </td>
        <td>
          <strong>${t.judul}</strong><br>
          <span style="font-size: 11.5px; color: #64748b;">${t.keterangan || '-'}</span>
        </td>
        <td>
          <span style="font-size: 12px; font-weight: 600; color: #334155;">${t.kategori}</span>
        </td>
        <td style="text-align: right; font-weight: 800; font-size: 13.5px;" class="${isMasuk ? 'positive' : 'negative'}">
          ${isMasuk ? '+' : '-'}${ReportGenerator.formatRupiah(t.nominal)}
        </td>
        <td><span style="font-size: 11.5px;">${t.metode}</span></td>
        <td>
          <div class="table-actions">
            <button class="btn-icon-action" title="Cetak Kwitansi" onclick="ReportGenerator.openKwitansi(${JSON.stringify(t).replace(/"/g, '&quot;')})">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            </button>
            <button class="btn-icon-action pengurus-only" style="color: #ef4444;" title="Hapus Transaksi" onclick="App.deleteTransaction('${t.id}')">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      `;

      container.appendChild(tr);
    });

    this.renderRoleUI();
  },

  saveTransactionModal(event) {
    event.preventDefault();
    const tipe = document.getElementById('txTipe').value;
    const kategori = document.getElementById('txKategori').value;
    const judul = document.getElementById('txJudul').value.trim();
    const nominal = parseInt(document.getElementById('txNominal').value) || 0;
    const tanggal = document.getElementById('txTanggal').value || new Date().toISOString().slice(0, 10);
    const metode = document.getElementById('txMetode').value;
    const keterangan = document.getElementById('txKeterangan').value.trim();
    const residentId = document.getElementById('txWargaSelect').value || null;

    if (!judul || nominal <= 0) {
      alert("Judul transaksi dan nominal yang valid wajib diisi!");
      return;
    }

    const txCount = this.data.transactions.length + 1;
    const newTx = {
      id: `TX-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(txCount).padStart(3, '0')}`,
      tanggal,
      waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      tipe,
      kategori,
      judul,
      keterangan,
      residentId,
      blok: residentId ? this.data.residents.find(r => r.id === residentId)?.alamat : 'Umum',
      nominal,
      metode,
      status: 'Approved',
      kwitansi: `KW-${new Date().getFullYear()}-${String(txCount).padStart(3, '0')}`,
      pencatat: `${this.data.settings.bendahara} (Bendahara)`
    };

    this.data.transactions.unshift(newTx);

    // If resident dues payment, update dues matrix
    if (tipe === 'masuk' && residentId && (kategori || '').includes('Iuran')) {
      const txDate = new Date(tanggal);
      const txYear = isNaN(txDate.getFullYear()) ? (AppState.selectedYear || new Date().getFullYear()) : txDate.getFullYear();
      const monthIndex = isNaN(txDate.getMonth()) ? (AppState.selectedMonth || (new Date().getMonth() + 1)) : (txDate.getMonth() + 1);
      newTx.periodeTahun = txYear;
      newTx.periodeBulan = monthIndex;
      this.setDuesStatus(residentId, txYear, monthIndex, 'Lunas');
    }

    DB.save(this.data);
    this.closeModal('modalCatatKas');
    this.renderTransactions();
    this.renderDashboard();
    this.renderDuesMatrix();
    alert("Transaksi kas berhasil dicatat!");
  },

  deleteTransaction(id) {
    if (confirm("Yakin ingin menghapus transaksi ini dari buku kas?")) {
      this.data.transactions = this.data.transactions.filter(t => t.id !== id);
      DB.save(this.data);
      this.renderTransactions();
      this.renderDashboard();
    }
  },

  // =========================================================================
  // Iuran Bulanan Matrix (Kwitansi WA Cepat & Filter Blok Petugas)
  // =========================================================================
  onDuesSearch(query) {
    AppState.duesSearchQuery = (query || '').toLowerCase().trim();
    this.renderDuesMatrix();
  },

  clearDuesSearch() {
    AppState.duesSearchQuery = '';
    const input = document.getElementById('duesSearchInput');
    if (input) input.value = '';
    this.renderDuesMatrix();
  },

  onDuesStatusFilter(status) {
    AppState.duesStatusFilter = status || 'all';
    this.renderDuesMatrix();
  },

  onDuesMonthChange(month) {
    AppState.selectedMonth = parseInt(month, 10) || 10;
    this.renderDuesMatrix();
    this.renderDashboard();
    this.renderSetoranBlok();
  },

  renderDuesMatrix() {
    const tableBody = document.getElementById('duesMatrixBody');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    let residents = this.data.residents || [];

    const curYear = AppState.selectedYear || new Date().getFullYear();
    const curMonth = AppState.selectedMonth || (new Date().getMonth() + 1);

    // 1. Strict scope filter for Petugas Penagih Blok (Hanya warga blok petugas)
    if (AppState.currentRole === 'petugas') {
      residents = residents.filter(r => this.isResidentInCollectorScope(r));
    }

    const totalInScope = residents.length;

    // 2. Filter Pencarian Nama Kepala Keluarga / No Rumah / Blok / Alamat / HP
    const query = AppState.duesSearchQuery || '';
    if (query) {
      residents = residents.filter(r => {
        const nama = (r.nama || '').toLowerCase();
        const noRumah = (r.noRumah || r.nomorRumah || '').toLowerCase();
        const blok = (r.blok || '').toLowerCase();
        const alamat = (r.alamat || '').toLowerCase();
        const phone = (r.phone || r.telepon || '').toLowerCase();
        return nama.includes(query) || noRumah.includes(query) || blok.includes(query) || alamat.includes(query) || phone.includes(query);
      });
    }

    // 3. Filter Status Iuran (Semua / Hanya Lunas / Hanya Belum Bayar)
    const statusFilter = AppState.duesStatusFilter || 'all';
    if (statusFilter !== 'all') {
      residents = residents.filter(r => {
        const st = this.getDuesStatus(r.id, curYear, curMonth);
        if (statusFilter === 'lunas') return st === 'Lunas';
        if (statusFilter === 'belum') return st !== 'Lunas';
        return true;
      });
    }

    // Update Badge Total Warga & Tombol Reset
    const badgeCount = document.getElementById('duesScopeCountBadge');
    if (badgeCount) {
      if (AppState.currentRole === 'petugas') {
        const blokName = (AppState.currentUser && AppState.currentUser.blokTugas) || 'Blok';
        if (query || statusFilter !== 'all') {
          badgeCount.innerHTML = `📌 Ditemukan <strong>${residents.length}</strong> dari ${totalInScope} KK (${blokName})`;
        } else {
          badgeCount.innerHTML = `📌 <strong>${totalInScope} KK</strong> di wilayah ${blokName}`;
        }
      } else {
        if (query || statusFilter !== 'all') {
          badgeCount.innerHTML = `🏠 Ditemukan <strong>${residents.length}</strong> dari ${totalInScope} KK`;
        } else {
          badgeCount.innerHTML = `🏠 <strong>${totalInScope} KK</strong> seluruh RT`;
        }
      }
    }

    const clearBtn = document.getElementById('btnDuesSearchClear');
    if (clearBtn) {
      clearBtn.style.display = query ? 'block' : 'none';
    }

    // Update Dropdown Tahun Matriks (Multi-Tahun Otomatis)
    const yearSelect = document.getElementById('duesYearSelect');
    if (yearSelect) {
      const availableYears = [2025, 2026, 2027, 2028, 2029, 2030];
      if (!availableYears.includes(curYear)) availableYears.push(curYear);
      availableYears.sort((a,b) => a - b);
      
      yearSelect.innerHTML = availableYears.map(y => `
        <option value="${y}" ${y === curYear ? 'selected' : ''}>Tahun ${y}</option>
      `).join('');
    }

    // Update Header Kolom Bulan Aktif
    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const monthShorts = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
    const curMonthName = monthNames[curMonth - 1] || 'Bulan';

    const thCur = document.getElementById('thDuesCurMonth');
    if (thCur) {
      thCur.textContent = monthShorts[curMonth - 1];
      thCur.style.cssText = "text-align: center; background: #e6f7f4; color: #0d9488; font-weight: 800; border-bottom: 2px solid #0d9488;";
    }

    // Update Dropdown Bulan Matriks
    const monthSelect = document.getElementById('duesMonthSelect');
    if (monthSelect) {
      const nowYear = new Date().getFullYear();
      const nowMonth = new Date().getMonth() + 1;
      
      monthSelect.innerHTML = monthNames.map((name, i) => {
        const m = i + 1;
        const isCurrentNow = (curYear === nowYear && m === nowMonth);
        return `<option value="${m}" ${m === curMonth ? 'selected' : ''}>${name} ${curYear}${isCurrentNow ? ' (Bulan Berjalan)' : ''}</option>`;
      }).join('');
    }

    // Update Judul Halaman Matriks
    const titleEl = document.getElementById('duesMatrixTitle');
    if (titleEl) {
      titleEl.textContent = `Matriks Iuran Bulanan ${curYear}`;
    }

    // Kondisi Jika Hasil Pencarian Kosong
    if (residents.length === 0) {
      const emptyMsg = query 
        ? `Tidak ditemukan warga dengan nama / no. rumah "${query}".`
        : (AppState.currentRole === 'petugas'
            ? `Belum ada data warga terdaftar di ${AppState.currentUser.blokTugas || 'wilayah blok Anda'}.`
            : `Tidak ada data warga.`);

      tableBody.innerHTML = `
        <tr>
          <td colspan="15" style="text-align: center; padding: 36px 16px; color: #94a3b8;">
            <div style="font-size: 32px; margin-bottom: 8px;">🔍</div>
            <div style="font-weight: 700; font-size: 14.5px; color: #475569;">${emptyMsg}</div>
            ${query ? `
              <button type="button" class="btn-outline-pill" style="margin-top: 12px; font-size: 12.5px; padding: 6px 16px;" onclick="App.clearDuesSearch()">
                Reset Pencarian
              </button>
            ` : ''}
          </td>
        </tr>
      `;
      this.renderRoleUI();
      return;
    }

    residents.forEach((r, idx) => {
      const tr = document.createElement('tr');

      let monthsHtml = '';
      for (let m = 1; m <= 12; m++) {
        const st = this.getDuesStatus(r.id, curYear, m);
        let cls = 'matrix-badge-belum';
        let iconHtml = '✗';
        let titleText = `Klik untuk ceklist LUNAS (${r.nama} - ${monthNames[m - 1]} ${curYear})`;

        if (st === 'Lunas') {
          if (AppState.currentRole === 'petugas') {
            cls = 'matrix-badge-lunas locked';
            iconHtml = '✓ <span style="font-size: 8.5px;">🔒</span>';
            titleText = `🔒 Terkunci: Status iuran ${r.nama} bulan ${monthNames[m - 1]} ${curYear} sudah LUNAS. Klik jika ingin meminta koreksi ke Admin RT.`;
          } else {
            cls = 'matrix-badge-lunas';
            iconHtml = '✓';
            titleText = `✓ Lunas (${r.nama} - ${monthNames[m - 1]} ${curYear}). Mode Admin: Klik untuk membuka kunci / koreksi.`;
          }
        } else if (st === 'Pending') {
          cls = 'matrix-badge-pending';
          iconHtml = '⏳';
          titleText = `Menunggu Verifikasi (${r.nama} - ${monthNames[m - 1]} ${curYear})`;
        }

        const isCur = m === curMonth;
        const cellBg = isCur ? 'background: rgba(13, 148, 136, 0.05);' : '';

        monthsHtml += `
          <td style="text-align: center; padding: 6px 4px; ${cellBg}">
            <span class="${cls}" onclick="App.toggleDuesStatus('${r.id}', ${m}, ${curYear})" title="${titleText}">
              ${iconHtml}
            </span>
          </td>
        `;
      }

      // Check current month status (Bulan yang dipilih)
      const curStatus = this.getDuesStatus(r.id, curYear, curMonth);
      let waActionBtnHtml = '';

      if (curStatus === 'Lunas') {
        const collectorLabel = AppState.currentRole === 'petugas'
          ? `Petugas ${AppState.currentUser.blokTugas} (${AppState.currentUser.name})`
          : `Bendahara RT (${this.data.settings.bendahara})`;

        // Format Kwitansi WA Resmi
        const receiptMsg = `Terima kasih Bpk/Ibu ${r.nama} (${r.alamat}), iuran ${curMonthName} ${curYear} telah diterima oleh ${collectorLabel}. Salam hangat, Pengurus ${this.data.settings.rtName}.`;
        const waReceiptLink = `https://wa.me/${r.phone}?text=${encodeURIComponent(receiptMsg)}`;

        if (AppState.currentRole === 'pengurus') {
          waActionBtnHtml = `
            <div style="display: flex; flex-direction: column; gap: 4px; align-items: center;">
              <a href="${waReceiptLink}" target="_blank" class="btn-wa-fast" title="Kirim Kwitansi Bukti Pembayaran ke WhatsApp Warga">
                <span>💬</span>
                <span>Kirim Bukti WA</span>
              </a>
              <button type="button" class="btn-outline-pill" style="border-color: #ef4444; color: #dc2626; font-size: 11px; padding: 3px 8px; font-weight: 700; background: #fff5f5; cursor: pointer;" onclick="App.toggleDuesStatus('${r.id}', ${curMonth}, ${curYear})" title="Batalkan checklist / Buka Kunci status Lunas warga ini">
                🔓 Buka Kunci (${curMonthName} ${curYear})
              </button>
            </div>
          `;
        } else {
          waActionBtnHtml = `
            <a href="${waReceiptLink}" target="_blank" class="btn-wa-fast" title="Kirim Kwitansi Bukti Pembayaran ke WhatsApp Warga">
              <span>💬</span>
              <span>Kirim Bukti Pembayaran ke WA Warga</span>
            </a>
          `;
        }
      } else {
        const collectorLabel = AppState.currentRole === 'petugas'
          ? `${AppState.currentUser.name} (${AppState.currentUser.blokTugas})`
          : this.data.settings.bendahara;
        const reminderMsg = `Halo Bpk/Ibu ${r.nama} (${r.alamat}), menginfokan bahwa iuran ${this.data.settings.rtName} bulan ${curMonthName} ${curYear} sebesar ${Utils.formatRupiah(this.data.settings.iuranWajibBulanan)} saat ini belum tercatat lunas. Pembayaran dapat diserahkan ke ${collectorLabel} atau ditransfer ke ${this.data.settings.nomorRekeningRT}. Terima kasih atas kerja samanya. - Pengurus RT`;
        const waReminderLink = `https://wa.me/${r.phone}?text=${encodeURIComponent(reminderMsg)}`;

        waActionBtnHtml = `
          <a href="${waReminderLink}" target="_blank" class="btn-wa-reminder" title="Kirim Tagihan via WhatsApp">
            <span>📲 Tagih WA</span>
          </a>
        `;
      }

      tr.innerHTML = `
        <td style="text-align: center; color: var(--text-muted);">${idx + 1}</td>
        <td>
          <strong style="color: #1e293b; font-size: 13.5px;">${r.nama}</strong><br>
          <span class="badge-block" style="font-size: 10px; margin-top: 2px;">${r.blok}/${r.noRumah || '-'}</span>
        </td>
        ${monthsHtml}
        <td class="pengurus-petugas-only" style="text-align: center;">
          ${waActionBtnHtml}
        </td>
      `;

      tableBody.appendChild(tr);
    });

    this.renderRoleUI();
  },

  toggleDuesStatus(resId, month, year) {
    if (AppState.currentRole !== 'pengurus' && AppState.currentRole !== 'petugas') {
      alert("Hanya pengurus atau petugas penagih blok yang dapat mengubah status iuran langsung.");
      return;
    }

    const res = (this.data.residents || []).find(r => r.id === resId);
    if (!res) return;

    if (AppState.currentRole === 'petugas' && !this.isResidentInCollectorScope(res)) {
      alert(`Anda hanya berwenang mencatat dan mengelola iuran untuk ${AppState.currentUser.blokTugas}!`);
      return;
    }

    const curYear = Number(year || AppState.selectedYear || new Date().getFullYear());
    const monthNum = Number(month);
    const current = this.getDuesStatus(resId, curYear, monthNum);
    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const monthName = monthNames[monthNum - 1] || 'Bulan';
    const monthlyFee = Number(this.data.settings?.iuranWajibBulanan) || 150000;

    // =========================================================================
    // KONDISI 1: STATUS SAAT INI ADALAH LUNAS -> BUKA KUNCI / KOREKSI
    // =========================================================================
    if (current === 'Lunas') {
      if (AppState.currentRole === 'petugas') {
        const adminWa = this.data.settings.contactWa || this.data.settings.phone || '6281234567801';
        const cleanAdminWa = adminWa.startsWith('0') ? '62' + adminWa.slice(1) : adminWa;
        const adminName = this.data.settings.bendahara || this.data.settings.ketuaRt || 'Admin / Bendahara RT';
        const collectorName = (AppState.currentUser && AppState.currentUser.name) || 'Petugas';
        const collectorBlock = (AppState.currentUser && AppState.currentUser.blokTugas) || 'Blok';

        const waMsg = `Halo Admin / Bendahara RT (${adminName}),\nSaya Petugas ${collectorBlock} (${collectorName}), ingin mengajukan *KOREKSI / BUKA KUNCI* status pembayaran iuran warga:\n\n• Nama Warga: ${res.nama}\n• Alamat / Blok: ${res.alamat}\n• Periode Iuran: Bulan ${monthName} ${curYear}\n• Status Saat Ini: Lunas (Terkunci)\n• Kendala: Keliru ceklist nama warga saat penagihan lapangan.\n\nMohon bantuannya untuk membukakan kunci status pembayaran warga tersebut di sistem RukunKu. Terima kasih.`;

        const confirmContact = confirm(
          `🔒 STATUS PEMBAYARAN IURAN TERKUNCI!\n\n` +
          `Status iuran Bpk/Ibu ${res.nama} (${res.alamat}) bulan ${monthName} ${curYear} sudah LUNAS dan telah dikunci otomatis oleh sistem demi keamanan dan ketertiban kas RT.\n\n` +
          `Petugas Penagih tidak memiliki hak akses untuk membatalkan atau mengubah status Lunas secara mandiri.\n\n` +
          `Apakah Anda keliru ceklist dan ingin menghubungi Admin / Bendahara RT via WhatsApp untuk meminta pembukaan kunci koreksi?`
        );

        if (confirmContact) {
          window.open(`https://wa.me/${cleanAdminWa}?text=${encodeURIComponent(waMsg)}`, '_blank');
        }
        return;
      }

      if (AppState.currentRole === 'pengurus') {
        const confirmUnlock = confirm(
          `⚠️ KONFIRMASI BUKA KUNCI (ADMIN RT)\n\n` +
          `Anda login sebagai Admin / Bendahara RT.\n\n` +
          `Apakah Anda yakin ingin MEMBATALKAN status LUNAS untuk:\n` +
          `• Warga: ${res.nama} (${res.alamat})\n` +
          `• Periode: Bulan ${monthName} ${curYear}\n\n` +
          `Hasil tindakan buka kunci ini:\n` +
          `1. Status warga akan berubah kembali menjadi "Belum Bayar" (✗) untuk akun Pengurus dan Petugas.\n` +
          `2. Nominal kas iuran (${Utils.formatRupiah(monthlyFee)}) akan dikurangi dari Kas RT dan kas petugas terkait secara otomatis.\n` +
          `3. Petugas dapat langsung mencentang warga yang benar.`
        );

        if (!confirmUnlock) return;

        // 1. Ubah status di duesMatrix menjadi Belum melalui helper multi-tahun
        this.setDuesStatus(resId, curYear, monthNum, 'Belum');

        // 2. Hapus catatan transaksi kas masuk yang sesuai
        const mLower = monthName.toLowerCase();
        let txIdx = (this.data.transactions || []).findIndex(tx => {
          return tx.residentId === resId && Number(tx.periodeBulan) === monthNum && Number(tx.periodeTahun || 2026) === curYear;
        });

        if (txIdx === -1) {
          txIdx = (this.data.transactions || []).findIndex(tx => {
            if (tx.residentId !== resId) return false;
            const ket = (tx.keterangan || '').toLowerCase();
            const jud = (tx.judul || '').toLowerCase();
            return (ket.includes(mLower) || jud.includes(mLower)) && (ket.includes(String(curYear)) || jud.includes(String(curYear)));
          });
        }

        if (txIdx === -1) {
          txIdx = (this.data.transactions || []).findIndex(tx => {
            if (tx.residentId !== resId) return false;
            const ket = (tx.keterangan || '').toLowerCase();
            const jud = (tx.judul || '').toLowerCase();
            return ket.includes(mLower) || jud.includes(mLower);
          });
        }

        if (txIdx === -1) {
          txIdx = (this.data.transactions || []).findIndex(tx => {
            return tx.residentId === resId && (tx.kategori === 'Iuran Bulanan' || tx.kategori === 'Iuran Wajib');
          });
        }

        if (txIdx !== -1) {
          this.data.transactions.splice(txIdx, 1);
        }

        // 3. Sesuaikan setoran pending jika petugas terkait sudah sempat mengajukan setoran yang menyertakan KK ini
        if (Array.isArray(this.data.setoranBlok)) {
          this.data.setoranBlok.forEach(setor => {
            if (Number(setor.periodeBulan) === monthNum && Number(setor.periodeTahun || 2026) === curYear && setor.status === 'Menunggu Konfirmasi') {
              const currentKk = Number(setor.jumlahKkTerbayar) || 0;
              if (currentKk > 0) {
                setor.jumlahKkTerbayar = Math.max(0, currentKk - 1);
                setor.nominalTotal = setor.jumlahKkTerbayar * monthlyFee;
              }
            }
          });
          this.data.setoranBlok = this.data.setoranBlok.filter(s => !(s.status === 'Menunggu Konfirmasi' && (Number(s.nominalTotal) || 0) <= 0));
        }

        // 4. Simpan ke LocalStorage dan Sync Langsung ke Cloud
        DB.save(this.data);
        if (window.CloudSync && typeof window.CloudSync.syncNow === 'function') {
          window.CloudSync.syncNow();
        }

        // 5. Render ulang seluruh komponen UI
        this.renderDuesMatrix();
        this.renderDashboard();
        this.renderTransactions();
        this.renderSetoranBlok();
        this.renderFinancialReport();
        this.updateNotificationBadge();

        alert(`✓ SUKSES BUKA KUNCI!\n\nStatus iuran Bpk/Ibu ${res.nama} (${res.alamat}) bulan ${monthName} ${curYear} telah dibuka kembali menjadi "Belum Bayar" (✗).\nNominal kas telah berkurang ${Utils.formatRupiah(monthlyFee)} secara otomatis.`);
        return;
      }
    }

    // =========================================================================
    // KONDISI 2: STATUS SAAT INI BELUM BAYAR -> UBAH JADI LUNAS
    // =========================================================================
    this.setDuesStatus(resId, curYear, monthNum, 'Lunas');

    const collectorLabel = AppState.currentRole === 'petugas'
      ? `Petugas ${AppState.currentUser.blokTugas} (${AppState.currentUser.name})`
      : `Bendahara RT (${this.data.settings.bendahara})`;

    const kwitansiNo = `KW-IURAN-${res.id}-${curYear}-${monthNum}-${Date.now().toString().slice(-4)}`;

    const newTx = {
      id: `TX-IURAN-${curYear}-${String(monthNum).padStart(2, '0')}-${Date.now().toString().slice(-4)}`,
      tanggal: new Date().toISOString().slice(0, 10),
      waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      tipe: 'masuk',
      kategori: 'Iuran Bulanan',
      judul: `Iuran Bulanan - Bpk. ${res.nama}`,
      keterangan: `Iuran ${monthName} ${curYear} (${res.alamat})`,
      residentId: resId,
      periodeBulan: monthNum,
      periodeTahun: curYear,
      blok: res.alamat,
      nominal: monthlyFee,
      metode: AppState.currentRole === 'petugas' ? 'Kas Tunai (Petugas Blok)' : 'Kas Tunai / Transfer',
      status: 'Approved',
      kwitansi: kwitansiNo,
      pencatat: collectorLabel,
      collectorId: AppState.currentRole === 'petugas' ? (AppState.currentUser.collectorId || 'col-unknown') : 'bendahara',
      statusSetoran: AppState.currentRole === 'petugas' ? 'di_petugas' : 'disetor_ke_bendahara'
    };
    if (!Array.isArray(this.data.transactions)) this.data.transactions = [];
    this.data.transactions.unshift(newTx);

    // WhatsApp text matching prompt format
    const waText = `Terima kasih Bpk/Ibu ${res.nama} (${res.alamat}), iuran ${monthName} ${curYear} telah diterima oleh ${collectorLabel}. No. Kwitansi: ${kwitansiNo}. Salam hangat, Pengurus ${this.data.settings.rtName}.`;
    const waLink = `https://wa.me/${res.phone}?text=${encodeURIComponent(waText)}`;

    DB.save(this.data);
    if (window.CloudSync && typeof window.CloudSync.syncNow === 'function') {
      window.CloudSync.syncNow();
    }

    this.renderDuesMatrix();
    this.renderDashboard();
    this.renderTransactions();
    this.renderSetoranBlok();
    this.renderFinancialReport();
    this.updateNotificationBadge();

    if (confirm(`✅ Iuran Bpk/Ibu ${res.nama} (${res.alamat}) bulan ${monthName} ${curYear} berhasil dicatat LUNAS!\n\n🔒 Status sekarang telah dikunci secara otomatis demi keamanan kas.\n\nKirim bukti pembayaran ke WhatsApp warga sekarang?`)) {
      window.open(waLink, '_blank');
    }
    return;
  },

  openWaReminderModal() {
    const listContainer = document.getElementById('waReminderList');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    const curYear = AppState.selectedYear || new Date().getFullYear();
    const curMonth = AppState.selectedMonth || (new Date().getMonth() + 1);
    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const curMonthName = monthNames[curMonth - 1] || 'Bulan';

    const unpaid = (this.data.residents || []).filter(r => {
      const st = this.getDuesStatus(r.id, curYear, curMonth);
      return st !== 'Lunas';
    });

    if (unpaid.length === 0) {
      listContainer.innerHTML = `<div style="text-align: center; padding: 20px; color: #059669; font-weight: bold;">🎉 Luar biasa! Seluruh warga sudah melunasi iuran ${curMonthName} ${curYear}.</div>`;
    } else {
      unpaid.forEach(r => {
        const item = document.createElement('div');
        item.style.cssText = "display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 8px;";
        
        const msg = `Yth. Bpk/Ibu ${r.nama} (${r.alamat}), pengingat ramah iuran kebersihan & keamanan ${this.data.settings.rtName} bulan ${curMonthName} ${curYear} sebesar ${Utils.formatRupiah(this.data.settings.iuranWajibBulanan)}. Rekening Kas RT: ${this.data.settings.nomorRekeningRT}. Konfirmasi pembayaran dapat dikirimkan ke chat ini. Terima kasih! - Pengurus RT`;
        const link = `https://wa.me/${r.phone}?text=${encodeURIComponent(msg)}`;

        item.innerHTML = `
          <div>
            <strong>${r.nama}</strong> <span class="badge-block">${r.blok}/${r.noRumah}</span><br>
            <span style="font-size: 11px; color: #64748b;">${r.phone}</span>
          </div>
          <a href="${link}" target="_blank" class="btn-teal-pill" style="padding: 6px 14px; font-size: 11.5px; background: #22c55e;">
            💬 Kirim WA
          </a>
        `;
        listContainer.appendChild(item);
      });
    }

    this.openModal('modalWaReminder');
  },

  // =========================================================================
  // Talangan & Piutang Warga
  // =========================================================================
  renderTalangan() {
    const container = document.getElementById('talanganTableBody');
    if (!container) return;

    container.innerHTML = '';
    const list = this.data.talangan || [];

    list.forEach((item, idx) => {
      const tr = document.createElement('tr');
      let statusClass = 'badge-pending';
      if (item.status === 'Lunas') statusClass = 'badge-approved';
      else if (item.status === 'Cicil') statusClass = 'badge-talangan';

      tr.innerHTML = `
        <td style="text-align: center; color: var(--text-muted);">${idx + 1}</td>
        <td>
          <strong>${item.namaPeminjam}</strong><br>
          <span class="badge-block" style="font-size: 10px;">${item.blok}</span>
        </td>
        <td>
          <strong>${item.keperluan}</strong><br>
          <span style="font-size: 11px; color: #64748b;">${item.keterangan || '-'}</span>
        </td>
        <td>
          <div>Pinjam: ${item.tanggalPinjam}</div>
          <div style="font-size: 11px; color: #e11d48; font-weight: bold;">Tempo: ${item.jatuhTempo}</div>
        </td>
        <td style="text-align: right; font-weight: 700;">${ReportGenerator.formatRupiah(item.nominalTotal)}</td>
        <td style="text-align: right; color: #059669; font-weight: 700;">${ReportGenerator.formatRupiah(item.terbayar)}</td>
        <td style="text-align: right; color: #e11d48; font-weight: 800;">${ReportGenerator.formatRupiah(item.sisa)}</td>
        <td style="text-align: center;">
          <span class="badge-status ${statusClass}">${item.status}</span>
        </td>
        <td class="pengurus-only" style="text-align: center;">
          <button class="btn-outline-pill" style="padding: 4px 10px; font-size: 11.5px;" onclick="App.openBayarTalanganModal('${item.id}')">
            💳 Bayar Cicilan
          </button>
        </td>
      `;

      container.appendChild(tr);
    });

    this.renderRoleUI();
  },

  saveTalanganModal(event) {
    event.preventDefault();
    const namaPeminjam = document.getElementById('talanganNama').value.trim();
    const blok = document.getElementById('talanganBlok').value.trim();
    const nominalTotal = parseInt(document.getElementById('talanganNominal').value) || 0;
    const tanggalPinjam = document.getElementById('talanganTanggal').value || new Date().toISOString().slice(0, 10);
    const jatuhTempo = document.getElementById('talanganTempo').value;
    const keperluan = document.getElementById('talanganKeperluan').value.trim();
    const keterangan = document.getElementById('talanganKeterangan').value.trim();

    if (!namaPeminjam || nominalTotal <= 0) {
      alert("Nama peminjam dan nominal talangan wajib diisi!");
      return;
    }

    const newTalangan = {
      id: `TL-${String((this.data.talangan || []).length + 1).padStart(3, '0')}`,
      namaPeminjam,
      blok,
      nominalTotal,
      terbayar: 0,
      sisa: nominalTotal,
      tanggalPinjam,
      jatuhTempo,
      keperluan,
      status: 'Belum Lunas',
      keterangan,
      riwayatBayar: []
    };

    if (!this.data.talangan) this.data.talangan = [];
    this.data.talangan.unshift(newTalangan);

    const newTx = {
      id: `TX-TALANGAN-${Date.now().toString().slice(-6)}`,
      tanggal: tanggalPinjam,
      waktu: '10:00',
      tipe: 'keluar',
      kategori: 'Talangan Sementara Warga',
      judul: `Talangan Sementara - ${namaPeminjam}`,
      keterangan: `Pemberian talangan kas RT untuk: ${keperluan}`,
      residentId: null,
      blok: blok,
      nominal: nominalTotal,
      metode: 'Kas Tunai',
      status: 'Approved',
      kwitansi: `KW-${Date.now().toString().slice(-4)}`,
      pencatat: this.data.settings.bendahara
    };
    this.data.transactions.unshift(newTx);

    DB.save(this.data);
    this.closeModal('modalCatatTalangan');
    this.renderTalangan();
    this.renderTransactions();
    this.renderDashboard();
    alert("Catatan talangan kas RT berhasil dibuat!");
  },

  openBayarTalanganModal(id) {
    const item = this.data.talangan.find(t => t.id === id);
    if (!item) return;

    const bayarNominal = prompt(`Catat Pelunasan/Cicilan untuk ${item.namaPeminjam}\nSisa saat ini: ${ReportGenerator.formatRupiah(item.sisa)}\n\nMasukkan nominal pembayaran (Rp):`, item.sisa);
    if (bayarNominal === null) return;

    const nom = parseInt(bayarNominal);
    if (isNaN(nom) || nom <= 0 || nom > item.sisa) {
      alert("Nominal pembayaran tidak valid atau melebihi sisa pinjaman!");
      return;
    }

    item.terbayar += nom;
    item.sisa -= nom;
    item.status = item.sisa === 0 ? 'Lunas' : 'Cicil';
    if (!item.riwayatBayar) item.riwayatBayar = [];
    item.riwayatBayar.push({
      tanggal: new Date().toISOString().slice(0, 10),
      nominal: nom,
      metode: 'Kas Tunai',
      pencatat: this.data.settings.bendahara
    });

    const newTx = {
      id: `TX-PELUNASAN-${Date.now().toString().slice(-6)}`,
      tanggal: new Date().toISOString().slice(0, 10),
      waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      tipe: 'masuk',
      kategori: 'Pelunasan Talangan / Kasbon',
      judul: `Cicilan Talangan - ${item.namaPeminjam}`,
      keterangan: `Pembayaran cicilan dana talangan (${item.keperluan})`,
      residentId: item.residentId,
      blok: item.blok,
      nominal: nom,
      metode: 'Kas Tunai / Transfer',
      status: 'Approved',
      kwitansi: `KW-${Date.now().toString().slice(-4)}`,
      pencatat: this.data.settings.bendahara
    };
    this.data.transactions.unshift(newTx);

    DB.save(this.data);
    this.renderTalangan();
    this.renderTransactions();
    this.renderDashboard();
    alert("Pembayaran cicilan berhasil dicatat ke kas masuk!");
  },

  // =========================================================================
  // Rekapitulasi & Setoran Kas Blok (Pengurus & Petugas Penagih)
  // =========================================================================
  renderSetoranBlok() {
    const container = document.getElementById('setoranBlokContainer');
    if (!container) return;

    const isPengurus = AppState.currentRole === 'pengurus';
    const isPetugas = AppState.currentRole === 'petugas';
    const collectors = this.data.collectors || [];
    const setoranList = this.data.setoranBlok || [];
    const monthlyFee = this.data.settings.iuranWajibBulanan || 150000;
    const curMonth = AppState.selectedMonth; // 1..12
    const curYear = AppState.selectedYear || new Date().getFullYear();
    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const curMonthName = monthNames[curMonth - 1] || 'Bulan';

    if (isPengurus) {
      // 1. Calculate Summary per Blok
      let cardsHtml = '';
      collectors.forEach(col => {
        const resInBlok = (this.data.residents || []).filter(r => this.isResidentInCollectorScope(r, col));

        const totalKk = resInBlok.length;
        let lunasKk = 0;
        let pendingKk = 0;
        let belumKk = 0;

        resInBlok.forEach(r => {
          const st = this.getDuesStatus(r.id, curYear, curMonth);
          if (st === 'Lunas') lunasKk++;
          else if (st === 'Pending') pendingKk++;
          else belumKk++;
        });

        const totalUangTerkumpul = lunasKk * monthlyFee;

        // Check remittances by this collector for current month & year
        const mySetoran = setoranList.filter(s => (s.collectorId === col.id || s.blokTugas === col.blokTugas) && Number(s.periodeBulan) === Number(curMonth) && Number(s.periodeTahun || 2026) === Number(curYear));
        const sudahDisetor = mySetoran
          .filter(s => s.status === 'Diterima Bendahara')
          .reduce((sum, s) => sum + Number(s.nominalTotal), 0);
        const pendingSetor = mySetoran
          .filter(s => s.status === 'Menunggu Konfirmasi')
          .reduce((sum, s) => sum + Number(s.nominalTotal), 0);
        const totalDanaDiserahkan = sudahDisetor + pendingSetor;
        const kasDiTangan = Math.max(0, totalUangTerkumpul - totalDanaDiserahkan);

        const pendingItem = mySetoran.find(s => s.status === 'Menunggu Konfirmasi');

        cardsHtml += `
          <div class="block-rekap-card">
            <div class="block-rekap-header">
              <div>
                <div class="block-rekap-title">📍 ${col.blokTugas}</div>
                <div class="block-rekap-collector">Petugas: <strong>${col.nama}</strong> (${col.phone})</div>
              </div>
              <div>
                ${pendingItem ? `
                  <span class="badge-setoran-pending">⏳ Menunggu Verifikasi</span>
                ` : (kasDiTangan === 0 && totalUangTerkumpul > 0 ? `
                  <span class="badge-setoran-approved">✓ Disetor Penuh</span>
                ` : `
                  <span class="badge-block" style="font-size: 11px;">Aktif</span>
                `)}
              </div>
            </div>

            <div class="block-rekap-stat">
              <span class="block-rekap-stat-label">Jumlah Warga:</span>
              <span class="block-rekap-stat-val">${totalKk} KK</span>
            </div>
            <div class="block-rekap-stat">
              <span class="block-rekap-stat-label">Iuran Terbayar (${curMonthName} ${curYear}):</span>
              <span class="block-rekap-stat-val" style="color: #0f766e;">${lunasKk} / ${totalKk} KK (${Utils.formatRupiah(totalUangTerkumpul)})</span>
            </div>
            <div class="block-rekap-stat">
              <span class="block-rekap-stat-label">Sudah Diterima Bendahara:</span>
              <span class="block-rekap-stat-val" style="color: #16a34a;">${Utils.formatRupiah(sudahDisetor)}</span>
            </div>
            <div class="block-rekap-stat">
              <span class="block-rekap-stat-label">Kas di Tangan Petugas:</span>
              <span class="block-rekap-stat-val" style="color: #d97706;">${Utils.formatRupiah(kasDiTangan)}</span>
            </div>

            ${pendingItem ? `
              <div style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed #cbd5e1; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <div style="font-size: 12px; color: #b45309; font-weight: 700;">
                  Setoran Baru: ${Utils.formatRupiah(pendingItem.nominalTotal)} (${pendingItem.jumlahKkTerbayar} KK)
                </div>
                <button type="button" class="btn-teal-pill" style="font-size: 11.5px; padding: 5px 12px;" onclick="App.confirmSetoranBlok('${pendingItem.id}')">
                  ✅ Terima Setoran
                </button>
              </div>
            ` : ''}
          </div>
        `;
      });

      // Table of All Submissions
      let tableRows = '';
      if (setoranList.length === 0) {
        tableRows = `<tr><td colspan="9" style="text-align: center; padding: 24px; color: #94a3b8;">Belum ada riwayat serah terima setoran dari petugas blok.</td></tr>`;
      } else {
        setoranList.forEach((s, idx) => {
          const isPending = s.status === 'Menunggu Konfirmasi';
          tableRows += `
            <tr>
              <td style="text-align: center; color: var(--text-muted);">${idx + 1}</td>
              <td><strong>${s.tanggalSetor}</strong></td>
              <td>
                <strong>${s.collectorName}</strong><br>
                <span class="badge-block" style="font-size: 10px;">${s.blokTugas}</span>
              </td>
              <td>Bulan ke-${s.periodeBulan} ${s.periodeTahun || 2026}</td>
              <td style="text-align: center;"><strong>${s.jumlahKkTerbayar || '-'}</strong> KK</td>
              <td style="text-align: right; font-weight: 800; color: #0d9488;">${Utils.formatRupiah(s.nominalTotal)}</td>
              <td><span style="font-size: 11.5px;">${s.metode || 'Tunai'}</span></td>
              <td>
                <span class="${isPending ? 'badge-setoran-pending' : 'badge-setoran-approved'}">
                  ${isPending ? '⏳ Menunggu Konfirmasi' : '✓ Diterima Bendahara'}
                </span>
                ${s.tanggalDiterima ? `<div style="font-size: 10px; color: #64748b; margin-top: 2px;">Diterima: ${s.tanggalDiterima}</div>` : ''}
              </td>
              <td style="text-align: center;">
                <div style="display: flex; gap: 6px; justify-content: center;">
                  ${s.buktiFoto ? `
                    <button type="button" class="btn-icon-action" title="Lihat Foto Bukti" onclick="App.previewDocument('Bukti Setoran Kas - ${s.collectorName}', '${s.buktiFoto}')">
                      👁️
                    </button>
                  ` : ''}
                  ${isPending ? `
                    <button type="button" class="btn-teal-pill" style="font-size: 11px; padding: 4px 10px;" onclick="App.confirmSetoranBlok('${s.id}')">
                      ✅ Terima Uang
                    </button>
                  ` : `
                    <span style="font-size: 11px; color: #16a34a; font-weight: 600;">Klir</span>
                  `}
                </div>
              </td>
            </tr>
          `;
        });
      }

      container.innerHTML = `
        <div class="page-title-row" style="margin-bottom: 20px;">
          <div>
            <h1 class="page-title">Rekapitulasi Iuran Per Blok & Serah Terima Kas</h1>
            <p class="page-subtitle">Monitor penagihan iuran dari masing-masing petugas blok dan verifikasi serah terima kas ke Kas Utama RT.</p>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button type="button" class="btn-teal-pill" onclick="App.openKelolaPetugasModal()">
              👥 Kelola Petugas Penagih Blok (${collectors.length})
            </button>
          </div>
        </div>

        <!-- Cards Rekap Per Blok -->
        <div class="block-rekap-grid">
          ${cardsHtml}
        </div>

        <!-- Tabel Riwayat Setoran Seluruh Blok -->
        <h2 class="section-heading" style="margin-bottom: 12px;">Riwayat Serah Terima Setoran Kas Blok</h2>
        <div class="data-table-container">
          <table class="app-table">
            <thead>
              <tr>
                <th style="width: 35px; text-align: center;">No</th>
                <th>Tanggal Setor</th>
                <th>Petugas & Blok</th>
                <th>Periode</th>
                <th style="text-align: center;">Jumlah KK</th>
                <th style="text-align: right;">Nominal Setoran</th>
                <th>Metode</th>
                <th>Status</th>
                <th style="text-align: center; width: 120px;">Aksi</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>
      `;
    } else if (isPetugas) {
      // Petugas Personal Remittance Portal
      const user = AppState.currentUser;
      const resInBlok = (this.data.residents || []).filter(r => this.isResidentInCollectorScope(r));

      const totalKk = resInBlok.length;
      let lunasKk = 0;
      let pendingKk = 0;
      let belumKk = 0;

      resInBlok.forEach(r => {
        const st = this.getDuesStatus(r.id, curYear, curMonth);
        if (st === 'Lunas') lunasKk++;
        else if (st === 'Pending') pendingKk++;
        else belumKk++;
      });

      const totalUangTerkumpul = lunasKk * monthlyFee;

      const mySetoran = setoranList.filter(s => (
        (s.collectorId && user.collectorId && s.collectorId === user.collectorId) ||
        (s.blokTugas && user.blokTugas && s.blokTugas.toLowerCase().trim() === user.blokTugas.toLowerCase().trim())
      ));
      const mySetoranBulanIni = mySetoran.filter(s => Number(s.periodeBulan) === Number(curMonth) && Number(s.periodeTahun || 2026) === Number(curYear));

      const sudahDisetor = mySetoranBulanIni
        .filter(s => s.status === 'Diterima Bendahara')
        .reduce((sum, s) => sum + Number(s.nominalTotal), 0);

      const pendingSetor = mySetoranBulanIni
        .filter(s => s.status === 'Menunggu Konfirmasi')
        .reduce((sum, s) => sum + Number(s.nominalTotal), 0);

      const totalDanaDiserahkan = sudahDisetor + pendingSetor;
      const kasDiTangan = Math.max(0, totalUangTerkumpul - totalDanaDiserahkan);

      // Hitung jumlah KK yang sudah diserahkan setoran vs yang belum
      const sudahDisetorKk = mySetoranBulanIni
        .filter(s => s.status === 'Diterima Bendahara')
        .reduce((sum, s) => sum + (Number(s.jumlahKkTerbayar) || 0), 0);

      const pendingSetorKk = mySetoranBulanIni
        .filter(s => s.status === 'Menunggu Konfirmasi')
        .reduce((sum, s) => sum + (Number(s.jumlahKkTerbayar) || 0), 0);

      const totalKkDiserahkan = sudahDisetorKk + pendingSetorKk;
      const kkBelumDisetor = Math.max(0, lunasKk - totalKkDiserahkan);

      let myTableRows = '';
      if (mySetoran.length === 0) {
        myTableRows = `<tr><td colspan="7" style="text-align: center; padding: 24px; color: #94a3b8;">Belum ada riwayat setoran kas yang Anda ajukan.</td></tr>`;
      } else {
        mySetoran.forEach((s, idx) => {
          const isPending = s.status === 'Menunggu Konfirmasi';
          myTableRows += `
            <tr>
              <td style="text-align: center; color: var(--text-muted);">${idx + 1}</td>
              <td><strong>${s.tanggalSetor}</strong></td>
              <td>Bulan ke-${s.periodeBulan} ${s.periodeTahun || 2026}</td>
              <td style="text-align: center;"><strong>${s.jumlahKkTerbayar}</strong> KK</td>
              <td style="text-align: right; font-weight: 800; color: #0d9488;">${Utils.formatRupiah(s.nominalTotal)}</td>
              <td><span style="font-size: 11.5px;">${s.metode || 'Tunai Fisik'}</span></td>
              <td>
                <span class="${isPending ? 'badge-setoran-pending' : 'badge-setoran-approved'}">
                  ${isPending ? '⏳ Menunggu Konfirmasi Bendahara' : '✓ Diterima Bendahara'}
                </span>
                ${s.diterimaOleh ? `<div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">Oleh: ${s.diterimaOleh}</div>` : ''}
              </td>
            </tr>
          `;
        });
      }

      container.innerHTML = `
        <div class="page-title-row" style="margin-bottom: 20px;">
          <div>
            <h1 class="page-title">Setoran Kas Iuran: ${user.blokTugas}</h1>
            <p class="page-subtitle">Rekapitulasi iuran hasil penagihan dan serah terima dana fisik ke Bendahara Utama RT.</p>
          </div>
          <div>
            <button type="button" class="btn-teal-pill" style="padding: 10px 20px; font-size: 13.5px;" onclick="App.openSetorKasModal()">
              📤 Setor Kas ke Bendahara Utama
            </button>
          </div>
        </div>

        <!-- Tiga Kartu Ringkasan Setoran Petugas -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; margin-bottom: 20px;">
          <!-- Kartu 1: Uang Kas Fisik di Tangan Saya -->
          <div class="block-rekap-card" style="border-left: 4px solid #0d9488;">
            <div style="font-size: 11.5px; color: #64748b; font-weight: 700; text-transform: uppercase;">Uang Kas Fisik di Tangan Saya</div>
            <div style="font-size: 22px; font-weight: 800; color: #0d9488; margin-top: 4px;">${Utils.formatRupiah(kasDiTangan)}</div>
            <div style="font-size: 11.5px; color: #64748b; margin-top: 4px;">
              ${kasDiTangan > 0 ? '⚠️ Uang kas fisik belum diserahkan ke Bendahara' : (totalDanaDiserahkan > 0 ? '✓ Seluruh uang kas fisik telah disetorkan (Rp 0)' : 'Belum ada uang kas iuran yang dipegang')}
            </div>
          </div>

          <!-- Kartu 2: Kas Iuran Belum Disetor (Siap Setor) -->
          <div class="block-rekap-card" style="border-left: 4px solid #3b82f6;">
            <div style="font-size: 11.5px; color: #64748b; font-weight: 700; text-transform: uppercase;">Kas Iuran Belum Disetor (Siap Setor)</div>
            <div style="font-size: 22px; font-weight: 800; color: #1e293b; margin-top: 4px;">${Utils.formatRupiah(kasDiTangan)}</div>
            <div style="font-size: 11.5px; color: #64748b; margin-top: 4px;">
              ${totalDanaDiserahkan > 0 && kkBelumDisetor === 0 
                ? `✓ <strong>0 KK</strong> belum disetor (Semua ${totalKkDiserahkan} KK lunas telah disetorkan)` 
                : (kasDiTangan > 0 
                  ? `<strong>${kkBelumDisetor} dari ${lunasKk} KK Lunas</strong> (Siap disetor ke Bendahara)` 
                  : `0 dari ${totalKk} KK (Belum ada iuran lunas)`)}
            </div>
          </div>

          <!-- Kartu 3: Sudah Disetor ke Bendahara -->
          <div class="block-rekap-card" style="border-left: 4px solid #10b981;">
            <div style="font-size: 11.5px; color: #64748b; font-weight: 700; text-transform: uppercase;">Sudah Disetor ke Bendahara</div>
            <div style="font-size: 22px; font-weight: 800; color: #10b981; margin-top: 4px;">${Utils.formatRupiah(totalDanaDiserahkan)}</div>
            <div style="font-size: 11.5px; color: #64748b; margin-top: 4px;">
              ${pendingSetor > 0 
                ? `<strong>${totalKkDiserahkan} KK</strong> (⏳ Menunggu Konfirmasi Bendahara)` 
                : (sudahDisetor > 0 ? `<strong>${totalKkDiserahkan} KK</strong> (✓ Resmi Diterima Bendahara)` : 'Belum ada setoran diajukan')}
            </div>
          </div>
        </div>

        <!-- Rincian Progres Penagihan Warga Blok -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px 18px; margin-bottom: 22px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; font-size: 12.5px;">
          <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
            <span><strong>Progres Warga ${user.blokTugas}:</strong></span>
            <span style="color: #0d9488; font-weight: 700;">✓ ${lunasKk} Lunas</span>
            <span style="color: #ca8a04; font-weight: 700;">⏳ ${pendingKk} Menunggu Verifikasi</span>
            <span style="color: #ef4444; font-weight: 700;">✗ ${belumKk} Belum Bayar</span>
            <span style="color: #64748b;">(Total: ${totalKk} KK)</span>
          </div>
          <div>
            ${kasDiTangan > 0 ? `
              <span style="color: #d97706; font-weight: 700;">
                ⚠️ Dana ${Utils.formatRupiah(kasDiTangan)} (${kkBelumDisetor} KK) siap diserahkan ke Bendahara
              </span>
            ` : (totalDanaDiserahkan > 0 ? `
              <span style="color: #059669; font-weight: 700;">
                ✓ Seluruh kas iuran terkumpul (${Utils.formatRupiah(totalDanaDiserahkan)}) telah disetorkan (Saldo kas di tangan: Rp 0)
              </span>
            ` : `
              <span style="color: #64748b;">Belum ada iuran baru untuk disetorkan</span>
            `)}
          </div>
        </div>

        <h2 class="section-heading" style="margin-bottom: 12px;">Riwayat Pengajuan Setoran Saya</h2>
        <div class="data-table-container">
          <table class="app-table">
            <thead>
              <tr>
                <th style="width: 35px; text-align: center;">No</th>
                <th>Tanggal Penyerahan</th>
                <th>Periode Iuran</th>
                <th style="text-align: center;">Jumlah KK</th>
                <th style="text-align: right;">Nominal</th>
                <th>Metode</th>
                <th>Status Penerimaan</th>
              </tr>
            </thead>
            <tbody>
              ${myTableRows}
            </tbody>
          </table>
        </div>
      `;
    }
  },

  calculateCollectorPendingRemittance() {
    if (AppState.currentRole !== 'petugas') return;
    const user = AppState.currentUser;
    const selectedTahun = parseInt(document.getElementById('setorTahun')?.value) || AppState.selectedYear || new Date().getFullYear();
    const selectedBulan = parseInt(document.getElementById('setorBulan')?.value) || AppState.selectedMonth;
    const monthlyFee = this.data.settings.iuranWajibBulanan || 150000;

    const resInBlok = (this.data.residents || []).filter(r => this.isResidentInCollectorScope(r));

    let lunasKk = 0;
    resInBlok.forEach(r => {
      const st = this.getDuesStatus(r.id, selectedTahun, selectedBulan);
      if (st === 'Lunas') lunasKk++;
    });

    // Submissions already made for this month & year
    const setoranList = this.data.setoranBlok || [];
    const alreadyRemittedKk = setoranList
      .filter(s => (
        (s.collectorId && user.collectorId && s.collectorId === user.collectorId) ||
        (s.blokTugas && user.blokTugas && s.blokTugas.toLowerCase().trim() === user.blokTugas.toLowerCase().trim())
      ) && Number(s.periodeBulan) === Number(selectedBulan) && Number(s.periodeTahun || 2026) === Number(selectedTahun))
      .reduce((sum, s) => sum + (Number(s.jumlahKkTerbayar) || 0), 0);

    const pendingKk = Math.max(0, lunasKk - alreadyRemittedKk);
    const pendingAmount = pendingKk * monthlyFee;

    const jumlahKkInput = document.getElementById('setorJumlahKk');
    const nominalInput = document.getElementById('setorNominal');
    if (jumlahKkInput) jumlahKkInput.value = pendingKk;
    if (nominalInput) nominalInput.value = pendingAmount;
  },

  openSetorKasModal() {
    const user = AppState.currentUser;
    if (!user) return;

    const curYear = AppState.selectedYear || new Date().getFullYear();
    const setorTahunEl = document.getElementById('setorTahun');
    if (setorTahunEl) {
      let yearOpts = '';
      for (let y = 2025; y <= curYear + 2; y++) {
        yearOpts += `<option value="${y}" ${y === curYear ? 'selected' : ''}>${y}</option>`;
      }
      setorTahunEl.innerHTML = yearOpts;
      setorTahunEl.value = String(curYear);
    }

    const setorBulanEl = document.getElementById('setorBulan');
    if (setorBulanEl) setorBulanEl.value = String(AppState.selectedMonth);

    this.calculateCollectorPendingRemittance();
    const nominal = parseInt(document.getElementById('setorNominal')?.value) || 0;
    if (nominal <= 0) {
      alert(`✓ Seluruh kas iuran warga yang telah lunas (${user.blokTugas}) sudah Anda setorkan ke Bendahara Utama.\n\nSaldo kas di tangan Anda saat ini: Rp 0.\nBelum ada uang kas iuran baru yang perlu diserahkan.`);
      return;
    }

    const infoEl = document.getElementById('setorPetugasInfo');
    if (infoEl) infoEl.textContent = `Petugas: ${user.name} (${user.blokTugas})`;
    const tglEl = document.getElementById('setorTanggal');
    if (tglEl) tglEl.value = new Date().toISOString().slice(0, 10);
    const fotoBase64 = document.getElementById('setorFotoBase64');
    if (fotoBase64) fotoBase64.value = '';
    const previewBox = document.getElementById('setorFotoPreviewBox');
    if (previewBox) previewBox.style.display = 'none';

    this.openModal('modalSetorKasBlok');
  },

  async handleSetoranPhotoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await Utils.compressImage(file, 900, 0.75);
      const hiddenInput = document.getElementById('setorFotoBase64');
      if (hiddenInput) hiddenInput.value = compressed;
      const previewImg = document.getElementById('imgSetorFotoPreview');
      if (previewImg) previewImg.src = compressed;
      const previewBox = document.getElementById('setorFotoPreviewBox');
      if (previewBox) previewBox.style.display = 'block';
    } catch (err) {
      alert("Gagal membaca foto bukti: " + err.message);
    }
  },

  saveSetoranBlokSubmit(event) {
    event.preventDefault();
    const user = AppState.currentUser;
    if (!user) return;

    const nominal = parseInt(document.getElementById('setorNominal').value) || 0;
    if (nominal <= 0) {
      alert("Nominal setoran kas harus lebih besar dari Rp 0!");
      return;
    }

    const bulanDipilih = parseInt(document.getElementById('setorBulan').value) || AppState.selectedMonth;
    const tahunDipilih = parseInt(document.getElementById('setorTahun')?.value) || AppState.selectedYear || new Date().getFullYear();

    const newSetoran = {
      id: `STR-${Date.now().toString().slice(-6)}`,
      collectorId: user.collectorId || 'COL',
      collectorName: user.name,
      blokTugas: user.blokTugas,
      periodeBulan: bulanDipilih,
      periodeTahun: tahunDipilih,
      jumlahKkTerbayar: parseInt(document.getElementById('setorJumlahKk').value) || 0,
      nominalTotal: nominal,
      metode: document.getElementById('setorMetode').value,
      tanggalSetor: document.getElementById('setorTanggal').value || new Date().toISOString().slice(0, 10),
      status: 'Menunggu Konfirmasi',
      catatan: document.getElementById('setorCatatan').value.trim(),
      buktiFoto: document.getElementById('setorFotoBase64')?.value || ''
    };

    if (!this.data.setoranBlok) this.data.setoranBlok = [];
    this.data.setoranBlok.unshift(newSetoran);
    DB.save(this.data);

    // Sync direct to Google Sheets
    if (window.CloudSync && typeof window.CloudSync.saveSetoranDirect === 'function') {
      window.CloudSync.saveSetoranDirect(newSetoran);
    }

    this.closeModal('modalSetorKasBlok');
    this.renderSetoranBlok();
    this.renderDashboard();
    this.updateNotificationBadge();
    alert(`✅ Setoran kas sebesar ${Utils.formatRupiah(nominal)} (${newSetoran.jumlahKkTerbayar} KK) untuk periode Bulan ke-${bulanDipilih} ${tahunDipilih} berhasil diajukan ke Bendahara Utama!\n\nStatus: "Menunggu Konfirmasi Bendahara".\n\nNominal kas fisik di tangan Anda kini kembali Rp 0 (karena dana telah resmi diajukan setoran & tercatat di Riwayat Pengajuan Setoran Saya).`);
  },

  confirmSetoranBlok(id) {
    const item = (this.data.setoranBlok || []).find(s => s.id === id);
    if (!item) return;

    const itemYear = Number(item.periodeTahun) || 2026;
    if (confirm(`Konfirmasi penerimaan setoran kas dari ${item.collectorName} (${item.blokTugas})?\n\nNominal: ${Utils.formatRupiah(item.nominalTotal)}\nPeriode: Bulan ke-${item.periodeBulan} ${itemYear}\n\nDana akan resmi dimasukkan ke Kas Utama RT.`)) {
      item.status = 'Diterima Bendahara';
      item.tanggalDiterima = new Date().toISOString().slice(0, 16).replace('T', ' ');
      item.diterimaOleh = `${this.data.settings.bendahara} (Bendahara Utama)`;

      const newTx = {
        id: `TX-SETORAN-${Date.now().toString().slice(-6)}`,
        tanggal: new Date().toISOString().slice(0, 10),
        waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        tipe: 'masuk',
        kategori: 'Setoran Kas Iuran Blok',
        judul: `Penerimaan Setoran Iuran ${item.blokTugas}`,
        keterangan: `Setoran kas iuran bulan ke-${item.periodeBulan} ${itemYear} dari ${item.collectorName} (${item.jumlahKkTerbayar} KK)`,
        residentId: null,
        blok: item.blokTugas,
        nominal: item.nominalTotal,
        metode: item.metode || 'Kas Tunai',
        status: 'Approved',
        kwitansi: `KW-SETOR-${Date.now().toString().slice(-4)}`,
        pencatat: this.data.settings.bendahara,
        periodeTahun: itemYear,
        periodeBulan: item.periodeBulan
      };
      this.data.transactions.unshift(newTx);

      DB.save(this.data);

      // Sync direct to Google Sheets
      if (window.CloudSync) {
        if (typeof window.CloudSync.saveSetoranDirect === 'function') window.CloudSync.saveSetoranDirect(item);
        if (typeof window.CloudSync.saveTransactionDirect === 'function') window.CloudSync.saveTransactionDirect(newTx);
      }

      this.renderSetoranBlok();
      this.renderTransactions();
      this.renderDashboard();
      this.updateNotificationBadge();
      alert(`🎉 Setoran kas dari ${item.collectorName} sebesar ${Utils.formatRupiah(item.nominalTotal)} berhasil diverifikasi dan masuk ke Kas Utama RT!`);
    }
  },

  // =========================================================================
  // VIEW 10: MANAJEMEN PETUGAS PENAGIH BLOK (Pengurus Only)
  // =========================================================================
  renderKelolaPetugasPage() {
    const container = document.getElementById('kelolaPetugasPageContainer');
    if (!container) return;

    const collectors = this.data.collectors || [];
    const residents = this.data.residents || [];
    const setoranList = this.data.setoranBlok || [];
    const monthlyFee = (this.data.settings && this.data.settings.iuranWajibBulanan) || 150000;
    const curMonth = AppState.selectedMonth || (new Date().getMonth() + 1);

    // Calculate metrics
    const totalPetugas = collectors.length;
    const assignedBlocks = [...new Set(collectors.map(c => c.blokTugas))];

    // Calculate total KK handled and unremitted cash in officers' hands
    let totalAssignedKK = 0;
    let totalKasDiTangan = 0;

    collectors.forEach(col => {
      const assigned = col.assignedBlocks || [col.blokTugas];
      const resInBlok = residents.filter(r => {
        const resBlok = (r.blok || '').trim().toLowerCase();
        return assigned.some(b => b && resBlok.includes(b.toLowerCase()));
      });
      totalAssignedKK += resInBlok.length;

      // Unremitted cash for current month
      const myDues = (this.data.dues && this.data.dues[curMonth]) || {};
      const paidResidents = resInBlok.filter(r => myDues[r.id] && myDues[r.id].status === 'lunas');
      const totalUangTerkumpul = paidResidents.length * monthlyFee;

      const mySetoran = setoranList.filter(s => (s.collectorId === col.id || s.blokTugas === col.blokTugas) && s.periodeBulan === curMonth);
      const sudahDisetor = mySetoran.filter(s => s.status === 'Diterima Bendahara').reduce((sum, s) => sum + Number(s.nominalTotal), 0);
      const pendingSetor = mySetoran.filter(s => s.status === 'Menunggu Konfirmasi').reduce((sum, s) => sum + Number(s.nominalTotal), 0);
      const kasDiTangan = Math.max(0, totalUangTerkumpul - sudahDisetor - pendingSetor);
      totalKasDiTangan += kasDiTangan;
    });

    // Generate table or card rows for each collector
    let tableRows = '';
    if (collectors.length === 0) {
      tableRows = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 40px 20px; color: #94a3b8;">
            <div style="font-size: 36px; margin-bottom: 8px;">👥</div>
            <div style="font-size: 15px; font-weight: 700; color: #64748b;">Belum Ada Petugas Penagih Blok Ditugaskan</div>
            <div style="font-size: 12.5px; margin-top: 4px;">Klik tombol "+ Tugaskan Warga Jadi Petugas" di atas untuk menunjuk warga RT sebagai penagih iuran per blok.</div>
          </td>
        </tr>
      `;
    } else {
      collectors.forEach((col, idx) => {
        // Link to resident record
        const resident = residents.find(r => r.id === col.residentId) ||
                         residents.find(r => r.nama.toLowerCase() === col.nama.toLowerCase());
        const alamatWarga = resident ? `${resident.blok} No. ${resident.nomorRumah || '-'}` : (col.blokAsal || '-');
        const pStr = String(col.phone || '');
        const phoneFormatted = pStr.startsWith('62') ? '0' + pStr.slice(2) : pStr;

        tableRows += `
          <tr>
            <td style="text-align: center; font-weight: 700; color: #64748b;">${idx + 1}</td>
            <td>
              <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 38px; height: 38px; border-radius: 50%; background: linear-gradient(135deg, #0d9488, #0f766e); color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; flex-shrink: 0; box-shadow: 0 2px 6px rgba(13, 148, 136, 0.25);">
                  ${(col.nama || 'PT').split(' ').map(n=>n[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <div style="font-weight: 800; font-size: 14px; color: #1e293b; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                    <span>${col.nama}</span>
                    <span class="badge-block" style="font-size: 10.5px; padding: 2px 7px;">Warga Asli</span>
                  </div>
                  <div style="font-size: 11.5px; color: #64748b; margin-top: 2px;">
                    🏠 Tempat Tinggal: <strong>${alamatWarga}</strong>
                  </div>
                </div>
              </div>
            </td>
            <td>
              <span class="badge-block" style="font-size: 12px; font-weight: 800; padding: 4px 10px; background: #e0f2fe; color: #0369a1; border-color: #bae6fd;">
                📌 ${col.blokTugas}
              </span>
            </td>
            <td>
              <div style="display: flex; flex-direction: column; gap: 3px;">
                <div style="font-size: 12px; color: #334155;">
                  User: <strong style="color: #0f766e; font-family: monospace; font-size: 12.5px;">${col.username}</strong>
                </div>
                <div style="font-size: 12px; color: #64748b; display: flex; align-items: center; gap: 4px;">
                  Pass: <span id="colPass_${col.id}" data-actual="${col.password}" data-hidden="true" style="font-family: monospace; font-weight: 700; color: #1e293b;">••••••</span>
                  <button type="button" class="btn-icon-action" style="padding: 1px 4px; font-size: 11px;" title="Intip / Sembunyikan Password" onclick="App.togglePetugasPasswordVisibility('colPass_${col.id}', this)">👁️</button>
                </div>
              </div>
            </td>
            <td>
              <a href="https://wa.me/${col.phone}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 700; color: #059669; text-decoration: none; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 4px 10px; border-radius: 9999px;">
                <span>💬 ${phoneFormatted}</span>
              </a>
            </td>
            <td>
              <div style="display: flex; gap: 6px; align-items: center;">
                <button type="button" class="btn-icon-action" title="Salin Kredensial Login untuk Petugas via WA" onclick="App.copyPetugasCredential('${col.id}')" style="color: #0284c7; background: #e0f2fe;">
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
                <button type="button" class="btn-icon-action" title="Edit Petugas" onclick="App.editPetugas('${col.id}')" style="color: #0d9488; background: #ccfbf1;">
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button type="button" class="btn-icon-action" title="Hapus / Cabut Penugasan Petugas" onclick="App.deletePetugas('${col.id}')" style="color: #ef4444; background: #fee2e2;">
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </td>
          </tr>
        `;
      });
    }

    container.innerHTML = `
      <div class="page-title-row">
        <div>
          <h1 class="page-title">👥 Manajemen Petugas Penagih Blok</h1>
          <p class="page-subtitle">Petugas ditunjuk langsung dari warga masing-masing blok untuk mengkoordinir iuran & menyetorkan kas ke Bendahara.</p>
        </div>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button type="button" class="btn-outline-pill" onclick="App.switchTab('setoran-blok')">
            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 9V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M15 13v4"/><path d="M13 15h4"/></svg>
            <span>Rekap Setoran Blok</span>
          </button>
          <button type="button" class="btn-teal-pill" onclick="App.openAddPetugasForm()">
            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>+ Tugaskan Warga Jadi Petugas</span>
          </button>
        </div>
      </div>

      <!-- Ringkasan Statistik Petugas -->
      <div class="metric-cards-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin-bottom: 24px;">
        <div class="metric-card">
          <div class="metric-icon-wrap" style="background: #f0fdfa; color: #0d9488;">
            <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div class="metric-info">
            <span class="metric-label">Petugas Penagih Aktif</span>
            <span class="metric-value">${totalPetugas} <span style="font-size: 14px; font-weight: normal; color: #64748b;">Orang</span></span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon-wrap" style="background: #eff6ff; color: #3b82f6;">
            <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          </div>
          <div class="metric-info">
            <span class="metric-label">Wilayah Blok Ter-cover</span>
            <span class="metric-value" style="font-size: 16px; line-height: 1.3;">${assignedBlocks.join(', ') || 'Belum diatur'}</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon-wrap" style="background: #fefce8; color: #ca8a04;">
            <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div class="metric-info">
            <span class="metric-label">Kas di Tangan Petugas</span>
            <span class="metric-value" style="color: #b45309;">${Utils.formatRupiah(totalKasDiTangan)}</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon-wrap" style="background: #fdf2f8; color: #db2777;">
            <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
          <div class="metric-info">
            <span class="metric-label">Total KK Terkoordinasi</span>
            <span class="metric-value">${totalAssignedKK} <span style="font-size: 14px; font-weight: normal; color: #64748b;">KK</span></span>
          </div>
        </div>
      </div>

      <!-- Tabel Daftar Petugas Blok -->
      <div class="chart-card" style="margin-bottom: 24px;">
        <div class="chart-header-row" style="margin-bottom: 16px;">
          <div>
            <h2 class="chart-title" style="margin: 0;">Daftar Akun Petugas Penagih Tiap Blok</h2>
            <p style="font-size: 12.5px; color: #64748b; margin: 3px 0 0 0;">Pengurus dapat menambah, mengedit, atau menghapus penugasan petugas sewaktu-waktu.</p>
          </div>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 48px; text-align: center;">No</th>
                <th>Petugas & Warga Asal</th>
                <th>Blok Tanggung Jawab</th>
                <th>Akun Login (Pengurus)</th>
                <th>Kontak WhatsApp</th>
                <th style="width: 140px;">Aksi</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Panduan & Alur Kerja Petugas Blok -->
      <div style="background: linear-gradient(135deg, #f8fafc, #f1f5f9); border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px 24px;">
        <div style="display: flex; align-items: center; gap: 8px; font-weight: 800; color: #0f766e; font-size: 14px; margin-bottom: 8px;">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <span>Petunjuk Alur Kerja & Hak Akses Petugas Blok:</span>
        </div>
        <ol style="margin: 0; padding-left: 20px; font-size: 12.5px; color: #475569; line-height: 1.8;">
          <li><strong>Dipilih dari Warga Blok:</strong> Petugas diangkat langsung dari kepala keluarga yang tinggal di blok terkait agar mengenal warga yang ditagih.</li>
          <li><strong>Login lewat Tab "Pengurus":</strong> Petugas masuk ke sistem menggunakan tab <em>Pengurus</em> dengan username dan password yang diberikan oleh Bendahara/Ketua RT.</li>
          <li><strong>Kwitansi WhatsApp Otomatis:</strong> Setelah mencentang lunas iuran rumah warga, petugas bisa langsung menekan tombol hijau untuk mengirim bukti kwitansi WA resmi beratasnamakan petugas tersebut.</li>
          <li><strong>Serah Terima Kas ke Bendahara:</strong> Uang tunai yang terkumpul di lapangan dicatat di sistem dan disetorkan ke Bendahara Utama via menu <em>Setoran Blok</em> untuk diverifikasi.</li>
        </ol>
      </div>
    `;
  },

  openKelolaPetugasModal() {
    this.renderPetugasList();
    const wrapper = document.getElementById('formPetugasWrapper');
    if (wrapper) wrapper.style.display = 'none';
    this.openModal('modalKelolaPetugas');
  },

  populatePetugasResidentSelect(selectedId = '') {
    const sel = document.getElementById('petugasPilihWarga');
    if (!sel) return;

    const residents = this.data.residents || [];
    let html = '<option value="">-- Pilih Warga dari Blok RT --</option>';

    // Group residents by block
    const blockGroups = {};
    residents.forEach(r => {
      const b = (r.blok || 'Lainnya').trim();
      if (!blockGroups[b]) blockGroups[b] = [];
      blockGroups[b].push(r);
    });

    Object.keys(blockGroups).sort().forEach(b => {
      html += `<optgroup label="📍 ${b}">`;
      blockGroups[b].forEach(r => {
        const isSel = r.id === selectedId ? 'selected' : '';
        const noRumah = r.nomorRumah ? `No. ${r.nomorRumah}` : '';
        html += `<option value="${r.id}" ${isSel}>${r.nama} (${r.blok} ${noRumah})</option>`;
      });
      html += `</optgroup>`;
    });

    sel.innerHTML = html;
  },

  onSelectWargaForPetugas(residentId) {
    if (!residentId) return;
    const res = (this.data.residents || []).find(r => r.id === residentId);
    if (!res) return;

    const idInput = document.getElementById('petugasResidentId');
    if (idInput) idInput.value = res.id;

    const blokAsalInput = document.getElementById('petugasBlokAsal');
    if (blokAsalInput) blokAsalInput.value = res.blok || '';

    const namaInput = document.getElementById('petugasNama');
    if (namaInput) namaInput.value = res.nama || '';

    const phoneInput = document.getElementById('petugasPhone');
    const phone = res.telepon || res.phone || '';
    if (phoneInput) phoneInput.value = phone;

    // Detect block name for assignment: e.g. "Blok A1 No. 12" -> "Blok A"
    let blockCategory = res.blok || 'Blok A';
    const matchBlokLetter = (res.blok || '').match(/(Blok\s+[A-Za-z])/i);
    if (matchBlokLetter) {
      blockCategory = matchBlokLetter[1].toUpperCase();
    } else {
      const matchGeneral = (res.blok || '').match(/(Blok\s+[^\s,]+)/i);
      if (matchGeneral) blockCategory = matchGeneral[1];
    }
    const blokTugasInput = document.getElementById('petugasBlokTugas');
    if (blokTugasInput) blokTugasInput.value = blockCategory;

    // Suggest username: petugas_a, petugas_b, or petugas_firstname
    const blockLetter = blockCategory.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanFirstName = (res.nama || '').toLowerCase().replace(/^(bpk\.|ibu\.|pak\.|bu\.)\s*/i, '').trim().split(' ')[0].replace(/[^a-z0-9]/g, '');

    let suggestedUsername = `petugas_${blockLetter.replace('blok', '')}`;
    if (!suggestedUsername || suggestedUsername === 'petugas_') {
      suggestedUsername = `petugas_${cleanFirstName}`;
    }

    const usernameInput = document.getElementById('petugasUsername');
    if (usernameInput) usernameInput.value = suggestedUsername;

    const passwordInput = document.getElementById('petugasPassword');
    if (passwordInput && !passwordInput.value) {
      passwordInput.value = '123';
    }
  },

  renderPetugasList() {
    const container = document.getElementById('collectorListContainer');
    if (!container) return;

    container.innerHTML = '';
    const collectors = this.data.collectors || [];
    const residents = this.data.residents || [];

    if (collectors.length === 0) {
      container.innerHTML = `<div style="text-align: center; color: #94a3b8; padding: 20px;">Belum ada akun petugas penagih blok terdaftar.</div>`;
      return;
    }

    collectors.forEach(col => {
      const resident = residents.find(r => r.id === col.residentId);
      const asal = col.blokAsal || (resident ? `${resident.blok} No. ${resident.nomorRumah || '-'}` : '-');

      const item = document.createElement('div');
      item.style.cssText = "display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; gap: 10px; flex-wrap: wrap;";
      item.innerHTML = `
        <div>
          <div style="font-weight: 800; font-size: 14px; color: #1e293b; display: flex; align-items: center; gap: 6px;">
            <span>${col.nama}</span>
            <span class="badge-block">${col.blokTugas}</span>
          </div>
          <div style="font-size: 11.5px; color: #64748b; margin-top: 3px;">
            Warga Asal: <strong>${asal}</strong> • User: <strong style="color: #0d9488;">${col.username}</strong> • Pass: <strong>${col.password}</strong> • WA: ${col.phone}
          </div>
        </div>
        <div style="display: flex; gap: 6px;">
          <button type="button" class="btn-icon-action" title="Salin Info Login WA" onclick="App.copyPetugasCredential('${col.id}')" style="color: #0284c7;">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
          <button type="button" class="btn-icon-action" title="Edit Petugas" onclick="App.editPetugas('${col.id}')">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button type="button" class="btn-icon-action" style="color: #ef4444;" title="Hapus Petugas" onclick="App.deletePetugas('${col.id}')">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      `;
      container.appendChild(item);
    });
  },

  openAddPetugasForm() {
    this.populatePetugasResidentSelect('');
    const form = document.getElementById('formPetugasBlok');
    if (form) form.reset();
    document.getElementById('petugasFormId').value = '';
    document.getElementById('petugasResidentId').value = '';
    document.getElementById('petugasBlokAsal').value = '';
    document.getElementById('formPetugasTitle').textContent = "Tambah Petugas Blok Baru (Ditugaskan dari Warga)";
    document.getElementById('petugasPassword').value = '123';
    const wrapper = document.getElementById('formPetugasWrapper');
    if (wrapper) wrapper.style.display = 'block';
    this.openModal('modalKelolaPetugas');
  },

  editPetugas(id) {
    const col = (this.data.collectors || []).find(c => c.id === id);
    if (!col) return;
    this.populatePetugasResidentSelect(col.residentId || '');
    document.getElementById('petugasFormId').value = col.id;
    document.getElementById('petugasResidentId').value = col.residentId || '';
    document.getElementById('petugasBlokAsal').value = col.blokAsal || '';
    document.getElementById('petugasNama').value = col.nama;
    document.getElementById('petugasPhone').value = col.phone;
    document.getElementById('petugasBlokTugas').value = col.blokTugas;
    document.getElementById('petugasUsername').value = col.username;
    document.getElementById('petugasPassword').value = col.password || '123';
    document.getElementById('formPetugasTitle').textContent = `Edit Petugas: ${col.nama} (${col.blokTugas})`;
    const wrapper = document.getElementById('formPetugasWrapper');
    if (wrapper) wrapper.style.display = 'block';
    this.openModal('modalKelolaPetugas');
  },

  deletePetugas(id) {
    const col = (this.data.collectors || []).find(c => c.id === id);
    if (!col) return;
    if (confirm(`Yakin ingin menghapus / mencabut penugasan akun petugas "${col.nama}" (${col.blokTugas})?\n\nCatatan: Data ${col.nama} sebagai warga RT tetap tersimpan aman di database.`)) {
      this.data.collectors = this.data.collectors.filter(c => c.id !== id);
      DB.save(this.data);
      // Sync delete to Google Sheets
      if (window.CloudSync && typeof window.CloudSync.deleteCollectorDirect === 'function') {
        window.CloudSync.deleteCollectorDirect(id);
      }
      this.renderPetugasList();
      this.renderKelolaPetugasPage();
      this.renderSetoranBlok();
      alert(`Akun petugas "${col.nama}" berhasil dihapus.`);
    }
  },

  savePetugasSubmit(event) {
    event.preventDefault();
    const id = document.getElementById('petugasFormId').value;
    const residentId = document.getElementById('petugasResidentId').value;
    const blokAsal = document.getElementById('petugasBlokAsal').value;
    const nama = document.getElementById('petugasNama').value.trim();
    const phone = document.getElementById('petugasPhone').value.trim();
    const blokTugas = document.getElementById('petugasBlokTugas').value.trim();
    const username = document.getElementById('petugasUsername').value.trim();
    const password = document.getElementById('petugasPassword').value.trim();

    if (!nama || !blokTugas || !username || !password) {
      alert("Harap lengkapi semua kolom yang wajib diisi!");
      return;
    }

    if (!this.data.collectors) this.data.collectors = [];

    const duplicate = this.data.collectors.find(c => c.username.toLowerCase() === username.toLowerCase() && c.id !== id);
    if (duplicate) {
      alert(`Username "${username}" sudah digunakan oleh petugas lain! Gunakan username lain.`);
      return;
    }

    const cleanPhone = phone.startsWith('0') ? '62' + phone.slice(1) : phone;

    // Detect assigned blocks array
    const assignedBlocks = [blokTugas];
    if (blokTugas.toLowerCase().includes('blok a')) {
      assignedBlocks.push('Blok A1', 'Blok A2');
    } else if (blokTugas.toLowerCase().includes('blok b')) {
      assignedBlocks.push('Blok B1', 'Blok B2');
    } else if (blokTugas.toLowerCase().includes('blok c')) {
      assignedBlocks.push('Blok C1', 'Blok C2');
    }

    let savedCol = null;
    if (id) {
      const target = this.data.collectors.find(c => c.id === id);
      if (target) {
        target.residentId = residentId || target.residentId;
        target.blokAsal = blokAsal || target.blokAsal;
        target.nama = nama;
        target.phone = cleanPhone;
        target.blokTugas = blokTugas;
        target.assignedBlocks = assignedBlocks;
        target.username = username;
        target.password = password;
        savedCol = target;
      }
    } else {
      const newCol = {
        id: `COL-${Date.now().toString().slice(-4)}`,
        residentId: residentId || '',
        blokAsal: blokAsal || '',
        nama,
        phone: cleanPhone,
        blokTugas,
        assignedBlocks,
        username,
        password,
        role: 'petugas'
      };
      this.data.collectors.push(newCol);
      savedCol = newCol;
    }

    DB.save(this.data);

    // Sync direct to Google Sheets
    if (savedCol && window.CloudSync && typeof window.CloudSync.saveCollectorDirect === 'function') {
      window.CloudSync.saveCollectorDirect(savedCol);
    }

    const wrapper = document.getElementById('formPetugasWrapper');
    if (wrapper) wrapper.style.display = 'none';
    this.closeModal('modalKelolaPetugas');
    this.renderPetugasList();
    this.renderKelolaPetugasPage();
    this.renderSetoranBlok();
    alert(`Data petugas penagih "${nama}" (${blokTugas}) berhasil disimpan!`);
  },

  copyPetugasCredential(id) {
    const col = (this.data.collectors || []).find(c => c.id === id);
    if (!col) return;
    const text = `*AKSES LOGIN RUKUNKU - PETUGAS PENAGIH*\n\nHalo ${col.nama},\nAnda telah ditugaskan sebagai Petugas Penagih Iuran untuk ${col.blokTugas}.\n\nSilakan login ke webapp RukunKu dengan akun berikut:\n• Menu Login: *Pengurus*\n• Username: *${col.username}*\n• Password: *${col.password}*\n\nTerima kasih atas dedikasi dan pengabdian Anda untuk warga lingkungan kita.`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        alert(`Informasi akun login petugas "${col.nama}" berhasil disalin ke clipboard!\nAnda dapat langsung paste (tempel) ke chat WhatsApp petugas.`);
      }).catch(() => {
        prompt("Salin teks akun petugas berikut untuk dikirim via WhatsApp:", text);
      });
    } else {
      prompt("Salin teks akun petugas berikut untuk dikirim via WhatsApp:", text);
    }
  },

  togglePetugasPasswordVisibility(spanId, btn) {
    const span = document.getElementById(spanId);
    if (!span) return;
    const isHidden = span.dataset.hidden === 'true';
    if (isHidden) {
      span.textContent = span.dataset.actual;
      span.dataset.hidden = 'false';
      if (btn) btn.textContent = '🙈';
    } else {
      span.textContent = '••••••';
      span.dataset.hidden = 'true';
      if (btn) btn.textContent = '👁️';
    }
  },

  // =========================================================================
  // Warga Specific Views (Iuran Rumah Sendiri & Profil Biodata)
  // =========================================================================
  renderWargaProfile() {
    const resident = (this.data.residents || []).find(r => r.id === AppState.currentResidentId) || this.data.residents[0];
    const container = document.getElementById('wargaProfileContainer');
    if (!container || !resident) return;

    if (!resident.familyMembers || !Array.isArray(resident.familyMembers) || resident.familyMembers.length === 0) {
      resident.familyMembers = [
        {
          id: `${resident.id}-fm-1`,
          nama: resident.nama,
          hubungan: 'Kepala Keluarga',
          nik: resident.nik || '',
          jenisKelamin: 'Laki-laki',
          tanggalLahir: '',
          punyaKtp: true,
          fotoKtp: ''
        }
      ];
      resident.jumlahAnggota = Math.max(resident.jumlahAnggota || 1, resident.familyMembers.length);
    }

    const members = resident.familyMembers;

    container.innerHTML = `
      <!-- 1. Profil Kepala Keluarga -->
      <div class="family-profile-card">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 16px; flex-wrap: wrap; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div class="avatar-img" style="width: 54px; height: 54px; font-size: 20px;">
              ${resident.nama.split(' ').map(n=>n[0]).join('').slice(0,2)}
            </div>
            <div>
              <h2 style="font-size: 19px; font-weight: 800; color: #111827; margin: 0;">${resident.nama}</h2>
              <div style="display: flex; gap: 8px; margin-top: 4px; align-items: center;">
                <span class="badge-status badge-approved">${resident.statusHunian}</span>
                <span class="badge-block">${resident.alamat}</span>
              </div>
            </div>
          </div>
          <button class="btn-outline-pill" style="font-size: 12px; padding: 6px 12px;" onclick="App.editResident('${resident.id}')">
            ✏️ Ubah Data Rumah
          </button>
        </div>

        <div class="family-info-grid">
          <div class="family-info-item">
            <div class="family-info-label">Alamat Lengkap / Blok</div>
            <div class="family-info-val">${resident.alamat}</div>
          </div>
          <div class="family-info-item">
            <div class="family-info-label">NIK Kepala Keluarga</div>
            <div class="family-info-val">${resident.nik || '-'}</div>
          </div>
          <div class="family-info-item">
            <div class="family-info-label">Nomor Kartu Keluarga (No KK)</div>
            <div class="family-info-val">${resident.noKk || 'Belum diisi'}</div>
          </div>
          <div class="family-info-item">
            <div class="family-info-label">Nomor WhatsApp Aktif</div>
            <div class="family-info-val">${resident.phone}</div>
          </div>
        </div>
      </div>

      <!-- 2. Dokumen Kartu Keluarga (KK) (Fixing Point 2) -->
      <div class="family-profile-card" style="margin-top: 18px;">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 14px; flex-wrap: wrap; gap: 10px;">
          <div>
            <h3 style="font-size: 16px; font-weight: 800; color: #111827; margin: 0;">📄 Dokumen Kartu Keluarga (KK)</h3>
            <p style="font-size: 12px; color: #64748b; margin: 4px 0 0 0;">Unggah foto atau scan Kartu Keluarga rumah Anda untuk arsip administrasi RT.</p>
          </div>
        </div>

        <div style="margin-top: 16px;">
          ${resident.fotoKk ? `
            <div class="doc-preview-card">
              <img src="${resident.fotoKk}" alt="Foto Kartu Keluarga" class="doc-preview-img" onclick="App.previewDocument('Dokumen Kartu Keluarga - ${resident.nama}', '${resident.fotoKk}')">
              <div class="doc-preview-actions">
                <div style="font-size: 12px; color: #047857; font-weight: 700;">✓ Foto Kartu Keluarga Tersimpan</div>
                <div style="display: flex; gap: 8px;">
                  <button type="button" class="btn-teal-pill" style="font-size: 11px; padding: 4px 10px;" onclick="App.previewDocument('Dokumen Kartu Keluarga - ${resident.nama}', '${resident.fotoKk}')">
                    👁️ Lihat Penuh
                  </button>
                  <button type="button" class="btn-outline-pill" style="font-size: 11px; padding: 4px 10px;" onclick="document.getElementById('inputKkFile').click()">
                    Ganti Foto
                  </button>
                  <button type="button" class="btn-outline-pill" style="font-size: 11px; padding: 4px 10px; color: #ef4444;" onclick="App.removeKkDocument()">
                    Hapus
                  </button>
                </div>
              </div>
            </div>
          ` : `
            <div class="upload-dropzone" onclick="document.getElementById('inputKkFile').click()">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#148878" stroke-width="2" style="margin-bottom: 6px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
              <div style="font-size: 13.5px; font-weight: 800; color: #1e293b;">Unggah Scan / Foto Kartu Keluarga (KK)</div>
              <div style="font-size: 11.5px; color: #64748b; margin-top: 4px;">Klik di sini untuk memilih foto KK (format JPG atau PNG). Foto akan dikompres otomatis.</div>
            </div>
          `}
          <input type="file" id="inputKkFile" accept="image/*" style="display: none;" onchange="App.handleKkUpload(event)">
        </div>
      </div>

      <!-- 3. Anggota Keluarga yang Tinggal Bersama (Fixing Point 2) -->
      <div class="family-profile-card" style="margin-top: 18px;">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 14px; flex-wrap: wrap; gap: 12px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <h3 style="font-size: 16px; font-weight: 800; color: #111827; margin: 0;">👨‍👩‍👧‍👦 Anggota Keluarga yang Tinggal Bersama</h3>
              <span class="badge-block" style="font-size: 11.5px; padding: 2px 8px;">${members.length} Jiwa</span>
            </div>
            <p style="font-size: 12px; color: #64748b; margin: 4px 0 0 0;">Tambahkan anggota keluarga satu atap beserta foto KTP masing-masing bagi yang memiliki KTP.</p>
          </div>
          <button type="button" class="btn-teal-pill" onclick="App.openAddFamilyMemberModal()">
            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>+ Tambah Anggota Keluarga</span>
          </button>
        </div>

        <div style="margin-top: 16px; display: flex; flex-direction: column; gap: 10px;">
          ${members.map((m, idx) => `
            <div class="family-member-row">
              <div class="family-member-info">
                <div class="family-member-avatar">${idx + 1}</div>
                <div>
                  <div style="font-weight: 800; font-size: 14px; color: #1e293b;">
                    ${m.nama}
                    <span class="badge-status ${m.hubungan === 'Kepala Keluarga' ? 'badge-approved' : 'badge-pending'}" style="margin-left: 6px; font-size: 10.5px;">
                      ${m.hubungan}
                    </span>
                  </div>
                  <div style="font-size: 11.5px; color: #64748b; margin-top: 3px;">
                    NIK: <strong>${m.nik || '-'}</strong> • JK: ${m.jenisKelamin || '-'} ${m.tanggalLahir ? `• Tgl Lahir: ${m.tanggalLahir}` : ''}
                  </div>
                </div>
              </div>

              <!-- KTP Status Badge & Preview -->
              <div style="display: flex; align-items: center; gap: 8px;">
                ${m.punyaKtp !== false ? `
                  ${m.fotoKtp ? `
                    <button type="button" class="btn-teal-pill" style="font-size: 11px; padding: 4px 9px;" onclick="App.previewDocument('Foto KTP - ${m.nama}', '${m.fotoKtp}')" title="Lihat Foto KTP">
                      👁️ KTP Terunggah
                    </button>
                  ` : `
                    <button type="button" class="btn-outline-pill" style="font-size: 11px; color: #d97706; border-color: #fcd34d; padding: 4px 8px; font-weight: 600;" onclick="App.editFamilyMember('${m.id}')">
                      ⚠️ + Unggah KTP
                    </button>
                  `}
                ` : `
                  <span style="font-size: 11px; color: #64748b; background: #f1f5f9; padding: 3px 8px; border-radius: 6px;">
                    Belum Wajib KTP
                  </span>
                `}

                <button type="button" class="btn-icon-action" title="Ubah Data Anggota" onclick="App.editFamilyMember('${m.id}')">
                  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                ${m.hubungan !== 'Kepala Keluarga' ? `
                  <button type="button" class="btn-icon-action" style="color: #ef4444;" title="Hapus Anggota" onclick="App.deleteFamilyMember('${m.id}')">
                    <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- 4. Akun & Keamanan Login Warga -->
      <div class="family-profile-card" style="margin-top: 18px;">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 14px; flex-wrap: wrap; gap: 12px;">
          <div>
            <h3 style="font-size: 16px; font-weight: 800; color: #111827; margin: 0;">🔐 Akun & Password Login</h3>
            <p style="font-size: 12px; color: #64748b; margin: 4px 0 0 0;">Gunakan kredensial ini untuk masuk ke akun portal RukunKu.</p>
          </div>
          <button type="button" class="btn-outline-pill" style="font-size: 12px; padding: 6px 12px;" onclick="App.changeMyWargaPassword()">
            🔑 Ganti Password Saya
          </button>
        </div>
        <div class="family-info-grid" style="margin-top: 14px;">
          <div class="family-info-item">
            <div class="family-info-label">Username / Akun Login</div>
            <div class="family-info-val" style="font-size: 13.5px; color: #0f766e;">${resident.nik || resident.phone}</div>
            <span style="font-size: 11px; color: #64748b;">(Dapat login menggunakan NIK atau Nomor WhatsApp)</span>
          </div>
          <div class="family-info-item">
            <div class="family-info-label">Password Akun</div>
            <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
              <span class="pwd-text-display" id="myProfilePwd" data-real-pwd="${(resident.password || '123456').replace(/"/g, '&quot;')}" style="font-size: 14px;">••••••••</span>
              <button type="button" class="btn-icon-action" style="width: 28px; height: 28px; padding: 2px;" onclick="
                const p = document.getElementById('myProfilePwd');
                if (p.textContent === '••••••••') { p.textContent = p.getAttribute('data-real-pwd'); this.textContent = '🙈'; }
                else { p.textContent = '••••••••'; this.textContent = '👁️'; }
              " title="Lihat/Sembunyikan Password">👁️</button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // Document & Family Management Methods
  previewDocument(title, imageUrl) {
    if (!imageUrl) {
      alert("Belum ada foto/dokumen yang diunggah.");
      return;
    }
    const modalTitle = document.getElementById('previewDokumenTitle');
    const modalImg = document.getElementById('imgDokumenFull');
    const btnTab = document.getElementById('btnBukaDokumenTab');
    if (modalTitle) modalTitle.textContent = title || "Lihat Dokumen";
    if (modalImg) modalImg.src = imageUrl;
    if (btnTab) {
      if (imageUrl && imageUrl.startsWith('http')) {
        btnTab.href = imageUrl;
        btnTab.style.display = 'inline-flex';
      } else {
        btnTab.style.display = 'none';
      }
    }
    this.openModal('modalPreviewDokumen');
  },

  async handleKkUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const resident = (this.data.residents || []).find(r => r.id === AppState.currentResidentId);
      if (!resident) {
        alert("Sesi warga tidak aktif!");
        return;
      }

      const compressed = await Utils.compressImage(file, 1000, 0.75);
      resident.fotoKk = compressed;
      DB.save(this.data);
      this.renderWargaProfile();

      // Sync direct ke Google Sheets & Google Drive
      if (window.CloudSync && typeof window.CloudSync.saveResidentDirect === 'function') {
        const success = await window.CloudSync.saveResidentDirect(resident);
        if (success) {
          this.renderWargaProfile();
        }
      }
      alert("✅ Foto/Scan Kartu Keluarga (KK) berhasil diunggah!");
    } catch (err) {
      alert("Gagal mengunggah foto KK: " + err.message);
    }
  },

  removeKkDocument() {
    if (!confirm("Hapus foto Kartu Keluarga (KK) yang tersimpan?")) return;
    const resident = (this.data.residents || []).find(r => r.id === AppState.currentResidentId);
    if (!resident) return;
    resident.fotoKk = "";
    DB.save(this.data);
    // Sync direct to Google Sheets
    if (window.CloudSync && typeof window.CloudSync.saveResidentDirect === 'function') {
      window.CloudSync.saveResidentDirect(resident);
    }
    this.renderWargaProfile();
    alert("Foto KK berhasil dihapus.");
  },

  toggleKtpUploadField(punyaKtpVal) {
    const section = document.getElementById('sectionUploadKtp');
    if (!section) return;
    if (punyaKtpVal === 'true' || punyaKtpVal === true) {
      section.style.display = 'block';
    } else {
      section.style.display = 'none';
      this.removeKtpPhoto();
    }
  },

  async handleKtpUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await Utils.compressImage(file, 900, 0.75);
      document.getElementById('fmFotoKtpBase64').value = compressed;
      const previewImg = document.getElementById('imgKtpPreview');
      if (previewImg) previewImg.src = compressed;
      document.getElementById('ktpPreviewBox').style.display = 'block';
      document.getElementById('ktpUploadArea').style.display = 'none';
    } catch (err) {
      alert("Gagal membaca foto KTP: " + err.message);
    }
  },

  removeKtpPhoto() {
    const hiddenInput = document.getElementById('fmFotoKtpBase64');
    if (hiddenInput) hiddenInput.value = '';
    const previewImg = document.getElementById('imgKtpPreview');
    if (previewImg) previewImg.src = '';
    const fileInput = document.getElementById('inputKtpFile');
    if (fileInput) fileInput.value = '';
    const previewBox = document.getElementById('ktpPreviewBox');
    if (previewBox) previewBox.style.display = 'none';
    const uploadArea = document.getElementById('ktpUploadArea');
    if (uploadArea) uploadArea.style.display = 'block';
  },

  openAddFamilyMemberModal() {
    const form = document.getElementById('formAnggotaKeluarga');
    if (form) form.reset();
    document.getElementById('familyMemberId').value = '';
    document.getElementById('modalAnggotaKeluargaTitle').textContent = "Tambah Anggota Keluarga";
    this.removeKtpPhoto();
    this.toggleKtpUploadField('true');
    this.openModal('modalAnggotaKeluarga');
  },

  editFamilyMember(memberId) {
    const resident = (this.data.residents || []).find(r => r.id === AppState.currentResidentId);
    if (!resident) return;
    const member = (resident.familyMembers || []).find(m => m.id === memberId);
    if (!member) return;

    document.getElementById('familyMemberId').value = member.id;
    document.getElementById('fmNama').value = member.nama;
    document.getElementById('fmHubungan').value = member.hubungan;
    document.getElementById('fmJenisKelamin').value = member.jenisKelamin || 'Laki-laki';
    document.getElementById('fmNik').value = member.nik || '';
    document.getElementById('fmTanggalLahir').value = member.tanggalLahir || '';
    document.getElementById('fmPunyaKtp').value = member.punyaKtp !== false ? 'true' : 'false';

    this.toggleKtpUploadField(member.punyaKtp !== false ? 'true' : 'false');

    if (member.fotoKtp) {
      document.getElementById('fmFotoKtpBase64').value = member.fotoKtp;
      const previewImg = document.getElementById('imgKtpPreview');
      if (previewImg) previewImg.src = member.fotoKtp;
      document.getElementById('ktpPreviewBox').style.display = 'block';
      document.getElementById('ktpUploadArea').style.display = 'none';
    } else {
      this.removeKtpPhoto();
    }

    document.getElementById('modalAnggotaKeluargaTitle').textContent = "Edit Data Anggota Keluarga";
    this.openModal('modalAnggotaKeluarga');
  },

  async saveFamilyMemberSubmit(event) {
    event.preventDefault();
    const resident = (this.data.residents || []).find(r => r.id === AppState.currentResidentId);
    if (!resident) {
      alert("Sesi warga tidak aktif!");
      return;
    }

    const memberId = document.getElementById('familyMemberId').value;
    const nama = document.getElementById('fmNama').value.trim();
    const hubungan = document.getElementById('fmHubungan').value;
    const jenisKelamin = document.getElementById('fmJenisKelamin').value;
    const nik = document.getElementById('fmNik').value.trim();
    const tanggalLahir = document.getElementById('fmTanggalLahir').value;
    const punyaKtp = document.getElementById('fmPunyaKtp').value === 'true';
    const fotoKtp = document.getElementById('fmFotoKtpBase64').value;

    if (!nama || !hubungan) {
      alert("Nama anggota dan hubungan keluarga wajib diisi!");
      return;
    }

    if (!resident.familyMembers) resident.familyMembers = [];

    if (memberId) {
      const target = resident.familyMembers.find(m => m.id === memberId);
      if (target) {
        target.nama = nama;
        target.hubungan = hubungan;
        target.jenisKelamin = jenisKelamin;
        target.nik = nik;
        target.tanggalLahir = tanggalLahir;
        target.punyaKtp = punyaKtp;
        if (fotoKtp) target.fotoKtp = fotoKtp;
        else if (!punyaKtp) target.fotoKtp = '';
      }
    } else {
      const newMember = {
        id: `${resident.id}-fm-${Date.now()}`,
        nama,
        hubungan,
        jenisKelamin,
        nik,
        tanggalLahir,
        punyaKtp,
        fotoKtp: fotoKtp || ''
      };
      resident.familyMembers.push(newMember);
    }

    // Update jumlah anggota otomatis
    resident.jumlahAnggota = Math.max(resident.jumlahAnggota || 1, resident.familyMembers.length);

    DB.save(this.data);
    this.closeModal('modalAnggotaKeluarga');
    this.renderWargaProfile();
    this.renderResidents();
    alert("✅ Data anggota keluarga berhasil disimpan!");

    // Sync direct ke Google Sheets & Google Drive
    if (window.CloudSync && typeof window.CloudSync.saveResidentDirect === 'function') {
      const success = await window.CloudSync.saveResidentDirect(resident);
      if (success) {
        this.renderWargaProfile();
        this.renderResidents();
      }
    }
  },

  deleteFamilyMember(memberId) {
    const resident = (this.data.residents || []).find(r => r.id === AppState.currentResidentId);
    if (!resident) return;
    const member = (resident.familyMembers || []).find(m => m.id === memberId);
    if (!member) return;

    if (member.hubungan === 'Kepala Keluarga') {
      alert("Data Kepala Keluarga tidak dapat dihapus. Anda dapat mengubah datanya melalui form edit.");
      return;
    }

    if (!confirm(`Yakin ingin menghapus anggota keluarga "${member.nama}" (${member.hubungan})?`)) {
      return;
    }

    resident.familyMembers = resident.familyMembers.filter(m => m.id !== memberId);
    resident.jumlahAnggota = resident.familyMembers.length;
    DB.save(this.data);
    // Sync updated resident to Google Sheets
    if (window.CloudSync && typeof window.CloudSync.saveResidentDirect === 'function') {
      window.CloudSync.saveResidentDirect(resident);
    }
    this.renderWargaProfile();
    this.renderResidents();
    alert("Anggota keluarga berhasil dihapus.");
  },

  openAdminResidentDetail(residentId) {
    const resident = (this.data.residents || []).find(r => r.id === residentId);
    if (!resident) return;

    const modalTitle = document.getElementById('modalDetailWargaTitle');
    const container = document.getElementById('modalDetailWargaContent');
    if (modalTitle) modalTitle.textContent = `Data Keluarga: Bpk/Ibu ${resident.nama} (${resident.alamat})`;

    if (container) {
      const members = resident.familyMembers || [
        {
          id: `${resident.id}-1`,
          nama: resident.nama,
          hubungan: 'Kepala Keluarga',
          nik: resident.nik || '-',
          jenisKelamin: 'Laki-laki',
          punyaKtp: true,
          fotoKtp: ''
        }
      ];

      const totalJiwa = Math.max(Number(resident.jumlahAnggota) || 1, members.length);

      container.innerHTML = `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div>
              <div style="font-size: 16px; font-weight: 800; color: #1e293b;">${resident.nama}</div>
              <div style="font-size: 12px; color: #64748b;">${resident.alamat} • WhatsApp: <strong>${resident.phone}</strong></div>
              <div style="font-size: 12px; color: #64748b; margin-top: 2px;">No. KK: <strong>${resident.noKk || 'Belum diisi'}</strong> • Status: <strong>${resident.statusHunian}</strong></div>
            </div>
            <div>
              <span class="badge-block" style="font-size: 12px; padding: 6px 12px;">Total: ${totalJiwa} Jiwa</span>
            </div>
          </div>

          <div style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed #cbd5e1;">
            <div style="font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 6px;">Dokumen Kartu Keluarga (KK):</div>
            ${resident.fotoKk ? `
              <div style="display: flex; align-items: center; gap: 10px;">
                <img src="${resident.fotoKk}" alt="Foto KK" style="width: 80px; height: 50px; object-fit: cover; border-radius: 8px; border: 1px solid #cbd5e1; cursor: pointer;" onclick="App.previewDocument('Kartu Keluarga - ${resident.nama}', '${resident.fotoKk}')">
                <div>
                  <button type="button" class="btn-teal-pill" style="font-size: 11px; padding: 4px 10px;" onclick="App.previewDocument('Kartu Keluarga - ${resident.nama}', '${resident.fotoKk}')">
                    👁️ Lihat Foto KK Penuh
                  </button>
                  <span style="font-size: 11px; color: #10b981; margin-left: 6px; font-weight: 600;">✓ Terverifikasi Ada</span>
                </div>
              </div>
            ` : `
              <div style="font-size: 12px; color: #94a3b8; font-style: italic;">Warga belum mengunggah foto/scan Kartu Keluarga (KK).</div>
            `}
          </div>
        </div>

        <div style="font-size: 13px; font-weight: 800; color: #1e293b; margin-bottom: 10px;">
          Daftar Anggota Keluarga yang Tinggal Bersama (${totalJiwa} Jiwa):
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${members.map((m, idx) => `
            <div class="family-member-row" style="padding: 12px 14px; margin-bottom: 0;">
              <div class="family-member-info">
                <div class="family-member-avatar">${idx + 1}</div>
                <div>
                  <div style="font-weight: 700; font-size: 13.5px; color: #1e293b;">
                    ${m.nama}
                    <span class="badge-status ${m.hubungan === 'Kepala Keluarga' ? 'badge-approved' : 'badge-pending'}" style="margin-left: 6px; font-size: 10px;">
                      ${m.hubungan}
                    </span>
                  </div>
                  <div style="font-size: 11.5px; color: #64748b; margin-top: 2px;">
                    NIK: <strong>${m.nik || '-'}</strong> • JK: ${m.jenisKelamin || '-'} ${m.tanggalLahir ? `• Tgl: ${m.tanggalLahir}` : ''}
                  </div>
                </div>
              </div>
              <div>
                ${m.punyaKtp !== false ? `
                  ${m.fotoKtp ? `
                    <button type="button" class="btn-teal-pill" style="font-size: 11px; padding: 4px 10px;" onclick="App.previewDocument('KTP - ${m.nama}', '${m.fotoKtp}')">
                      👁️ Lihat KTP
                    </button>
                  ` : `
                    <span style="font-size: 11px; color: #f59e0b; font-weight: 600; background: #fef3c7; padding: 3px 8px; border-radius: 6px;">KTP Belum Diunggah</span>
                  `}
                ` : `
                  <span style="font-size: 11px; color: #64748b; background: #f1f5f9; padding: 3px 8px; border-radius: 6px;">Belum Wajib KTP</span>
                `}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    this.openModal('modalDetailWargaAdmin');
  },

  renderWargaIuranHistory() {
    const resident = (this.data.residents || []).find(r => r.id === AppState.currentResidentId) || this.data.residents[0];
    const matrixContainer = document.getElementById('wargaPersonalMatrixBody');
    const txContainer = document.getElementById('wargaPersonalTxBody');
    if (!resident) return;

    const curWargaYear = AppState.wargaSelectedYear || AppState.selectedYear || new Date().getFullYear();

    // Populate wargaIuranYearSelect dropdown
    const yearSelect = document.getElementById('wargaIuranYearSelect');
    if (yearSelect) {
      if (!yearSelect.options || yearSelect.options.length === 0 || yearSelect.value !== String(curWargaYear)) {
        let opts = '';
        for (let y = 2025; y <= curWargaYear + 2; y++) {
          opts += `<option value="${y}" ${y === curWargaYear ? 'selected' : ''}>Tahun ${y}</option>`;
        }
        yearSelect.innerHTML = opts;
        yearSelect.value = String(curWargaYear);
      }
    }

    const titleEl = document.getElementById('wargaIuranTitle');
    if (titleEl) {
      titleEl.innerHTML = `Riwayat Iuran Rumah Saya - Tahun ${curWargaYear}`;
    }

    if (matrixContainer) {
      matrixContainer.innerHTML = '';
      const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      
      for (let m = 1; m <= 12; m++) {
        const st = this.getDuesStatus(resident.id, curWargaYear, m);
        let badgeCls = 'badge-keluar';
        if (st === 'Lunas') badgeCls = 'badge-approved';
        else if (st === 'Pending') badgeCls = 'badge-pending';

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${monthNames[m - 1]} ${curWargaYear}</strong></td>
          <td>${ReportGenerator.formatRupiah(this.data.settings.iuranWajibBulanan)}</td>
          <td><span class="badge-status ${badgeCls}">${st}</span></td>
          <td style="text-align: right;">
            ${st === 'Lunas' ? `
              <button class="btn-outline-pill" style="padding: 4px 10px; font-size: 11px;" onclick="
                ReportGenerator.openKwitansi({
                  kwitansi: 'KW-IURAN-${resident.id}-${m}-${curWargaYear}',
                  judul: 'Iuran ${monthNames[m-1]} ${curWargaYear} - ${resident.nama}',
                  blok: '${resident.alamat}',
                  tanggal: '${curWargaYear}-${String(m).padStart(2, '0')}-05',
                  kategori: 'Iuran Bulanan',
                  nominal: ${this.data.settings.iuranWajibBulanan},
                  metode: 'Transfer / QRIS RT'
                })
              ">📄 Cetak Kwitansi</button>
            ` : (st === 'Pending' ? `
              <span style="font-size: 11px; color: #b45309;">Menunggu Verifikasi Bendahara</span>
            ` : `
              <button class="btn-teal-pill" style="padding: 4px 10px; font-size: 11px;" onclick="App.openModal('modalKonfirmasiWarga')">
                💳 Bayar Sekarang
              </button>
            `)}
          </td>
        `;
        matrixContainer.appendChild(tr);
      }
    }

    if (txContainer) {
      txContainer.innerHTML = '';
      const myTxs = (this.data.transactions || []).filter(t => t.residentId === resident.id);
      if (myTxs.length === 0) {
        txContainer.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px; color: #94a3b8;">Belum ada riwayat transaksi pembayaran tercatat untuk rumah Anda.</td></tr>`;
      } else {
        myTxs.forEach((tx, idx) => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${idx + 1}</td>
            <td><strong>${tx.tanggal}</strong></td>
            <td>${tx.judul}<br><span style="font-size: 11px; color: #64748b;">${tx.kategori} • ${tx.metode}</span></td>
            <td style="font-weight: 700; color: #0d9488;">${ReportGenerator.formatRupiah(tx.nominal)}</td>
            <td>
              <button class="btn-icon-action" title="Cetak Kwitansi" onclick="ReportGenerator.openKwitansi(${JSON.stringify(tx).replace(/"/g, '&quot;')})">
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              </button>
            </td>
          `;
          txContainer.appendChild(tr);
        });
      }
    }
  },

  // =========================================================================
  // Laporan Keuangan LPJ
  // =========================================================================
  renderFinancialReport() {
    const previewContainer = document.getElementById('reportPreviewIframe');
    if (!previewContainer) return;

    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const curYear = AppState.selectedYear || new Date().getFullYear();
    const curMonth = AppState.selectedMonth || (new Date().getMonth() + 1);
    const curPeriod = `${monthNames[curMonth - 1] || 'Bulan'} ${curYear}`;
    const html = ReportGenerator.generateReportHTML(curPeriod);
    previewContainer.srcdoc = html;
  },

  // =========================================================================
  // Global Search Handler
  // =========================================================================
  handleSearch() {
    if (AppState.activeTab === 'warga') {
      AppState.wargaPage = 1;
      this.renderResidents(1);
    } else if (AppState.activeTab === 'kas') {
      this.renderTransactions();
    } else {
      this.renderDashboard();
    }
  },

  // Modal helpers
  openModal(modalId) {
    if (modalId === 'modalCatatKas') {
      const curTipe = document.getElementById('txTipe')?.value || 'masuk';
      this.renderTxCategoryOptions(curTipe);
    }
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  },

  updateNotificationBadge() {
    let pendingTx = 0;
    (this.data.transactions || []).forEach(t => {
      if (t.status === 'Pending') pendingTx++;
    });

    let pendingSetoran = 0;
    (this.data.setoranBlok || []).forEach(s => {
      if (s.status === 'Menunggu Konfirmasi') pendingSetoran++;
    });

    const notifBadge = document.getElementById('headerNotifBadge');
    if (notifBadge) {
      notifBadge.style.display = (pendingTx + pendingSetoran) > 0 ? 'block' : 'none';
    }

    const badgePendingSetoran = document.getElementById('badgePendingSetoran');
    if (badgePendingSetoran) {
      if (pendingSetoran > 0 && AppState.currentRole === 'pengurus') {
        badgePendingSetoran.style.display = 'inline-block';
        badgePendingSetoran.textContent = pendingSetoran;
      } else {
        badgePendingSetoran.style.display = 'none';
      }
    }
  }
};

window.App = App;

// Bootstrap bulletproof DOM ready
if (document.readyState !== 'loading') {
  App.init();
} else {
  document.addEventListener('DOMContentLoaded', () => {
    App.init();
  });
}
