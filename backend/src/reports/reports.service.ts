import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PdfPrinter = require('pdfmake');
import { AttendanceEvent } from '../attendance-events/attendance-event.entity';
import { Worker } from '../workers/worker.entity';
import { APP_TZ } from '../common/date-utils';
import { ReportType } from '../report-config/report-config.entity';

function fmtMs(ms: number): string {
  if (!ms || ms <= 0) return '—';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return m > 0 ? `${h} sag ${m} min` : `${h} sag`;
}

function fmtTime(ms: number | null): string {
  if (!ms) return '—';
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const REPORT_LABELS: Record<ReportType, string> = {
  daily_all: 'Ähli işçiler',
  daily_staff: 'Staff Personal',
  daily_shift_day: 'Gündiz Shift',
  daily_shift_night: 'Gije Shift',
  daily_attended: 'Diňe gelenler',
  daily_absent: 'Diňe gelmedikler',
};

type Row = {
  name: string;
  workerId: string;
  profession: string;
  brigade: string;
  shift: string;
  isStaff: boolean;
  checkIn: number | null;
  checkOut: number | null;
  totalMs: number;
};

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(AttendanceEvent)
    private readonly eventRepo: Repository<AttendanceEvent>,
    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,
  ) {}

  private async buildRows(date: string, reportType: ReportType = 'daily_all'): Promise<Row[]> {
    const events: { employeeNumber: string; eventType: string; eventTime: string }[] =
      await this.eventRepo.query(
        `SELECT "employeeNumber", "eventType", "eventTime"
         FROM attendance_events
         WHERE DATE(to_timestamp("eventTime" / 1000.0) AT TIME ZONE '${APP_TZ}') = $1
         ORDER BY "employeeNumber", "eventTime" ASC`,
        [date],
      );

    const empNums = [...new Set(events.map(e => e.employeeNumber).filter(Boolean))];
    const attendedWorkers = empNums.length > 0
      ? await this.workerRepo.find({ where: { workerId: In(empNums) } })
      : [];
    const workerMap = new Map(attendedWorkers.map(w => [w.workerId, w]));

    const rows: Row[] = [];
    // Track present workers by entity ID to avoid workerId format mismatches
    const presentEntityIds = new Set<string>();
    const byWorker = new Map<string, { eventType: string; eventTime: number }[]>();

    for (const ev of events) {
      const arr = byWorker.get(ev.employeeNumber) ?? [];
      arr.push({ eventType: ev.eventType, eventTime: Number(ev.eventTime) });
      byWorker.set(ev.employeeNumber, arr);
    }

    for (const [empNum, evList] of byWorker) {
      const w = workerMap.get(empNum);
      if (w) presentEntityIds.add(w.id);

      let firstIn: number | null = null;
      let lastOut: number | null = null;
      let totalMs = 0;
      let clockIn: number | null = null;

      for (const ev of evList) {
        if (ev.eventType === 'CHECK_IN') {
          if (firstIn === null) firstIn = ev.eventTime;
          if (clockIn === null) clockIn = ev.eventTime;
        } else {
          if (clockIn !== null) { totalMs += ev.eventTime - clockIn; clockIn = null; }
          lastOut = ev.eventTime;
        }
      }
      rows.push({
        name: w?.name ?? empNum,
        workerId: empNum,
        profession: w?.profession ?? '—',
        brigade: w?.brigadeName ?? '—',
        shift: w?.shift ?? '—',
        isStaff: w?.isStaff ?? false,
        checkIn: firstIn,
        checkOut: lastOut,
        totalMs,
      });
    }
    rows.sort((a, b) => a.name.localeCompare(b.name));

    // Add absent workers — check by entity ID to fix format-mismatch false absences
    const allActive = await this.workerRepo.find({ where: { status: 'Active' as any } });
    for (const w of allActive) {
      if (!presentEntityIds.has(w.id)) {
        rows.push({
          name: w.name,
          workerId: w.workerId,
          profession: w.profession,
          brigade: w.brigadeName ?? '—',
          shift: w.shift ?? '—',
          isStaff: w.isStaff ?? false,
          checkIn: null,
          checkOut: null,
          totalMs: 0,
        });
      }
    }

    // Apply report type filter
    if (reportType === 'daily_staff')       return rows.filter(r => r.isStaff);
    if (reportType === 'daily_shift_day')   return rows.filter(r => r.shift === 'day');
    if (reportType === 'daily_shift_night') return rows.filter(r => r.shift === 'night');
    if (reportType === 'daily_attended')    return rows.filter(r => r.checkIn !== null);
    if (reportType === 'daily_absent')      return rows.filter(r => r.checkIn === null);
    return rows;
  }

  /** Main entry point used by the scheduler */
  async generateReport(
    date: string,
    reportType: ReportType = 'daily_all',
    isManual = false,
  ): Promise<{ xlsx: Buffer; html: string }> {
    const rows = await this.buildRows(date, reportType);
    const xlsx = await this.buildXlsx(date, reportType, rows);
    const html = this.buildEmailHtml(date, reportType, rows, isManual);
    return { xlsx, html };
  }

  private async buildXlsx(date: string, reportType: ReportType, rows: Row[]): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ExcelJS = require('exceljs');
    const attended = rows.filter(r => r.checkIn !== null);
    const absent   = rows.filter(r => r.checkIn === null);
    const pct = rows.length > 0 ? Math.round((attended.length / rows.length) * 100) : 0;

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Hasabat');
    const COLS = 9;

    ws.columns = [
      { width: 5  },  // #
      { width: 30 },  // İşçi adı
      { width: 12 },  // Sicil No
      { width: 20 },  // Görev
      { width: 18 },  // Ekip
      { width: 9  },  // Shift
      { width: 10 },  // Giriş
      { width: 10 },  // Çykyş
      { width: 14 },  // Jemi sag
    ];

    // ── Title row ──────────────────────────────────────────────────────────────
    const titleRow = ws.addRow(['Esta WorkForce — Günlük Hasabat']);
    ws.mergeCells(titleRow.number, 1, titleRow.number, COLS);
    const titleCell = titleRow.getCell(1);
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleRow.height = 30;

    // ── Stats row ──────────────────────────────────────────────────────────────
    const statsRow = ws.addRow([
      `Sene: ${date}   |   Hasabat: ${REPORT_LABELS[reportType]}   |   Jemi: ${rows.length}   |   Geldi: ${attended.length}   |   Gelmedi: ${absent.length}   |   Göterimi: ${pct}%`,
    ]);
    ws.mergeCells(statsRow.number, 1, statsRow.number, COLS);
    const statsCell = statsRow.getCell(1);
    statsCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    statsCell.font = { size: 10, color: { argb: 'FF475569' } };
    statsCell.alignment = { horizontal: 'center', vertical: 'middle' };
    statsRow.height = 20;

    ws.addRow([]); // spacer

    const addSectionHeader = (label: string, argb: string) => {
      const r = ws.addRow([label]);
      ws.mergeCells(r.number, 1, r.number, COLS);
      const c = r.getCell(1);
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
      c.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
      c.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
      r.height = 22;
    };

    const COL_HEADERS = ['#', 'İşçi adı', 'Sicil No', 'Görev', 'Ekip', 'Shift', 'Giriş', 'Çykyş', 'Jemi sag'];
    const addColHeaders = () => {
      const r = ws.addRow(COL_HEADERS);
      r.eachCell((cell: any) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
        cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { bottom: { style: 'thin', color: { argb: 'FF94A3B8' } } };
      });
      r.height = 18;
    };

    const addDataRows = (list: Row[], startIdx: number, isPresent: boolean) => {
      list.forEach((row, i) => {
        const r = ws.addRow([
          startIdx + i + 1,
          row.name,
          row.workerId,
          row.profession,
          row.brigade,
          row.shift === 'day' ? 'Gündiz' : row.shift === 'night' ? 'Gije' : '—',
          fmtTime(row.checkIn),
          fmtTime(row.checkOut),
          fmtMs(row.totalMs),
        ]);
        const bg = i % 2 === 0 ? 'FFFAFAFA' : 'FFFFFFFF';
        r.eachCell((cell: any) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
          cell.font = { size: 9 };
          cell.alignment = { vertical: 'middle' };
          cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
        });
        if (isPresent && row.checkIn) {
          r.getCell(7).font = { size: 9, bold: true, color: { argb: 'FF16A34A' } };
        }
        r.height = 16;
      });
    };

    if (reportType !== 'daily_absent') {
      addSectionHeader(`GELENLER  (${attended.length} adam)`, 'FF16A34A');
      addColHeaders();
      addDataRows(attended, 0, true);
    }

    if (reportType !== 'daily_attended') {
      ws.addRow([]);
      addSectionHeader(`GELMEDIKLER  (${absent.length} adam)`, 'FFDC2626');
      addColHeaders();
      addDataRows(absent, attended.length, false);
    }

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf as ArrayBuffer);
  }

  private buildEmailHtml(date: string, reportType: ReportType, rows: Row[], isManual: boolean): string {
    const attended = rows.filter(r => r.checkIn !== null);
    const absent   = rows.filter(r => r.checkIn === null);
    const pct = rows.length > 0 ? Math.round((attended.length / rows.length) * 100) : 0;

    const tableRows = rows.slice(0, 30).map((r, i) => `
      <tr style="background:${i % 2 === 0 ? '#f8fafc' : '#ffffff'}">
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px">${i + 1}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px">${r.name}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px">${r.workerId}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px">${r.profession}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;font-weight:600;color:${r.checkIn ? '#16a34a' : '#dc2626'}">${r.checkIn ? fmtTime(r.checkIn) : '—'}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;font-weight:600;color:${r.checkIn ? '#16a34a' : '#dc2626'}">${r.checkIn ? 'Geldi' : 'Gelmedi'}</td>
      </tr>`).join('');

    return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:680px;margin:24px auto">
  <div style="background:#1e3a5f;padding:22px 28px;border-radius:10px 10px 0 0">
    <div style="color:#ffffff;font-size:22px;font-weight:700">Esta WorkForce</div>
    <div style="color:#93c5fd;font-size:13px;margin-top:4px">Günlük Hasabat — ${REPORT_LABELS[reportType]}</div>
  </div>
  <div style="background:#ffffff;padding:24px 28px">
    <p style="color:#64748b;font-size:13px;margin-top:0">Sene: <strong style="color:#1e293b">${date}</strong></p>
    <div style="display:flex;gap:12px;margin-bottom:22px">
      <div style="flex:1;background:#eff6ff;border-radius:8px;padding:16px;text-align:center">
        <div style="font-size:30px;font-weight:700;color:#1d4ed8">${rows.length}</div>
        <div style="font-size:11px;color:#64748b;margin-top:3px">Jemi işçi</div>
      </div>
      <div style="flex:1;background:#f0fdf4;border-radius:8px;padding:16px;text-align:center">
        <div style="font-size:30px;font-weight:700;color:#16a34a">${attended.length}</div>
        <div style="font-size:11px;color:#64748b;margin-top:3px">Geldi</div>
      </div>
      <div style="flex:1;background:#fef2f2;border-radius:8px;padding:16px;text-align:center">
        <div style="font-size:30px;font-weight:700;color:#dc2626">${absent.length}</div>
        <div style="font-size:11px;color:#64748b;margin-top:3px">Gelmedi</div>
      </div>
      <div style="flex:1;background:#fefce8;border-radius:8px;padding:16px;text-align:center">
        <div style="font-size:30px;font-weight:700;color:#ca8a04">${pct}%</div>
        <div style="font-size:11px;color:#64748b;margin-top:3px">Göterimi</div>
      </div>
    </div>
    <div style="font-weight:600;font-size:13px;color:#1e3a5f;margin-bottom:10px">
      Işçileriň sanawy${rows.length > 30 ? ` (ilkinji 30 görkezilýär, jemi ${rows.length})` : ''}:
    </div>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:#334155;color:#ffffff">
          <th style="padding:8px;text-align:left;font-size:11px">#</th>
          <th style="padding:8px;text-align:left;font-size:11px">İşçi adı</th>
          <th style="padding:8px;text-align:left;font-size:11px">Sicil No</th>
          <th style="padding:8px;text-align:left;font-size:11px">Görev</th>
          <th style="padding:8px;text-align:left;font-size:11px">Giriş</th>
          <th style="padding:8px;text-align:left;font-size:11px">Status</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
    <p style="font-size:11px;color:#94a3b8;margin-top:20px;padding-top:14px;border-top:1px solid #e2e8f0">
      Bu habar ${isManual ? 'el bilen iberildi' : 'awtomatik iberildi'} — Esta WorkForce Ulgamy
    </p>
  </div>
</div>
</body>
</html>`;
  }

  async generateDailyPdf(date: string): Promise<Buffer> {
    const rows = await this.buildRows(date, 'daily_all');

    const fonts = {
      Roboto: {
        normal: 'node_modules/pdfmake/build/vfs_fonts.js',
        bold: 'node_modules/pdfmake/build/vfs_fonts.js',
        italics: 'node_modules/pdfmake/build/vfs_fonts.js',
        bolditalics: 'node_modules/pdfmake/build/vfs_fonts.js',
      },
    };

    const printer = new PdfPrinter(fonts);

    const tableBody = [
      [
        { text: '#', bold: true, fillColor: '#1e3a5f', color: 'white' },
        { text: 'İşçi adı', bold: true, fillColor: '#1e3a5f', color: 'white' },
        { text: 'Sicil No', bold: true, fillColor: '#1e3a5f', color: 'white' },
        { text: 'Görev', bold: true, fillColor: '#1e3a5f', color: 'white' },
        { text: 'Ekip', bold: true, fillColor: '#1e3a5f', color: 'white' },
        { text: 'Giriş', bold: true, fillColor: '#1e3a5f', color: 'white' },
        { text: 'Çykyş', bold: true, fillColor: '#1e3a5f', color: 'white' },
        { text: 'Jemi sag', bold: true, fillColor: '#1e3a5f', color: 'white' },
      ],
      ...rows.map((r, i) => [
        { text: String(i + 1), fontSize: 8 },
        { text: r.name, fontSize: 8 },
        { text: r.workerId, fontSize: 8 },
        { text: r.profession, fontSize: 8 },
        { text: r.brigade, fontSize: 8 },
        { text: fmtTime(r.checkIn), fontSize: 8, color: r.checkIn ? '#16a34a' : '#ef4444' },
        { text: fmtTime(r.checkOut), fontSize: 8 },
        { text: fmtMs(r.totalMs), fontSize: 8 },
      ]),
    ];

    const docDefinition: any = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [20, 40, 20, 30],
      content: [
        { text: 'Esta WorkForce — Günlük Hasabat', style: 'header' },
        { text: `Sene: ${date}   |   Jemi işçi: ${rows.length}   |   Gelen: ${rows.filter(r => r.checkIn).length}`, style: 'subheader' },
        {
          table: {
            headerRows: 1,
            widths: [18, '*', 50, 80, 70, 38, 38, 45],
            body: tableBody,
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#cbd5e1',
            vLineColor: () => '#cbd5e1',
            fillColor: (rowIndex: number) => rowIndex > 0 && rowIndex % 2 === 0 ? '#f8fafc' : null,
          },
        },
      ],
      styles: {
        header: { fontSize: 16, bold: true, color: '#1e3a5f', marginBottom: 4 },
        subheader: { fontSize: 10, color: '#475569', marginBottom: 10 },
      },
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      pdfDoc.on('data', (c: Buffer) => chunks.push(c));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', reject);
      pdfDoc.end();
    });
  }
}
