"use client"

import { createContext, useContext } from "react"

interface FeatureFlags {
  childPracticeLinks: boolean
  practiceLinkShowcase: boolean
  landingPage: boolean
}

const FeatureFlagsContext = createContext<FeatureFlags>({ childPracticeLinks: false, practiceLinkShowcase: false, landingPage: false })

export function FeatureFlagsProvider({ flags, children }: { flags: FeatureFlags; children: React.ReactNode }) {
  return <FeatureFlagsContext.Provider value={flags}>{children}</FeatureFlagsContext.Provider>
}

export function useFeatureFlags() {
  return useContext(FeatureFlagsContext)
}
