import { vercelHandler } from '../../src/server/vercel-adapter.js';

export const config = { runtime: 'nodejs' };
export default vercelHandler;
