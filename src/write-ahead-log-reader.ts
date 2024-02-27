import * as fs from 'fs';
import * as path from 'path';
import * as protobufjs from 'protobufjs';
import { LogEntry } from './log-entry';

const LogEntryProtoBufJs = new protobufjs.Type('LogEntry')
  .add(new protobufjs.Field('checksum', 1, 'string'))
  .add(new protobufjs.Field('data', 2, 'string'))
  .add(new protobufjs.Field('logSequenceNumber', 3, 'string'));

export class WriteAheadLogReader {
  constructor(
    protected directory: string,
    protected filename: string,
  ) {}

  protected static getIndexFromFilename(filename: string): number {
    const regExp: RegExp = new RegExp(/^.+\-(\d{3})\.data$/);

    const regExpExecArray: RegExpExecArray | null = regExp.exec(filename);

    if (!regExpExecArray) {
      throw new Error(`unable to get index from filename: ${filename}`);
    }

    return parseInt(regExpExecArray[1]);
  }

  public async meta(): Promise<{ index: number }> {
    const index: number = WriteAheadLogReader.getIndexFromFilename(
      this.filename,
    );

    return {
      index,
    };
  }

  public async read(): Promise<Array<LogEntry>> {
    if (!fs.existsSync(path.join(this.directory, this.filename))) {
      return [];
    }

    const fileDescriptor: number = fs.openSync(
      path.join(this.directory, this.filename),
      'r',
    );

    let offset: number = 0;

    const size: number = fs.statSync(
      path.join(this.directory, this.filename),
    ).size;

    const logEntries: Array<LogEntry> = [];

    while (offset < size) {
      const bufferLength: Buffer = Buffer.alloc(10);

      fs.readSync(fileDescriptor, bufferLength, 0, bufferLength.length, offset);

      const bufferLogEntry: Buffer = Buffer.alloc(
        parseInt(bufferLength.toString()),
      );

      fs.readSync(
        fileDescriptor,
        bufferLogEntry,
        0,
        bufferLogEntry.length,
        offset + bufferLength.length,
      );

      const logEntry: {
        checksum: string;

        data: any;

        logSequenceNumber: string;
      } = LogEntryProtoBufJs.decode(bufferLogEntry).toJSON() as {
        checksum: string;

        data: any;

        logSequenceNumber: string;
      };

      logEntries.push({
        checksum: logEntry.checksum,
        data: logEntry.data,
        logSequenceNumber: parseInt(logEntry.logSequenceNumber),
      });

      offset += bufferLength.length + bufferLogEntry.length;
    }

    return logEntries;
  }
}
