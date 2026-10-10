import React, { useState, useEffect, useRef } from 'react';
import { Identity } from '@semaphore-protocol/identity';
import {
  ArrowRight,
  ArrowUpRight,
  ShieldCheck,
  Fingerprint,
  LockKeyhole,
  EyeOff,
  FlaskConical,
  LayoutDashboard,
  MessageSquare,
  KeyRound,
  Check,
  X,
  Download,
  RefreshCw,
  ChevronRight,
  CircleHelp,
  Globe,
  LogOut,
  AlertTriangle,
  FileCheck2,
  ScanLine,
  LoaderCircle,
} from 'lucide-react';
import { keypair, seal, unseal, lockVault, unlockVault } from '../../packages/crypto/index';
import {
  randomHex,
  TOPICS,
  TOPIC_LABELS,
  DEPARTMENT_LABELS,
  ORGANIZATION,
  privacyWarnings,
  accessVerifierFor,
  receiptBytes,
  MAX_HANDOFFS,
  type Topic,
  type Envelope,
  type Submission,
} from '../../packages/protocol/index';
import {
  api,
  getPolicy,
  browserProof,
  verifySignature,
  verifyLocalAnchor,
  friendly,
  type Policy,
  type CaseVault,
} from './api';
import { verifyInclusion } from '../../packages/audit/merkle';
import './style.css';

type Page = 'home' | 'enroll' | 'report' | 'case' | 'reviewer' | 'lab' | 'privacy';
const nav = [
  { id: 'home', label: 'Overview', icon: LayoutDashboard },
  { id: 'report', label: 'Protected report', icon: ShieldCheck },
  { id: 'case', label: 'My case', icon: MessageSquare },
  { id: 'lab', label: 'Privacy Lab', icon: FlaskConical },
] as const;
export default function App() {
  const [page, setPage] = useState<Page>('home'),
    [policy, setPolicy] = useState<Policy>(),
    [error, setError] = useState('');
  const [identity, setIdentity] = useState(''),
    [vault, setVault] = useState<CaseVault>();
  async function refresh() {
    try {
      setPolicy(await getPolicy());
      setError('');
    } catch (e) {
      setError(friendly(e));
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  const go = (p: Page) => {
    setPage(p);
    window.scrollTo(0, 0);
  };
  return (
    <div className="shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => go('home')}>
          <span className="brandmark">
            <Fingerprint size={25} />
          </span>
          incognito<span className="brand-dot">.</span>
        </button>
        <div className="workspace">
          <span className="org-icon">C</span>
          <div>
            Campus collective<small>DEMO INSTITUTION</small>
          </div>
          <span className="online-dot" />
        </div>
        <div className="nav-caption">YOUR PRIVATE SPACE</div>
        <nav>
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={page === id ? 'nav-item active' : 'nav-item'}
              onClick={() => go(id)}
            >
              <Icon size={18} />
              {label}
              {id === 'lab' && <span className="new-tag">LIVE</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-mini">
            <LockKeyhole size={18} />
            <strong>Your identity stays yours.</strong>
            <p>
              Membership is verified.
              <br />
              Your name is never part of a report.
            </p>
            <button onClick={() => go('privacy')}>
              Understand your privacy <ArrowUpRight size={14} />
            </button>
          </div>
          <button className="nav-item" onClick={() => go('reviewer')}>
            <KeyRound size={17} />
            Reviewer workspace
            <ArrowUpRight size={14} />
          </button>
          <div className="sidebar-foot">Built for voices that matter.</div>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <div className="breadcrumb">
            Campus collective <ChevronRight size={14} />
            <span>
              {page === 'home'
                ? 'Overview'
                : page === 'lab'
                  ? 'Privacy Lab'
                  : page === 'enroll'
                    ? 'Membership'
                    : page === 'case'
                      ? 'Private case'
                      : page === 'privacy'
                        ? 'Transparency'
                        : page === 'reviewer'
                          ? 'Reviewer workspace'
                          : 'Protected report'}
            </span>
          </div>
          <span className="demo-badge">SYNTHETIC DEMO</span>
          <button
            className="icon-button"
            aria-label="Privacy information"
            onClick={() => go('privacy')}
          >
            <CircleHelp size={19} />
          </button>
          <button
            className="avatar"
            onClick={() => go('enroll')}
            aria-label="Manage local membership"
          >
            {identity ? <Check size={18} /> : <Fingerprint size={19} />}
          </button>
        </header>
        <main>
          {error && (
            <div className="error">
              The service is unavailable: {error} <button onClick={refresh}>Retry</button>
            </div>
          )}
          {page === 'home' && <Home policy={policy} go={go} identity={identity} />}
          {page === 'enroll' && (
            <Enrollment identity={identity} setIdentity={setIdentity} onRefresh={refresh} go={go} />
          )}
          {page === 'report' && <Report identity={identity} go={go} setVault={setVault} />}
          {page === 'case' && <CasePage vault={vault} setVault={setVault} />}
          {page === 'reviewer' && <Reviewer />}
          {page === 'lab' && <Lab />}
          {page === 'privacy' && <Privacy />}
        </main>
        <footer>
          <span>
            <LockKeyhole size={13} /> No analytics. No institutional login on reports.
          </span>
          <span>
            Incognito / v0.1 <span className="footer-dot">•</span> Hackathon demonstrator
          </span>
        </footer>
      </div>
    </div>
  );
}
function Home({
  policy,
  go,
  identity,
}: {
  policy?: Policy;
  go: (p: Page) => void;
  identity: string;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="online-dot" /> VERIFIED ANONYMOUS REPORTING
          </div>
          <h1>A safer space to speak up.</h1>
          <p>Your concerns deserve to be heard. Your identity deserves to be protected.</p>
        </div>
        <span className="small-label">
          <Globe size={14} /> Campus collective
        </span>
      </div>
      <section className="hero">
        <div className="hero-copy">
          <div className="pill">
            <ShieldCheck size={14} /> YOUR VOICE. YOUR TERMS.
          </div>
          <h2>
            Prove you belong.
            <br />
            <span>Keep who you are.</span>
          </h2>
          <p>
            Share what matters with your institution.
            <br />
            Verified membership. Encrypted reports.
            <br />A conversation that stays yours.
          </p>
          <div className="hero-actions">
            <button className="primary" onClick={() => go(identity ? 'report' : 'enroll')}>
              Create a protected report <ArrowRight size={17} />
            </button>
            <button className="text-button" onClick={() => go('case')}>
              Check a case <ArrowUpRight size={16} />
            </button>
          </div>
          <div className="hero-note">
            <LockKeyhole size={13} /> Your identity is never attached to your report.
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit orbit-three" />
          <div className="art-cross c1">+</div>
          <div className="art-cross c2">+</div>
          <div className="art-dot d1" />
          <div className="art-dot d2" />
          <div className="shield-core">
            <Fingerprint size={88} strokeWidth={1} />
          </div>
          <div className="floating-label label-top">
            <span className="online-dot" /> Membership verified
          </div>
          <div className="floating-label label-bottom">
            <LockKeyhole size={13} /> Identity undisclosed
          </div>
          <span className="art-coordinate">ZERO KNOWLEDGE · FULL VOICE</span>
        </div>
      </section>
      <div className="metrics">
        <Metric
          icon={<Fingerprint />}
          title="Verified membership"
          value={policy ? `${policy.snapshot.members.length} members` : 'Connecting…'}
          text="One shared anonymity group"
        />
        <Metric
          icon={<LockKeyhole />}
          title="Protected at the source"
          value="Client-side encryption"
          text="Only the reviewer holds the key"
        />
        <Metric
          icon={<ScanLine />}
          title="Independently testable"
          value="Real proof verification"
          text="Semaphore V4 · no simulated proofs"
        />
      </div>
      <div className="section-heading">
        <div>
          <h3>Speaking up, simplified.</h3>
          <p>Four steps. Your identity stays with you.</p>
        </div>
        <button className="text-button muted" onClick={() => go('privacy')}>
          How your privacy works <ArrowUpRight size={15} />
        </button>
      </div>
      <div className="steps">
        {[
          {
            n: '01',
            icon: <Fingerprint />,
            title: 'Verify you belong',
            body: 'Activate a private membership credential on your device.',
          },
          {
            n: '02',
            icon: <MessageSquare />,
            title: 'Share your concern',
            body: 'Write your report and review any identifying details.',
          },
          {
            n: '03',
            icon: <LockKeyhole />,
            title: 'Encrypt & submit',
            body: 'Your browser encrypts your report and proves membership.',
          },
          {
            n: '04',
            icon: <FileCheck2 />,
            title: 'Stay in the loop',
            body: 'Use a private case credential to follow up anonymously.',
          },
        ].map((s) => (
          <article className="step-card" key={s.n}>
            <div className="step-top">
              <span>{s.icon}</span>
              <span className="step-num">{s.n}</span>
            </div>
            <h4>{s.title}</h4>
            <p>{s.body}</p>
          </article>
        ))}
      </div>
      <section className="lab-banner">
        <div className="lab-symbol">
          <FlaskConical size={27} />
        </div>
        <div>
          <div className="eyebrow violet">DON’T JUST TAKE OUR WORD FOR IT</div>
          <h3>Privacy you can put to the test.</h3>
          <p>Watch real security checks run against an isolated synthetic environment.</p>
        </div>
        <button className="secondary" onClick={() => go('lab')}>
          Explore the Privacy Lab <ArrowRight size={16} />
        </button>
      </section>
      <div className="honesty-note">
        <EyeOff size={16} />
        <p>
          Strong privacy starts with clear boundaries. Network metadata, report contents, and
          compromised devices can still identify people.{' '}
          <button onClick={() => go('privacy')}>See what’s protected.</button>
        </p>
      </div>
    </>
  );
}
function Metric({ icon, title, value, text }: any) {
  return (
    <div className="metric">
      <div className="metric-icon">{icon}</div>
      <div>
        <small>{title}</small>
        <strong>{value}</strong>
        <span>{text}</span>
      </div>
    </div>
  );
}
function Heading({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
    </div>
  );
}
function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="notice">
      <ShieldCheck size={18} />
      <div>{children}</div>
    </div>
  );
}
function ErrorBox({ error }: { error: string }) {
  return error ? (
    <div className="error" role="alert">
      {error}
    </div>
  ) : null;
}
function Backup({ data, filename }: { data: unknown; filename: string }) {
  const [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false);
  async function save() {
    try {
      const blob = new Blob([await lockVault(data, password)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setSaved(true);
      setPassword('');
    } catch (e) {
      setError(friendly(e));
    }
  }
  return (
    <div className="backup">
      <label>
        Protect your backup with a passphrase
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 12 characters"
          autoComplete="new-password"
        />
      </label>
      <button className="secondary" onClick={save}>
        <Download size={16} />{' '}
        {saved ? 'Download another encrypted backup' : 'Download encrypted backup'}
      </button>
      {saved && (
        <p className="success-text">Backup exported. Keep it and its passphrase somewhere safe.</p>
      )}
      <ErrorBox error={error} />
    </div>
  );
}
function Restore({ onRestore }: { onRestore: (data: any) => void }) {
  const [serialized, setSerialized] = useState(''),
    [password, setPassword] = useState(''),
    [error, setError] = useState('');
  return (
    <div className="stack">
      <label>
        Encrypted backup file
        <input
          type="file"
          accept=".json"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f && f.size < 200000) setSerialized(await f.text());
          }}
        />
      </label>
      <details>
        <summary>Or paste an encrypted backup</summary>
        <label>
          Encrypted backup JSON
          <textarea
            rows={3}
            maxLength={200000}
            value={serialized}
            onChange={(e) => setSerialized(e.target.value)}
            placeholder="Paste the contents of your encrypted backup file"
          />
        </label>
      </details>
      <label>
        Backup passphrase
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </label>
      <button
        className="secondary"
        disabled={!serialized || !password}
        onClick={async () => {
          try {
            onRestore(await unlockVault(serialized, password));
          } catch {
            setError('Could not unlock this backup. Check the file and passphrase.');
          }
        }}
      >
        Unlock locally <KeyRound size={16} />
      </button>
      <ErrorBox error={error} />
    </div>
  );
}
function Enrollment({
  identity,
  setIdentity,
  onRefresh,
  go,
}: {
  identity: string;
  setIdentity: (s: string) => void;
  onRefresh: () => Promise<void>;
  go: (p: Page) => void;
}) {
  const [rollNumber, setRollNumber] = useState(''),
    [password, setPassword] = useState(''),
    [secret, setSecret] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function enroll() {
    setBusy(true);
    setError('');
    const localSecret = secret || randomHex();
    setSecret(localSecret);
    try {
      await api('/authority/v1/enrollments', 'POST', {
        rollNumber,
        password,
        commitment: new Identity(localSecret).commitment.toString(),
      });
      setIdentity(localSecret);
      setRollNumber('');
      setPassword('');
      await onRefresh();
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="01 / MEMBERSHIP"
        title="A credential. Not a profile."
        text="Create your private identity on this device. The authority checks your roll number and password, then registers only your public commitment for reporting."
      />
      <div className="two-column">
        <section className="panel">
          <h3>{identity ? 'Membership is ready' : 'Activate your membership'}</h3>
          <Notice>
            Enter the roll number and password assigned in the synthetic roster. The enrollment
            authority checks them and registers your public membership commitment. Your private
            identity stays on this device.
          </Notice>
          {identity ? (
            <>
              <p className="success-text">
                <Check size={16} /> Private credential unlocked in memory.
              </p>
              <Backup
                data={{ kind: 'identity', secret: identity }}
                filename="incognito-membership.json"
              />
              <button className="primary" onClick={() => go('report')}>
                Continue to protected reporting <ArrowRight size={16} />
              </button>
              <button className="text-button muted" onClick={() => setIdentity('')}>
                Lock this credential <LogOut size={14} />
              </button>
            </>
          ) : (
            <>
              <label>
                Roll number
                <input
                  autoComplete="username"
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  placeholder="Example: student-04"
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your assigned password"
                />
              </label>
              <button
                className="primary"
                onClick={enroll}
                disabled={!rollNumber || !password || busy}
              >
                {busy ? <LoaderCircle className="spin" size={17} /> : <Fingerprint size={17} />}{' '}
                Create & activate credential
              </button>
              <ErrorBox error={error} />
            </>
          )}
        </section>
        <section className="panel">
          <h3>Already have a credential?</h3>
          <Restore
            onRestore={(data) => {
              if (data.kind !== 'identity' || !/^[0-9a-f]{64}$/.test(data.secret))
                throw new Error('Invalid identity backup');
              setIdentity(data.secret);
            }}
          />
          <details>
            <summary>Use a synthetic seed for testing</summary>
            <p>Paste Alice’s secret from .local/demo-credentials.json. It stays on this device.</p>
            <label>
              Synthetic identity secret
              <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} />
            </label>
            <button
              className="secondary"
              disabled={!/^[0-9a-f]{64}$/.test(secret)}
              onClick={() => setIdentity(secret)}
            >
              Unlock demo identity
            </button>
          </details>
        </section>
      </div>
    </>
  );
}
function Report({
  identity,
  go,
  setVault,
}: {
  identity: string;
  go: (p: Page) => void;
  setVault: (v: CaseVault) => void;
}) {
  const [step, setStep] = useState(0),
    [topic, setTopic] = useState<Topic>('infrastructure'),
    [slot, setSlot] = useState(0),
    [title, setTitle] = useState(''),
    [details, setDetails] = useState(''),
    [reviewed, setReviewed] = useState(false),
    [busy, setBusy] = useState(false),
    [stage, setStage] = useState(''),
    [error, setError] = useState('');
  const warnings = privacyWarnings(`${title}\n${details}`);
  const pending = useRef<
    | {
        submission: Submission;
        vault: CaseVault;
        receiptPublicKey: string;
      }
    | undefined
  >(undefined);
  async function submit() {
    setBusy(true);
    setError('');
    try {
      if (!pending.current) {
        setStage('Checking the signed membership snapshot…');
        const policy = await getPolicy();
        const group = policy.snapshot.members;
        if (!group.includes(new Identity(identity).commitment.toString()))
          throw new Error('This credential is not enrolled in the active group.');
        setStage('Encrypting the report on your device…');
        const replyKeys = await keypair(),
          secret = randomHex(),
          nonce = randomHex();
        const envelope: Envelope = {
          protocolVersion: 'incognito-v1',
          organizationId: ORGANIZATION,
          policyVersion: 1,
          topicId: topic,
          slot,
          period: policy.period,
          keyVersion: 1,
          ciphertext: await seal(
            JSON.stringify({ title, details }),
            policy.departments.find((d) => d.id === policy.topicDepartments[topic])?.publicKey ||
              (() => {
                throw new Error('No authorized department is configured for this category.');
              })(),
          ),
          accessVerifier: await accessVerifierFor(secret),
          replyPublicKey: replyKeys.publicKey,
          nonce,
        };
        const vault: CaseVault = { kind: 'case', secret, replyKeys, nonce };
        setStage('Generating your membership proof locally. This may take a moment…');
        const submission = await browserProof(identity, policy.snapshot, envelope);
        pending.current = { submission, vault, receiptPublicKey: policy.receiptPublicKey };
        setVault(vault);
      }
      const original = pending.current;
      setStage('Verifying the proof and saving your encrypted report…');
      let receipt;
      try {
        ({ receipt } = await api('/v1/reports', 'POST', original.submission));
      } catch (submissionError) {
        // An acknowledged database commit may have lost its HTTP response. Recover only
        // with the original case secret and nonce; never replace those keys on retry.
        try {
          ({ receipt } = await api('/v1/cases/access', 'POST', {
            secret: original.vault.secret,
            nonce: original.vault.nonce,
          }));
        } catch {
          if (
            /^(INVALID_|POLICY_|MESSAGE_|UNAUTHORIZED_|DUPLICATE_)/.test(
              (submissionError as Error).message,
            )
          )
            pending.current = undefined;
          throw submissionError;
        }
      }
      if (
        !(await verifySignature(
          receiptBytes(receipt),
          receipt.signature,
          original.receiptPublicKey,
        ))
      )
        throw new Error('Receipt signature could not be verified. Keep your case backup.');
      setVault({ ...original.vault, receipt });
      pending.current = undefined;
      go('case');
    } catch (e) {
      setError(
        friendly(e) +
          (pending.current
            ? ' Retrying will send the same encrypted request. Your case keys have been retained.'
            : ''),
      );
    } finally {
      setBusy(false);
      setStage('');
    }
  }
  return (
    <>
      <Heading
        eyebrow="PROTECTED REPORT"
        title="Make your voice heard."
        text="Your browser encrypts the content before it leaves this device."
      />
      {!identity ? (
        <section className="panel empty">
          <Fingerprint size={44} />
          <h3>Unlock your membership to begin.</h3>
          <p>A private credential proves you belong without disclosing which member you are.</p>
          <button className="primary" onClick={() => go('enroll')}>
            Set up membership <ArrowRight size={16} />
          </button>
        </section>
      ) : (
        <div className="report-layout">
          <section className="panel report-panel">
            <div className="form-steps">
              {['Category', 'Details', 'Privacy', 'Submit'].map((s, i) => (
                <div key={s} className={i <= step ? 'current' : ''}>
                  <span>{i < step ? <Check size={13} /> : i + 1}</span>
                  {s}
                </div>
              ))}
            </div>
            {step === 0 && (
              <>
                <h3>What is your concern about?</h3>
                <p>Select the category that best describes your report.</p>
                <div className="category-grid">
                  {TOPICS.map((t) => (
                    <button
                      key={t}
                      className={topic === t ? 'category selected' : 'category'}
                      onClick={() => setTopic(t)}
                    >
                      <MessageSquare size={19} />
                      {TOPIC_LABELS[t]}
                      {topic === t && <Check size={16} />}
                    </button>
                  ))}
                </div>
                <label>
                  Monthly reporting slot
                  <select value={slot} onChange={(e) => setSlot(Number(e.target.value))}>
                    {[0, 1, 2].map((n) => (
                      <option key={n} value={n}>
                        Slot {n + 1} of 3
                      </option>
                    ))}
                  </select>
                </label>
                <p className="caption">
                  You can use each slot once per category per UTC month. Slot availability is
                  checked privately at submission.
                </p>
              </>
            )}
            {step === 1 && (
              <>
                <h3>Tell us what happened.</h3>
                <label>
                  Report title
                  <input
                    maxLength={160}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="A clear summary of your concern"
                  />
                </label>
                <label>
                  Description
                  <textarea
                    rows={8}
                    maxLength={10000}
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="Describe what happened, where, and what would help. Avoid details that identify you unless necessary."
                  />
                </label>
                <p className="caption">
                  {details.length.toLocaleString()} / 10,000 characters · Text-only demo. Attachment
                  handling is not enabled.
                </p>
              </>
            )}
            {step === 2 && (
              <>
                <h3>A moment for your privacy.</h3>
                <Notice>
                  These checks run locally. They can flag common patterns, but cannot guarantee that
                  your words won’t identify you.
                </Notice>
                {warnings.length ? (
                  warnings.map((w) => (
                    <div className="warning" key={w}>
                      <AlertTriangle size={18} />
                      {w}
                    </div>
                  ))
                ) : (
                  <div className="success-box">
                    <Check size={17} /> No common email, phone, or ID patterns found.
                  </div>
                )}
                <p>
                  Consider unique events, precise dates, names, and details only you would know.
                  Reviewers can read your report after decrypting it.
                </p>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={reviewed}
                    onChange={(e) => setReviewed(e.target.checked)}
                  />{' '}
                  I’ve reviewed my report for identifying details.
                </label>
              </>
            )}
            {step === 3 && (
              <>
                <h3>Ready when you are.</h3>
                <div className="summary-row">
                  <span>Category</span>
                  <strong>{TOPIC_LABELS[topic]}</strong>
                </div>
                <div className="summary-row">
                  <span>Reporting allowance</span>
                  <strong>Slot {slot + 1} of 3</strong>
                </div>
                <div className="summary-row">
                  <span>Report</span>
                  <strong>{title}</strong>
                </div>
                <Notice>
                  Keep the encrypted case backup after acceptance. It is your way back to this
                  conversation.
                </Notice>
                {busy && (
                  <div className="progress" role="status">
                    <LoaderCircle className="spin" size={20} />
                    {stage}
                  </div>
                )}
              </>
            )}
            <ErrorBox error={error} />
            <div className="form-actions">
              {step > 0 && (
                <button
                  className="secondary"
                  disabled={busy || !!pending.current}
                  onClick={() => setStep(step - 1)}
                >
                  Back
                </button>
              )}
              {step < 3 ? (
                <button
                  className="primary"
                  disabled={
                    (step === 1 && (title.trim().length < 4 || details.trim().length < 20)) ||
                    (step === 2 && !reviewed)
                  }
                  onClick={() => setStep(step + 1)}
                >
                  Continue <ArrowRight size={16} />
                </button>
              ) : (
                <button className="primary" disabled={busy} onClick={submit}>
                  <LockKeyhole size={16} />
                  {busy
                    ? 'Protecting your report…'
                    : pending.current
                      ? 'Retry protected submission'
                      : 'Encrypt, prove & submit'}
                </button>
              )}
            </div>
          </section>
          <aside className="panel side-note">
            <ShieldCheck size={26} />
            <h3>What leaves your device?</h3>
            <p>An encrypted report, a membership proof, and fresh case credentials.</p>
            <hr />
            <h4>What stays with you?</h4>
            <p>Your membership secret, the original plaintext, and your case decryption key.</p>
            <hr />
            <p className="caption">
              This application proves eligibility. It does not prove that an allegation is true.
            </p>
          </aside>
        </div>
      )}
    </>
  );
}
function CasePage({
  vault,
  setVault,
}: {
  vault?: CaseVault;
  setVault: (v: CaseVault | undefined) => void;
}) {
  const [record, setRecord] = useState<any>(),
    [messages, setMessages] = useState<any[]>([]),
    [localMessages, setLocalMessages] = useState<Record<string, string>>({}),
    [text, setText] = useState(''),
    [reopenText, setReopenText] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [integrity, setIntegrity] = useState('');
  async function load(v = vault) {
    if (!v) return;
    try {
      let receipt = v.receipt;
      if (!receipt) {
        const recovered = await api('/v1/cases/access', 'POST', {
          secret: v.secret,
          nonce: v.nonce,
        });
        receipt = recovered.receipt;
        setVault({ ...v, receipt });
      }
      const data = await api(`/v1/cases/${receipt!.caseId}`, 'GET', undefined, v.secret);
      setRecord(data);
      const all = await api<any[]>(
        `/v1/cases/${receipt!.caseId}/messages`,
        'GET',
        undefined,
        v.secret,
      );
      setMessages(
        await Promise.all(
          all.map(async (m) => ({
            ...m,
            text:
              m.direction === 'reviewer'
                ? await unseal(m.ciphertext, v.replyKeys.publicKey, v.replyKeys.privateKey)
                : localMessages[m.id] || 'Your encrypted reply was delivered.',
          })),
        ),
      );
    } catch (e) {
      setError(friendly(e));
    }
  }
  useEffect(() => {
    void load();
  }, [vault?.receipt?.caseId, localMessages]);
  async function send() {
    if (!vault || !record) return;
    setBusy(true);
    try {
      const p = await getPolicy();
      const messageId = crypto.randomUUID();
      const messageText = text.trim();
      await api(
        `/v1/cases/${record.id}/messages`,
        'POST',
        {
          id: messageId,
          ciphertext: await seal(
            messageText,
            p.departments.find((department) => department.id === record.department)?.publicKey ||
              (() => {
                throw new Error('The case department is unavailable.');
              })(),
          ),
        },
        vault.secret,
      );
      setText('');
      await load();
      setLocalMessages((current) => ({ ...current, [messageId]: messageText }));
      setMessages((current) => [
        ...current.filter((message) => message.id !== messageId),
        { id: messageId, direction: 'reporter', text: messageText },
      ]);
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="PRIVATE CASE"
        title={vault?.receipt ? 'Your voice is in safe keeping.' : 'Return to your conversation.'}
        text="Case access is separate from your membership. No institutional login is needed."
      />
      <ErrorBox error={error} />
      {!vault ? (
        <section className="panel narrow">
          <h3>Restore your private case backup</h3>
          <Restore
            onRestore={(v) => {
              if (v.kind !== 'case' || !v.secret || !v.replyKeys)
                throw new Error('Invalid case backup');
              setVault(v);
              void load(v);
            }}
          />
        </section>
      ) : (
        <div className="two-column">
          <section className="panel">
            <div className="panel-title">
              <h3>
                {vault.receipt ? 'Verified submission receipt' : 'Pending submission credential'}
              </h3>
              <span className="status-badge">
                {record?.status || (vault.receipt ? 'submitted' : 'pending')}
              </span>
            </div>
            {record?.status === 'closed' && (
              <Notice>
                <strong>Your case is closed.</strong>
                {record.closureReason && <p>{record.closureReason}</p>}
                {record.reopenRequested ? (
                  <p>Your request to reopen this case is waiting for reviewer action.</p>
                ) : (
                  <>
                    <label>
                      Why do you want to reopen this case?
                      <textarea
                        rows={3}
                        maxLength={5000}
                        value={reopenText}
                        onChange={(e) => setReopenText(e.target.value)}
                        placeholder="Explain what you still need to add or clarify."
                      />
                    </label>
                    <button
                      className="secondary"
                      disabled={!reopenText.trim() || busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await api(
                            `/v1/cases/${record.id}/reopen`,
                            'POST',
                            {
                              reason: reopenText.trim(),
                            },
                            vault.secret,
                          );
                          setReopenText('');
                          await load();
                        } catch (e) {
                          setError(friendly(e));
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Request reopen
                    </button>
                  </>
                )}
              </Notice>
            )}
            {vault.receipt && (
              <>
                <label>
                  Case reference<div className="code-block">{vault.receipt.caseId}</div>
                </label>
                <p className="caption">
                  Signed receipt · accepted {new Date(vault.receipt.acceptedAt).toLocaleString()}
                </p>
                <button
                  className="secondary"
                  onClick={async () => {
                    try {
                      const p = await getPolicy();
                      const verified = await verifySignature(
                        receiptBytes(vault.receipt!),
                        vault.receipt!.signature,
                        p.receiptPublicKey,
                      );
                      const inc = await api(
                        `/v1/cases/${vault.receipt!.caseId}/inclusion`,
                        'GET',
                        undefined,
                        vault.secret,
                      );
                      if (!verified) {
                        setIntegrity('Receipt signature is invalid.');
                        return;
                      }
                      if (!inc.root) {
                        setIntegrity(
                          'Receipt signature verified. Blockchain anchoring is pending.',
                        );
                        return;
                      }
                      const included =
                        inc.commitment === vault.receipt!.commitment &&
                        (await verifyInclusion(inc.commitment, inc.siblings, inc.root));
                      if (!included) {
                        setIntegrity(
                          'Integrity mismatch: the batch does not contain your original receipt commitment.',
                        );
                        return;
                      }
                      const anchored = await verifyLocalAnchor(inc);
                      setIntegrity(
                        anchored
                          ? 'Receipt signature, Merkle inclusion, and local blockchain root independently verified (chain 31337).'
                          : 'Receipt signature and Merkle inclusion verified. Blockchain confirmation is unavailable.',
                      );
                    } catch (e) {
                      setError(friendly(e));
                    }
                  }}
                >
                  <FileCheck2 size={16} /> Verify receipt
                </button>
                {integrity && <Notice>{integrity}</Notice>}
              </>
            )}
            <Backup data={vault} filename="incognito-private-case.json" />
            <p className="caption">
              This credential is only in memory until you download the encrypted backup. Closing
              this tab without a backup loses access.
            </p>
            <button className="text-button muted" onClick={() => load()}>
              <RefreshCw size={15} /> Refresh case status
            </button>
            <button
              className="text-button muted"
              onClick={() => {
                setVault(undefined);
                setRecord(undefined);
                setMessages([]);
                setLocalMessages({});
                setIntegrity('');
              }}
            >
              <X size={15} /> Close case and choose another
            </button>
          </section>
          <section className="panel">
            <h3>Private conversation</h3>
            <div className="messages">
              {messages.length === 0 ? (
                <div className="empty compact">
                  <MessageSquare size={29} />
                  <p>No follow-up messages yet.</p>
                  <span>A reviewer can ask for more information here.</span>
                </div>
              ) : (
                messages.map((m) => (
                  <div className={`message ${m.direction}`} key={m.id}>
                    <small>{m.direction === 'reviewer' ? 'Reviewer' : 'You'}</small>
                    <p>{m.text}</p>
                  </div>
                ))
              )}
            </div>
            <label>
              Your follow-up
              <textarea
                rows={4}
                value={text}
                maxLength={5000}
                onChange={(e) => setText(e.target.value)}
                placeholder="Add information without revealing your identity."
              />
            </label>
            <button
              className="primary"
              disabled={!text.trim() || !record || record.status === 'closed' || busy}
              onClick={send}
            >
              <LockKeyhole size={16} /> Send encrypted reply
            </button>
          </section>
        </div>
      )}
    </>
  );
}
function Reviewer() {
  const [raw, setRaw] = useState(''),
    [credentials, setCredentials] = useState<any>(),
    [cases, setCases] = useState<any[]>([]),
    [handoffs, setHandoffs] = useState<any[]>([]),
    [selected, setSelected] = useState<any>(),
    [selectedHandoff, setSelectedHandoff] = useState<any>(),
    [content, setContent] = useState<any>(),
    [messages, setMessages] = useState<any[]>([]),
    [reply, setReply] = useState(''),
    [closureReason, setClosureReason] = useState(''),
    [handoffTarget, setHandoffTarget] = useState(''),
    [handoffSummary, setHandoffSummary] = useState(''),
    [error, setError] = useState('');
  async function load(c = credentials) {
    try {
      const [caseRows, handoffRows] = await Promise.all([
        api<any[]>('/v1/reviewer/cases', 'GET', undefined, c.token),
        api<any[]>('/v1/reviewer/handoffs', 'GET', undefined, c.token),
      ]);
      setCases(caseRows);
      setHandoffs(handoffRows);
    } catch (e) {
      setError(friendly(e));
    }
  }
  useEffect(() => {
    if (!credentials) return;
    const timer = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(timer);
  }, [credentials]);
  async function open(c: any) {
    try {
      let report: { title: string; details: string };
      try {
        const raw = await unseal(c.ciphertext, credentials.publicKey, credentials.privateKey);
        try {
          report = JSON.parse(raw);
        } catch {
          report = { title: `Case ${c.id.slice(0, 8)}`, details: raw };
        }
      } catch {
        report = { title: `Case ${c.id.slice(0, 8)}`, details: 'Unable to decrypt case content.' };
      }
      setContent(report);
      setSelected(c);
      setSelectedHandoff(undefined);
      const all = await api<any[]>(
        `/v1/reviewer/cases/${c.id}/messages`,
        'GET',
        undefined,
        credentials.token,
      );
      setMessages(
        await Promise.all(
          all.map(async (m) => ({
            ...m,
            text:
              m.direction === 'reporter'
                ? await unseal(m.ciphertext, credentials.publicKey, credentials.privateKey)
                : 'Encrypted reply sent to the reporter.',
          })),
        ),
      );
    } catch (e) {
      setError(friendly(e));
    }
  }
  async function openHandoff(handoff: any) {
    try {
      setContent({
        title: `Handoff from ${handoff.source}`,
        details: await unseal(
          handoff.summaryCiphertext,
          credentials.publicKey,
          credentials.privateKey,
        ),
      });
      setSelected(undefined);
      setSelectedHandoff(handoff);
      setMessages([]);
    } catch (e) {
      setError(friendly(e));
    }
  }
  const transitions: Record<string, string[]> = {
    submitted: ['triaged', 'closed'],
    triaged: ['under-review', 'closed'],
    'under-review': ['awaiting-information', 'resolved', 'closed'],
    'awaiting-information': ['under-review', 'resolved', 'closed'],
    resolved: ['closed'],
    closed: ['under-review'],
  };
  return (
    <>
      <Heading
        eyebrow="AUTHORIZED REVIEW"
        title="Investigate the concern. Protect the voice."
        text="Reports are decrypted locally with your reviewer key. Membership records are not available here."
      />
      <ErrorBox error={error} />
      {!credentials ? (
        <section className="panel narrow">
          <h3>Unlock reviewer workspace</h3>
          <Notice>
            Local demo authentication uses a random bearer credential. OIDC and MFA are required
            before a real pilot.
          </Notice>
          <label>
            Demo reviewer credentials
            <textarea
              rows={5}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="Paste the contents of .local/reviewer/credentials.json"
            />
          </label>
          <button
            className="primary"
            onClick={async () => {
              try {
                const c = JSON.parse(raw);
                if (!c.token || !c.privateKey || !c.publicKey)
                  throw new Error('Invalid credentials');
                setCredentials(c);
                await load(c);
                setRaw('');
              } catch (e) {
                setError(friendly(e));
              }
            }}
          >
            Unlock securely <KeyRound size={16} />
          </button>
        </section>
      ) : (
        <>
          <div className="toolbar">
            <span>
              {cases.length} owned cases · {handoffs.length} incoming handoffs
            </span>
            <button className="secondary" onClick={() => load()}>
              <RefreshCw size={15} /> Refresh
            </button>
            <button
              className="text-button muted"
              onClick={() => {
                setCredentials(undefined);
                setSelected(undefined);
                setContent(undefined);
                setCases([]);
                setHandoffs([]);
                setSelectedHandoff(undefined);
                setMessages([]);
              }}
            >
              Lock workspace <LogOut size={15} />
            </button>
          </div>
          <div className="two-column">
            <section className="panel">
              <h3>Case inbox</h3>
              {cases.length === 0 && (
                <div className="empty compact">
                  <FileCheck2 size={32} />
                  <p>No cases yet. Submit a protected report first.</p>
                </div>
              )}
              {cases.map((c) => {
                const isPending = !!c.pendingHandoff;
                return (
                  <button
                    className={`case-row ${selected?.id === c.id ? 'selected' : ''} ${isPending ? 'pending-handoff' : ''}`}
                    key={c.id}
                    onClick={() => open(c)}
                    title={
                      isPending
                        ? `Waiting for handoff acceptance by ${c.pendingHandoff.target}`
                        : undefined
                    }
                  >
                    <div>
                      <strong>{TOPIC_LABELS[c.topic]}</strong>
                      <small>
                        {c.id.slice(0, 8)} · {new Date(c.createdAt).toLocaleDateString()}
                      </small>
                    </div>
                    {isPending ? (
                      <span className="status-badge pending">waiting for acceptance</span>
                    ) : (
                      <>
                        <span className="status-badge">{c.status}</span>
                        {c.reopenRequested && (
                          <span className="status-badge">reopen requested</span>
                        )}
                        {c.handoffCount > 0 && (
                          <span className="status-badge">handoffs: {c.handoffCount}</span>
                        )}
                      </>
                    )}
                    <ChevronRight size={15} />
                  </button>
                );
              })}
              <h3 className="handoff-inbox-title">Incoming handoffs</h3>
              {handoffs.length === 0 ? (
                <p className="caption">
                  Approved encrypted handoffs from other departments appear here.
                </p>
              ) : (
                handoffs.map((handoff) => (
                  <button
                    className={`case-row ${selectedHandoff?.id === handoff.id ? 'selected' : ''}`}
                    key={handoff.id}
                    onClick={() => openHandoff(handoff)}
                  >
                    <div>
                      <strong>From {handoff.source}</strong>
                      <small>{TOPIC_LABELS[handoff.topic]}</small>
                    </div>
                    <span className="status-badge">{handoff.status}</span>
                    <ChevronRight size={15} />
                  </button>
                ))
              )}
            </section>
            <section className="panel">
              {selectedHandoff && content ? (
                <>
                  <div className="panel-title">
                    <h3>{content.title}</h3>
                    <span className="status-badge">{selectedHandoff.status}</span>
                  </div>
                  <p className="report-text">{content.details}</p>
                  <Notice>
                    This is an encrypted, minimum-necessary handoff summary. The original
                    report remains with the source department.
                  </Notice>
                  {selectedHandoff.status === 'approved' && (
                    <div className="toolbar">
                      <button
                        className="primary"
                        onClick={async () => {
                          try {
                            await api(
                              `/v1/reviewer/handoffs/${selectedHandoff.id}/accept`,
                              'POST',
                              {},
                              credentials.token,
                            );
                            setSelectedHandoff(undefined);
                            await load();
                          } catch (e) {
                            setError(friendly(e));
                          }
                        }}
                      >
                        Accept handoff <Check size={16} />
                      </button>
                      <button
                        className="secondary"
                        onClick={async () => {
                          try {
                            await api(
                              `/v1/reviewer/handoffs/${selectedHandoff.id}/decline`,
                              'POST',
                              {},
                              credentials.token,
                            );
                            setSelectedHandoff(undefined);
                            await load();
                          } catch (e) {
                            setError(friendly(e));
                          }
                        }}
                      >
                        Decline handoff <X size={16} />
                      </button>
                    </div>
                  )}
                </>
              ) : selected && content ? (
                <>
                  <div className="panel-title">
                    <h3>{content.title}</h3>
                    <div className="toolbar">
                      <span className="status-badge">{selected.status}</span>
                      <button
                        className="text-button muted"
                        onClick={() => {
                          setSelected(undefined);
                          setSelectedHandoff(undefined);
                          setContent(undefined);
                          setMessages([]);
                          setReply('');
                        }}
                      >
                        <X size={15} /> Close case
                      </button>
                    </div>
                  </div>
                  <p className="report-text">{content.details}</p>
                  {selected.pendingHandoff ? (
                    <Notice>
                      <strong>Waiting for handoff acceptance.</strong>
                      <p>
                        This case was forwarded to {selected.pendingHandoff.target} on{' '}
                        {new Date(selected.pendingHandoff.createdAt).toLocaleDateString()}. All actions
                        on this case are locked until the destination department accepts or declines.
                      </p>
                    </Notice>
                  ) : (
                    <>
                      <div className="toolbar" style={{ margin: '8px 0' }}>
                        <div className="handoff-history-badge">
                          <ArrowRight size={13} />
                          <span>
                            Handoffs: {selected.handoffCount || 0} / {MAX_HANDOFFS}
                          </span>
                          {selected.handoffHistory?.filter((h: any) => h.status === 'accepted').length > 0 && (
                            <span>
                              (Custody:{' '}
                              {selected.handoffHistory
                                .filter((h: any) => h.status === 'accepted')
                                .map((h: any) => `${h.source} → ${h.target}`)
                                .join(', ')}
                              )
                            </span>
                          )}
                        </div>
                      </div>
                      <Notice>
                        Member eligibility is verified. Reported allegations require independent
                        investigation.
                      </Notice>
                      {(selected.handoffCount || 0) >= MAX_HANDOFFS ? (
                        <Notice>
                          <strong>Maximum handoff limit reached ({MAX_HANDOFFS}).</strong>
                          <p>
                            This case has reached the maximum permitted transfers and cannot be forwarded
                            further.
                          </p>
                        </Notice>
                      ) : (
                        <section className="handoff-composer">
                          <h4>Forward to another department</h4>
                          <p className="caption">
                            Share an encrypted, minimum-necessary summary directly with another department.
                            The original report stays in this department until accepted.
                          </p>
                          <label>
                            Destination department
                            <select
                              value={handoffTarget}
                              onChange={(event) => setHandoffTarget(event.target.value)}
                            >
                              <option value="">Choose a department</option>
                              {Object.entries(DEPARTMENT_LABELS)
                                .filter(([id]) => id !== selected.department)
                                .map(([id, label]) => (
                                  <option key={id} value={id}>
                                    {label}
                                  </option>
                                ))}
                            </select>
                          </label>
                          <label>
                            Encrypted handoff summary
                            <textarea
                              rows={3}
                              maxLength={5000}
                              value={handoffSummary}
                              onChange={(event) => setHandoffSummary(event.target.value)}
                              placeholder="Share only what the other department needs to act."
                            />
                          </label>
                          <button
                            className="secondary small"
                            disabled={!handoffTarget || !handoffSummary.trim()}
                            onClick={async () => {
                              try {
                                const policy = await getPolicy();
                                const destination = policy.departments.find(
                                  (department) => department.id === handoffTarget,
                                );
                                if (!destination) throw new Error('That department is unavailable.');
                                const summary = handoffSummary.trim();
                                await api(
                                  `/v1/reviewer/cases/${selected.id}/handoffs`,
                                  'POST',
                                  {
                                    targetDepartment: destination.id,
                                    summaryCiphertext: await seal(
                                      JSON.stringify({
                                        title: content?.title || `Case ${selected.id.slice(0, 8)}`,
                                        details: summary,
                                      }),
                                      destination.publicKey,
                                    ),
                                  },
                                  credentials.token,
                                );
                                setHandoffSummary('');
                                setHandoffTarget('');
                                await open(selected);
                              } catch (e) {
                                setError(friendly(e));
                              }
                            }}
                          >
                            Forward to department <ArrowRight size={16} />
                          </button>
                        </section>
                      )}
                  {selected.reopenRequested && (
                    <Notice>
                      <strong>Reporter requested a reopen.</strong>
                      {selected.reopenReason && <p>{selected.reopenReason}</p>}
                    </Notice>
                  )}
                  {selected.status !== 'closed' &&
                    (transitions[selected.status] || []).includes('closed') && (
                      <label>
                        Closure summary (required when closing)
                        <textarea
                          rows={3}
                          maxLength={5000}
                          value={closureReason}
                          onChange={(e) => setClosureReason(e.target.value)}
                          placeholder="Explain what was done and why this case is being closed."
                        />
                      </label>
                    )}
                  <div className="toolbar">
                    {(transitions[selected.status] || []).map((s) => (
                      <button
                        className="secondary small"
                        key={s}
                        onClick={async () => {
                          try {
                            await api(
                              `/v1/reviewer/cases/${selected.id}/status`,
                              'PATCH',
                              {
                                status: s,
                                ...(s === 'closed' ? { reason: closureReason.trim() } : {}),
                              },
                              credentials.token,
                            );
                            setSelected({
                              ...selected,
                              status: s,
                              reopenRequested:
                                s === 'under-review' ? false : selected.reopenRequested,
                            });
                            setClosureReason('');
                            await load();
                          } catch (e) {
                            setError(friendly(e));
                          }
                        }}
                        disabled={s === 'closed' && !closureReason.trim()}
                      >
                        {s.replaceAll('-', ' ')}
                      </button>
                    ))}
                  </div>
                  <hr />
                  <h4>Anonymous follow-up</h4>
                  {messages.map((m) => (
                    <div className="message" key={m.id}>
                      <small>{m.direction}</small>
                      <p>{m.text}</p>
                    </div>
                  ))}
                  <label>
                    Reply to reporter
                    <textarea
                      rows={3}
                      maxLength={5000}
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                    />
                  </label>
                  <button
                    className="primary"
                    disabled={!reply.trim()}
                    onClick={async () => {
                      try {
                        await api(
                          `/v1/reviewer/cases/${selected.id}/messages`,
                          'POST',
                          {
                            id: crypto.randomUUID(),
                            ciphertext: await seal(reply, selected.replyPublicKey),
                          },
                          credentials.token,
                        );
                        setReply('');
                        await open(selected);
                      } catch (e) {
                        setError(friendly(e));
                      }
                    }}
                  >
                    Send encrypted question <ArrowRight size={16} />
                  </button>
                </>
              )}
            </>
          ) : (
                <div className="empty">
                  <LockKeyhole size={36} />
                  <h3>Select a case to decrypt.</h3>
                  <p>The reporting service cannot read these contents.</p>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}
function Lab() {
  const [run, setRun] = useState<any>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <>
      <Heading
        eyebrow="PRIVACY VERIFICATION LAB"
        title="Trust, with evidence."
        text="Real cryptography. Real attack attempts. Results from an isolated database with fresh synthetic identities."
      />
      <div className="lab-control panel">
        <div className="lab-symbol">
          <FlaskConical size={30} />
        </div>
        <div>
          <h3>
            {run
              ? `${run.passed} / ${run.total} checks passed`
              : 'Make the safeguards prove themselves.'}
          </h3>
          <p>
            {busy
              ? 'Generating proofs and executing adversarial requests. This can take a minute.'
              : run
                ? `Executed ${new Date(run.executedAt).toLocaleString()} · ${(run.durationMs / 1000).toFixed(1)} seconds`
                : 'No results are prefilled. Run the suite to see actual evidence.'}
          </p>
        </div>
        <button
          className="primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              setRun(await api('/v1/lab/run', 'POST', {}));
            } catch (e) {
              setError(friendly(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <LoaderCircle className="spin" size={17} /> : <FlaskConical size={17} />}{' '}
          {busy ? 'Tests running…' : 'Run security checks'}
        </button>
      </div>
      <ErrorBox error={error} />
      {run && (
        <div className="test-list">
          {run.results.map((r: any) => (
            <details className="test-row" key={r.id}>
              <summary>
                <span className={r.passed ? 'pass-icon' : 'fail-icon'}>
                  {r.passed ? <Check size={17} /> : <X size={17} />}
                </span>
                <code>{r.id}</code>
                <strong>{r.name}</strong>
                <span className="test-time">{r.durationMs} ms</span>
                <span className={r.passed ? 'passed' : 'failed'}>{r.passed ? 'PASS' : 'FAIL'}</span>
              </summary>
              <p>{r.evidence}</p>
            </details>
          ))}
        </div>
      )}
      <div className="two-column">
        <section className="panel">
          <h3>Configuration reviews</h3>
          <p>
            Separate operators, host logging, reviewer key custody, recovery, and deployment
            permissions require review. They are not marked as “passed” by these tests.
          </p>
        </section>
        <section className="panel">
          <h3>Residual privacy risks</h3>
          <p>
            Network observation, small groups, revealing report content, issuer collusion, and
            malicious frontend changes remain outside these automated guarantees.
          </p>
        </section>
      </div>
    </>
  );
}
function Privacy() {
  return (
    <>
      <Heading
        eyebrow="PRIVACY & TRANSPARENCY"
        title="Clear promises. Honest boundaries."
        text="Understand exactly what this demonstrator protects, and where trust is still required."
      />
      <div className="two-column">
        <section className="panel">
          <h3>What the system demonstrates</h3>
          <ul className="feature-list">
            <li>
              Real Semaphore proofs establish membership without disclosing the member’s commitment.
            </li>
            <li>Different category and slot scopes produce different nullifiers.</li>
            <li>
              Database uniqueness prevents duplicate acceptance, including concurrent requests.
            </li>
            <li>Reports and messages are encrypted in the browser to the recipient’s key.</li>
            <li>Case access uses a fresh secret, separate from institutional membership.</li>
            <li>Signed receipts let you detect modification of accepted commitments.</li>
          </ul>
        </section>
        <section className="panel">
          <h3>What it cannot guarantee</h3>
          <ul className="feature-list">
            <li>Hiding your IP address or traffic timing from hosting infrastructure.</li>
            <li>Preventing identification from distinctive report contents.</li>
            <li>Protecting secrets on a compromised device or malicious browser client.</li>
            <li>Preventing collusion by people operating enrollment and reporting systems.</li>
            <li>Proving that a report is true or that an investigation will be fair.</li>
            <li>Production readiness from a synthetic hackathon demo alone.</li>
          </ul>
        </section>
      </div>
      <Notice>
        Use synthetic data only. This demo shares one development host; independent operational
        control, OIDC/MFA, protected key custody, evidence scanning, and external security review
        remain pilot requirements.
      </Notice>
    </>
  );
}
