import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_CONFIG, normalizeConfig } from "../../agent/extensions/session-auto-title/config.ts";
import { registerSessionAutoTitle } from "../../agent/extensions/session-auto-title/controller.ts";

type Handler = (...args: any[]) => Promise<void> | void;

function createHarness() {
	const commands = new Map<string, { description?: string; handler: Handler }>();
	const events = new Map<string, Handler>();
	const appended: Array<[string, unknown]> = [];
	const notifications: Array<[string, string]> = [];
	const writes: unknown[] = [];
	const generatedSources: Array<[string, string]> = [];
	const availabilityChecks: string[] = [];
	let currentName: string | undefined;
	let sessionId = "session-1";
	let readCount = 0;
	let generateResult: string | null = "Generated Title";
	let config = normalizeConfig(DEFAULT_CONFIG);
	const branch = [
		{ type: "message", message: { role: "assistant", content: "Answer" } },
		{ type: "message", message: { role: "user", content: "Question" } },
	];
	const context = {
		hasUI: true,
		modelRegistry: { find: () => ({ provider: "openai", id: "gpt-5.5" }) },
		sessionManager: { getBranch: () => branch, getSessionId: () => sessionId },
		ui: { notify: () => undefined },
	};
	const pi = {
		appendEntry: (type: string, data: unknown) => appended.push([type, data]),
		getSessionName: () => currentName,
		on: (name: string, handler: Handler) => events.set(name, handler),
		registerCommand: (name: string, options: { description?: string; handler: Handler }) => commands.set(name, options),
		setSessionName: (name: string) => {
			currentName = name;
		},
	};
	const configStore = {
		read: () => {
			readCount += 1;
			return config;
		},
		write: (next: unknown) => {
			writes.push(next);
			config = normalizeConfig(next);
			return true;
		},
	};
	let generateImpl: (input: { sourceLabel: string; sourceText: string }) => Promise<string | null> = async ({
		sourceLabel,
		sourceText,
	}) => {
		generatedSources.push([sourceLabel, sourceText]);
		return generateResult;
	};
	const provider = {
		ensureAvailable: async (_context: unknown, model: { provider: string; id: string }) => {
			availabilityChecks.push(`${model.provider}/${model.id}`);
			return true;
		},
		generate: async (input: { sourceLabel: string; sourceText: string }) => generateImpl(input),
	};
	const ui = {
		confirmOverwrite: async () => true,
		notify: (_context: unknown, message: string, level: string) => notifications.push([message, level]),
		selectModelConfig: async () => null,
		startTitleLoading: () => () => undefined,
	};

	registerSessionAutoTitle(pi as never, { configStore, provider, ui } as never);

	return {
		appended,
		availabilityChecks,
		commands,
		context,
		events,
		generatedSources,
		getCurrentName: () => currentName,
		getReadCount: () => readCount,
		notifications,
		setConfig: (next: unknown) => {
			config = normalizeConfig(next);
		},
		setCurrentName: (name: string | undefined) => {
			currentName = name;
		},
		setGenerateImpl: (fn: typeof generateImpl) => {
			generateImpl = fn;
		},
		setGenerateResult: (value: string | null) => {
			generateResult = value;
		},
		setSessionId: (name: string) => {
			sessionId = name;
		},
		writes,
	};
}

test("registers the existing command and lifecycle events", () => {
	const harness = createHarness();
	assert.equal(harness.commands.get("auto-title")?.description, "Auto-title sessions with a configured LLM");
	assert.deepEqual([...harness.events.keys()], ["session_start", "message_end", "agent_end"]);
});

test("session start only reloads config and resets the one-attempt state", async () => {
	const harness = createHarness();
	const sessionStart = harness.events.get("session_start")!;
	const messageEnd = harness.events.get("message_end")!;
	const agentEnd = harness.events.get("agent_end")!;

	await sessionStart({ reason: "startup" }, harness.context);
	assert.equal(harness.getCurrentName(), undefined);
	assert.equal(harness.generatedSources.length, 0);
	assert.equal(harness.getReadCount(), 2);

	await messageEnd({}, harness.context);
	await new Promise((resolve) => setImmediate(resolve));
	await agentEnd({}, harness.context);
	await new Promise((resolve) => setImmediate(resolve));
	assert.deepEqual(harness.generatedSources, [["Session history", "User: Question\n\nAssistant: Answer"]]);
	assert.equal(harness.getCurrentName(), "Generated Title");

	harness.setCurrentName(undefined);
	await sessionStart({ reason: "new" }, harness.context);
	await messageEnd({}, harness.context);
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(harness.generatedSources.length, 2);
});

test("does not retry automatic naming after a generation failure", async () => {
	const harness = createHarness();
	harness.setGenerateResult(null);
	await harness.events.get("message_end")!({}, harness.context);
	await new Promise((resolve) => setImmediate(resolve));
	await harness.events.get("agent_end")!({}, harness.context);
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(harness.generatedSources.length, 1);
	assert.equal(harness.getCurrentName(), undefined);
});

test("preserves show, model, enable, disable, reset, help, and unknown command responses", async () => {
	const harness = createHarness();
	const command = harness.commands.get("auto-title")!.handler;

	await command("show", harness.context);
	await command("model test/title-model:high", harness.context);
	await command("disable", harness.context);
	await command("enable", harness.context);
	await command("reset", harness.context);
	await command("help", harness.context);
	await command("unknown", harness.context);

	assert.deepEqual(
		harness.notifications.map(([message]) => message),
		[
			"Auto-title enabled; model=openai/gpt-5.5:low; session=unnamed",
			"Auto-title model set to test/title-model:high",
			"Auto-title disabled.",
			"Auto-title enabled.",
			"Auto-title config reset. Model=openai/gpt-5.5:low",
			"Usage: /auto-title [history|show|model [provider/model:reasoning]|enable|disable|reset|help]",
			"Unknown /auto-title command. Use /auto-title help.",
		],
	);
	assert.equal(harness.writes.length, 4);
	assert.equal(harness.appended.length, 4);
	assert.deepEqual(harness.availabilityChecks, ["test/title-model"]);
});

test("preserves default and history command source labels", async () => {
	const harness = createHarness();
	const command = harness.commands.get("auto-title")!.handler;

	await command("", harness.context);
	await command("history", harness.context);

	assert.deepEqual(harness.generatedSources, [
		["Session history", "User: Question\n\nAssistant: Answer"],
		["Conversation transcript", "User: Question\n\nAssistant: Answer"],
	]);
});

test("handlers do not await title generation", async () => {
	const harness = createHarness();
	harness.setGenerateImpl(() => new Promise<string | null>(() => {}));
	const handler = harness.events.get("message_end")!;
	const handlerResult = handler({}, harness.context);
	const winner = await Promise.race([
		Promise.resolve(handlerResult).then(() => "resolved"),
		new Promise<string>((r) => setTimeout(() => r("pending"), 50)),
	]);
	assert.equal(winner, "resolved");
});

test("skips setting the session name when the session changed during generation", async () => {
	const harness = createHarness();
	let release: (value: string | null) => void = () => {};
	harness.setGenerateImpl(
		() => new Promise<string | null>((resolve) => { release = resolve; }),
	);
	await harness.events.get("message_end")!({}, harness.context);
	harness.setSessionId("session-2");
	release("Title");
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(harness.getCurrentName(), undefined);
});
