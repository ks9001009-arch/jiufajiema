import { Module } from '@nestjs/common';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { CountriesModule } from './countries/countries.module';
import { CountryAccessModule } from './country-access/country-access.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { JobsModule } from './jobs/jobs.module';
import { OrdersModule } from './orders/orders.module';
import { PhoneResourcesModule } from './phone-resources/phone-resources.module';
import { SmsModule } from './sms/sms.module';
import { ProvidersModule } from './providers/providers.module';
import { RolesModule } from './roles/roles.module';
import { ServicesModule } from './services/services.module';
import { TeamsModule } from './teams/teams.module';
import { UsersModule } from './users/users.module';
import { WalletsModule } from './wallets/wallets.module';

@Module({
  imports: [
    DatabaseModule,
    HealthModule,
    DashboardModule,
    CountriesModule,
    CountryAccessModule,
    CompaniesModule,
    TeamsModule,
    ServicesModule,
    ProvidersModule,
    PhoneResourcesModule,
    OrdersModule,
    JobsModule,
    SmsModule,
    WalletsModule,
    RolesModule,
    UsersModule,
    AuditLogsModule,
    AuthModule,
  ],
})
export class AppModule {}
