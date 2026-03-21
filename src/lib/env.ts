function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} environment variable is required`);
  return value;
}

const YORCK_VISTA_API_KEY = requireEnv('YORCK_VISTA_API_KEY');

const YORCK_VISTA_API_URL = requireEnv('YORCK_VISTA_API_URL');
if (!URL.canParse(YORCK_VISTA_API_URL)) throw new Error('YORCK_VISTA_API_URL environment variable is not a valid URL');
if (!YORCK_VISTA_API_URL.endsWith('/')) throw new Error('YORCK_VISTA_API_URL environment variable must end with /');

const PORT_STR = requireEnv('PORT');
if (!/^\d+$/.test(PORT_STR)) throw new Error('PORT environment variable must be numeric');
const PORT = Number(PORT_STR);

const APP_URL = requireEnv('APP_URL');
if (!URL.canParse(APP_URL)) throw new Error('APP_URL environment variable is not a valid URL');

export { YORCK_VISTA_API_KEY, YORCK_VISTA_API_URL, PORT, APP_URL };
