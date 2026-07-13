import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CountryAccessModule } from '../country-access/country-access.module';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

@Module({
  imports: [AuthModule, CountryAccessModule],
  controllers: [TeamsController],
  providers: [TeamsService],
})
export class TeamsModule {}
