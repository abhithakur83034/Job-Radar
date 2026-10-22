import { describe, it, expect, vi } from 'vitest';
import JSZip from 'jszip'; // available as a dependency of mammoth
import {
  parseResumeData,
  extractResumeText,
  extractDateRanges,
  mergedMonths,
  extractYearsExperience,
} from '../src/utils/resumeParser.js';

const NOW = new Date('2026-10-15T00:00:00Z');

/** Build a minimal valid single-page PDF with an uncompressed content stream. */
function makePdf(lines) {
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const content = ['BT', '/F1 11 Tf', '14 TL', '50 760 Td', ...lines.map((l) => `(${esc(l)}) Tj T*`), 'ET'].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefAt = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

/** Build a minimal DOCX (zip with content types, rels and word/document.xml). */
async function makeDocx(paragraphs) {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '</Types>'
  );
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>'
  );
  const body = paragraphs
    .map((p) => `<w:p><w:r><w:t xml:space="preserve">${p.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</w:t></w:r></w:p>`)
    .join('');
  zip.file(
    'word/document.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      `<w:body>${body}</w:body></w:document>`
  );
  return zip.generateAsync({ type: 'nodebuffer' });
}

const PDF_LINES = [
  'Asha Rao',
  'Senior Backend Engineer',
  'Bengaluru, India',
  'Summary',
  'Backend engineer building APIs with Node.js, PostgreSQL, Docker and Kubernetes.',
  'Experience',
  'Senior Backend Engineer, Acme Corp  Jan 2018 - Present',
  'Built Node.js services on PostgreSQL; deployed with Docker on Kubernetes.',
  'Education',
  'B.Tech Computer Science  2013 - 2017',
];

describe('resume parser: PDF', () => {
  it('extracts real text from a PDF via pdf-parse', async () => {
    const pdf = makePdf(PDF_LINES);
    const text = await extractResumeText(pdf, 'resume.pdf');
    expect(text).toContain('Senior Backend Engineer');
    expect(text).toContain('Bengaluru, India');
    // The raw bytes contain PDF operators; real extraction must not.
    expect(text).not.toMatch(/\bTj\b|endobj|%PDF/);
  });

  it('uses pdf-parse (not a raw-bytes fallback) for PDFs', async () => {
    vi.resetModules();
    const calls = [];
    vi.doMock('pdf-parse/lib/pdf-parse.js', async (importOriginal) => {
      const real = (await importOriginal()).default;
      return {
        default: async (...args) => {
          calls.push(args[0].length);
          return real(...args);
        },
      };
    });
    const mod = await import('../src/utils/resumeParser.js');
    const result = await mod.parseResumeData(makePdf(PDF_LINES), 'resume.pdf', { now: NOW });
    expect(calls.length).toBe(1);
    expect(result.keywords).toContain('Node.js');
    vi.doUnmock('pdf-parse/lib/pdf-parse.js');
    vi.resetModules();
  });

  it('parses skills, titles, location, years and seniority from the PDF', async () => {
    const result = await parseResumeData(makePdf(PDF_LINES), 'resume.pdf', { now: NOW });
    expect(result.keywords).toEqual(expect.arrayContaining(['Node.js', 'PostgreSQL', 'Docker', 'Kubernetes']));
    expect(result.titles[0]).toBe('Backend Engineer');
    expect(result.locations).toEqual(['Bengaluru', 'India']);
    // Jan 2018 -> Oct 2026 (education range excluded because it is outside the experience section)
    expect(result.yearsExperience).toBeCloseTo(8.8, 1);
    expect(result.seniority).toBe('senior'); // explicit title word beats years-based "staff"
    expect(result.salaryMin).toBeNull();
    expect(result.salaryMax).toBeNull();
    expect(result.textLength).toBeGreaterThan(100);
    expect(result.summary).toMatch(/^Found \d+ skills, 8\.8 years of experience, roles: Backend Engineer/);
  });

  it('orders skills by frequency', async () => {
    const result = await parseResumeData(makePdf(PDF_LINES), 'resume.pdf', { now: NOW });
    // Node.js, PostgreSQL, Docker, Kubernetes appear twice; REST/others not at all
    expect(result.keywords.slice(0, 4).sort()).toEqual(['Docker', 'Kubernetes', 'Node.js', 'PostgreSQL']);
  });
});

describe('resume parser: DOCX', () => {
  it('extracts text via mammoth from a generated DOCX', async () => {
    const docx = await makeDocx([
      'Rahul Mehta - Full Stack Developer',
      'Pune | Remote',
      'Skills: React, TypeScript, MongoDB, Express, AWS',
      'Work Experience',
      'Full Stack Developer, Foo Ltd  03/2020 - 08/2023',
      'Junior Developer, Bar Inc  06/2019 - 02/2020',
    ]);
    const result = await parseResumeData(docx, 'cv.docx', { now: NOW });
    expect(result.textLength).toBeGreaterThan(0);
    expect(result.keywords).toEqual(expect.arrayContaining(['React', 'TypeScript', 'MongoDB', 'Express', 'AWS']));
    expect(result.titles).toContain('Full Stack Engineer');
    expect(result.locations).toEqual(['Pune', 'Remote']);
    // Jun 2019..Feb 2020 (9 months) + Mar 2020..Aug 2023 (42 months) = 51 months = 4.3y
    expect(result.yearsExperience).toBe(4.3);
    // No principal/staff/senior/lead in titles; "Junior Developer" is an older role, but
    // it is the only explicit seniority word, so it wins over years.
    expect(result.seniority).toBe('entry');
  });
});

describe('resume parser: plain text and edge cases', () => {
  it('reads plain .txt as utf8 and handles aliases', async () => {
    const txt = Buffer.from(
      'Platform engineer.\nWorked with NodeJS, Postgres and k8s in Hyderabad.\n6 years of experience.',
      'utf8'
    );
    const result = await parseResumeData(txt, 'resume.txt', { now: NOW });
    expect(result.keywords).toEqual(expect.arrayContaining(['Node.js', 'PostgreSQL', 'Kubernetes']));
    expect(result.locations).toEqual(['Hyderabad']);
    expect(result.yearsExperience).toBe(6);
    expect(result.seniority).toBe('senior');
  });

  it('empty buffer returns an empty result without throwing', async () => {
    const result = await parseResumeData(Buffer.alloc(0), 'empty.pdf');
    expect(result).toEqual({
      titles: [],
      keywords: [],
      locations: [],
      seniority: null,
      yearsExperience: null,
      salaryMin: null,
      salaryMax: null,
      summary: "Couldn't read text from this file.",
      textLength: 0,
    });
  });

  it('null buffer (filename only) does not invent data from the filename', async () => {
    const result = await parseResumeData(null, 'Senior_Frontend_React_Engineer.pdf');
    expect(result.titles).toEqual([]);
    expect(result.keywords).toEqual([]);
    expect(result.summary).toMatch(/^Couldn't read/);
  });

  it('corrupted PDF does not throw and returns an empty result', async () => {
    const garbage = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.from(Array.from({ length: 4096 }, (_, i) => (i * 37) % 256))]);
    const result = await parseResumeData(garbage, 'broken.pdf');
    expect(result.textLength).toBe(0);
    expect(result.summary).toBe("Couldn't read text from this file.");
    expect(result.keywords).toEqual([]);
  });

  it('garbage bytes named .docx do not throw', async () => {
    const result = await parseResumeData(Buffer.from('PK\u0003\u0004 not really a zip'), 'x.docx');
    expect(result.textLength).toBe(0);
  });

  it('legacy .doc falls back to printable text without throwing', async () => {
    const doc = Buffer.concat([
      Buffer.from('d0cf11e0a1b11ae1', 'hex'),
      Buffer.alloc(64),
      Buffer.from('Python developer with Django and Redis experience', 'utf16le'),
      Buffer.alloc(32, 0xff),
    ]);
    const result = await parseResumeData(doc, 'old.doc');
    expect(result.keywords).toEqual(expect.arrayContaining(['Python', 'Django', 'Redis']));
  });

  it('returns no default title, skills, seniority, location or salary when nothing matches', async () => {
    const result = await parseResumeData(Buffer.from('Hello world. I like gardening and cooking.'), 'notes.txt');
    expect(result.titles).toEqual([]);
    expect(result.keywords).toEqual([]);
    expect(result.locations).toEqual([]);
    expect(result.seniority).toBeNull();
    expect(result.yearsExperience).toBeNull();
    expect(result.salaryMin).toBeNull();
    expect(result.salaryMax).toBeNull();
    expect(result.summary).toBe('Found 0 skills.');
  });

  it('does not count everyday words as skills', async () => {
    const result = await parseResumeData(Buffer.from('I go to the market to rest and express ideas.'), 'a.txt');
    expect(result.keywords).toEqual([]);
  });
});

describe('resume parser: experience dates', () => {
  it('merges overlapping ranges and treats Present as today', () => {
    const text = 'Experience\nAcme  Jan 2019 – Present\nSide gig  Jun 2020 - Dec 2021\nOld Co  2015 - 2018\n';
    const ranges = extractDateRanges(text, NOW);
    expect(ranges).toHaveLength(3);
    // 2015..2018 = 36 months; Jan 2019..Oct 2026 = 94 months; side gig fully overlaps
    expect(mergedMonths(ranges)).toBe(36 + 94);
    expect(extractYearsExperience(text, NOW)).toBe(10.8);
  });

  it('merges partially overlapping ranges', () => {
    expect(mergedMonths([[0, 12], [6, 24], [30, 36]])).toBe(24 + 6);
  });

  it('handles numeric month formats and "Current"', () => {
    const ranges = extractDateRanges('03/2020 – 08/2023, 09/2023 - Current', NOW);
    expect(ranges).toEqual([
      [2020 * 12 + 2, 2023 * 12 + 8],
      [2023 * 12 + 8, 2026 * 12 + 10],
    ]);
  });

  it('explicit years statements are used when there are no dates', () => {
    expect(extractYearsExperience('Engineer with 5+ years of experience in fintech', NOW)).toBe(5);
    expect(extractYearsExperience('Nothing here', NOW)).toBeNull();
  });
});
