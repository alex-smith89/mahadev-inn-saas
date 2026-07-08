import { Module } from '@nestjs/common';
import { TrialSignupController } from './trial-signup.controller';
import { TrialSignupService } from './trial-signup.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TrialSignupController],
  providers: [TrialSignupService],
})
export class TrialSignupModule {}