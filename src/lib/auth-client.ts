// https://www.better-auth.com/docs/integrations/svelte-kit#create-a-client
import { createAuthClient } from 'better-auth/svelte';
import { apiKeyClient } from '@better-auth/api-key/client';

export const authClient = createAuthClient({
	plugins: [apiKeyClient()]
});
