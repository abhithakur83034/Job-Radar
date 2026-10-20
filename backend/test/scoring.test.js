import { describe, it, expect } from 'vitest';
import { scoreListing } from '../src/utils/scoring.js';

const listing = {
  title: 'Senior Frontend Engineer',
  description: 'We use React, TypeScript and GraphQL.',
  location: 'Remote - United States',
};

describe('scoreListing', () => {
  it('counts a skill present in both résumé and profile only once', () => {
    const resume = { parsedData: { skills: ['React', 'TypeScript', 'Go'] } };
    const profile = { keywords: ['react', 'typescript', 'Rust'], titles: [], locations: [] };

    const result = scoreListing(resume, profile, listing);

    // Unique terms: react, typescript, go, rust -> 2 of 4 matched -> 35
    expect(result.fitScore).toBe(35);
    expect(result.fitReason).toBe('2/4 tracked skills present');
    expect(result.matchedSkills).toEqual(['React', 'TypeScript']);
  });

  it('adds title and location bonuses', () => {
    const profile = { keywords: ['React'], titles: ['Senior Engineer'], locations: ['Remote'] };

    const result = scoreListing(null, profile, listing);

    expect(result.fitScore).toBe(99); // 70 + 15 + 15, capped at 99
    expect(result.fitReason).toBe('1/1 tracked skills present, title aligns, location aligns');
  });
});
