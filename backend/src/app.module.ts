import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
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
import { Tenant } from './tenants/tenant.entity';
import { AdjustmentReason } from './adjustment-reasons/adjustment-reason.entity';
import { WorkAdjustment } from './work-adjustments/work-adjustment.entity';
import { WorkAdjustmentLog } from './work-adjustments/work-adjustment-log.entity';
import { WorkersModule } from './workers/workers.module';
import { AttendanceEventsModule } from './attendance-events/attendance-events.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { ForemanModule } from './foremans/foremans.module';
import { BrigadirsModule } from './brigadirs/brigadirs.module';
import { MobileAuthModule } from './mobile-auth/mobile-auth.module';
import { ExtraHoursModule } from './extra-hours/extra-hours.module';
import { MobileForemanModule } from './mobile-foreman/mobile-foreman.module';
import { ShiftSettingsModule } from './shift-settings/shift-settings.module';
import { AbsenceNotesModule } from './absence-notes/absence-notes.module';
import { AttendanceOverridesModule } from './attendance-overrides/attendance-overrides.module';
import { AdminAuthModule } from './admin-auth/admin-auth.module';
import { ReportsModule } from './reports/reports.module';
import { ReportConfigModule } from './report-config/report-config.module';
import { ReportSchedulerModule } from './report-scheduler/report-scheduler.module';
import { WorkerLifecycleModule } from './worker-lifecycle/worker-lifecycle.module';
import { TenantsModule } from './tenants/tenants.module';
import { SuperAdminAuthModule } from './super-admin-auth/super-admin-auth.module';
import { DeviceModule } from './device/device.module';
import { ScannerDevicesModule } from './scanner-devices/scanner-devices.module';
import { ScannerDevice } from './scanner-devices/scanner-device.entity';
import { CardReport } from './card-reports/card-report.entity';
import { CardReportsModule } from './card-reports/card-reports.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AttendanceAnomaliesModule } from './attendance-anomalies/attendance-anomalies.module';
import { MobileWorkerModule } from './mobile-worker/mobile-worker.module';
import { AdjustmentReasonsModule } from './adjustment-reasons/adjustment-reasons.module';
import { WorkAdjustmentsModule } from './work-adjustments/work-adjustments.module';
import { WorkTimeModule } from './work-time/work-time.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        host: cfg.get('DB_HOST', 'localhost'),
        port: cfg.get<number>('DB_PORT', 5432),
        username: cfg.get('DB_USERNAME', 'postgres'),
        password: cfg.get('DB_PASSWORD', 'postgres'),
        database: cfg.get('DB_NAME', 'workhour'),
        entities: [
          Worker, AttendanceEvent, AuditLog, Foreman, Brigadir,
          MobileCredential, ExtraHoursRequest, ExtraHoursRequestItem,
          ShiftSetting, AbsenceNote, AttendanceOverride, ReportConfig,
          WorkerLifecycleEvent, WorkerLifecycleReport, Tenant, ScannerDevice, CardReport,
          AdjustmentReason, WorkAdjustment, WorkAdjustmentLog,
        ],
        synchronize: cfg.get('NODE_ENV', 'development') !== 'production',
      }),
    }),
    TenantsModule,
    SuperAdminAuthModule,
    DeviceModule,
    ScannerDevicesModule,
    WorkersModule,
    AttendanceEventsModule,
    AuditLogModule,
    ForemanModule,
    BrigadirsModule,
    MobileAuthModule,
    ExtraHoursModule,
    MobileForemanModule,
    ShiftSettingsModule,
    AbsenceNotesModule,
    AttendanceOverridesModule,
    AdminAuthModule,
    ReportsModule,
    ReportConfigModule,
    ReportSchedulerModule,
    WorkerLifecycleModule,
    CardReportsModule,
    AnalyticsModule,
    AttendanceAnomaliesModule,
    MobileWorkerModule,
    AdjustmentReasonsModule,
    WorkAdjustmentsModule,
    WorkTimeModule,
  ],
})
export class AppModule {}
