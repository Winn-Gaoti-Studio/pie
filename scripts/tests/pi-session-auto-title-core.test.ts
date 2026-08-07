import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_CONFIG } from "../../agent/extensions/session-auto-title/config.ts";
import {
	buildStartupSource,
	buildUserMessage,
	getConversationTranscript,
	hasAssistantMessage,
	sanitizeTitle,
	shouldConfirmOverwrite,
	truncateMiddle,
} from "../../agent/extensions/session-auto-title/core.ts";

const reverseOrderedBranch = [
	{ type: "message", message: { role: "assistant", content: [{ type: "text", text: "Answer" }] } },
	{ type: "message", message: { role: "user", content: "Question" } },
];

test("preserves reverse branch traversal for startup history and transcripts", () => {
	assert.equal(buildStartupSource(reverseOrderedBranch, 0), "User: Question\n\nAssistant: Answer");
	assert.equal(buildStartupSource(reverseOrderedBranch, 1), "Assistant: Answer");
	assert.equal(getConversationTranscript(reverseOrderedBranch), "User: Question\n\nAssistant: Answer");
	assert.equal(hasAssistantMessage(reverseOrderedBranch), true);
});

test("builds the existing title prompt and truncates its source in the middle", () => {
	const config = {
		...DEFAULT_CONFIG,
		title: { ...DEFAULT_CONFIG.title, maxInputChars: 10 },
	};
	const message = buildUserMessage(config, "Session history", "  0123456789abcdef  ");
	const content = message.content[0];

	assert.equal(content?.type, "text");
	assert.match(content?.text ?? "", /Create a short, descriptive title for this session from the Session history\./);
	assert.match(content?.text ?? "", /Return only the title\./);
	assert.match(content?.text ?? "", /Session history:\n012345…def/);
	assert.equal(truncateMiddle("0123456789abcdef", 10), "012345…def");
});

test("sanitizes one title line and preserves overwrite confirmation policy", () => {
	assert.equal(sanitizeTitle("\n  `Useful   Session!`  \nignored", 80), "Useful Session");
	assert.equal(sanitizeTitle("123456789", 5), "12345");
	assert.equal(shouldConfirmOverwrite("Existing", true), true);
	assert.equal(shouldConfirmOverwrite("Existing", false), false);
	assert.equal(shouldConfirmOverwrite(undefined, true), false);
});
