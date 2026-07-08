import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TeamsController } from './teams.controller';
import { TeamsIdMiddleware } from './teams-id.middleware';
import { TeamsService } from './teams.service';

@Module({
  imports: [AuthModule],
  controllers: [TeamsController],
  providers: [TeamsService, TeamsIdMiddleware],
})
export class TeamsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TeamsIdMiddleware).forRoutes(TeamsController);
  }
}
