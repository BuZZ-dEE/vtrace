import {SvgPathSimplifier} from './svg-path-simplifier';
import {removeInnerSubPaths} from './svg-sub-path-remover';

describe('removeInnerSubPaths', () => {
  it('removes paths fully contained within another sub-path', (): void => {
    const path = 'M 0 0 L 10 0 L 10 10 L 0 10 Z M 2 2 L 4 2 L 4 4 L 2 4 Z';

    expect(removeInnerSubPaths(path)).toBe('M 0 0 L 10 0 L 10 10 L 0 10 Z');
  });

  it('is exposed through SvgPathSimplifier', (): void => {
    const path = 'M 0 0 L 10 0 L 10 10 L 0 10 Z M 2 2 L 4 2 L 4 4 L 2 4 Z';

    expect(SvgPathSimplifier.removeInnerSubPaths(path)).toBe(
      'M 0 0 L 10 0 L 10 10 L 0 10 Z',
    );
  });

  it('keeps paths that overlap or touch another sub-path', (): void => {
    const overlapping =
      'M 0 0 L 10 0 L 10 10 L 0 10 Z M 8 8 L 12 8 L 12 12 L 8 12 Z';
    const touching =
      'M 0 0 L 10 0 L 10 10 L 0 10 Z M 10 2 L 12 2 L 12 4 L 10 4 Z';

    expect(removeInnerSubPaths(overlapping)).toBe(overlapping);
    expect(removeInnerSubPaths(touching)).toBe(touching);
  });
});
