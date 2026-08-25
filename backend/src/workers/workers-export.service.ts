import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { APP_TZ } from '../common/date-utils';
import { WorkersQueryService, FindAllParams } from './workers-query.service';

type ExportLang = 'en' | 'ru' | 'tr';
function getExportL(lang: ExportLang = 'tr') {
  const L = {
    en: {
      colTabNo: 'Tab No', colName: 'Worker Name', colProfession: 'Profession',
      colCheckIn: 'Check-in', colCheckOut: 'Check-out', colTotalHours: 'Total Hours',
      colActualHours: 'Actual Hours', colWorkDone: 'Work Done', colTeam: 'Team',
      colOvertimeSystem: 'Overtime System', hourUnit: 'h', minUnit: 'min',
      mesaiHourly: 'Hourly', mesaiMonthly: 'Monthly',
    },
    ru: {
      colTabNo: 'Таб. №', colName: 'Имя работника', colProfession: 'Должность',
      colCheckIn: 'Приход', colCheckOut: 'Уход', colTotalHours: 'Всего часов',
      colActualHours: 'Факт. часов', colWorkDone: 'Выполненная работа', colTeam: 'Бригада',
      colOvertimeSystem: 'Система переработки', hourUnit: 'ч', minUnit: 'мин',
      mesaiHourly: 'Почасово', mesaiMonthly: 'Ежемесячно',
    },
    tr: {
      colTabNo: 'Sicil No', colName: 'İşçi Adı', colProfession: 'Meslek',
      colCheckIn: 'Giriş Saati', colCheckOut: 'Çıkış Saati', colTotalHours: 'Toplam Saat',
      colActualHours: 'Fiili Saat', colWorkDone: 'Yapılan İş', colTeam: 'Ekip',
      colOvertimeSystem: 'Mesai Sistemi', hourUnit: 'sa', minUnit: 'dk',
      mesaiHourly: 'Saatlik', mesaiMonthly: 'Aylık',
    },
  };
  return L[lang] ?? L.tr;
}

/**
 * Turns the same worker listing used by GET /workers into a downloadable
 * .xlsx roster (today's check-in/out + hours worked).
 */
@Injectable()
export class WorkersExportService {
  constructor(private readonly queryService: WorkersQueryService) {}

  async exportToExcel(params?: FindAllParams & { lang?: ExportLang }): Promise<Buffer> {
    const workers = await this.queryService.findAll(params ?? {}) as any[];
    const L = getExportL(params?.lang ?? 'tr');

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
      if (h === 0) return `${m} ${L.minUnit}`;
      if (m === 0) return `${h} ${L.hourUnit}`;
      return `${h} ${L.hourUnit} ${m} ${L.minUnit}`;
    };

    const rows = workers.map(w => ({
      [L.colTabNo]: w.workerId,
      [L.colName]: w.name,
      [L.colProfession]: w.profession || '',
      [L.colCheckIn]: fmtTime(w.lastCheckIn ?? null),
      [L.colCheckOut]: fmtTime(w.lastCheckOut ?? null),
      [L.colTotalHours]: w.mesaiSistemi === 'Aylık' ? `8 ${L.hourUnit}` : fmtDuration(w.todayHoursMs ?? null),
      [L.colActualHours]: fmtDuration(w.todayHoursMs ?? null),
      [L.colWorkDone]: '',
      [L.colTeam]: w.brigadeName || '',
      [L.colOvertimeSystem]: w.mesaiSistemi === 'Aylık' ? L.mesaiMonthly : L.mesaiHourly,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Workers');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }
}
