import { Module } from '@nestjs/common';

import { AccessModule } from '../access/access.module';
import { AuthModule } from '../auth/auth.module';
import { DocumentsModule } from '../documents/documents.module';
import { CollabService } from './collab.service';

@Module({
  imports: [AuthModule, AccessModule, DocumentsModule],
  providers: [CollabService],
  exports: [CollabService],
})
export class CollabModule {}
