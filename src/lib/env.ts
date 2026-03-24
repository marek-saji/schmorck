function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} environment variable is required`);
  return value;
}

const YORCK_VISTA_API_KEY = requireEnv('YORCK_VISTA_API_KEY');

const YORCK_VISTA_API_URL = requireEnv('YORCK_VISTA_API_URL');
if (!URL.canParse(YORCK_VISTA_API_URL)) throw new Error('YORCK_VISTA_API_URL environment variable is not a valid URL');
if (!YORCK_VISTA_API_URL.endsWith('/')) throw new Error('YORCK_VISTA_API_URL environment variable must end with /');

let APP_URL = requireEnv('APP_URL');
if (!URL.canParse(APP_URL)) throw new Error('APP_URL environment variable is not a valid URL');

const PORT_OVERRIDE = process.env.PORT;
if (PORT_OVERRIDE != null) {
  if (!/^\d+$/.test(PORT_OVERRIDE)) throw new Error('PORT environment variable must be numeric');
  const url = new URL(APP_URL);
  url.port = PORT_OVERRIDE;
  APP_URL = url.toString().replace(/\/$/, '');
}

const TRAKT_CLIENT_ID = requireEnv('TRAKT_CLIENT_ID');
const TRAKT_CLIENT_SECRET = process.env.TRAKT_CLIENT_SECRET;

const NODE_ENV = process.env.NODE_ENV ?? 'development';

const COMMIT_SHA = process.env.GIT_SHA
  || process.env.GITHUB_SHA
  || process.env.VERCEL_GIT_COMMIT_SHA
  || process.env.CF_PAGES_COMMIT_SHA
  || process.env.COMMIT_SHA
  || process.env.RAILWAY_GIT_COMMIT_SHA
  || process.env.COMMIT_REF
  || process.env.RENDER_GIT_COMMIT;

export { YORCK_VISTA_API_KEY, YORCK_VISTA_API_URL, APP_URL, TRAKT_CLIENT_ID, TRAKT_CLIENT_SECRET, NODE_ENV, COMMIT_SHA };
