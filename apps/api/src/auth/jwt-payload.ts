export class JwtPayload {
  sub: string;
  username: string;
  companyId: string | null;
  teamId: string | null;
  roleId: string | null;
}
