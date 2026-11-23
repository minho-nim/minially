import { loginHandler } from '../../../shared/server/auth';
export const onRequest = loginHandler('minilog');
