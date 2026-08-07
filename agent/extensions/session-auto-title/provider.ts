import type {
	Api,
	AssistantMessage,
	Context,
	Model,
	SimpleStreamOptions,
	TextContent,
} from "@earendil-works/pi-ai";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { AutoTitleConfig, ModelConfig } from "./config.ts";
import { modelToRef } from "./config.ts";
import { buildUserMessage, sanitizeTitle, SYSTEM_PROMPT } from "./core.ts";

type Notify = (context: ExtensionContext, message: string, level: "info" | "warning" | "error") => void;

type CompletionGateway = (
	model: Model<Api>,
	context: Context,
	options: SimpleStreamOptions,
) => Promise<Pick<AssistantMessage, "content" | "errorMessage" | "stopReason">>;

export type GenerateTitleInput = {
	context: ExtensionContext;
	config: AutoTitleConfig;
	sourceLabel: string;
	sourceText: string;
	startLoading: () => () => void;
};

export type TitleProvider = {
	ensureAvailable: (context: ExtensionContext, model: ModelConfig) => Promise<boolean>;
	generate: (input: GenerateTitleInput) => Promise<string | null>;
};

export function createTitleProvider({ complete, notify }: { complete: CompletionGateway; notify: Notify }): TitleProvider {
	async function getModelAuth(context: ExtensionContext, modelConfig: ModelConfig, missingModelMessage?: string) {
		const model = context.modelRegistry.find(modelConfig.provider, modelConfig.id);
		if (!model) {
			notify(context, missingModelMessage ?? `Auto-title model not found: ${modelToRef(modelConfig)}`, "warning");
			return null;
		}

		const auth = await context.modelRegistry.getApiKeyAndHeaders(model);
		if (!auth.ok) {
			notify(context, auth.error, "warning");
			return null;
		}
		if (!auth.apiKey && !auth.headers) {
			notify(context, `No auth configured for ${model.provider}. Configure it with /login or models.json.`, "warning");
			return null;
		}
		return { auth, model };
	}

	return {
		async ensureAvailable(context, modelConfig) {
			return Boolean(
				await getModelAuth(context, modelConfig, `Model not found: ${modelConfig.provider}/${modelConfig.id}`),
			);
		},
		async generate({ context, config, sourceLabel, sourceText, startLoading }) {
			const modelAuth = await getModelAuth(context, config.model);
			if (!modelAuth) return null;

			const timeoutMs = config.title.timeoutMs;
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), timeoutMs);
			const stopTitleLoading = startLoading();
			try {
				const response = await complete(
					modelAuth.model,
					{ systemPrompt: SYSTEM_PROMPT, messages: [buildUserMessage(config, sourceLabel, sourceText)] },
					{
						apiKey: modelAuth.auth.apiKey,
						headers: modelAuth.auth.headers,
						maxTokens: config.title.maxOutputTokens,
						reasoning: config.model.reasoning,
						maxRetries: 0,
						timeoutMs,
						signal: controller.signal,
					},
				);

				if (response.stopReason === "error") {
					notify(context, `Failed to generate session title: ${response.errorMessage ?? "model error"}`, "warning");
					return null;
				}

				const rawTitle = response.content
					.filter((block): block is TextContent => block.type === "text")
					.map((block) => block.text)
					.join("\n");
				const title = sanitizeTitle(rawTitle, config.title.maxLength);
				if (!title) {
					notify(
						context,
						`Auto-title response was empty. Try a larger title.maxOutputTokens or lower/off reasoning. stopReason=${response.stopReason}`,
						"warning",
					);
					return null;
				}
				return title;
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				if (controller.signal.aborted) {
					notify(context, `Auto-title timed out after ${timeoutMs}ms`, "warning");
				} else {
					notify(context, `Failed to generate session title: ${message}`, "warning");
				}
				return null;
			} finally {
				clearTimeout(timer);
				stopTitleLoading();
			}
		},
	};
}
