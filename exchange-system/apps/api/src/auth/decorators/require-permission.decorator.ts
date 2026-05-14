import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermission = (...sections: string[]) =>
  SetMetadata(PERMISSIONS_KEY, sections);
