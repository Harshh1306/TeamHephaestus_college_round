import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Heart,
  MessageSquare,
  RefreshCw,
  UsersRound,
} from 'lucide-react';
import { randomHex, TOPIC_LABELS, privacyWarnings } from '../../packages/protocol/index';
import { api, browserPublicProof, friendly, getPolicy } from './api';

type PublicCase = {
  id: string;
  topic: string;
  title: string | null;
  summary: string;
  supportCount: number;
  supportThreshold: number;
  comments: { text: string; createdAt: string }[];
  createdAt: string;
};

export default function PublicCases({
  identity,
  onEnroll,
}: {
  identity: string;
  onEnroll: () => void;
}) {
  const [cases, setCases] = useState<PublicCase[]>([]);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function proofFor(
    signal:
      | { action: 'list'; nonce: string }
      | { action: 'support' | 'comment'; caseId: string; text?: string },
  ) {
    const policy = await getPolicy();
    return browserPublicProof(identity, policy.snapshot, signal);
  }
  async function load() {
    if (!identity) return;
    setLoading(true);
    setError('');
    try {
      const nonce = randomHex();
      const proof = await proofFor({ action: 'list', nonce });
      setCases(await api<PublicCase[]>('/v1/public-cases/list', 'POST', { nonce, proof }));
    } catch (cause) {
      setError(friendly(cause));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [identity]);

  async function support(caseId: string) {
    setBusy(caseId);
    setError('');
    setSuccess('');
    try {
      const proof = await proofFor({ action: 'support', caseId });
      const result = await api<{ supportCount: number }>(
        `/v1/public-cases/${caseId}/support`,
        'POST',
        { proof },
      );
      setCases((current) =>
        current
          .map((item) =>
            item.id === caseId ? { ...item, supportCount: result.supportCount } : item,
          )
          .sort(
            (a, b) => b.supportCount - a.supportCount || b.createdAt.localeCompare(a.createdAt),
          ),
      );
      setSuccess('Your anonymous support was counted.');
    } catch (cause) {
      setError(friendly(cause));
    } finally {
      setBusy('');
    }
  }

  async function comment(caseId: string) {
    const text = (comments[caseId] || '').trim();
    if (text.length < 3 || text.length > 800) return;
    setBusy(caseId);
    setError('');
    setSuccess('');
    try {
      const proof = await proofFor({ action: 'comment', caseId, text });
      await api(`/v1/public-cases/${caseId}/comments`, 'POST', { text, proof });
      setCases((current) =>
        current.map((item) =>
          item.id === caseId
            ? {
                ...item,
                comments: [...item.comments, { text, createdAt: new Date().toISOString() }],
              }
            : item,
        ),
      );
      setComments((current) => ({ ...current, [caseId]: '' }));
      setSuccess('Your anonymous comment is visible to members.');
    } catch (cause) {
      setError(friendly(cause));
    } finally {
      setBusy('');
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">MEMBER COMMUNITY</div>
          <h1>Public cases</h1>
          <p>
            See the summaries reporters chose to share. Full reports and private conversations stay
            with their cases.
          </p>
        </div>
      </div>
      {!identity ? (
        <section className="panel narrow">
          <h3>Unlock membership to view public cases</h3>
          <p>Only verified members can view, support, or comment on these summaries.</p>
          <button className="primary" onClick={onEnroll}>
            Unlock membership <ArrowRight size={16} />
          </button>
        </section>
      ) : (
        <>
          <div className="toolbar">
            <span>{cases.length} member-visible cases</span>
            <button className="secondary" onClick={load} disabled={loading || !!busy}>
              <RefreshCw size={15} /> {loading ? 'Verifying membership…' : 'Refresh cases'}
            </button>
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {success && (
            <div className="success-box" role="status">
              {success}
            </div>
          )}
          {!loading && cases.length === 0 && (
            <section className="panel empty">
              <UsersRound size={33} />
              <h3>No public cases yet</h3>
              <p>
                A reporter can choose to share a summary while keeping their full report private.
              </p>
            </section>
          )}
          <div className="public-case-list">
            {cases.map((item) => (
              <section className="panel public-case-card" key={item.id}>
                <div className="panel-title">
                  <div>
                    <span className="eyebrow">{TOPIC_LABELS[item.topic] || item.topic}</span>
                    <h3>
                      {item.title ||
                        `${item.summary.slice(0, 120)}${item.summary.length > 120 ? '…' : ''}`}
                    </h3>
                  </div>
                  <span className="support-count">
                    <Heart size={17} /> {item.supportCount} supporters
                  </span>
                </div>
                <p className="public-summary">{item.summary}</p>
                <p className="caption">
                  {Math.min(item.supportCount, item.supportThreshold)} of {item.supportThreshold}{' '}
                  supports toward urgent reviewer priority.
                </p>
                <p className="caption">
                  Shared {new Date(item.createdAt).toLocaleDateString()} · Only this summary is
                  visible here.
                </p>
                <button
                  className="primary"
                  disabled={!!busy || loading}
                  onClick={() => support(item.id)}
                >
                  <Heart size={16} /> {busy === item.id ? 'Verifying…' : 'Support this case'}
                </button>
                <div className="public-comments">
                  <h4>
                    <MessageSquare size={16} /> Member comments ({item.comments.length})
                  </h4>
                  {item.comments.length === 0 ? (
                    <p className="caption">
                      No comments yet. Supporting does not require a comment.
                    </p>
                  ) : (
                    item.comments.map((entry, index) => (
                      <div className="public-comment" key={`${item.id}-${index}`}>
                        <small>
                          Anonymous member · {new Date(entry.createdAt).toLocaleDateString()}
                        </small>
                        <p>{entry.text}</p>
                      </div>
                    ))
                  )}
                  <label>
                    Share how this relates to you (optional)
                    <textarea
                      rows={3}
                      maxLength={800}
                      value={comments[item.id] || ''}
                      onChange={(event) =>
                        setComments((current) => ({ ...current, [item.id]: event.target.value }))
                      }
                      placeholder="Avoid names or details that could identify you or someone else."
                    />
                  </label>
                  {privacyWarnings(comments[item.id] || '').map((warning) => (
                    <div className="warning" key={warning}>
                      <AlertTriangle size={15} />
                      {warning}
                    </div>
                  ))}
                  <p className="caption">
                    Comments are visible to every member. You can post one anonymous comment per
                    case.
                  </p>
                  <button
                    className="secondary"
                    disabled={!!busy || (comments[item.id] || '').trim().length < 3}
                    onClick={() => comment(item.id)}
                  >
                    <MessageSquare size={15} /> Post anonymous comment
                  </button>
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </>
  );
}
