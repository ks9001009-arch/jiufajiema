import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TeamsController } from './teams.controller';
import { TeamsIdMiddleware } from './teams-id.middleware';
import { TeamsService } from './teams.service';

@Module({
  controllers: [TeamsController],
  providers: [TeamsService, TeamsIdMiddleware],
})
export class TeamsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TeamsIdMiddleware).forRoutes(TeamsController);
  }
}
