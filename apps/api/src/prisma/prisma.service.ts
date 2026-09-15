import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { DEFAULT_TRANSACTION_OPTIONS, PrismaClient } from '@shop/db';

export { DEFAULT_TRANSACTION_OPTIONS };

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      transactionOptions: DEFAULT_TRANSACTION_OPTIONS,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

/**
 * The transaction-scoped client type. Every service method that participates in
 * a transaction takes one of these rather than reaching for the global client,
 * which is what keeps checkout's reserve-and-write and the webhook's
 * transition-and-fulfil genuinely atomic instead of accidentally autocommitting
 * halfway through.
 */
export type PrismaTx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;
