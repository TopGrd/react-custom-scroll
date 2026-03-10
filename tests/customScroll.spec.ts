import { test, expect } from "@playwright/test";
import {
  assertCustomScrollBarVisible,
  assertCustomScrollBarXVisible,
  assertDomElementProperty,
  getExamplePanel,
  getHorizontalScrollExamplePanel,
  getInnerContainer,
  getKeepScrollVisibleExamplePanel,
  getScrollHandle,
  getScrollHandleX,
} from "./customScrollDriver";

const APP_URL = "http://localhost:5174/";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test.describe("basic functionality", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
  });

  test("Custom scrollbar appears when hovering the container", async ({
    page,
  }) => {
    const examplePanel = getExamplePanel(page);
    await examplePanel.getByTestId("outer-container").hover();

    await assertCustomScrollBarVisible(examplePanel);
  });

  test("Updates the position of the scroll handle when scrolling", async ({
    page,
  }) => {
    const examplePanel = getExamplePanel(page);
    await examplePanel.getByTestId("outer-container").hover();

    await assertDomElementProperty(
      getScrollHandle(examplePanel),
      "offsetTop",
      0,
    );

    await page.mouse.wheel(0, 100);
    await sleep(500);

    await assertDomElementProperty(
      getInnerContainer(examplePanel),
      "scrollTop",
      100,
    );

    await assertDomElementProperty(
      getScrollHandle(examplePanel),
      "offsetTop",
      28,
    );
  });
});

test.describe("alwaysVisible prop", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
  });

  test("Scrollbar is visible without hover when alwaysVisible is true", async ({
    page,
  }) => {
    const panel = getKeepScrollVisibleExamplePanel(page);
    await assertCustomScrollBarVisible(panel);
  });
});

// test.describe("mouse interactions with custom scrollbar", () => {
//   test.beforeEach(async ({ page }) => {
//     await page.goto(APP_URL);
//   });
//
//   test("Should scroll when clicking on the scrollbar area", async ({
//     page,
//   }) => {
//     const examplePanel = getExamplePanel(page);
//
//     const customHandle = getScrollHandle(examplePanel);
//     await customHandle.hover();
//     // click below the handle
//     page.mouse.click(0, 50);
//
//     // check the scroll moved downwards
//   });
// });

// test.describe("Blocking outer scroll", () => {
//   test.beforeEach(async ({ page }) => {
//     await page.goto(APP_URL);
//   });
//   test("should block outer scroll when reaching the end of the scroll range", async ({
//     page,
//   }) => {
//     const documentElement = await getDocumentElement(page);
//
//     const examplePanel = page.getByTestId("first-example");
//     await examplePanel.getByTestId("outer-container").click();
//
//     await assertDomElementProperty(documentElement, "scrollTop", 114);
//
//     await page.mouse.wheel(0, 4000);
//     await sleep(500);
//     await page.mouse.wheel(0, -4000);
//
//     await assertDomElementProperty(documentElement, "scrollTop", 200);
//   });
// });

test.describe("horizontal scrollbar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
  });

  test("Horizontal scrollbar is visible with alwaysVisible and allowHorizontalScroll", async ({
    page,
  }) => {
    const panel = getHorizontalScrollExamplePanel(page);
    await assertCustomScrollBarXVisible(panel);
  });

  test("Horizontal scroll handle starts at left position 0", async ({
    page,
  }) => {
    const panel = getHorizontalScrollExamplePanel(page);
    await assertDomElementProperty(getScrollHandleX(panel), "offsetLeft", 0);
  });

  test("Updates the position of the horizontal scroll handle when scrolling", async ({
    page,
  }) => {
    const panel = getHorizontalScrollExamplePanel(page);
    await panel.getByTestId("outer-container").hover();

    await assertDomElementProperty(getScrollHandleX(panel), "offsetLeft", 0);

    // Scroll horizontally
    await page.mouse.wheel(100, 0);
    await sleep(500);

    const innerContainer = getInnerContainer(panel);
    const scrollLeft = await innerContainer.evaluate((node) => node.scrollLeft);
    // scrollLeft should be > 0 after horizontal wheel event
    expect(scrollLeft).toBeGreaterThan(0);
  });
});
