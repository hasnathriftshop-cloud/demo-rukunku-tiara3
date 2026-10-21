/**
 * RukunKu - PDF Report Generator & Print Module
 * Creates official RT financial statements ready for citizen meetings (Rapat Warga / LPJ)
 */

const ReportGenerator = {
  // Format currency helper
  formatRupiah(num) {
    return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
  },

  // Generate HTML LPJ Sheet for Print / PDF Export
  generateReportHTML(period = null) {
    const data = DB.load();
    const settings = data.settings;
    const transactions = data.transactions;
    const talangan = data.talangan;
    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    if (!period) {
      const curYear = (typeof AppState !== 'undefined' && AppState.selectedYear) ? AppState.selectedYear : new Date().getFullYear();
      const curMonth = (typeof AppState !== 'undefined' && AppState.selectedMonth) ? AppState.selectedMonth : (new Date().getMonth() + 1);
      period = `${monthNames[curMonth - 1]} ${curYear}`;
    }
    
    // Calculate totals
    let totalMasuk = 0;
    let totalKeluar = 0;
    const catMasuk = {};
    const catKeluar = {};

    transactions.forEach(t => {
      const nom = Number(t.nominal || 0);
      if (t.tipe === 'masuk') {
        totalMasuk += nom;
        catMasuk[t.kategori] = (catMasuk[t.kategori] || 0) + nom;
      } else {
        totalKeluar += nom;
        catKeluar[t.kategori] = (catKeluar[t.kategori] || 0) + nom;
      }
    });

    const saldoAkhir = totalMasuk - totalKeluar;
    const totalTalanganBelumLunas = talangan
      .filter(t => t.status !== 'Lunas')
      .reduce((sum, t) => sum + Number(t.sisa || 0), 0);

    const now = new Date();
    const formattedDateNow = `${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}`;

    // Table rows
    let currentBalance = 0;
    const rowsHtml = transactions.map((t, idx) => {
      const isMasuk = t.tipe === 'masuk';
      const nom = Number(t.nominal || 0);
      if (isMasuk) currentBalance += nom;
      else currentBalance -= nom;

      return `
        <tr>
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px 8px;">${idx + 1}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 8px;">${t.tanggal}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 8px;">
            <strong>${t.judul}</strong><br>
            <span style="font-size: 10px; color: #64748b;">${t.keterangan || '-'}</span>
          </td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 8px;">${t.kategori}</td>
          <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px 8px; color: ${isMasuk ? '#0d9488' : '#64748b'};">
            ${isMasuk ? this.formatRupiah(nom) : '-'}
          </td>
          <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px 8px; color: ${!isMasuk ? '#e11d48' : '#64748b'};">
            ${!isMasuk ? this.formatRupiah(nom) : '-'}
          </td>
          <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px 8px; font-weight: bold;">
            ${this.formatRupiah(currentBalance)}
          </td>
        </tr>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <title>Laporan Keuangan ${settings.rtName || 'RT'} - ${period}</title>
        <style>
          @page {
            size: A4;
            margin: 1.5cm;
          }
          body {
            font-family: Arial, sans-serif;
            color: #1e293b;
            line-height: 1.4;
            font-size: 11px;
            background: #ffffff;
            margin: 0;
            padding: 20px;
          }
          .kop-surat {
            text-align: center;
            border-bottom: 3px double #0f172a;
            padding-bottom: 12px;
            margin-bottom: 18px;
          }
          .kop-surat h2 {
            margin: 0 0 4px 0;
            font-size: 18px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .kop-surat h3 {
            margin: 0 0 4px 0;
            font-size: 14px;
            font-weight: 700;
          }
          .kop-surat p {
            margin: 0;
            font-size: 10px;
            color: #475569;
          }
          .report-title-box {
            text-align: center;
            margin-bottom: 20px;
          }
          .report-title-box h1 {
            font-size: 15px;
            font-weight: bold;
            margin: 0 0 4px 0;
            text-decoration: underline;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 20px;
          }
          .summary-card {
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 10px;
            background: #f8fafc;
          }
          .summary-card .label {
            font-size: 10px;
            color: #64748b;
            font-weight: bold;
            text-transform: uppercase;
          }
          .summary-card .val {
            font-size: 14px;
            font-weight: 800;
            margin-top: 4px;
          }
          .val-teal { color: #0f766e; }
          .val-red { color: #b91c1c; }
          .val-blue { color: #0284c7; }
          .val-orange { color: #d97706; }

          table.data-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 24px;
            font-size: 10.5px;
          }
          table.data-table th {
            background-color: #f1f5f9;
            border: 1px solid #94a3b8;
            padding: 8px;
            text-align: center;
            font-weight: bold;
          }
          .signature-section {
            display: flex;
            justify-content: space-between;
            margin-top: 36px;
            page-break-inside: avoid;
          }
          .signature-box {
            text-align: center;
            width: 220px;
          }
          .signature-space {
            height: 65px;
          }
          .sign-name {
            font-weight: bold;
            text-decoration: underline;
          }
          .btn-print-floating {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #0f766e;
            color: white;
            border: none;
            padding: 10px 18px;
            font-size: 13px;
            font-weight: bold;
            border-radius: 8px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          }
          @media print {
            .btn-print-floating { display: none !important; }
            body { padding: 0 !important; }
          }
        </style>
      </head>
      <body>
        <button class="btn-print-floating" onclick="window.print()">🖨️ Cetak / Simpan PDF</button>

        <div class="kop-surat">
          <h2>${(settings.rtName || 'RUKUN TETANGGA').toUpperCase()}</h2>
          <h3>${(settings.perumahan || '').toUpperCase()}</h3>
          <p>Kelurahan ${settings.kelurahan || '-'}, Kecamatan ${settings.kecamatan || '-'}, ${settings.kota || '-'}</p>
          <p>Rekening Kas RT: ${settings.nomorRekeningRT || '-'}</p>
        </div>

        <div class="report-title-box">
          <h1>LAPORAN PERTANGGUNGJAWABAN (LPJ) KAS RT</h1>
          <div>Periode: <strong>${period}</strong></div>
        </div>

        <div class="summary-grid">
          <div class="summary-card">
            <div class="label">Total Kas Masuk</div>
            <div class="val val-teal">${this.formatRupiah(totalMasuk)}</div>
          </div>
          <div class="summary-card">
            <div class="label">Total Pengeluaran</div>
            <div class="val val-red">${this.formatRupiah(totalKeluar)}</div>
          </div>
          <div class="summary-card">
            <div class="label">Sisa Saldo Kas RT</div>
            <div class="val val-blue">${this.formatRupiah(saldoAkhir)}</div>
          </div>
          <div class="summary-card">
            <div class="label">Talangan Berjalan</div>
            <div class="val val-orange">${this.formatRupiah(totalTalanganBelumLunas)}</div>
          </div>
        </div>

        <h3 style="font-size: 12px; margin-bottom: 8px;">I. BUKU KAS MUTASI KEUANGAN</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 25px;">No</th>
              <th style="width: 75px;">Tanggal</th>
              <th>Keterangan / Transaksi</th>
              <th style="width: 140px;">Kategori</th>
              <th style="width: 95px;">Masuk (Rp)</th>
              <th style="width: 95px;">Keluar (Rp)</th>
              <th style="width: 100px;">Saldo (Rp)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr style="background: #f8fafc; font-weight: bold;">
              <td colspan="4" style="text-align: right; padding: 8px; border: 1px solid #cbd5e1;">TOTAL AKHIR</td>
              <td style="text-align: right; padding: 8px; border: 1px solid #cbd5e1; color: #0d9488;">${this.formatRupiah(totalMasuk)}</td>
              <td style="text-align: right; padding: 8px; border: 1px solid #cbd5e1; color: #e11d48;">${this.formatRupiah(totalKeluar)}</td>
              <td style="text-align: right; padding: 8px; border: 1px solid #cbd5e1; color: #0284c7;">${this.formatRupiah(saldoAkhir)}</td>
            </tr>
          </tfoot>
        </table>

        <div class="signature-section">
          <div class="signature-box">
            <div>Mengetahui,</div>
            <div>Ketua ${settings.rtName || 'RT'}</div>
            <div class="signature-space"></div>
            <div class="sign-name">${settings.ketuaRt}</div>
            <div style="font-size: 10px; color: #64748b;">Pengurus Lingkungan</div>
          </div>

          <div class="signature-box">
            <div>${settings.kota || 'Depok'}, ${formattedDateNow}</div>
            <div>Bendahara ${settings.rtName || 'RT'}</div>
            <div class="signature-space"></div>
            <div class="sign-name">${settings.bendahara}</div>
            <div style="font-size: 10px; color: #64748b;">Pengelola Keuangan Lingkungan</div>
          </div>
        </div>
      </body>
      </html>
    `;
  },

  // Open formatted print / PDF window
  openReportPreview(period = null) {
    const curYear = (window.AppState && AppState.selectedYear) || new Date().getFullYear();
    const curMonth = (window.AppState && AppState.selectedMonth) || (new Date().getMonth() + 1);
    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const activePeriod = period || `${monthNames[curMonth - 1]} ${curYear}`;
    const html = this.generateReportHTML(activePeriod);
    const win = window.open('', '_blank');
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
    } else {
      alert("Popup terblokir oleh browser. Harap izinkan pop-up untuk mencetak laporan.");
    }
  },

  // Kwitansi / Tanda Terima Pembayaran Digital
  generateKwitansiHTML(tx) {
    const data = DB.load();
    const settings = data.settings;
    const now = new Date();

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Kwitansi - ${tx.kwitansi || 'KW-RT'}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 30px; background: #f8fafc; }
          .kwitansi-box {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border: 2px solid #0f766e;
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 4px 14px rgba(0,0,0,0.08);
          }
          .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px; }
          .title { font-size: 18px; font-weight: bold; color: #0f766e; }
          .row { display: flex; margin-bottom: 10px; font-size: 13px; }
          .label { width: 140px; color: #64748b; font-weight: bold; }
          .value { flex: 1; font-weight: 600; color: #1e293b; }
          .nominal-box {
            background: #e6f7f4;
            padding: 12px 18px;
            border-radius: 8px;
            font-size: 18px;
            font-weight: 800;
            color: #0f766e;
            margin: 16px 0;
            display: inline-block;
          }
          .footer { display: flex; justify-content: space-between; margin-top: 30px; }
          .sign { text-align: center; width: 180px; }
          .sign-space { height: 50px; }
          .btn-print {
            background: #0f766e;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
            margin-bottom: 16px;
          }
          @media print { .btn-print { display: none; } body { padding: 0; background: white; } .kwitansi-box { border: 1px solid black; box-shadow: none; } }
        </style>
      </head>
      <body>
        <div style="text-align: center;">
          <button class="btn-print" onclick="window.print()">🖨️ Cetak Kwitansi</button>
        </div>
        <div class="kwitansi-box">
          <div class="header">
            <div class="title">BUKTI TANDA TERIMA / KWITANSI RESMI</div>
            <div style="font-size: 11px; color: #64748b;">${settings.rtName} ${settings.perumahan}</div>
            <div style="font-size: 11px; color: #64748b;">No. Kwitansi: <strong>${tx.kwitansi || 'KW-AUTO'}</strong></div>
          </div>
          <div class="row"><div class="label">Telah Terima Dari</div><div class="value">: ${tx.judul} (${tx.blok || '-'})</div></div>
          <div class="row"><div class="label">Tanggal</div><div class="value">: ${tx.tanggal} ${tx.waktu || ''}</div></div>
          <div class="row"><div class="label">Kategori</div><div class="value">: ${tx.kategori}</div></div>
          <div class="row"><div class="label">Keterangan</div><div class="value">: ${tx.keterangan || '-'}</div></div>
          <div class="row"><div class="label">Metode Bayar</div><div class="value">: ${tx.metode}</div></div>
          
          <div class="nominal-box">
            Jumlah: ${ReportGenerator.formatRupiah(tx.nominal)}
          </div>
          
          <div class="footer">
            <div class="sign">
              <div>Warga / Penyetor</div>
              <div class="sign-space"></div>
              <div>( ........................ )</div>
            </div>
            <div class="sign">
              <div>${settings.kota || 'Depok'}, ${tx.tanggal}</div>
              <div>Bendahara ${settings.rtName || 'RT'}</div>
              <div class="sign-space"></div>
              <div><strong>${settings.bendahara}</strong></div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  },

  openKwitansi(tx) {
    const html = this.generateKwitansiHTML(tx);
    const win = window.open('', '_blank');
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
    }
  }
};

window.ReportGenerator = ReportGenerator;
