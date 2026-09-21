import { Module } from '@nestjs/common';

import { AccessModule } from '../access/access.module';
import { AuthModule } from '../auth/auth.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { FavoritesService } from './favorites.service';

@Module({
  imports: [AuthModule, AccessModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, FavoritesService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
