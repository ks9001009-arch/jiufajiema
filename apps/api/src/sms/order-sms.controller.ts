import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload';
import { CreateSmsDto } from './dto/create-sms.dto';
import { SmsService } from './sms.service';

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrderSmsController {
  constructor(private readonly smsService: SmsService) {}

  @Get(':orderId/sms')
  findByOrder(@Param('orderId') orderId: string) {
    return this.smsService.findByOrderId(orderId);
  }

  @Post(':orderId/sms')
  createForOrder(
    @Param('orderId') orderId: string,
    @Body() dto: CreateSmsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.smsService.createForOrder(orderId, dto, user.sub);
  }
}
