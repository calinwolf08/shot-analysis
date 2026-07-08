import { readFileSync } from 'fs';

interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

interface Frame {
  frameIndex: number;
  landmarks: Landmark[];
}

interface PosesData {
  frames: Frame[];
}

const poses = JSON.parse(readFileSync('test-data/20190804_140654/poses.json', 'utf-8')) as PosesData;

// Shot 5: labeled set_point=517, detected=530, diff=13
const labeledSetPoint = 517;
const detectedSetPoint = 530;

console.log('=== Shot 5 set_point analysis (labeled=517, detected=530) ===');
console.log('Frame | wristY | elbowY | Notes');
console.log('------|--------|--------|------');

const relevantFrames = poses.frames.filter(f => f.frameIndex >= 510 && f.frameIndex <= 535);

for (const frame of relevantFrames) {
  const landmarks = frame.landmarks;
  const leftWrist = landmarks[15]!;
  const rightWrist = landmarks[16]!;
  const leftElbow = landmarks[13]!;
  const rightElbow = landmarks[14]!;

  const avgWristY = (leftWrist.y + rightWrist.y) / 2;
  const avgElbowY = (leftElbow.y + rightElbow.y) / 2;

  let note = '';
  if (frame.frameIndex === labeledSetPoint) note = '<-- LABELED';
  if (frame.frameIndex === detectedSetPoint) note = '<-- DETECTED';

  console.log(frame.frameIndex.toString().padStart(5) + ' | ' + avgWristY.toFixed(4) + ' | ' + avgElbowY.toFixed(4) + ' | ' + note);
}

// Also analyze shot 6 which also fails
console.log('\n=== Shot 6 set_point analysis (labeled=634, detected=644) ===');
console.log('Frame | wristY | elbowY | Notes');
console.log('------|--------|--------|------');

const shot6Frames = poses.frames.filter(f => f.frameIndex >= 625 && f.frameIndex <= 650);

for (const frame of shot6Frames) {
  const landmarks = frame.landmarks;
  const leftWrist = landmarks[15]!;
  const rightWrist = landmarks[16]!;
  const leftElbow = landmarks[13]!;
  const rightElbow = landmarks[14]!;

  const avgWristY = (leftWrist.y + rightWrist.y) / 2;
  const avgElbowY = (leftElbow.y + rightElbow.y) / 2;

  let note = '';
  if (frame.frameIndex === 634) note = '<-- LABELED';
  if (frame.frameIndex === 644) note = '<-- DETECTED';

  console.log(frame.frameIndex.toString().padStart(5) + ' | ' + avgWristY.toFixed(4) + ' | ' + avgElbowY.toFixed(4) + ' | ' + note);
}

// Also analyze elbow angles for shot 5 to understand set_point detection
console.log('\n=== Shot 5 ELBOW ANGLE analysis ===');
console.log('Frame | wristY | elbowAngle | Notes');
console.log('------|--------|------------|------');

function calcElbowAngle(shoulder: Landmark, elbow: Landmark, wrist: Landmark): number {
  const vShoulder = { x: shoulder.x - elbow.x, y: shoulder.y - elbow.y };
  const vWrist = { x: wrist.x - elbow.x, y: wrist.y - elbow.y };

  const magS = Math.sqrt(vShoulder.x * vShoulder.x + vShoulder.y * vShoulder.y);
  const magW = Math.sqrt(vWrist.x * vWrist.x + vWrist.y * vWrist.y);

  if (magS === 0 || magW === 0) return 0;

  const dotProduct = vShoulder.x * vWrist.x + vShoulder.y * vWrist.y;
  const cosAngle = Math.max(-1, Math.min(1, dotProduct / (magS * magW)));
  return Math.acos(cosAngle) * (180 / Math.PI);
}

const shot5ElbowFrames = poses.frames.filter(f => f.frameIndex >= 510 && f.frameIndex <= 535);

for (const frame of shot5ElbowFrames) {
  const landmarks = frame.landmarks;
  const leftWrist = landmarks[15]!;
  const rightWrist = landmarks[16]!;
  const leftElbow = landmarks[13]!;
  const rightElbow = landmarks[14]!;
  const leftShoulder = landmarks[11]!;
  const rightShoulder = landmarks[12]!;

  const avgWristY = (leftWrist.y + rightWrist.y) / 2;
  const leftAngle = calcElbowAngle(leftShoulder, leftElbow, leftWrist);
  const rightAngle = calcElbowAngle(rightShoulder, rightElbow, rightWrist);
  const avgElbowAngle = (leftAngle + rightAngle) / 2;

  let note = '';
  if (frame.frameIndex === 517) note = '<-- LABELED set_point';
  if (frame.frameIndex === 530) note = '<-- DETECTED set_point';
  if (frame.frameIndex === 526) note = '<-- LABELED release';

  console.log(frame.frameIndex.toString().padStart(5) + ' | ' + avgWristY.toFixed(4) + ' | ' + avgElbowAngle.toFixed(1) + '° | ' + note);
}

// Also analyze shot 2 (behind-left) where set_point is 9 frames late
console.log('\n=== Shot 2 set_point analysis (labeled=150, detected=159) ===');
console.log('Frame | wristY | elbowY | Notes');
console.log('------|--------|--------|------');

const shot2Frames = poses.frames.filter(f => f.frameIndex >= 145 && f.frameIndex <= 165);

for (const frame of shot2Frames) {
  const landmarks = frame.landmarks;
  const leftWrist = landmarks[15]!;
  const rightWrist = landmarks[16]!;
  const leftElbow = landmarks[13]!;
  const rightElbow = landmarks[14]!;

  const avgWristY = (leftWrist.y + rightWrist.y) / 2;
  const avgElbowY = (leftElbow.y + rightElbow.y) / 2;

  let note = '';
  if (frame.frameIndex === 150) note = '<-- LABELED';
  if (frame.frameIndex === 159) note = '<-- DETECTED';

  console.log(frame.frameIndex.toString().padStart(5) + ' | ' + avgWristY.toFixed(4) + ' | ' + avgElbowY.toFixed(4) + ' | ' + note);
}

// Analyze shot 1 feet detection
console.log('\n=== Shot 1 analysis (feet_leave_ground=37, feet_land=45, detected=null) ===');
console.log('Frame | ankleY (L/R/avg) | Notes');
console.log('------|-----------------|------');

// LEFT_ANKLE=27, RIGHT_ANKLE=28
const shot1Frames = poses.frames.filter(f => f.frameIndex >= 25 && f.frameIndex <= 50);

for (const frame of shot1Frames) {
  const landmarks = frame.landmarks;
  const leftAnkle = landmarks[27]!;
  const rightAnkle = landmarks[28]!;

  const avgAnkleY = (leftAnkle.y + rightAnkle.y) / 2;

  let note = '';
  if (frame.frameIndex === 37) note = '<-- feet_leave_ground';
  if (frame.frameIndex === 45) note = '<-- feet_land';
  if (frame.frameIndex === 29) note = '<-- detected start';

  console.log(frame.frameIndex.toString().padStart(5) + ' | L=' + leftAnkle.y.toFixed(4) + ' R=' + rightAnkle.y.toFixed(4) + ' avg=' + avgAnkleY.toFixed(4) + ' | ' + note);
}

// Analyze visibility of elbow landmarks in edmond behind views
console.log('\n=== Elbow visibility analysis for edmond shots ===');

// Shot 2 (behind-left): frames 133-167
console.log('\nShot 2 (behind-left) elbow visibility:');
console.log('Frame | L-Elb Vis | R-Elb Vis | L-Wrist Vis | R-Wrist Vis | Notes');
console.log('------|-----------|-----------|-------------|-------------|------');

const shot2VisFrames = poses.frames.filter(f => f.frameIndex >= 140 && f.frameIndex <= 165);
for (const frame of shot2VisFrames) {
  const landmarks = frame.landmarks;
  const leftElbow = landmarks[13]!;
  const rightElbow = landmarks[14]!;
  const leftWrist = landmarks[15]!;
  const rightWrist = landmarks[16]!;

  let note = '';
  if (frame.frameIndex === 150) note = '<-- LABELED set_point';
  if (frame.frameIndex === 159) note = '<-- DETECTED set_point';

  console.log(
    frame.frameIndex.toString().padStart(5) + ' | ' +
    leftElbow.visibility.toFixed(3) + '     | ' +
    rightElbow.visibility.toFixed(3) + '     | ' +
    leftWrist.visibility.toFixed(3) + '       | ' +
    rightWrist.visibility.toFixed(3) + '       | ' + note
  );
}

// Shot 5 (behind-right): set_point +13
console.log('\nShot 5 (behind-right) elbow visibility and angles:');
console.log('Frame | L-Elb Vis | R-Elb Vis | L Angle | R Angle | Avg | wristY | Notes');
console.log('------|-----------|-----------|---------|---------|-----|--------|------');

const shot5VisFrames = poses.frames.filter(f => f.frameIndex >= 514 && f.frameIndex <= 535);
for (const frame of shot5VisFrames) {
  const landmarks = frame.landmarks;
  const leftElbow = landmarks[13]!;
  const rightElbow = landmarks[14]!;
  const leftShoulder = landmarks[11]!;
  const rightShoulder = landmarks[12]!;
  const leftWrist = landmarks[15]!;
  const rightWrist = landmarks[16]!;

  // Calc elbow angle
  const leftAngle = calcElbowAngle(leftShoulder, leftElbow, leftWrist);
  const rightAngle = calcElbowAngle(rightShoulder, rightElbow, rightWrist);
  const avgAngle = (leftAngle + rightAngle) / 2;
  const avgWristY = (leftWrist.y + rightWrist.y) / 2;

  let note = '';
  if (frame.frameIndex === 517) note = '<-- LABELED set_point';
  if (frame.frameIndex === 530) note = '<-- DETECTED set_point';

  // Also check if landmarks pass visibility threshold (0.5)
  const leftVisible = leftShoulder.visibility >= 0.5 && leftElbow.visibility >= 0.5 && leftWrist.visibility >= 0.5;
  const rightVisible = rightShoulder.visibility >= 0.5 && rightElbow.visibility >= 0.5 && rightWrist.visibility >= 0.5;

  // What would the algorithm compute?
  let algorithmAngle = '---';
  if (leftVisible && rightVisible) {
    algorithmAngle = ((leftAngle + rightAngle) / 2).toFixed(0) + '(B)';  // Both visible
  } else if (leftVisible) {
    algorithmAngle = leftAngle.toFixed(0) + '(L)';  // Left only
  } else if (rightVisible) {
    algorithmAngle = rightAngle.toFixed(0) + '(R)';  // Right only
  } else {
    algorithmAngle = 'null';  // Neither visible
  }

  console.log(
    frame.frameIndex.toString().padStart(5) + ' | ' +
    leftElbow.visibility.toFixed(3) + '     | ' +
    rightElbow.visibility.toFixed(3) + '     | ' +
    leftAngle.toFixed(0).padStart(7) + ' | ' +
    rightAngle.toFixed(0).padStart(7) + ' | ' +
    avgAngle.toFixed(0).padStart(3) + ' | ' +
    avgWristY.toFixed(3) + ' | ' +
    algorithmAngle + ' ' + note
  );
}

// Analyze jax shot 3 feet detection (detected -14 frames early)
console.log('\n=== jax shot 3 feet analysis (feet_leave_ground -14) ===');
const jaxPoses = JSON.parse(readFileSync('test-data/20181219_173607/poses.json', 'utf-8')) as PosesData;

// labeled feet_leave_ground=582, detected=568
console.log('Frame | ankleY | Notes');
console.log('------|--------|------');

const jaxShot3Frames = jaxPoses.frames.filter(f => f.frameIndex >= 560 && f.frameIndex <= 595);

for (const frame of jaxShot3Frames) {
  const landmarks = frame.landmarks;
  const leftAnkle = landmarks[27]!;
  const rightAnkle = landmarks[28]!;

  const avgAnkleY = (leftAnkle.y + rightAnkle.y) / 2;

  let note = '';
  if (frame.frameIndex === 568) note = '<-- detected feet_leave_ground';
  if (frame.frameIndex === 582) note = '<-- labeled feet_leave_ground';
  if (frame.frameIndex === 588) note = '<-- detected feet_land';
  if (frame.frameIndex === 591) note = '<-- labeled feet_land';

  console.log(frame.frameIndex.toString().padStart(5) + ' | ' + avgAnkleY.toFixed(4) + ' | ' + note);
}

// Analyze shot 1 earlier frames to understand why start is detected late
console.log('\n=== Shot 1 early frames (labeled start=17, detected=29) ===');
console.log('Frame | wristY | kneeAngle | Notes');
console.log('------|--------|-----------|------');

// LEFT_KNEE=25, RIGHT_KNEE=26, LEFT_HIP=23, RIGHT_HIP=24
const shot1EarlyFrames = poses.frames.filter(f => f.frameIndex >= 15 && f.frameIndex <= 35);

function calcKneeAngle(hip: Landmark, knee: Landmark, ankle: Landmark): number {
  const vHip = { x: hip.x - knee.x, y: hip.y - knee.y };
  const vAnkle = { x: ankle.x - knee.x, y: ankle.y - knee.y };

  const magHip = Math.sqrt(vHip.x * vHip.x + vHip.y * vHip.y);
  const magAnkle = Math.sqrt(vAnkle.x * vAnkle.x + vAnkle.y * vAnkle.y);

  if (magHip === 0 || magAnkle === 0) return 0;

  const dotProduct = vHip.x * vAnkle.x + vHip.y * vAnkle.y;
  const cosAngle = Math.max(-1, Math.min(1, dotProduct / (magHip * magAnkle)));
  return Math.acos(cosAngle) * (180 / Math.PI);
}

for (const frame of shot1EarlyFrames) {
  const landmarks = frame.landmarks;
  const leftWrist = landmarks[15]!;
  const rightWrist = landmarks[16]!;

  const leftHip = landmarks[23]!;
  const rightHip = landmarks[24]!;
  const leftKnee = landmarks[25]!;
  const rightKnee = landmarks[26]!;
  const leftAnkle = landmarks[27]!;
  const rightAnkle = landmarks[28]!;

  const avgWristY = (leftWrist.y + rightWrist.y) / 2;
  const leftAngle = calcKneeAngle(leftHip, leftKnee, leftAnkle);
  const rightAngle = calcKneeAngle(rightHip, rightKnee, rightAnkle);
  const avgKneeAngle = (leftAngle + rightAngle) / 2;

  let note = '';
  if (frame.frameIndex === 17) note = '<-- LABELED START';
  if (frame.frameIndex === 29) note = '<-- DETECTED START';
  if (frame.frameIndex === 28) note = '<-- leg_bend_low_point';

  console.log(frame.frameIndex.toString().padStart(5) + ' | ' + avgWristY.toFixed(4) + ' | ' + avgKneeAngle.toFixed(1) + '° | ' + note);
}
