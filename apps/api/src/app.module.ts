import { Module } from '@nestjs/common';
import { CompaniesModule } from './companies/companies.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { RolesModule } from './roles/roles.module';
import { TeamsModule } from './teams/teams.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    DatabaseModule,
    HealthModule,
    CompaniesModule,
    TeamsModule,
    RolesModule,
    UsersModule,
  ],
})
export class AppModule {}
