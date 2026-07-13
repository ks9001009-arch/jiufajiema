import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CountryAccessService } from './country-access.service';

@UseGuards(JwtAuthGuard)
@Controller('country-access')
export class CountryAccessController {
  constructor(private readonly countryAccessService: CountryAccessService) {}

  @Get('effective')
  resolveEffective(
    @Query('companyId') companyId: string,
    @Query('teamId') teamId?: string,
  ) {
    return this.countryAccessService.resolveEffectiveCountries(
      companyId,
      teamId || null,
    );
  }
}
