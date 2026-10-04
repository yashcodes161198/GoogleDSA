import {
  formatLeaderboardWeek,
  leaderboardPoints,
  leaderboardWeekBounds,
  rankLeaderboardTotals,
} from "../lib/leaderboard/points";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

assert(leaderboardPoints("MEDIUM", "solve") === 4, "new medium solve is 4");
assert(leaderboardPoints("HARD", "solve") === 8, "new hard solve is 8");
assert(leaderboardPoints("EASY", "solve") === 0, "easy solve is 0");

assert(leaderboardPoints("MEDIUM", "revision", 1) === 2, "first medium revision is 2");
assert(leaderboardPoints("HARD", "revision", 1) === 4, "first hard revision is 4");
assert(leaderboardPoints("MEDIUM", "revision", 2) === 1, "second medium revision is 1");
assert(leaderboardPoints("MEDIUM", "revision", 5) === 1, "later medium revision is 1");
assert(leaderboardPoints("HARD", "revision", 3) === 2, "later hard revision is 2");
assert(leaderboardPoints("EASY", "revision", 1) === 0, "easy revision is 0");
assert(leaderboardPoints("MEDIUM", "revision", 0) === 0, "revision 0 scores nothing");

const sundayAfternoonIst = new Date("2026-10-04T10:30:00.000Z");
const sundayWeek = leaderboardWeekBounds(sundayAfternoonIst);
assert(
  sundayWeek.start.toISOString() === "2026-09-27T18:30:00.000Z",
  "Sunday afternoon IST stays in the week that started the previous Monday"
);
assert(
  sundayWeek.end.toISOString() === "2026-10-04T18:30:00.000Z",
  "that week ends at the next Monday 00:00 IST"
);

const mondayMidnightIst = new Date("2026-10-04T18:30:00.000Z");
const nextWeek = leaderboardWeekBounds(mondayMidnightIst);
assert(
  nextWeek.start.toISOString() === "2026-10-04T18:30:00.000Z",
  "Monday 00:00 IST starts a new week"
);

assert(
  formatLeaderboardWeek(sundayAfternoonIst) === "28 Sept – 4 Oct",
  "week label covers Monday through Sunday in India"
);

const ranked = rankLeaderboardTotals([
  { user_id: "b", display_name: "Bea", points: 8 },
  { user_id: "a", display_name: "Ada", points: 8 },
  { user_id: "c", display_name: "Cy", points: 4 },
]);
assert(ranked[0]?.display_name === "Ada" && ranked[0].rank === 1, "tie sorts by name");
assert(ranked[1]?.display_name === "Bea" && ranked[1].rank === 1, "tied points share a rank");
assert(ranked[2]?.rank === 3, "the next rank skips after a tie");

console.log("leaderboard points ok");
