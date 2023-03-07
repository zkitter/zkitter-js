import { Command } from 'commander';
import { initZkitter } from '../utils/cli';
import { error, success } from '../utils/logger';
import { Zkitter } from '../services';
import { Strategy, ZkIdentity } from '@zk-kit/identity';
import { sha256, signWithP256 } from '../utils/crypto';

export function write(program: Command) {
  program
    .command('write')
    .description('publish a post')
    .option('-c, --content <content>', 'content of the post')
    .option('-u, --user <address>', 'address of the creator')
    .option('-g, --group <groupId>', 'id of the zk group')
    .option('-s, --secret <secret>', 'identity secret (private key or serialize ZK Identity)')
    .action(async options => {
      const zkitter = await initZkitter();

      if (!zkitter) return;

      const { content, user, secret, group } = options;

      await handleWrite(zkitter, user, group, content, secret);

      process.exit(0);
    });
}

export async function handleWrite(
  zkitter: Zkitter,
  address: string,
  group: string,
  content: string,
  secret: string
) {
  try {
    const [identityTrapdoor, identityNullifier] = secret.split('_');
    let privateKey: string | undefined = undefined;
    let zkIdentity: ZkIdentity | undefined = undefined;

    if (group) {
      zkIdentity = new ZkIdentity(
        Strategy.SERIALIZED,
        JSON.stringify({
          identityTrapdoor,
          identityNullifier,
          secret: [identityTrapdoor, identityNullifier],
        })
      );
    } else if (address && secret) {
      privateKey = secret;
    } else if (!address && secret) {
      const zkseed = await signWithP256(secret, 'signing for zk identity - 0');
      const zkHex = await sha256(zkseed);
      zkIdentity = new ZkIdentity(Strategy.MESSAGE, zkHex);
    }

    await zkitter.write({
      creator: address,
      content,
      privateKey,
      zkIdentity,
      groupId: group,
    });

    success('post published successfully.');
  } catch (e) {
    error(e.message);
  }
}
