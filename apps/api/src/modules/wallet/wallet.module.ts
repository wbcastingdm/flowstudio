import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletAdminController, WalletController } from './wallet.controller';

@Module({
  controllers: [WalletController, WalletAdminController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
