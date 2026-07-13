import { Module } from '@nestjs/common';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { OrdersModule } from './orders/orders.module';
import { PhoneResourcesModule } from './phone-resources/phone-resources.module';
import { ProvidersModule } from './providers/providers.module';
import { RolesModule } from './roles/roles.module';
import { ServicesModule } from './services/services.module';
import { TeamsModule } from './teams/teams.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    DatabaseModule,
    HealthModule,
    CompaniesModule,
    TeamsModule,
    ServicesModule,
    ProvidersModule,
    PhoneResourcesModule,
    OrdersModule,
    RolesModule,
    UsersModule,
    AuditLogsModule,
    AuthModule,
  ],
})
export class AppModule {}
