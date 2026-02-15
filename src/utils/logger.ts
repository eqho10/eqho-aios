import chalk from 'chalk';

export const log = {
  info: (msg: string) => console.log(chalk.blue('ℹ'), msg),
  success: (msg: string) => console.log(chalk.green('✓'), msg),
  warn: (msg: string) => console.log(chalk.yellow('⚠'), msg),
  error: (msg: string) => console.log(chalk.red('✗'), msg),
  agent: (name: string, msg: string) => console.log(chalk.magenta(`@${name}`), msg),
  step: (num: number, total: number, msg: string) =>
    console.log(chalk.gray(`[${num}/${total}]`), msg),
  divider: () => console.log(chalk.gray('─'.repeat(50))),
  title: (msg: string) => {
    console.log('');
    console.log(chalk.bold.cyan(msg));
    console.log(chalk.gray('─'.repeat(msg.length)));
  },
  tokens: (input: number, output: number) =>
    console.log(chalk.gray(`  tokens: ${input} in / ${output} out`)),
};
