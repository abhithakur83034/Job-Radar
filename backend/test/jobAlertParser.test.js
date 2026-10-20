import { describe, it, expect } from 'vitest';
import { parseJobAlertEmail, matchJobUrl } from '../src/utils/jobAlertParser.js';
import { encryptToken, decryptToken } from '../src/utils/tokenCrypto.js';

const LINKEDIN_ALERT = `
<html><head><style>.x{color:red}</style></head><body>
<table>
  <tr><td><a href="https://www.linkedin.com/comm/jobs/view/4012345678/?trackingId=abc&amp;refId=1"><img src="logo.png"></a></td>
      <td><a href="https://www.linkedin.com/comm/jobs/view/4012345678/?trackingId=abc">Senior Frontend Engineer</a>
          <p>Acme Corp &middot; Bengaluru, Karnataka, India (Hybrid)</p>
          <p>Actively recruiting</p></td></tr>
  <tr><td><a href="https://www.linkedin.com/comm/jobs/view/4087654321/">React Developer</a>
          <p>Globex</p><p>Remote</p><p>Easy Apply</p></td></tr>
</table>
<a href="https://www.linkedin.com/comm/jobs/search?keywords=react">See all jobs</a>
<p>You are receiving Job Alert emails. Unsubscribe</p>
</body></html>`;

const NAUKRI_ALERT = `
<div><a href="https://www.naukri.com/job-listings-frontend-developer-initech-pune-3-to-6-years-200125501234?src=jobalert&amp;sid=1">Frontend Developer</a></div>
<div>Initech</div><div>Pune</div><div>8-14 Lacs PA</div>
<div><a href="https://www.naukri.com/job-listings-node-js-engineer-hooli-noida-2-to-5-years-200125509999">Node.js Engineer</a></div>
<div>Hooli</div><div>Noida</div>`;

const INDEED_ALERT = `
<a href="https://cts.indeed.com/v3/redirect?u=https%3A%2F%2Fin.indeed.com%2Frc%2Fclk%2Fdl%3Fjk%3D0123456789abcdef%26from%3Dja">Full Stack Engineer</a>
<span>Umbrella Labs</span> - <span>Hyderabad, Telangana</span>
<a href="https://in.indeed.com/viewjob?jk=fedcba9876543210&amp;from=ja">TypeScript Developer</a>
<span>Wayne Tech</span><span>Chennai</span><a href="https://in.indeed.com/viewjob?jk=fedcba9876543210">Apply now</a>`;

describe('parseJobAlertEmail', () => {
  it('extracts LinkedIn jobs, merging duplicate links and splitting "Company · Location"', () => {
    const jobs = parseJobAlertEmail(LINKEDIN_ALERT);
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({
      source: 'linkedin',
      externalId: '4012345678',
      title: 'Senior Frontend Engineer',
      company: 'Acme Corp',
      location: 'Bengaluru, Karnataka, India (Hybrid)',
      url: 'https://www.linkedin.com/jobs/view/4012345678/',
    });
    expect(jobs[1]).toMatchObject({ title: 'React Developer', company: 'Globex', location: 'Remote' });
  });

  it('extracts Naukri jobs with salary', () => {
    const jobs = parseJobAlertEmail(NAUKRI_ALERT);
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({
      source: 'naukri',
      externalId: '200125501234',
      title: 'Frontend Developer',
      company: 'Initech',
      location: 'Pune',
      salaryText: '8-14 Lacs PA',
      url: 'https://www.naukri.com/job-listings-frontend-developer-initech-pune-3-to-6-years-200125501234',
    });
  });

  it('extracts Indeed jobs, including ones behind a click-tracking redirect', () => {
    const jobs = parseJobAlertEmail(INDEED_ALERT);
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({
      source: 'indeed',
      externalId: '0123456789abcdef',
      title: 'Full Stack Engineer',
      company: 'Umbrella Labs',
      url: 'https://in.indeed.com/viewjob?jk=0123456789abcdef',
    });
    expect(jobs[1]).toMatchObject({ title: 'TypeScript Developer', company: 'Wayne Tech', location: 'Chennai' });
  });

  it('ignores emails without job links', () => {
    expect(parseJobAlertEmail('<p>Your weekly network update</p><a href="https://www.linkedin.com/feed">Feed</a>')).toEqual([]);
    expect(matchJobUrl('https://example.com/jobs/view/123456789')).toBeNull();
  });
});

describe('tokenCrypto', () => {
  const key = Buffer.alloc(32, 7).toString('base64');

  it('round-trips and never stores plaintext', () => {
    const encrypted = encryptToken('1//refresh-token-value', key);
    expect(encrypted).not.toContain('refresh-token-value');
    expect(decryptToken(encrypted, key)).toBe('1//refresh-token-value');
  });

  it('rejects tampered ciphertext and wrong keys', () => {
    const encrypted = encryptToken('secret', key);
    const parts = encrypted.split(':');
    parts[3] = Buffer.from('tampered').toString('base64');
    expect(() => decryptToken(parts.join(':'), key)).toThrow();
    expect(() => decryptToken(encrypted, Buffer.alloc(32, 9).toString('base64'))).toThrow();
  });
});
