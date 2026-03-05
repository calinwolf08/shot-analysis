/**
 * Frame providers module for the basketball shot analysis system.
 *
 * This module exports the FrameProvider interface and related types
 * for abstracting video frame sources.
 */
export type { VideoFrame, FrameMetadata, FrameProvider } from "./types";
export { InvalidFpsError } from "./types";
export { VideoFileProvider, createVideoFileProvider, VideoFileNotFoundError, VideoFileCorruptedError, UnsupportedVideoFormatError, } from "./video-file";
export { MediaStreamProvider, createMediaStreamProvider, MediaStreamEndedError, MediaStreamInactiveError, NoVideoTrackError, } from "./media-stream";
export type { MediaStreamProviderOptions } from "./media-stream";
//# sourceMappingURL=index.d.ts.map