import test from "node:test";
import assert from "node:assert/strict";
import { closestToolName, intentToolName } from "../server/mcp-arg-errors.mjs";

const NAMES = ["room_block_work", "room_record_completion", "room_claim", "room_post_message", "room_needs_me", "room_list_work", "room_read_messages"];

test("room_close_work suggests completion, not block", () => {
  assert.equal(closestToolName("room_close_work", NAMES), "room_record_completion");
});
test("intent only returns offered tools", () => {
  assert.equal(intentToolName("room_close_work", ["room_block_work"]), null);
});
test("verb synonyms", () => {
  assert.equal(closestToolName("room_take_task", NAMES), "room_claim");
  assert.equal(closestToolName("room_send_message", NAMES), "room_post_message");
  assert.equal(closestToolName("room_unread", NAMES), "room_needs_me");
});
test("exact and near-miss names keep edit-distance behavior", () => {
  assert.equal(closestToolName("room_read_mesages", NAMES), "room_read_messages");
  assert.equal(closestToolName("room_list_wrk", NAMES), "room_list_work");
  assert.equal(closestToolName("zzzz", NAMES), null);
});
