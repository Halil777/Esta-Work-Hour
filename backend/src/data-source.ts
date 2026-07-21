// TypeORM CLI data source — used for migration:generate and migration:run
// Run: npx typeorm-ts-node-commonjs migration:generate src/migrations/MigrationName -d src/data-source.ts
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

import { Worker } from './workers/worker.entity';
import { AttendanceEvent } from './attendance-events/attendance-event.entity';
import { AuditLog } from './audit-log/audit-log.entity';
import { Foreman } from './foremans/foreman.entity';
import { Brigadir } from './brigadirs/brigadir.entity';
import { MobileCredential } from './mobile-auth/mobile-credential.entity';
import { ExtraHoursRequest } from './extra-hours/extra-hours-request.entity';
import { ExtraHoursRequestItem } from './extra-hours/extra-hours-request-item.entity';
import { ShiftSetting } from './shift-settings/shift-setting.entity';
import { AbsenceNote } from './absence-notes/absence-note.entity';
import { AttendanceOverride } from './attendance-overrides/attendance-override.entity';
import { ReportConfig } from './report-config/report-config.entity';
import { WorkerLifecycleEvent } from './worker-lifecycle/worker-lifecycle-event.entity';
import { WorkerLifecycleReport } from './worker-lifecycle/worker-lifecycle-report.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'workhour',
  entities: [
    Worker, AttendanceEvent, AuditLog, Foreman, Brigadir,
    MobileCredential, ExtraHoursRequest, ExtraHoursRequestItem,
    ShiftSetting, AbsenceNote, AttendanceOverride, ReportConfig,
    WorkerLifecycleEvent, WorkerLifecycleReport,
  ],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
});
