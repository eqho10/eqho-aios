import { Command } from 'commander';
import inquirer from 'inquirer';
import Handlebars from 'handlebars';
import path from 'path';
import { log } from '../../utils/logger.js';
import {
  ensureDir,
  readFile,
  writeFile,
  fileExists,
  resolveProjectPath,
} from '../../utils/file-utils.js';

interface InitAnswers {
  projectName: string;
  framework: string;
  language: 'tr' | 'en';
}

async function detectFramework(projectDir: string): Promise<string | null> {
  const detectors: Array<{ file: string; framework: string }> = [
    { file: 'package.json', framework: 'node' },
    { file: 'go.mod', framework: 'go' },
    { file: 'requirements.txt', framework: 'python' },
    { file: 'Cargo.toml', framework: 'rust' },
    { file: 'pom.xml', framework: 'java' },
    { file: 'composer.json', framework: 'php' },
    { file: 'Gemfile', framework: 'ruby' },
  ];

  for (const { file, framework } of detectors) {
    if (await fileExists(path.join(projectDir, file))) {
      return framework;
    }
  }
  return null;
}

async function detectSubFramework(projectDir: string, base: string): Promise<string> {
  if (base === 'node') {
    const pkgPath = path.join(projectDir, 'package.json');
    if (await fileExists(pkgPath)) {
      try {
        const raw = await readFile(pkgPath);
        const pkg = JSON.parse(raw);
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (allDeps['next']) return 'nextjs';
        if (allDeps['nuxt']) return 'nuxt';
        if (allDeps['@angular/core']) return 'angular';
        if (allDeps['vue']) return 'vue';
        if (allDeps['react']) return 'react';
        if (allDeps['express']) return 'express';
        if (allDeps['fastify']) return 'fastify';
      } catch {
        // ignore parse errors
      }
    }
  }
  if (base === 'python') {
    if (await fileExists(path.join(projectDir, 'manage.py'))) return 'django';
    if (await fileExists(path.join(projectDir, 'app.py'))) return 'flask';
    const reqPath = path.join(projectDir, 'requirements.txt');
    if (await fileExists(reqPath)) {
      try {
        const content = await readFile(reqPath);
        if (content.includes('fastapi')) return 'fastapi';
        if (content.includes('django')) return 'django';
        if (content.includes('flask')) return 'flask';
      } catch {
        // ignore
      }
    }
  }
  return base;
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .argument('[project-name]', 'Name of the project')
    .description('Initialize a new EqhoAIOS project')
    .action(async (projectName?: string) => {
      try {
        log.title('EqhoAIOS - Proje Baslat');

        const projectDir = resolveProjectPath('.');
        const detectedFramework = await detectFramework(projectDir);
        let detectedSubFramework: string | null = null;
        if (detectedFramework) {
          detectedSubFramework = await detectSubFramework(projectDir, detectedFramework);
        }

        // Check if already initialized
        const configPath = resolveProjectPath('.eqho-aios', 'config.yaml');
        if (await fileExists(configPath)) {
          log.warn('Bu dizinde zaten bir EqhoAIOS projesi mevcut.');
          const { overwrite } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'overwrite',
              message: 'Mevcut konfigurasyonun uzerine yazilsin mi?',
              default: false,
            },
          ]);
          if (!overwrite) {
            log.info('Islem iptal edildi.');
            return;
          }
        }

        // Determine the default project name from directory
        const dirName = path.basename(projectDir);

        // Build prompts based on what we already know
        const questions: Array<Record<string, unknown>> = [];

        if (!projectName) {
          questions.push({
            type: 'input',
            name: 'projectName',
            message: 'Proje adi:',
            default: dirName,
          });
        }

        questions.push({
          type: 'input',
          name: 'framework',
          message: 'Framework/Dil:',
          default: detectedSubFramework || detectedFramework || 'node',
        });

        questions.push({
          type: 'list',
          name: 'language',
          message: 'Dil (agent ciktilari):',
          choices: [
            { name: 'Turkce', value: 'tr' },
            { name: 'English', value: 'en' },
          ],
          default: 'tr',
        });

        const answers = await inquirer.prompt<InitAnswers>(questions as never);
        const finalProjectName = projectName || answers.projectName;
        const framework = answers.framework;
        const language = answers.language;

        if (detectedFramework) {
          log.info(`Tespit edilen proje tipi: ${detectedSubFramework || detectedFramework}`);
        }

        // Read and compile the config template
        const templatePath = path.resolve(
          path.dirname(new URL(import.meta.url).pathname),
          '../../../templates/config.yaml.hbs'
        );
        const templateContent = await readFile(templatePath);
        const template = Handlebars.compile(templateContent);
        const configContent = template({
          projectName: finalProjectName,
          framework: framework,
        });

        // Create directory structure
        log.info('Dizin yapisi olusturuluyor...');

        await ensureDir(resolveProjectPath('.eqho-aios', 'context'));
        await ensureDir(resolveProjectPath('.eqho-aios', 'history'));
        await ensureDir(resolveProjectPath('docs', 'stories'));

        // Write config file
        await writeFile(configPath, configContent);
        log.success('.eqho-aios/config.yaml olusturuldu');

        // Write project context file
        const contextContent = `# ${finalProjectName} - Proje Baglami

## Genel Bakis
<!-- Projenin amaci ve kapsamini buraya yazin -->

## Hedef Kullanici
<!-- Hedef kitle bilgisi -->

## Temel Ozellikler
<!-- Ana ozellik listesi -->

## Is Gereksinimleri
<!-- Is kurallari ve gereksinimler -->
`;
        await writeFile(
          resolveProjectPath('.eqho-aios', 'context', 'project-context.md'),
          contextContent
        );
        log.success('.eqho-aios/context/project-context.md olusturuldu');

        // Write tech stack file
        const techStackContent = `# ${finalProjectName} - Teknik Yigin

## Framework
- ${framework}

## Dil
- ${language === 'tr' ? 'Turkce' : 'English'}

## Bagimlilklar
<!-- Temel bagimliliklar -->

## Veritabani
<!-- Kullanilan veritabani -->

## Altyapi
<!-- Deploy ve altyapi bilgileri -->

## Kod Standartlari
<!-- Lint kurallari, test stratejisi, vb. -->
`;
        await writeFile(
          resolveProjectPath('.eqho-aios', 'context', 'tech-stack.md'),
          techStackContent
        );
        log.success('.eqho-aios/context/tech-stack.md olusturuldu');

        // Write story template
        const storyTemplateContent = `---
id: "EQHO-XXX"
title: ""
status: "draft"
priority: "medium"
phase: ""
current_agent: null
agents_completed: []
created: ""
tags: []
estimated_tokens: 0
actual_tokens: 0
---

## User Story

**Baslik:**

**Aciklama:**
As a [user type], I want [goal] so that [benefit].

## Kabul Kriterleri

- [ ] Kriter 1

## Teknik Notlar

`;
        await writeFile(
          resolveProjectPath('docs', 'stories', '_template.md'),
          storyTemplateContent
        );
        log.success('docs/stories/_template.md olusturuldu');

        // Final output
        log.divider();
        log.success(`${finalProjectName} projesi basariyla olusturuldu!`);
        console.log('');
        log.info('Siradaki adimlar:');
        console.log('  1. .eqho-aios/context/project-context.md dosyasini doldurun');
        console.log('  2. .eqho-aios/context/tech-stack.md dosyasini guncelleyin');
        console.log('  3. Ilk story olusturun:');
        console.log('     eqho-aios story create "Kullanici Girisi" --priority high --tags auth,security');
        console.log('  4. Pipeline calistirin:');
        console.log('     eqho-aios run EQHO-001');
        console.log('');
        log.info('API anahtarinizi ayarlayin:');
        console.log('  export ANTHROPIC_API_KEY=sk-ant-...');
      } catch (err) {
        log.error(`Init hatasi: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
