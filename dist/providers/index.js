/**
 * Frame providers module for the basketball shot analysis system.
 *
 * This module exports the FrameProvider interface and related types
 * for abstracting video frame sources.
 */
export { InvalidFpsError } from './types';
// Video file provider exports
export { VideoFileProvider, createVideoFileProvider, VideoFileNotFoundError, VideoFileCorruptedError, UnsupportedVideoFormatError } from './video-file';
//# sourceMappingURL=index.js.map