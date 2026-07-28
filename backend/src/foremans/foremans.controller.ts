import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Headers, UploadedFile, UseInterceptors, BadRequestException, UseGuards, Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ForemanService } from './foremans.service';
import { CreateForemanDto } from './dto/create-foreman.dto';
import { UpdateForemanDto } from './dto/update-foreman.dto';
import { AdminJwtGuard } from '../admin-auth/admin-auth.guard';

@UseGuards(AdminJwtGuard)
@Controller('foremans')
export class ForemanController {
  constructor(private readonly service: ForemanService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.service.findAll(req.adminUser?.tenantId);
  }

  @Post('import/excel')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async importExcel(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Headers('x-admin-name') admin?: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.service.importFromExcel(file.buffer, req.adminUser?.tenantId, admin || 'Admin');
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.service.findOneWithWorkers(id, req.adminUser?.tenantId);
  }

  @Post()
  create(
    @Req() req: any,
    @Body() dto: CreateForemanDto,
    @Headers('x-admin-name') admin?: string,
  ) {
    return this.service.create(dto, req.adminUser?.tenantId, admin || 'Admin');
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateForemanDto,
    @Headers('x-admin-name') admin?: string,
  ) {
    return this.service.update(id, dto, admin || 'Admin');
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Headers('x-admin-name') admin?: string,
  ) {
    return this.service.remove(id, admin || 'Admin');
  }

  @Post(':id/assign')
  assignWorker(
    @Param('id') id: string,
    @Body('workerId') workerId: string,
    @Headers('x-admin-name') admin?: string,
  ) {
    return this.service.assignWorker(id, workerId, admin || 'Admin');
  }

  @Post(':id/unassign')
  unassignWorker(
    @Param('id') id: string,
    @Body('workerId') workerId: string,
    @Headers('x-admin-name') admin?: string,
  ) {
    return this.service.unassignWorker(id, workerId, admin || 'Admin');
  }
}
