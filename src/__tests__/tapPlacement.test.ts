import {createKeywordLayout} from '../tapPlacement';

it('uses the revised keyword offset at the tap and keeps labels separate', () => {
  const boxes = createKeywordLayout(['TODO', 'REVIEW'], 1404, 1872, {x: 300, y: 600});
  expect(boxes).toHaveLength(2);
  expect(boxes[0].left).toBe(300);
  expect(boxes[0].top + 39).toBe(600);
  expect(boxes[1].top).toBe(boxes[0].top);
  expect(boxes[1].left).toBeGreaterThan(boxes[0].right);
});

it('wraps downward and shifts the batch inside the right and bottom edges', () => {
  const boxes = createKeywordLayout(['TODO', 'REVIEW', 'NEXT'], 1404, 1872, {x: 1380, y: 1860});
  expect(boxes[1].top).toBeGreaterThan(boxes[0].top);
  for (const box of boxes) {
    expect(box.left).toBeGreaterThanOrEqual(20);
    expect(box.right).toBeLessThanOrEqual(1384);
    expect(box.top + 39).toBeLessThan(1872);
  }
});

it('rejects oversized batches and invalid taps before inserting anything', () => {
  expect(() => createKeywordLayout(Array(100).fill('Long keyword'), 1404, 1872, {x: 1300, y: 1000})).toThrow('smaller batch');
  expect(() => createKeywordLayout(['TODO'], 1404, 1872, {x: NaN, y: 100})).toThrow('outside');
});
