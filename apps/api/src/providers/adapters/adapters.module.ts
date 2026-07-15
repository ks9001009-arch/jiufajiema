import { Module, OnModuleInit } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { SmsModule } from '../../sms/sms.module';
import { ProviderSmsIngressService } from './ingress/provider-sms-ingress.service';
import { ManualAdapter } from './manual/manual.adapter';
import { ProviderAdapterFactory } from './provider-adapter.factory';
import { ProviderAdapterRegistry } from './provider-adapter.registry';
import { ProviderWebhookController } from './webhook/provider-webhook.controller';

@Module({
  imports: [DatabaseModule, SmsModule],
  controllers: [ProviderWebhookController],
  providers: [
    ProviderAdapterRegistry,
    ProviderAdapterFactory,
    ManualAdapter,
    ProviderSmsIngressService,
  ],
  exports: [
    ProviderAdapterRegistry,
    ProviderAdapterFactory,
    ProviderSmsIngressService,
  ],
})
export class ProviderAdaptersModule implements OnModuleInit {
  constructor(
    private readonly registry: ProviderAdapterRegistry,
    private readonly manualAdapter: ManualAdapter,
  ) {}

  onModuleInit() {
    if (!this.registry.has(this.manualAdapter.code)) {
      this.registry.register(this.manualAdapter);
    }
  }
}
