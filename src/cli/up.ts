import { Command } from 'commander';
import promptly from 'promptly';
import { Zkitter } from '../services';
import { UserServiceEvents } from '../services/users';
import { initZkitter } from '../utils/cli';
import { ZkitterEvents } from '../utils/events';
import { error, success } from '../utils/logger';
import { handleStatus } from './status';
import { printPosts } from './timeline';
import { handleWhois } from './whois';
import { handleWrite } from './write';

export function up(program: Command) {
  program
    .command('up')
    .description('start zkitter and subscribe to all global events')
    .action(async () => {
      const zkitter = await initZkitter();

      if (!zkitter) return;

      zkitter.on(ZkitterEvents.NewMessageCreated, msg => {
        success(`@${msg.creator} published new ${msg.type}`);
      });

      zkitter.on(UserServiceEvents.ArbitrumSynced, data => {
        const { fromBlock, latest, toBlock } = data;
        const completion = ((fromBlock / latest) * 100).toFixed(2);
        success(
          `Synced with Arbitrum Mainnet from block #${fromBlock} to #${toBlock}(${completion}%)`
        );
      });

      await zkitter.start();
      await zkitter.subscribe();

      console.log('Subscribing to all events (<Ctrl + C> to exit)...');

      handleCommand(zkitter);
    });
}

async function handleCommand(zkitter: Zkitter) {
  const cmd = (await promptly.prompt('Command: ')).split(' ');

  if (cmd[0] === 'help') {
    console.log('Commands:');
    console.log('  status                                 display status');
    console.log('  whois [address]                        display user profile');
    console.log('  timeline [limit] [offsetHash]          display timeline');
    console.log('  view [address] [limit] [offsetHash]    display user timeline');
    console.log('  thread [hash] [limit] [offsetHash]     display thread');
    console.log('  write                                  publish new post');
  } else if (cmd[0] === 'status') {
    await handleStatus(zkitter);
  } else if (cmd[0] === 'fetch') {
    await zkitter.queryUser(cmd[1]);
  } else if (cmd[0] === 'whois') {
    await handleWhois(zkitter, cmd[1]);
  } else if (cmd[0] === 'timeline') {
    const limit = cmd[1];
    const offset = cmd[2];
    await printPosts(zkitter, await zkitter.getPosts(Number(limit), offset));
  } else if (cmd[0] === 'view') {
    const user = cmd[1];
    const limit = cmd[2];
    const offset = cmd[3];
    await printPosts(zkitter, await zkitter.getUserPosts(user, Number(limit), offset));
  } else if (cmd[0] === 'thread') {
    const thread = cmd[1];
    const limit = cmd[2];
    const offset = cmd[3];
    await printPosts(zkitter, await zkitter.getThread(thread, Number(limit), offset));
  } else if (cmd[0] === 'write') {
    const content = await promptly.prompt('  Content: ');
    const address = await promptly.prompt('  Address: ', { default: '' });
    const group = await promptly.prompt('  Group: ', { default: '' });
    const privateKey = await promptly.prompt('  Secret: ');
    await handleWrite(zkitter, address, group, content, privateKey);
  } else {
    error(`invalid command "${cmd.join(' ')}"`);
  }

  handleCommand(zkitter);
}
