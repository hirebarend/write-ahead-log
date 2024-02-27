import { faker } from '@faker-js/faker';
import * as fs from 'fs';
import * as uuid from 'uuid';
import { benchmark } from '../benchmark';
import { WriteAheadLogReader } from '../write-ahead-log-reader';
import { WriteAheadLogWriter } from '../write-ahead-log-writer';
import { NonBufferedWriteAheadLogWriter } from '../non-buffered-write-ahead-log-writer';

function createLogFn(): (text: string) => void {
  let timestamp: number = performance.now();

  return (text: string) => {
    console.log(`[${Math.round(performance.now() - timestamp)}ms] - ${text}`);

    timestamp = performance.now();
  };
}

export class FiniteStateMachine {
  public dict: { [key: string]: string } = {};

  protected logSequenceNumber: number = 0;

  protected interval: NodeJS.Timeout | null = null;

  public async apply(logSequenceNumber: number, event: any): Promise<void> {
    const x = event as { key: string; value: string };

    this.dict[x.key] = x.value;

    this.logSequenceNumber = logSequenceNumber;
  }

  public async close(): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval);

      this.interval = null;
    }

    await this.snapshot();
  }

  public async open(): Promise<number> {
    if (fs.existsSync('data/snapshot-001.data')) {
      const json: string = fs.readFileSync('data/snapshot-001.data', 'utf-8');

      if (json) {
        const obj: {
          dict: { [key: string]: string };
          logSequenceNumber: number;
        } = JSON.parse(json);

        this.dict = obj.dict;

        this.logSequenceNumber = obj.logSequenceNumber;
      }
    }

    this.interval = setInterval(() => this.snapshot(), 2000);

    return this.logSequenceNumber;
  }

  protected async snapshot(): Promise<void> {
    const logSequenceNumber: number = this.logSequenceNumber;

    const dict = { ...this.dict };

    return new Promise((resolve, reject) => {
      fs.writeFile(
        'data/snapshot-001.data',
        JSON.stringify({
          logSequenceNumber,
          dict,
        }),
        (error) => {
          if (error) {
            reject(error);

            return;
          }

          resolve();
        },
      );
    });
  }
}

(async () => {
  const log = createLogFn();

  const finiteStateMachine: FiniteStateMachine = new FiniteStateMachine();

  const logSequenceNumber: number = await finiteStateMachine.open();

  const writeAheadLogReader: WriteAheadLogReader = new WriteAheadLogReader(
    'data',
    'test-001.data',
  );

  log(`reading write-ahead log...`);

  const logEntries = await writeAheadLogReader.read();

  log(`successfully read write-ahead log (${logEntries.length})`);

  // const writeAheadLogWriter: WriteAheadLogWriter = new WriteAheadLogWriter(
  //   'data',
  //   'test-001.data',
  //   Math.max(
  //     logSequenceNumber,
  //     logEntries.length
  //       ? logEntries[logEntries.length - 1].logSequenceNumber
  //       : 0,
  //   ),
  // );

  const writeAheadLogWriter: NonBufferedWriteAheadLogWriter =
    new NonBufferedWriteAheadLogWriter(
      'data',
      'test-001.data',
      Math.max(
        logSequenceNumber,
        logEntries.length
          ? logEntries[logEntries.length - 1].logSequenceNumber
          : 0,
      ),
    );

  await writeAheadLogWriter.open();

  log(`applying write-ahead log...`);

  for (const logEntry of logEntries) {
    if (logEntry.logSequenceNumber <= logSequenceNumber) {
      continue;
    }

    await finiteStateMachine.apply(
      logEntry.logSequenceNumber,
      JSON.parse(logEntry.data),
    );
  }

  log(`successfully applied write-ahead log`);

  const n: number = 2_000_000;

  const keys: Array<string> = [
    uuid.v4(),
    uuid.v4(),
    uuid.v4(),
    uuid.v4(),
    uuid.v4(),
  ];

  await benchmark('apply', n, async () => {
    for (let i = 0; i < n; i++) {
      const key: string = faker.helpers.arrayElement(keys);

      const value: string = faker.string.alphanumeric({
        length: 16,
      });

      const logSequenceNumber: number = await writeAheadLogWriter.write({
        key,
        value,
      });

      await finiteStateMachine.apply(logSequenceNumber, {
        key,
        value,
      });
    }
  });

  await finiteStateMachine.close();

  await writeAheadLogWriter.close();
})();
