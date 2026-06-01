import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';
import * as fs from 'fs';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { AuthTokenPayload } from '@exchange/shared';
import { DocumentType } from '@prisma/client';

@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private readonly svc: CustomersService) {}

  /** Smart lookup by phone — returns classification for the form badge */
  @Get('lookup')
  lookup(@Query('phone') phone: string) {
    if (!phone) throw new BadRequestException('phone query param is required');
    return this.svc.lookupByPhone(phone);
  }

  /**
   * Strict two-step phone validation (syntax + regional rules).
   * POST /customers/validate-phone  { phone: "+447700900000" }
   * Returns { valid, formatted?, country?, type?, rule?, error? }
   */
  @Post('validate-phone')
  validatePhone(@Body() body: { phone: string }) {
    if (!body?.phone) {
      return { valid: false, rule: 'syntax_check', error: 'phone field is required.' };
    }
    return this.svc.validatePhone(body.phone);
  }

  /** List all customers (Customer Inventory) */
  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermission('customers')
  findAll(@Query('limit') limit?: string) {
    return this.svc.findAll(limit ? Number(limit) : 200);
  }

  /** Get single customer with documents */
  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('customers')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(id);
  }

  /** Upload a proof-of-identity document */
  @Post(':id/documents')
  @UseGuards(PermissionsGuard)
  @RequirePermission('customers')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    }),
  )
  uploadDocument(
    @Param('id', ParseUUIDPipe) customerId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('docType') docType: DocumentType,
    @CurrentUser() user: AuthTokenPayload,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!docType) throw new BadRequestException('docType is required');
    return this.svc.uploadDocument(customerId, file, docType, user.sub);
  }

  /** List documents for a customer */
  @Get(':id/documents')
  @UseGuards(PermissionsGuard)
  @RequirePermission('customers')
  listDocuments(@Param('id', ParseUUIDPipe) customerId: string) {
    return this.svc.listDocuments(customerId);
  }

  /** Download a specific document (streams the file) */
  @Get(':id/documents/:docId/download')
  @UseGuards(PermissionsGuard)
  @RequirePermission('customers')
  async downloadDocument(
    @Param('id', ParseUUIDPipe) customerId: string,
    @Param('docId', ParseUUIDPipe) docId: string,
    @Res() res: Response,
  ) {
    const doc = await this.svc.getDocumentFile(customerId, docId);
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${doc.originalName.replace(/[^\w.\-]/g, '_')}"`,
    );
    res.setHeader('Content-Length', doc.fileSize);
    const stream = fs.createReadStream(doc.filePath);
    stream.pipe(res);
  }

  /** Delete a document (admin only) */
  @Delete(':id/documents/:docId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  deleteDocument(
    @Param('id', ParseUUIDPipe) customerId: string,
    @Param('docId', ParseUUIDPipe) docId: string,
  ) {
    return this.svc.deleteDocument(customerId, docId);
  }
}
