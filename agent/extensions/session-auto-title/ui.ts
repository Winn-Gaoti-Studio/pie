import { basename } from "node:path";
import { DynamicBorder, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Container, type Component, Input, type SelectItem, SelectList, Text, type TUI } from "@earendil-works/pi-tui";
import type { AutoTitleConfig, ModelConfig } from "./config.ts";
import { modelToRef, parseModelRef } from "./config.ts";
import { shouldConfirmOverwrite } from "./core.ts";

const STATUS_KEY = "session-auto-title";
const WIDGET_KEY = "session-auto-title-loading";
const LOADING_INTERVAL_MS = 120;
const LOADING_FRAMES = ["✦", "✧", "⋆", "✶", "✺", "✶", "⋆", "✧"];

export type NotifyContext = Pick<ExtensionContext, "hasUI" | "ui">;

export type AutoTitleUi = {
	notify: (context: NotifyContext, message: string, level: "info" | "warning" | "error") => void;
	confirmOverwrite: (
		context: ExtensionContext,
		config: AutoTitleConfig,
		currentName: string | undefined,
	) => Promise<boolean>;
	startTitleLoading: (pi: ExtensionAPI, context: ExtensionContext, sourceLabel: string) => () => void;
	selectModelConfig: (context: ExtensionContext, currentModel: ModelConfig) => Promise<ModelConfig | null>;
};

export function notify(context: NotifyContext, message: string, level: "info" | "warning" | "error") {
	if (context.hasUI) context.ui.notify(message, level);
}

export function getLoadingMessage(sourceLabel: string): string {
	return `Auto-title: generating title from ${sourceLabel}...`;
}

export function getLoadingIndicatorFrame(index: number): string {
	return LOADING_FRAMES[index % LOADING_FRAMES.length]!;
}

export function getAnimatedLoadingMessage(sourceLabel: string, frameIndex: number): string {
	return `${getLoadingIndicatorFrame(frameIndex)} ${getLoadingMessage(sourceLabel)}`;
}

export function getLoadingWidgetLine(sourceLabel: string, frameIndex: number): string {
	return getAnimatedLoadingMessage(sourceLabel, frameIndex);
}

async function confirmOverwrite(
	context: ExtensionContext,
	config: AutoTitleConfig,
	currentName: string | undefined,
) {
	if (!shouldConfirmOverwrite(currentName, config.auto.confirmOverwrite)) return true;
	if (!context.hasUI) {
		notify(
			context,
			`Session already has a name (${currentName}). Skipping auto-title overwrite without interactive confirmation.`,
			"warning",
		);
		return false;
	}
	return context.ui.confirm(
		"Overwrite session name?",
		`This will summarize the existing session and replace \"${currentName}\". Continue?`,
	);
}

function getBaseTerminalTitle(pi: ExtensionAPI): string {
	const cwd = basename(process.cwd());
	const session = pi.getSessionName();
	return session ? `π - ${session} - ${cwd}` : `π - ${cwd}`;
}

function startTitleLoading(pi: ExtensionAPI, context: ExtensionContext, sourceLabel: string): () => void {
	let frameIndex = 0;
	let activeTui: TUI | null = null;
	let disposed = false;

	class AutoTitleLoadingWidget implements Component {
		render(): string[] {
			const message = getLoadingWidgetLine(sourceLabel, frameIndex);
			return [context.ui.theme.fg("accent", message)];
		}

		dispose(): void {
			disposed = true;
		}
	}

	context.ui.setWidget(
		WIDGET_KEY,
		(tui) => {
			activeTui = tui;
			return new AutoTitleLoadingWidget();
		},
		{ placement: "aboveEditor" },
	);

	const render = () => {
		if (disposed) return;
		const message = getAnimatedLoadingMessage(sourceLabel, frameIndex);
		context.ui.setStatus(STATUS_KEY, context.ui.theme.fg("accent", message));
		context.ui.setTitle(`${getLoadingIndicatorFrame(frameIndex)} ${getBaseTerminalTitle(pi)}`);
		frameIndex += 1;
		activeTui?.requestRender();
	};

	render();
	const interval = setInterval(render, LOADING_INTERVAL_MS);
	return () => {
		clearInterval(interval);
		disposed = true;
		context.ui.setWidget(WIDGET_KEY, undefined);
		context.ui.setStatus(STATUS_KEY, undefined);
		context.ui.setTitle(getBaseTerminalTitle(pi));
	};
}

async function selectModelConfig(context: ExtensionContext, currentModel: ModelConfig): Promise<ModelConfig | null> {
	if (!context.hasUI) {
		notify(context, "No interactive UI available. Use /auto-title model provider/model:reasoning.", "warning");
		return null;
	}

	const availableModels = context.modelRegistry
		.getAvailable()
		.map((model) => ({ provider: model.provider, id: model.id, reasoning: currentModel.reasoning }))
		.sort((a, b) => modelToRef(a).localeCompare(modelToRef(b)));

	if (availableModels.length === 0) {
		notify(context, "No models with configured auth are available.", "warning");
		return null;
	}

	return context.ui.custom<ModelConfig | null>((tui, theme, keybindings, done) => {
		const container = new Container();
		container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));
		container.addChild(new Text(theme.fg("accent", theme.bold("Select Auto-Title Model"))));
		container.addChild(new Text(theme.fg("muted", `Current: ${modelToRef(currentModel)}`)));
		container.addChild(new Text(theme.fg("muted", "Search:")));

		const searchInput = new Input();
		container.addChild(searchInput);
		const listContainer = new Container();
		container.addChild(listContainer);
		let selectList: SelectList;
		let lastSelectedRef = `${currentModel.provider}/${currentModel.id}`;

		const matches = (model: ModelConfig, query: string) => {
			const q = query.toLowerCase();
			const ref = `${model.provider}/${model.id}`.toLowerCase();
			return !q || ref.includes(q) || model.provider.toLowerCase().includes(q) || model.id.toLowerCase().includes(q);
		};

		const buildItems = (query: string): SelectItem[] =>
			availableModels.filter((model) => matches(model, query)).map((model) => ({
				value: `${model.provider}/${model.id}`,
				label: model.id,
				description: model.provider,
			}));

		const rebuildList = () => {
			const items = buildItems(searchInput.getValue().trim());
			selectList = new SelectList(items, 10, {
				selectedPrefix: (text) => theme.fg("accent", text),
				selectedText: (text) => theme.fg("accent", text),
				description: (text) => theme.fg("muted", text),
				scrollInfo: (text) => theme.fg("dim", text),
				noMatch: (text) => theme.fg("warning", text),
			});
			selectList.onSelect = (item) => {
				const parsed = parseModelRef(`${item.value}${currentModel.reasoning ? `:${currentModel.reasoning}` : ""}`);
				done(parsed);
			};
			selectList.onCancel = () => done(null);
			selectList.onSelectionChange = (item) => {
				lastSelectedRef = item.value;
			};
			const selectedIndex = items.findIndex((item) => item.value === lastSelectedRef);
			if (selectedIndex >= 0) selectList.setSelectedIndex(selectedIndex);
			listContainer.clear();
			listContainer.addChild(selectList);
		};

		rebuildList();
		container.addChild(new Text(theme.fg("dim", "type to search • ↑↓ navigate • enter select • esc cancel")));
		container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));

		return {
			render(width: number) {
				return container.render(width);
			},
			invalidate() {
				container.invalidate();
			},
			handleInput(data: string) {
				if (
					keybindings.matches(data, "tui.select.up") ||
					keybindings.matches(data, "tui.select.down") ||
					keybindings.matches(data, "tui.select.confirm") ||
					keybindings.matches(data, "tui.select.cancel")
				) {
					selectList.handleInput(data);
				} else {
					searchInput.handleInput(data);
					rebuildList();
				}
				tui.requestRender();
			},
		};
	});
}

export const autoTitleUi: AutoTitleUi = {
	notify,
	confirmOverwrite,
	startTitleLoading,
	selectModelConfig,
};
