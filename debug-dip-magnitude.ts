import * as fs from 'fs';

const RIGHT_WRIST = 16;

console.log("Dip magnitude analysis:");
console.log("=======================\n");

// 20201212 shot 1
let poseData = JSON.parse(fs.readFileSync('./test-data/20201212_134104/poses.json', 'utf-8'));
let frame75 = poseData.frames.find((f: any) => f.frameIndex === 75);
let frame83 = poseData.frames.find((f: any) => f.frameIndex === 83);
let y75 = frame75.landmarks[RIGHT_WRIST].y;
let y83 = frame83.landmarks[RIGHT_WRIST].y;
console.log(`20201212 shot 1:`);
console.log(`  labeled start (75): wristY = ${y75.toFixed(3)}`);
console.log(`  dip point (83): wristY = ${y83.toFixed(3)}`);
console.log(`  magnitude: ${(y83 - y75).toFixed(3)} (${((y83 - y75) * 100).toFixed(1)}%)`);
console.log(`  labeled start to upward start: 75 to 86 = 11 frames`);
console.log("");

// Video 6 shot 3
poseData = JSON.parse(fs.readFileSync('./test-data/20190804_140617/poses.json', 'utf-8'));
let frame838 = poseData.frames.find((f: any) => f.frameIndex === 838);
let frame839 = poseData.frames.find((f: any) => f.frameIndex === 839);
let frame827 = poseData.frames.find((f: any) => f.frameIndex === 827);
let y838 = frame838.landmarks[RIGHT_WRIST].y;
let y839 = frame839.landmarks[RIGHT_WRIST].y;
let y827 = frame827.landmarks[RIGHT_WRIST].y;
console.log(`Video 6 shot 3:`);
console.log(`  labeled start (838): wristY = ${y838.toFixed(3)}`);
console.log(`  dip point (839): wristY = ${y839.toFixed(3)}`);
console.log(`  dipStartFrame (827): wristY = ${y827.toFixed(3)}`);
console.log(`  magnitude from 827 to 839: ${(y839 - y827).toFixed(3)} (${((y839 - y827) * 100).toFixed(1)}%)`);
console.log(`  magnitude from 838 to 839: ${(y839 - y838).toFixed(3)} (${((y839 - y838) * 100).toFixed(1)}%)`);
console.log(`  labeled start to upward start: 838 to 843 = 5 frames`);
