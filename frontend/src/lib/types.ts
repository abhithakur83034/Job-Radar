export interface ParsedResume {
  summary: string;
  skills: string[];
  roles: string[];
  experience: string; // freeform text, bullet-per-line
}

export interface SearchProfileInput {
  titles: string[];
  keywords: string[];
  locations: string[];
  seniority: string;
  salaryMin: number | null;
  salaryMax: number | null;
}

export interface MatchScore {
  fit_score: number;
  fit_reason: string;
  matched_skills: string[];
  missing_requirements: string[];
}

export interface TailoredMaterials {
  resume_draft: string; // HTML with <ins>/<del> marking changes
  cover_letter_draft: string;
  changes_made: string[];
}
