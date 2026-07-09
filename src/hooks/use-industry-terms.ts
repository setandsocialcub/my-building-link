import { useBranding } from "@/components/BrandingProvider";
import { terminologyFor, type IndustryTerminology, type IndustryType } from "@/lib/industry";

/**
 * Reads the current building's industry mode and returns the terminology
 * map. Safe to call in any component under `BrandingProvider`.
 */
export function useIndustryTerms(): IndustryTerminology & { industry: IndustryType | null } {
  const { industry } = useBranding();
  return { ...terminologyFor(industry), industry };
}
