import assert from "node:assert/strict";
import { commentDate } from "../lib/leaderboard/comment-date";
for (const value of ["infinity", "-infinity", "bad", ""]) assert.equal(commentDate(value), "Date unavailable");
assert.match(commentDate("2026-10-19T00:00:00Z"), /19/);
console.log("Comment dates safely handle invalid legacy values");
