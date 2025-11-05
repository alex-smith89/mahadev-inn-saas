import { MiddlewareConsumer, Module, NestModule  } from '@nestjs/common';
import { ContextMiddleware } from '../apps/api/src/common/middleware/context.middleware';
import { PrismaService } from './prisma/prisma.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BookingsModule } from './bookings/bookings.module';
import { AuditModule } from 'apps/api/src/audit/audit.module';
import { BranchCapacityModule } from './branch-capacity/branch-capacity.module';
import { TrialSignupModule } from './trial-signup/trial-signup.module';

@Module({
  imports: [AuthModule, UsersModule, BookingsModule, AuditModule,
    BranchCapacityModule,TrialSignupModule  // 👈 add this line
  ],
  providers: [PrismaService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ContextMiddleware).forRoutes('*'); // 👈 apply globally
  }
}