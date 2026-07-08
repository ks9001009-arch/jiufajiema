import { Module } from '@nestjs/common';
import { CompaniesModule } from './companies/companies.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { TeamsModule } from './teams/teams.module';

@Module({
  imports: [DatabaseModule, HealthModule, CompaniesModule, TeamsModule],
})
export class AppModule {}
