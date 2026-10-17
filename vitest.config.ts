// Testes do monorepo: núcleo, app e guarda de arquitetura. As worktrees de agentes (.claude/worktrees) têm cópias do
// repositório e não entram.
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, '.claude/**', '**/dist/**'],
  },
});
