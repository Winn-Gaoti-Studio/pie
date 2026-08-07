import { execFile } from "node:child_process";

export type GitStatusComplete = (error: Error | null, output: string) => void;
export type GitStatusCancel = () => void;
export type GitStatusProbe = (
	cwd: string,
	complete: GitStatusComplete
) => void | GitStatusCancel;

export type GitStatusExec = (
	file: string,
	args: string[],
	options: { cwd: string; encoding: "utf8"; timeout: number },
	complete: GitStatusComplete
) => { kill(): unknown };

function execGitStatus(
	file: string,
	args: string[],
	options: { cwd: string; encoding: "utf8"; timeout: number },
	complete: GitStatusComplete
): { kill(): unknown } {
	return execFile(file, args, options, (error, stdout) => complete(error, stdout));
}

export function createGitStatusProbe(exec: GitStatusExec): GitStatusProbe {
	return (cwd, complete) => {
		const child = exec(
			"git",
			["--no-optional-locks", "status", "--short"],
			{
				cwd,
				encoding: "utf8",
				timeout: 500,
			},
			complete
		);
		return () => child.kill();
	};
}

export const probeGitStatus = createGitStatusProbe(execGitStatus);

export type GitStatusMonitor = {
	getDirty(): boolean;
	request(): void;
	requestDebounced(): void;
	setCwd(cwd: string): void;
	dispose(): void;
};

export function createGitStatusMonitor(
	initialCwd: string,
	onChange: () => void,
	probe: GitStatusProbe = probeGitStatus
): GitStatusMonitor {
	let cwd = initialCwd;
	let generation = 0;
	let dirty: boolean | null = null;
	let running = false;
	let pending = false;
	let disposed = false;
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;
	let active: { done: boolean; cancel?: GitStatusCancel } | undefined;

	const start = () => {
		if (disposed || running) return;

		running = true;
		const probeGeneration = generation;
		const probeCwd = cwd;
		const current = { done: false };
		active = current;
		const cancel = probe(probeCwd, (error, output) => {
			if (current.done) return;
			current.done = true;
			if (active === current) active = undefined;
			running = false;
			if (!disposed && probeGeneration === generation && !error) {
				dirty = output.trim().length > 0;
				onChange();
			}
			if (pending && !disposed) {
				pending = false;
				start();
			}
		});
		if (active === current && typeof cancel === "function") current.cancel = cancel;
	};

	const request = () => {
		if (disposed) return;
		if (running) {
			pending = true;
			return;
		}
		start();
	};

	return {
		getDirty: () => dirty ?? false,
		request,
		requestDebounced: () => {
			if (disposed) return;
			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = setTimeout(() => {
				debounceTimer = undefined;
				request();
			}, 100);
		},
		setCwd: (nextCwd) => {
			if (nextCwd === cwd || disposed) return;
			cwd = nextCwd;
			generation += 1;
			dirty = null;
			request();
		},
		dispose: () => {
			disposed = true;
			pending = false;
			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = undefined;
			const current = active;
			active = undefined;
			running = false;
			if (current) {
				current.done = true;
				current.cancel?.();
			}
		},
	};
}
