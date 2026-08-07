import type { Api, Context, Model, SimpleStreamOptions } from "@earendil-works/pi-ai";
import { completeSimple } from "@earendil-works/pi-ai/compat";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createConfigStore } from "./session-auto-title/config.ts";
import { registerSessionAutoTitle } from "./session-auto-title/controller.ts";
import { createTitleProvider } from "./session-auto-title/provider.ts";
import { autoTitleUi } from "./session-auto-title/ui.ts";

export default function sessionAutoTitle(pi: ExtensionAPI) {
	const provider = createTitleProvider({
		complete: (model, context, options) =>
			completeSimple(model as Model<Api>, context as Context, options as SimpleStreamOptions),
		notify: autoTitleUi.notify,
	});
	registerSessionAutoTitle(pi, {
		configStore: createConfigStore(),
		provider,
		ui: autoTitleUi,
	});
}
