const prefix = process.env.PUBLIC_HOST_PREFIX ?? '';

export const hostPrefix = prefix;

export function hostPath(path: string): string {
	return prefix ? `${prefix}${path}` : path;
}
