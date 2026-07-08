import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key-change-this',
    });
  }

  async validate(payload: any) {
    console.log('🔑 JWT Payload:', payload);
    return {
      id: payload.id,
      username: payload.username,
      role: payload.role,
      branches: payload.branches || [],
      selectedBranch: payload.selectedBranch,
      canViewAllBranches: payload.canViewAllBranches || false,
      canCreateBookings: payload.canCreateBookings || false,
    };
  }
}