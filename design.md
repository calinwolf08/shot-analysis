# Basketball Shot Form Analysis Module - Design Document

## Executive Summary

A TypeScript module that uses MediaPipe pose detection to analyze basketball shooting form from video input (files or live streams). It extracts detailed biomechanical metrics for each shot, identifies key phases, and compares results against configurable form profiles to provide corrective feedback data.

## Problem Statement

Young basketball players need objective feedback on their shooting form to improve accuracy and develop proper mechanics. Currently, coaches provide subjective verbal cues that are inconsistent and hard to track over time. This module provides automated, consistent analysis of shooting mechanics that can power real-time corrective feedback in a mobile training app.

## Target Users

- **Primary**: Youth basketball players (ages 8-18) and their coaches
- **Secondary**: Parents helping kids practice at home
- **Key needs**: Objective form analysis, clear actionable feedback, progress tracking data

## Features

### Feature 1: Video Frame Processing

**Priority**: High
**Dependencies**: None

#### User Story

As a developer, I want to provide video frames to the analyzer so that I can process both recorded clips and live camera feeds.

#### Interface Design

```typescript
interface FrameProvider {
  getNextFrame(): Promise<VideoFrame | null>;
  getFps(): number;
  getMetadata(): { width: number; height: number; duration?: number };
}
```

#### Acceptance Criteria

- [ ] Abstract interface works with both video files and live streams
- [ ] Provides frame timing information (fps, frame index)
- [ ] Returns null when no more frames available
- [ ] Handles common video formats via implementation

#### Edge Cases

- Low quality/resolution frames: Process anyway, confidence scores will reflect quality
- Variable frame rate: Normalize to consistent timing
- Corrupted frames: Skip and continue, log warning

### Feature 2: Pose Detection & Landmark Extraction

**Priority**: High
**Dependencies**: Feature 1

#### User Story

As the analyzer, I want to extract body landmarks from each frame so that I can calculate biomechanical metrics.

#### Technical Approach

- Use MediaPipe Pose Landmarker (33 landmarks)
- Support both Node.js (@mediapipe/tasks-vision) and browser (WASM/WebGL) runtimes
- Extract 3D coordinates with visibility/confidence scores

#### Acceptance Criteria

- [ ] Detects all 33 pose landmarks per frame
- [ ] Works in both Node.js and browser environments
- [ ] Provides confidence scores for each landmark
- [ ] Handles frames with no detected pose gracefully

#### Key Landmarks for Analysis

- Shoulders (11, 12)
- Elbows (13, 14)
- Wrists (15, 16)
- Hips (23, 24)
- Knees (25, 26)
- Ankles (27, 28)
- Index fingers (19, 20) - for hand position inference
- Nose (0), Eyes (1-4), Ears (7, 8) - for head position

### Feature 3: Shot Detection & Phase Identification

**Priority**: High
**Dependencies**: Feature 2

#### User Story

As the analyzer, I want to automatically detect when shots occur and identify key phases so that I can extract metrics at the right moments.

#### Shot Phases

1. **Gather**: Ball received/caught, preparing to shoot
2. **Load/Dip**: Lowering into legs, ball may dip
3. **Rise**: Legs extending, ball moving upward
4. **Set Point**: Ball reaches highest point before release motion
5. **Release**: Shooting arm extends, wrist snaps
6. **Follow-through**: Arm fully extended, held position

#### Detection Logic

- Identify shot start: Hands come together, upward wrist motion begins
- Track vertical hand position to find phases
- Detect release: Rapid hand separation, shooting hand velocity spike
- Multiple shots: Reset detection after follow-through completes

#### Acceptance Criteria

- [ ] Correctly identifies shot boundaries in multi-shot videos
- [ ] Labels frames with current phase
- [ ] Returns array of detected shots with frame ranges
- [ ] Handles partial shots (video starts mid-shot) gracefully

### Feature 4: Metric Extraction

**Priority**: High
**Dependencies**: Feature 3

#### User Story

As the analyzer, I want to calculate detailed form metrics for each shot so that I can compare against ideal form profiles.

#### Metrics Categories

**Shooting Arm**
| Metric | Description | Unit | Key Frame(s) |
|--------|-------------|------|--------------|
| `shootingElbowFlare` | Angle of elbow relative to body plane | degrees | set point, release |
| `shootingElbowAngle` | Bend angle at elbow | degrees | set point, release |
| `maxArmExtension` | Maximum elbow extension achieved | degrees | follow-through |
| `wristSnapAngle` | Wrist flexion from set to release | degrees | set point vs follow-through |
| `followThroughHold` | Duration arm stays extended | % of shot |follow-through |

**Guide Arm/Hand**
| Metric | Description | Unit | Key Frame(s) |
|--------|-------------|------|--------------|
| `guideElbowFlare` | Guide arm elbow angle from body | degrees | set point |
| `guideHandPosition` | Position relative to ball/shooting hand | categorical | set point |
| `guideHandRelease` | When guide hand separates | % of shot | release |

**Ball Handling** (inferred from hand positions)
| Metric | Description | Unit | Key Frame(s) |
|--------|-------------|------|--------------|
| `ballDip` | How far ball drops before rising | normalized distance | gather to lowest point |
| `ballPath` | Straightness of path to set point | deviation score | gather to set point |
| `setPointHeight` | Height of set point relative to head | normalized | set point |
| `setPointDuration` | How long ball stays at set point | ms | set point phase |
| `releasePoint` | Height/position at release | normalized coords | release |
| `releaseAngle` | Angle of shooting arm at release | degrees | release |
| `ballBehindHead` | Furthest back position relative to head | normalized | set point |

**Lower Body**
| Metric | Description | Unit | Key Frame(s) |
|--------|-------------|------|--------------|
| `hipDrop` | How far hips drop in load phase | normalized distance | load |
| `kneeFlexion` | Maximum knee bend | degrees | load |
| `legExtensionStart` | When legs begin extending | % of shot | rise |

**Upper Body/Posture**
| Metric | Description | Unit | Key Frame(s) |
|--------|-------------|------|--------------|
| `backPosture` | Spine angle from vertical | degrees | throughout |
| `headTilt` | Head angle from neutral | degrees | release, follow-through |
| `shoulderAlignment` | Shoulder rotation relative to target | degrees | set point |

**Timing**
| Metric | Description | Unit | Key Frame(s) |
|--------|-------------|------|--------------|
| `ballRiseStart` | When ball begins upward motion | % of shot | transition |
| `legRiseStart` | When legs begin extending | % of shot | transition |
| `ballLegSync` | Difference between ball and leg rise | % (negative = ball first) | transition |
| `releaseStart` | When release motion begins | % of shot | release |
| `totalShotDuration` | Full shot from gather to follow-through | ms | all |

**Hand Position**
| Metric | Description | Unit | Key Frame(s) |
|--------|-------------|------|--------------|
| `handCupVsHinge` | Whether hand cups under or hinges back | categorical/angle | set point |

#### Output Structure

```typescript
interface ShotAnalysis {
  shotIndex: number;
  frameRange: { start: number; end: number };
  phases: {
    gather?: { startFrame: number; endFrame: number };
    load?: { startFrame: number; endFrame: number };
    rise?: { startFrame: number; endFrame: number };
    setPoint?: { startFrame: number; endFrame: number };
    release?: { startFrame: number; endFrame: number };
    followThrough?: { startFrame: number; endFrame: number };
  };
  metrics: {
    [metricName: string]: {
      value: number | string;
      unit: string;
      frame: number;
      confidence: number;
    };
  };
  overallConfidence: number;
}

interface AnalysisResult {
  shots: ShotAnalysis[];
  videoMetadata: { fps: number; totalFrames: number; duration: number };
  config: AnalysisConfig;
}
```

#### Acceptance Criteria

- [ ] Extracts all listed metrics for each detected shot
- [ ] Includes confidence score for each metric
- [ ] References specific frame number for each measurement
- [ ] Handles occluded/low-confidence landmarks gracefully

### Feature 5: Form Profile Comparison

**Priority**: High
**Dependencies**: Feature 4

#### User Story

As a developer, I want to compare extracted metrics against target profiles so that I can identify form issues.

#### Profile Structure

```typescript
interface FormProfile {
  name: string;
  description: string;
  targets: {
    [metricName: string]: {
      ideal: number | string;
      acceptable: { min: number; max: number } | string[];
      priority: "high" | "medium" | "low";
      feedback: {
        tooLow?: string;
        tooHigh?: string;
        incorrect?: string;
      };
    };
  };
}
```

#### Built-in Profiles

- `youth-fundamentals`: Age-appropriate targets for developing players
- `high-school`: More refined mechanics expectations
- `pro-form`: Elite-level targets
- `curry-style`: Quick release, specific set point (example custom)

#### Comparison Output

```typescript
interface ProfileComparison {
  profile: string;
  metrics: {
    [metricName: string]: {
      value: number | string;
      target: number | string;
      status: "pass" | "fail" | "warning";
      deviation?: number;
      feedback?: string;
    };
  };
  summary: {
    passCount: number;
    failCount: number;
    warningCount: number;
    priorityIssues: string[]; // High priority fails
  };
}
```

#### Acceptance Criteria

- [ ] Compares all metrics against selected profile
- [ ] Returns pass/fail/warning status for each
- [ ] Provides corrective feedback text for failures
- [ ] Prioritizes issues by profile-defined priority
- [ ] Supports custom profile injection

### Feature 6: Configuration & Handedness

**Priority**: Medium
**Dependencies**: None

#### User Story

As a developer, I want to configure the analyzer for shooter handedness and analysis preferences.

#### Configuration

```typescript
interface AnalysisConfig {
  shootingHand: "left" | "right";
  profile: string; // Profile name
  customProfile?: FormProfile; // Override built-in
  minConfidenceThreshold: number; // Skip low-confidence frames
  outputTimingUnit: "frames" | "ms" | "percent"; // Primary timing unit
}
```

#### Acceptance Criteria

- [ ] Correctly identifies shooting vs guide hand based on config
- [ ] Applies appropriate landmark mappings for handedness
- [ ] Validates configuration on initialization

## Technical Decisions

### Stack

- **Language**: TypeScript (strict mode)
- **Pose Detection**: MediaPipe Pose Landmarker
- **Runtime**: Universal (Node.js + Browser)
- **Build**: ESM module, bundled for browser compatibility

### MediaPipe Integration

- Use `@mediapipe/tasks-vision` package
- Pose Landmarker model with full landmark set (33 points)
- Support model complexity configuration for speed/accuracy tradeoff

### Universal Runtime Strategy

```typescript
// Abstract MediaPipe initialization
interface PoseDetector {
  detect(frame: ImageData | VideoFrame): Promise<PoseLandmarks>;
  close(): void;
}

// Factory creates appropriate implementation
function createPoseDetector(runtime: "node" | "browser"): Promise<PoseDetector>;
```

### Coordinate System

- Normalize all positions to body-relative coordinates
- Use shoulder width as reference scale for "normalized distance"
- Angles in degrees (0-360 or -180 to 180 as appropriate)
- Head position as reference for "relative to head" measurements

### Ball Position Inference

Since MediaPipe doesn't track objects:

- When hands are together: ball center = midpoint of index fingers
- Track this inferred position through shot phases
- Mark confidence as lower for ball-related metrics
- Note: After release, ball position cannot be tracked

## Module Interface

```typescript
// Main entry point
export class ShotAnalyzer {
  constructor(config: AnalysisConfig);

  // Process video file (Node.js or browser with File API)
  analyzeVideo(source: FrameProvider): Promise<AnalysisResult>;

  // Process single frame (for live streaming)
  processFrame(frame: VideoFrame): Promise<FrameAnalysis>;

  // Finalize live session, compute shot-level metrics
  finalizeLiveSession(): Promise<AnalysisResult>;

  // Compare against profile
  compareToProfile(
    result: AnalysisResult,
    profileName?: string,
  ): ProfileComparison[];

  // Get available profiles
  getProfiles(): string[];

  // Register custom profile
  registerProfile(profile: FormProfile): void;
}

// Frame provider implementations (separate files)
export function createVideoFileProvider(path: string): Promise<FrameProvider>;
export function createMediaStreamProvider(stream: MediaStream): FrameProvider;
```

## Dependency Graph

```
Feature 1: Frame Processing (standalone)
    ↓
Feature 2: Pose Detection (depends on 1)
    ↓
Feature 3: Shot Detection (depends on 2)
    ↓
Feature 4: Metric Extraction (depends on 3)
    ↓
Feature 5: Profile Comparison (depends on 4)

Feature 6: Configuration (standalone, used by all)
```

### Implementation Order

1. **Group 1** (parallel): Configuration (F6), Frame Processing interface (F1)
2. **Group 2**: Pose Detection (F2) - requires F1
3. **Group 3**: Shot Detection (F3) - requires F2
4. **Group 4**: Metric Extraction (F4) - requires F3
5. **Group 5**: Profile Comparison (F5) - requires F4

## File Structure

```
src/
├── index.ts                 # Main exports
├── analyzer.ts              # ShotAnalyzer class
├── config.ts                # Configuration types and validation
├── types.ts                 # Shared type definitions
├── pose/
│   ├── detector.ts          # PoseDetector interface
│   ├── mediapipe-node.ts    # Node.js implementation
│   └── mediapipe-browser.ts # Browser implementation
├── detection/
│   ├── shot-detector.ts     # Shot boundary detection
│   └── phase-detector.ts    # Phase identification
├── metrics/
│   ├── index.ts             # Metric orchestration
│   ├── shooting-arm.ts      # Shooting arm metrics
│   ├── guide-arm.ts         # Guide arm metrics
│   ├── ball.ts              # Ball-related metrics (inferred)
│   ├── lower-body.ts        # Hip, knee, leg metrics
│   ├── posture.ts           # Back, head, alignment
│   └── timing.ts            # Timing/synchronization metrics
├── profiles/
│   ├── index.ts             # Profile management
│   ├── types.ts             # Profile type definitions
│   ├── youth.ts             # Youth fundamentals profile
│   ├── high-school.ts       # High school profile
│   └── pro.ts               # Pro form profile
├── providers/
│   ├── types.ts             # FrameProvider interface
│   ├── video-file.ts        # File-based provider
│   └── media-stream.ts      # Live stream provider
└── utils/
    ├── geometry.ts          # Angle/distance calculations
    ├── coordinates.ts       # Coordinate normalization
    └── smoothing.ts         # Signal smoothing for noisy data
```

## Testing Strategy

### Unit Tests

- Geometry utilities (angle calculations)
- Coordinate normalization
- Profile validation
- Individual metric calculations with mock landmarks

### Integration Tests

- Full pipeline with test video clips
- Verify shot detection accuracy
- Validate metric extraction against manually measured values

### Test Data

- Use provided kid shooting clips
- Manually annotate expected values for validation
- Create synthetic landmark data for edge cases

## Open Questions / Assumptions

1. **Assumption**: Side-view camera angle initially, other angles later
2. **Assumption**: Single shooter in frame (no multi-person handling)
3. **Assumption**: Shooter is stationary (not moving significantly during shot)
4. **Future**: Add camera angle detection to auto-adjust analysis
5. **Future**: Add ball tracking model for post-release ball flight analysis

## Next Steps

After reviewing this design:

1. Make any corrections or additions
2. Run `/clear` then `/split` to create the implementation plan with individual tasks
