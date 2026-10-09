"use client";

import type { ReactNode, ComponentProps } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination, Autoplay, Keyboard, A11y } from "swiper/modules";

export { Swiper, SwiperSlide } from "swiper/react";

export interface CarouselProps<T> extends Omit<ComponentProps<typeof Swiper>, "children" | "modules"> {
  items: readonly T[];
  getKey: (item: T, index: number) => string | number;
  renderSlide: (item: T, index: number) => ReactNode;
}

/** Swiper CSS is imported by the host app to keep server entry points free of global styles. */
export function Carousel<T>({ items, getKey, renderSlide, navigation = true,
  pagination = { clickable: true }, keyboard = { enabled: true }, ...props }: CarouselProps<T>) {
  return <Swiper modules={[Navigation, Pagination, Autoplay, Keyboard, A11y]}
    navigation={navigation} pagination={pagination} keyboard={keyboard} {...props}>
    {items.map((item, index) => <SwiperSlide key={getKey(item, index)}>{renderSlide(item, index)}</SwiperSlide>)}
  </Swiper>;
}
