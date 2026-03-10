import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

export const getCustomScrollbar = (container: Locator) =>
  container.getByTestId("custom-scrollbar");

export const assertCustomScrollBarVisible = async (container: Locator) => {
  await expect(getCustomScrollbar(container)).toBeVisible();
  await expect(getCustomScrollbar(container)).toHaveCSS("opacity", "1");
};

export const getAppBody = (page: Page) => page.content();

export const getInnerContainer = (container: Locator) =>
  container.getByTestId("inner-container");

export const getScrollHandle = (container: Locator) =>
  container.getByTestId("custom-scroll-handle");

export const getExamplePanel = (page: Page) =>
  page.getByTestId("first-example");

export const getKeepScrollVisibleExamplePanel = (page: Page) =>
  page.getByTestId("keep-scroll-visible-example");

export const assertDomElementProperty = async (
  element: Locator,
  elmProperty: "scrollTop" | "offsetTop" | "scrollLeft" | "offsetLeft",
  expectedValue: number,
) => {
  expect(
    await element.evaluate(
      // @ts-expect-error missing type
      (node, elmProperty) => node[elmProperty],
      elmProperty,
    ),
  ).toBe(expectedValue);
};

export const getDocumentElement = (page: Page) =>
  page.evaluateHandle(() => document.documentElement);

export const getCustomScrollbarX = (container: Locator) =>
  container.getByTestId("custom-scrollbar-x");

export const assertCustomScrollBarXVisible = async (container: Locator) => {
  await expect(getCustomScrollbarX(container)).toBeVisible();
  await expect(getCustomScrollbarX(container)).toHaveCSS("opacity", "1");
};

export const getScrollHandleX = (container: Locator) =>
  container.getByTestId("custom-scroll-handle-x");

export const getHorizontalScrollExamplePanel = (page: Page) =>
  page.getByTestId("horizontal-scroll-example");
