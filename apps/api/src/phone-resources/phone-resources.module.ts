import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PhoneResourcesController } from './phone-resources.controller';
import { PhoneResourcesService } from './phone-resources.service';

@Module({
  imports: [AuthModule],
  controllers: [PhoneResourcesController],
  providers: [PhoneResourcesService],
})
export class PhoneResourcesModule {}
