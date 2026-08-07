import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
	CONFIG_ENTRY_TYPE,
	DEFAULT_CONFIG,
	type AutoTitleConfig,
	type ConfigStore,
	modelToRef,
	normalizeConfig,
	parseModelRef,
} from "./config.ts";
import {
	buildStartupSource,
	getConversationTranscript,
	hasAssistantMessage,
	type SessionEntry,
} from "./core.ts";
import type { TitleProvider } from "./provider.ts";
import type { AutoTitleUi, NotifyContext } from "./ui.ts";

function getSessionId(context: ExtensionContext): string | null {
	return context.sessionManager.getSessionId?.() ?? null;
}

export type SessionAutoTitleDependencies = {
	configStore: ConfigStore;
	provider: TitleProvider;
	ui: AutoTitleUi;
};

export function registerSessionAutoTitle(
	pi: ExtensionAPI,
	{ configStore, provider, ui }: SessionAutoTitleDependencies,
) {
	let config = configStore.read();
	let autoAttempted = false;
	let namingInProgress = false;

	function saveConfig(context: NotifyContext, nextConfig: AutoTitleConfig) {
		config = normalizeConfig(nextConfig);
		pi.appendEntry(CONFIG_ENTRY_TYPE, config);
		if (!configStore.write(config)) {
			ui.notify(context, "Auto-title config changed for this runtime, but failed to write config file.", "warning");
		}
	}

	async function setTitleFromSource(
		context: ExtensionContext,
		sourceLabel: string,
		sourceText: string,
		overwriteExisting: boolean,
		expectedSessionId: string | null,
	) {
		const currentName = pi.getSessionName();
		if (!overwriteExisting && currentName) return;
		if (overwriteExisting && !(await ui.confirmOverwrite(context, config, currentName))) return;
		const title = await provider.generate({
			context,
			config,
			sourceLabel,
			sourceText,
			startLoading: () => ui.startTitleLoading(pi, context, sourceLabel),
		});
		if (!title) return;
		if (!overwriteExisting && pi.getSessionName()) return;
		if (expectedSessionId !== null && expectedSessionId !== getSessionId(context)) return;
		pi.setSessionName(title);
		ui.notify(context, `Session titled: ${title}`, "info");
	}

	async function attemptAutoTitle(context: ExtensionContext) {
		if (!config.enabled || autoAttempted || namingInProgress) return;
		if (!config.auto.overwriteExisting && pi.getSessionName()) return;
		const branch = context.sessionManager.getBranch() as SessionEntry[];
		if (!hasAssistantMessage(branch)) return;
		const startupSource = buildStartupSource(branch, config.auto.startupSummaryMessages);
		if (!startupSource) return;

		autoAttempted = true;
		namingInProgress = true;
		const expectedSessionId = getSessionId(context);
		void (async () => {
			try {
				await setTitleFromSource(context, "Session history", startupSource, config.auto.overwriteExisting, expectedSessionId);
			} catch {
				// Title generation errors must never surface into the agent loop.
			} finally {
				namingInProgress = false;
			}
		})();
	}

	pi.registerCommand("auto-title", {
		description: "Auto-title sessions with a configured LLM",
		handler: async (args, context) => {
			const [command, ...rest] = args.trim().split(/\s+/).filter(Boolean);
			const value = rest.join(" ");

			if (!command) {
				const startupSource = buildStartupSource(
					context.sessionManager.getBranch() as SessionEntry[],
					config.auto.startupSummaryMessages,
				);
				if (!startupSource) {
					ui.notify(context, "No user or assistant messages available to title this session.", "warning");
					return;
				}
				await setTitleFromSource(context, "Session history", startupSource, true, null);
				return;
			}

			if (command === "history") {
				const transcript = getConversationTranscript(context.sessionManager.getBranch() as SessionEntry[]);
				if (!transcript) {
					ui.notify(context, "No user or assistant messages available to title this session.", "warning");
					return;
				}
				await setTitleFromSource(context, "Conversation transcript", transcript, true, null);
				return;
			}

			if (command === "show") {
				ui.notify(
					context,
					`Auto-title ${config.enabled ? "enabled" : "disabled"}; model=${modelToRef(config.model)}; session=${
						pi.getSessionName() ?? "unnamed"
					}`,
					"info",
				);
				return;
			}

			if (command === "model") {
				if (value) {
					const parsed = parseModelRef(value);
					if (!parsed) {
						ui.notify(
							context,
							"Usage: /auto-title model provider/model[:off|minimal|low|medium|high|xhigh]",
							"warning",
						);
						return;
					}
					if (!(await provider.ensureAvailable(context, parsed))) return;
					saveConfig(context, {
						...config,
						model: { ...parsed, reasoning: parsed.reasoning ?? config.model.reasoning },
					});
					ui.notify(context, `Auto-title model set to ${modelToRef(config.model)}`, "info");
					return;
				}

				const selected = await ui.selectModelConfig(context, config.model);
				if (!selected) return;
				saveConfig(context, { ...config, model: selected });
				ui.notify(context, `Auto-title model set to ${modelToRef(config.model)}`, "info");
				return;
			}

			if (command === "enable") {
				saveConfig(context, { ...config, enabled: true });
				ui.notify(context, "Auto-title enabled.", "info");
				return;
			}

			if (command === "disable") {
				saveConfig(context, { ...config, enabled: false });
				ui.notify(context, "Auto-title disabled.", "info");
				return;
			}

			if (command === "reset") {
				saveConfig(context, normalizeConfig(DEFAULT_CONFIG));
				ui.notify(context, `Auto-title config reset. Model=${modelToRef(config.model)}`, "info");
				return;
			}

			if (command === "help") {
				ui.notify(
					context,
					"Usage: /auto-title [history|show|model [provider/model:reasoning]|enable|disable|reset|help]",
					"info",
				);
				return;
			}

			ui.notify(context, "Unknown /auto-title command. Use /auto-title help.", "warning");
		},
	});

	pi.on("session_start", async () => {
		config = configStore.read();
		autoAttempted = false;
		namingInProgress = false;
	});

	pi.on("message_end", (_event, context) => {
		void attemptAutoTitle(context);
	});

	pi.on("agent_end", (_event, context) => {
		void attemptAutoTitle(context);
	});
}
