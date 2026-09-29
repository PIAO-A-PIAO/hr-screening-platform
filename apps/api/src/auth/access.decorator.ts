import { SetMetadata } from '@nestjs/common';
export const Public = () => SetMetadata('access:public', true);
export const AdminOnly = () => SetMetadata('access:admin', true);
