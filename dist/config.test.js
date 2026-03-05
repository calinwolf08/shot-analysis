/**
 * Unit tests for configuration schema validation.
 * Following TDD: tests are written BEFORE implementation is verified.
 */
import { describe, it, expect } from 'vitest';
import { validateConfig, safeValidateConfig, createConfig, createDefaultConfig, getHandednessMapping, DEFAULT_CONFIG, shootingHandSchema, timingUnitSchema, formProfileSchema } from './config';
describe('analysisConfigSchema', () => {
    describe('valid configurations', () => {
        it('accepts a valid minimal configuration', () => {
            const config = {
                shootingHand: 'right',
                profile: 'youth-fundamentals',
                minConfidenceThreshold: 0.5,
                outputTimingUnit: 'percent'
            };
            const result = safeValidateConfig(config);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.shootingHand).toBe('right');
                expect(result.data.profile).toBe('youth-fundamentals');
                expect(result.data.minConfidenceThreshold).toBe(0.5);
                expect(result.data.outputTimingUnit).toBe('percent');
            }
        });
        it('accepts left-handed shooter configuration', () => {
            const config = {
                shootingHand: 'left',
                profile: 'pro-form',
                minConfidenceThreshold: 0.7,
                outputTimingUnit: 'ms'
            };
            const result = safeValidateConfig(config);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.shootingHand).toBe('left');
            }
        });
        it('accepts all valid timing units', () => {
            const units = ['frames', 'ms', 'percent'];
            for (const unit of units) {
                const config = {
                    shootingHand: 'right',
                    profile: 'test',
                    minConfidenceThreshold: 0.5,
                    outputTimingUnit: unit
                };
                const result = safeValidateConfig(config);
                expect(result.success).toBe(true);
            }
        });
        it('accepts minConfidenceThreshold of 0', () => {
            const config = {
                shootingHand: 'right',
                profile: 'test',
                minConfidenceThreshold: 0,
                outputTimingUnit: 'percent'
            };
            const result = safeValidateConfig(config);
            expect(result.success).toBe(true);
        });
        it('accepts minConfidenceThreshold of 1', () => {
            const config = {
                shootingHand: 'right',
                profile: 'test',
                minConfidenceThreshold: 1,
                outputTimingUnit: 'percent'
            };
            const result = safeValidateConfig(config);
            expect(result.success).toBe(true);
        });
        it('accepts configuration with custom profile', () => {
            const customProfile = {
                name: 'custom-profile',
                description: 'A custom form profile',
                targets: {
                    shootingElbowAngle: {
                        ideal: 90,
                        acceptable: { min: 85, max: 95 },
                        priority: 'high',
                        feedback: {
                            tooLow: 'Elbow angle too low',
                            tooHigh: 'Elbow angle too high'
                        }
                    }
                }
            };
            const config = {
                shootingHand: 'right',
                profile: 'custom-profile',
                customProfile,
                minConfidenceThreshold: 0.5,
                outputTimingUnit: 'percent'
            };
            const result = safeValidateConfig(config);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.customProfile).toBeDefined();
                expect(result.data.customProfile?.name).toBe('custom-profile');
            }
        });
    });
    describe('invalid shootingHand', () => {
        it('rejects invalid shootingHand value', () => {
            const config = {
                shootingHand: 'center',
                profile: 'test',
                minConfidenceThreshold: 0.5,
                outputTimingUnit: 'percent'
            };
            const result = safeValidateConfig(config);
            expect(result.success).toBe(false);
        });
        it('rejects empty shootingHand', () => {
            const config = {
                shootingHand: '',
                profile: 'test',
                minConfidenceThreshold: 0.5,
                outputTimingUnit: 'percent'
            };
            const result = safeValidateConfig(config);
            expect(result.success).toBe(false);
        });
        it('rejects numeric shootingHand', () => {
            const config = {
                shootingHand: 1,
                profile: 'test',
                minConfidenceThreshold: 0.5,
                outputTimingUnit: 'percent'
            };
            const result = safeValidateConfig(config);
            expect(result.success).toBe(false);
        });
    });
    describe('invalid profile', () => {
        it('rejects empty profile name', () => {
            const config = {
                shootingHand: 'right',
                profile: '',
                minConfidenceThreshold: 0.5,
                outputTimingUnit: 'percent'
            };
            const result = safeValidateConfig(config);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues.some(i => i.message.includes('empty'))).toBe(true);
            }
        });
    });
    describe('invalid minConfidenceThreshold', () => {
        it('rejects minConfidenceThreshold below 0', () => {
            const config = {
                shootingHand: 'right',
                profile: 'test',
                minConfidenceThreshold: -0.1,
                outputTimingUnit: 'percent'
            };
            const result = safeValidateConfig(config);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues.some(i => i.message.includes('at least 0'))).toBe(true);
            }
        });
        it('rejects minConfidenceThreshold above 1', () => {
            const config = {
                shootingHand: 'right',
                profile: 'test',
                minConfidenceThreshold: 1.1,
                outputTimingUnit: 'percent'
            };
            const result = safeValidateConfig(config);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues.some(i => i.message.includes('at most 1'))).toBe(true);
            }
        });
        it('rejects string minConfidenceThreshold', () => {
            const config = {
                shootingHand: 'right',
                profile: 'test',
                minConfidenceThreshold: '0.5',
                outputTimingUnit: 'percent'
            };
            const result = safeValidateConfig(config);
            expect(result.success).toBe(false);
        });
    });
    describe('invalid outputTimingUnit', () => {
        it('rejects invalid outputTimingUnit', () => {
            const config = {
                shootingHand: 'right',
                profile: 'test',
                minConfidenceThreshold: 0.5,
                outputTimingUnit: 'seconds'
            };
            const result = safeValidateConfig(config);
            expect(result.success).toBe(false);
        });
    });
});
describe('shootingHandSchema', () => {
    it('accepts "left"', () => {
        expect(shootingHandSchema.safeParse('left').success).toBe(true);
    });
    it('accepts "right"', () => {
        expect(shootingHandSchema.safeParse('right').success).toBe(true);
    });
    it('rejects other values', () => {
        expect(shootingHandSchema.safeParse('both').success).toBe(false);
        expect(shootingHandSchema.safeParse('').success).toBe(false);
        expect(shootingHandSchema.safeParse(null).success).toBe(false);
    });
});
describe('timingUnitSchema', () => {
    it('accepts "frames"', () => {
        expect(timingUnitSchema.safeParse('frames').success).toBe(true);
    });
    it('accepts "ms"', () => {
        expect(timingUnitSchema.safeParse('ms').success).toBe(true);
    });
    it('accepts "percent"', () => {
        expect(timingUnitSchema.safeParse('percent').success).toBe(true);
    });
    it('rejects other values', () => {
        expect(timingUnitSchema.safeParse('seconds').success).toBe(false);
        expect(timingUnitSchema.safeParse('').success).toBe(false);
    });
});
describe('formProfileSchema', () => {
    it('accepts valid profile', () => {
        const profile = {
            name: 'test-profile',
            description: 'Test profile description',
            targets: {}
        };
        const result = formProfileSchema.safeParse(profile);
        expect(result.success).toBe(true);
    });
    it('rejects empty profile name', () => {
        const profile = {
            name: '',
            description: 'Test',
            targets: {}
        };
        const result = formProfileSchema.safeParse(profile);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some(i => i.message.includes('empty'))).toBe(true);
        }
    });
    it('accepts profile with metric targets', () => {
        const profile = {
            name: 'test-profile',
            description: 'Test',
            targets: {
                elbowAngle: {
                    ideal: 90,
                    acceptable: { min: 85, max: 95 },
                    priority: 'high',
                    feedback: {
                        tooLow: 'Too low',
                        tooHigh: 'Too high'
                    }
                }
            }
        };
        const result = formProfileSchema.safeParse(profile);
        expect(result.success).toBe(true);
    });
    it('accepts profile with string acceptable values', () => {
        const profile = {
            name: 'test-profile',
            description: 'Test',
            targets: {
                handPosition: {
                    ideal: 'cup',
                    acceptable: ['cup', 'hinge'],
                    priority: 'medium',
                    feedback: {
                        incorrect: 'Incorrect hand position'
                    }
                }
            }
        };
        const result = formProfileSchema.safeParse(profile);
        expect(result.success).toBe(true);
    });
});
describe('validateConfig', () => {
    it('returns validated config for valid input', () => {
        const config = {
            shootingHand: 'right',
            profile: 'test',
            minConfidenceThreshold: 0.5,
            outputTimingUnit: 'percent'
        };
        const result = validateConfig(config);
        expect(result.shootingHand).toBe('right');
        expect(result.profile).toBe('test');
    });
    it('throws ZodError for invalid input', () => {
        const config = {
            shootingHand: 'invalid',
            profile: 'test',
            minConfidenceThreshold: 0.5,
            outputTimingUnit: 'percent'
        };
        expect(() => validateConfig(config)).toThrow();
    });
});
describe('createConfig', () => {
    it('returns default config when called with no arguments', () => {
        const config = createConfig();
        expect(config.shootingHand).toBe(DEFAULT_CONFIG.shootingHand);
        expect(config.profile).toBe(DEFAULT_CONFIG.profile);
        expect(config.minConfidenceThreshold).toBe(DEFAULT_CONFIG.minConfidenceThreshold);
        expect(config.outputTimingUnit).toBe(DEFAULT_CONFIG.outputTimingUnit);
    });
    it('overrides defaults with provided values', () => {
        const config = createConfig({
            shootingHand: 'left',
            minConfidenceThreshold: 0.8
        });
        expect(config.shootingHand).toBe('left');
        expect(config.minConfidenceThreshold).toBe(0.8);
        // Defaults should remain for unprovided values
        expect(config.profile).toBe(DEFAULT_CONFIG.profile);
        expect(config.outputTimingUnit).toBe(DEFAULT_CONFIG.outputTimingUnit);
    });
    it('validates the merged configuration', () => {
        expect(() => createConfig({
            minConfidenceThreshold: 2 // Invalid: > 1
        })).toThrow();
    });
});
describe('DEFAULT_CONFIG', () => {
    it('has valid default values', () => {
        const result = safeValidateConfig(DEFAULT_CONFIG);
        expect(result.success).toBe(true);
    });
    it('uses right hand as default', () => {
        expect(DEFAULT_CONFIG.shootingHand).toBe('right');
    });
    it('uses youth-fundamentals as default profile', () => {
        expect(DEFAULT_CONFIG.profile).toBe('youth-fundamentals');
    });
    it('uses 0.5 as default minConfidenceThreshold', () => {
        expect(DEFAULT_CONFIG.minConfidenceThreshold).toBe(0.5);
    });
    it('uses percent as default outputTimingUnit', () => {
        expect(DEFAULT_CONFIG.outputTimingUnit).toBe('percent');
    });
});
describe('createDefaultConfig', () => {
    it('returns a valid default configuration', () => {
        const config = createDefaultConfig();
        const result = safeValidateConfig(config);
        expect(result.success).toBe(true);
    });
    it('returns default profile as youth-fundamentals', () => {
        const config = createDefaultConfig();
        expect(config.profile).toBe('youth-fundamentals');
    });
    it('returns right-handed as default', () => {
        const config = createDefaultConfig();
        expect(config.shootingHand).toBe('right');
    });
    it('returns default minConfidenceThreshold of 0.5', () => {
        const config = createDefaultConfig();
        expect(config.minConfidenceThreshold).toBe(0.5);
    });
    it('returns percent as default outputTimingUnit', () => {
        const config = createDefaultConfig();
        expect(config.outputTimingUnit).toBe('percent');
    });
    it('does not include customProfile by default', () => {
        const config = createDefaultConfig();
        expect(config.customProfile).toBeUndefined();
    });
});
describe('getHandednessMapping', () => {
    describe('right-handed shooter', () => {
        it('returns correct shooting arm landmark indices', () => {
            const mapping = getHandednessMapping('right');
            // Right shoulder = 12, right elbow = 14, right wrist = 16
            expect(mapping.shootingShoulder).toBe(12);
            expect(mapping.shootingElbow).toBe(14);
            expect(mapping.shootingWrist).toBe(16);
        });
        it('returns correct guide arm landmark indices', () => {
            const mapping = getHandednessMapping('right');
            // Left shoulder = 11, left elbow = 13, left wrist = 15
            expect(mapping.guideShoulder).toBe(11);
            expect(mapping.guideElbow).toBe(13);
            expect(mapping.guideWrist).toBe(15);
        });
    });
    describe('left-handed shooter', () => {
        it('returns correct shooting arm landmark indices', () => {
            const mapping = getHandednessMapping('left');
            // Left shoulder = 11, left elbow = 13, left wrist = 15
            expect(mapping.shootingShoulder).toBe(11);
            expect(mapping.shootingElbow).toBe(13);
            expect(mapping.shootingWrist).toBe(15);
        });
        it('returns correct guide arm landmark indices', () => {
            const mapping = getHandednessMapping('left');
            // Right shoulder = 12, right elbow = 14, right wrist = 16
            expect(mapping.guideShoulder).toBe(12);
            expect(mapping.guideElbow).toBe(14);
            expect(mapping.guideWrist).toBe(16);
        });
    });
    it('swaps indices correctly between left and right', () => {
        const rightMapping = getHandednessMapping('right');
        const leftMapping = getHandednessMapping('left');
        // Shooting arm for right should be guide arm for left
        expect(rightMapping.shootingShoulder).toBe(leftMapping.guideShoulder);
        expect(rightMapping.shootingElbow).toBe(leftMapping.guideElbow);
        expect(rightMapping.shootingWrist).toBe(leftMapping.guideWrist);
        // Guide arm for right should be shooting arm for left
        expect(rightMapping.guideShoulder).toBe(leftMapping.shootingShoulder);
        expect(rightMapping.guideElbow).toBe(leftMapping.shootingElbow);
        expect(rightMapping.guideWrist).toBe(leftMapping.shootingWrist);
    });
});
//# sourceMappingURL=config.test.js.map