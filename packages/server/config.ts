import { readFileSync } from 'node:fs';
import {
  DEPARTMENT_LABELS,
  TOPIC_DEPARTMENTS,
  type DepartmentId,
  type Topic,
} from '../protocol/index';

export type DepartmentConfig = {
  id: DepartmentId;
  label: string;
  publicKey: string;
};
export type ReviewerConfig = {
  id: string;
  name: string;
  departmentId: DepartmentId;
  token: string;
};
export type ApiConfig = {
  authorityPublicKey: string;
  receiptPrivateKey: string;
  receiptPublicKey: string;
  /** Legacy single-reviewer fields are retained so existing synthetic data still starts. */
  reviewerPublicKey?: string;
  reviewerToken?: string;
  reviewerTopics?: string[];
  departments?: DepartmentConfig[];
  reviewers?: ReviewerConfig[];
  topicDepartments?: Record<Topic, DepartmentId>;
  snapshot: import('../protocol/index').Snapshot;
};
export function config(): ApiConfig {
  return JSON.parse(readFileSync('.local/reporting-config.json', 'utf8'));
}

export function configuredDepartments(value: ApiConfig): DepartmentConfig[] {
  if (value.departments?.length) return value.departments;
  if (!value.reviewerPublicKey) throw new Error('Reviewer recipient configuration is missing');
  return [
    {
      id: 'ombuds-office',
      label: 'Reviewer workspace',
      publicKey: value.reviewerPublicKey,
    },
  ];
}
export function configuredReviewers(value: ApiConfig): ReviewerConfig[] {
  if (value.reviewers?.length) return value.reviewers;
  if (!value.reviewerToken) throw new Error('Reviewer authentication configuration is missing');
  return [
    {
      id: 'legacy-reviewer',
      name: 'Demo reviewer',
      departmentId: 'ombuds-office',
      token: value.reviewerToken,
    },
  ];
}
export function departmentForTopic(value: ApiConfig, topic: Topic): DepartmentId {
  if (value.topicDepartments?.[topic]) return value.topicDepartments[topic];
  // Existing one-reviewer setups retain access to every legacy topic.
  if (!value.departments?.length) return 'ombuds-office';
  return TOPIC_DEPARTMENTS[topic];
}
export function departmentLabel(value: ApiConfig, id: DepartmentId) {
  return (
    configuredDepartments(value).find((department) => department.id === id)?.label ??
    DEPARTMENT_LABELS[id]
  );
}
export function activeDepartmentForCase(
  value: ApiConfig,
  row: { current_department?: string | null; topic: Topic | string },
): DepartmentId {
  if (row.current_department) return row.current_department as DepartmentId;
  return departmentForTopic(value, row.topic as Topic);
}
