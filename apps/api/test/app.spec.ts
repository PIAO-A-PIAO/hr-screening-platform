import { AppController } from "../src/app.controller";

describe("AppController", () => {
  it("identifies the API as foundation-only", () => {
    expect(new AppController().root()).toEqual({
      name: "DS-HR API",
      milestone: 0,
      scope: "foundation-only",
    });
  });
});
