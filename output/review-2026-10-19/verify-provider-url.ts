import assert from 'node:assert/strict';
import { parseNewProblemForm } from '../../lib/problems/parseNewProblemInput';
const data = new FormData();
data.set('title', 'Review fixture');
data.set('difficulty', 'MEDIUM');
data.set('leetcodeUrl', 'https://example.invalid/leetcode.com/problems/fixture');
const result = parseNewProblemForm(data);
assert.equal(result.ok, true);
console.log('Reproduced: provider validation accepts example.invalid when the expected host appears in the path.');
