export async function benchmark(
  tag: string,
  n: number,
  fn: () => Promise<void>,
): Promise<void> {
  const start = performance.now();

  await fn();

  const end = performance.now();

  console.log(`\t[${tag}] - ${end - start} (${n / ((end - start) / 1000)})`);
}
