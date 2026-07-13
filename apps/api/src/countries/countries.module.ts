import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CountriesController } from './countries.controller';
import { CountriesService } from './countries.service';

@Module({
  imports: [AuthModule],
  controllers: [CountriesController],
  providers: [CountriesService],
})
export class CountriesModule {}
