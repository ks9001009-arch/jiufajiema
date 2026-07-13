import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CountryAccessModule } from '../country-access/country-access.module';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';

@Module({
  imports: [AuthModule, CountryAccessModule],
  controllers: [CompaniesController],
  providers: [CompaniesService],
})
export class CompaniesModule {}
