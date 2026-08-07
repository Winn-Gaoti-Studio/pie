import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import {
	createGitStatusMonitor,
	probeGitStatus,
	type GitStatusExec,
	type GitStatusMonitor,
	type GitStatusProbe,
} from "../../agent/extensions/lib/git-status-monitor.ts";

type PendingProbe = {
	cwd: string;
	complete: (error: Error | null, output: string) => void;
};

function controlledProbe(): { probe: GitStatusProbe; calls: PendingProbe[] } {
	const calls: PendingProbe[] = [];
	return {
		probe: (cwd, complete) => {
			calls.push({ cwd, complete });
		},
		calls,
	};
}

type FakeMonitorRecord = {
	cwd: string;
	dirty: boolean;
	requests: number;
	debouncedRequests: number;
	setCwds: string[];
	disposals: number;
	onChange: () => void;
	monitor: GitStatusMonitor;
};

function controlledMonitorFactory() {
	const records: FakeMonitorRecord[] = [];
	return {
		records,
		create: (cwd: string, onChange: () => void): GitStatusMonitor => {
			const record = {
				cwd,
				dirty: false,
				requests: 0,
				debouncedRequests: 0,
				setCwds: [] as string[],
				disposals: 0,
				onChange,
				monitor: undefined as never,
			};
			record.monitor = {
				getDirty: () => record.dirty,
				request: () => record.requests++,
				requestDebounced: () => record.debouncedRequests++,
				setCwd: (nextCwd) => record.setCwds.push(nextCwd),
				dispose: () => record.disposals++,
			};
			records.push(record);
			return record.monitor;
		},
	};
}

function createFooterHarness() {
	const handlers = new Map<string, (...args: never[]) => unknown>();
	const commands = new Map<string, { handler: (...args: never[]) => Promise<void> }>();
	const footerCalls: unknown[] = [];
	let footerFactory: ((...args: never[]) => {
		dispose(): void;
		render(width: number): string[];
	}) | undefined;
	let cwd = "/work/project";
	let branchCallback: (() => void) | undefined;
	let renderRequests = 0;
	let unsubscribes = 0;

	const ctx = {
		sessionManager: {
			getCwd: () => cwd,
			getBranch: () => [],
		},
		ui: {
			setFooter: (factory: typeof footerFactory) => {
				footerCalls.push(factory);
				footerFactory = factory;
			},
			notify: () => {},
		},
		model: { provider: "test", id: "model" },
	};
	const pi = {
		on: (event: string, handler: (...args: never[]) => unknown) => handlers.set(event, handler),
		registerCommand: (name: string, command: { handler: (...args: never[]) => Promise<void> }) =>
			commands.set(name, command),
		getThinkingLevel: () => "off",
	};
	const tui = { requestRender: () => renderRequests++ };
	const theme = { fg: (_style: string, value: string) => value };
	const footerData = {
		getGitBranch: () => "main",
		onBranchChange: (callback: () => void) => {
			branchCallback = callback;
			return () => unsubscribes++;
		},
	};

	return {
		branch: () => branchCallback?.(),
		commands,
		ctx,
		footerCalls,
		footer: () => footerFactory?.(tui as never, theme as never, footerData as never),
		handlers,
		pi,
		renderRequests: () => renderRequests,
		setCwd: (nextCwd: string) => (cwd = nextCwd),
		unsubscribes: () => unsubscribes,
	};
}

async function loadStarshipExtension() {
	const stubs = mkdtempSync(join(tmpdir(), "pi-footer-stubs-"));
	const probeSpecifier = `pi-footer-hook-probe-${stubs.split("/").at(-1)}`;
	writeFileSync(join(stubs, "pi-tui.mjs"), [
		"export const visibleWidth = (value) => value.length;",
		"export const truncateToWidth = (value, width) => value.slice(0, width);",
	].join("\n"));
	writeFileSync(join(stubs, "pi-coding-agent.mjs"), "export {};\n");
	writeFileSync(join(stubs, "pi-ai.mjs"), "export const getSupportedThinkingLevels = () => ['off'];\n");
	writeFileSync(join(stubs, "probe.mjs"), "export const loaded = true;\n");
	const stubUrls = new Map([
		["@earendil-works/pi-tui", pathToFileURL(join(stubs, "pi-tui.mjs")).href],
		["@earendil-works/pi-coding-agent", pathToFileURL(join(stubs, "pi-coding-agent.mjs")).href],
		["@earendil-works/pi-ai", pathToFileURL(join(stubs, "pi-ai.mjs")).href],
		[probeSpecifier, pathToFileURL(join(stubs, "probe.mjs")).href],
	]);
	const hooks = registerHooks({
		resolve(specifier, context, nextResolve) {
			const url = stubUrls.get(specifier);
			return url ? { url, shortCircuit: true } : nextResolve(specifier, context);
		},
	});
	let cleaned = false;
	const cleanup = () => {
		if (cleaned) return;
		cleaned = true;
		hooks.deregister();
		rmSync(stubs, { recursive: true, force: true });
	};
	const source = new URL("../../agent/extensions/starship-statusline.ts", import.meta.url);
	let extension: typeof import("../../agent/extensions/starship-statusline.ts");
	try {
		extension = await import(`${source.href}?pi-footer-test=${Date.now()}`);
	} catch (error) {
		cleanup();
		throw error;
	}
	return {
		extension: extension.default as (pi: unknown, deps?: unknown) => void,
		cleanup,
		probeSpecifier,
		stubs,
	};
}

test("footer rendering does not use synchronous git status", () => {
	const source = readFileSync(
		new URL("../../agent/extensions/starship-statusline.ts", import.meta.url),
		"utf8"
	);

	assert.equal(source.includes("execFileSync"), false);
});

test("the real footer renders before a probe resolves and owns toggle disposal", async () => {
	const { extension, cleanup, probeSpecifier, stubs } = await loadStarshipExtension();
	try {
		const monitors = controlledMonitorFactory();
		const harness = createFooterHarness();
		extension(harness.pi, { createGitStatusMonitor: monitors.create });

		await harness.handlers.get("session_start")?.(undefined as never, harness.ctx as never);
		assert.equal(monitors.records.length, 1);
		assert.equal(monitors.records[0]?.requests, 1);

		const oldFooter = harness.footer();
		assert.ok(oldFooter);
		assert.match(oldFooter.render(120).join("\n"), /project/);
		assert.doesNotMatch(oldFooter.render(120).join("\n"), /project\*/);
		monitors.records[0]!.dirty = true;
		monitors.records[0]!.onChange();
		assert.equal(harness.renderRequests(), 1);
		assert.match(oldFooter.render(120).join("\n"), /project\*/);
		harness.branch();
		assert.equal(monitors.records[0]?.requests, 2);
		assert.equal(harness.renderRequests(), 2);
		harness.handlers.get("turn_end")?.();
		harness.handlers.get("agent_end")?.();
		assert.equal(monitors.records[0]?.debouncedRequests, 2);
		assert.equal(harness.renderRequests(), 4);
		harness.setCwd("/work/other-project");
		oldFooter.render(120);
		assert.equal(monitors.records[0]?.setCwds.at(-1), "/work/other-project");

		await harness.commands.get("footer")?.handler("" as never, harness.ctx as never);
		assert.equal(monitors.records[0]?.disposals, 1);
		assert.equal(harness.footerCalls.at(-1), undefined);
		monitors.records[0]!.onChange();
		assert.equal(harness.renderRequests(), 4);

		await harness.commands.get("footer")?.handler("" as never, harness.ctx as never);
		assert.equal(monitors.records.length, 2);
		const replacement = harness.footer();
		assert.ok(replacement);
		oldFooter.dispose();
		monitors.records[1]!.onChange();
		assert.equal(harness.renderRequests(), 5);
		assert.equal(harness.unsubscribes(), 1);
	} finally {
		cleanup();
	}
	await assert.rejects(import(probeSpecifier), (error: unknown) => {
		return error instanceof Error && !error.message.includes(stubs);
	});
});

test("the production probe configures the 500 ms command and cancels its child", async () => {
	const module = await import("../../agent/extensions/lib/git-status-monitor.ts") as typeof import("../../agent/extensions/lib/git-status-monitor.ts") & {
		createGitStatusProbe?: unknown;
	};
	assert.equal(typeof module.createGitStatusProbe, "function");
	if (typeof module.createGitStatusProbe !== "function") return;

	let killed = 0;
	let changes = 0;
	let call: { file: string; args: string[]; options: unknown } | undefined;
	let complete: ((error: Error | null, output: string) => void) | undefined;
	const probe = (module.createGitStatusProbe as (exec: GitStatusExec) => GitStatusProbe)(
		(file, args, options, callback) => {
			call = { file, args, options };
			complete = callback;
			return { kill: () => killed++ };
		}
	);
	const monitor = createGitStatusMonitor("/repo", () => changes++, probe);
	monitor.request();
	assert.deepEqual(call, {
		file: "git",
		args: ["--no-optional-locks", "status", "--short"],
		options: { cwd: "/repo", encoding: "utf8", timeout: 500 },
	});
	monitor.dispose();
	assert.equal(killed, 1);
	complete?.(null, "?? late");
	assert.equal(changes, 0);
});

test("monitor renders the initial state without waiting for an asynchronous probe", () => {
	const { probe, calls } = controlledProbe();
	const monitor = createGitStatusMonitor("/repo", () => {}, probe);

	monitor.request();
	assert.equal(monitor.getDirty(), false);
	assert.equal(calls.length, 1);
});

test("monitor coalesces refreshes while a probe is running", () => {
	const { probe, calls } = controlledProbe();
	const monitor = createGitStatusMonitor("/repo", () => {}, probe);

	monitor.request();
	monitor.request();
	monitor.request();
	assert.equal(calls.length, 1);
	calls[0]?.complete(null, " M file");
	assert.equal(calls.length, 2);
	calls[1]?.complete(null, "");
	assert.equal(calls.length, 2);
	assert.equal(monitor.getDirty(), false);
});

test("monitor reports clean and dirty successful probe results", () => {
	const { probe, calls } = controlledProbe();
	const monitor = createGitStatusMonitor("/repo", () => {}, probe);

	monitor.request();
	calls[0]?.complete(null, "");
	assert.equal(monitor.getDirty(), false);
	monitor.request();
	calls[1]?.complete(null, "?? file");
	assert.equal(monitor.getDirty(), true);
});

test("monitor ignores an old cwd result and probes the new cwd", () => {
	const { probe, calls } = controlledProbe();
	const monitor = createGitStatusMonitor("/one", () => {}, probe);

	monitor.request();
	monitor.setCwd("/two");
	calls[0]?.complete(null, "?? stale");
	assert.equal(monitor.getDirty(), false);
	assert.equal(calls.length, 2);
	assert.equal(calls[1]?.cwd, "/two");
	calls[1]?.complete(null, "?? current");
	assert.equal(monitor.getDirty(), true);
});

test("monitor coalesces repeated cwd changes to one probe for the latest cwd", () => {
	const { probe, calls } = controlledProbe();
	const monitor = createGitStatusMonitor("/one", () => {}, probe);

	monitor.request();
	monitor.setCwd("/two");
	monitor.setCwd("/three");
	calls[0]?.complete(null, "?? stale");
	assert.equal(calls.length, 2);
	assert.equal(calls[1]?.cwd, "/three");
	calls[1]?.complete(null, "");
	assert.equal(calls.length, 2);
});

test("initial failures stay clean and later failures retain the last successful state", () => {
	const { probe, calls } = controlledProbe();
	const monitor = createGitStatusMonitor("/repo", () => {}, probe);

	monitor.request();
	calls[0]?.complete(new Error("timeout"), "");
	assert.equal(monitor.getDirty(), false);
	monitor.request();
	calls[1]?.complete(null, "?? file");
	monitor.request();
	calls[2]?.complete(new Error("timeout"), "");
	assert.equal(monitor.getDirty(), true);
});

test("monitor debounces consecutive lifecycle refreshes", async () => {
	const { probe, calls } = controlledProbe();
	const monitor = createGitStatusMonitor("/repo", () => {}, probe);

	monitor.requestDebounced();
	monitor.requestDebounced();
	await new Promise((resolve) => setTimeout(resolve, 125));
	assert.equal(calls.length, 1);
	calls[0]?.complete(null, "");
});

test("disposing a monitor discards its result and a replacement can refresh", () => {
	const first = controlledProbe();
	let changes = 0;
	const monitor = createGitStatusMonitor("/repo", () => changes++, first.probe);

	monitor.request();
	monitor.dispose();
	first.calls[0]?.complete(null, "?? ignored");
	assert.equal(changes, 0);
	assert.equal(monitor.getDirty(), false);

	const second = controlledProbe();
	const replacement = createGitStatusMonitor("/repo", () => changes++, second.probe);
	replacement.request();
	second.calls[0]?.complete(null, "?? file");
	assert.equal(changes, 1);
	assert.equal(replacement.getDirty(), true);
});

test("the production probe reads a temporary Git repository", async () => {
	const cwd = mkdtempSync(join(tmpdir(), "pi-footer-git-status-"));
	try {
		execFileSync("git", ["init", "--quiet"], { cwd });
		const clean = await new Promise<string>((resolve, reject) => {
			probeGitStatus(cwd, (error, output) => (error ? reject(error) : resolve(output)));
		});
		assert.equal(clean, "");

		writeFileSync(join(cwd, "dirty.txt"), "dirty\n");
		const dirty = await new Promise<string>((resolve, reject) => {
			probeGitStatus(cwd, (error, output) => (error ? reject(error) : resolve(output)));
		});
		assert.match(dirty, /dirty\.txt/);
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});
