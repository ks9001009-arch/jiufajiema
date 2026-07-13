import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload';
import { CreatePhoneResourceDto } from './dto/create-phone-resource.dto';
import { ListPhoneResourcesQueryDto } from './dto/list-phone-resources-query.dto';
import { UpdatePhoneResourceDto } from './dto/update-phone-resource.dto';
import { PhoneResourcesService } from './phone-resources.service';

@UseGuards(JwtAuthGuard)
@Controller('phone-resources')
export class PhoneResourcesController {
  constructor(private readonly phoneResourcesService: PhoneResourcesService) {}

  @Get()
  findAll(@Query() query: ListPhoneResourcesQueryDto) {
    return this.phoneResourcesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.phoneResourcesService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreatePhoneResourceDto, @CurrentUser() user: JwtPayload) {
    return this.phoneResourcesService.create(dto, user.sub);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePhoneResourceDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.phoneResourcesService.update(id, dto, user.sub);
  }
}
