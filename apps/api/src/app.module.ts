import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { ApiKeyGuard } from './auth/api-key.guard';
import { ProductsModule } from './products/products.module';
import { CustomersModule } from './customers/customers.module';
import { OrdersModule } from './orders/orders.module';
import { InventoryModule } from './inventory/inventory.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { TillModule } from './till/till.module';
import { ReturnsModule } from './returns/returns.module';
import { PurchaseModule } from './purchase/purchase.module';
import { PaymentsModule } from './payments/payments.module';
import { ReportsModule } from './reports/reports.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    InventoryModule,
    ProductsModule,
    CustomersModule,
    OrdersModule,
    AnalyticsModule,
    TillModule,
    ReturnsModule,
    PurchaseModule,
    PaymentsModule,
    ReportsModule,
    WhatsappModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ApiKeyGuard }],
})
export class AppModule {}
