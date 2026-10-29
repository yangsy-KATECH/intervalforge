import { runSuite } from './test-suite.js';
const button = document.getElementById('run');
async function run() {
  button.disabled = true;
  document.getElementById('summary').textContent = '검사 중';
  const list = document.getElementById('results');
  list.replaceChildren();
  try {
    const report = await runSuite();
    document.getElementById('summary').textContent =
      `${report.total}개 중 ${report.passed}개 통과 · ${report.failed}개 실패`;
    for (const result of report.results) {
      const item = document.createElement('li');
      item.textContent = `${result.passed ? '통과' : '실패'} · ${result.name}${result.error ? ' — ' + result.error : ''}`;
      item.style.color = result.passed ? '#b2ff4d' : '#ff9ca5';
      list.append(item);
    }
    window.__intervalForgeTestReport = report;
  } catch (error) {
    document.getElementById('summary').textContent = `검사 실행 오류: ${error.message}`;
  } finally {
    button.disabled = false;
  }
}
button.addEventListener('click', run);
void run();
