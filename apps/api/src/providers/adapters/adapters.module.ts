import { Module, OnModuleInit } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { ManualAdapter } from './manual/manual.adapter';
import { ProviderAdapterFactory } from './provider-adapter.factory';
import { ProviderAdapterRegistry } from './provider-adapter.registry';

@Module({
  imports: [DatabaseModule],
  providers: [ProviderAdapterRegistry, ProviderAdapterFactory, ManualAdapter],
  exports: [ProviderAdapterRegistry, ProviderAdapterFactory],
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
