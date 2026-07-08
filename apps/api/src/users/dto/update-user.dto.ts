export type UserStatus = 'ACTIVE' | 'DISABLED';

export class UpdateUserDto {
  displayName?: string;
  status?: UserStatus;
  teamId?: string;
  roleId?: string;
}
