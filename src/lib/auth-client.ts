// https://www.better-auth.com/docs/integrations/svelte-kit#create-a-client
import { createAuthClient } from "better-auth/svelte";
import { usernameClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
    plugins: [ 
    ] 
});