import { Injectable, UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { MobileCredential } from './mobile-credential.entity';
import { Worker } from '../workers/worker.entity';

@Injectable()
export class MobileAuthService {
  constructor(
    @InjectRepository(MobileCredential)
    private readonly credRepo: Repository<MobileCredential>,
    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,
    private readonly jwtService: JwtService,
  ) {}

  async login(username: string, password: string) {
    const cred = await this.credRepo.findOneBy({ username, isActive: true });
    if (!cred) throw new UnauthorizedException('Ulanyjy adы ýa-da parol nädogry');

    const valid = await bcrypt.compare(password, cred.passwordHash);
    if (!valid) throw new UnauthorizedException('Ulanyjy adы ýa-da parol nädogry');

    const worker = await this.workerRepo.findOneBy({ id: cred.workerEntityId });
    if (!worker) throw new UnauthorizedException('Worker tapylmady');

    const payload = {
      sub: cred.id,
      workerEntityId: cred.workerEntityId,
      workerId: worker.workerId,
      name: worker.name,
      role: cred.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
      role: cred.role,
      name: worker.name,
      workerEntityId: cred.workerEntityId,
    };
  }

  async setCredential(workerEntityId: string, username: string, password: string) {
    const worker = await this.workerRepo.findOneBy({ id: workerEntityId });
    if (!worker) throw new NotFoundException('Worker tapylmady');

    const existing = await this.credRepo.findOneBy({ username });
    if (existing && existing.workerEntityId !== workerEntityId) {
      throw new ConflictException('Bu username eýýäm ulanylýar');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    let cred = await this.credRepo.findOneBy({ workerEntityId });
    if (cred) {
      cred.username = username;
      cred.passwordHash = passwordHash;
      cred.role = worker.mobileRole;
      cred.isActive = true;
    } else {
      cred = this.credRepo.create({
        username,
        passwordHash,
        workerEntityId,
        role: worker.mobileRole,
        isActive: true,
      });
    }

    await this.credRepo.save(cred);
    return { success: true, username };
  }

  async getCredentialByWorker(workerEntityId: string) {
    const cred = await this.credRepo.findOneBy({ workerEntityId });
    if (!cred) return null;
    return { username: cred.username, isActive: cred.isActive, role: cred.role };
  }

  async deactivateCredential(workerEntityId: string) {
    const cred = await this.credRepo.findOneBy({ workerEntityId });
    if (cred) {
      cred.isActive = false;
      await this.credRepo.save(cred);
    }
    return { success: true };
  }
}
