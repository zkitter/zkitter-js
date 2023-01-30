import {Command} from "commander";
import {initZkitter} from "../utils/cli";
import chalk from "chalk";
import {User} from "../models/user";
import {UserMeta} from "../models/usermeta";
import moment from "moment";
import {Zkitter} from "../services";
import {Post} from "../utils/message";

const {yellowBright, red, blue, magenta, cyan, yellow, green} = chalk;

export function timeline(program: Command) {
  program
    .command('timeline')
    .description('display timeline')
    .option('-l, --limit <limit>', 'max number of posts to display')
    .option('-o, --offset <offset>', 'only display posts after this hash')
    .option('-t, --thread <hash>', 'display thread of this hash')
    .option('-u, --user <address>', 'display thread of this user address')
    .action(async (options) => {
      const zkitter = await initZkitter(true);

      if (!zkitter) return;

      const {
        limit,
        offset,
        thread,
        user,
      } = options;

      const posts = user ? await zkitter.getUserPosts(user, limit, offset)
        : thread ? await zkitter.getThread(thread, limit, offset)
        : await zkitter.getPosts(Number(limit), offset);
      await printPosts(zkitter, posts);
      process.exit(0);
    });
}

export async function printPosts(zkitter: Zkitter, posts: Post[]) {
  const users: {[address: string]: User} = {};
  const userMetas: {[address: string]: UserMeta} = {};

  for (const post of posts) {
    const u = users[post.creator] || await zkitter.getUser(post.creator);
    const um = userMetas[post.creator] || await zkitter.getUserMeta(post.creator);
    const pm = await zkitter.getPostMeta(post.hash());
    const handle = u?.address ? '@' + u.address :  '';
    const nickname = um.nickname || u?.address || pm.groupId || 'anonymous';

    console.log(`${red(nickname)} ${yellowBright(handle)} ${magenta(moment(post.createdAt).format('YYYY/MM/DD LTS'))}`);
    console.log(green('[Hash: ' + post.hash() + ']'))
    console.log(`${blue('✉ ' + pm.reply)}  ${cyan('↩ ' + pm.repost)}  ${red('♥ ' + pm.like)}`)
    console.log(yellow(post.payload.content) + '\n');
    users[post.creator] = u;
    userMetas[post.creator] = um;
  }
}