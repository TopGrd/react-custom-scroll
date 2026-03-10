import {
  Component,
  CSSProperties,
  createRef,
  UIEvent,
  MouseEvent,
  PropsWithChildren,
} from "react";
import styled from "styled-components";
import {
  ElementLayout,
  ensureWithinLimits,
  isEventPosOnDomNode,
  isEventPosOnLayout,
  simpleDebounce,
} from "./utils.ts";

const CustomScrollbar = styled.div`
  position: absolute;
  height: 100%;
  width: 6px;
  right: 3px;
  opacity: 0;
  z-index: 1;
  transition: opacity 0.4s ease-out;
  padding: 6px 0;
  box-sizing: border-box;
  will-change: opacity;
  pointer-events: none;

  &.rcs-custom-scrollbar-rtl {
    right: auto;
    left: 3px;
  }

  &.scroll-visible {
    opacity: 1;
    transition-duration: 0.2s;
  }
`;

const ScrollHandle = styled.div`
  height: calc(100% - 12px);
  margin-top: 6px;
  background-color: rgba(78, 183, 245, 0.7);
  border-radius: 3px;
`;

const CustomScrollbarX = styled.div`
  position: absolute;
  width: 100%;
  height: 6px;
  bottom: 3px;
  left: 0;
  opacity: 0;
  z-index: 1;
  transition: opacity 0.4s ease-out;
  padding: 0 6px;
  box-sizing: border-box;
  will-change: opacity;
  pointer-events: none;

  &.scroll-visible {
    opacity: 1;
    transition-duration: 0.2s;
  }
`;

const ScrollHandleX = styled.div`
  width: calc(100% - 12px);
  margin-left: 6px;
  background-color: rgba(78, 183, 245, 0.7);
  border-radius: 3px;
`;

const CustomScrollRoot = styled.div`
  min-height: 0;
  min-width: 0;

  & .rcs-outer-container {
    overflow: hidden;

    & .rcs-positioning {
      position: relative;
    }
  }

  & .rcs-inner-container {
    overflow-x: hidden;
    overflow-y: scroll;
    -webkit-overflow-scrolling: touch;

    &:after {
      content: "";
      position: absolute;
      top: 0;
      right: 0;
      left: 0;
      height: 0;
      background-image: linear-gradient(
        to bottom,
        rgba(0, 0, 0, 0.2) 0%,
        rgba(0, 0, 0, 0.05) 60%,
        rgba(0, 0, 0, 0) 100%
      );
      pointer-events: none;
      transition: height 0.1s ease-in;
      will-change: height;
    }

    &.rcs-content-scrolled:after {
      height: 5px;
      transition: height 0.15s ease-out;
    }
  }

  &.rcs-scroll-handle-dragged .rcs-inner-container {
    user-select: none;
  }

  &.rcs-scroll-handle-dragged ${CustomScrollbar} {
    opacity: 1;
  }

  & .rcs-custom-scroll-handle {
    position: absolute;
    width: 100%;
    top: 0;
  }

  & .rcs-custom-scroll-handle-x {
    position: absolute;
    height: 100%;
    left: 0;
  }

  &.rcs-scroll-handle-dragged ${CustomScrollbarX} {
    opacity: 1;
  }
`;

interface CustomScrollProps extends PropsWithChildren {
  allowOuterScroll?: boolean;
  heightRelativeToParent?: string;
  onScroll?: (event: UIEvent) => void;
  addScrolledClass?: boolean;
  freezePosition?: boolean;
  handleClass?: string;
  minScrollHandleHeight?: number;
  flex?: string;
  rtl?: boolean;
  scrollTo?: number;
  keepAtBottom?: boolean;
  alwaysVisible?: boolean;
  className?: string;
  allowHorizontalScroll?: boolean;
  horizontalHandleClass?: string;
  minScrollHandleWidth?: number;
  scrollLeft?: number;
}

interface CustomScrollState {
  scrollPos: number;
  scrollPosX: number;
  onDrag: boolean;
  visible: boolean;
}

export class CustomScroll extends Component<
  CustomScrollProps,
  CustomScrollState
> {
  scrollbarYWidth: number;
  hideScrollThumb: ReturnType<typeof simpleDebounce>;
  contentHeight: number = 0;
  visibleHeight: number = 0;
  scrollHandleHeight: number = 0;
  scrollRatio: number = 1;
  hasScroll: boolean = false;
  startDragHandlePos: number = 0;
  startDragMousePos: number = 0;

  // Horizontal scroll properties
  scrollbarXHeight: number = 0;
  contentWidth: number = 0;
  visibleWidth: number = 0;
  scrollHandleWidth: number = 0;
  scrollRatioX: number = 1;
  hasScrollX: boolean = false;
  startDragHandlePosX: number = 0;
  startDragMousePosX: number = 0;

  constructor(props: CustomScrollProps) {
    super(props);

    this.scrollbarYWidth = 0;
    this.state = {
      scrollPos: 0,
      scrollPosX: 0,
      onDrag: false,
      visible: false,
    };

    this.hideScrollThumb = simpleDebounce(() => {
      this.setState({
        onDrag: false,
      });
    }, 500);
  }

  componentDidMount() {
    if (typeof this.props.scrollTo !== "undefined") {
      this.updateScrollPosition(this.props.scrollTo);
    } else {
      this.forceUpdate();
    }
    if (typeof this.props.scrollLeft !== "undefined") {
      this.updateScrollPositionX(this.props.scrollLeft);
    }
  }

  componentDidUpdate(
    prevProps: CustomScrollProps,
    prevState: CustomScrollState,
  ) {
    const prevContentHeight = this.contentHeight;
    const prevVisibleHeight = this.visibleHeight;
    const innerContainer = this.getScrolledElement();
    const reachedBottomOnPrevRender =
      prevState.scrollPos >= prevContentHeight - prevVisibleHeight;

    this.contentHeight = innerContainer.scrollHeight;
    this.scrollbarYWidth =
      innerContainer.offsetWidth - innerContainer.clientWidth;
    this.visibleHeight = innerContainer.clientHeight;
    this.scrollRatio = this.contentHeight
      ? this.visibleHeight / this.contentHeight
      : 1;

    // Update horizontal scroll dimensions
    if (this.props.allowHorizontalScroll) {
      this.contentWidth = innerContainer.scrollWidth;
      this.scrollbarXHeight =
        innerContainer.offsetHeight - innerContainer.clientHeight;
      this.visibleWidth = innerContainer.clientWidth;
      this.scrollRatioX = this.contentWidth
        ? this.visibleWidth / this.contentWidth
        : 1;
      this.toggleScrollXIfNeeded();
    }

    this.toggleScrollIfNeeded();
    const isExternalRender = this.state === prevState;
    if (this.props.freezePosition || prevProps.freezePosition) {
      this.adjustFreezePosition(prevProps);
    }
    if (
      typeof this.props.scrollTo !== "undefined" &&
      this.props.scrollTo !== prevProps.scrollTo
    ) {
      this.updateScrollPosition(this.props.scrollTo);
    } else if (
      this.props.keepAtBottom &&
      isExternalRender &&
      reachedBottomOnPrevRender
    ) {
      this.updateScrollPosition(this.contentHeight - this.visibleHeight);
    }

    if (
      typeof this.props.scrollLeft !== "undefined" &&
      this.props.scrollLeft !== prevProps.scrollLeft
    ) {
      this.updateScrollPositionX(this.props.scrollLeft);
    }
  }

  componentWillUnmount() {
    this.hideScrollThumb.cancel();
    // @ts-expect-error problem typing event handlers
    document.removeEventListener("mousemove", this.onHandleDrag);
    // @ts-expect-error problem typing event handlers
    document.removeEventListener("mouseup", this.onHandleDragEnd);
    // @ts-expect-error problem typing event handlers
    document.removeEventListener("mousemove", this.onHandleDragX);
    // @ts-expect-error problem typing event handlers
    document.removeEventListener("mouseup", this.onHandleDragEndX);
  }

  customScrollRef = createRef<HTMLDivElement>();
  innerContainerRef = createRef<HTMLDivElement>();
  customScrollbarRef = createRef<HTMLDivElement>();
  scrollHandleRef = createRef<HTMLDivElement>();
  contentWrapperRef = createRef<HTMLDivElement>();
  customScrollbarXRef = createRef<HTMLDivElement>();
  scrollHandleXRef = createRef<HTMLDivElement>();

  adjustFreezePosition = (prevProps: CustomScrollProps) => {
    if (!this.contentWrapperRef.current) {
      return;
    }
    const innerContainer = this.getScrolledElement();
    const contentWrapper = this.contentWrapperRef.current;

    if (this.props.freezePosition) {
      contentWrapper.scrollTop = this.state.scrollPos;
    }

    if (prevProps.freezePosition) {
      innerContainer.scrollTop = this.state.scrollPos;
    }
  };

  toggleScrollIfNeeded = () => {
    const shouldHaveScroll = this.contentHeight - this.visibleHeight > 1;
    if (this.hasScroll !== shouldHaveScroll) {
      this.hasScroll = shouldHaveScroll;
      this.forceUpdate();
    }
  };

  toggleScrollXIfNeeded = () => {
    const shouldHaveScrollX = this.contentWidth - this.visibleWidth > 1;
    if (this.hasScrollX !== shouldHaveScrollX) {
      this.hasScrollX = shouldHaveScrollX;
      this.forceUpdate();
    }
  };

  updateScrollPosition = (scrollValue: number) => {
    const innerContainer = this.getScrolledElement();
    const updatedScrollTop = ensureWithinLimits(
      scrollValue,
      0,
      this.contentHeight - this.visibleHeight,
    );
    innerContainer.scrollTop = updatedScrollTop;
    this.setState({
      scrollPos: updatedScrollTop,
    });
  };

  updateScrollPositionX = (scrollValue: number) => {
    const innerContainer = this.getScrolledElement();
    const updatedScrollLeft = ensureWithinLimits(
      scrollValue,
      0,
      this.contentWidth - this.visibleWidth,
    );
    innerContainer.scrollLeft = updatedScrollLeft;
    this.setState({
      scrollPosX: updatedScrollLeft,
    });
  };

  onClick = (event: MouseEvent) => {
    if (
      !this.hasScroll ||
      !this.isMouseEventOnCustomScrollbar(event) ||
      this.isMouseEventOnScrollHandle(event)
    ) {
      // Check horizontal scrollbar click
      if (
        this.props.allowHorizontalScroll &&
        this.hasScrollX &&
        this.isMouseEventOnCustomScrollbarX(event) &&
        !this.isMouseEventOnScrollHandleX(event)
      ) {
        const newScrollHandleLeft = this.calculateNewScrollHandleLeft(event);
        const newScrollValue =
          this.getScrollValueFromHandlePositionX(newScrollHandleLeft);
        this.updateScrollPositionX(newScrollValue);
      }
      return;
    }
    const newScrollHandleTop = this.calculateNewScrollHandleTop(event);
    const newScrollValue =
      this.getScrollValueFromHandlePosition(newScrollHandleTop);

    this.updateScrollPosition(newScrollValue);
  };

  isMouseEventOnCustomScrollbar = (event: MouseEvent) => {
    if (!this.customScrollbarRef.current) {
      return false;
    }
    const customScrollElm = this.customScrollRef.current as HTMLElement;
    const boundingRect = customScrollElm.getBoundingClientRect();
    const customScrollbarBoundingRect =
      this.customScrollbarRef.current.getBoundingClientRect();
    const horizontalClickArea = this.props.rtl
      ? {
          left: boundingRect.left,
          right: customScrollbarBoundingRect.right,
        }
      : {
          left: customScrollbarBoundingRect.left,
          width: boundingRect.right,
        };
    const customScrollbarLayout: ElementLayout = {
      right: boundingRect.right,
      top: boundingRect.top,
      height: boundingRect.height,
      ...horizontalClickArea,
    };

    return isEventPosOnLayout(event, customScrollbarLayout);
  };

  isMouseEventOnScrollHandle = (event: MouseEvent) => {
    if (!this.scrollHandleRef.current) {
      return false;
    }
    const scrollHandle = this.scrollHandleRef.current;
    return isEventPosOnDomNode(event, scrollHandle);
  };

  isMouseEventOnCustomScrollbarX = (event: MouseEvent) => {
    if (!this.customScrollbarXRef.current) {
      return false;
    }
    const customScrollbarXBoundingRect =
      this.customScrollbarXRef.current.getBoundingClientRect();
    const customScrollbarXLayout: ElementLayout = {
      left: customScrollbarXBoundingRect.left,
      right: customScrollbarXBoundingRect.right,
      top: customScrollbarXBoundingRect.top,
      height: customScrollbarXBoundingRect.height,
    };
    return isEventPosOnLayout(event, customScrollbarXLayout);
  };

  isMouseEventOnScrollHandleX = (event: MouseEvent) => {
    if (!this.scrollHandleXRef.current) {
      return false;
    }
    return isEventPosOnDomNode(event, this.scrollHandleXRef.current);
  };

  calculateNewScrollHandleTop = (clickEvent: MouseEvent) => {
    const domNode = this.customScrollRef.current as HTMLElement;
    const boundingRect = domNode.getBoundingClientRect();
    const currentTop = boundingRect.top + window.pageYOffset;
    const clickYRelativeToScrollbar = clickEvent.pageY - currentTop;
    const scrollHandleTop = this.getScrollHandleStyle().top;
    let newScrollHandleTop;
    const isBelowHandle =
      clickYRelativeToScrollbar > scrollHandleTop + this.scrollHandleHeight;
    if (isBelowHandle) {
      newScrollHandleTop =
        scrollHandleTop +
        Math.min(
          this.scrollHandleHeight,
          this.visibleHeight - this.scrollHandleHeight,
        );
    } else {
      newScrollHandleTop =
        scrollHandleTop - Math.max(this.scrollHandleHeight, 0);
    }
    return newScrollHandleTop;
  };

  calculateNewScrollHandleLeft = (clickEvent: MouseEvent) => {
    const domNode = this.customScrollRef.current as HTMLElement;
    const boundingRect = domNode.getBoundingClientRect();
    const currentLeft = boundingRect.left + window.pageXOffset;
    const clickXRelativeToScrollbar = clickEvent.pageX - currentLeft;
    const scrollHandleLeft = this.getScrollHandleStyleX().left;
    let newScrollHandleLeft;
    const isRightOfHandle =
      clickXRelativeToScrollbar > scrollHandleLeft + this.scrollHandleWidth;
    if (isRightOfHandle) {
      newScrollHandleLeft =
        scrollHandleLeft +
        Math.min(
          this.scrollHandleWidth,
          this.visibleWidth - this.scrollHandleWidth,
        );
    } else {
      newScrollHandleLeft =
        scrollHandleLeft - Math.max(this.scrollHandleWidth, 0);
    }
    return newScrollHandleLeft;
  };

  getScrollValueFromHandlePosition = (handlePosition: number) =>
    handlePosition / this.scrollRatio;

  getScrollHandleStyle = (): { height: number; top: number } => {
    const handlePosition = this.state.scrollPos * this.scrollRatio;
    this.scrollHandleHeight = this.visibleHeight * this.scrollRatio;
    return {
      height: this.scrollHandleHeight,
      top: handlePosition,
    };
  };

  getScrollValueFromHandlePositionX = (handlePosition: number) =>
    handlePosition / this.scrollRatioX;

  getScrollHandleStyleX = (): { width: number; left: number } => {
    const handlePosition = this.state.scrollPosX * this.scrollRatioX;
    this.scrollHandleWidth = this.visibleWidth * this.scrollRatioX;
    return {
      width: this.scrollHandleWidth,
      left: handlePosition,
    };
  };

  adjustCustomScrollPosToContentPos = (scrollPosition: number) => {
    this.setState({
      scrollPos: scrollPosition,
    });
  };

  adjustCustomScrollPosToContentPosX = (scrollPosition: number) => {
    this.setState({
      scrollPosX: scrollPosition,
    });
  };

  onScroll = (event: UIEvent) => {
    if (this.props.freezePosition) {
      return;
    }
    this.hideScrollThumb();
    this.adjustCustomScrollPosToContentPos(event.currentTarget.scrollTop);
    if (this.props.allowHorizontalScroll) {
      this.adjustCustomScrollPosToContentPosX(
        (event.currentTarget as HTMLElement).scrollLeft,
      );
    }
    if (this.props.onScroll) {
      this.props.onScroll(event);
    }
  };

  getScrolledElement = () => this.innerContainerRef.current as HTMLElement;

  onMouseDown = (event: MouseEvent) => {
    // Check horizontal handle first
    if (
      this.props.allowHorizontalScroll &&
      this.hasScrollX &&
      this.isMouseEventOnScrollHandleX(event)
    ) {
      this.startDragHandlePosX = this.getScrollHandleStyleX().left;
      this.startDragMousePosX = event.pageX;
      this.setState({
        onDrag: true,
      });
      // @ts-expect-error problem typing event handlers
      document.addEventListener("mousemove", this.onHandleDragX, {
        passive: false,
      });
      // @ts-expect-error problem typing event handlers
      document.addEventListener("mouseup", this.onHandleDragEndX, {
        passive: false,
      });
      return;
    }

    if (!this.hasScroll || !this.isMouseEventOnScrollHandle(event)) {
      return;
    }

    this.startDragHandlePos = this.getScrollHandleStyle().top;
    this.startDragMousePos = event.pageY;
    this.setState({
      onDrag: true,
    });

    // @ts-expect-error problem typing event handlers
    document.addEventListener("mousemove", this.onHandleDrag, {
      passive: false,
    });
    // @ts-expect-error problem typing event handlers
    document.addEventListener("mouseup", this.onHandleDragEnd, {
      passive: false,
    });
  };

  onTouchStart = () => {
    this.setState({
      onDrag: true,
    });
  };

  onHandleDrag = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    const mouseDeltaY = event.pageY - this.startDragMousePos;
    const handleTopPosition = ensureWithinLimits(
      this.startDragHandlePos + mouseDeltaY,
      0,
      this.visibleHeight - this.scrollHandleHeight,
    );
    const newScrollValue =
      this.getScrollValueFromHandlePosition(handleTopPosition);
    this.updateScrollPosition(newScrollValue);
  };

  onHandleDragEnd = (e: MouseEvent<HTMLElement>) => {
    this.setState({
      onDrag: false,
    });
    e.preventDefault();
    // @ts-expect-error problem typing event handlers
    document.removeEventListener("mousemove", this.onHandleDrag);
    // @ts-expect-error problem typing event handlers
    document.removeEventListener("mouseup", this.onHandleDragEnd);
  };

  onHandleDragX = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    const mouseDeltaX = event.pageX - this.startDragMousePosX;
    const handleLeftPosition = ensureWithinLimits(
      this.startDragHandlePosX + mouseDeltaX,
      0,
      this.visibleWidth - this.scrollHandleWidth,
    );
    const newScrollValue =
      this.getScrollValueFromHandlePositionX(handleLeftPosition);
    this.updateScrollPositionX(newScrollValue);
  };

  onHandleDragEndX = (e: MouseEvent<HTMLElement>) => {
    this.setState({
      onDrag: false,
    });
    e.preventDefault();
    // @ts-expect-error problem typing event handlers
    document.removeEventListener("mousemove", this.onHandleDragX);
    // @ts-expect-error problem typing event handlers
    document.removeEventListener("mouseup", this.onHandleDragEndX);
  };

  getInnerContainerClasses = () => {
    if (this.state.scrollPos && this.props.addScrolledClass) {
      return "rcs-inner-container rcs-content-scrolled";
    }
    return "rcs-inner-container";
  };

  getScrollStyles = () => {
    const scrollSize = this.scrollbarYWidth || 20;
    const marginKey = this.props.rtl ? "marginLeft" : "marginRight";
    const innerContainerStyle: CSSProperties = {
      height:
        this.props.heightRelativeToParent || this.props.flex ? "100%" : "",
      overscrollBehavior: this.props.allowOuterScroll ? "auto" : "none",
    };
    innerContainerStyle[marginKey] = -1 * scrollSize;

    // Hide native horizontal scrollbar when horizontal scroll is enabled
    if (this.props.allowHorizontalScroll) {
      const scrollSizeX = this.scrollbarXHeight || 20;
      innerContainerStyle.marginBottom = -1 * scrollSizeX;
      innerContainerStyle.overflowX = "scroll";
    }

    const contentWrapperStyle: CSSProperties = {
      height:
        this.props.heightRelativeToParent || this.props.flex ? "100%" : "",
      overflowY: this.props.freezePosition ? "hidden" : "visible",
    };
    contentWrapperStyle[marginKey] = this.scrollbarYWidth ? 0 : scrollSize;

    if (this.props.allowHorizontalScroll) {
      contentWrapperStyle.marginBottom = this.scrollbarXHeight
        ? 0
        : this.scrollbarXHeight || 20;
    }

    return {
      innerContainer: innerContainerStyle,
      contentWrapper: contentWrapperStyle,
    };
  };

  getOuterContainerStyle = () => ({
    height: this.props.heightRelativeToParent || this.props.flex ? "100%" : "",
  });

  getRootStyles = () => {
    const result: CSSProperties = {};

    if (this.props.heightRelativeToParent) {
      result.height = this.props.heightRelativeToParent;
    } else if (this.props.flex) {
      result.flex = this.props.flex;
    }

    return result;
  };

  enforceMinHandleHeight = (calculatedStyle: {
    height: number;
    top: number;
  }) => {
    const minHeight = this.props.minScrollHandleHeight || 38;
    if (calculatedStyle.height >= minHeight) {
      return calculatedStyle;
    }

    const diffHeightBetweenMinAndCalculated =
      minHeight - calculatedStyle.height;
    const scrollPositionToAvailableScrollRatio =
      this.state.scrollPos / (this.contentHeight - this.visibleHeight);
    const scrollHandlePosAdjustmentForMinHeight =
      diffHeightBetweenMinAndCalculated * scrollPositionToAvailableScrollRatio;
    const handlePosition =
      calculatedStyle.top - scrollHandlePosAdjustmentForMinHeight;

    return {
      height: minHeight,
      top: handlePosition,
    };
  };

  enforceMinHandleWidth = (calculatedStyle: {
    width: number;
    left: number;
  }) => {
    const minWidth = this.props.minScrollHandleWidth || 38;
    if (calculatedStyle.width >= minWidth) {
      return calculatedStyle;
    }

    const diffWidthBetweenMinAndCalculated =
      minWidth - calculatedStyle.width;
    const scrollPositionToAvailableScrollRatio =
      this.state.scrollPosX / (this.contentWidth - this.visibleWidth);
    const scrollHandlePosAdjustmentForMinWidth =
      diffWidthBetweenMinAndCalculated * scrollPositionToAvailableScrollRatio;
    const handlePosition =
      calculatedStyle.left - scrollHandlePosAdjustmentForMinWidth;

    return {
      width: minWidth,
      left: handlePosition,
    };
  };

  onMouseEnter = () => {
    this.setState({ visible: true });
  };

  onMouseLeave = () => {
    this.setState({ visible: false });
  };

  render() {
    const scrollStyles = this.getScrollStyles();
    const rootStyle = this.getRootStyles();
    const scrollHandleStyle = this.enforceMinHandleHeight(
      this.getScrollHandleStyle(),
    );
    const scrollHandleXStyle = this.props.allowHorizontalScroll
      ? this.enforceMinHandleWidth(this.getScrollHandleStyleX())
      : null;
    const className = [
      this.props.className || "",
      "rcs-custom-scroll",
      this.state.onDrag ? "rcs-scroll-handle-dragged" : "",
    ].join(" ");

    return (
      <CustomScrollRoot
        className={className}
        style={rootStyle}
        ref={this.customScrollRef}
      >
        <div
          data-testid="outer-container"
          className="rcs-outer-container"
          style={this.getOuterContainerStyle()}
          onMouseDown={this.onMouseDown}
          onTouchStart={this.onTouchStart}
          onClick={this.onClick}
          onMouseEnter={this.onMouseEnter}
          onMouseLeave={this.onMouseLeave}
        >
          {this.hasScroll ? (
            <div className="rcs-positioning">
              <CustomScrollbar
                data-testid="custom-scrollbar"
                ref={this.customScrollbarRef}
                className={`rcs-custom-scrollbar ${this.props.rtl ? "rcs-custom-scrollbar-rtl" : ""} ${(this.state.visible || this.props.alwaysVisible) ? "scroll-visible" : ""}`}
                key="scrollbar"
              >
                <div
                  data-testid="custom-scroll-handle"
                  ref={this.scrollHandleRef}
                  className="rcs-custom-scroll-handle"
                  style={scrollHandleStyle}
                >
                  <ScrollHandle
                    className={this.props.handleClass || "rcs-inner-handle"}
                  />
                </div>
              </CustomScrollbar>
            </div>
          ) : null}
          {this.props.allowHorizontalScroll && this.hasScrollX ? (
            <div className="rcs-positioning">
              <CustomScrollbarX
                data-testid="custom-scrollbar-x"
                ref={this.customScrollbarXRef}
                className={`rcs-custom-scrollbar-x ${(this.state.visible || this.props.alwaysVisible) ? "scroll-visible" : ""}`}
                key="scrollbar-x"
              >
                <div
                  data-testid="custom-scroll-handle-x"
                  ref={this.scrollHandleXRef}
                  className="rcs-custom-scroll-handle-x"
                  style={scrollHandleXStyle!}
                >
                  <ScrollHandleX
                    className={
                      this.props.horizontalHandleClass || "rcs-inner-handle"
                    }
                  />
                </div>
              </CustomScrollbarX>
            </div>
          ) : null}
          <div
            data-testid="inner-container"
            ref={this.innerContainerRef}
            className={this.getInnerContainerClasses()}
            style={scrollStyles.innerContainer}
            onScroll={this.onScroll}
          >
            <div
              ref={this.contentWrapperRef}
              style={scrollStyles.contentWrapper}
            >
              {this.props.children}
            </div>
          </div>
        </div>
      </CustomScrollRoot>
    );
  }
}
