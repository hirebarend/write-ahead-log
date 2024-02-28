# Write-Ahead Log

Write-ahead log written in TypeScript

## Installation

```shell
npm install write-ahead-log
```

## Performance

| Operation | # of Operations | Duration (in seconds) | Throughput (ops/ms) |
| --------- | --------------- | --------------------- | ------------------- |
| Write     | 1 000 000       | 2582.32               | 387                 |
| Read      | 1 000 000       | 5498.57               | 182                 |

## Usage

```typescript
import { WriteAheadLogReader, WriteAheadLogWriter } from 'write-ahead-log';

// Write-ahead log writer

const writeAheadLogWriter: WriteAheadLogWriter = new WriteAheadLogWriter(
  'data',
  'log-001.data',
);

await writeAheadLogWriter.open();

await writeAheadLogWriter.write({
  key: 'hello',
  value: 'world',
});

await writeAheadLogWriter.close();

// Write-ahead log reader

const writeAheadLogReader: WriteAheadLogReader = new WriteAheadLogReader(
  'data',
  'log-001.data',
);

const logEntries = await writeAheadLogReader.read();
```

## Contribute

Thank you for your interest in contributing to [Project Name]! We welcome contributions from everyone, whether it's through submitting bug reports, suggesting improvements, adding documentation, or contributing code. Here's how you can contribute:

### Reporting Bugs

If you find a bug in the project:

1. Use the GitHub Issues page to search for existing issues related to your problem.
2. If the issue is new, click the "New Issue" button and fill out the form with as much detail as possible.
3. Provide a clear and descriptive title as well as a detailed description of the issue. Include any relevant code samples or error messages.

### Suggesting Enhancements

Have an idea for an improvement or new feature? We'd love to hear it! Please:

1. Check the GitHub Issues page to see if someone else has already suggested the same enhancement.
2. If it's a new idea, open a new issue, choosing the "Feature Request" template if available.
3. Provide a succinct title and detailed description of your proposed enhancement. Explain why you believe it would be beneficial to the project.

### Pull Requests

Ready to contribute code or documentation? Follow these steps:

1. Fork the repository on GitHub.
2. Clone your fork to your local machine.
3. Create a new branch for your contribution (`git checkout -b feature/AmazingFeature`).
4. Make your changes in the new branch.
5. Commit your changes, ensuring your commit messages are concise and descriptive.
6. Push the branch to your fork (`git push origin feature/AmazingFeature`).
7. Open a pull request from your fork to the main project. Include a clear title and description of your changes.
8. Wait for feedback or approval from the project maintainers.

### Code of Conduct

Please note that this project is released with a [Contributor Code of Conduct](CODE_OF_CONDUCT.md). By participating in this project, you agree to abide by its terms.

We're excited to welcome you to our community and look forward to your contributions!
