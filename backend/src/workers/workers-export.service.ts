import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { APP_TZ } from '../common/date-utils';
import { WorkersQueryService, FindAllParams } from './workers-query.service';

/**
 * Turns the same worker listing used by GET /workers into a downloadable
 * .xlsx roster (today's check-in/out + hours worked).
 */
@Injectable()
export class WorkersExportService {
  constructor(private readonly queryService: WorkersQueryService) {}

  async exportToExcel(params?: FindAllParams): Promise<Buffer> {
    const workers = await this.queryService.findAll(params ?? {}) as any[];

    const fmtTime = (ts: number | null) => {
      if (!ts) return '';
      return new Date(ts).toLocaleString('tr-TR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
        timeZone: APP_TZ,
      });
    };

    const fmtDuration = (ms: number | null): string => {
      if (!ms || ms <= 0) return '';
      const totalMin = Math.round(ms / 60000);
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      if (h === 0) return `${m} min`;
      if (m === 0) return `${h} sag`;
      return `${h} sag ${m} min`;
    };

    const rows = workers.map(w => ({
      'Sicil No': w.workerId,
      'İnsan Adı': w.name,
      'Görev': w.profession || '',
      'GIRIS SAATI': fmtTime(w.lastCheckIn ?? null),
      'CIKIS SAATI': fmtTime(w.lastCheckOut ?? null),
      'TOPLAM SAATI': w.mesaiSistemi === 'Aylık' ? '8 sag' : fmtDuration(w.todayHoursMs ?? null),
      'HAKYKY SAAT': fmtDuration(w.todayHoursMs ?? null),
      'YAPILAN IS': '',
      'EKIP': w.brigadeName || '',
      'Mesai Sistemi': w.mesaiSistemi || 'Saatlik',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Workers');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }
}
