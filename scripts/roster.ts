import { randomInt } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { hashPassword } from '../packages/server/passwords';

type Member = {
  id: string;
  passwordHash: string;
  commitment?: string;
  revoked?: boolean;
};

type Ledger = {
  epoch: number;
  members: Member[];
  signingKey: string;
  adminToken: string;
};

type Credentials = {
  warning: string;
  members: unknown[];
  enrollment: { rollNumber: string; password: string }[];
  reviewerFile: string;
};

const ledgerPath = '.local/authority/ledger.json';
const credentialsPath = '.local/demo-credentials.json';

function password() {
  return String(randomInt(10000, 100000));
}

async function save(path: string, value: unknown) {
  const temporary = `${path}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2));
  await rename(temporary, path);
}

async function load() {
  return {
    ledger: JSON.parse(await readFile(ledgerPath, 'utf8')) as Ledger,
    credentials: JSON.parse(await readFile(credentialsPath, 'utf8')) as Credentials,
  };
}

async function writeRoster(
  ledger: Ledger,
  credentials: Credentials,
  passwords: Map<string, string>,
) {
  ledger.members = ledger.members.map((member) => ({
    ...member,
    passwordHash: hashPassword(passwords.get(member.id)!),
  }));
  credentials.enrollment = ledger.members.map((member) => ({
    rollNumber: member.id,
    password: passwords.get(member.id)!,
  }));
  await save(ledgerPath, ledger);
  await save(credentialsPath, credentials);
}

async function reset() {
  const { ledger, credentials } = await load();
  const oldMembers = ledger.members;
  const passwords = new Map<string, string>();
  const members = oldMembers.slice(0, 24).map((member, index) => {
    const id = String(10631 + index);
    passwords.set(id, id === '10635' ? '36201' : password());
    return { ...member, id };
  });
  const added = { id: '10655', passwordHash: '' };
  passwords.set(added.id, password());
  ledger.members = [...members, added];
  await writeRoster(ledger, credentials, passwords);
  console.log('Updated roster to 10631-10655. Fixed password: 10635 / 36201.');
}

async function setCredential(rollNumber: string, value: string) {
  if (!/^\d+$/.test(rollNumber) || !/^\d{5}$/.test(value))
    throw new Error('Usage: npx tsx scripts/roster.ts set <rollNumber> <five-digit-password>');
  const { ledger, credentials } = await load();
  const passwords = new Map<string, string>();
  for (const entry of credentials.enrollment) passwords.set(entry.rollNumber, entry.password);
  const member = ledger.members.find((item) => item.id === rollNumber);
  if (member?.commitment)
    throw new Error(`${rollNumber} is already activated and cannot be reissued.`);
  if (member) member.passwordHash = hashPassword(value);
  else ledger.members.push({ id: rollNumber, passwordHash: hashPassword(value) });
  passwords.set(rollNumber, value);
  credentials.enrollment = ledger.members.map((item) => ({
    rollNumber: item.id,
    password: passwords.get(item.id) ?? password(),
  }));
  for (const entry of credentials.enrollment) {
    const item = ledger.members.find((memberItem) => memberItem.id === entry.rollNumber)!;
    if (!passwords.has(entry.rollNumber)) item.passwordHash = hashPassword(entry.password);
  }
  await save(ledgerPath, ledger);
  await save(credentialsPath, credentials);
  console.log(`Updated ${rollNumber}.`);
}

const [, , command, rollNumber, value] = process.argv;
if (command === 'reset') await reset();
else if (command === 'set' && rollNumber && value) await setCredential(rollNumber, value);
else
  throw new Error(
    'Usage: npx tsx scripts/roster.ts reset | set <rollNumber> <five-digit-password>',
  );
