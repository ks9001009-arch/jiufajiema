import { Module, OnModuleInit } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { SmsModule } from '../../sms/sms.module';
import { ProviderSmsIngressService } from './ingress/provider-sms-ingress.service';
import { ManualAdapter } from './manual/manual.adapter';
import { ProviderPollingService } from './polling/provider-polling.service';
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
    ProviderPollingService,
  ],
  exports: [
    ProviderAdapterRegistry,
    ProviderAdapterFactory,
    ProviderSmsIngressService,
    ProviderPollingService,
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
