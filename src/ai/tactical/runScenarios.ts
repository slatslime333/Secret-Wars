import { runTacticalScenarios } from './scenarios';

const results = runTacticalScenarios();
let failed = 0;
for (const result of results) {
  const mark = result.ok ? 'ok' : 'FAIL';
  if (!result.ok) {
    failed += 1;
  }
  console.log(`${mark}  ${result.name}  ${result.detail}`);
}
if (failed > 0) {
  throw new Error(`${failed} tactical scenario(s) failed`);
}
console.log(`\n${results.length} tactical scenarios passed`);
