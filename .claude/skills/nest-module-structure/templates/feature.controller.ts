import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CreateFeatureDto } from './dto/create-feature.dto';
import { ListFeatureQueryDto } from './dto/list-feature.query.dto';
import type { FeatureView } from './dto/feature.view';
import { FeatureService } from './feature.service';

@Controller('features')
export class FeatureController {
  constructor(private readonly features: FeatureService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListFeatureQueryDto,
  ): Promise<FeatureView[]> {
    return this.features.list(user.id, query);
  }

  @Get(':id')
  findById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<FeatureView> {
    return this.features.findById(user.id, id);
  }

  @Post()
  @HttpCode(201)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateFeatureDto,
  ): Promise<FeatureView> {
    return this.features.create(user.id, body);
  }
}
