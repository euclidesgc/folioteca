import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FeatureController } from './feature.controller';
import { FeatureRepository } from './feature.repository';
import { FeatureService } from './feature.service';

@Module({
  imports: [PrismaModule],
  controllers: [FeatureController],
  providers: [FeatureService, FeatureRepository],
  exports: [FeatureService],
})
export class FeatureModule {}
