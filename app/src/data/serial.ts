// Fila de consultas do banco. O driver (wa-sqlite na web) falha com "Error code 21" (uso indevido da API) quando várias
// consultas rodam ao mesmo tempo na mesma conexão. As consultas entram numa fila e, se uma falhar, tentam de novo uma vez.
let queue: Promise<unknown> = Promise.resolve();

export function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    try {
      return await fn();
    } catch {
      await new Promise((r) => setTimeout(r, 150));
      return fn();
    }
  });
  queue = run.catch(() => undefined);
  return run;
}
