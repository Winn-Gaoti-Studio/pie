import type { UserMessage } from "@earendil-works/pi-ai";
import type { AutoTitleConfig } from "./config.ts";

export const SYSTEM_PROMPT = "You create concise, descriptive session titles for coding-agent chat sessions.";

type SessionMessageContent = string | Array<{ type: string; text?: string }>;

export type SessionEntry = {
	type: string;
	message?: {
		role?: string;
		content?: SessionMessageContent;
	};
};

export function truncateMiddle(text: string, maxChars: number): string {
	if (text.length <= maxChars) return text;
	if (maxChars <= 1) return text.slice(0, maxChars);
	const headLength = Math.ceil((maxChars - 1) * 0.6);
	const tailLength = maxChars - 1 - headLength;
	return `${text.slice(0, headLength).trimEnd()}…${text.slice(text.length - tailLength).trimStart()}`;
}

export function buildPromptInput(text: string, maxChars: number): string {
	return truncateMiddle(text.trim(), maxChars);
}

export function sanitizeTitle(raw: string, maxLength: number): string {
	const firstLine = raw
		.split(/\r?\n/)
		.map((line) => line.trim())
		.find(Boolean);
	if (!firstLine) return "";

	let title = firstLine.replace(/^["'`]+|["'`]+$/g, "");
	title = title.replace(/\s+/g, " ").trim();
	title = title.replace(/[.!?:;]+$/g, "");
	return title.length > maxLength ? title.slice(0, maxLength).trimEnd() : title;
}

function extractText(content: SessionMessageContent | undefined): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.filter((block) => block.type === "text" && typeof block.text === "string")
		.map((block) => block.text)
		.join("\n");
}

function getOrderedBranch(entries: SessionEntry[]): SessionEntry[] {
	return [...entries].reverse();
}

export function getFirstUserMessageText(entries: SessionEntry[]): string | null {
	for (const entry of getOrderedBranch(entries)) {
		if (entry.type !== "message") continue;
		if (entry.message?.role !== "user") continue;
		const text = extractText(entry.message.content).trim();
		if (text) return text;
	}
	return null;
}

export function hasAssistantMessage(entries: SessionEntry[]): boolean {
	return entries.some((entry) => entry.type === "message" && entry.message?.role === "assistant");
}

function getConversationMessages(entries: SessionEntry[]): string[] {
	const lines: string[] = [];
	for (const entry of getOrderedBranch(entries)) {
		if (entry.type !== "message") continue;
		const role = entry.message?.role;
		if (role !== "user" && role !== "assistant") continue;
		const text = extractText(entry.message.content).trim();
		if (!text) continue;
		lines.push(`${role === "user" ? "User" : "Assistant"}: ${text}`);
	}
	return lines;
}

export function getConversationTranscript(entries: SessionEntry[]): string {
	return getConversationMessages(entries).join("\n\n");
}

export function buildStartupSource(entries: SessionEntry[], maxMessages: number): string {
	const messages = getConversationMessages(entries);
	if (maxMessages <= 0) return messages.join("\n\n");
	return messages.slice(Math.max(0, messages.length - maxMessages)).join("\n\n");
}

export function shouldConfirmOverwrite(currentName: string | undefined, confirmOverwrite: boolean): boolean {
	return Boolean(currentName && confirmOverwrite);
}

export function buildTitleInstructions(config: AutoTitleConfig, sourceLabel: string): string {
	const languageInstruction =
		config.title.language === "auto"
			? "Use the user's language when it is clear; otherwise use English."
			: `Write the title in ${config.title.language}.`;
	const caseInstruction = config.title.titleCase ? "Use Title Case." : "Use natural sentence casing.";
	const emojiInstruction = config.title.allowEmoji ? "Emoji are allowed only if useful." : "Do not use emoji.";

	return [
		`Create a short, descriptive title for this session from the ${sourceLabel}.`,
		"First infer a concise internal summary of the durable user goal, then title that summary.",
		"Prefer the original task goal over transient debugging messages, warnings, or command output.",
		"Use 2-6 words.",
		caseInstruction,
		languageInstruction,
		emojiInstruction,
		"Return only the title. Do not include quotes, punctuation, explanations, or markdown.",
	].join(" ");
}

export function buildUserMessage(config: AutoTitleConfig, sourceLabel: string, sourceText: string): UserMessage {
	return {
		role: "user",
		content: [
			{
				type: "text",
				text: `${buildTitleInstructions(config, sourceLabel)}\n\n${sourceLabel}:\n${buildPromptInput(
					sourceText,
					config.title.maxInputChars,
				)}`,
			},
		],
		timestamp: Date.now(),
	};
}
