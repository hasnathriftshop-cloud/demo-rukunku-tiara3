/**
 * ============================================================================
 * RukunKu - Google Apps Script Backend API (Versi Lengkap & Multi-User Aman)
 * Lingkungan RT 05 / RW 02 Perum Tiara Candi 3
 * ============================================================================
 * 
 * Script ini berfungsi sebagai REST API backend gratis menggunakan Google Sheets
 * sebagai database untuk webapp RukunKu.
 * 
 * Database Sheets yang Dikelola:
 * 1. Warga      : Data kepala keluarga, NIK, alamat, WhatsApp, dan dokumen
 * 2. Transaksi  : Buku kas masuk dan keluar RT
 * 3. Iuran      : Matriks checklist status pembayaran iuran 12 bulan
 * 4. Talangan   : Catatan kasbon / dana talangan warga
 * 5. Pengaturan : Pengaturan identitas RT, nama perumahan, blok, dan kategori kas
 * 6. Petugas    : Akun petugas penagih iuran per blok RT
 * 7. Setoran    : Riwayat serah terima setoran kas dari petugas ke bendahara
 */

// Nama-nama sheet yang digunakan
const SHEET_NAMES = {
  WARGA: 'Warga',
  TRANSAKSI: 'Transaksi',
  IURAN: 'Iuran',
  TALANGAN: 'Talangan',
  PENGATURAN: 'Pengaturan',
  PETUGAS: 'Petugas',
  SETORAN: 'Setoran'
};

/**
 * Handle GET Request (Tarik Data & Healthcheck)
 */
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'getData';

    if (action === 'ping') {
      return jsonResponse({
        status: 'success',
        message: 'API RukunKu Google Sheets aktif & siap digunakan!',
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'initSheets') {
      const initResult = initializeAllSheets();
      return jsonResponse({
        status: 'success',
        message: 'Inisialisasi 7 sheet RukunKu berhasil dilakukan.',
        result: initResult
      });
    }

    if (action === 'getData') {
      // Baca langsung tanpa validasi skema berulang agar respons super cepat
      const allData = fetchAllDataFromSheets();
      return jsonResponse({
        status: 'success',
        data: allData
      });
    }

    return jsonResponse({
      status: 'error',
      message: 'Aksi GET tidak dikenali: ' + action
    });

  } catch (err) {
    return jsonResponse({
      status: 'error',
      message: err.toString(),
      stack: err.stack
    });
  }
}

/**
 * Handle POST Request (Simpan / Sinkronisasi Data)
 */
function doPost(e) {
  try {
    ensureSheetsExist();
    
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    const action = payload.action || 'syncAll';

    // 1. Simpan Snapshot Penuh (Sinkronisasi Semua Data Tanpa Hapus Data Lain)
    if (action === 'syncAll' && payload.data) {
      saveAllDataToSheets(payload.data);
      return jsonResponse({
        status: 'success',
        message: 'Semua data berhasil disinkronisasikan ke Google Sheets.',
        timestamp: new Date().toISOString()
      });
    }

    // 2. Tambah / Edit Transaksi Kas
    if (action === 'addTransaction' && payload.transaction) {
      addTransactionRow(payload.transaction);
      return jsonResponse({
        status: 'success',
        message: 'Transaksi kas berhasil dicatat di Google Sheets.'
      });
    }

    // 3. Tambah / Edit Data Warga (Langsung & Aman dengan Google Drive)
    if (action === 'saveResident' && payload.resident) {
      const savedRes = upsertResidentRow(payload.resident);
      return jsonResponse({
        status: 'success',
        message: 'Data warga berhasil disimpan di Google Sheets & Google Drive.',
        resident: savedRes
      });
    }

    // 4. Hapus Warga
    if (action === 'deleteResident' && payload.residentId) {
      deleteResidentRow(payload.residentId);
      return jsonResponse({
        status: 'success',
        message: 'Data warga berhasil dihapus dari Google Sheets.'
      });
    }

    // 5. Tambah / Edit Petugas Penagih Blok
    if (action === 'saveCollector' && payload.collector) {
      upsertCollectorRow(payload.collector);
      return jsonResponse({
        status: 'success',
        message: 'Data petugas penagih berhasil disimpan di Google Sheets.'
      });
    }

    // 6. Hapus Petugas Penagih Blok
    if (action === 'deleteCollector' && payload.collectorId) {
      deleteCollectorRow(payload.collectorId);
      return jsonResponse({
        status: 'success',
        message: 'Data petugas penagih berhasil dihapus dari Google Sheets.'
      });
    }

    // 7. Tambah / Update Setoran Kas Blok
    if (action === 'saveSetoran' && payload.setoran) {
      upsertSetoranRow(payload.setoran);
      return jsonResponse({
        status: 'success',
        message: 'Data setoran kas berhasil dicatat di Google Sheets.'
      });
    }

    // 8. Update Matriks Iuran
    if (action === 'updateDues' && payload.residentId && payload.month && payload.status) {
      updateDuesStatus(payload.residentId, payload.month, payload.status);
      return jsonResponse({
        status: 'success',
        message: 'Status iuran berhasil diperbarui.'
      });
    }

    // 9. Tambah / Bayar Talangan
    if (action === 'saveTalangan' && payload.talangan) {
      upsertTalanganRow(payload.talangan);
      return jsonResponse({
        status: 'success',
        message: 'Catatan talangan berhasil disimpan.'
      });
    }

    return jsonResponse({
      status: 'error',
      message: 'Aksi POST tidak valid: ' + action
    });

  } catch (err) {
    return jsonResponse({
      status: 'error',
      message: err.toString()
    });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// LOGIKA DATABASE GOOGLE SHEETS
// ============================================================================

/**
 * Pastikan seluruh lembar kerja (7 sheets) telah ada
 */
function ensureSheetsExist() {
  const activeSS = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = [
    SHEET_NAMES.WARGA,
    SHEET_NAMES.TRANSAKSI,
    SHEET_NAMES.IURAN,
    SHEET_NAMES.TALANGAN,
    SHEET_NAMES.PENGATURAN,
    SHEET_NAMES.PETUGAS,
    SHEET_NAMES.SETORAN
  ];
  
  sheets.forEach(name => {
    let sheet = activeSS.getSheetByName(name);
    if (!sheet) {
      sheet = activeSS.insertSheet(name);
      setupSheetHeaders(sheet, name);
    } else {
      ensureSheetHeadersOnly(sheet, name);
    }
  });

  // Hapus sheet bawaan "Sheet1" jika masih kosong
  const defaultSheet = activeSS.getSheetByName('Sheet1') || activeSS.getSheetByName('Sheet 1');
  if (defaultSheet && activeSS.getSheets().length > 1) {
    try { activeSS.deleteSheet(defaultSheet); } catch (e) {}
  }
}

function getHeadersForSheet(name) {
  if (name === SHEET_NAMES.WARGA) {
    return ['ID', 'Nama Kepala Keluarga', 'NIK', 'No KK', 'Blok', 'No Rumah', 'Alamat', 'No WhatsApp', 'Jumlah Jiwa', 'Status Hunian', 'Pekerjaan', 'Status Aktif', 'Tanggal Masuk', 'Avatar Bg', 'Password', 'Anggota Keluarga (JSON)', 'Foto KK (URL Drive)'];
  } else if (name === SHEET_NAMES.TRANSAKSI) {
    return ['ID Transaksi', 'Tanggal', 'Waktu', 'Jenis', 'Kategori', 'Judul Transaksi', 'Keterangan', 'ID Warga', 'Blok / Alamat', 'Nominal (Rp)', 'Metode Bayar', 'Status', 'No Kwitansi', 'Pencatat'];
  } else if (name === SHEET_NAMES.IURAN) {
    return ['ID Warga', 'Nama KK', 'Blok/Rumah', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
  } else if (name === SHEET_NAMES.TALANGAN) {
    return ['ID', 'ID Warga', 'Nama Peminjam', 'Blok', 'WhatsApp', 'Total Pinjaman', 'Terbayar', 'Sisa Saldo', 'Tgl Pinjam', 'Jatuh Tempo', 'Keperluan', 'Status', 'Keterangan'];
  } else if (name === SHEET_NAMES.PENGATURAN) {
    return ['Kunci (Key)', 'Nilai (Value)'];
  } else if (name === SHEET_NAMES.PETUGAS) {
    return ['ID Petugas', 'ID Warga Terkait', 'Nama Petugas', 'Blok Asal', 'Username Akun', 'Password', 'No WhatsApp', 'Blok Tugas', 'Blok Ditugaskan (JSON)', 'Peran'];
  } else if (name === SHEET_NAMES.SETORAN) {
    return ['ID Setoran', 'ID Petugas', 'Nama Petugas', 'Blok Tugas', 'Bulan', 'Tahun', 'Jumlah KK', 'Total Nominal (Rp)', 'Metode', 'Tanggal Setor', 'Status', 'Catatan', 'Tanggal Diterima', 'Diterima Oleh', 'Bukti Foto'];
  }
  return [];
}

function formatHeaderRow(sheet, colCount) {
  if (colCount <= 0) return;
  const headerRange = sheet.getRange(1, 1, 1, colCount);
  headerRange.setBackground('#148878')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.setFrozenRows(1);
}

function ensureSheetHeadersOnly(sheet, name) {
  const headers = getHeadersForSheet(name);
  if (headers.length === 0) return;

  const maxCols = sheet.getMaxColumns();
  if (maxCols < headers.length) {
    sheet.insertColumnsAfter(maxCols, headers.length - maxCols);
  }
  
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    formatHeaderRow(sheet, headers.length);
  } else {
    const curCols = sheet.getLastColumn();
    if (curCols < headers.length) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      formatHeaderRow(sheet, headers.length);
    }
  }
}

function setupSheetHeaders(sheet, name) {
  const headers = getHeadersForSheet(name);
  if (headers.length > 0) {
    sheet.clear();
    sheet.appendRow(headers);
    formatHeaderRow(sheet, headers.length);
  }
}

/**
 * Tarik seluruh data dari Google Sheets ke format JSON RukunKu
 */
function fetchAllDataFromSheets() {
  const activeSS = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Pengaturan & Blok & Kategori
  const settingsSheet = activeSS.getSheetByName(SHEET_NAMES.PENGATURAN);
  const settings = {};
  let blocks = null;
  let categories = null;

  if (settingsSheet && settingsSheet.getLastRow() > 1) {
    const sRows = settingsSheet.getRange(2, 1, settingsSheet.getLastRow() - 1, 2).getValues();
    sRows.forEach(row => {
      if (row[0]) {
        const key = String(row[0]).trim();
        if (key === '_blocks_json') {
          try { blocks = JSON.parse(row[1]); } catch(e){}
        } else if (key === '_categories_json') {
          try { categories = JSON.parse(row[1]); } catch(e){}
        } else {
          let val = row[1];
          if (typeof val === 'string' && !isNaN(val) && val.trim() !== '') {
            val = Number(val);
          }
          settings[key] = val;
        }
      }
    });
  }

  // 2. Data Warga
  const residentsSheet = activeSS.getSheetByName(SHEET_NAMES.WARGA);
  const residents = [];
  if (residentsSheet && residentsSheet.getLastRow() > 1) {
    const maxCols = Math.max(17, residentsSheet.getLastColumn());
    const rRows = residentsSheet.getRange(2, 1, residentsSheet.getLastRow() - 1, maxCols).getValues();
    rRows.forEach(row => {
      if (row[0]) {
        const id = String(row[0]).trim();
        const nama = String(row[1] || '').trim();
        const nik = String(row[2] || '').replace(/^'/, '').trim();
        
        let familyMembers = [];
        if (row[15]) {
          try { familyMembers = JSON.parse(row[15]); } catch(e) {}
        }
        if (!familyMembers || familyMembers.length === 0) {
          familyMembers = [
            {
              id: `${id}-fm-1`,
              nama: nama,
              hubungan: 'Kepala Keluarga',
              nik: nik,
              jenisKelamin: 'Laki-laki',
              tanggalLahir: '',
              punyaKtp: !!nik,
              fotoKtp: ''
            }
          ];
        }

        residents.push({
          id: id,
          nama: nama,
          nik: nik,
          noKk: String(row[3] || '').replace(/^'/, '').trim(),
          blok: String(row[4] || '').trim(),
          noRumah: String(row[5] || '').trim(),
          alamat: String(row[6] || '').trim(),
          phone: String(row[7] || '').replace(/^'/, '').trim(),
          jumlahAnggota: familyMembers.length || Number(row[8] || 1),
          statusHunian: String(row[9] || 'Pemilik Tetap'),
          pekerjaan: String(row[10] || ''),
          statusAktif: row[11] === true || String(row[11]).toLowerCase() === 'true',
          tanggalMasuk: formatDate(row[12]),
          avatarBg: String(row[13] || 'bg-pastel-teal'),
          password: String(row[14] || '123456'),
          familyMembers: familyMembers,
          fotoKk: String(row[16] || '').trim()
        });
      }
    });
  }

  // 3. Data Transaksi
  const txSheet = activeSS.getSheetByName(SHEET_NAMES.TRANSAKSI);
  const transactions = [];
  if (txSheet && txSheet.getLastRow() > 1) {
    const tRows = txSheet.getRange(2, 1, txSheet.getLastRow() - 1, 14).getValues();
    tRows.forEach(row => {
      if (row[0]) {
        transactions.push({
          id: String(row[0]),
          tanggal: formatDate(row[1]),
          waktu: String(row[2] || '10:00'),
          tipe: String(row[3] || 'masuk').toLowerCase(),
          kategori: String(row[4] || 'Iuran Bulanan'),
          judul: String(row[5] || ''),
          keterangan: String(row[6] || ''),
          residentId: row[7] ? String(row[7]) : null,
          blok: String(row[8] || ''),
          nominal: Number(row[9] || 0),
          metode: String(row[10] || 'Kas Tunai'),
          status: String(row[11] || 'Approved'),
          kwitansi: String(row[12] || ''),
          pencatat: String(row[13] || '')
        });
      }
    });
  }

  // 4. Matriks Iuran
  const iuranSheet = activeSS.getSheetByName(SHEET_NAMES.IURAN);
  const duesMatrix = {};
  if (iuranSheet && iuranSheet.getLastRow() > 1) {
    const iRows = iuranSheet.getRange(2, 1, iuranSheet.getLastRow() - 1, 15).getValues();
    const year2026Map = {};
    iRows.forEach(row => {
      const resId = String(row[0]);
      if (resId) {
        duesMatrix[resId] = {};
        year2026Map[resId] = {};
        for (let m = 1; m <= 12; m++) {
          const val = String(row[2 + m] || 'Belum');
          duesMatrix[resId][m] = val;
          year2026Map[resId][m] = val;
        }
      }
    });
    duesMatrix['2026'] = year2026Map;
  }

  // 5. Catatan Talangan
  const talanganSheet = activeSS.getSheetByName(SHEET_NAMES.TALANGAN);
  const talangan = [];
  if (talanganSheet && talanganSheet.getLastRow() > 1) {
    const tlRows = talanganSheet.getRange(2, 1, talanganSheet.getLastRow() - 1, 13).getValues();
    tlRows.forEach(row => {
      if (row[0]) {
        talangan.push({
          id: String(row[0]),
          residentId: row[1] ? String(row[1]) : null,
          namaPeminjam: String(row[2] || ''),
          blok: String(row[3] || ''),
          phone: String(row[4] || ''),
          nominalTotal: Number(row[5] || 0),
          terbayar: Number(row[6] || 0),
          sisa: Number(row[7] || 0),
          tanggalPinjam: formatDate(row[8]),
          jatuhTempo: formatDate(row[9]),
          keperluan: String(row[10] || ''),
          status: String(row[11] || 'Belum Lunas'),
          keterangan: String(row[12] || '')
        });
      }
    });
  }

  // 6. Data Petugas Penagih Blok (DATABASE PETUGAS)
  const colSheet = activeSS.getSheetByName(SHEET_NAMES.PETUGAS);
  const collectors = [];
  if (colSheet && colSheet.getLastRow() > 1) {
    const colRows = colSheet.getRange(2, 1, colSheet.getLastRow() - 1, 10).getValues();
    colRows.forEach(row => {
      if (row[0]) {
        let assigned = [];
        try { assigned = JSON.parse(row[8]); } catch(e) { assigned = [String(row[7] || '')]; }
        collectors.push({
          id: String(row[0]),
          residentId: String(row[1] || ''),
          nama: String(row[2] || ''),
          blokAsal: String(row[3] || ''),
          username: String(row[4] || ''),
          password: String(row[5] || '123'),
          phone: String(row[6] || '').replace(/^'/, ''),
          blokTugas: String(row[7] || ''),
          assignedBlocks: Array.isArray(assigned) ? assigned : [String(row[7] || '')],
          role: String(row[9] || 'petugas')
        });
      }
    });
  }

  // 7. Data Setoran Kas Blok ke Bendahara (DATABASE SETORAN)
  const setoranSheet = activeSS.getSheetByName(SHEET_NAMES.SETORAN);
  const setoranBlok = [];
  if (setoranSheet && setoranSheet.getLastRow() > 1) {
    const setRows = setoranSheet.getRange(2, 1, setoranSheet.getLastRow() - 1, 15).getValues();
    setRows.forEach(row => {
      if (row[0]) {
        setoranBlok.push({
          id: String(row[0]),
          collectorId: String(row[1] || ''),
          collectorName: String(row[2] || ''),
          blokTugas: String(row[3] || ''),
          periodeBulan: Number(row[4] || 1),
          periodeTahun: Number(row[5] || 2026),
          jumlahKkTerbayar: Number(row[6] || 0),
          nominalTotal: Number(row[7] || 0),
          metode: String(row[8] || 'Tunai Fisik'),
          tanggalSetor: formatDate(row[9]),
          status: String(row[10] || 'Menunggu Konfirmasi'),
          catatan: String(row[11] || ''),
          tanggalDiterima: String(row[12] || ''),
          diterimaOleh: String(row[13] || ''),
          buktiFoto: String(row[14] || '')
        });
      }
    });
  }

  return {
    settings: Object.keys(settings).length > 0 ? settings : null,
    blocks: blocks,
    categories: categories,
    residents: residents,
    transactions: transactions,
    duesMatrix: Object.keys(duesMatrix).length > 0 ? duesMatrix : null,
    talangan: talangan,
    collectors: collectors,
    setoranBlok: setoranBlok
  };
}

/**
 * Simpan seluruh data ke Sheets secara aman dengan penggabungan (Upsert Merge)
 * Tidak menghapus data warga atau transaksi lain yang sudah ada di sheet!
 */
function saveAllDataToSheets(data) {
  const activeSS = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Simpan Warga (Merge Cerdas: Update jika ada, Tambah jika belum ada)
  if (data.residents && Array.isArray(data.residents)) {
    const sheet = activeSS.getSheetByName(SHEET_NAMES.WARGA);
    if (sheet) {
      ensureSheetHeadersOnly(sheet, SHEET_NAMES.WARGA);
      
      const existingMap = new Map();
      if (sheet.getLastRow() > 1) {
        const existingData = sheet.getRange(2, 1, sheet.getLastRow() - 1, 17).getValues();
        existingData.forEach(row => {
          const id = String(row[0] || '').trim();
          if (id) existingMap.set(id, row);
        });
      }

      // Masukkan / update data dari payload
      data.residents.forEach(r => {
        const id = String(r.id || '').trim();
        if (id) {
          // Upload foto KK ke Drive jika masih Base64
          let fotoKkUrl = r.fotoKk || '';
          if (fotoKkUrl && fotoKkUrl.startsWith('data:image/')) {
            const cleanNama = (r.nama || 'warga').replace(/[^a-zA-Z0-9]/g, '_');
            fotoKkUrl = uploadBase64ToDrive(fotoKkUrl, 'KK_' + cleanNama + '_' + (r.noKk || r.id), 'Kartu Keluarga');
            r.fotoKk = fotoKkUrl;
          }

          // Upload foto KTP setiap anggota keluarga ke Drive jika masih Base64
          if (r.familyMembers && Array.isArray(r.familyMembers)) {
            r.familyMembers.forEach((m, idx) => {
              if (m.fotoKtp && m.fotoKtp.startsWith('data:image/')) {
                const cleanMemberNama = (m.nama || ('anggota_' + idx)).replace(/[^a-zA-Z0-9]/g, '_');
                const ktpUrl = uploadBase64ToDrive(m.fotoKtp, 'KTP_' + cleanMemberNama + '_' + (m.nik || m.id), 'Foto KTP');
                m.fotoKtp = ktpUrl;
              }
            });
          }

          const row = [
            id,
            r.nama || '',
            "'" + (r.nik || ''),
            "'" + (r.noKk || ''),
            r.blok || '',
            r.noRumah || '',
            r.alamat || '',
            "'" + (r.phone || ''),
            r.jumlahAnggota || (r.familyMembers ? r.familyMembers.length : 1),
            r.statusHunian || 'Pemilik Tetap',
            r.pekerjaan || '',
            r.statusAktif !== false,
            r.tanggalMasuk || '',
            r.avatarBg || 'bg-pastel-teal',
            r.password || '123456',
            JSON.stringify(r.familyMembers || []),
            fotoKkUrl || ''
          ];
          existingMap.set(id, row);
        }
      });

      const combinedRows = Array.from(existingMap.values());
      if (combinedRows.length > 0) {
        if (sheet.getLastRow() > 1) {
          sheet.getRange(2, 1, sheet.getLastRow() - 1, 17).clearContent();
        }
        sheet.getRange(2, 1, combinedRows.length, 17).setValues(combinedRows);
      }
    }
  }

  // 2. Simpan Transaksi (Merge Berdasarkan ID Transaksi)
  if (data.transactions && Array.isArray(data.transactions)) {
    const sheet = activeSS.getSheetByName(SHEET_NAMES.TRANSAKSI);
    if (sheet) {
      ensureSheetHeadersOnly(sheet, SHEET_NAMES.TRANSAKSI);
      
      const txMap = new Map();
      if (sheet.getLastRow() > 1) {
        const existingTx = sheet.getRange(2, 1, sheet.getLastRow() - 1, 14).getValues();
        existingTx.forEach(row => {
          const id = String(row[0] || '').trim();
          if (id) txMap.set(id, row);
        });
      }

      data.transactions.forEach(t => {
        const id = String(t.id || '').trim();
        if (id) {
          const row = [
            id,
            t.tanggal || '',
            t.waktu || '10:00',
            t.tipe || 'masuk',
            t.kategori || 'Iuran Bulanan',
            t.judul || '',
            t.keterangan || '',
            t.residentId || '',
            t.blok || '',
            t.nominal || 0,
            t.metode || 'Kas Tunai',
            t.status || 'Approved',
            t.kwitansi || '',
            t.pencatat || ''
          ];
          txMap.set(id, row);
        }
      });

      const combinedTx = Array.from(txMap.values());
      if (combinedTx.length > 0) {
        if (sheet.getLastRow() > 1) {
          sheet.getRange(2, 1, sheet.getLastRow() - 1, 14).clearContent();
        }
        sheet.getRange(2, 1, combinedTx.length, 14).setValues(combinedTx);
      }
    }
  }

  // 3. Simpan Matriks Iuran
  if (data.duesMatrix && data.residents) {
    const sheet = activeSS.getSheetByName(SHEET_NAMES.IURAN);
    if (sheet) {
      ensureSheetHeadersOnly(sheet, SHEET_NAMES.IURAN);
      const rows = [];
      data.residents.forEach(r => {
        const matrix = (data.duesMatrix['2026'] && data.duesMatrix['2026'][r.id]) || data.duesMatrix[r.id] || {};
        const row = [r.id, r.nama, (r.blok || '') + '/' + (r.noRumah || '')];
        for (let m = 1; m <= 12; m++) {
          row.push(matrix[m] || 'Belum');
        }
        rows.push(row);
      });
      if (rows.length > 0) {
        if (sheet.getLastRow() > 1) {
          sheet.getRange(2, 1, sheet.getLastRow() - 1, 15).clearContent();
        }
        sheet.getRange(2, 1, rows.length, 15).setValues(rows);
      }
    }
  }

  // 4. Simpan Talangan
  if (data.talangan && Array.isArray(data.talangan)) {
    const sheet = activeSS.getSheetByName(SHEET_NAMES.TALANGAN);
    if (sheet) {
      ensureSheetHeadersOnly(sheet, SHEET_NAMES.TALANGAN);
      const rows = data.talangan.map(tl => [
        tl.id,
        tl.residentId || '',
        tl.namaPeminjam || '',
        tl.blok || '',
        "'" + (tl.phone || ''),
        tl.nominalTotal || 0,
        tl.terbayar || 0,
        tl.sisa || 0,
        tl.tanggalPinjam || '',
        tl.jatuhTempo || '',
        tl.keperluan || '',
        tl.status || 'Belum Lunas',
        tl.keterangan || ''
      ]);
      if (rows.length > 0) {
        if (sheet.getLastRow() > 1) {
          sheet.getRange(2, 1, sheet.getLastRow() - 1, 13).clearContent();
        }
        sheet.getRange(2, 1, rows.length, 13).setValues(rows);
      }
    }
  }

  // 5. Simpan Petugas Penagih Blok (Sheet Petugas)
  if (data.collectors && Array.isArray(data.collectors)) {
    const sheet = activeSS.getSheetByName(SHEET_NAMES.PETUGAS);
    if (sheet) {
      ensureSheetHeadersOnly(sheet, SHEET_NAMES.PETUGAS);
      const rows = data.collectors.map(c => [
        c.id,
        c.residentId || '',
        c.nama || '',
        c.blokAsal || '',
        c.username || '',
        c.password || '123',
        "'" + (c.phone || ''),
        c.blokTugas || '',
        JSON.stringify(c.assignedBlocks || []),
        c.role || 'petugas'
      ]);
      if (rows.length > 0) {
        if (sheet.getLastRow() > 1) {
          sheet.getRange(2, 1, sheet.getLastRow() - 1, 10).clearContent();
        }
        sheet.getRange(2, 1, rows.length, 10).setValues(rows);
      }
    }
  }

  // 6. Simpan Setoran Kas Blok (Sheet Setoran)
  if (data.setoranBlok && Array.isArray(data.setoranBlok)) {
    const sheet = activeSS.getSheetByName(SHEET_NAMES.SETORAN);
    if (sheet) {
      ensureSheetHeadersOnly(sheet, SHEET_NAMES.SETORAN);
      const rows = data.setoranBlok.map(s => [
        s.id,
        s.collectorId || '',
        s.collectorName || '',
        s.blokTugas || '',
        Number(s.periodeBulan || 1),
        Number(s.periodeTahun || 2026),
        Number(s.jumlahKkTerbayar || 0),
        Number(s.nominalTotal || 0),
        s.metode || 'Tunai Fisik',
        s.tanggalSetor || '',
        s.status || 'Menunggu Konfirmasi',
        s.catatan || '',
        s.tanggalDiterima || '',
        s.diterimaOleh || '',
        s.buktiFoto || ''
      ]);
      if (rows.length > 0) {
        if (sheet.getLastRow() > 1) {
          sheet.getRange(2, 1, sheet.getLastRow() - 1, 15).clearContent();
        }
        sheet.getRange(2, 1, rows.length, 15).setValues(rows);
      }
    }
  }

  // 7. Simpan Pengaturan & Blok & Kategori
  if (data.settings) {
    const sheet = activeSS.getSheetByName(SHEET_NAMES.PENGATURAN);
    if (sheet) {
      ensureSheetHeadersOnly(sheet, SHEET_NAMES.PENGATURAN);
      const rows = [];
      Object.keys(data.settings).forEach(k => {
        rows.push([k, data.settings[k]]);
      });
      if (data.blocks && Array.isArray(data.blocks)) {
        rows.push(['_blocks_json', JSON.stringify(data.blocks)]);
      }
      if (data.categories) {
        rows.push(['_categories_json', JSON.stringify(data.categories)]);
      }
      if (rows.length > 0) {
        if (sheet.getLastRow() > 1) {
          sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).clearContent();
        }
        sheet.getRange(2, 1, rows.length, 2).setValues(rows);
      }
    }
  }
}

/**
 * Tambah baris transaksi kas langsung ke Google Sheets
 */
function addTransactionRow(tx) {
  const activeSS = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = activeSS.getSheetByName(SHEET_NAMES.TRANSAKSI);
  if (!sheet) return;
  ensureSheetHeadersOnly(sheet, SHEET_NAMES.TRANSAKSI);
  sheet.appendRow([
    tx.id,
    tx.tanggal || '',
    tx.waktu || '10:00',
    tx.tipe || 'masuk',
    tx.kategori || 'Iuran Bulanan',
    tx.judul || '',
    tx.keterangan || '',
    tx.residentId || '',
    tx.blok || '',
    tx.nominal || 0,
    tx.metode || 'Kas Tunai',
    tx.status || 'Approved',
    tx.kwitansi || '',
    tx.pencatat || ''
  ]);
}

/**
 * Tambah / Update data warga langsung (Upsert)
 */
function upsertResidentRow(resident) {
  const activeSS = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = activeSS.getSheetByName(SHEET_NAMES.WARGA);
  if (!sheet) return;
  ensureSheetHeadersOnly(sheet, SHEET_NAMES.WARGA);
  
  // 1. Upload foto KK ke Drive jika masih Base64
  let fotoKkUrl = resident.fotoKk || '';
  if (fotoKkUrl && fotoKkUrl.startsWith('data:image/')) {
    const cleanNama = (resident.nama || 'warga').replace(/[^a-zA-Z0-9]/g, '_');
    fotoKkUrl = uploadBase64ToDrive(fotoKkUrl, 'KK_' + cleanNama + '_' + (resident.noKk || resident.id), 'Kartu Keluarga');
    resident.fotoKk = fotoKkUrl;
  }

  // 2. Upload foto KTP setiap anggota keluarga ke Drive jika masih Base64
  if (resident.familyMembers && Array.isArray(resident.familyMembers)) {
    resident.familyMembers.forEach((m, idx) => {
      if (m.fotoKtp && m.fotoKtp.startsWith('data:image/')) {
        const cleanMemberNama = (m.nama || ('anggota_' + idx)).replace(/[^a-zA-Z0-9]/g, '_');
        const ktpUrl = uploadBase64ToDrive(m.fotoKtp, 'KTP_' + cleanMemberNama + '_' + (m.nik || m.id), 'Foto KTP');
        m.fotoKtp = ktpUrl;
      }
    });
  }

  const lastRow = sheet.getLastRow();
  let foundRow = -1;
  if (lastRow > 1) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === String(resident.id).trim()) {
        foundRow = i + 2;
        break;
      }
    }
  }

  const row = [
    resident.id,
    resident.nama || '',
    "'" + (resident.nik || ''),
    "'" + (resident.noKk || ''),
    resident.blok || '',
    resident.noRumah || '',
    resident.alamat || '',
    "'" + (resident.phone || ''),
    resident.jumlahAnggota || (resident.familyMembers ? resident.familyMembers.length : 1),
    resident.statusHunian || 'Pemilik Tetap',
    resident.pekerjaan || '',
    resident.statusAktif !== false,
    resident.tanggalMasuk || '',
    resident.avatarBg || 'bg-pastel-teal',
    resident.password || '123456',
    JSON.stringify(resident.familyMembers || []),
    fotoKkUrl || ''
  ];

  if (foundRow > 1) {
    sheet.getRange(foundRow, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }

  return resident;
}

/**
 * Hapus warga langsung dari sheet Warga
 */
function deleteResidentRow(residentId) {
  const activeSS = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = activeSS.getSheetByName(SHEET_NAMES.WARGA);
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = ids.length - 1; i >= 0; i--) {
    if (String(ids[i][0]).trim() === String(residentId).trim()) {
      sheet.deleteRow(i + 2);
      break;
    }
  }
}

/**
 * Tambah / Update data petugas penagih langsung
 */
function upsertCollectorRow(col) {
  const activeSS = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = activeSS.getSheetByName(SHEET_NAMES.PETUGAS);
  if (!sheet) return;
  ensureSheetHeadersOnly(sheet, SHEET_NAMES.PETUGAS);

  const lastRow = sheet.getLastRow();
  let foundRow = -1;
  if (lastRow > 1) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === String(col.id).trim()) {
        foundRow = i + 2;
        break;
      }
    }
  }

  const row = [
    col.id,
    col.residentId || '',
    col.nama || '',
    col.blokAsal || '',
    col.username || '',
    col.password || '123',
    "'" + (col.phone || ''),
    col.blokTugas || '',
    JSON.stringify(col.assignedBlocks || []),
    col.role || 'petugas'
  ];

  if (foundRow > 1) {
    sheet.getRange(foundRow, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }

  return resident;
}

function deleteCollectorRow(collectorId) {
  const activeSS = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = activeSS.getSheetByName(SHEET_NAMES.PETUGAS);
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = ids.length - 1; i >= 0; i--) {
    if (String(ids[i][0]).trim() === String(collectorId).trim()) {
      sheet.deleteRow(i + 2);
      break;
    }
  }
}

/**
 * Tambah / Update setoran kas blok langsung
 */
function upsertSetoranRow(s) {
  const activeSS = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = activeSS.getSheetByName(SHEET_NAMES.SETORAN);
  if (!sheet) return;
  ensureSheetHeadersOnly(sheet, SHEET_NAMES.SETORAN);

  // Upload foto bukti setoran jika masih Base64
  let buktiFotoUrl = s.buktiFoto || '';
  if (buktiFotoUrl && buktiFotoUrl.startsWith('data:image/')) {
    const cleanCollector = (s.collectorName || 'petugas').replace(/[^a-zA-Z0-9]/g, '_');
    buktiFotoUrl = uploadBase64ToDrive(buktiFotoUrl, 'Setoran_' + cleanCollector + '_' + s.id, 'Bukti Setoran Kas');
    s.buktiFoto = buktiFotoUrl;
  }

  const lastRow = sheet.getLastRow();
  let foundRow = -1;
  if (lastRow > 1) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === String(s.id).trim()) {
        foundRow = i + 2;
        break;
      }
    }
  }

  const row = [
    s.id,
    s.collectorId || '',
    s.collectorName || '',
    s.blokTugas || '',
    Number(s.periodeBulan || 1),
    Number(s.periodeTahun || 2026),
    Number(s.jumlahKkTerbayar || 0),
    Number(s.nominalTotal || 0),
    s.metode || 'Tunai Fisik',
    s.tanggalSetor || '',
    s.status || 'Menunggu Konfirmasi',
    s.catatan || '',
    s.tanggalDiterima || '',
    s.diterimaOleh || '',
    buktiFotoUrl || ''
  ];

  if (foundRow > 1) {
    sheet.getRange(foundRow, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }

  return resident;
}

/**
 * Update checklist iuran per warga per bulan
 */
function updateDuesStatus(residentId, month, status) {
  const activeSS = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = activeSS.getSheetByName(SHEET_NAMES.IURAN);
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;
  const colIndex = 3 + parseInt(month); // Jan = Col 4
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === String(residentId).trim()) {
      sheet.getRange(i + 2, colIndex).setValue(status);
      break;
    }
  }
}

/**
 * Tambah / Update catatan talangan
 */
function upsertTalanganRow(talangan) {
  const activeSS = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = activeSS.getSheetByName(SHEET_NAMES.TALANGAN);
  if (!sheet) return;
  ensureSheetHeadersOnly(sheet, SHEET_NAMES.TALANGAN);
  const row = [
    talangan.id,
    talangan.residentId || '',
    talangan.namaPeminjam || '',
    talangan.blok || '',
    "'" + (talangan.phone || ''),
    talangan.nominalTotal || 0,
    talangan.terbayar || 0,
    talangan.sisa || 0,
    talangan.tanggalPinjam || '',
    talangan.jatuhTempo || '',
    talangan.keperluan || '',
    talangan.status || 'Belum Lunas',
    talangan.keterangan || ''
  ];
  const lastRow = sheet.getLastRow();
  let foundRow = -1;
  if (lastRow > 1) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === String(talangan.id).trim()) {
        foundRow = i + 2;
        break;
      }
    }
  }
  if (foundRow > 1) {
    sheet.getRange(foundRow, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }

  return resident;
}

function formatDate(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(val);
}

function initializeAllSheets() {
  ensureSheetsExist();
  try {
    const mainFolder = getOrCreateDriveFolder("RukunKu - Dokumen Warga");
    getOrCreateSubFolder(mainFolder, "Kartu Keluarga");
    getOrCreateSubFolder(mainFolder, "Foto KTP");
    getOrCreateSubFolder(mainFolder, "Bukti Setoran Kas");
  } catch(e) {
    Logger.log("Peringatan Drive: " + e);
  }
  return "Inisialisasi 7 sheet RukunKu & Google Drive selesai.";
}

/**
 * Jalankan fungsi ini 1 kali di editor Google Apps Script untuk otorisasi Google Drive
 */
function testDriveAuthorization() {
  const mainFolder = getOrCreateDriveFolder("RukunKu - Dokumen Warga");
  getOrCreateSubFolder(mainFolder, "Kartu Keluarga");
  getOrCreateSubFolder(mainFolder, "Foto KTP");
  getOrCreateSubFolder(mainFolder, "Bukti Setoran Kas");
  Logger.log("✅ Otorisasi Google Drive Aktif! Folder: " + mainFolder.getName());
  return "Otorisasi Google Drive Berhasil!";
}

// ============================================================================
// GOOGLE DRIVE INTEGRATION (Penyimpanan Berkas Foto KTP, KK, & Bukti Setoran)
// ============================================================================

/**
 * Menyimpan data Base64 gambar ke folder Google Drive secara otomatis
 * Mengembalikan URL gambar langsung yang dapat dibuka & dipratinjau di webapp
 */
function uploadBase64ToDrive(base64Str, fileName, subFolderName) {
  if (!base64Str || typeof base64Str !== 'string') return '';
  base64Str = base64Str.trim();
  
  // Jika sudah berupa link URL (misal Google Drive link, Cloudinary, atau Web URL), langsung gunakan
  if (base64Str.startsWith('http://') || base64Str.startsWith('https://')) {
    return base64Str;
  }
  
  // Hanya proses jika berformat Data URL Base64
  if (!base64Str.startsWith('data:image/')) {
    return '';
  }

  try {
    const mainFolderName = "RukunKu - Dokumen Warga";
    const mainFolder = getOrCreateDriveFolder(mainFolderName);
    let targetFolder = mainFolder;
    if (subFolderName) {
      targetFolder = getOrCreateSubFolder(mainFolder, subFolderName);
    }

    const matches = base64Str.match(/^data:([^;]+);base64,([\s\S]+)$/);
    if (!matches || matches.length !== 3) {
      Logger.log("Format data base64 tidak cocok");
      return '';
    }

    const contentType = matches[1];
    const base64Data = matches[2].replace(/\s+/g, '');
    const decodedBytes = Utilities.base64Decode(base64Data);
    
    // Tentukan ekstensi file
    let ext = 'jpg';
    if (contentType.includes('png')) ext = 'png';
    else if (contentType.includes('webp')) ext = 'webp';

    const fullFileName = (fileName || ('dokumen_' + Date.now())) + '.' + ext;
    const blob = Utilities.newBlob(decodedBytes, contentType, fullFileName);
    const file = targetFolder.createFile(blob);

    // Buka akses file agar dapat dipratinjau di webapp RukunKu
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch(e) {
      Logger.log("Warning sharing: " + e);
    }

    // Mengembalikan URL view langsung berkecepatan tinggi dari Google CDN
    return 'https://lh3.googleusercontent.com/d/' + file.getId();
  } catch (err) {
    Logger.log("Gagal upload file ke Google Drive: " + err);
    return '';
  }
}

function getOrCreateDriveFolder(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(folderName);
}

function getOrCreateSubFolder(parentFolder, subFolderName) {
  const subFolders = parentFolder.getFoldersByName(subFolderName);
  if (subFolders.hasNext()) {
    return subFolders.next();
  }
  return parentFolder.createFolder(subFolderName);
}
