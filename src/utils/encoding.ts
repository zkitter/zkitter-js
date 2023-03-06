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

export const toBigInt = (value: string | number): bigint => {
  if (typeof value === 'number') {
    return BigInt(value);
  }

  if (/[a-z]/gi.test(value)) {
    if (value.slice(0, 2) === '0x') return BigInt(value);
    return BigInt('0x' + value);
  }

  return BigInt(value);
};

export const hexify = (value: string | number): string => {
  return '0x' + toBigInt(value).toString(16);
};
