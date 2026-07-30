"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

type GenesisFadeInProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

export default function GenesisFadeIn({
  children,
  className,
  delay = 0,
}: GenesisFadeInProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{
        duration: 0.45,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
