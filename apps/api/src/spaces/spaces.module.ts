import { Module } from '@nestjs/common';

import { AccessModule } from '../access/access.module';
import { AuthModule } from '../auth/auth.module';
import { DocumentsModule } from '../documents/documents.module';
import { SpacesController } from './spaces.controller';
import { SpacesService } from './spaces.service';

@Module({
  imports: [AccessModule, AuthModule, DocumentsModule],
  controllers: [SpacesController],
  providers: [SpacesService],
})
export class SpacesModule {}
