import { describe, it, expect } from 'vitest';
import { scoreListing, titleSimilarity, canonicalSkill } from '../src/utils/scoring.js';

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

    expect(result.fitReason).toMatch(/^2\/4 tracked skills present/);
    expect(result.matchedSkills).toEqual(['React', 'TypeScript']);
  });

  it('gives a strong score to a matching title, skills and location', () => {
    const profile = { keywords: ['React'], titles: ['Senior Engineer, Frontend'], locations: ['Remote'] };
    const result = scoreListing(null, profile, listing);
    expect(result.fitScore).toBe(99); // 40 + 45 + 15, capped at 99
    expect(result.fitReason).toBe('1/1 tracked skills present, title aligns, location aligns');
  });

  it('matches skill aliases as whole words', () => {
    const profile = { keywords: ['Node.js', 'PostgreSQL', 'Kubernetes', 'Java', 'Go'], titles: ['Backend Engineer'] };
    const job = {
      title: 'Backend Developer',
      description: 'Node and Postgres on k8s. We value good JavaScript skills.',
      location: 'Pune',
    };
    const result = scoreListing(null, profile, job);
    expect(result.matchedSkills).toEqual(['Node.js', 'PostgreSQL', 'Kubernetes']);
    expect(result.missingRequirements).toEqual(['Java', 'Go']); // not "JavaScript" / "good"
  });

  it('does not treat the "js" in Node.js or Next.js as JavaScript', () => {
    const profile = { keywords: ['JavaScript'], titles: ['Frontend Engineer'] };
    const result = scoreListing(null, profile, { title: 'Frontend Engineer', description: 'Next.js and Node.js', location: '' });
    expect(result.matchedSkills).toEqual([]);
  });

  it('keeps a relevant role above threshold when it mentions only some skills', () => {
    const profile = {
      keywords: ['Node.js', 'TypeScript', 'Express', 'MongoDB', 'PostgreSQL'],
      titles: ['Backend Engineer'],
      locations: ['Remote'],
    };
    const job = { title: 'Senior Software Engineer, Backend', description: 'Go services, some TypeScript.', location: 'Remote, US' };
    expect(scoreListing(null, profile, job).fitScore).toBeGreaterThanOrEqual(65);
  });

  it('caps listings with unrelated titles, even if a keyword matches', () => {
    const profile = { keywords: ['Python'], titles: ['DevOps / Cloud Engineer'], locations: ['Remote'] };
    const job = { title: 'Deskside Support Engineer', description: 'Python scripting a plus', location: 'Remote' };
    expect(scoreListing(null, profile, job).fitScore).toBeLessThanOrEqual(55);
  });

  it('matches remote jobs for a "Remote" location preference', () => {
    const profile = { keywords: [], titles: ['Frontend Engineer'], locations: ['Remote'] };
    const result = scoreListing(null, profile, { title: 'Frontend Engineer', location: 'Worldwide', remoteType: 'remote' });
    expect(result.fitReason).toMatch(/location aligns/);
  });
});

describe('titleSimilarity', () => {
  it('normalises spelling variants and ignores seniority words', () => {
    expect(titleSimilarity('Backend Engineer', 'Senior Back-end Developer')).toBe(1);
    expect(titleSimilarity('Senior Frontend Engineer', 'Front End Software Engineer, Media Player')).toBe(1);
    expect(titleSimilarity('Backend Engineer', 'Frontend Engineer')).toBeLessThan(0.34);
  });
});

describe('canonicalSkill', () => {
  it('maps aliases to one skill', () => {
    expect(canonicalSkill('NodeJS')).toBe('node.js');
    expect(canonicalSkill('Postgres')).toBe('postgresql');
    expect(canonicalSkill('Rust')).toBe('rust');
  });
});
