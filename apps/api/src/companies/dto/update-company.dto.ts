export type CompanyStatus = 'ACTIVE' | 'DISABLED';

export class UpdateCompanyDto {
  name?: string;
  status?: CompanyStatus;
}
