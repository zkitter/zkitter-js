import { Command } from 'commander';
import { Zkitter } from '../services';
import { initZkitter } from '../utils/cli';

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
    `Scanned to block # ${status.arbitrum.lastBlock} on Arbitrum Mainnet`
  );
  console.log(`Found ${status.users.count} users from registrar`);
}
