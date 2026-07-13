import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ListSmsQueryDto } from './dto/list-sms-query.dto';
import { SmsService } from './sms.service';

@UseGuards(JwtAuthGuard)
@Controller('sms')
export class SmsController {
  constructor(private readonly smsService: SmsService) {}

  @Get()
  findAll(@Query() query: ListSmsQueryDto) {
    return this.smsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.smsService.findOne(id);
  }
}
