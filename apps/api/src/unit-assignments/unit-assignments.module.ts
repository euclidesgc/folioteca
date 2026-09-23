import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { UnitAssignmentsController } from './unit-assignments.controller';
import { UnitAssignmentsService } from './unit-assignments.service';

@Module({
  imports: [AuthModule],
  controllers: [UnitAssignmentsController],
  providers: [UnitAssignmentsService],
})
export class UnitAssignmentsModule {}
