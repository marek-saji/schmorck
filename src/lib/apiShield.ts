import type { ApiShield, ApiShieldOptions } from '../../public/lib/apiShield.mjs';

import { createApiShield as createApiShieldUntyped } from '../../public/lib/apiShield.mjs';

export const createApiShield: (options: ApiShieldOptions) => ApiShield = createApiShieldUntyped;
