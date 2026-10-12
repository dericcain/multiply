import { flag } from "flags/next"
import { vercelAdapter } from "@flags-sdk/vercel"

// Keep declarations on the server. Missing configuration or provider failures
// leave unreleased features disabled; pass only evaluated booleans to clients.
export const childPracticeLinks = flag<boolean>({
  key: "child-practice-links",
  description: "Allow parents to share practice links so children can play without a parent login.",
  defaultValue: false,
  adapter: vercelAdapter,
  options: [{ value: false, label: "Off" }, { value: true, label: "On" }],
})
