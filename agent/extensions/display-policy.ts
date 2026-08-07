import {
	createBashToolDefinition,
	createEditToolDefinition,
	createFindToolDefinition,
	createGrepToolDefinition,
	createLsToolDefinition,
	createReadToolDefinition,
	createWriteToolDefinition,
	type ExtensionAPI,
	type ExtensionContext,
	type ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { Container, Text } from "@earendil-works/pi-tui";

type AnyToolDefinition = ToolDefinition<any, any, any>;
type Theme = Parameters<NonNullable<AnyToolDefinition["renderCall"]>>[1];
type ToolRenderContext = Parameters<NonNullable<AnyToolDefinition["renderCall"]>>[2];
type ToolRenderResultOptions = Parameters<NonNullable<AnyToolDefinition["renderResult"]>>[1];
type ToolRenderResult = Parameters<NonNullable<AnyToolDefinition["renderResult"]>>[0];

const maxTargetLength = 120;

function applyDisplayPolicy(ctx: ExtensionContext): void {
	if (ctx.mode !== "tui") return;

	ctx.ui.setToolsExpanded(false);
}

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function stringArg(args: Record<string, unknown>, name: string): string | undefined {
	const value = args[name];
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function compact(text: string): string {
	const singleLine = text.replace(/\s+/g, " ").trim();
	if (singleLine.length <= maxTargetLength) return singleLine;
	return `${singleLine.slice(0, maxTargetLength - 1)}…`;
}

function getToolTarget(toolName: string, args: unknown): string | undefined {
	const input = asRecord(args);
	const path = stringArg(input, "path") ?? stringArg(input, "file_path");

	switch (toolName) {
		case "bash": {
			const command = stringArg(input, "command");
			return command ? compact(command) : undefined;
		}
		case "grep": {
			const pattern = stringArg(input, "pattern");
			const scope = path ? ` in ${path}` : "";
			return pattern ? compact(`${pattern}${scope}`) : path;
		}
		case "find": {
			const pattern = stringArg(input, "pattern");
			const scope = path ? ` in ${path}` : "";
			return pattern ? compact(`${pattern}${scope}`) : path;
		}
		default:
			return path ? compact(path) : undefined;
	}
}

function renderCompactCall(toolName: string, toolLabel: string, args: unknown, theme: Theme) {
	const target = getToolTarget(toolName, args);
	const title = theme.fg("toolTitle", theme.bold(toolLabel));
	const suffix = target ? ` ${theme.fg("toolOutput", target)}` : "";
	return new Text(`${title}${suffix}`, 0, 0);
}

function withCollapsedRender<TTool extends AnyToolDefinition>(tool: TTool): TTool {
	return {
		...tool,
		renderCall(args: unknown, theme: Theme, context: ToolRenderContext) {
			if (context.expanded && tool.renderCall) {
				return tool.renderCall(args, theme, context);
			}
			return renderCompactCall(tool.name, tool.label, args, theme);
		},
		renderResult(result: ToolRenderResult, options: ToolRenderResultOptions, theme: Theme, context: ToolRenderContext) {
			if (context.expanded && tool.renderResult) {
				return tool.renderResult(result, options, theme, context);
			}
			return new Container();
		},
	} as TTool;
}

function registerCompactBuiltInTools(pi: ExtensionAPI, cwd: string): void {
	const tools: AnyToolDefinition[] = [
		createReadToolDefinition(cwd),
		createBashToolDefinition(cwd),
		createEditToolDefinition(cwd),
		createWriteToolDefinition(cwd),
		createGrepToolDefinition(cwd),
		createFindToolDefinition(cwd),
		createLsToolDefinition(cwd),
	];

	for (const tool of tools) {
		pi.registerTool(withCollapsedRender(tool));
	}
}

export default function (pi: ExtensionAPI) {
	let registeredCwd: string | undefined;

	pi.on("session_start", async (_event, ctx) => {
		if (registeredCwd !== ctx.cwd) {
			registerCompactBuiltInTools(pi, ctx.cwd);
			registeredCwd = ctx.cwd;
		}
		applyDisplayPolicy(ctx);
	});

	pi.on("turn_start", async (_event, ctx) => {
		applyDisplayPolicy(ctx);
	});

	pi.registerCommand("display", {
		description: "Reset display to collapsed tool details",
		handler: async (_args, ctx) => {
			applyDisplayPolicy(ctx);
			ctx.ui.notify("Tool details collapsed; thinking remains hidden by default.", "info");
		},
	});
}
