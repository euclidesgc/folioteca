import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { OrgUnitsController } from './org-units.controller';
import { OrgUnitsService } from './org-units.service';

@Module({
  imports: [AuthModule],
  controllers: [OrgUnitsController],
  providers: [OrgUnitsService],
})
export class OrgUnitsModule {}
