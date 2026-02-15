import { Command } from 'commander';
import chalk from 'chalk';
import { log } from '../../utils/logger.js';
import type { AgentName } from '../../types/index.js';

interface AgentInfo {
  name: AgentName;
  displayName: string;
  phase: 'planning' | 'development' | 'both';
  description: string;
  capabilities: string[];
}

const AGENTS: AgentInfo[] = [
  {
    name: 'analyst',
    displayName: 'Analyst',
    phase: 'planning',
    description: 'Gereksinimleri analiz eder, user story detaylandirir, kabul kriterlerini netlestirir.',
    capabilities: [
      'Gereksinim analizi',
      'User story detaylandirma',
      'Kabul kriterleri olusturma',
      'Edge case tespiti',
      'Is kurallari cikartma',
    ],
  },
  {
    name: 'architect',
    displayName: 'Architect',
    phase: 'planning',
    description: 'Teknik mimari tasarlar, API schemasi olusturur, teknoloji secimi yapar.',
    capabilities: [
      'Mimari tasarim',
      'API schema olusturma',
      'Veritabani modelleme',
      'Teknoloji secimi',
      'Performans planlama',
    ],
  },
  {
    name: 'scrum_master',
    displayName: 'Scrum Master',
    phase: 'both',
    description: 'Isleri tasklara boler, sprint planlama yapar, ilerlemeyi takip eder.',
    capabilities: [
      'Task bolme',
      'Sprint planlama',
      'Ilerleme takibi',
      'Blocker tespiti',
      'Raporlama',
    ],
  },
  {
    name: 'developer',
    displayName: 'Developer',
    phase: 'development',
    description: 'Kod yazar, implementasyon yapar, best practice uygular.',
    capabilities: [
      'Kod yazma',
      'Refactoring',
      'Best practice uygulama',
      'Hata duzeltme',
      'Dokumantasyon',
    ],
  },
  {
    name: 'qa',
    displayName: 'QA Engineer',
    phase: 'development',
    description: 'Test senaryolari yazar, kod review yapar, kalite kontrol saglar.',
    capabilities: [
      'Test senaryosu yazma',
      'Kod review',
      'Kalite kontrol',
      'Bug tespiti',
      'Test otomasyonu',
    ],
  },
];

function phaseColor(phase: string): string {
  switch (phase) {
    case 'planning':
      return chalk.blue(phase);
    case 'development':
      return chalk.green(phase);
    case 'both':
      return chalk.cyan(phase);
    default:
      return chalk.white(phase);
  }
}

export function registerAgentCommand(program: Command): void {
  const agent = program
    .command('agent')
    .description('Manage and inspect agents');

  // agent list
  agent
    .command('list')
    .description('List all available agents')
    .action(async () => {
      log.title('EqhoAIOS - Agent Listesi');

      const nameWidth = 15;
      const phaseWidth = 14;
      const descWidth = 50;

      const header = chalk.bold.white(
        'Agent'.padEnd(nameWidth) +
        'Faz'.padEnd(phaseWidth) +
        'Aciklama'.padEnd(descWidth)
      );
      console.log(header);
      console.log(chalk.gray('-'.repeat(nameWidth + phaseWidth + descWidth)));

      for (const a of AGENTS) {
        const truncDesc = a.description.length > descWidth - 2
          ? a.description.slice(0, descWidth - 5) + '...'
          : a.description;

        console.log(
          chalk.magenta(a.displayName.padEnd(nameWidth)) +
          phaseColor(a.phase) + ' '.repeat(Math.max(1, phaseWidth - a.phase.length)) +
          chalk.white(truncDesc)
        );
      }

      console.log('');
      log.info(`Toplam: ${AGENTS.length} agent`);
      log.info('Detay icin: eqho-aios agent show <name>');
    });

  // agent show
  agent
    .command('show')
    .argument('<name>', 'Agent name (e.g., analyst, architect, developer, qa, scrum_master)')
    .description('Show agent details')
    .action(async (name: string) => {
      const agentInfo = AGENTS.find(a => a.name === name);

      if (!agentInfo) {
        log.error(`Agent bulunamadi: ${name}`);
        log.info(`Gecerli agentlar: ${AGENTS.map(a => a.name).join(', ')}`);
        process.exit(1);
      }

      log.title(`Agent: ${agentInfo.displayName}`);

      console.log(chalk.gray('  Ad:        ') + chalk.magenta(agentInfo.name));
      console.log(chalk.gray('  Goruntu:   ') + chalk.white(agentInfo.displayName));
      console.log(chalk.gray('  Faz:       ') + phaseColor(agentInfo.phase));
      console.log(chalk.gray('  Aciklama:  ') + chalk.white(agentInfo.description));

      console.log('');
      console.log(chalk.bold.white('  Yetenekler:'));
      for (const cap of agentInfo.capabilities) {
        console.log(chalk.cyan(`    - ${cap}`));
      }

      console.log('');
      log.info(`Tek agent calistirmak icin: eqho-aios run <story-id> --agent ${agentInfo.name}`);
    });
}
