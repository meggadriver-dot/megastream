import fs from 'node:fs';
import path from 'node:path';

interface FirebaseAppletConfig {
  projectId: string;
  firestoreDatabaseId: string;
}

type FirestoreValue =
  | { stringValue: string }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { nullValue: null }
  | { timestampValue: string }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

interface FirestoreDocument {
  name?: string;
  fields?: Record<string, FirestoreValue>;
}

function loadConfig(): FirebaseAppletConfig {
  try {
    const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(cfgPath)) {
      const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf-8')) as Partial<FirebaseAppletConfig>;
      if (parsed.projectId && parsed.firestoreDatabaseId) {
        return {
          projectId: parsed.projectId,
          firestoreDatabaseId: parsed.firestoreDatabaseId,
        };
      }
    }
  } catch {
    // Fallback to provisioned defaults
  }
  return {
    projectId: 'gen-lang-client-0094430568',
    firestoreDatabaseId: 'ai-studio-7a3f426f-e541-4ad6-aab7-8258b241a13c',
  };
}

function decodeValue(val: FirestoreValue): unknown {
  if ('stringValue' in val) return val.stringValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return val.doubleValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) {
    return (val.arrayValue.values ?? []).map(decodeValue);
  }
  if ('mapValue' in val) {
    return decodeFields(val.mapValue.fields ?? {});
  }
  return null;
}

function decodeFields(fields: Record<string, FirestoreValue>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = decodeValue(v);
  }
  return out;
}

class FirestoreRestServiceImpl {
  private cfg = loadConfig();

  private get baseDocumentsUrl(): string {
    return `https://firestore.googleapis.com/v1/projects/${this.cfg.projectId}/databases/${this.cfg.firestoreDatabaseId}/documents`;
  }

  async getDocument<T>(docPath: string): Promise<T | null> {
    try {
      const res = await fetch(`${this.baseDocumentsUrl}/${docPath}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return null;
      const doc = (await res.json()) as FirestoreDocument;
      if (!doc.fields) return null;
      return decodeFields(doc.fields) as T;
    } catch {
      return null;
    }
  }

  async queryActiveCollection<T>(collectionId: string): Promise<T[]> {
    try {
      const res = await fetch(`${this.baseDocumentsUrl}:runQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId }],
            where: {
              fieldFilter: {
                field: { fieldPath: 'active' },
                op: 'EQUAL',
                value: { booleanValue: true },
              },
            },
          },
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return [];
      const rows = (await res.json()) as Array<{ document?: FirestoreDocument }>;
      const items: T[] = [];
      for (const row of rows) {
        if (row.document?.fields) {
          items.push(decodeFields(row.document.fields) as T);
        }
      }
      return items;
    } catch {
      return [];
    }
  }
}

export const FirestoreRestService = new FirestoreRestServiceImpl();
