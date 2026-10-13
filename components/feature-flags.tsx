"use client"

import { createContext, useContext } from "react"

interface FeatureFlags {
  childPracticeLinks: boolean
  practiceLinkShowcase: boolean
  landingPage: boolean
  masteryBadges: boolean
}

const FeatureFlagsContext = createContext<FeatureFlags>({ childPracticeLinks: false, practiceLinkShowcase: false, landingPage: false, masteryBadges: false })

export function FeatureFlagsProvider({ flags, children }: { flags: FeatureFlags; children: React.ReactNode }) {
  return <FeatureFlagsContext.Provider value={flags}>{children}</FeatureFlagsContext.Provider>
}

export function useFeatureFlags() {
  return useContext(FeatureFlagsContext)
}
