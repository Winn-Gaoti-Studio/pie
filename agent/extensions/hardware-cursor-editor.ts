import { CustomEditor, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

export function _stripFakeCursor(line: string): string {
	return line.replace(/\x1b\[7m([\s\S]*?)\x1b\[(?:0|27)m/g, "$1");
}

class HardwareCursorEditor extends CustomEditor {
	render(width: number): string[] {
		return super.render(width).map(_stripFakeCursor);
	}
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		if (ctx.mode !== "tui") return;

		ctx.ui.setEditorComponent(
			(tui, theme, keybindings) =>
				new HardwareCursorEditor(tui, theme, keybindings)
		);
	});
}
