export const WakuFormatVersion = '1.0.0';
export function userMessageTopic(address: string, prefix?: string): string {
  return [prefix || 'zkitter', WakuFormatVersion, 'um_' + address, 'proto'].join('/');
}

export function groupMessageTopic(groupId: string, prefix?: string): string {
  return [prefix || 'zkitter', WakuFormatVersion, 'gm_' + groupId, 'proto'].join('/');
}

export function threadTopic(hash: string, prefix?: string): string {
  return [prefix || 'zkitter', WakuFormatVersion, 'thread_' + hash, 'proto'].join('/');
}

export function chatTopic(hash: string, prefix?: string): string {
  return [prefix || 'zkitter', WakuFormatVersion, 'chat_' + hash, 'proto'].join('/');
}

export function globalMessageTopic(prefix?: string): string {
  return [prefix || 'zkitter', WakuFormatVersion, 'all_messages', 'proto'].join('/');
}
