// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'

import { getShareableBrowserArtifactFile } from './browser-artifact-upload'

// RA: local HTML navigation remains after removing artifact publishing.
describe('browser local HTML URLs', () => {
  it('recognizes local HTML URLs across path flavors', () => {
    expect(getShareableBrowserArtifactFile('file:///tmp/Design%20Review.html')).toEqual({
      fileName: 'Design Review.html',
      filePath: '/tmp/Design Review.html'
    })
    expect(getShareableBrowserArtifactFile('file:///C:/repo/report.HTM')).toEqual({
      fileName: 'report.HTM',
      filePath: 'C:\\repo\\report.HTM'
    })
    expect(getShareableBrowserArtifactFile('file://server/share/report.html')).toEqual({
      fileName: 'report.html',
      filePath: '\\\\server\\share\\report.html'
    })
    expect(getShareableBrowserArtifactFile('https://example.com/report.html')).toBeNull()
    expect(getShareableBrowserArtifactFile('file:///tmp/report.md')).toBeNull()
  })
})
