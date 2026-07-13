import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WalletLedgerService } from './wallet-ledger.service';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';

@Module({
  imports: [AuthModule],
  controllers: [WalletsController],
  providers: [WalletsService, WalletLedgerService],
  exports: [WalletLedgerService],
})
export class WalletsModule {}
