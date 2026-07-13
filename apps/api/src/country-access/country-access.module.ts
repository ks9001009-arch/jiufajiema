import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CountryAccessController } from './country-access.controller';
import { CountryAccessService } from './country-access.service';

@Module({
  imports: [AuthModule],
  controllers: [CountryAccessController],
  providers: [CountryAccessService],
  exports: [CountryAccessService],
})
export class CountryAccessModule {}
