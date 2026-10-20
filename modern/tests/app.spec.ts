import { test, expect } from "@playwright/test";
function wav(bpm = 120, seconds = 16, silent = false): Buffer {
  const rate = 44100,
    frames = rate * seconds;
  const out = Buffer.alloc(44 + frames * 2);
  out.write("RIFF");
  out.writeUInt32LE(out.length - 8, 4);
  out.write("WAVEfmt ", 8);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(rate, 24);
  out.writeUInt32LE(rate * 2, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36);
  out.writeUInt32LE(frames * 2, 40);
  for (let i = 0; i < frames; i++) {
    const beatTime = (i / rate) % (60 / bpm);
    const sample = silent
      ? 0
      : Math.sin((2 * Math.PI * 1200 * i) / rate) *
        Math.exp(-beatTime * 95) *
        0.8;
    out.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }
  return out;
}
test("real WASM analysis, serial queue, failure, history and export", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByLabel("选择音频文件").setInputFiles([
    { name: "pulse-120.wav", mimeType: "audio/wav", buffer: wav() },
    { name: "silence.wav", mimeType: "audio/wav", buffer: wav(120, 6, true) },
    { name: "pulse-140.wav", mimeType: "audio/wav", buffer: wav(140) },
  ]);
  await expect(page.getByText("2 首已完成", { exact: true })).toBeVisible({
    timeout: 150000,
  });
  const first = page.locator(".track").filter({ hasText: "pulse-120.wav" });
  const second = page.locator(".track").filter({ hasText: "pulse-140.wav" });
  const bpm120 = Number(await first.locator(".bpm").innerText());
  const bpm140 = Number(await second.locator(".bpm").innerText());
  expect(bpm120).toBeGreaterThan(117);
  expect(bpm120).toBeLessThan(123);
  expect(bpm140).toBeGreaterThan(137);
  expect(bpm140).toBeLessThan(143);
  await expect(page.getByText("音频为静音，无法检测节拍。")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出结果" }).click();
  expect((await download).suggestedFilename()).toBe("ikaBeat-results.csv");
  await page.reload();
  await expect(page.locator(".track")).toHaveCount(2);
  await expect(page.getByText("pulse-120.wav")).toBeVisible();
  await page.screenshot({ path: "desktop-preview.png", fullPage: true });
  expect(errors).toEqual([]);
});
test("mobile layout, invalid input and cancellation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByLabel("选择音频文件")
    .setInputFiles({
      name: "readme.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("invalid"),
    });
  await expect(page.getByRole("status")).toContainText("不支持的文件类型");
  await page.getByLabel("选择音频文件").setInputFiles([
    { name: "cancel-1.wav", mimeType: "audio/wav", buffer: wav() },
    { name: "cancel-2.wav", mimeType: "audio/wav", buffer: wav() },
  ]);
  await page.getByRole("button", { name: "取消队列" }).click();
  await expect(page.locator(".status.cancelled")).toHaveCount(2);
  await page
    .getByLabel("选择音频文件")
    .setInputFiles({
      name: "pulse-120.wav",
      mimeType: "audio/wav",
      buffer: wav(),
    });
  await expect(page.getByText("1 首已完成", { exact: true })).toBeVisible({
    timeout: 60000,
  });
  await page.screenshot({ path: "mobile-preview.png", fullPage: true });
});
