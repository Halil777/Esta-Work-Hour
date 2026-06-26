import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PdfPrinter = require('pdfmake');
import { AttendanceEvent } from '../attendance-events/attendance-event.entity';
import { Worker } from '../workers/worker.entity';
import { APP_TZ } from '../common/date-utils';

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

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(AttendanceEvent)
    private readonly eventRepo: Repository<AttendanceEvent>,
    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,
  ) {}

  async generateDailyPdf(date: string): Promise<Buffer> {
    const events: { employeeNumber: string; eventType: string; eventTime: string }[] =
      await this.eventRepo.query(
        `SELECT "employeeNumber", "eventType", "eventTime"
         FROM attendance_events
         WHERE DATE(to_timestamp("eventTime" / 1000.0) AT TIME ZONE '${APP_TZ}') = $1
         ORDER BY "employeeNumber", "eventTime" ASC`,
        [date],
      );

    const empNums = [...new Set(events.map(e => e.employeeNumber).filter(Boolean))];
    const workers = empNums.length > 0
      ? await this.workerRepo.find({ where: { workerId: In(empNums) } })
      : [];
    const workerMap = new Map(workers.map(w => [w.workerId, w]));

    // Compute sessions per worker
    type Row = { name: string; workerId: string; profession: string; brigade: string; checkIn: number | null; checkOut: number | null; totalMs: number };
    const rows: Row[] = [];

    const byWorker = new Map<string, { eventType: string; eventTime: number }[]>();
    for (const ev of events) {
      const arr = byWorker.get(ev.employeeNumber) ?? [];
      arr.push({ eventType: ev.eventType, eventTime: Number(ev.eventTime) });
      byWorker.set(ev.employeeNumber, arr);
    }

    for (const [empNum, evList] of byWorker) {
      const w = workerMap.get(empNum);
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
        checkIn: firstIn,
        checkOut: lastOut,
        totalMs,
      });
    }
    rows.sort((a, b) => a.name.localeCompare(b.name));

    // All active workers not in events = absent
    const allActive = await this.workerRepo.find({ where: { status: 'Active' as any } });
    const presentSet = new Set(byWorker.keys());
    for (const w of allActive) {
      if (w.workerId && !presentSet.has(w.workerId)) {
        rows.push({ name: w.name, workerId: w.workerId, profession: w.profession, brigade: w.brigadeName ?? '—', checkIn: null, checkOut: null, totalMs: 0 });
      }
    }

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
