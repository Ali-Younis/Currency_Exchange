import { IsIn, IsString } from 'class-validator';
import { DocumentType } from '@prisma/client';

export class UploadDocumentDto {
  @IsIn(['PASSPORT', 'PASSPORT_CARD', 'NATIONAL_ID', 'DRIVING_LICENSE'])
  docType!: DocumentType;

  @IsString()
  customerId!: string;
}
