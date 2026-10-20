/**
 * Scores a job listing against a candidate's resume and search profile.
 */
export function scoreListing(resume, profile, listing) {
  const haystack = `${listing.title} ${listing.description}`.toLowerCase();
  
  const resumeSkills = resume?.parsedData?.skills || resume?.skills || [];
  const profileKeywords = profile?.keywords || [];
  const candidateTerms = [...resumeSkills, ...profileKeywords];

  const matched = candidateTerms.filter((term) =>
    haystack.includes(term.toLowerCase())
  );
  const missing = profileKeywords.filter(
    (term) => !haystack.includes(term.toLowerCase())
  );

  const targetTitles = profile?.titles || [];
  const titleAligns = targetTitles.some((t) =>
    listing.title.toLowerCase().includes(t.toLowerCase().split(' ')[0])
  );
  
  const locations = profile?.locations || [];
  const locationAligns = locations.some((l) =>
    listing.location.toLowerCase().includes(l.toLowerCase())
  );

  const base = candidateTerms.length
    ? Math.round((matched.length / candidateTerms.length) * 70)
    : 40;
  const bonus = (titleAligns ? 15 : 0) + (locationAligns ? 15 : 0);
  const fitScore = Math.max(5, Math.min(99, base + bonus));

  const uniqueMatched = Array.from(new Set(matched));
  const uniqueMissing = Array.from(new Set(missing));

  return {
    fitScore,
    fitReason: `${uniqueMatched.length}/${candidateTerms.length || 1} tracked skills present${
      titleAligns ? ', title aligns' : ''
    }${locationAligns ? ', location aligns' : ''}`,
    matchedSkills: uniqueMatched,
    missingRequirements: uniqueMissing,
  };
}

