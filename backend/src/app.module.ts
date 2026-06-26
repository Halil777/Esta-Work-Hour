import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        host: cfg.get('DB_HOST', 'localhost'),
        port: cfg.get<number>('DB_PORT', 5432),
        username: cfg.get('DB_USERNAME', 'postgres'),
        password: cfg.get('DB_PASSWORD', 'postgres'),
        database: cfg.get('DB_NAME', 'workhour'),
        entities: [Worker, AttendanceEvent, AuditLog, Foreman, Brigadir, MobileCredential, ExtraHoursRequest, ExtraHoursRequestItem, ShiftSetting, AbsenceNote, AttendanceOverride],
        synchronize: true,
      }),
    }),
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
  ],
})
export class AppModule {}
