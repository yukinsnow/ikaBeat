import { test, expect } from '@playwright/test';

// Desktop automation reports zero safe-area insets. Inject device values to
// exercise the real layout; native WebKit inset reporting still needs a device.
for (const device of [
  { name: 'portrait', width: 390, height: 844, top: 59, right: 0, bottom: 34, left: 0 },
  { name: 'landscape', width: 844, height: 390, top: 0, right: 59, bottom: 21, left: 59 },
  { name: 'tablet', width: 1024, height: 768, top: 24, right: 0, bottom: 20, left: 0 },
  { name: 'desktop', width: 1440, height: 1050, top: 0, right: 0, bottom: 0, left: 0 },
]) {
  test(`content and help stay inside ${device.name} safe area`, async ({ page }) => {
    await page.setViewportSize(device);
    await page.goto('/');
    await page.evaluate(({ top, right, bottom, left }) => {
      for (const [side, value] of Object.entries({ top, right, bottom, left })) {
        document.documentElement.style.setProperty(`--safe-${side}`, `${value}px`);
      }
    }, device);
    const brand = await page.locator('.brand').boundingBox();
    expect(brand!.y).toBeGreaterThanOrEqual(device.top);
    expect(brand!.x).toBeGreaterThanOrEqual(device.left);
    const header = await page.locator('header').boundingBox();
    expect(header!.y).toBeGreaterThanOrEqual(device.top);
    expect(header!.x + header!.width).toBeLessThanOrEqual(device.width - device.right + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(device.width);
    await page.locator('.help-link').click();
    await expect(page.locator('.modal')).toBeVisible();
    const modal = await page.locator('.modal').boundingBox();
    expect(modal!.y).toBeGreaterThanOrEqual(device.top + 19);
    expect(modal!.y + modal!.height).toBeLessThanOrEqual(device.height - device.bottom - 19);
    expect(modal!.x).toBeGreaterThanOrEqual(device.left + 19);
    expect(modal!.x + modal!.width).toBeLessThanOrEqual(device.width - device.right - 19);
  });
}
