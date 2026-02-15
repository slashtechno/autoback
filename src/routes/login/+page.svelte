<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
    let { form }: PageProps = $props();

</script>
<form method="POST" use:enhance action="?/login">
	<label>
		Email
		<input name="email" type="email">
	</label>
	<label>
		Password
		<input name="password" type="password">
	</label>
    <label>
        <input name="registrationToken" type="text" placeholder="Registration token (only needed for sign up)">
    </label>
	<button>Log in</button>
</form>