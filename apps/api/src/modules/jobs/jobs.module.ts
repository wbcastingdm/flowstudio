import { Module } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JobGroupsService } from './job-groups.service';
import { JobGroupsController, JobsAdminController } from './jobs.controller';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [WalletModule],
  controllers: [JobGroupsController, JobsAdminController],
  providers: [JobsService, JobGroupsService],
  exports: [JobsService, JobGroupsService],
})
export class JobsModule {}
