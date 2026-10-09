const marker = new TextEncoder().encode("SJS1");
const saltLength = 16;
const ivLength = 12;
const iterations = 210_000;

async function bytes(value: string | Uint8Array | Blob): Promise<Uint8Array<ArrayBuffer>> {
  if (typeof value === "string") return new TextEncoder().encode(value);
  if (value instanceof Blob) return new Uint8Array(await value.arrayBuffer());
  return Uint8Array.from(value);
}

async function key(password: string, salt: Uint8Array<ArrayBuffer>, usage: KeyUsage) {
  if (!password) throw new TypeError("password must not be empty");
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, [usage],
  );
}

/** SJS1 | 16-byte salt | 12-byte IV | AES-GCM ciphertext and authentication tag. */
export async function encrypt(input: string | Uint8Array | Blob, password: string): Promise<Uint8Array> {
  const salt = crypto.getRandomValues(new Uint8Array(saltLength));
  const iv = crypto.getRandomValues(new Uint8Array(ivLength));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, await key(password, salt, "encrypt"), await bytes(input),
  ));
  const output = new Uint8Array(marker.length + saltLength + ivLength + encrypted.length);
  output.set(marker);
  output.set(salt, marker.length);
  output.set(iv, marker.length + saltLength);
  output.set(encrypted, marker.length + saltLength + ivLength);
  return output;
}

/** Rejects corrupt data and incorrect passwords through AES-GCM authentication. */
export async function decrypt(input: Uint8Array | Blob, password: string): Promise<Uint8Array> {
  const data = await bytes(input);
  if (data.length < marker.length + saltLength + ivLength + 16 ||
    !marker.every((value, index) => data[index] === value)) {
    throw new TypeError("Invalid SindreJS encrypted file");
  }
  const start = marker.length;
  const salt = data.slice(start, start + saltLength);
  const iv = data.slice(start + saltLength, start + saltLength + ivLength);
  const ciphertext = data.slice(start + saltLength + ivLength);
  return new Uint8Array(await crypto.subtle.decrypt(
    { name: "AES-GCM", iv }, await key(password, salt, "decrypt"), ciphertext,
  ));
}
