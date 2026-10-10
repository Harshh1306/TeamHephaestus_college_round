import { readFileSync } from 'node:fs';
export type ApiConfig = {
  authorityPublicKey: string;
  receiptPrivateKey: string;
  receiptPublicKey: string;
  reviewerPublicKey: string;
  reviewerToken: string;
  reviewerTopics: string[];
  snapshot: import('../protocol/index').Snapshot;
};
export function config(): ApiConfig {
  return JSON.parse(readFileSync('.local/reporting-config.json', 'utf8'));
}
