// Service-account based Google Drive client. Worker-runtime safe (Web Crypto).
// SERVER ONLY: never import from client-reachable modules at top level.

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const SCOPE = "https://www.googleapis.com/auth/drive";

function b64url(input: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof input === "string") bytes = new TextEncoder().encode(input);
  else if (input instanceof Uint8Array) bytes = input;
  else bytes = new Uint8Array(input);
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const clean = pem
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(clean);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

let cachedToken: { token: string; exp: number } | null = null;

export async function getDriveAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

  const creds = await (await import("@/lib/platformSecrets.server")).resolveGoogleDriveCredentials();
  const clientEmail = creds.clientEmail;
  const privateKeyPem = creds.privateKey;
  if (!clientEmail || !privateKeyPem) {
    throw new Error("Google Drive credentials are not configured. Admin → 설정에서 입력하세요.");
  }

  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: clientEmail,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );
  const jwt = `${signingInput}.${b64url(sig)}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, exp: now + data.expires_in };
  return data.access_token;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  thumbnailLink?: string;
  iconLink?: string;
}

export async function listFolderFiles(folderId: string, pageSize = 100): Promise<DriveFile[]> {
  const token = await getDriveAccessToken();
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const fields = encodeURIComponent(
    "files(id,name,mimeType,size,modifiedTime,webViewLink,thumbnailLink,iconLink)",
  );
  const res = await fetch(
    `${DRIVE_API}/files?q=${q}&fields=${fields}&pageSize=${pageSize}&orderBy=modifiedTime%20desc&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Drive list failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { files: DriveFile[] };
  return data.files ?? [];
}

export async function uploadFileToDrive(opts: {
  folderId: string;
  name: string;
  mimeType: string;
  data: ArrayBuffer | Uint8Array;
}): Promise<DriveFile> {
  const token = await getDriveAccessToken();
  const metadata = {
    name: opts.name,
    mimeType: opts.mimeType,
    parents: [opts.folderId],
  };
  const boundary = `----lovable${Math.random().toString(36).slice(2)}`;
  const enc = new TextEncoder();
  const head = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${opts.mimeType}\r\n\r\n`,
  );
  const tail = enc.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(head.length + (opts.data as Uint8Array).byteLength + tail.length);
  body.set(head, 0);
  body.set(new Uint8Array(opts.data as ArrayBuffer), head.length);
  body.set(tail, head.length + (opts.data as Uint8Array).byteLength);

  const res = await fetch(
    `${DRIVE_UPLOAD}/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,size,modifiedTime,webViewLink,thumbnailLink,iconLink`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!res.ok) throw new Error(`Drive upload failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as DriveFile;
}

export const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder";

export async function createDriveFolder(parentId: string, name: string): Promise<DriveFile> {
  const token = await getDriveAccessToken();
  const res = await fetch(
    `${DRIVE_API}/files?supportsAllDrives=true&fields=id,name,mimeType,modifiedTime,webViewLink,iconLink`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name, mimeType: DRIVE_FOLDER_MIME, parents: [parentId] }),
    },
  );
  if (!res.ok) throw new Error(`Drive folder create failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as DriveFile;
}

export async function renameDriveFile(fileId: string, name: string): Promise<DriveFile> {
  const token = await getDriveAccessToken();
  const res = await fetch(
    `${DRIVE_API}/files/${fileId}?supportsAllDrives=true&fields=id,name,mimeType,size,modifiedTime,webViewLink,thumbnailLink,iconLink`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    },
  );
  if (!res.ok) throw new Error(`Drive rename failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as DriveFile;
}

export async function deleteDriveFile(fileId: string): Promise<void> {
  const token = await getDriveAccessToken();
  const res = await fetch(`${DRIVE_API}/files/${fileId}?supportsAllDrives=true`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Drive delete failed: ${res.status} ${await res.text()}`);
  }
}
