import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { ThinkingLevel } from "@earendil-works/pi-ai";

export const CONFIG_FILE_PATH = join(homedir(), ".pi", "agent", "extensions", "session-auto-title.json");
export const CONFIG_ENTRY_TYPE = "session-auto-title-config";

const MAX_REASONABLE_TITLE_LENGTH = 160;
const MAX_REASONABLE_INPUT_CHARS = 20_000;
const MAX_REASONABLE_OUTPUT_TOKENS = 4096;
const MAX_REASONABLE_TIMEOUT_MS = 120_000;

export type ModelConfig = {
	provider: string;
	id: string;
	reasoning?: ThinkingLevel;
};

export type AutoTitleConfig = {
	enabled: boolean;
	model: ModelConfig;
	auto: {
		trigger: "after-first-assistant";
		overwriteExisting: boolean;
		confirmOverwrite: boolean;
		startupSummaryMessages: number;
	};
	title: {
		maxLength: number;
		maxInputChars: number;
		maxOutputTokens: number;
		timeoutMs: number;
		language: string;
		titleCase: boolean;
		allowEmoji: boolean;
	};
};

export type ConfigStore = {
	read: () => AutoTitleConfig;
	write: (config: AutoTitleConfig) => boolean;
};

export const DEFAULT_CONFIG: AutoTitleConfig = {
	enabled: true,
	model: {
		provider: "openai",
		id: "gpt-5.5",
		reasoning: "low",
	},
	auto: {
		trigger: "after-first-assistant",
		overwriteExisting: false,
		confirmOverwrite: true,
		startupSummaryMessages: 0,
	},
	title: {
		maxLength: 80,
		maxInputChars: 2000,
		maxOutputTokens: 1024,
		timeoutMs: 15_000,
		language: "auto",
		titleCase: true,
		allowEmoji: false,
	},
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === "boolean" ? value : fallback;
}

function normalizePositiveInteger(value: unknown, fallback: number, max: number): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	const integer = Math.floor(value);
	if (integer <= 0) return fallback;
	return Math.min(integer, max);
}

function normalizeNonNegativeInteger(value: unknown, fallback: number, max: number): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	const integer = Math.floor(value);
	if (integer < 0) return fallback;
	return Math.min(integer, max);
}

function normalizeString(value: unknown, fallback: string): string {
	return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeReasoning(value: unknown): ThinkingLevel | undefined {
	if (typeof value !== "string") return undefined;
	const normalized = value.trim().toLowerCase();
	if (normalized === "light") return "low";
	if (
		normalized === "off" ||
		normalized === "minimal" ||
		normalized === "low" ||
		normalized === "medium" ||
		normalized === "high" ||
		normalized === "xhigh"
	) {
		return normalized as ThinkingLevel;
	}
	return undefined;
}

export function parseModelRef(value: string): ModelConfig | null {
	const input = value.trim();
	const slashIndex = input.indexOf("/");
	if (slashIndex <= 0 || slashIndex === input.length - 1) return null;

	const provider = input.slice(0, slashIndex).trim();
	const modelAndReasoning = input.slice(slashIndex + 1).trim();
	const colonIndex = modelAndReasoning.lastIndexOf(":");
	const id = (colonIndex > 0 ? modelAndReasoning.slice(0, colonIndex) : modelAndReasoning).trim();
	const reasoning = colonIndex > 0 ? normalizeReasoning(modelAndReasoning.slice(colonIndex + 1)) : undefined;

	if (!provider || !id) return null;
	return reasoning ? { provider, id, reasoning } : { provider, id };
}

export function modelToRef(model: ModelConfig): string {
	return `${model.provider}/${model.id}${model.reasoning ? `:${model.reasoning}` : ""}`;
}

export function normalizeConfig(data: unknown): AutoTitleConfig {
	const root = isRecord(data) ? data : {};
	const model = isRecord(root.model) ? root.model : {};
	const auto = isRecord(root.auto) ? root.auto : {};
	const title = isRecord(root.title) ? root.title : {};
	const reasoning = normalizeReasoning(model.reasoning) ?? DEFAULT_CONFIG.model.reasoning;

	return {
		enabled: normalizeBoolean(root.enabled, DEFAULT_CONFIG.enabled),
		model: {
			provider: normalizeString(model.provider, DEFAULT_CONFIG.model.provider),
			id: normalizeString(model.id, DEFAULT_CONFIG.model.id),
			reasoning,
		},
		auto: {
			trigger: DEFAULT_CONFIG.auto.trigger,
			overwriteExisting: normalizeBoolean(auto.overwriteExisting, DEFAULT_CONFIG.auto.overwriteExisting),
			confirmOverwrite: normalizeBoolean(auto.confirmOverwrite, DEFAULT_CONFIG.auto.confirmOverwrite),
			startupSummaryMessages: normalizeNonNegativeInteger(
				auto.startupSummaryMessages,
				DEFAULT_CONFIG.auto.startupSummaryMessages,
				50,
			),
		},
		title: {
			maxLength: normalizePositiveInteger(title.maxLength, DEFAULT_CONFIG.title.maxLength, MAX_REASONABLE_TITLE_LENGTH),
			maxInputChars: normalizePositiveInteger(
				title.maxInputChars,
				DEFAULT_CONFIG.title.maxInputChars,
				MAX_REASONABLE_INPUT_CHARS,
			),
			maxOutputTokens: normalizePositiveInteger(
				title.maxOutputTokens,
				DEFAULT_CONFIG.title.maxOutputTokens,
				MAX_REASONABLE_OUTPUT_TOKENS,
			),
			timeoutMs: normalizePositiveInteger(title.timeoutMs, DEFAULT_CONFIG.title.timeoutMs, MAX_REASONABLE_TIMEOUT_MS),
			language: normalizeString(title.language, DEFAULT_CONFIG.title.language),
			titleCase: normalizeBoolean(title.titleCase, DEFAULT_CONFIG.title.titleCase),
			allowEmoji: normalizeBoolean(title.allowEmoji, DEFAULT_CONFIG.title.allowEmoji),
		},
	};
}

export function createConfigStore(filePath = CONFIG_FILE_PATH): ConfigStore {
	return {
		read() {
			try {
				return normalizeConfig(JSON.parse(readFileSync(filePath, "utf8")));
			} catch {
				return normalizeConfig(DEFAULT_CONFIG);
			}
		},
		write(config) {
			try {
				mkdirSync(dirname(filePath), { recursive: true });
				writeFileSync(filePath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
				return true;
			} catch {
				return false;
			}
		},
	};
}
