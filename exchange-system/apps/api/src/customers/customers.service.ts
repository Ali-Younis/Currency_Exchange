import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AppSettingsService } from '../app-settings/app-settings.service';
import { DocumentType } from '@prisma/client';
import { validatePhoneNumber, PhoneValidationResult } from '../common/validators/phone.validator';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AppSettingsService,
  ) {}

  private async getDocsDir(): Promise<string> {
    const dir = (await this.settings.get('customer_docs_directory')) ?? '/app/customer-docs';
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  /**
   * Strict two-step phone validation (syntax + regional rules).
   * Returns a structured result — never throws.
   */
  validatePhone(phone: string): PhoneValidationResult {
    return validatePhoneNumber(phone);
  }

  /**
   * Look up a customer by phone number.
   * Returns classification info for the smart lookup badge.
   */
  async lookupByPhone(phone: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { phone },
      include: {
        transactions: {
          where: { isVoided: false },
          select: { type: true },
        },
      },
    });

    if (!customer) {
      return { found: false, phone };
    }

    const txCount = customer.transactions.length;
    const types = [...new Set(customer.transactions.map((t) => t.type))];

    return {
      found: true,
      customerId: customer.id,
      phone: customer.phone,
      name: customer.name,
      email: customer.email,
      totalTransactions: txCount,
      transactionTypes: types,
    };
  }

  /**
   * Find-or-create a customer by phone.
   * Called from TransactionsService after a transaction is created.
   */
  async findOrCreate(phone: string, name: string, email?: string) {
    const existing = await this.prisma.customer.findUnique({ where: { phone } });
    if (existing) {
      // Update name/email if they've changed
      const updates: Record<string, string> = {};
      if (existing.name !== name) updates.name = name;
      if (email && existing.email !== email) updates.email = email;
      if (Object.keys(updates).length > 0) {
        return this.prisma.customer.update({ where: { id: existing.id }, data: updates });
      }
      return existing;
    }
    return this.prisma.customer.create({ data: { phone, name, email } });
  }

  /**
   * List all customers with transaction count, ordered by most transactions.
   */
  async findAll(limit = 200) {
    const customers = await this.prisma.customer.findMany({
      include: {
        _count: { select: { transactions: { where: { isVoided: false } } } },
        documents: { select: { id: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    return customers.map((c) => ({
      id: c.id,
      phone: c.phone,
      name: c.name,
      email: c.email,
      totalTransactions: c._count.transactions,
      totalDocuments: c.documents.length,
      createdAt: c.createdAt,
    }));
  }

  /**
   * Get a single customer with their full documents list.
   */
  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        documents: {
          include: {
            uploadedBy: { select: { fullName: true, username: true } },
          },
          orderBy: { uploadedAt: 'desc' },
        },
        _count: { select: { transactions: { where: { isVoided: false } } } },
      },
    });
    if (!customer) throw new NotFoundException(`Customer ${id} not found`);
    return customer;
  }

  /**
   * Upload a proof-of-identity document for a customer.
   * Saves file to disk; stores metadata in DB.
   */
  async uploadDocument(
    customerId: string,
    file: Express.Multer.File,
    docType: DocumentType,
    uploadedById: string,
  ) {
    // Validate customer exists
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException(`Customer ${customerId} not found`);

    // Validate mime type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} not allowed. Accepted: JPEG, PNG, WebP, PDF`,
      );
    }

    // Validate file size (belt-and-suspenders — frontend also validates)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(`File too large (max 10 MB)`);
    }

    const dir = await this.getDocsDir();
    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    const storedName = `${randomUUID()}${ext}`;
    const filePath = path.join(dir, storedName);

    fs.writeFileSync(filePath, file.buffer);

    const doc = await this.prisma.customerDocument.create({
      data: {
        customerId,
        docType,
        originalName: file.originalname,
        storedName,
        filePath,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedById,
      },
      include: {
        uploadedBy: { select: { fullName: true, username: true } },
      },
    });

    return doc;
  }

  /**
   * List all documents for a customer.
   */
  async listDocuments(customerId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException(`Customer ${customerId} not found`);

    return this.prisma.customerDocument.findMany({
      where: { customerId },
      include: { uploadedBy: { select: { fullName: true, username: true } } },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  /**
   * Get a single document's metadata + file path (for streaming).
   */
  async getDocumentFile(customerId: string, docId: string) {
    const doc = await this.prisma.customerDocument.findFirst({
      where: { id: docId, customerId },
    });
    if (!doc) throw new NotFoundException(`Document ${docId} not found`);
    if (!fs.existsSync(doc.filePath)) {
      throw new NotFoundException(`Document file not found on disk`);
    }
    return doc;
  }

  /**
   * Delete a document (admin only — enforced at controller level).
   */
  async deleteDocument(customerId: string, docId: string) {
    const doc = await this.prisma.customerDocument.findFirst({
      where: { id: docId, customerId },
    });
    if (!doc) throw new NotFoundException(`Document ${docId} not found`);

    // Remove file from disk (best-effort)
    try {
      if (fs.existsSync(doc.filePath)) fs.unlinkSync(doc.filePath);
    } catch {
      // File already gone — still remove DB record
    }

    await this.prisma.customerDocument.delete({ where: { id: docId } });
    return { deleted: true };
  }
}
