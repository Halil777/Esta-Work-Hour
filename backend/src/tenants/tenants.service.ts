import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { Tenant } from './tenant.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { APP_TZ } from '../common/date-utils';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly repo: Repository<Tenant>,
  ) {}

  // ─── Super-admin stats ────────────────────────────────────────────────────────

  async getStats() {
    const tenants = await this.repo.find({ order: { createdAt: 'ASC' } });
    const em = this.repo.manager;

    // Worker counts per tenant
    const workerCounts: { tenantId: string; total: string; active: string }[] = await em.query(`
      SELECT "tenantId", COUNT(*) as total,
             COUNT(CASE WHEN status = 'Active' THEN 1 END) as active
      FROM workers
      WHERE "tenantId" IS NOT NULL
      GROUP BY "tenantId"
    `);

    // Today's unique check-ins per tenant (local date via configured timezone)
    const todayCheckins: { tenantId: string; checkedIn: string }[] = await em.query(`
      SELECT "tenantId", COUNT(DISTINCT "employeeNumber") as "checkedIn"
      FROM attendance_events
      WHERE "eventType" = 'CHECK_IN'
        AND DATE(to_timestamp("eventTime" / 1000.0) AT TIME ZONE '${APP_TZ}')
            = CURRENT_DATE AT TIME ZONE '${APP_TZ}'
        AND "tenantId" IS NOT NULL
      GROUP BY "tenantId"
    `);

    // Last scan event per tenant
    const lastActivity: { tenantId: string; lastAt: string }[] = await em.query(`
      SELECT "tenantId", MAX(to_timestamp("eventTime" / 1000.0)) as "lastAt"
      FROM attendance_events
      WHERE "tenantId" IS NOT NULL
      GROUP BY "tenantId"
    `);

    // 7-day attendance trend (all tenants combined)
    const trend: { date: string; scans: string; workers: string }[] = await em.query(`
      SELECT DATE(to_timestamp("eventTime" / 1000.0) AT TIME ZONE '${APP_TZ}') as date,
             COUNT(*) as scans,
             COUNT(DISTINCT "employeeNumber") as workers
      FROM attendance_events
      WHERE to_timestamp("eventTime" / 1000.0) >= NOW() - INTERVAL '7 days'
        AND "tenantId" IS NOT NULL
      GROUP BY date ORDER BY date ASC
    `);

    const wcMap = new Map(workerCounts.map(w => [w.tenantId, w]));
    const ciMap = new Map(todayCheckins.map(c => [c.tenantId, c]));
    const laMap = new Map(lastActivity.map(l => [l.tenantId, l]));

    const tenantStats = tenants.map(t => {
      const wc = wcMap.get(t.id);
      const ci = ciMap.get(t.id);
      const la = laMap.get(t.id);
      return {
        tenantId: t.id,
        tenantName: t.name,
        isActive: t.isActive,
        totalWorkers: wc ? parseInt(wc.total) : 0,
        activeWorkers: wc ? parseInt(wc.active) : 0,
        checkedInToday: ci ? parseInt(ci.checkedIn) : 0,
        lastActivityAt: la?.lastAt ?? null,
      };
    });

    return {
      totalTenants: tenants.length,
      activeTenants: tenants.filter(t => t.isActive).length,
      totalWorkers: tenantStats.reduce((s, t) => s + t.totalWorkers, 0),
      activeWorkers: tenantStats.reduce((s, t) => s + t.activeWorkers, 0),
      checkedInToday: tenantStats.reduce((s, t) => s + t.checkedInToday, 0),
      tenants: tenantStats,
      trend7d: trend.map(r => ({
        date: String(r.date).slice(0, 10),
        scans: parseInt(r.scans),
        workers: parseInt(r.workers),
      })),
    };
  }

  async getWorkforce() {
    const tenants = await this.repo.find({ order: { name: 'ASC' } });
    const tenantMap = new Map(tenants.map(t => [t.id, t.name]));
    const em = this.repo.manager;

    const rows: {
      workerId: string; name: string; profession: string;
      brigadeName: string; tenantId: string; status: string; shift: string | null;
    }[] = await em.query(`
      SELECT "workerId", name, profession, "brigadeName", "tenantId", status, shift
      FROM workers
      WHERE "tenantId" IS NOT NULL
      ORDER BY name ASC
      LIMIT 2000
    `);

    return rows.map(w => ({
      ...w,
      tenantName: tenantMap.get(w.tenantId) ?? '—',
    }));
  }

  async findAll() {
    const tenants = await this.repo.find({ order: { createdAt: 'ASC' } });
    // Never return password hashes
    return tenants.map(({ adminPasswordHash: _, ...t }) => t);
  }

  async findOne(id: string) {
    const tenant = await this.repo.findOneBy({ id });
    if (!tenant) throw new NotFoundException(`Tenant ${id} tapylmady`);
    const { adminPasswordHash: _, ...t } = tenant;
    return t;
  }

  async findByUsername(username: string): Promise<Tenant | null> {
    return this.repo.findOneBy({ adminUsername: username });
  }

  async create(dto: CreateTenantDto) {
    const existing = await this.repo.findOneBy({ adminUsername: dto.adminUsername });
    if (existing) throw new ConflictException('Bu username eýýäm ulanylýar');

    const adminPasswordHash = await bcrypt.hash(dto.adminPassword, 10);
    const tenant = this.repo.create({
      name: dto.name,
      adminUsername: dto.adminUsername,
      adminPasswordHash,
      logoUrl: dto.logoUrl ?? null,
      isActive: dto.isActive ?? true,
      deviceToken: randomUUID(),
    });
    const saved = await this.repo.save(tenant);
    const { adminPasswordHash: _, ...result } = saved;
    return result;
  }

  async update(id: string, dto: UpdateTenantDto) {
    const tenant = await this.repo.findOneBy({ id });
    if (!tenant) throw new NotFoundException(`Tenant ${id} tapylmady`);

    if (dto.adminUsername && dto.adminUsername !== tenant.adminUsername) {
      const conflict = await this.repo.findOneBy({ adminUsername: dto.adminUsername });
      if (conflict) throw new ConflictException('Bu username eýýäm ulanylýar');
      tenant.adminUsername = dto.adminUsername;
    }

    if (dto.name !== undefined) tenant.name = dto.name;
    if (dto.logoUrl !== undefined) tenant.logoUrl = dto.logoUrl || null;
    if (dto.isActive !== undefined) tenant.isActive = dto.isActive;
    if (dto.adminPassword) {
      tenant.adminPasswordHash = await bcrypt.hash(dto.adminPassword, 10);
    }

    const saved = await this.repo.save(tenant);
    const { adminPasswordHash: _, ...result } = saved;
    return result;
  }

  async remove(id: string) {
    const tenant = await this.repo.findOneBy({ id });
    if (!tenant) throw new NotFoundException(`Tenant ${id} tapylmady`);
    await this.repo.remove(tenant);
    return { success: true };
  }

  async regenerateDeviceToken(id: string): Promise<{ deviceToken: string }> {
    const tenant = await this.repo.findOneBy({ id });
    if (!tenant) throw new NotFoundException(`Tenant ${id} tapylmady`);
    const newToken = randomUUID();
    tenant.deviceToken = newToken;
    await this.repo.save(tenant);
    return { deviceToken: newToken };
  }

  async getDeviceToken(id: string): Promise<{ deviceToken: string | null }> {
    const tenant = await this.repo.findOneBy({ id });
    if (!tenant) throw new NotFoundException(`Tenant ${id} tapylmady`);
    return { deviceToken: tenant.deviceToken };
  }
}
