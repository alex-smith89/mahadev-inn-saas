import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrialSignupController } from './trial-signup.controller';
import { TrialSignupService } from './trial-signup.service';
@Module({
  controllers: [TrialSignupController],
  providers: [TrialSignupService,PrismaService],
})
export class TrialSignupModule {}
