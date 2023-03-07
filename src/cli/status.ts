import { Command } from 'commander';
import { initZkitter } from '../utils/cli';
import { Zkitter } from '../services';

export function status(program: Command) {
  program
    .command('status')
    .description('display status')
    .action(async () => {
      const zkitter = await initZkitter(true);

      if (!zkitter) return;

      await handleStatus(zkitter);

      process.exit(0);
    });
}

export async function handleStatus(zkitter: Zkitter) {
  const status = await zkitter.status();
  console.log(
    `Scanned ${status.lastBlockScanned} out of ${status.latestBlock} blocks on Arbitrum Mainnet`
  );
  console.log(`Found ${status.totalUsers} users from registrar`);
}
