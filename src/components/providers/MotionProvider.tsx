"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/** Turns off transform animations for visitors who prefer reduced motion. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
