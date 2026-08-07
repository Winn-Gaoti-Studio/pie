/**
 * CC-style Statusline — mimics Claude Code's statusline layout.
 *
 * Layout:
 *   project[*] prefixes the footer; * marks git changes in the current cwd.
 *   🌿 branch  ·  provider:model  ·  effort[:current [available]]  ↑ input ↓ output  $cost
 *
 * Uses ctx.ui.setFooter() to replace Pi's built-in footer.
 * Token usage is accumulated across the session's assistant messages.
 * Git branch is detected via footerData.getGitBranch().
 *
 * Usage:
 *   pi -e .pi/extensions/starship-statusline.ts
 * Or add to .pi/settings.json:
 *   { "extensions": ["starship-statusline.ts"] }
 *
 * Commands:
 *   /footer  — toggle between CC-style and built-in footer
 */

import {
	type AssistantMessage,
	getSupportedThinkingLevels,
	type ModelThinkingLevel,
} from "@earendil-works/pi-ai";
import { basename } from "node:path";
import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { createGitStatusMonitor, type GitStatusMonitor } from "./lib/git-status-monitor.ts";

// ---- helpers ----

/** 12345 → "12.3k", 1234567 → "1.2m" */
function fmtTokens(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
	return `${n}`;
}

function fmtCost(cost: number): string {
	if (cost < 0.001) return "$0";
	if (cost < 1) return `$${cost.toFixed(3)}`;
	return `$${cost.toFixed(2)}`;
}

function fmtProject(cwd: string): string {
	return basename(cwd) || cwd;
}

function computeUsage(ctx: ExtensionContext) {
	let input = 0;
	let output = 0;
	let cost = 0;
	for (const e of ctx.sessionManager.getBranch()) {
		if (e.type === "message" && e.message.role === "assistant") {
			const m = e.message as AssistantMessage;
			input += m.usage.input;
			output += m.usage.output;
			cost += m.usage.cost.total;
		}
	}
	return { input, output, cost };
}

const THINKING_LABELS: Record<ModelThinkingLevel, string> = {
	off: "off",
	minimal: "min",
	low: "low",
	medium: "med",
	high: "high",
	xhigh: "xhigh",
};

function fmtThinkingLevel(level: ModelThinkingLevel): string {
	return THINKING_LABELS[level];
}

function fmtThinkingEffort(
	model: ExtensionContext["model"],
	level: ModelThinkingLevel
): string {
	const mapped = model?.thinkingLevelMap?.[level];
	const label = fmtThinkingLevel(level);

	if (mapped === undefined || mapped === null || mapped === level) {
		return label;
	}

	return `${label}=${mapped}`;
}

function fmtThinkingStatus(
	model: ExtensionContext["model"],
	level: ModelThinkingLevel,
	showList = true
): string {
	const levels = model ? getSupportedThinkingLevels(model) : [level];
	const effort = fmtThinkingEffort(model, level);
	if (!showList || levels.length <= 1) return `effort:${effort}`;

	const list = levels
		.map((option) => fmtThinkingEffort(model, option))
		.join("/");
	return `effort:${effort} [${list}]`;
}

// ---- main ----

export type StarshipStatuslineDeps = {
	createGitStatusMonitor?: typeof createGitStatusMonitor;
};

export default function (pi: ExtensionAPI, deps: StarshipStatuslineDeps = {}) {
	let installed = false;
	/** TUI handle to request re-renders from outside the footer factory. */
	let requestRender: (() => void) | null = null;
	let gitStatusMonitor: GitStatusMonitor | null = null;
	const makeGitStatusMonitor = deps.createGitStatusMonitor ?? createGitStatusMonitor;

	function install(ctx: ExtensionContext) {
		installed = true;
		requestRender = null;
		gitStatusMonitor?.dispose();
		const monitor = makeGitStatusMonitor(
			ctx.sessionManager.getCwd(),
			() => requestRender?.()
		);
		gitStatusMonitor = monitor;
		monitor.request();

		ctx.ui.setFooter((tui, theme, footerData) => {
			// Capture TUI for external re-render triggers
			requestRender = () => tui.requestRender();

			const unsubBranch = footerData.onBranchChange(() => {
				monitor.request();
				tui.requestRender();
			});

			return {
				dispose() {
					unsubBranch();
					monitor.dispose();
					if (gitStatusMonitor === monitor) {
						gitStatusMonitor = null;
						requestRender = null;
					}
				},
				invalidate() {
					/* theme hot-reload handled by TUI */
				},
				render(width: number): string[] {
					const provider = ctx.model?.provider ?? "?";
					const modelId = ctx.model?.id ?? "none";
					const branch = footerData.getGitBranch();
					const cwd = ctx.sessionManager.getCwd();
					const project = fmtProject(cwd);
					monitor.setCwd(cwd);
					const dirty = monitor.getDirty();
					const thinking = pi.getThinkingLevel() as ModelThinkingLevel;
					const { input, output, cost } = computeUsage(ctx);

					// --- right ---
					const right = [
						theme.fg("dim", `↑ ${fmtTokens(input)}`),
						theme.fg("dim", `↓ ${fmtTokens(output)}`),
						theme.fg("warning", fmtCost(cost)),
					].join(" ");
					const vRight = visibleWidth(right);

					// --- left ---
					const buildLeft = (thinkingStatus: string): string => {
						const leftParts: string[] = [];
						leftParts.push(
							theme.fg(dirty ? "warning" : "dim", `${project}${dirty ? "*" : ""}`)
						);
						if (branch) {
							leftParts.push(theme.fg("success", `🌿 ${branch}`));
						}
						leftParts.push(theme.fg("accent", `${provider}:${modelId}`));
						leftParts.push(theme.fg("muted", thinkingStatus));
						return leftParts.join(theme.fg("dim", " · "));
					};

					let left = buildLeft(fmtThinkingStatus(ctx.model, thinking));
					if (visibleWidth(left) + 1 + vRight > width) {
						left = buildLeft(fmtThinkingStatus(ctx.model, thinking, false));
					}

					// --- layout ---
					const vLeft = visibleWidth(left);
					const pad = " ".repeat(Math.max(1, width - vLeft - vRight));

					return [truncateToWidth(left + pad + right, width)];
				},
			};
		});
	}

	// ---- lifecycle ----

	pi.on("session_start", async (_event, ctx) => {
		if (!installed) install(ctx);
	});

	// Re-render on relevant changes
	pi.on("model_select", () => requestRender?.());
	pi.on("thinking_level_select", () => requestRender?.());
	pi.on("turn_end", () => {
		gitStatusMonitor?.requestDebounced();
		requestRender?.();
	});
	pi.on("agent_end", () => {
		gitStatusMonitor?.requestDebounced();
		requestRender?.();
	});

	// ---- /footer toggle ----

	pi.registerCommand("footer", {
		description: "Toggle CC-style statusline",
		handler: async (_args, ctx) => {
			if (installed) {
				installed = false;
				gitStatusMonitor?.dispose();
				gitStatusMonitor = null;
				ctx.ui.setFooter(undefined);
				requestRender = null;
				ctx.ui.notify("Default footer restored", "info");
			} else {
				install(ctx);
				ctx.ui.notify("CC-style statusline enabled", "info");
			}
		},
	});
}
