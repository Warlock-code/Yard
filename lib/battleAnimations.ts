"use client"

import { Variants, Transition } from "framer-motion"

export const voteBurstVariants: Variants = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: [0, 1.3, 1],
    opacity: [0, 1, 1],
    transition: { duration: 0.4, ease: "easeOut" },
  },
  exit: {
    scale: 0.8,
    opacity: 0,
    transition: { duration: 0.2, ease: "easeIn" },
  },
}

export const voteParticleVariants: Variants = {
  hidden: { x: 0, y: 0, scale: 0, opacity: 0 },
  visible: (i: number) => ({
    x: (Math.random() - 0.5) * 100,
    y: -Math.random() * 120 - 40,
    scale: [0, 1, 0],
    opacity: [0, 1, 0],
    transition: {
      duration: 0.8 + Math.random() * 0.4,
      ease: "easeOut",
      delay: Math.random() * 0.1,
    },
  }),
}

export const winnerCelebrationVariants: Variants = {
  hidden: { scale: 0.8, opacity: 0, y: 20 },
  visible: {
    scale: [0.8, 1.05, 1],
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.34, 1.56, 0.64, 1],
    },
  },
  pulse: {
    scale: [1, 1.03, 1],
    transition: { duration: 2, repeat: Infinity, ease: "easeInOut" },
  },
}

export const entryRevealVariants: Variants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94],
      delay: index * 0.08,
    },
  }),
}

export const bracketLineVariants: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: { duration: 0.8, ease: "easeInOut", delay: 0.2 },
  },
}

export const bracketNodeVariants: Variants = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: [0, 1.2, 1],
    opacity: 1,
    transition: { duration: 0.4, ease: "easeOut" },
  },
  winner: {
    scale: [1, 1.1, 1],
    boxShadow: ["0 0 0 rgba(186,255,57,0)", "0 0 24px rgba(186,255,57,0.6)", "0 0 12px rgba(186,255,57,0.4)"],
    transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" },
  },
}

export const voteCountVariants: Variants = {
  initial: { scale: 1 },
  voted: {
    scale: [1, 1.3, 1],
    transition: { duration: 0.3, ease: "easeOut" },
  },
  liveUpdate: {
    scale: [1, 1.15, 1],
    transition: { duration: 0.4, ease: "easeOut" },
  },
}

export const confettiVariants: Variants = {
  hidden: { y: 0, opacity: 1, rotate: 0, scale: 1 },
  visible: (i: number) => ({
    y: -window.innerHeight - 100,
    opacity: [1, 1, 0],
    rotate: Math.random() * 720 - 360,
    scale: [1, 0.5, 0],
    transition: {
      duration: 2 + Math.random() * 1.5,
      ease: "easeOut",
      delay: Math.random() * 0.3,
    },
  }),
}

export const shimmerVariants: Variants = {
  hidden: { x: "-100%" },
  visible: {
    x: "100%",
    transition: { duration: 1.5, repeat: Infinity, ease: "linear" },
  },
}

export const slideUpVariants: Variants = {
  hidden: { y: "100%", opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  exit: {
    y: "-100%",
    opacity: 0,
    transition: { duration: 0.3, ease: "easeIn" },
  },
}

export const scaleInVariants: Variants = {
  hidden: { scale: 0.9, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { duration: 0.3, ease: "easeOut" },
  },
}

export const pulseGlowVariants: Variants = {
  pulse: {
    boxShadow: [
      "0 0 0 rgba(186,255,57,0)",
      "0 0 20px rgba(186,255,57,0.4)",
      "0 0 0 rgba(186,255,57,0)",
    ],
    transition: { duration: 2, repeat: Infinity, ease: "easeInOut" },
  },
}

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
}

export function getVoteBurstTransition(): Transition {
  return { duration: 0.4, ease: "easeOut" }
}

export function getWinnerTransition(): Transition {
  return { duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }
}

export function getStaggerDelay(index: number): number {
  return index * 0.08
}

export const roundTransitionVariants: Variants = {
  hidden: { opacity: 0, x: 50 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    x: -50,
    transition: { duration: 0.3, ease: "easeIn" },
  },
}

export const notificationToastVariants: Variants = {
  hidden: { y: -100, opacity: 0, scale: 0.9 },
  visible: {
    y: 0,
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: [0.34, 1.56, 0.64, 1] },
  },
  exit: {
    y: -100,
    opacity: 0,
    scale: 0.9,
    transition: { duration: 0.3, ease: "easeIn" },
  },
}