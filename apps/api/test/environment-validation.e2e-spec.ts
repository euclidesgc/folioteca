import type { createApp as CreateApp } from "../src/bootstrap";

describe("createApp with an invalid environment", () => {
  const originalWebOrigin = process.env.WEB_ORIGIN;

  afterAll(() => {
    if (originalWebOrigin === undefined) {
      delete process.env.WEB_ORIGIN;
    } else {
      process.env.WEB_ORIGIN = originalWebOrigin;
    }
  });

  it("deve rejeitar quando WEB_ORIGIN é malformada, sem embutir o valor validado na mensagem", async () => {
    const malformedValue = "http://localhost:5173,https://app.exemplo/";
    process.env.WEB_ORIGIN = malformedValue;

    let boot!: typeof CreateApp;
    jest.isolateModules(() => {
      boot = jest.requireActual<{ createApp: typeof CreateApp }>(
        "../src/bootstrap",
      ).createApp;
    });

    let rejection: unknown;
    try {
      await boot();
    } catch (error) {
      rejection = error;
    }

    expect(rejection).toBeInstanceOf(Error);
    expect((rejection as Error).message).not.toContain(malformedValue);
  });
});
