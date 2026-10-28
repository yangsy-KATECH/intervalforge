import { runSuite } from './test-suite.js';
const report = await runSuite();
for (const result of report.results) {
  console.log(`${result.passed ? '통과' : '실패'} | ${result.name}${result.error ? ' | ' + result.error : ''}`);
}
console.log(`결과: ${report.passed}/${report.total} 통과, ${report.failed} 실패`);
if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
process.exitCode = report.failed ? 1 : 0;
