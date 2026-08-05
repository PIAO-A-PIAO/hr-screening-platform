import { weightedScore } from "../src/common/scoring";

describe("weightedScore", () => {
  it("averages reviewers per question before applying weights", () => {
    expect(weightedScore([
      { questionId: "video", weight: 3, rating: 4 },
      { questionId: "video", weight: 3, rating: 5 },
      { questionId: "mcq", weight: 1, rating: 3 },
    ])).toBe(4.13);
  });

  it("returns null when a candidate has not been rated", () => {
    expect(weightedScore([])).toBeNull();
  });
});
