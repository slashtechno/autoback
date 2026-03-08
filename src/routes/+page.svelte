<script lang="ts">
  import { authClient } from "$lib/auth-client";
  const session = authClient.useSession();
</script>

<div class="flex flex-col justify-center items-center gap-4">
{#if $session.data}
    <ul>
        <li><a href="/drives">Drives</a></li>
        <li><a href="/keys">API Keys</a></li>
    </ul>
{/if}
</div>