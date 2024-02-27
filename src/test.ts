import { faker } from '@faker-js/faker';
import * as uuid from 'uuid';
import { benchmark } from './benchmark';
import { WriteAheadLogWriter } from './write-ahead-log-writer';

(async () => {
  const n: number = 1_000_000;

  const data: Array<any> = [];

  for (let i = 0; i < n; i++) {
    data.push({
      account: faker.helpers.arrayElement(['TEST_A', 'TEST_B', 'TEST_C']),
      amount: faker.number.int({
        max: 10000,
        min: 50,
      }),
      id: uuid.v4(),
      reference: faker.string.alphanumeric({
        length: 10,
      }),
    });
  }

  const writeAheadLogWriter: WriteAheadLogWriter = new WriteAheadLogWriter(
    'data',
    'test-001.data',
  );

  await writeAheadLogWriter.open();

  await benchmark('append', n, async () => {
    for (const x of data) {
      await writeAheadLogWriter.write(x);
    }

    await writeAheadLogWriter.close();
  });
})();
