/**
 * Job-source provider contract (JSDoc reference; every provider module exports one object).
 *
 * @typedef {Object} ProviderQuery
 * @property {string} keywords   e.g. a target job title from a user's search profile
 * @property {string} location   e.g. "Bengaluru"; may be empty
 *
 * @typedef {Object} RawJob      Provider output, mapped to canonical fields by normalizeListing()
 * @property {string} externalId
 * @property {string} title
 * @property {string} [company]
 * @property {string} [location]
 * @property {string} [description]      plain text
 * @property {string} [descriptionHtml]  untrusted HTML; converted to text, never stored as HTML
 * @property {string} [salaryText]
 * @property {number} [salaryMin]
 * @property {number} [salaryMax]
 * @property {string} [salaryCurrency]
 * @property {string} url                canonical job page on the source (keeps attribution/link-back)
 * @property {string} [applyUrl]
 * @property {string|number|Date} [postedAt]
 * @property {string} [employmentType]
 * @property {'remote'|'hybrid'|'onsite'} [remoteType]
 *
 * @typedef {Object} JobProvider
 * @property {string} id                  stored as Job.source; stable, lowercase
 * @property {string} displayName         shown as the source credit next to every listing
 * @property {string} homepage            link-back target for attribution
 * @property {string} terms               where the usage terms were verified (and when)
 * @property {boolean} requiresKey
 * @property {number} minIntervalMinutes  never fetched more often than this (source rate limits)
 * @property {boolean} usesQueries        true if results depend on users' search queries
 * @property {() => boolean} isConfigured
 * @property {(options: { queries: ProviderQuery[] }) => Promise<RawJob[]>} fetchJobs
 *   Throws FetchError on failure; the refresh service isolates each provider's failure.
 */
export {};
