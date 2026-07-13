import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload';
import {
  AdjustWalletAccountDto,
  CreateWalletAccountDto,
  ListWalletTransactionsQueryDto,
  RechargeWalletAccountDto,
} from './dto/wallet.dto';
import { WalletsService } from './wallets.service';

@UseGuards(JwtAuthGuard)
@Controller('wallet-accounts')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get()
  findAll(@Query('companyId') companyId?: string) {
    return this.walletsService.findAll(companyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.walletsService.findOne(id);
  }

  @Get(':id/transactions')
  findTransactions(
    @Param('id') id: string,
    @Query() query: ListWalletTransactionsQueryDto,
  ) {
    return this.walletsService.findTransactions(id, query);
  }

  @Post()
  create(@Body() dto: CreateWalletAccountDto, @CurrentUser() user: JwtPayload) {
    return this.walletsService.create(dto, user.sub);
  }

  @Post(':id/recharge')
  recharge(
    @Param('id') id: string,
    @Body() dto: RechargeWalletAccountDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.walletsService.recharge(id, dto, user.sub);
  }

  @Post(':id/adjustments')
  adjust(
    @Param('id') id: string,
    @Body() dto: AdjustWalletAccountDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.walletsService.adjust(id, dto, user.sub);
  }
}
