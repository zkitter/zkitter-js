export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary_string = Buffer.from(
    base64.replace(/_/g, '/').replace(/-/g, '+'),
    'base64'
  ).toString('binary');
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

export const arrayBufToBase64UrlEncode = (buf: ArrayBuffer) => {
  let binary = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return Buffer.from(binary, 'binary')
    .toString('base64')
    .replace(/\//g, '_')
    .replace(/=/g, '')
    .replace(/\+/g, '-');
};

export const hexToUintArray = (hex: string): Uint8Array => {
  const a = [];
  for (let i = 0, len = hex.length; i < len; i += 2) {
    a.push(parseInt(hex.substr(i, 2), 16));
  }
  return new Uint8Array(a);
};

export const hexToArrayBuf = (hex: string): ArrayBuffer => {
  return hexToUintArray(hex).buffer;
};

export const toBigInt = (value: string | number | bigint): bigint => {
  if (typeof value === 'bigint') return value;

  if (typeof value === 'number') {
    return BigInt(value);
  }

  return BigInt(hexify(value));
};

export const hexify = (data: string | bigint | number, targetLength?: number): string => {
  let hash = '';

  if (typeof data === 'bigint') {
    hash = data.toString(16);
  }

  if (typeof data === 'number') {
    hash = data.toString(16);
  }

  if (typeof data === 'string') {
    if (data.slice(0, 2) === '0x') {
      hash = data.slice(2);
    } else if (/^\d+$/.test(data)) {
      hash = BigInt(data).toString(16);
    } else if (/^[0-9a-fA-F]+$/.test(data)) {
      hash = data;
    }
  }

  if (targetLength) hash = hash.padStart(targetLength, '0');

  return '0x' + hash;
};
