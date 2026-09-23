import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PeopleSearchController } from './people-search.controller';
import { PeopleController } from './people.controller';
import { PeopleService } from './people.service';

@Module({
  imports: [AuthModule],
  controllers: [PeopleSearchController, PeopleController],
  providers: [PeopleService],
})
export class PeopleModule {}
