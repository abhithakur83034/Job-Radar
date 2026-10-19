// Common shape every source connector normalizes into, per
// "7.2 Continuous Monitoring Workflow, STEP 2: New listings are normalized"
// in the project documentation.
export interface NormalizedListing {
  source: string;
  externalId: string;
  title: string;
  company: string;
  location: string;
  description: string;
  salaryText: string | null;
  url: string;
}

export interface SourceConnector {
  source: string;
  fetchListings(): Promise<NormalizedListing[]>;
}
