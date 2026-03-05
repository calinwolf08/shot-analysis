# Basketball Shot Form Analysis Module - Implementation Plan

## Overview

This implementation plan breaks down the shot analysis module into 7 features following the dependency graph defined in the design. Features are organized into parallel groups based on shared file dependencies. Each task is sized for 30-90 minutes of implementation work and follows TDD principles: types → tests → logic → validation.

**Critical Requirement**: Every feature includes validation gates. Tests and TypeScript checks MUST pass before proceeding to the next feature. No shortcuts.

## Validation Gates

After each feature, a validation task must pass before proceeding:

| Gate                                | Requirements                                  |
| ----------------------------------- | --------------------------------------------- |
| `npm run check`                     | TypeScript compilation with zero errors       |
| `npm run test:unit -- --run`        | All unit tests pass                           |
| `npm run test:integration -- --run` | All integration tests pass (where applicable) |

**Rule**: If any validation fails, fix the issues before moving to the next feature. Do not proceed with failing tests or type errors.

## Feature Breakdown

### Feature 1.0: Configuration & Validation

**Parallel Group**: 1
**Estimated Tasks**: 4 (including validation gate)

#### Rationale

Configuration is a standalone foundation that all other features depend on. By implementing it first alongside the frame provider interface, we establish the core types and validation patterns used throughout the module.

#### Tasks

1. **Task 1.1: Core Types & Configuration Schema** - Define all shared TypeScript types, AnalysisConfig interface, and Zod validation schemas
2. **Task 1.2: Configuration Validation & Defaults** - Implement validation logic, handedness mapping, and default configuration factory
3. **Task 1.3: Geometry & Coordinate Utilities** - Implement angle calculations, distance utilities, and coordinate normalization helpers
4. **Task 1.4: Feature 1 Validation Gate** - Run all tests, fix any failures, ensure TypeScript passes

---

### Feature 2.0: Video Frame Processing

**Parallel Group**: 1
**Estimated Tasks**: 4 (including validation gate)

#### Rationale

The FrameProvider interface is foundational and has no dependencies. It can be implemented in parallel with Configuration since they don't share files. This feature defines how video data enters the system.

#### Tasks

1. **Task 2.1: FrameProvider Interface & Types** - Define the abstract FrameProvider interface, VideoFrame type, and frame metadata structures
2. **Task 2.2: Video File Provider Implementation** - Implement file-based FrameProvider for Node.js environment
3. **Task 2.3: MediaStream Provider Implementation** - Implement browser-based FrameProvider for live camera feeds
4. **Task 2.4: Feature 2 Validation Gate** - Run all tests, fix any failures, ensure TypeScript passes

---

### Feature 3.0: Pose Detection & Landmark Extraction

**Parallel Group**: 2
**Estimated Tasks**: 5 (including validation gate)

#### Rationale

Depends on Feature 2 (FrameProvider). This feature wraps MediaPipe and provides a clean abstraction for pose detection that works in both Node.js and browser environments.

#### Tasks

1. **Task 3.1: PoseDetector Interface & Landmark Types** - Define PoseDetector interface, PoseLandmarks type with all 33 landmarks, confidence structures
2. **Task 3.2: MediaPipe Node.js Implementation** - Implement PoseDetector for Node.js using @mediapipe/tasks-vision
3. **Task 3.3: MediaPipe Browser Implementation** - Implement PoseDetector for browser using WASM/WebGL runtime
4. **Task 3.4: Detector Factory & Runtime Selection** - Implement createPoseDetector factory with automatic runtime detection
5. **Task 3.5: Feature 3 Validation Gate** - Run all tests including integration tests with real MediaPipe, fix any failures

---

### Feature 4.0: Shot Detection & Phase Identification

**Parallel Group**: 3
**Estimated Tasks**: 5 (including validation gate)

#### Rationale

Depends on Feature 3 (Pose Detection). This is the intelligence layer that identifies shot boundaries and phases from landmark sequences. It's critical for metric extraction accuracy.

#### Tasks

1. **Task 4.1: Shot & Phase Type Definitions** - Define Shot, Phase, ShotBoundary types and phase enumeration
2. **Task 4.2: Shot Boundary Detection Logic** - Implement shot start/end detection using hand position and velocity heuristics
3. **Task 4.3: Phase Identification Logic** - Implement phase detection (gather, load, rise, set point, release, follow-through)
4. **Task 4.4: Shot Detector Integration** - Combine boundary and phase detection into ShotDetector class with multi-shot support
5. **Task 4.5: Feature 4 Validation Gate** - Run all tests, validate with realistic landmark sequences, ensure TypeScript passes

---

### Feature 5.0: Metric Extraction

**Parallel Group**: 4
**Estimated Tasks**: 9 (including validation gate and integration tests)

#### Rationale

Depends on Feature 4 (Shot Detection). This is the largest feature with many independent metric calculators. Tasks are organized by metric category to keep each focused and testable.

#### Tasks

1. **Task 5.1: Metric Types & Orchestration Interface** - Define MetricValue, ShotAnalysis, AnalysisResult types and MetricCalculator interface
2. **Task 5.2: Shooting Arm Metrics** - Implement elbow flare, elbow angle, max extension, wrist snap, follow-through hold
3. **Task 5.3: Guide Arm Metrics** - Implement guide elbow flare, guide hand position, guide hand release timing
4. **Task 5.4: Ball Position Metrics (Inferred)** - Implement ball dip, ball path, set point height/duration, release point/angle, ball behind head
5. **Task 5.5: Lower Body Metrics** - Implement hip drop, knee flexion, leg extension start
6. **Task 5.6: Posture & Alignment Metrics** - Implement back posture, head tilt, shoulder alignment, hand cup vs hinge
7. **Task 5.7: Timing & Synchronization Metrics** - Implement ball rise start, leg rise start, ball-leg sync, release start, total duration
8. **Task 5.8: Metric Integration Tests** - Write integration tests that verify all metrics work together with mock shot data
9. **Task 5.9: Feature 5 Validation Gate** - Run all unit and integration tests, ensure TypeScript passes, verify metric accuracy

---

### Feature 6.0: Form Profile Comparison

**Parallel Group**: 5
**Estimated Tasks**: 5 (including validation gate)

#### Rationale

Depends on Feature 5 (Metric Extraction). This is the final layer that compares extracted metrics against target profiles and generates corrective feedback.

#### Tasks

1. **Task 6.1: Profile Types & Validation** - Define FormProfile interface, ProfileComparison output, profile validation schema
2. **Task 6.2: Built-in Profiles** - Implement youth-fundamentals, high-school, and pro-form profiles with targets and feedback
3. **Task 6.3: Profile Comparison Engine** - Implement comparison logic with pass/fail/warning status and deviation calculation
4. **Task 6.4: Profile Management & Custom Profiles** - Implement profile registry, custom profile injection, and profile listing
5. **Task 6.5: Feature 6 Validation Gate** - Run all tests, verify profile comparison accuracy, ensure TypeScript passes

---

### Feature 7.0: Main Analyzer Integration

**Parallel Group**: 6
**Estimated Tasks**: 5 (including validation gate and E2E tests)

#### Rationale

Final integration feature that brings all components together into the public ShotAnalyzer API. Depends on all previous features.

#### Tasks

1. **Task 7.1: ShotAnalyzer Class Structure** - Implement main class with constructor, configuration, and component initialization
2. **Task 7.2: Video Analysis Pipeline** - Implement analyzeVideo method that orchestrates frame processing, detection, and metric extraction
3. **Task 7.3: Live Session Support & Public API** - Implement processFrame, finalizeLiveSession, and profile comparison methods
4. **Task 7.4: End-to-End Integration Tests** - Write comprehensive E2E tests with real video processing through complete pipeline
5. **Task 7.5: Final Validation Gate** - Run ALL tests (unit, integration, E2E), ensure TypeScript passes, verify complete API works

---

## Parallel Groups Explained

| Group | Features                                    | Reason                                                                  |
| ----- | ------------------------------------------- | ----------------------------------------------------------------------- |
| 1     | Configuration (1.0), Frame Processing (2.0) | Both are standalone foundations with no shared files                    |
| 2     | Pose Detection (3.0)                        | Depends on Frame Processing; unique MediaPipe integration               |
| 3     | Shot Detection (4.0)                        | Depends on Pose Detection; shot/phase logic                             |
| 4     | Metric Extraction (5.0)                     | Depends on Shot Detection; largest feature with many metric calculators |
| 5     | Profile Comparison (6.0)                    | Depends on Metric Extraction; feedback generation                       |
| 6     | Main Analyzer (7.0)                         | Depends on all previous features; final integration                     |

## Implementation Order

Recommended order (respecting dependencies):

1. **Group 1**: Configuration (1.0) and Frame Processing (2.0) - can run in parallel
   - **GATE**: Both features must pass validation before Group 2 starts
2. **Group 2**: Pose Detection (3.0) - requires Frame Processing
   - **GATE**: Feature 3 must pass validation before Group 3 starts
3. **Group 3**: Shot Detection (4.0) - requires Pose Detection
   - **GATE**: Feature 4 must pass validation before Group 4 starts
4. **Group 4**: Metric Extraction (5.0) - requires Shot Detection
   - **GATE**: Feature 5 must pass validation before Group 5 starts
5. **Group 5**: Profile Comparison (6.0) - requires Metric Extraction
   - **GATE**: Feature 6 must pass validation before Group 6 starts
6. **Group 6**: Main Analyzer (7.0) - requires all above
   - **FINAL GATE**: All tests pass, full TypeScript validation, E2E verified

## Shared Files to Watch

- `src/types.ts` - Core type definitions used by all features
- `src/config.ts` - Configuration types and validation
- `src/utils/geometry.ts` - Shared geometry calculations
- `src/utils/coordinates.ts` - Coordinate normalization used by metrics
- `src/pose/detector.ts` - PoseDetector interface used by detection and metrics

## Testing Strategy

### Test Organization

- **Unit tests**: Colocated with source files (`*.test.ts`)
- **Integration tests**: `*.integration.test.ts` in feature directories
- **E2E tests**: `tests/e2e/` directory for full pipeline tests

### Test Requirements Per Task

Each implementation task MUST include:

1. Unit tests for all public functions/methods
2. Edge case tests for error conditions
3. Type tests verifying TypeScript inference works correctly

### Validation Gate Requirements

Each validation gate task MUST:

1. Run `npm run check` - zero TypeScript errors
2. Run `npm run test:unit -- --run` - all unit tests pass
3. Run integration tests if applicable - all pass
4. Document any known limitations or TODO items

### Test Data

- Use provided kid shooting clips for integration tests
- Create synthetic landmark data for unit tests
- Manually annotate expected values for validation

## Success Criteria

Upon completion:

- `ShotAnalyzer` class provides full public API as specified
- All 6 shot phases are correctly identified
- All 25+ metrics are extracted with confidence scores
- 4 built-in profiles work correctly
- Both Node.js and browser runtimes are supported
- **All tests pass with zero failures**
- **TypeScript compiles with zero errors**
- Test coverage > 80% for all features
