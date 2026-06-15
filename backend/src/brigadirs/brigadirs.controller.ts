import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Headers, UploadedFile, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { BrigadirsService } from './brigadirs.service';
import { CreateBrigadirDto } from './dto/create-brigadir.dto';
import { UpdateBrigadirDto } from './dto/update-brigadir.dto';

@Controller('brigadirs')
export class BrigadirsController {
  constructor(private readonly service: BrigadirsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOneWithWorkers(id);
  }

  @Post()
  create(
    @Body() dto: CreateBrigadirDto,
    @Headers('x-admin-name') admin?: string,
  ) {
    return this.service.create(dto, admin || 'Admin');
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBrigadirDto,
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

  @Post(':id/assign-worker')
  assignWorker(
    @Param('id') brigadirId: string,
    @Body() body: { workerId: string },
    @Headers('x-admin-name') admin?: string,
  ) {
    return this.service.assignWorker(brigadirId, body.workerId, admin || 'Admin');
  }

  @Delete(':id/workers/:workerId')
  unassignWorker(
    @Param('id') brigadirId: string,
    @Param('workerId') workerId: string,
    @Headers('x-admin-name') admin?: string,
  ) {
    return this.service.unassignWorker(brigadirId, workerId, admin || 'Admin');
  }

  @Post('import/excel')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async importExcel(
    @UploadedFile() file: Express.Multer.File,
    @Headers('x-admin-name') admin?: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.service.importFromExcel(file.buffer, admin || 'Admin');
  }
}
