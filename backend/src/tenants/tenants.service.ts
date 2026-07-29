import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { Tenant } from './tenant.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly repo: Repository<Tenant>,
  ) {}

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

  async findByDeviceToken(token: string): Promise<Tenant | null> {
    return this.repo.findOneBy({ deviceToken: token, isActive: true });
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
