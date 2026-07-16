"use strict";
var ShotAnalysis = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to2, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to2, key) && key !== except)
          __defProp(to2, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to2;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/browser-entry.ts
  var browser_entry_exports = {};
  __export(browser_entry_exports, {
    DEFAULT_CONFIG: () => DEFAULT_CONFIG,
    DEFAULT_FEEDBACK_MESSAGES: () => DEFAULT_FEEDBACK_MESSAGES,
    DetectionShotPhase: () => ShotPhase,
    InvalidFpsError: () => InvalidFpsError,
    LANDMARK_INDICES: () => LANDMARK_INDICES,
    MediaStreamEndedError: () => MediaStreamEndedError,
    MediaStreamInactiveError: () => MediaStreamInactiveError,
    MediaStreamProvider: () => MediaStreamProvider,
    NoVideoTrackError: () => NoVideoTrackError,
    ProfileComparisonEngine: () => ProfileComparisonEngine,
    ProfileRegistry: () => ProfileRegistry,
    SHOT_PHASES: () => SHOT_PHASES,
    ShotAnalyzer: () => ShotAnalyzer,
    ShotAnalyzerAlreadyInitializedError: () => ShotAnalyzerAlreadyInitializedError,
    ShotAnalyzerNotInitializedError: () => ShotAnalyzerNotInitializedError,
    TOTAL_LANDMARKS: () => TOTAL_LANDMARKS,
    TOTAL_SHOT_PHASES: () => TOTAL_SHOT_PHASES,
    VideoElementProvider: () => VideoElementProvider,
    VideoLoadError: () => VideoLoadError,
    allBuiltInProfiles: () => allBuiltInProfiles,
    analysisConfigSchema: () => analysisConfigSchema,
    builtInProfiles: () => builtInProfiles,
    calculateAngle: () => calculateAngle,
    calculateDistance: () => calculateDistance,
    calculateDistance2D: () => calculateDistance2D,
    calculateRelativePosition: () => calculateRelativePosition,
    createConfig: () => createConfig,
    createDefaultConfig: () => createDefaultConfig,
    createEmptyAnalysisResult: () => createEmptyAnalysisResult,
    createEmptyComparisonSummary: () => createEmptyComparisonSummary,
    createEmptyMetricValue: () => createEmptyMetricValue,
    createEmptyProfileComparison: () => createEmptyProfileComparison,
    createEmptyShotAnalysis: () => createEmptyShotAnalysis,
    createEmptyVideoMetadata: () => createEmptyVideoMetadata,
    createMediaStreamProvider: () => createMediaStreamProvider,
    createPoseDetector: () => createPoseDetector,
    createPoseShotDetector: () => createPoseShotDetector,
    createShotAnalyzer: () => createShotAnalyzer,
    createVideoElementProvider: () => createVideoElementProvider,
    detectKeyframesFromFrames: () => detectKeyframesFromFrames,
    detectOrientation: () => detectOrientation,
    detectShotsFromPoses: () => detectShots,
    filterMetricsByConfidence: () => filterMetricsByConfidence,
    formProfileSchema: () => formProfileSchema,
    getAverageMetricConfidence: () => getAverageMetricConfidence,
    getBuiltInProfile: () => getBuiltInProfile,
    getFeedbackMessage: () => getFeedbackMessage,
    getHandednessMapping: () => getHandednessMapping,
    getProfileRegistry: () => getProfileRegistry,
    highSchoolProfile: () => highSchoolProfile,
    isCategoricalTarget: () => isCategoricalTarget,
    isNumericTarget: () => isNumericTarget,
    isSuccessfulMetricResult: () => isSuccessfulMetricResult,
    metricPrioritySchema: () => metricPrioritySchema,
    metricTargetSchema: () => metricTargetSchema,
    movingAverage: () => movingAverage,
    movingAveragePoint3D: () => movingAveragePoint3D,
    normalizeToBodyScale: () => normalizeToBodyScale,
    numericRangeSchema: () => numericRangeSchema,
    phasesFromKeyframes: () => phasesFromKeyframes,
    poseLandmarksToFrames: () => poseLandmarksToFrames,
    proFormProfile: () => proFormProfile,
    safeValidateConfig: () => safeValidateConfig,
    setKeyframeDiagnosticsSink: () => setKeyframeDiagnosticsSink,
    shootingHandSchema: () => shootingHandSchema,
    smoothLandmarkSequence: () => smoothLandmarkSequence,
    timingUnitSchema: () => timingUnitSchema,
    validateConfig: () => validateConfig,
    youthFundamentalsProfile: () => youthFundamentalsProfile
  });

  // src/types.ts
  var LANDMARK_INDICES = {
    NOSE: 0,
    LEFT_EYE_INNER: 1,
    LEFT_EYE: 2,
    LEFT_EYE_OUTER: 3,
    RIGHT_EYE_INNER: 4,
    RIGHT_EYE: 5,
    RIGHT_EYE_OUTER: 6,
    LEFT_EAR: 7,
    RIGHT_EAR: 8,
    MOUTH_LEFT: 9,
    MOUTH_RIGHT: 10,
    LEFT_SHOULDER: 11,
    RIGHT_SHOULDER: 12,
    LEFT_ELBOW: 13,
    RIGHT_ELBOW: 14,
    LEFT_WRIST: 15,
    RIGHT_WRIST: 16,
    LEFT_PINKY: 17,
    RIGHT_PINKY: 18,
    LEFT_INDEX: 19,
    RIGHT_INDEX: 20,
    LEFT_THUMB: 21,
    RIGHT_THUMB: 22,
    LEFT_HIP: 23,
    RIGHT_HIP: 24,
    LEFT_KNEE: 25,
    RIGHT_KNEE: 26,
    LEFT_ANKLE: 27,
    RIGHT_ANKLE: 28,
    LEFT_HEEL: 29,
    RIGHT_HEEL: 30,
    LEFT_FOOT_INDEX: 31,
    RIGHT_FOOT_INDEX: 32
  };
  var TOTAL_LANDMARKS = 33;

  // node_modules/zod/v3/external.js
  var external_exports = {};
  __export(external_exports, {
    BRAND: () => BRAND,
    DIRTY: () => DIRTY,
    EMPTY_PATH: () => EMPTY_PATH,
    INVALID: () => INVALID,
    NEVER: () => NEVER,
    OK: () => OK,
    ParseStatus: () => ParseStatus,
    Schema: () => ZodType,
    ZodAny: () => ZodAny,
    ZodArray: () => ZodArray,
    ZodBigInt: () => ZodBigInt,
    ZodBoolean: () => ZodBoolean,
    ZodBranded: () => ZodBranded,
    ZodCatch: () => ZodCatch,
    ZodDate: () => ZodDate,
    ZodDefault: () => ZodDefault,
    ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
    ZodEffects: () => ZodEffects,
    ZodEnum: () => ZodEnum,
    ZodError: () => ZodError,
    ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
    ZodFunction: () => ZodFunction,
    ZodIntersection: () => ZodIntersection,
    ZodIssueCode: () => ZodIssueCode,
    ZodLazy: () => ZodLazy,
    ZodLiteral: () => ZodLiteral,
    ZodMap: () => ZodMap,
    ZodNaN: () => ZodNaN,
    ZodNativeEnum: () => ZodNativeEnum,
    ZodNever: () => ZodNever,
    ZodNull: () => ZodNull,
    ZodNullable: () => ZodNullable,
    ZodNumber: () => ZodNumber,
    ZodObject: () => ZodObject,
    ZodOptional: () => ZodOptional,
    ZodParsedType: () => ZodParsedType,
    ZodPipeline: () => ZodPipeline,
    ZodPromise: () => ZodPromise,
    ZodReadonly: () => ZodReadonly,
    ZodRecord: () => ZodRecord,
    ZodSchema: () => ZodType,
    ZodSet: () => ZodSet,
    ZodString: () => ZodString,
    ZodSymbol: () => ZodSymbol,
    ZodTransformer: () => ZodEffects,
    ZodTuple: () => ZodTuple,
    ZodType: () => ZodType,
    ZodUndefined: () => ZodUndefined,
    ZodUnion: () => ZodUnion,
    ZodUnknown: () => ZodUnknown,
    ZodVoid: () => ZodVoid,
    addIssueToContext: () => addIssueToContext,
    any: () => anyType,
    array: () => arrayType,
    bigint: () => bigIntType,
    boolean: () => booleanType,
    coerce: () => coerce,
    custom: () => custom,
    date: () => dateType,
    datetimeRegex: () => datetimeRegex,
    defaultErrorMap: () => en_default,
    discriminatedUnion: () => discriminatedUnionType,
    effect: () => effectsType,
    enum: () => enumType,
    function: () => functionType,
    getErrorMap: () => getErrorMap,
    getParsedType: () => getParsedType,
    instanceof: () => instanceOfType,
    intersection: () => intersectionType,
    isAborted: () => isAborted,
    isAsync: () => isAsync,
    isDirty: () => isDirty,
    isValid: () => isValid,
    late: () => late,
    lazy: () => lazyType,
    literal: () => literalType,
    makeIssue: () => makeIssue,
    map: () => mapType,
    nan: () => nanType,
    nativeEnum: () => nativeEnumType,
    never: () => neverType,
    null: () => nullType,
    nullable: () => nullableType,
    number: () => numberType,
    object: () => objectType,
    objectUtil: () => objectUtil,
    oboolean: () => oboolean,
    onumber: () => onumber,
    optional: () => optionalType,
    ostring: () => ostring,
    pipeline: () => pipelineType,
    preprocess: () => preprocessType,
    promise: () => promiseType,
    quotelessJson: () => quotelessJson,
    record: () => recordType,
    set: () => setType,
    setErrorMap: () => setErrorMap,
    strictObject: () => strictObjectType,
    string: () => stringType,
    symbol: () => symbolType,
    transformer: () => effectsType,
    tuple: () => tupleType,
    undefined: () => undefinedType,
    union: () => unionType,
    unknown: () => unknownType,
    util: () => util,
    void: () => voidType
  });

  // node_modules/zod/v3/helpers/util.js
  var util;
  (function(util2) {
    util2.assertEqual = (_2) => {
    };
    function assertIs(_arg) {
    }
    util2.assertIs = assertIs;
    function assertNever(_x) {
      throw new Error();
    }
    util2.assertNever = assertNever;
    util2.arrayToEnum = (items) => {
      const obj = {};
      for (const item of items) {
        obj[item] = item;
      }
      return obj;
    };
    util2.getValidEnumValues = (obj) => {
      const validKeys = util2.objectKeys(obj).filter((k2) => typeof obj[obj[k2]] !== "number");
      const filtered = {};
      for (const k2 of validKeys) {
        filtered[k2] = obj[k2];
      }
      return util2.objectValues(filtered);
    };
    util2.objectValues = (obj) => {
      return util2.objectKeys(obj).map(function(e2) {
        return obj[e2];
      });
    };
    util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
      const keys = [];
      for (const key in object) {
        if (Object.prototype.hasOwnProperty.call(object, key)) {
          keys.push(key);
        }
      }
      return keys;
    };
    util2.find = (arr, checker) => {
      for (const item of arr) {
        if (checker(item))
          return item;
      }
      return void 0;
    };
    util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
    function joinValues(array, separator = " | ") {
      return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
    }
    util2.joinValues = joinValues;
    util2.jsonStringifyReplacer = (_2, value) => {
      if (typeof value === "bigint") {
        return value.toString();
      }
      return value;
    };
  })(util || (util = {}));
  var objectUtil;
  (function(objectUtil2) {
    objectUtil2.mergeShapes = (first, second) => {
      return {
        ...first,
        ...second
        // second overwrites first
      };
    };
  })(objectUtil || (objectUtil = {}));
  var ZodParsedType = util.arrayToEnum([
    "string",
    "nan",
    "number",
    "integer",
    "float",
    "boolean",
    "date",
    "bigint",
    "symbol",
    "function",
    "undefined",
    "null",
    "array",
    "object",
    "unknown",
    "promise",
    "void",
    "never",
    "map",
    "set"
  ]);
  var getParsedType = (data) => {
    const t2 = typeof data;
    switch (t2) {
      case "undefined":
        return ZodParsedType.undefined;
      case "string":
        return ZodParsedType.string;
      case "number":
        return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
      case "boolean":
        return ZodParsedType.boolean;
      case "function":
        return ZodParsedType.function;
      case "bigint":
        return ZodParsedType.bigint;
      case "symbol":
        return ZodParsedType.symbol;
      case "object":
        if (Array.isArray(data)) {
          return ZodParsedType.array;
        }
        if (data === null) {
          return ZodParsedType.null;
        }
        if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
          return ZodParsedType.promise;
        }
        if (typeof Map !== "undefined" && data instanceof Map) {
          return ZodParsedType.map;
        }
        if (typeof Set !== "undefined" && data instanceof Set) {
          return ZodParsedType.set;
        }
        if (typeof Date !== "undefined" && data instanceof Date) {
          return ZodParsedType.date;
        }
        return ZodParsedType.object;
      default:
        return ZodParsedType.unknown;
    }
  };

  // node_modules/zod/v3/ZodError.js
  var ZodIssueCode = util.arrayToEnum([
    "invalid_type",
    "invalid_literal",
    "custom",
    "invalid_union",
    "invalid_union_discriminator",
    "invalid_enum_value",
    "unrecognized_keys",
    "invalid_arguments",
    "invalid_return_type",
    "invalid_date",
    "invalid_string",
    "too_small",
    "too_big",
    "invalid_intersection_types",
    "not_multiple_of",
    "not_finite"
  ]);
  var quotelessJson = (obj) => {
    const json = JSON.stringify(obj, null, 2);
    return json.replace(/"([^"]+)":/g, "$1:");
  };
  var ZodError = class _ZodError extends Error {
    get errors() {
      return this.issues;
    }
    constructor(issues) {
      super();
      this.issues = [];
      this.addIssue = (sub) => {
        this.issues = [...this.issues, sub];
      };
      this.addIssues = (subs = []) => {
        this.issues = [...this.issues, ...subs];
      };
      const actualProto = new.target.prototype;
      if (Object.setPrototypeOf) {
        Object.setPrototypeOf(this, actualProto);
      } else {
        this.__proto__ = actualProto;
      }
      this.name = "ZodError";
      this.issues = issues;
    }
    format(_mapper) {
      const mapper = _mapper || function(issue) {
        return issue.message;
      };
      const fieldErrors = { _errors: [] };
      const processError = (error) => {
        for (const issue of error.issues) {
          if (issue.code === "invalid_union") {
            issue.unionErrors.map(processError);
          } else if (issue.code === "invalid_return_type") {
            processError(issue.returnTypeError);
          } else if (issue.code === "invalid_arguments") {
            processError(issue.argumentsError);
          } else if (issue.path.length === 0) {
            fieldErrors._errors.push(mapper(issue));
          } else {
            let curr = fieldErrors;
            let i2 = 0;
            while (i2 < issue.path.length) {
              const el = issue.path[i2];
              const terminal = i2 === issue.path.length - 1;
              if (!terminal) {
                curr[el] = curr[el] || { _errors: [] };
              } else {
                curr[el] = curr[el] || { _errors: [] };
                curr[el]._errors.push(mapper(issue));
              }
              curr = curr[el];
              i2++;
            }
          }
        }
      };
      processError(this);
      return fieldErrors;
    }
    static assert(value) {
      if (!(value instanceof _ZodError)) {
        throw new Error(`Not a ZodError: ${value}`);
      }
    }
    toString() {
      return this.message;
    }
    get message() {
      return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
    }
    get isEmpty() {
      return this.issues.length === 0;
    }
    flatten(mapper = (issue) => issue.message) {
      const fieldErrors = {};
      const formErrors = [];
      for (const sub of this.issues) {
        if (sub.path.length > 0) {
          const firstEl = sub.path[0];
          fieldErrors[firstEl] = fieldErrors[firstEl] || [];
          fieldErrors[firstEl].push(mapper(sub));
        } else {
          formErrors.push(mapper(sub));
        }
      }
      return { formErrors, fieldErrors };
    }
    get formErrors() {
      return this.flatten();
    }
  };
  ZodError.create = (issues) => {
    const error = new ZodError(issues);
    return error;
  };

  // node_modules/zod/v3/locales/en.js
  var errorMap = (issue, _ctx) => {
    let message;
    switch (issue.code) {
      case ZodIssueCode.invalid_type:
        if (issue.received === ZodParsedType.undefined) {
          message = "Required";
        } else {
          message = `Expected ${issue.expected}, received ${issue.received}`;
        }
        break;
      case ZodIssueCode.invalid_literal:
        message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
        break;
      case ZodIssueCode.unrecognized_keys:
        message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
        break;
      case ZodIssueCode.invalid_union:
        message = `Invalid input`;
        break;
      case ZodIssueCode.invalid_union_discriminator:
        message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
        break;
      case ZodIssueCode.invalid_enum_value:
        message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
        break;
      case ZodIssueCode.invalid_arguments:
        message = `Invalid function arguments`;
        break;
      case ZodIssueCode.invalid_return_type:
        message = `Invalid function return type`;
        break;
      case ZodIssueCode.invalid_date:
        message = `Invalid date`;
        break;
      case ZodIssueCode.invalid_string:
        if (typeof issue.validation === "object") {
          if ("includes" in issue.validation) {
            message = `Invalid input: must include "${issue.validation.includes}"`;
            if (typeof issue.validation.position === "number") {
              message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
            }
          } else if ("startsWith" in issue.validation) {
            message = `Invalid input: must start with "${issue.validation.startsWith}"`;
          } else if ("endsWith" in issue.validation) {
            message = `Invalid input: must end with "${issue.validation.endsWith}"`;
          } else {
            util.assertNever(issue.validation);
          }
        } else if (issue.validation !== "regex") {
          message = `Invalid ${issue.validation}`;
        } else {
          message = "Invalid";
        }
        break;
      case ZodIssueCode.too_small:
        if (issue.type === "array")
          message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
        else if (issue.type === "string")
          message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
        else if (issue.type === "number")
          message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
        else if (issue.type === "bigint")
          message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
        else if (issue.type === "date")
          message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
        else
          message = "Invalid input";
        break;
      case ZodIssueCode.too_big:
        if (issue.type === "array")
          message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
        else if (issue.type === "string")
          message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
        else if (issue.type === "number")
          message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
        else if (issue.type === "bigint")
          message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
        else if (issue.type === "date")
          message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
        else
          message = "Invalid input";
        break;
      case ZodIssueCode.custom:
        message = `Invalid input`;
        break;
      case ZodIssueCode.invalid_intersection_types:
        message = `Intersection results could not be merged`;
        break;
      case ZodIssueCode.not_multiple_of:
        message = `Number must be a multiple of ${issue.multipleOf}`;
        break;
      case ZodIssueCode.not_finite:
        message = "Number must be finite";
        break;
      default:
        message = _ctx.defaultError;
        util.assertNever(issue);
    }
    return { message };
  };
  var en_default = errorMap;

  // node_modules/zod/v3/errors.js
  var overrideErrorMap = en_default;
  function setErrorMap(map) {
    overrideErrorMap = map;
  }
  function getErrorMap() {
    return overrideErrorMap;
  }

  // node_modules/zod/v3/helpers/parseUtil.js
  var makeIssue = (params) => {
    const { data, path, errorMaps, issueData } = params;
    const fullPath = [...path, ...issueData.path || []];
    const fullIssue = {
      ...issueData,
      path: fullPath
    };
    if (issueData.message !== void 0) {
      return {
        ...issueData,
        path: fullPath,
        message: issueData.message
      };
    }
    let errorMessage = "";
    const maps = errorMaps.filter((m2) => !!m2).slice().reverse();
    for (const map of maps) {
      errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
    }
    return {
      ...issueData,
      path: fullPath,
      message: errorMessage
    };
  };
  var EMPTY_PATH = [];
  function addIssueToContext(ctx, issueData) {
    const overrideMap = getErrorMap();
    const issue = makeIssue({
      issueData,
      data: ctx.data,
      path: ctx.path,
      errorMaps: [
        ctx.common.contextualErrorMap,
        // contextual error map is first priority
        ctx.schemaErrorMap,
        // then schema-bound map if available
        overrideMap,
        // then global override map
        overrideMap === en_default ? void 0 : en_default
        // then global default map
      ].filter((x2) => !!x2)
    });
    ctx.common.issues.push(issue);
  }
  var ParseStatus = class _ParseStatus {
    constructor() {
      this.value = "valid";
    }
    dirty() {
      if (this.value === "valid")
        this.value = "dirty";
    }
    abort() {
      if (this.value !== "aborted")
        this.value = "aborted";
    }
    static mergeArray(status, results) {
      const arrayValue = [];
      for (const s2 of results) {
        if (s2.status === "aborted")
          return INVALID;
        if (s2.status === "dirty")
          status.dirty();
        arrayValue.push(s2.value);
      }
      return { status: status.value, value: arrayValue };
    }
    static async mergeObjectAsync(status, pairs) {
      const syncPairs = [];
      for (const pair of pairs) {
        const key = await pair.key;
        const value = await pair.value;
        syncPairs.push({
          key,
          value
        });
      }
      return _ParseStatus.mergeObjectSync(status, syncPairs);
    }
    static mergeObjectSync(status, pairs) {
      const finalObject = {};
      for (const pair of pairs) {
        const { key, value } = pair;
        if (key.status === "aborted")
          return INVALID;
        if (value.status === "aborted")
          return INVALID;
        if (key.status === "dirty")
          status.dirty();
        if (value.status === "dirty")
          status.dirty();
        if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
          finalObject[key.value] = value.value;
        }
      }
      return { status: status.value, value: finalObject };
    }
  };
  var INVALID = Object.freeze({
    status: "aborted"
  });
  var DIRTY = (value) => ({ status: "dirty", value });
  var OK = (value) => ({ status: "valid", value });
  var isAborted = (x2) => x2.status === "aborted";
  var isDirty = (x2) => x2.status === "dirty";
  var isValid = (x2) => x2.status === "valid";
  var isAsync = (x2) => typeof Promise !== "undefined" && x2 instanceof Promise;

  // node_modules/zod/v3/helpers/errorUtil.js
  var errorUtil;
  (function(errorUtil2) {
    errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
    errorUtil2.toString = (message) => typeof message === "string" ? message : message == null ? void 0 : message.message;
  })(errorUtil || (errorUtil = {}));

  // node_modules/zod/v3/types.js
  var ParseInputLazyPath = class {
    constructor(parent, value, path, key) {
      this._cachedPath = [];
      this.parent = parent;
      this.data = value;
      this._path = path;
      this._key = key;
    }
    get path() {
      if (!this._cachedPath.length) {
        if (Array.isArray(this._key)) {
          this._cachedPath.push(...this._path, ...this._key);
        } else {
          this._cachedPath.push(...this._path, this._key);
        }
      }
      return this._cachedPath;
    }
  };
  var handleResult = (ctx, result) => {
    if (isValid(result)) {
      return { success: true, data: result.value };
    } else {
      if (!ctx.common.issues.length) {
        throw new Error("Validation failed but no issues detected.");
      }
      return {
        success: false,
        get error() {
          if (this._error)
            return this._error;
          const error = new ZodError(ctx.common.issues);
          this._error = error;
          return this._error;
        }
      };
    }
  };
  function processCreateParams(params) {
    if (!params)
      return {};
    const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
    if (errorMap2 && (invalid_type_error || required_error)) {
      throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
    }
    if (errorMap2)
      return { errorMap: errorMap2, description };
    const customMap = (iss, ctx) => {
      const { message } = params;
      if (iss.code === "invalid_enum_value") {
        return { message: message ?? ctx.defaultError };
      }
      if (typeof ctx.data === "undefined") {
        return { message: message ?? required_error ?? ctx.defaultError };
      }
      if (iss.code !== "invalid_type")
        return { message: ctx.defaultError };
      return { message: message ?? invalid_type_error ?? ctx.defaultError };
    };
    return { errorMap: customMap, description };
  }
  var ZodType = class {
    get description() {
      return this._def.description;
    }
    _getType(input) {
      return getParsedType(input.data);
    }
    _getOrReturnCtx(input, ctx) {
      return ctx || {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      };
    }
    _processInputParams(input) {
      return {
        status: new ParseStatus(),
        ctx: {
          common: input.parent.common,
          data: input.data,
          parsedType: getParsedType(input.data),
          schemaErrorMap: this._def.errorMap,
          path: input.path,
          parent: input.parent
        }
      };
    }
    _parseSync(input) {
      const result = this._parse(input);
      if (isAsync(result)) {
        throw new Error("Synchronous parse encountered promise.");
      }
      return result;
    }
    _parseAsync(input) {
      const result = this._parse(input);
      return Promise.resolve(result);
    }
    parse(data, params) {
      const result = this.safeParse(data, params);
      if (result.success)
        return result.data;
      throw result.error;
    }
    safeParse(data, params) {
      const ctx = {
        common: {
          issues: [],
          async: (params == null ? void 0 : params.async) ?? false,
          contextualErrorMap: params == null ? void 0 : params.errorMap
        },
        path: (params == null ? void 0 : params.path) || [],
        schemaErrorMap: this._def.errorMap,
        parent: null,
        data,
        parsedType: getParsedType(data)
      };
      const result = this._parseSync({ data, path: ctx.path, parent: ctx });
      return handleResult(ctx, result);
    }
    "~validate"(data) {
      var _a2, _b;
      const ctx = {
        common: {
          issues: [],
          async: !!this["~standard"].async
        },
        path: [],
        schemaErrorMap: this._def.errorMap,
        parent: null,
        data,
        parsedType: getParsedType(data)
      };
      if (!this["~standard"].async) {
        try {
          const result = this._parseSync({ data, path: [], parent: ctx });
          return isValid(result) ? {
            value: result.value
          } : {
            issues: ctx.common.issues
          };
        } catch (err) {
          if ((_b = (_a2 = err == null ? void 0 : err.message) == null ? void 0 : _a2.toLowerCase()) == null ? void 0 : _b.includes("encountered")) {
            this["~standard"].async = true;
          }
          ctx.common = {
            issues: [],
            async: true
          };
        }
      }
      return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
        value: result.value
      } : {
        issues: ctx.common.issues
      });
    }
    async parseAsync(data, params) {
      const result = await this.safeParseAsync(data, params);
      if (result.success)
        return result.data;
      throw result.error;
    }
    async safeParseAsync(data, params) {
      const ctx = {
        common: {
          issues: [],
          contextualErrorMap: params == null ? void 0 : params.errorMap,
          async: true
        },
        path: (params == null ? void 0 : params.path) || [],
        schemaErrorMap: this._def.errorMap,
        parent: null,
        data,
        parsedType: getParsedType(data)
      };
      const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
      const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
      return handleResult(ctx, result);
    }
    refine(check, message) {
      const getIssueProperties = (val) => {
        if (typeof message === "string" || typeof message === "undefined") {
          return { message };
        } else if (typeof message === "function") {
          return message(val);
        } else {
          return message;
        }
      };
      return this._refinement((val, ctx) => {
        const result = check(val);
        const setError = () => ctx.addIssue({
          code: ZodIssueCode.custom,
          ...getIssueProperties(val)
        });
        if (typeof Promise !== "undefined" && result instanceof Promise) {
          return result.then((data) => {
            if (!data) {
              setError();
              return false;
            } else {
              return true;
            }
          });
        }
        if (!result) {
          setError();
          return false;
        } else {
          return true;
        }
      });
    }
    refinement(check, refinementData) {
      return this._refinement((val, ctx) => {
        if (!check(val)) {
          ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
          return false;
        } else {
          return true;
        }
      });
    }
    _refinement(refinement) {
      return new ZodEffects({
        schema: this,
        typeName: ZodFirstPartyTypeKind.ZodEffects,
        effect: { type: "refinement", refinement }
      });
    }
    superRefine(refinement) {
      return this._refinement(refinement);
    }
    constructor(def) {
      this.spa = this.safeParseAsync;
      this._def = def;
      this.parse = this.parse.bind(this);
      this.safeParse = this.safeParse.bind(this);
      this.parseAsync = this.parseAsync.bind(this);
      this.safeParseAsync = this.safeParseAsync.bind(this);
      this.spa = this.spa.bind(this);
      this.refine = this.refine.bind(this);
      this.refinement = this.refinement.bind(this);
      this.superRefine = this.superRefine.bind(this);
      this.optional = this.optional.bind(this);
      this.nullable = this.nullable.bind(this);
      this.nullish = this.nullish.bind(this);
      this.array = this.array.bind(this);
      this.promise = this.promise.bind(this);
      this.or = this.or.bind(this);
      this.and = this.and.bind(this);
      this.transform = this.transform.bind(this);
      this.brand = this.brand.bind(this);
      this.default = this.default.bind(this);
      this.catch = this.catch.bind(this);
      this.describe = this.describe.bind(this);
      this.pipe = this.pipe.bind(this);
      this.readonly = this.readonly.bind(this);
      this.isNullable = this.isNullable.bind(this);
      this.isOptional = this.isOptional.bind(this);
      this["~standard"] = {
        version: 1,
        vendor: "zod",
        validate: (data) => this["~validate"](data)
      };
    }
    optional() {
      return ZodOptional.create(this, this._def);
    }
    nullable() {
      return ZodNullable.create(this, this._def);
    }
    nullish() {
      return this.nullable().optional();
    }
    array() {
      return ZodArray.create(this);
    }
    promise() {
      return ZodPromise.create(this, this._def);
    }
    or(option) {
      return ZodUnion.create([this, option], this._def);
    }
    and(incoming) {
      return ZodIntersection.create(this, incoming, this._def);
    }
    transform(transform) {
      return new ZodEffects({
        ...processCreateParams(this._def),
        schema: this,
        typeName: ZodFirstPartyTypeKind.ZodEffects,
        effect: { type: "transform", transform }
      });
    }
    default(def) {
      const defaultValueFunc = typeof def === "function" ? def : () => def;
      return new ZodDefault({
        ...processCreateParams(this._def),
        innerType: this,
        defaultValue: defaultValueFunc,
        typeName: ZodFirstPartyTypeKind.ZodDefault
      });
    }
    brand() {
      return new ZodBranded({
        typeName: ZodFirstPartyTypeKind.ZodBranded,
        type: this,
        ...processCreateParams(this._def)
      });
    }
    catch(def) {
      const catchValueFunc = typeof def === "function" ? def : () => def;
      return new ZodCatch({
        ...processCreateParams(this._def),
        innerType: this,
        catchValue: catchValueFunc,
        typeName: ZodFirstPartyTypeKind.ZodCatch
      });
    }
    describe(description) {
      const This = this.constructor;
      return new This({
        ...this._def,
        description
      });
    }
    pipe(target) {
      return ZodPipeline.create(this, target);
    }
    readonly() {
      return ZodReadonly.create(this);
    }
    isOptional() {
      return this.safeParse(void 0).success;
    }
    isNullable() {
      return this.safeParse(null).success;
    }
  };
  var cuidRegex = /^c[^\s-]{8,}$/i;
  var cuid2Regex = /^[0-9a-z]+$/;
  var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
  var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
  var nanoidRegex = /^[a-z0-9_-]{21}$/i;
  var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
  var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
  var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
  var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
  var emojiRegex;
  var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
  var ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
  var ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
  var ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
  var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
  var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
  var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
  var dateRegex = new RegExp(`^${dateRegexSource}$`);
  function timeRegexSource(args) {
    let secondsRegexSource = `[0-5]\\d`;
    if (args.precision) {
      secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
    } else if (args.precision == null) {
      secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
    }
    const secondsQuantifier = args.precision ? "+" : "?";
    return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
  }
  function timeRegex(args) {
    return new RegExp(`^${timeRegexSource(args)}$`);
  }
  function datetimeRegex(args) {
    let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
    const opts = [];
    opts.push(args.local ? `Z?` : `Z`);
    if (args.offset)
      opts.push(`([+-]\\d{2}:?\\d{2})`);
    regex = `${regex}(${opts.join("|")})`;
    return new RegExp(`^${regex}$`);
  }
  function isValidIP(ip, version) {
    if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
      return true;
    }
    if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
      return true;
    }
    return false;
  }
  function isValidJWT(jwt, alg) {
    if (!jwtRegex.test(jwt))
      return false;
    try {
      const [header] = jwt.split(".");
      if (!header)
        return false;
      const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
      const decoded = JSON.parse(atob(base64));
      if (typeof decoded !== "object" || decoded === null)
        return false;
      if ("typ" in decoded && (decoded == null ? void 0 : decoded.typ) !== "JWT")
        return false;
      if (!decoded.alg)
        return false;
      if (alg && decoded.alg !== alg)
        return false;
      return true;
    } catch {
      return false;
    }
  }
  function isValidCidr(ip, version) {
    if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
      return true;
    }
    if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
      return true;
    }
    return false;
  }
  var ZodString = class _ZodString extends ZodType {
    _parse(input) {
      if (this._def.coerce) {
        input.data = String(input.data);
      }
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.string) {
        const ctx2 = this._getOrReturnCtx(input);
        addIssueToContext(ctx2, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.string,
          received: ctx2.parsedType
        });
        return INVALID;
      }
      const status = new ParseStatus();
      let ctx = void 0;
      for (const check of this._def.checks) {
        if (check.kind === "min") {
          if (input.data.length < check.value) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: false,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "max") {
          if (input.data.length > check.value) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: false,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "length") {
          const tooBig = input.data.length > check.value;
          const tooSmall = input.data.length < check.value;
          if (tooBig || tooSmall) {
            ctx = this._getOrReturnCtx(input, ctx);
            if (tooBig) {
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_big,
                maximum: check.value,
                type: "string",
                inclusive: true,
                exact: true,
                message: check.message
              });
            } else if (tooSmall) {
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_small,
                minimum: check.value,
                type: "string",
                inclusive: true,
                exact: true,
                message: check.message
              });
            }
            status.dirty();
          }
        } else if (check.kind === "email") {
          if (!emailRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "email",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "emoji") {
          if (!emojiRegex) {
            emojiRegex = new RegExp(_emojiRegex, "u");
          }
          if (!emojiRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "emoji",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "uuid") {
          if (!uuidRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "uuid",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "nanoid") {
          if (!nanoidRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "nanoid",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "cuid") {
          if (!cuidRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "cuid",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "cuid2") {
          if (!cuid2Regex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "cuid2",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "ulid") {
          if (!ulidRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "ulid",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "url") {
          try {
            new URL(input.data);
          } catch {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "url",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "regex") {
          check.regex.lastIndex = 0;
          const testResult = check.regex.test(input.data);
          if (!testResult) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "regex",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "trim") {
          input.data = input.data.trim();
        } else if (check.kind === "includes") {
          if (!input.data.includes(check.value, check.position)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_string,
              validation: { includes: check.value, position: check.position },
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "toLowerCase") {
          input.data = input.data.toLowerCase();
        } else if (check.kind === "toUpperCase") {
          input.data = input.data.toUpperCase();
        } else if (check.kind === "startsWith") {
          if (!input.data.startsWith(check.value)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_string,
              validation: { startsWith: check.value },
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "endsWith") {
          if (!input.data.endsWith(check.value)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_string,
              validation: { endsWith: check.value },
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "datetime") {
          const regex = datetimeRegex(check);
          if (!regex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_string,
              validation: "datetime",
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "date") {
          const regex = dateRegex;
          if (!regex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_string,
              validation: "date",
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "time") {
          const regex = timeRegex(check);
          if (!regex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_string,
              validation: "time",
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "duration") {
          if (!durationRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "duration",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "ip") {
          if (!isValidIP(input.data, check.version)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "ip",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "jwt") {
          if (!isValidJWT(input.data, check.alg)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "jwt",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "cidr") {
          if (!isValidCidr(input.data, check.version)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "cidr",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "base64") {
          if (!base64Regex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "base64",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "base64url") {
          if (!base64urlRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "base64url",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else {
          util.assertNever(check);
        }
      }
      return { status: status.value, value: input.data };
    }
    _regex(regex, validation, message) {
      return this.refinement((data) => regex.test(data), {
        validation,
        code: ZodIssueCode.invalid_string,
        ...errorUtil.errToObj(message)
      });
    }
    _addCheck(check) {
      return new _ZodString({
        ...this._def,
        checks: [...this._def.checks, check]
      });
    }
    email(message) {
      return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
    }
    url(message) {
      return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
    }
    emoji(message) {
      return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
    }
    uuid(message) {
      return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
    }
    nanoid(message) {
      return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
    }
    cuid(message) {
      return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
    }
    cuid2(message) {
      return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
    }
    ulid(message) {
      return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
    }
    base64(message) {
      return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
    }
    base64url(message) {
      return this._addCheck({
        kind: "base64url",
        ...errorUtil.errToObj(message)
      });
    }
    jwt(options) {
      return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
    }
    ip(options) {
      return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
    }
    cidr(options) {
      return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
    }
    datetime(options) {
      if (typeof options === "string") {
        return this._addCheck({
          kind: "datetime",
          precision: null,
          offset: false,
          local: false,
          message: options
        });
      }
      return this._addCheck({
        kind: "datetime",
        precision: typeof (options == null ? void 0 : options.precision) === "undefined" ? null : options == null ? void 0 : options.precision,
        offset: (options == null ? void 0 : options.offset) ?? false,
        local: (options == null ? void 0 : options.local) ?? false,
        ...errorUtil.errToObj(options == null ? void 0 : options.message)
      });
    }
    date(message) {
      return this._addCheck({ kind: "date", message });
    }
    time(options) {
      if (typeof options === "string") {
        return this._addCheck({
          kind: "time",
          precision: null,
          message: options
        });
      }
      return this._addCheck({
        kind: "time",
        precision: typeof (options == null ? void 0 : options.precision) === "undefined" ? null : options == null ? void 0 : options.precision,
        ...errorUtil.errToObj(options == null ? void 0 : options.message)
      });
    }
    duration(message) {
      return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
    }
    regex(regex, message) {
      return this._addCheck({
        kind: "regex",
        regex,
        ...errorUtil.errToObj(message)
      });
    }
    includes(value, options) {
      return this._addCheck({
        kind: "includes",
        value,
        position: options == null ? void 0 : options.position,
        ...errorUtil.errToObj(options == null ? void 0 : options.message)
      });
    }
    startsWith(value, message) {
      return this._addCheck({
        kind: "startsWith",
        value,
        ...errorUtil.errToObj(message)
      });
    }
    endsWith(value, message) {
      return this._addCheck({
        kind: "endsWith",
        value,
        ...errorUtil.errToObj(message)
      });
    }
    min(minLength, message) {
      return this._addCheck({
        kind: "min",
        value: minLength,
        ...errorUtil.errToObj(message)
      });
    }
    max(maxLength, message) {
      return this._addCheck({
        kind: "max",
        value: maxLength,
        ...errorUtil.errToObj(message)
      });
    }
    length(len, message) {
      return this._addCheck({
        kind: "length",
        value: len,
        ...errorUtil.errToObj(message)
      });
    }
    /**
     * Equivalent to `.min(1)`
     */
    nonempty(message) {
      return this.min(1, errorUtil.errToObj(message));
    }
    trim() {
      return new _ZodString({
        ...this._def,
        checks: [...this._def.checks, { kind: "trim" }]
      });
    }
    toLowerCase() {
      return new _ZodString({
        ...this._def,
        checks: [...this._def.checks, { kind: "toLowerCase" }]
      });
    }
    toUpperCase() {
      return new _ZodString({
        ...this._def,
        checks: [...this._def.checks, { kind: "toUpperCase" }]
      });
    }
    get isDatetime() {
      return !!this._def.checks.find((ch) => ch.kind === "datetime");
    }
    get isDate() {
      return !!this._def.checks.find((ch) => ch.kind === "date");
    }
    get isTime() {
      return !!this._def.checks.find((ch) => ch.kind === "time");
    }
    get isDuration() {
      return !!this._def.checks.find((ch) => ch.kind === "duration");
    }
    get isEmail() {
      return !!this._def.checks.find((ch) => ch.kind === "email");
    }
    get isURL() {
      return !!this._def.checks.find((ch) => ch.kind === "url");
    }
    get isEmoji() {
      return !!this._def.checks.find((ch) => ch.kind === "emoji");
    }
    get isUUID() {
      return !!this._def.checks.find((ch) => ch.kind === "uuid");
    }
    get isNANOID() {
      return !!this._def.checks.find((ch) => ch.kind === "nanoid");
    }
    get isCUID() {
      return !!this._def.checks.find((ch) => ch.kind === "cuid");
    }
    get isCUID2() {
      return !!this._def.checks.find((ch) => ch.kind === "cuid2");
    }
    get isULID() {
      return !!this._def.checks.find((ch) => ch.kind === "ulid");
    }
    get isIP() {
      return !!this._def.checks.find((ch) => ch.kind === "ip");
    }
    get isCIDR() {
      return !!this._def.checks.find((ch) => ch.kind === "cidr");
    }
    get isBase64() {
      return !!this._def.checks.find((ch) => ch.kind === "base64");
    }
    get isBase64url() {
      return !!this._def.checks.find((ch) => ch.kind === "base64url");
    }
    get minLength() {
      let min = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "min") {
          if (min === null || ch.value > min)
            min = ch.value;
        }
      }
      return min;
    }
    get maxLength() {
      let max = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "max") {
          if (max === null || ch.value < max)
            max = ch.value;
        }
      }
      return max;
    }
  };
  ZodString.create = (params) => {
    return new ZodString({
      checks: [],
      typeName: ZodFirstPartyTypeKind.ZodString,
      coerce: (params == null ? void 0 : params.coerce) ?? false,
      ...processCreateParams(params)
    });
  };
  function floatSafeRemainder(val, step) {
    const valDecCount = (val.toString().split(".")[1] || "").length;
    const stepDecCount = (step.toString().split(".")[1] || "").length;
    const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
    const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
    const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
    return valInt % stepInt / 10 ** decCount;
  }
  var ZodNumber = class _ZodNumber extends ZodType {
    constructor() {
      super(...arguments);
      this.min = this.gte;
      this.max = this.lte;
      this.step = this.multipleOf;
    }
    _parse(input) {
      if (this._def.coerce) {
        input.data = Number(input.data);
      }
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.number) {
        const ctx2 = this._getOrReturnCtx(input);
        addIssueToContext(ctx2, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.number,
          received: ctx2.parsedType
        });
        return INVALID;
      }
      let ctx = void 0;
      const status = new ParseStatus();
      for (const check of this._def.checks) {
        if (check.kind === "int") {
          if (!util.isInteger(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_type,
              expected: "integer",
              received: "float",
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "min") {
          const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
          if (tooSmall) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "number",
              inclusive: check.inclusive,
              exact: false,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "max") {
          const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
          if (tooBig) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "number",
              inclusive: check.inclusive,
              exact: false,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "multipleOf") {
          if (floatSafeRemainder(input.data, check.value) !== 0) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.not_multiple_of,
              multipleOf: check.value,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "finite") {
          if (!Number.isFinite(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.not_finite,
              message: check.message
            });
            status.dirty();
          }
        } else {
          util.assertNever(check);
        }
      }
      return { status: status.value, value: input.data };
    }
    gte(value, message) {
      return this.setLimit("min", value, true, errorUtil.toString(message));
    }
    gt(value, message) {
      return this.setLimit("min", value, false, errorUtil.toString(message));
    }
    lte(value, message) {
      return this.setLimit("max", value, true, errorUtil.toString(message));
    }
    lt(value, message) {
      return this.setLimit("max", value, false, errorUtil.toString(message));
    }
    setLimit(kind, value, inclusive, message) {
      return new _ZodNumber({
        ...this._def,
        checks: [
          ...this._def.checks,
          {
            kind,
            value,
            inclusive,
            message: errorUtil.toString(message)
          }
        ]
      });
    }
    _addCheck(check) {
      return new _ZodNumber({
        ...this._def,
        checks: [...this._def.checks, check]
      });
    }
    int(message) {
      return this._addCheck({
        kind: "int",
        message: errorUtil.toString(message)
      });
    }
    positive(message) {
      return this._addCheck({
        kind: "min",
        value: 0,
        inclusive: false,
        message: errorUtil.toString(message)
      });
    }
    negative(message) {
      return this._addCheck({
        kind: "max",
        value: 0,
        inclusive: false,
        message: errorUtil.toString(message)
      });
    }
    nonpositive(message) {
      return this._addCheck({
        kind: "max",
        value: 0,
        inclusive: true,
        message: errorUtil.toString(message)
      });
    }
    nonnegative(message) {
      return this._addCheck({
        kind: "min",
        value: 0,
        inclusive: true,
        message: errorUtil.toString(message)
      });
    }
    multipleOf(value, message) {
      return this._addCheck({
        kind: "multipleOf",
        value,
        message: errorUtil.toString(message)
      });
    }
    finite(message) {
      return this._addCheck({
        kind: "finite",
        message: errorUtil.toString(message)
      });
    }
    safe(message) {
      return this._addCheck({
        kind: "min",
        inclusive: true,
        value: Number.MIN_SAFE_INTEGER,
        message: errorUtil.toString(message)
      })._addCheck({
        kind: "max",
        inclusive: true,
        value: Number.MAX_SAFE_INTEGER,
        message: errorUtil.toString(message)
      });
    }
    get minValue() {
      let min = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "min") {
          if (min === null || ch.value > min)
            min = ch.value;
        }
      }
      return min;
    }
    get maxValue() {
      let max = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "max") {
          if (max === null || ch.value < max)
            max = ch.value;
        }
      }
      return max;
    }
    get isInt() {
      return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
    }
    get isFinite() {
      let max = null;
      let min = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
          return true;
        } else if (ch.kind === "min") {
          if (min === null || ch.value > min)
            min = ch.value;
        } else if (ch.kind === "max") {
          if (max === null || ch.value < max)
            max = ch.value;
        }
      }
      return Number.isFinite(min) && Number.isFinite(max);
    }
  };
  ZodNumber.create = (params) => {
    return new ZodNumber({
      checks: [],
      typeName: ZodFirstPartyTypeKind.ZodNumber,
      coerce: (params == null ? void 0 : params.coerce) || false,
      ...processCreateParams(params)
    });
  };
  var ZodBigInt = class _ZodBigInt extends ZodType {
    constructor() {
      super(...arguments);
      this.min = this.gte;
      this.max = this.lte;
    }
    _parse(input) {
      if (this._def.coerce) {
        try {
          input.data = BigInt(input.data);
        } catch {
          return this._getInvalidInput(input);
        }
      }
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.bigint) {
        return this._getInvalidInput(input);
      }
      let ctx = void 0;
      const status = new ParseStatus();
      for (const check of this._def.checks) {
        if (check.kind === "min") {
          const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
          if (tooSmall) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              type: "bigint",
              minimum: check.value,
              inclusive: check.inclusive,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "max") {
          const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
          if (tooBig) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              type: "bigint",
              maximum: check.value,
              inclusive: check.inclusive,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "multipleOf") {
          if (input.data % check.value !== BigInt(0)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.not_multiple_of,
              multipleOf: check.value,
              message: check.message
            });
            status.dirty();
          }
        } else {
          util.assertNever(check);
        }
      }
      return { status: status.value, value: input.data };
    }
    _getInvalidInput(input) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.bigint,
        received: ctx.parsedType
      });
      return INVALID;
    }
    gte(value, message) {
      return this.setLimit("min", value, true, errorUtil.toString(message));
    }
    gt(value, message) {
      return this.setLimit("min", value, false, errorUtil.toString(message));
    }
    lte(value, message) {
      return this.setLimit("max", value, true, errorUtil.toString(message));
    }
    lt(value, message) {
      return this.setLimit("max", value, false, errorUtil.toString(message));
    }
    setLimit(kind, value, inclusive, message) {
      return new _ZodBigInt({
        ...this._def,
        checks: [
          ...this._def.checks,
          {
            kind,
            value,
            inclusive,
            message: errorUtil.toString(message)
          }
        ]
      });
    }
    _addCheck(check) {
      return new _ZodBigInt({
        ...this._def,
        checks: [...this._def.checks, check]
      });
    }
    positive(message) {
      return this._addCheck({
        kind: "min",
        value: BigInt(0),
        inclusive: false,
        message: errorUtil.toString(message)
      });
    }
    negative(message) {
      return this._addCheck({
        kind: "max",
        value: BigInt(0),
        inclusive: false,
        message: errorUtil.toString(message)
      });
    }
    nonpositive(message) {
      return this._addCheck({
        kind: "max",
        value: BigInt(0),
        inclusive: true,
        message: errorUtil.toString(message)
      });
    }
    nonnegative(message) {
      return this._addCheck({
        kind: "min",
        value: BigInt(0),
        inclusive: true,
        message: errorUtil.toString(message)
      });
    }
    multipleOf(value, message) {
      return this._addCheck({
        kind: "multipleOf",
        value,
        message: errorUtil.toString(message)
      });
    }
    get minValue() {
      let min = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "min") {
          if (min === null || ch.value > min)
            min = ch.value;
        }
      }
      return min;
    }
    get maxValue() {
      let max = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "max") {
          if (max === null || ch.value < max)
            max = ch.value;
        }
      }
      return max;
    }
  };
  ZodBigInt.create = (params) => {
    return new ZodBigInt({
      checks: [],
      typeName: ZodFirstPartyTypeKind.ZodBigInt,
      coerce: (params == null ? void 0 : params.coerce) ?? false,
      ...processCreateParams(params)
    });
  };
  var ZodBoolean = class extends ZodType {
    _parse(input) {
      if (this._def.coerce) {
        input.data = Boolean(input.data);
      }
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.boolean) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.boolean,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return OK(input.data);
    }
  };
  ZodBoolean.create = (params) => {
    return new ZodBoolean({
      typeName: ZodFirstPartyTypeKind.ZodBoolean,
      coerce: (params == null ? void 0 : params.coerce) || false,
      ...processCreateParams(params)
    });
  };
  var ZodDate = class _ZodDate extends ZodType {
    _parse(input) {
      if (this._def.coerce) {
        input.data = new Date(input.data);
      }
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.date) {
        const ctx2 = this._getOrReturnCtx(input);
        addIssueToContext(ctx2, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.date,
          received: ctx2.parsedType
        });
        return INVALID;
      }
      if (Number.isNaN(input.data.getTime())) {
        const ctx2 = this._getOrReturnCtx(input);
        addIssueToContext(ctx2, {
          code: ZodIssueCode.invalid_date
        });
        return INVALID;
      }
      const status = new ParseStatus();
      let ctx = void 0;
      for (const check of this._def.checks) {
        if (check.kind === "min") {
          if (input.data.getTime() < check.value) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              message: check.message,
              inclusive: true,
              exact: false,
              minimum: check.value,
              type: "date"
            });
            status.dirty();
          }
        } else if (check.kind === "max") {
          if (input.data.getTime() > check.value) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              message: check.message,
              inclusive: true,
              exact: false,
              maximum: check.value,
              type: "date"
            });
            status.dirty();
          }
        } else {
          util.assertNever(check);
        }
      }
      return {
        status: status.value,
        value: new Date(input.data.getTime())
      };
    }
    _addCheck(check) {
      return new _ZodDate({
        ...this._def,
        checks: [...this._def.checks, check]
      });
    }
    min(minDate, message) {
      return this._addCheck({
        kind: "min",
        value: minDate.getTime(),
        message: errorUtil.toString(message)
      });
    }
    max(maxDate, message) {
      return this._addCheck({
        kind: "max",
        value: maxDate.getTime(),
        message: errorUtil.toString(message)
      });
    }
    get minDate() {
      let min = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "min") {
          if (min === null || ch.value > min)
            min = ch.value;
        }
      }
      return min != null ? new Date(min) : null;
    }
    get maxDate() {
      let max = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "max") {
          if (max === null || ch.value < max)
            max = ch.value;
        }
      }
      return max != null ? new Date(max) : null;
    }
  };
  ZodDate.create = (params) => {
    return new ZodDate({
      checks: [],
      coerce: (params == null ? void 0 : params.coerce) || false,
      typeName: ZodFirstPartyTypeKind.ZodDate,
      ...processCreateParams(params)
    });
  };
  var ZodSymbol = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.symbol) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.symbol,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return OK(input.data);
    }
  };
  ZodSymbol.create = (params) => {
    return new ZodSymbol({
      typeName: ZodFirstPartyTypeKind.ZodSymbol,
      ...processCreateParams(params)
    });
  };
  var ZodUndefined = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.undefined) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.undefined,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return OK(input.data);
    }
  };
  ZodUndefined.create = (params) => {
    return new ZodUndefined({
      typeName: ZodFirstPartyTypeKind.ZodUndefined,
      ...processCreateParams(params)
    });
  };
  var ZodNull = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.null) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.null,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return OK(input.data);
    }
  };
  ZodNull.create = (params) => {
    return new ZodNull({
      typeName: ZodFirstPartyTypeKind.ZodNull,
      ...processCreateParams(params)
    });
  };
  var ZodAny = class extends ZodType {
    constructor() {
      super(...arguments);
      this._any = true;
    }
    _parse(input) {
      return OK(input.data);
    }
  };
  ZodAny.create = (params) => {
    return new ZodAny({
      typeName: ZodFirstPartyTypeKind.ZodAny,
      ...processCreateParams(params)
    });
  };
  var ZodUnknown = class extends ZodType {
    constructor() {
      super(...arguments);
      this._unknown = true;
    }
    _parse(input) {
      return OK(input.data);
    }
  };
  ZodUnknown.create = (params) => {
    return new ZodUnknown({
      typeName: ZodFirstPartyTypeKind.ZodUnknown,
      ...processCreateParams(params)
    });
  };
  var ZodNever = class extends ZodType {
    _parse(input) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.never,
        received: ctx.parsedType
      });
      return INVALID;
    }
  };
  ZodNever.create = (params) => {
    return new ZodNever({
      typeName: ZodFirstPartyTypeKind.ZodNever,
      ...processCreateParams(params)
    });
  };
  var ZodVoid = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.undefined) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.void,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return OK(input.data);
    }
  };
  ZodVoid.create = (params) => {
    return new ZodVoid({
      typeName: ZodFirstPartyTypeKind.ZodVoid,
      ...processCreateParams(params)
    });
  };
  var ZodArray = class _ZodArray extends ZodType {
    _parse(input) {
      const { ctx, status } = this._processInputParams(input);
      const def = this._def;
      if (ctx.parsedType !== ZodParsedType.array) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.array,
          received: ctx.parsedType
        });
        return INVALID;
      }
      if (def.exactLength !== null) {
        const tooBig = ctx.data.length > def.exactLength.value;
        const tooSmall = ctx.data.length < def.exactLength.value;
        if (tooBig || tooSmall) {
          addIssueToContext(ctx, {
            code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
            minimum: tooSmall ? def.exactLength.value : void 0,
            maximum: tooBig ? def.exactLength.value : void 0,
            type: "array",
            inclusive: true,
            exact: true,
            message: def.exactLength.message
          });
          status.dirty();
        }
      }
      if (def.minLength !== null) {
        if (ctx.data.length < def.minLength.value) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: def.minLength.value,
            type: "array",
            inclusive: true,
            exact: false,
            message: def.minLength.message
          });
          status.dirty();
        }
      }
      if (def.maxLength !== null) {
        if (ctx.data.length > def.maxLength.value) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: def.maxLength.value,
            type: "array",
            inclusive: true,
            exact: false,
            message: def.maxLength.message
          });
          status.dirty();
        }
      }
      if (ctx.common.async) {
        return Promise.all([...ctx.data].map((item, i2) => {
          return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i2));
        })).then((result2) => {
          return ParseStatus.mergeArray(status, result2);
        });
      }
      const result = [...ctx.data].map((item, i2) => {
        return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i2));
      });
      return ParseStatus.mergeArray(status, result);
    }
    get element() {
      return this._def.type;
    }
    min(minLength, message) {
      return new _ZodArray({
        ...this._def,
        minLength: { value: minLength, message: errorUtil.toString(message) }
      });
    }
    max(maxLength, message) {
      return new _ZodArray({
        ...this._def,
        maxLength: { value: maxLength, message: errorUtil.toString(message) }
      });
    }
    length(len, message) {
      return new _ZodArray({
        ...this._def,
        exactLength: { value: len, message: errorUtil.toString(message) }
      });
    }
    nonempty(message) {
      return this.min(1, message);
    }
  };
  ZodArray.create = (schema, params) => {
    return new ZodArray({
      type: schema,
      minLength: null,
      maxLength: null,
      exactLength: null,
      typeName: ZodFirstPartyTypeKind.ZodArray,
      ...processCreateParams(params)
    });
  };
  function deepPartialify(schema) {
    if (schema instanceof ZodObject) {
      const newShape = {};
      for (const key in schema.shape) {
        const fieldSchema = schema.shape[key];
        newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
      }
      return new ZodObject({
        ...schema._def,
        shape: () => newShape
      });
    } else if (schema instanceof ZodArray) {
      return new ZodArray({
        ...schema._def,
        type: deepPartialify(schema.element)
      });
    } else if (schema instanceof ZodOptional) {
      return ZodOptional.create(deepPartialify(schema.unwrap()));
    } else if (schema instanceof ZodNullable) {
      return ZodNullable.create(deepPartialify(schema.unwrap()));
    } else if (schema instanceof ZodTuple) {
      return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
    } else {
      return schema;
    }
  }
  var ZodObject = class _ZodObject extends ZodType {
    constructor() {
      super(...arguments);
      this._cached = null;
      this.nonstrict = this.passthrough;
      this.augment = this.extend;
    }
    _getCached() {
      if (this._cached !== null)
        return this._cached;
      const shape = this._def.shape();
      const keys = util.objectKeys(shape);
      this._cached = { shape, keys };
      return this._cached;
    }
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.object) {
        const ctx2 = this._getOrReturnCtx(input);
        addIssueToContext(ctx2, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.object,
          received: ctx2.parsedType
        });
        return INVALID;
      }
      const { status, ctx } = this._processInputParams(input);
      const { shape, keys: shapeKeys } = this._getCached();
      const extraKeys = [];
      if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
        for (const key in ctx.data) {
          if (!shapeKeys.includes(key)) {
            extraKeys.push(key);
          }
        }
      }
      const pairs = [];
      for (const key of shapeKeys) {
        const keyValidator = shape[key];
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
          alwaysSet: key in ctx.data
        });
      }
      if (this._def.catchall instanceof ZodNever) {
        const unknownKeys = this._def.unknownKeys;
        if (unknownKeys === "passthrough") {
          for (const key of extraKeys) {
            pairs.push({
              key: { status: "valid", value: key },
              value: { status: "valid", value: ctx.data[key] }
            });
          }
        } else if (unknownKeys === "strict") {
          if (extraKeys.length > 0) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.unrecognized_keys,
              keys: extraKeys
            });
            status.dirty();
          }
        } else if (unknownKeys === "strip") {
        } else {
          throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
        }
      } else {
        const catchall = this._def.catchall;
        for (const key of extraKeys) {
          const value = ctx.data[key];
          pairs.push({
            key: { status: "valid", value: key },
            value: catchall._parse(
              new ParseInputLazyPath(ctx, value, ctx.path, key)
              //, ctx.child(key), value, getParsedType(value)
            ),
            alwaysSet: key in ctx.data
          });
        }
      }
      if (ctx.common.async) {
        return Promise.resolve().then(async () => {
          const syncPairs = [];
          for (const pair of pairs) {
            const key = await pair.key;
            const value = await pair.value;
            syncPairs.push({
              key,
              value,
              alwaysSet: pair.alwaysSet
            });
          }
          return syncPairs;
        }).then((syncPairs) => {
          return ParseStatus.mergeObjectSync(status, syncPairs);
        });
      } else {
        return ParseStatus.mergeObjectSync(status, pairs);
      }
    }
    get shape() {
      return this._def.shape();
    }
    strict(message) {
      errorUtil.errToObj;
      return new _ZodObject({
        ...this._def,
        unknownKeys: "strict",
        ...message !== void 0 ? {
          errorMap: (issue, ctx) => {
            var _a2, _b;
            const defaultError = ((_b = (_a2 = this._def).errorMap) == null ? void 0 : _b.call(_a2, issue, ctx).message) ?? ctx.defaultError;
            if (issue.code === "unrecognized_keys")
              return {
                message: errorUtil.errToObj(message).message ?? defaultError
              };
            return {
              message: defaultError
            };
          }
        } : {}
      });
    }
    strip() {
      return new _ZodObject({
        ...this._def,
        unknownKeys: "strip"
      });
    }
    passthrough() {
      return new _ZodObject({
        ...this._def,
        unknownKeys: "passthrough"
      });
    }
    // const AugmentFactory =
    //   <Def extends ZodObjectDef>(def: Def) =>
    //   <Augmentation extends ZodRawShape>(
    //     augmentation: Augmentation
    //   ): ZodObject<
    //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
    //     Def["unknownKeys"],
    //     Def["catchall"]
    //   > => {
    //     return new ZodObject({
    //       ...def,
    //       shape: () => ({
    //         ...def.shape(),
    //         ...augmentation,
    //       }),
    //     }) as any;
    //   };
    extend(augmentation) {
      return new _ZodObject({
        ...this._def,
        shape: () => ({
          ...this._def.shape(),
          ...augmentation
        })
      });
    }
    /**
     * Prior to zod@1.0.12 there was a bug in the
     * inferred type of merged objects. Please
     * upgrade if you are experiencing issues.
     */
    merge(merging) {
      const merged = new _ZodObject({
        unknownKeys: merging._def.unknownKeys,
        catchall: merging._def.catchall,
        shape: () => ({
          ...this._def.shape(),
          ...merging._def.shape()
        }),
        typeName: ZodFirstPartyTypeKind.ZodObject
      });
      return merged;
    }
    // merge<
    //   Incoming extends AnyZodObject,
    //   Augmentation extends Incoming["shape"],
    //   NewOutput extends {
    //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
    //       ? Augmentation[k]["_output"]
    //       : k extends keyof Output
    //       ? Output[k]
    //       : never;
    //   },
    //   NewInput extends {
    //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
    //       ? Augmentation[k]["_input"]
    //       : k extends keyof Input
    //       ? Input[k]
    //       : never;
    //   }
    // >(
    //   merging: Incoming
    // ): ZodObject<
    //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
    //   Incoming["_def"]["unknownKeys"],
    //   Incoming["_def"]["catchall"],
    //   NewOutput,
    //   NewInput
    // > {
    //   const merged: any = new ZodObject({
    //     unknownKeys: merging._def.unknownKeys,
    //     catchall: merging._def.catchall,
    //     shape: () =>
    //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
    //     typeName: ZodFirstPartyTypeKind.ZodObject,
    //   }) as any;
    //   return merged;
    // }
    setKey(key, schema) {
      return this.augment({ [key]: schema });
    }
    // merge<Incoming extends AnyZodObject>(
    //   merging: Incoming
    // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
    // ZodObject<
    //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
    //   Incoming["_def"]["unknownKeys"],
    //   Incoming["_def"]["catchall"]
    // > {
    //   // const mergedShape = objectUtil.mergeShapes(
    //   //   this._def.shape(),
    //   //   merging._def.shape()
    //   // );
    //   const merged: any = new ZodObject({
    //     unknownKeys: merging._def.unknownKeys,
    //     catchall: merging._def.catchall,
    //     shape: () =>
    //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
    //     typeName: ZodFirstPartyTypeKind.ZodObject,
    //   }) as any;
    //   return merged;
    // }
    catchall(index) {
      return new _ZodObject({
        ...this._def,
        catchall: index
      });
    }
    pick(mask) {
      const shape = {};
      for (const key of util.objectKeys(mask)) {
        if (mask[key] && this.shape[key]) {
          shape[key] = this.shape[key];
        }
      }
      return new _ZodObject({
        ...this._def,
        shape: () => shape
      });
    }
    omit(mask) {
      const shape = {};
      for (const key of util.objectKeys(this.shape)) {
        if (!mask[key]) {
          shape[key] = this.shape[key];
        }
      }
      return new _ZodObject({
        ...this._def,
        shape: () => shape
      });
    }
    /**
     * @deprecated
     */
    deepPartial() {
      return deepPartialify(this);
    }
    partial(mask) {
      const newShape = {};
      for (const key of util.objectKeys(this.shape)) {
        const fieldSchema = this.shape[key];
        if (mask && !mask[key]) {
          newShape[key] = fieldSchema;
        } else {
          newShape[key] = fieldSchema.optional();
        }
      }
      return new _ZodObject({
        ...this._def,
        shape: () => newShape
      });
    }
    required(mask) {
      const newShape = {};
      for (const key of util.objectKeys(this.shape)) {
        if (mask && !mask[key]) {
          newShape[key] = this.shape[key];
        } else {
          const fieldSchema = this.shape[key];
          let newField = fieldSchema;
          while (newField instanceof ZodOptional) {
            newField = newField._def.innerType;
          }
          newShape[key] = newField;
        }
      }
      return new _ZodObject({
        ...this._def,
        shape: () => newShape
      });
    }
    keyof() {
      return createZodEnum(util.objectKeys(this.shape));
    }
  };
  ZodObject.create = (shape, params) => {
    return new ZodObject({
      shape: () => shape,
      unknownKeys: "strip",
      catchall: ZodNever.create(),
      typeName: ZodFirstPartyTypeKind.ZodObject,
      ...processCreateParams(params)
    });
  };
  ZodObject.strictCreate = (shape, params) => {
    return new ZodObject({
      shape: () => shape,
      unknownKeys: "strict",
      catchall: ZodNever.create(),
      typeName: ZodFirstPartyTypeKind.ZodObject,
      ...processCreateParams(params)
    });
  };
  ZodObject.lazycreate = (shape, params) => {
    return new ZodObject({
      shape,
      unknownKeys: "strip",
      catchall: ZodNever.create(),
      typeName: ZodFirstPartyTypeKind.ZodObject,
      ...processCreateParams(params)
    });
  };
  var ZodUnion = class extends ZodType {
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      const options = this._def.options;
      function handleResults(results) {
        for (const result of results) {
          if (result.result.status === "valid") {
            return result.result;
          }
        }
        for (const result of results) {
          if (result.result.status === "dirty") {
            ctx.common.issues.push(...result.ctx.common.issues);
            return result.result;
          }
        }
        const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_union,
          unionErrors
        });
        return INVALID;
      }
      if (ctx.common.async) {
        return Promise.all(options.map(async (option) => {
          const childCtx = {
            ...ctx,
            common: {
              ...ctx.common,
              issues: []
            },
            parent: null
          };
          return {
            result: await option._parseAsync({
              data: ctx.data,
              path: ctx.path,
              parent: childCtx
            }),
            ctx: childCtx
          };
        })).then(handleResults);
      } else {
        let dirty = void 0;
        const issues = [];
        for (const option of options) {
          const childCtx = {
            ...ctx,
            common: {
              ...ctx.common,
              issues: []
            },
            parent: null
          };
          const result = option._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          });
          if (result.status === "valid") {
            return result;
          } else if (result.status === "dirty" && !dirty) {
            dirty = { result, ctx: childCtx };
          }
          if (childCtx.common.issues.length) {
            issues.push(childCtx.common.issues);
          }
        }
        if (dirty) {
          ctx.common.issues.push(...dirty.ctx.common.issues);
          return dirty.result;
        }
        const unionErrors = issues.map((issues2) => new ZodError(issues2));
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_union,
          unionErrors
        });
        return INVALID;
      }
    }
    get options() {
      return this._def.options;
    }
  };
  ZodUnion.create = (types, params) => {
    return new ZodUnion({
      options: types,
      typeName: ZodFirstPartyTypeKind.ZodUnion,
      ...processCreateParams(params)
    });
  };
  var getDiscriminator = (type) => {
    if (type instanceof ZodLazy) {
      return getDiscriminator(type.schema);
    } else if (type instanceof ZodEffects) {
      return getDiscriminator(type.innerType());
    } else if (type instanceof ZodLiteral) {
      return [type.value];
    } else if (type instanceof ZodEnum) {
      return type.options;
    } else if (type instanceof ZodNativeEnum) {
      return util.objectValues(type.enum);
    } else if (type instanceof ZodDefault) {
      return getDiscriminator(type._def.innerType);
    } else if (type instanceof ZodUndefined) {
      return [void 0];
    } else if (type instanceof ZodNull) {
      return [null];
    } else if (type instanceof ZodOptional) {
      return [void 0, ...getDiscriminator(type.unwrap())];
    } else if (type instanceof ZodNullable) {
      return [null, ...getDiscriminator(type.unwrap())];
    } else if (type instanceof ZodBranded) {
      return getDiscriminator(type.unwrap());
    } else if (type instanceof ZodReadonly) {
      return getDiscriminator(type.unwrap());
    } else if (type instanceof ZodCatch) {
      return getDiscriminator(type._def.innerType);
    } else {
      return [];
    }
  };
  var ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.object) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.object,
          received: ctx.parsedType
        });
        return INVALID;
      }
      const discriminator = this.discriminator;
      const discriminatorValue = ctx.data[discriminator];
      const option = this.optionsMap.get(discriminatorValue);
      if (!option) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_union_discriminator,
          options: Array.from(this.optionsMap.keys()),
          path: [discriminator]
        });
        return INVALID;
      }
      if (ctx.common.async) {
        return option._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
      } else {
        return option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
      }
    }
    get discriminator() {
      return this._def.discriminator;
    }
    get options() {
      return this._def.options;
    }
    get optionsMap() {
      return this._def.optionsMap;
    }
    /**
     * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
     * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
     * have a different value for each object in the union.
     * @param discriminator the name of the discriminator property
     * @param types an array of object schemas
     * @param params
     */
    static create(discriminator, options, params) {
      const optionsMap = /* @__PURE__ */ new Map();
      for (const type of options) {
        const discriminatorValues = getDiscriminator(type.shape[discriminator]);
        if (!discriminatorValues.length) {
          throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
        }
        for (const value of discriminatorValues) {
          if (optionsMap.has(value)) {
            throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
          }
          optionsMap.set(value, type);
        }
      }
      return new _ZodDiscriminatedUnion({
        typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
        discriminator,
        options,
        optionsMap,
        ...processCreateParams(params)
      });
    }
  };
  function mergeValues(a2, b2) {
    const aType = getParsedType(a2);
    const bType = getParsedType(b2);
    if (a2 === b2) {
      return { valid: true, data: a2 };
    } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
      const bKeys = util.objectKeys(b2);
      const sharedKeys = util.objectKeys(a2).filter((key) => bKeys.indexOf(key) !== -1);
      const newObj = { ...a2, ...b2 };
      for (const key of sharedKeys) {
        const sharedValue = mergeValues(a2[key], b2[key]);
        if (!sharedValue.valid) {
          return { valid: false };
        }
        newObj[key] = sharedValue.data;
      }
      return { valid: true, data: newObj };
    } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
      if (a2.length !== b2.length) {
        return { valid: false };
      }
      const newArray = [];
      for (let index = 0; index < a2.length; index++) {
        const itemA = a2[index];
        const itemB = b2[index];
        const sharedValue = mergeValues(itemA, itemB);
        if (!sharedValue.valid) {
          return { valid: false };
        }
        newArray.push(sharedValue.data);
      }
      return { valid: true, data: newArray };
    } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a2 === +b2) {
      return { valid: true, data: a2 };
    } else {
      return { valid: false };
    }
  }
  var ZodIntersection = class extends ZodType {
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      const handleParsed = (parsedLeft, parsedRight) => {
        if (isAborted(parsedLeft) || isAborted(parsedRight)) {
          return INVALID;
        }
        const merged = mergeValues(parsedLeft.value, parsedRight.value);
        if (!merged.valid) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_intersection_types
          });
          return INVALID;
        }
        if (isDirty(parsedLeft) || isDirty(parsedRight)) {
          status.dirty();
        }
        return { status: status.value, value: merged.data };
      };
      if (ctx.common.async) {
        return Promise.all([
          this._def.left._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          }),
          this._def.right._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          })
        ]).then(([left, right]) => handleParsed(left, right));
      } else {
        return handleParsed(this._def.left._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }), this._def.right._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }));
      }
    }
  };
  ZodIntersection.create = (left, right, params) => {
    return new ZodIntersection({
      left,
      right,
      typeName: ZodFirstPartyTypeKind.ZodIntersection,
      ...processCreateParams(params)
    });
  };
  var ZodTuple = class _ZodTuple extends ZodType {
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.array) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.array,
          received: ctx.parsedType
        });
        return INVALID;
      }
      if (ctx.data.length < this._def.items.length) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: this._def.items.length,
          inclusive: true,
          exact: false,
          type: "array"
        });
        return INVALID;
      }
      const rest = this._def.rest;
      if (!rest && ctx.data.length > this._def.items.length) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: this._def.items.length,
          inclusive: true,
          exact: false,
          type: "array"
        });
        status.dirty();
      }
      const items = [...ctx.data].map((item, itemIndex) => {
        const schema = this._def.items[itemIndex] || this._def.rest;
        if (!schema)
          return null;
        return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
      }).filter((x2) => !!x2);
      if (ctx.common.async) {
        return Promise.all(items).then((results) => {
          return ParseStatus.mergeArray(status, results);
        });
      } else {
        return ParseStatus.mergeArray(status, items);
      }
    }
    get items() {
      return this._def.items;
    }
    rest(rest) {
      return new _ZodTuple({
        ...this._def,
        rest
      });
    }
  };
  ZodTuple.create = (schemas, params) => {
    if (!Array.isArray(schemas)) {
      throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
    }
    return new ZodTuple({
      items: schemas,
      typeName: ZodFirstPartyTypeKind.ZodTuple,
      rest: null,
      ...processCreateParams(params)
    });
  };
  var ZodRecord = class _ZodRecord extends ZodType {
    get keySchema() {
      return this._def.keyType;
    }
    get valueSchema() {
      return this._def.valueType;
    }
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.object) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.object,
          received: ctx.parsedType
        });
        return INVALID;
      }
      const pairs = [];
      const keyType = this._def.keyType;
      const valueType = this._def.valueType;
      for (const key in ctx.data) {
        pairs.push({
          key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
          value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
          alwaysSet: key in ctx.data
        });
      }
      if (ctx.common.async) {
        return ParseStatus.mergeObjectAsync(status, pairs);
      } else {
        return ParseStatus.mergeObjectSync(status, pairs);
      }
    }
    get element() {
      return this._def.valueType;
    }
    static create(first, second, third) {
      if (second instanceof ZodType) {
        return new _ZodRecord({
          keyType: first,
          valueType: second,
          typeName: ZodFirstPartyTypeKind.ZodRecord,
          ...processCreateParams(third)
        });
      }
      return new _ZodRecord({
        keyType: ZodString.create(),
        valueType: first,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(second)
      });
    }
  };
  var ZodMap = class extends ZodType {
    get keySchema() {
      return this._def.keyType;
    }
    get valueSchema() {
      return this._def.valueType;
    }
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.map) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.map,
          received: ctx.parsedType
        });
        return INVALID;
      }
      const keyType = this._def.keyType;
      const valueType = this._def.valueType;
      const pairs = [...ctx.data.entries()].map(([key, value], index) => {
        return {
          key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
          value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
        };
      });
      if (ctx.common.async) {
        const finalMap = /* @__PURE__ */ new Map();
        return Promise.resolve().then(async () => {
          for (const pair of pairs) {
            const key = await pair.key;
            const value = await pair.value;
            if (key.status === "aborted" || value.status === "aborted") {
              return INVALID;
            }
            if (key.status === "dirty" || value.status === "dirty") {
              status.dirty();
            }
            finalMap.set(key.value, value.value);
          }
          return { status: status.value, value: finalMap };
        });
      } else {
        const finalMap = /* @__PURE__ */ new Map();
        for (const pair of pairs) {
          const key = pair.key;
          const value = pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      }
    }
  };
  ZodMap.create = (keyType, valueType, params) => {
    return new ZodMap({
      valueType,
      keyType,
      typeName: ZodFirstPartyTypeKind.ZodMap,
      ...processCreateParams(params)
    });
  };
  var ZodSet = class _ZodSet extends ZodType {
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.set) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.set,
          received: ctx.parsedType
        });
        return INVALID;
      }
      const def = this._def;
      if (def.minSize !== null) {
        if (ctx.data.size < def.minSize.value) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: def.minSize.value,
            type: "set",
            inclusive: true,
            exact: false,
            message: def.minSize.message
          });
          status.dirty();
        }
      }
      if (def.maxSize !== null) {
        if (ctx.data.size > def.maxSize.value) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: def.maxSize.value,
            type: "set",
            inclusive: true,
            exact: false,
            message: def.maxSize.message
          });
          status.dirty();
        }
      }
      const valueType = this._def.valueType;
      function finalizeSet(elements2) {
        const parsedSet = /* @__PURE__ */ new Set();
        for (const element of elements2) {
          if (element.status === "aborted")
            return INVALID;
          if (element.status === "dirty")
            status.dirty();
          parsedSet.add(element.value);
        }
        return { status: status.value, value: parsedSet };
      }
      const elements = [...ctx.data.values()].map((item, i2) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i2)));
      if (ctx.common.async) {
        return Promise.all(elements).then((elements2) => finalizeSet(elements2));
      } else {
        return finalizeSet(elements);
      }
    }
    min(minSize, message) {
      return new _ZodSet({
        ...this._def,
        minSize: { value: minSize, message: errorUtil.toString(message) }
      });
    }
    max(maxSize, message) {
      return new _ZodSet({
        ...this._def,
        maxSize: { value: maxSize, message: errorUtil.toString(message) }
      });
    }
    size(size, message) {
      return this.min(size, message).max(size, message);
    }
    nonempty(message) {
      return this.min(1, message);
    }
  };
  ZodSet.create = (valueType, params) => {
    return new ZodSet({
      valueType,
      minSize: null,
      maxSize: null,
      typeName: ZodFirstPartyTypeKind.ZodSet,
      ...processCreateParams(params)
    });
  };
  var ZodFunction = class _ZodFunction extends ZodType {
    constructor() {
      super(...arguments);
      this.validate = this.implement;
    }
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.function) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.function,
          received: ctx.parsedType
        });
        return INVALID;
      }
      function makeArgsIssue(args, error) {
        return makeIssue({
          data: args,
          path: ctx.path,
          errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x2) => !!x2),
          issueData: {
            code: ZodIssueCode.invalid_arguments,
            argumentsError: error
          }
        });
      }
      function makeReturnsIssue(returns, error) {
        return makeIssue({
          data: returns,
          path: ctx.path,
          errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x2) => !!x2),
          issueData: {
            code: ZodIssueCode.invalid_return_type,
            returnTypeError: error
          }
        });
      }
      const params = { errorMap: ctx.common.contextualErrorMap };
      const fn2 = ctx.data;
      if (this._def.returns instanceof ZodPromise) {
        const me2 = this;
        return OK(async function(...args) {
          const error = new ZodError([]);
          const parsedArgs = await me2._def.args.parseAsync(args, params).catch((e2) => {
            error.addIssue(makeArgsIssue(args, e2));
            throw error;
          });
          const result = await Reflect.apply(fn2, this, parsedArgs);
          const parsedReturns = await me2._def.returns._def.type.parseAsync(result, params).catch((e2) => {
            error.addIssue(makeReturnsIssue(result, e2));
            throw error;
          });
          return parsedReturns;
        });
      } else {
        const me2 = this;
        return OK(function(...args) {
          const parsedArgs = me2._def.args.safeParse(args, params);
          if (!parsedArgs.success) {
            throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
          }
          const result = Reflect.apply(fn2, this, parsedArgs.data);
          const parsedReturns = me2._def.returns.safeParse(result, params);
          if (!parsedReturns.success) {
            throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
          }
          return parsedReturns.data;
        });
      }
    }
    parameters() {
      return this._def.args;
    }
    returnType() {
      return this._def.returns;
    }
    args(...items) {
      return new _ZodFunction({
        ...this._def,
        args: ZodTuple.create(items).rest(ZodUnknown.create())
      });
    }
    returns(returnType) {
      return new _ZodFunction({
        ...this._def,
        returns: returnType
      });
    }
    implement(func) {
      const validatedFunc = this.parse(func);
      return validatedFunc;
    }
    strictImplement(func) {
      const validatedFunc = this.parse(func);
      return validatedFunc;
    }
    static create(args, returns, params) {
      return new _ZodFunction({
        args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
        returns: returns || ZodUnknown.create(),
        typeName: ZodFirstPartyTypeKind.ZodFunction,
        ...processCreateParams(params)
      });
    }
  };
  var ZodLazy = class extends ZodType {
    get schema() {
      return this._def.getter();
    }
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      const lazySchema = this._def.getter();
      return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
    }
  };
  ZodLazy.create = (getter, params) => {
    return new ZodLazy({
      getter,
      typeName: ZodFirstPartyTypeKind.ZodLazy,
      ...processCreateParams(params)
    });
  };
  var ZodLiteral = class extends ZodType {
    _parse(input) {
      if (input.data !== this._def.value) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          received: ctx.data,
          code: ZodIssueCode.invalid_literal,
          expected: this._def.value
        });
        return INVALID;
      }
      return { status: "valid", value: input.data };
    }
    get value() {
      return this._def.value;
    }
  };
  ZodLiteral.create = (value, params) => {
    return new ZodLiteral({
      value,
      typeName: ZodFirstPartyTypeKind.ZodLiteral,
      ...processCreateParams(params)
    });
  };
  function createZodEnum(values, params) {
    return new ZodEnum({
      values,
      typeName: ZodFirstPartyTypeKind.ZodEnum,
      ...processCreateParams(params)
    });
  }
  var ZodEnum = class _ZodEnum extends ZodType {
    _parse(input) {
      if (typeof input.data !== "string") {
        const ctx = this._getOrReturnCtx(input);
        const expectedValues = this._def.values;
        addIssueToContext(ctx, {
          expected: util.joinValues(expectedValues),
          received: ctx.parsedType,
          code: ZodIssueCode.invalid_type
        });
        return INVALID;
      }
      if (!this._cache) {
        this._cache = new Set(this._def.values);
      }
      if (!this._cache.has(input.data)) {
        const ctx = this._getOrReturnCtx(input);
        const expectedValues = this._def.values;
        addIssueToContext(ctx, {
          received: ctx.data,
          code: ZodIssueCode.invalid_enum_value,
          options: expectedValues
        });
        return INVALID;
      }
      return OK(input.data);
    }
    get options() {
      return this._def.values;
    }
    get enum() {
      const enumValues = {};
      for (const val of this._def.values) {
        enumValues[val] = val;
      }
      return enumValues;
    }
    get Values() {
      const enumValues = {};
      for (const val of this._def.values) {
        enumValues[val] = val;
      }
      return enumValues;
    }
    get Enum() {
      const enumValues = {};
      for (const val of this._def.values) {
        enumValues[val] = val;
      }
      return enumValues;
    }
    extract(values, newDef = this._def) {
      return _ZodEnum.create(values, {
        ...this._def,
        ...newDef
      });
    }
    exclude(values, newDef = this._def) {
      return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
        ...this._def,
        ...newDef
      });
    }
  };
  ZodEnum.create = createZodEnum;
  var ZodNativeEnum = class extends ZodType {
    _parse(input) {
      const nativeEnumValues = util.getValidEnumValues(this._def.values);
      const ctx = this._getOrReturnCtx(input);
      if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
        const expectedValues = util.objectValues(nativeEnumValues);
        addIssueToContext(ctx, {
          expected: util.joinValues(expectedValues),
          received: ctx.parsedType,
          code: ZodIssueCode.invalid_type
        });
        return INVALID;
      }
      if (!this._cache) {
        this._cache = new Set(util.getValidEnumValues(this._def.values));
      }
      if (!this._cache.has(input.data)) {
        const expectedValues = util.objectValues(nativeEnumValues);
        addIssueToContext(ctx, {
          received: ctx.data,
          code: ZodIssueCode.invalid_enum_value,
          options: expectedValues
        });
        return INVALID;
      }
      return OK(input.data);
    }
    get enum() {
      return this._def.values;
    }
  };
  ZodNativeEnum.create = (values, params) => {
    return new ZodNativeEnum({
      values,
      typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
      ...processCreateParams(params)
    });
  };
  var ZodPromise = class extends ZodType {
    unwrap() {
      return this._def.type;
    }
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.promise,
          received: ctx.parsedType
        });
        return INVALID;
      }
      const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
      return OK(promisified.then((data) => {
        return this._def.type.parseAsync(data, {
          path: ctx.path,
          errorMap: ctx.common.contextualErrorMap
        });
      }));
    }
  };
  ZodPromise.create = (schema, params) => {
    return new ZodPromise({
      type: schema,
      typeName: ZodFirstPartyTypeKind.ZodPromise,
      ...processCreateParams(params)
    });
  };
  var ZodEffects = class extends ZodType {
    innerType() {
      return this._def.schema;
    }
    sourceType() {
      return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
    }
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      const effect = this._def.effect || null;
      const checkCtx = {
        addIssue: (arg) => {
          addIssueToContext(ctx, arg);
          if (arg.fatal) {
            status.abort();
          } else {
            status.dirty();
          }
        },
        get path() {
          return ctx.path;
        }
      };
      checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
      if (effect.type === "preprocess") {
        const processed = effect.transform(ctx.data, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(processed).then(async (processed2) => {
            if (status.value === "aborted")
              return INVALID;
            const result = await this._def.schema._parseAsync({
              data: processed2,
              path: ctx.path,
              parent: ctx
            });
            if (result.status === "aborted")
              return INVALID;
            if (result.status === "dirty")
              return DIRTY(result.value);
            if (status.value === "dirty")
              return DIRTY(result.value);
            return result;
          });
        } else {
          if (status.value === "aborted")
            return INVALID;
          const result = this._def.schema._parseSync({
            data: processed,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        }
      }
      if (effect.type === "refinement") {
        const executeRefinement = (acc) => {
          const result = effect.refinement(acc, checkCtx);
          if (ctx.common.async) {
            return Promise.resolve(result);
          }
          if (result instanceof Promise) {
            throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
          }
          return acc;
        };
        if (ctx.common.async === false) {
          const inner = this._def.schema._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          executeRefinement(inner.value);
          return { status: status.value, value: inner.value };
        } else {
          return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
            if (inner.status === "aborted")
              return INVALID;
            if (inner.status === "dirty")
              status.dirty();
            return executeRefinement(inner.value).then(() => {
              return { status: status.value, value: inner.value };
            });
          });
        }
      }
      if (effect.type === "transform") {
        if (ctx.common.async === false) {
          const base = this._def.schema._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
          if (!isValid(base))
            return INVALID;
          const result = effect.transform(base.value, checkCtx);
          if (result instanceof Promise) {
            throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
          }
          return { status: status.value, value: result };
        } else {
          return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
            if (!isValid(base))
              return INVALID;
            return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
              status: status.value,
              value: result
            }));
          });
        }
      }
      util.assertNever(effect);
    }
  };
  ZodEffects.create = (schema, effect, params) => {
    return new ZodEffects({
      schema,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect,
      ...processCreateParams(params)
    });
  };
  ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
    return new ZodEffects({
      schema,
      effect: { type: "preprocess", transform: preprocess },
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      ...processCreateParams(params)
    });
  };
  var ZodOptional = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType === ZodParsedType.undefined) {
        return OK(void 0);
      }
      return this._def.innerType._parse(input);
    }
    unwrap() {
      return this._def.innerType;
    }
  };
  ZodOptional.create = (type, params) => {
    return new ZodOptional({
      innerType: type,
      typeName: ZodFirstPartyTypeKind.ZodOptional,
      ...processCreateParams(params)
    });
  };
  var ZodNullable = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType === ZodParsedType.null) {
        return OK(null);
      }
      return this._def.innerType._parse(input);
    }
    unwrap() {
      return this._def.innerType;
    }
  };
  ZodNullable.create = (type, params) => {
    return new ZodNullable({
      innerType: type,
      typeName: ZodFirstPartyTypeKind.ZodNullable,
      ...processCreateParams(params)
    });
  };
  var ZodDefault = class extends ZodType {
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      let data = ctx.data;
      if (ctx.parsedType === ZodParsedType.undefined) {
        data = this._def.defaultValue();
      }
      return this._def.innerType._parse({
        data,
        path: ctx.path,
        parent: ctx
      });
    }
    removeDefault() {
      return this._def.innerType;
    }
  };
  ZodDefault.create = (type, params) => {
    return new ZodDefault({
      innerType: type,
      typeName: ZodFirstPartyTypeKind.ZodDefault,
      defaultValue: typeof params.default === "function" ? params.default : () => params.default,
      ...processCreateParams(params)
    });
  };
  var ZodCatch = class extends ZodType {
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      const newCtx = {
        ...ctx,
        common: {
          ...ctx.common,
          issues: []
        }
      };
      const result = this._def.innerType._parse({
        data: newCtx.data,
        path: newCtx.path,
        parent: {
          ...newCtx
        }
      });
      if (isAsync(result)) {
        return result.then((result2) => {
          return {
            status: "valid",
            value: result2.status === "valid" ? result2.value : this._def.catchValue({
              get error() {
                return new ZodError(newCtx.common.issues);
              },
              input: newCtx.data
            })
          };
        });
      } else {
        return {
          status: "valid",
          value: result.status === "valid" ? result.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      }
    }
    removeCatch() {
      return this._def.innerType;
    }
  };
  ZodCatch.create = (type, params) => {
    return new ZodCatch({
      innerType: type,
      typeName: ZodFirstPartyTypeKind.ZodCatch,
      catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
      ...processCreateParams(params)
    });
  };
  var ZodNaN = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.nan) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.nan,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return { status: "valid", value: input.data };
    }
  };
  ZodNaN.create = (params) => {
    return new ZodNaN({
      typeName: ZodFirstPartyTypeKind.ZodNaN,
      ...processCreateParams(params)
    });
  };
  var BRAND = Symbol("zod_brand");
  var ZodBranded = class extends ZodType {
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      const data = ctx.data;
      return this._def.type._parse({
        data,
        path: ctx.path,
        parent: ctx
      });
    }
    unwrap() {
      return this._def.type;
    }
  };
  var ZodPipeline = class _ZodPipeline extends ZodType {
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      if (ctx.common.async) {
        const handleAsync = async () => {
          const inResult = await this._def.in._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
          if (inResult.status === "aborted")
            return INVALID;
          if (inResult.status === "dirty") {
            status.dirty();
            return DIRTY(inResult.value);
          } else {
            return this._def.out._parseAsync({
              data: inResult.value,
              path: ctx.path,
              parent: ctx
            });
          }
        };
        return handleAsync();
      } else {
        const inResult = this._def.in._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return {
            status: "dirty",
            value: inResult.value
          };
        } else {
          return this._def.out._parseSync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      }
    }
    static create(a2, b2) {
      return new _ZodPipeline({
        in: a2,
        out: b2,
        typeName: ZodFirstPartyTypeKind.ZodPipeline
      });
    }
  };
  var ZodReadonly = class extends ZodType {
    _parse(input) {
      const result = this._def.innerType._parse(input);
      const freeze = (data) => {
        if (isValid(data)) {
          data.value = Object.freeze(data.value);
        }
        return data;
      };
      return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
    }
    unwrap() {
      return this._def.innerType;
    }
  };
  ZodReadonly.create = (type, params) => {
    return new ZodReadonly({
      innerType: type,
      typeName: ZodFirstPartyTypeKind.ZodReadonly,
      ...processCreateParams(params)
    });
  };
  function cleanParams(params, data) {
    const p2 = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
    const p22 = typeof p2 === "string" ? { message: p2 } : p2;
    return p22;
  }
  function custom(check, _params = {}, fatal) {
    if (check)
      return ZodAny.create().superRefine((data, ctx) => {
        const r2 = check(data);
        if (r2 instanceof Promise) {
          return r2.then((r3) => {
            if (!r3) {
              const params = cleanParams(_params, data);
              const _fatal = params.fatal ?? fatal ?? true;
              ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
            }
          });
        }
        if (!r2) {
          const params = cleanParams(_params, data);
          const _fatal = params.fatal ?? fatal ?? true;
          ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
        }
        return;
      });
    return ZodAny.create();
  }
  var late = {
    object: ZodObject.lazycreate
  };
  var ZodFirstPartyTypeKind;
  (function(ZodFirstPartyTypeKind2) {
    ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
    ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
    ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
    ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
    ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
    ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
    ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
    ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
    ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
    ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
    ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
    ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
    ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
    ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
    ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
    ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
    ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
    ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
    ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
    ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
    ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
    ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
    ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
    ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
    ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
    ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
    ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
    ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
    ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
    ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
    ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
    ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
    ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
    ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
    ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
    ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
  })(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
  var instanceOfType = (cls, params = {
    message: `Input not instance of ${cls.name}`
  }) => custom((data) => data instanceof cls, params);
  var stringType = ZodString.create;
  var numberType = ZodNumber.create;
  var nanType = ZodNaN.create;
  var bigIntType = ZodBigInt.create;
  var booleanType = ZodBoolean.create;
  var dateType = ZodDate.create;
  var symbolType = ZodSymbol.create;
  var undefinedType = ZodUndefined.create;
  var nullType = ZodNull.create;
  var anyType = ZodAny.create;
  var unknownType = ZodUnknown.create;
  var neverType = ZodNever.create;
  var voidType = ZodVoid.create;
  var arrayType = ZodArray.create;
  var objectType = ZodObject.create;
  var strictObjectType = ZodObject.strictCreate;
  var unionType = ZodUnion.create;
  var discriminatedUnionType = ZodDiscriminatedUnion.create;
  var intersectionType = ZodIntersection.create;
  var tupleType = ZodTuple.create;
  var recordType = ZodRecord.create;
  var mapType = ZodMap.create;
  var setType = ZodSet.create;
  var functionType = ZodFunction.create;
  var lazyType = ZodLazy.create;
  var literalType = ZodLiteral.create;
  var enumType = ZodEnum.create;
  var nativeEnumType = ZodNativeEnum.create;
  var promiseType = ZodPromise.create;
  var effectsType = ZodEffects.create;
  var optionalType = ZodOptional.create;
  var nullableType = ZodNullable.create;
  var preprocessType = ZodEffects.createWithPreprocess;
  var pipelineType = ZodPipeline.create;
  var ostring = () => stringType().optional();
  var onumber = () => numberType().optional();
  var oboolean = () => booleanType().optional();
  var coerce = {
    string: (arg) => ZodString.create({ ...arg, coerce: true }),
    number: (arg) => ZodNumber.create({ ...arg, coerce: true }),
    boolean: (arg) => ZodBoolean.create({
      ...arg,
      coerce: true
    }),
    bigint: (arg) => ZodBigInt.create({ ...arg, coerce: true }),
    date: (arg) => ZodDate.create({ ...arg, coerce: true })
  };
  var NEVER = INVALID;

  // src/config.ts
  var metricPrioritySchema = external_exports.enum(["high", "medium", "low"]);
  var numericRangeSchema = external_exports.object({
    min: external_exports.number(),
    max: external_exports.number()
  }).refine((data) => data.min <= data.max, {
    message: "min must be less than or equal to max"
  });
  var metricTargetSchema = external_exports.object({
    ideal: external_exports.union([external_exports.number(), external_exports.string()]),
    acceptable: external_exports.union([numericRangeSchema, external_exports.array(external_exports.string()).readonly()]),
    priority: metricPrioritySchema,
    feedback: external_exports.object({
      tooLow: external_exports.string().optional(),
      tooHigh: external_exports.string().optional(),
      incorrect: external_exports.string().optional()
    })
  });
  var formProfileSchema = external_exports.object({
    name: external_exports.string().min(1, "Profile name cannot be empty"),
    description: external_exports.string(),
    targets: external_exports.record(external_exports.string(), metricTargetSchema)
  });
  var shootingHandSchema = external_exports.enum(["left", "right"]);
  var timingUnitSchema = external_exports.enum(["frames", "ms", "percent"]);
  var analysisConfigSchema = external_exports.object({
    shootingHand: shootingHandSchema,
    profile: external_exports.string().min(1, "Profile name cannot be empty"),
    customProfile: formProfileSchema.optional(),
    minConfidenceThreshold: external_exports.number().min(0, "minConfidenceThreshold must be at least 0").max(1, "minConfidenceThreshold must be at most 1"),
    outputTimingUnit: timingUnitSchema
  });
  function validateConfig(config) {
    return analysisConfigSchema.parse(config);
  }
  function safeValidateConfig(config) {
    return analysisConfigSchema.safeParse(config);
  }
  var DEFAULT_CONFIG = {
    shootingHand: "right",
    profile: "youth-fundamentals",
    minConfidenceThreshold: 0.5,
    outputTimingUnit: "percent"
  };
  function createConfig(partial = {}) {
    const merged = { ...DEFAULT_CONFIG, ...partial };
    return validateConfig(merged);
  }
  function createDefaultConfig() {
    return createConfig();
  }
  var LEFT_SIDE_INDICES = {
    shoulder: 11,
    elbow: 13,
    wrist: 15
  };
  var RIGHT_SIDE_INDICES = {
    shoulder: 12,
    elbow: 14,
    wrist: 16
  };
  function getHandednessMapping(shootingHand) {
    if (shootingHand === "right") {
      return {
        shootingShoulder: RIGHT_SIDE_INDICES.shoulder,
        shootingElbow: RIGHT_SIDE_INDICES.elbow,
        shootingWrist: RIGHT_SIDE_INDICES.wrist,
        guideShoulder: LEFT_SIDE_INDICES.shoulder,
        guideElbow: LEFT_SIDE_INDICES.elbow,
        guideWrist: LEFT_SIDE_INDICES.wrist
      };
    } else {
      return {
        shootingShoulder: LEFT_SIDE_INDICES.shoulder,
        shootingElbow: LEFT_SIDE_INDICES.elbow,
        shootingWrist: LEFT_SIDE_INDICES.wrist,
        guideShoulder: RIGHT_SIDE_INDICES.shoulder,
        guideElbow: RIGHT_SIDE_INDICES.elbow,
        guideWrist: RIGHT_SIDE_INDICES.wrist
      };
    }
  }

  // src/utils/geometry.ts
  function calculateAngle(a2, vertex, c2) {
    const va2 = {
      x: a2.x - vertex.x,
      y: a2.y - vertex.y,
      z: a2.z - vertex.z
    };
    const vc2 = {
      x: c2.x - vertex.x,
      y: c2.y - vertex.y,
      z: c2.z - vertex.z
    };
    const magnitudeVa = Math.sqrt(va2.x * va2.x + va2.y * va2.y + va2.z * va2.z);
    const magnitudeVc = Math.sqrt(vc2.x * vc2.x + vc2.y * vc2.y + vc2.z * vc2.z);
    if (magnitudeVa === 0 || magnitudeVc === 0) {
      return 0;
    }
    const dotProduct = va2.x * vc2.x + va2.y * vc2.y + va2.z * vc2.z;
    const cosAngle = Math.max(
      -1,
      Math.min(1, dotProduct / (magnitudeVa * magnitudeVc))
    );
    const angleRadians = Math.acos(cosAngle);
    const angleDegrees = angleRadians * (180 / Math.PI);
    return angleDegrees;
  }
  function calculateDistance(a2, b2) {
    const dx = b2.x - a2.x;
    const dy = b2.y - a2.y;
    const dz = b2.z - a2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  function calculateDistance2D(a2, b2) {
    const dx = b2.x - a2.x;
    const dy = b2.y - a2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // src/utils/coordinates.ts
  function normalizeToBodyScale(distance, shoulderWidth) {
    if (shoulderWidth <= 0) {
      throw new Error("Shoulder width must be greater than zero");
    }
    return distance / shoulderWidth;
  }
  function calculateRelativePosition(point, reference) {
    return {
      x: point.x - reference.x,
      y: point.y - reference.y,
      z: point.z - reference.z
    };
  }

  // src/utils/smoothing.ts
  var DEFAULT_WINDOW_SIZE = 3;
  function movingAverage(values, windowSize) {
    if (windowSize < 1) {
      throw new Error("Window size must be at least 1");
    }
    if (values.length === 0) {
      return [];
    }
    const result = [];
    for (let i2 = 0; i2 < values.length; i2++) {
      const windowStart = Math.max(0, i2 - windowSize + 1);
      const actualWindowSize = i2 - windowStart + 1;
      let sum = 0;
      for (let j2 = windowStart; j2 <= i2; j2++) {
        sum += values[j2];
      }
      result.push(sum / actualWindowSize);
    }
    return result;
  }
  function movingAveragePoint3D(points, windowSize) {
    if (windowSize < 1) {
      throw new Error("Window size must be at least 1");
    }
    if (points.length === 0) {
      return [];
    }
    const xValues = points.map((p2) => p2.x);
    const yValues = points.map((p2) => p2.y);
    const zValues = points.map((p2) => p2.z);
    const smoothedX = movingAverage(xValues, windowSize);
    const smoothedY = movingAverage(yValues, windowSize);
    const smoothedZ = movingAverage(zValues, windowSize);
    const result = [];
    for (let i2 = 0; i2 < points.length; i2++) {
      result.push({
        x: smoothedX[i2],
        y: smoothedY[i2],
        z: smoothedZ[i2]
      });
    }
    return result;
  }
  function smoothLandmarkSequence(sequence, windowSize = DEFAULT_WINDOW_SIZE) {
    return movingAveragePoint3D(sequence, windowSize);
  }

  // src/providers/types.ts
  var InvalidFpsError = class extends Error {
    constructor(fps) {
      super(
        `Invalid fps value: ${fps}. FPS must be a positive number greater than zero.`
      );
      this.name = "InvalidFpsError";
    }
  };

  // src/providers/media-stream.ts
  var MediaStreamEndedError = class extends Error {
    constructor() {
      super("Media stream has ended unexpectedly");
      this.name = "MediaStreamEndedError";
    }
  };
  var MediaStreamInactiveError = class extends Error {
    constructor() {
      super("Media stream is inactive");
      this.name = "MediaStreamInactiveError";
    }
  };
  var NoVideoTrackError = class extends Error {
    constructor() {
      super("Media stream has no video track");
      this.name = "NoVideoTrackError";
    }
  };
  var MediaStreamProvider = class _MediaStreamProvider {
    /**
     * Private constructor. Use createMediaStreamProvider() factory function.
     */
    constructor(stream, videoElement, context, fps, width, height) {
      __publicField(this, "stream");
      __publicField(this, "videoElement");
      __publicField(this, "context");
      __publicField(this, "fps");
      __publicField(this, "frameInterval");
      __publicField(this, "width");
      __publicField(this, "height");
      __publicField(this, "currentFrameIndex", 0);
      __publicField(this, "disposed", false);
      __publicField(this, "streamEnded", false);
      /**
       * Handler for stream ended event.
       */
      __publicField(this, "handleStreamEnded", () => {
        this.streamEnded = true;
      });
      this.stream = stream;
      this.videoElement = videoElement;
      this.context = context;
      this.fps = fps;
      this.frameInterval = 1e3 / fps;
      this.width = width;
      this.height = height;
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.addEventListener("ended", this.handleStreamEnded);
      }
    }
    /**
     * Creates a MediaStreamProvider from a browser MediaStream.
     *
     * @param stream - MediaStream from getUserMedia() or other source
     * @param options - Optional configuration options
     * @returns Promise resolving to a MediaStreamProvider instance
     * @throws {MediaStreamInactiveError} If the stream is inactive
     * @throws {NoVideoTrackError} If the stream has no video track
     */
    static async create(stream, options) {
      if (!stream.active) {
        throw new MediaStreamInactiveError();
      }
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length === 0) {
        throw new NoVideoTrackError();
      }
      const videoTrack = videoTracks[0];
      const settings = videoTrack.getSettings();
      const width = settings.width ?? 640;
      const height = settings.height ?? 480;
      const fps = (options == null ? void 0 : options.fps) ?? settings.frameRate ?? 30;
      const videoElement = document.createElement("video");
      videoElement.srcObject = stream;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Failed to get 2D rendering context");
      }
      await videoElement.play();
      return new _MediaStreamProvider(
        stream,
        videoElement,
        context,
        fps,
        width,
        height
      );
    }
    /**
     * Retrieves the next frame from the stream.
     *
     * @returns Promise resolving to the next VideoFrame, or null when stream ends
     */
    async getNextFrame() {
      if (this.disposed || this.streamEnded || !this.stream.active) {
        return null;
      }
      const videoTrack = this.stream.getVideoTracks()[0];
      if (!videoTrack || videoTrack.readyState === "ended") {
        return null;
      }
      this.context.drawImage(this.videoElement, 0, 0);
      const imageData = this.context.getImageData(0, 0, this.width, this.height);
      const timestamp = this.currentFrameIndex * this.frameInterval;
      const frame = {
        data: imageData.data,
        width: this.width,
        height: this.height,
        timestamp,
        frameIndex: this.currentFrameIndex
      };
      this.currentFrameIndex++;
      return frame;
    }
    /**
     * Returns the target frame rate in frames per second.
     *
     * @returns Frame rate as a positive number
     */
    getFps() {
      return this.fps;
    }
    /**
     * Returns metadata about the video stream.
     *
     * @returns FrameMetadata with width, height (no duration for live streams)
     */
    getMetadata() {
      return {
        width: this.width,
        height: this.height
      };
    }
    /**
     * Returns the frame interval in milliseconds.
     * Used for frame rate limiting calculations.
     *
     * @returns Frame interval in milliseconds
     */
    getFrameInterval() {
      return this.frameInterval;
    }
    /**
     * Disposes of the provider and releases resources.
     * After calling dispose(), getNextFrame() will return null.
     */
    dispose() {
      this.disposed = true;
      this.videoElement.pause();
      this.videoElement.srcObject = null;
      const videoTrack = this.stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.removeEventListener("ended", this.handleStreamEnded);
      }
    }
  };
  async function createMediaStreamProvider(stream, options) {
    return MediaStreamProvider.create(stream, options);
  }

  // src/providers/video-element.ts
  var VideoLoadError = class extends Error {
    constructor(message) {
      super(`Failed to load video: ${message}`);
      this.name = "VideoLoadError";
    }
  };
  var VideoElementProvider = class _VideoElementProvider {
    constructor(video, canvas, ctx, fps) {
      __publicField(this, "video");
      __publicField(this, "canvas");
      __publicField(this, "ctx");
      __publicField(this, "currentFrame", 0);
      __publicField(this, "totalFrames");
      __publicField(this, "frameDuration");
      __publicField(this, "_fps");
      __publicField(this, "_metadata");
      this.video = video;
      this.canvas = canvas;
      this.ctx = ctx;
      this._fps = fps;
      this.frameDuration = 1 / fps;
      this.totalFrames = Math.floor(video.duration * fps);
      this._metadata = {
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration * 1e3
        // Convert to milliseconds
      };
      this.canvas.width = video.videoWidth;
      this.canvas.height = video.videoHeight;
    }
    /**
     * Creates a VideoElementProvider from a video source.
     *
     * @param source - A File object, Blob, or URL string pointing to the video
     * @param options - Optional configuration for frame extraction
     * @returns A promise that resolves to the initialized provider
     * @throws {VideoLoadError} If the video cannot be loaded
     */
    static async create(source, options = {}) {
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      const url = source instanceof Blob ? URL.createObjectURL(source) : source;
      return new Promise((resolve, reject) => {
        const cleanup = () => {
          video.removeEventListener("loadedmetadata", onLoaded);
          video.removeEventListener("error", onError);
        };
        const onLoaded = async () => {
          cleanup();
          if (video.readyState < 2) {
            await new Promise((res) => {
              video.addEventListener("canplay", () => res(), { once: true });
            });
          }
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) {
            reject(new VideoLoadError("Could not create canvas context"));
            return;
          }
          const fps = options.fps ?? 30;
          video.currentTime = 0;
          await new Promise((res) => {
            video.addEventListener("seeked", () => res(), { once: true });
          });
          resolve(new _VideoElementProvider(video, canvas, ctx, fps));
        };
        const onError = () => {
          var _a2;
          cleanup();
          reject(
            new VideoLoadError(((_a2 = video.error) == null ? void 0 : _a2.message) ?? "Unknown video error")
          );
        };
        video.addEventListener("loadedmetadata", onLoaded);
        video.addEventListener("error", onError);
        video.src = url;
        video.load();
      });
    }
    /**
     * Retrieves the next frame from the video.
     *
     * @returns The next frame, or null if all frames have been extracted
     */
    async getNextFrame() {
      if (this.currentFrame >= this.totalFrames) {
        return null;
      }
      const targetTime = this.currentFrame * this.frameDuration;
      if (Math.abs(this.video.currentTime - targetTime) > 1e-3) {
        this.video.currentTime = targetTime;
        await new Promise((resolve) => {
          this.video.addEventListener("seeked", () => resolve(), { once: true });
        });
      }
      this.ctx.drawImage(this.video, 0, 0);
      const imageData = this.ctx.getImageData(
        0,
        0,
        this.canvas.width,
        this.canvas.height
      );
      const frame = {
        data: imageData.data,
        width: this.canvas.width,
        height: this.canvas.height,
        timestamp: targetTime * 1e3,
        // Convert to milliseconds
        frameIndex: this.currentFrame,
        canvas: this.canvas
        // Include canvas for direct MediaPipe use
      };
      this.currentFrame++;
      return frame;
    }
    /**
     * Returns the frames per second of the video.
     */
    getFps() {
      return this._fps;
    }
    /**
     * Returns metadata about the video.
     */
    getMetadata() {
      return this._metadata;
    }
    /**
     * Returns the total number of frames in the video.
     */
    getTotalFrames() {
      return this.totalFrames;
    }
    /**
     * Resets the provider to the beginning of the video.
     */
    async reset() {
      this.currentFrame = 0;
      this.video.currentTime = 0;
      await new Promise((resolve) => {
        this.video.addEventListener("seeked", () => resolve(), { once: true });
      });
    }
    /**
     * Releases resources held by this provider.
     */
    dispose() {
      if (this.video.src.startsWith("blob:")) {
        URL.revokeObjectURL(this.video.src);
      }
      this.video.src = "";
      this.video.load();
    }
  };
  async function createVideoElementProvider(source, options) {
    return VideoElementProvider.create(source, options);
  }

  // src/profiles/types.ts
  var DEFAULT_FEEDBACK_MESSAGES = {
    tooLow: "Value is below the acceptable range",
    tooHigh: "Value is above the acceptable range",
    incorrect: "Value is not within acceptable options"
  };
  function createEmptyComparisonSummary() {
    return {
      passCount: 0,
      failCount: 0,
      warningCount: 0,
      priorityIssues: []
    };
  }
  function createEmptyProfileComparison(profileName) {
    return {
      profile: profileName,
      metrics: {},
      summary: createEmptyComparisonSummary()
    };
  }
  function isNumericTarget(target) {
    return typeof target.acceptable === "object" && !Array.isArray(target.acceptable) && "min" in target.acceptable && "max" in target.acceptable;
  }
  function isCategoricalTarget(target) {
    return Array.isArray(target.acceptable);
  }
  function getFeedbackMessage(target, status, isNumeric, isTooLow) {
    if (status === "pass") {
      return void 0;
    }
    if (isNumeric) {
      if (isTooLow) {
        return target.feedback.tooLow ?? DEFAULT_FEEDBACK_MESSAGES.tooLow;
      } else {
        return target.feedback.tooHigh ?? DEFAULT_FEEDBACK_MESSAGES.tooHigh;
      }
    } else {
      return target.feedback.incorrect ?? DEFAULT_FEEDBACK_MESSAGES.incorrect;
    }
  }

  // src/profiles/comparison.ts
  var DEFAULT_OPTIONS = {
    warningThreshold: 0.2,
    lowConfidenceThreshold: 0.5
  };
  var PRIORITY_ORDER = {
    high: 0,
    medium: 1,
    low: 2
  };
  var ProfileComparisonEngine = class {
    /**
     * Creates a new ProfileComparisonEngine with the specified options.
     *
     * @param options - Configuration options for the engine
     */
    constructor(options = {}) {
      __publicField(this, "options");
      this.options = {
        ...DEFAULT_OPTIONS,
        ...options
      };
    }
    /**
     * Compares a shot analysis against a form profile.
     *
     * Only metrics present in both the shot and the profile are compared.
     * Metrics in the shot but not in the profile are ignored.
     * Profile targets without corresponding shot metrics are skipped.
     *
     * @param shot - The shot analysis containing measured metrics
     * @param profile - The form profile with target specifications
     * @returns Complete comparison result with per-metric results and summary
     */
    compareToProfile(shot, profile) {
      const metrics = {};
      const issueDetails = [];
      for (const [metricName, target] of Object.entries(profile.targets)) {
        const metricValue = shot.metrics[metricName];
        if (!metricValue) {
          continue;
        }
        const result = this.compareMetric(metricValue, target);
        metrics[metricName] = result;
        if (result.status !== "pass" && result.feedback) {
          issueDetails.push({
            metricName,
            priority: target.priority,
            feedback: result.feedback,
            status: result.status
          });
        }
      }
      const summary = this.generateSummary(metrics, issueDetails);
      return {
        profile: profile.name,
        metrics,
        summary
      };
    }
    /**
     * Compares a single metric value against its target.
     *
     * @param metricValue - The measured metric value
     * @param target - The target specification to compare against
     * @returns Comparison result with status, deviation, and feedback
     */
    compareMetric(metricValue, target) {
      const value = metricValue.value;
      const isLowConfidence = metricValue.confidence < this.options.lowConfidenceThreshold;
      if (isNumericTarget(target) && typeof value === "number") {
        return this.compareNumericMetric(
          value,
          target,
          metricValue.confidence,
          isLowConfidence
        );
      } else if (isCategoricalTarget(target) && typeof value === "string") {
        return this.compareCategoricalMetric(value, target, isLowConfidence);
      }
      return {
        value,
        target,
        status: "fail",
        feedback: "Metric type mismatch"
      };
    }
    /**
     * Compares a numeric metric value against its numeric range target.
     */
    compareNumericMetric(value, target, _confidence, isLowConfidence) {
      const { min, max } = target.acceptable;
      const ideal = target.ideal;
      const deviation = value - ideal;
      const isInRange = value >= min && value <= max;
      const range2 = max - min;
      const warningZone = range2 * this.options.warningThreshold;
      const innerMin = min + warningZone;
      const innerMax = max - warningZone;
      let status;
      let isTooLow = false;
      if (!isInRange) {
        status = "fail";
        isTooLow = value < min;
      } else if (range2 > 0 && value !== min && value !== max && (value < innerMin || value > innerMax)) {
        status = "warning";
        isTooLow = value < innerMin;
      } else {
        status = "pass";
      }
      if (isLowConfidence && status === "pass") {
        status = "warning";
      } else if (isLowConfidence && status === "fail") {
        status = "warning";
      }
      const feedback = status !== "pass" ? getFeedbackMessage(target, status, true, isTooLow) : void 0;
      if (status !== "pass" && feedback !== void 0) {
        return {
          value,
          target,
          status,
          deviation,
          feedback
        };
      }
      if (status !== "pass") {
        return {
          value,
          target,
          status,
          deviation
        };
      }
      return {
        value,
        target,
        status
      };
    }
    /**
     * Compares a categorical metric value against its list of acceptable values.
     */
    compareCategoricalMetric(value, target, isLowConfidence) {
      const acceptable = target.acceptable;
      const isInAcceptable = acceptable.includes(value);
      let status;
      if (!isInAcceptable) {
        status = "fail";
      } else {
        status = "pass";
      }
      if (isLowConfidence && status === "pass") {
        status = "warning";
      } else if (isLowConfidence && status === "fail") {
        status = "warning";
      }
      const feedback = status !== "pass" ? getFeedbackMessage(target, status, false) : void 0;
      if (feedback !== void 0) {
        return {
          value,
          target,
          status,
          feedback
        };
      }
      return {
        value,
        target,
        status
      };
    }
    /**
     * Generates the comparison summary from the metric results.
     */
    generateSummary(metrics, issueDetails) {
      let passCount = 0;
      let failCount = 0;
      let warningCount = 0;
      for (const result of Object.values(metrics)) {
        switch (result.status) {
          case "pass":
            passCount++;
            break;
          case "fail":
            failCount++;
            break;
          case "warning":
            warningCount++;
            break;
        }
      }
      const sortedIssues = [...issueDetails].sort(
        (a2, b2) => PRIORITY_ORDER[a2.priority] - PRIORITY_ORDER[b2.priority]
      );
      const priorityIssues = sortedIssues.map(
        (issue) => `${issue.metricName}: ${issue.feedback}`
      );
      return {
        passCount,
        failCount,
        warningCount,
        priorityIssues
      };
    }
  };

  // node_modules/@mediapipe/tasks-vision/vision_bundle.mjs
  var t = "undefined" != typeof self ? self : {};
  function e(e2, n2) {
    t: {
      for (var r2 = ["CLOSURE_FLAGS"], i2 = t, s2 = 0; s2 < r2.length; s2++) if (null == (i2 = i2[r2[s2]])) {
        r2 = null;
        break t;
      }
      r2 = i2;
    }
    return null != (e2 = r2 && r2[e2]) ? e2 : n2;
  }
  function n() {
    throw Error("Invalid UTF8");
  }
  function r(t2, e2) {
    return e2 = String.fromCharCode.apply(null, e2), null == t2 ? e2 : t2 + e2;
  }
  var i;
  var s;
  var o = "undefined" != typeof TextDecoder;
  var a;
  var c = "undefined" != typeof TextEncoder;
  function h(t2) {
    if (c) t2 = (a || (a = new TextEncoder())).encode(t2);
    else {
      let n2 = 0;
      const r2 = new Uint8Array(3 * t2.length);
      for (let i2 = 0; i2 < t2.length; i2++) {
        var e2 = t2.charCodeAt(i2);
        if (e2 < 128) r2[n2++] = e2;
        else {
          if (e2 < 2048) r2[n2++] = e2 >> 6 | 192;
          else {
            if (e2 >= 55296 && e2 <= 57343) {
              if (e2 <= 56319 && i2 < t2.length) {
                const s2 = t2.charCodeAt(++i2);
                if (s2 >= 56320 && s2 <= 57343) {
                  e2 = 1024 * (e2 - 55296) + s2 - 56320 + 65536, r2[n2++] = e2 >> 18 | 240, r2[n2++] = e2 >> 12 & 63 | 128, r2[n2++] = e2 >> 6 & 63 | 128, r2[n2++] = 63 & e2 | 128;
                  continue;
                }
                i2--;
              }
              e2 = 65533;
            }
            r2[n2++] = e2 >> 12 | 224, r2[n2++] = e2 >> 6 & 63 | 128;
          }
          r2[n2++] = 63 & e2 | 128;
        }
      }
      t2 = n2 === r2.length ? r2 : r2.subarray(0, n2);
    }
    return t2;
  }
  function u(e2) {
    t.setTimeout(() => {
      throw e2;
    }, 0);
  }
  var l;
  var f = e(610401301, false);
  var d = e(748402147, true);
  var p = e(824648567, true);
  var g = e(824656860, e(1, true));
  function m() {
    var e2 = t.navigator;
    return e2 && (e2 = e2.userAgent) ? e2 : "";
  }
  var y = t.navigator;
  function _(t2) {
    return _[" "](t2), t2;
  }
  l = y && y.userAgentData || null, _[" "] = function() {
  };
  var v = {};
  var E = null;
  function w(t2) {
    const e2 = t2.length;
    let n2 = 3 * e2 / 4;
    n2 % 3 ? n2 = Math.floor(n2) : -1 != "=.".indexOf(t2[e2 - 1]) && (n2 = -1 != "=.".indexOf(t2[e2 - 2]) ? n2 - 2 : n2 - 1);
    const r2 = new Uint8Array(n2);
    let i2 = 0;
    return function(t3, e3) {
      function n3(e4) {
        for (; r3 < t3.length; ) {
          const e5 = t3.charAt(r3++), n4 = E[e5];
          if (null != n4) return n4;
          if (!/^[\s\xa0]*$/.test(e5)) throw Error("Unknown base64 encoding at char: " + e5);
        }
        return e4;
      }
      T();
      let r3 = 0;
      for (; ; ) {
        const t4 = n3(-1), r4 = n3(0), i3 = n3(64), s2 = n3(64);
        if (64 === s2 && -1 === t4) break;
        e3(t4 << 2 | r4 >> 4), 64 != i3 && (e3(r4 << 4 & 240 | i3 >> 2), 64 != s2 && e3(i3 << 6 & 192 | s2));
      }
    }(t2, function(t3) {
      r2[i2++] = t3;
    }), i2 !== n2 ? r2.subarray(0, i2) : r2;
  }
  function T() {
    if (!E) {
      E = {};
      var t2 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split(""), e2 = ["+/=", "+/", "-_=", "-_.", "-_"];
      for (let n2 = 0; n2 < 5; n2++) {
        const r2 = t2.concat(e2[n2].split(""));
        v[n2] = r2;
        for (let t3 = 0; t3 < r2.length; t3++) {
          const e3 = r2[t3];
          void 0 === E[e3] && (E[e3] = t3);
        }
      }
    }
  }
  var A = "undefined" != typeof Uint8Array;
  var b = !(!(f && l && l.brands.length > 0) && (-1 != m().indexOf("Trident") || -1 != m().indexOf("MSIE"))) && "function" == typeof btoa;
  var k = /[-_.]/g;
  var S = { "-": "+", _: "/", ".": "=" };
  function x(t2) {
    return S[t2] || "";
  }
  function L(t2) {
    if (!b) return w(t2);
    t2 = k.test(t2) ? t2.replace(k, x) : t2, t2 = atob(t2);
    const e2 = new Uint8Array(t2.length);
    for (let n2 = 0; n2 < t2.length; n2++) e2[n2] = t2.charCodeAt(n2);
    return e2;
  }
  function R(t2) {
    return A && null != t2 && t2 instanceof Uint8Array;
  }
  var I = {};
  function F() {
    return C || (C = new P(null, I));
  }
  function M(t2) {
    N(I);
    var e2 = t2.g;
    return null == (e2 = null == e2 || R(e2) ? e2 : "string" == typeof e2 ? L(e2) : null) ? e2 : t2.g = e2;
  }
  var P = class {
    h() {
      return new Uint8Array(M(this) || 0);
    }
    constructor(t2, e2) {
      if (N(e2), this.g = t2, null != t2 && 0 === t2.length) throw Error("ByteString should be constructed with non-empty values");
    }
  };
  var C;
  var O;
  function N(t2) {
    if (t2 !== I) throw Error("illegal external caller");
  }
  function U(t2, e2) {
    t2.__closure__error__context__984382 || (t2.__closure__error__context__984382 = {}), t2.__closure__error__context__984382.severity = e2;
  }
  function D(t2) {
    return U(t2 = Error(t2), "warning"), t2;
  }
  function B(t2, e2) {
    if (null != t2) {
      var n2 = O ?? (O = {}), r2 = n2[t2] || 0;
      r2 >= e2 || (n2[t2] = r2 + 1, U(t2 = Error(), "incident"), u(t2));
    }
  }
  function G() {
    return "function" == typeof BigInt;
  }
  var j = "function" == typeof Symbol && "symbol" == typeof Symbol();
  function V(t2, e2, n2 = false) {
    return "function" == typeof Symbol && "symbol" == typeof Symbol() ? n2 && Symbol.for && t2 ? Symbol.for(t2) : null != t2 ? Symbol(t2) : Symbol() : e2;
  }
  var X = V("jas", void 0, true);
  var H = V(void 0, "0di");
  var W = V(void 0, "1oa");
  var z = V(void 0, Symbol());
  var K = V(void 0, "0ub");
  var Y = V(void 0, "0ubs");
  var q = V(void 0, "0ubsb");
  var $ = V(void 0, "0actk");
  var J = V("m_m", "Pa", true);
  var Z = V();
  var Q = { Ga: { value: 0, configurable: true, writable: true, enumerable: false } };
  var tt = Object.defineProperties;
  var et = j ? X : "Ga";
  var nt;
  var rt = [];
  function it(t2, e2) {
    j || et in t2 || tt(t2, Q), t2[et] |= e2;
  }
  function st(t2, e2) {
    j || et in t2 || tt(t2, Q), t2[et] = e2;
  }
  function ot(t2) {
    return it(t2, 34), t2;
  }
  function at(t2) {
    return it(t2, 8192), t2;
  }
  st(rt, 7), nt = Object.freeze(rt);
  var ct = {};
  function ht(t2, e2) {
    return void 0 === e2 ? t2.h !== ut && !!(2 & (0 | t2.v[et])) : !!(2 & e2) && t2.h !== ut;
  }
  var ut = {};
  function lt(t2, e2) {
    if (null != t2) {
      if ("string" == typeof t2) t2 = t2 ? new P(t2, I) : F();
      else if (t2.constructor !== P) if (R(t2)) t2 = t2.length ? new P(new Uint8Array(t2), I) : F();
      else {
        if (!e2) throw Error();
        t2 = void 0;
      }
    }
    return t2;
  }
  var ft = class {
    constructor(t2, e2, n2) {
      this.g = t2, this.h = e2, this.l = n2;
    }
    next() {
      const t2 = this.g.next();
      return t2.done || (t2.value = this.h.call(this.l, t2.value)), t2;
    }
    [Symbol.iterator]() {
      return this;
    }
  };
  var dt = Object.freeze({});
  function pt(t2, e2, n2) {
    const r2 = 128 & e2 ? 0 : -1, i2 = t2.length;
    var s2;
    (s2 = !!i2) && (s2 = null != (s2 = t2[i2 - 1]) && "object" == typeof s2 && s2.constructor === Object);
    const o2 = i2 + (s2 ? -1 : 0);
    for (e2 = 128 & e2 ? 1 : 0; e2 < o2; e2++) n2(e2 - r2, t2[e2]);
    if (s2) {
      t2 = t2[i2 - 1];
      for (const e3 in t2) !isNaN(e3) && n2(+e3, t2[e3]);
    }
  }
  var gt = {};
  function mt(t2) {
    return 128 & t2 ? gt : void 0;
  }
  function yt(t2) {
    return t2.Na = true, t2;
  }
  var _t = yt((t2) => "number" == typeof t2);
  var vt = yt((t2) => "string" == typeof t2);
  var Et = yt((t2) => "boolean" == typeof t2);
  var wt = "function" == typeof t.BigInt && "bigint" == typeof t.BigInt(0);
  function Tt(t2) {
    var e2 = t2;
    if (vt(e2)) {
      if (!/^\s*(?:-?[1-9]\d*|0)?\s*$/.test(e2)) throw Error(String(e2));
    } else if (_t(e2) && !Number.isSafeInteger(e2)) throw Error(String(e2));
    return wt ? BigInt(t2) : t2 = Et(t2) ? t2 ? "1" : "0" : vt(t2) ? t2.trim() || "0" : String(t2);
  }
  var At = yt((t2) => wt ? t2 >= kt && t2 <= xt : "-" === t2[0] ? Lt(t2, bt) : Lt(t2, St));
  var bt = Number.MIN_SAFE_INTEGER.toString();
  var kt = wt ? BigInt(Number.MIN_SAFE_INTEGER) : void 0;
  var St = Number.MAX_SAFE_INTEGER.toString();
  var xt = wt ? BigInt(Number.MAX_SAFE_INTEGER) : void 0;
  function Lt(t2, e2) {
    if (t2.length > e2.length) return false;
    if (t2.length < e2.length || t2 === e2) return true;
    for (let n2 = 0; n2 < t2.length; n2++) {
      const r2 = t2[n2], i2 = e2[n2];
      if (r2 > i2) return false;
      if (r2 < i2) return true;
    }
  }
  var Rt = "function" == typeof Uint8Array.prototype.slice;
  var It;
  var Ft = 0;
  var Mt = 0;
  function Pt(t2) {
    const e2 = t2 >>> 0;
    Ft = e2, Mt = (t2 - e2) / 4294967296 >>> 0;
  }
  function Ct(t2) {
    if (t2 < 0) {
      Pt(-t2);
      const [e2, n2] = Ht(Ft, Mt);
      Ft = e2 >>> 0, Mt = n2 >>> 0;
    } else Pt(t2);
  }
  function Ot(t2) {
    const e2 = It || (It = new DataView(new ArrayBuffer(8)));
    e2.setFloat32(0, +t2, true), Mt = 0, Ft = e2.getUint32(0, true);
  }
  function Nt(t2, e2) {
    const n2 = 4294967296 * e2 + (t2 >>> 0);
    return Number.isSafeInteger(n2) ? n2 : Gt(t2, e2);
  }
  function Ut(t2, e2) {
    return Tt(G() ? BigInt.asUintN(64, (BigInt(e2 >>> 0) << BigInt(32)) + BigInt(t2 >>> 0)) : Gt(t2, e2));
  }
  function Dt(t2, e2) {
    const n2 = 2147483648 & e2;
    return n2 && (e2 = ~e2 >>> 0, 0 == (t2 = 1 + ~t2 >>> 0) && (e2 = e2 + 1 >>> 0)), "number" == typeof (t2 = Nt(t2, e2)) ? n2 ? -t2 : t2 : n2 ? "-" + t2 : t2;
  }
  function Bt(t2, e2) {
    return G() ? Tt(BigInt.asIntN(64, (BigInt.asUintN(32, BigInt(e2)) << BigInt(32)) + BigInt.asUintN(32, BigInt(t2)))) : Tt(Vt(t2, e2));
  }
  function Gt(t2, e2) {
    if (t2 >>>= 0, (e2 >>>= 0) <= 2097151) var n2 = "" + (4294967296 * e2 + t2);
    else G() ? n2 = "" + (BigInt(e2) << BigInt(32) | BigInt(t2)) : (t2 = (16777215 & t2) + 6777216 * (n2 = 16777215 & (t2 >>> 24 | e2 << 8)) + 6710656 * (e2 = e2 >> 16 & 65535), n2 += 8147497 * e2, e2 *= 2, t2 >= 1e7 && (n2 += t2 / 1e7 >>> 0, t2 %= 1e7), n2 >= 1e7 && (e2 += n2 / 1e7 >>> 0, n2 %= 1e7), n2 = e2 + jt(n2) + jt(t2));
    return n2;
  }
  function jt(t2) {
    return t2 = String(t2), "0000000".slice(t2.length) + t2;
  }
  function Vt(t2, e2) {
    if (2147483648 & e2) if (G()) t2 = "" + (BigInt(0 | e2) << BigInt(32) | BigInt(t2 >>> 0));
    else {
      const [n2, r2] = Ht(t2, e2);
      t2 = "-" + Gt(n2, r2);
    }
    else t2 = Gt(t2, e2);
    return t2;
  }
  function Xt(t2) {
    if (t2.length < 16) Ct(Number(t2));
    else if (G()) t2 = BigInt(t2), Ft = Number(t2 & BigInt(4294967295)) >>> 0, Mt = Number(t2 >> BigInt(32) & BigInt(4294967295));
    else {
      const e2 = +("-" === t2[0]);
      Mt = Ft = 0;
      const n2 = t2.length;
      for (let r2 = e2, i2 = (n2 - e2) % 6 + e2; i2 <= n2; r2 = i2, i2 += 6) {
        const e3 = Number(t2.slice(r2, i2));
        Mt *= 1e6, Ft = 1e6 * Ft + e3, Ft >= 4294967296 && (Mt += Math.trunc(Ft / 4294967296), Mt >>>= 0, Ft >>>= 0);
      }
      if (e2) {
        const [t3, e3] = Ht(Ft, Mt);
        Ft = t3, Mt = e3;
      }
    }
  }
  function Ht(t2, e2) {
    return e2 = ~e2, t2 ? t2 = 1 + ~t2 : e2 += 1, [t2, e2];
  }
  function Wt(t2) {
    return Array.prototype.slice.call(t2);
  }
  var zt = "function" == typeof BigInt ? BigInt.asIntN : void 0;
  var Kt = "function" == typeof BigInt ? BigInt.asUintN : void 0;
  var Yt = Number.isSafeInteger;
  var qt = Number.isFinite;
  var $t = Math.trunc;
  var Jt = Tt(0);
  function Zt(t2) {
    if (null != t2 && "number" != typeof t2) throw Error(`Value of float/double field must be a number, found ${typeof t2}: ${t2}`);
    return t2;
  }
  function Qt(t2) {
    return null == t2 || "number" == typeof t2 ? t2 : "NaN" === t2 || "Infinity" === t2 || "-Infinity" === t2 ? Number(t2) : void 0;
  }
  function te(t2) {
    if (null != t2 && "boolean" != typeof t2) {
      var e2 = typeof t2;
      throw Error(`Expected boolean but got ${"object" != e2 ? e2 : t2 ? Array.isArray(t2) ? "array" : e2 : "null"}: ${t2}`);
    }
    return t2;
  }
  function ee(t2) {
    return null == t2 || "boolean" == typeof t2 ? t2 : "number" == typeof t2 ? !!t2 : void 0;
  }
  var ne = /^-?([1-9][0-9]*|0)(\.[0-9]+)?$/;
  function re(t2) {
    switch (typeof t2) {
      case "bigint":
        return true;
      case "number":
        return qt(t2);
      case "string":
        return ne.test(t2);
      default:
        return false;
    }
  }
  function ie(t2) {
    if (null == t2) return t2;
    if ("string" == typeof t2 && t2) t2 = +t2;
    else if ("number" != typeof t2) return;
    return qt(t2) ? 0 | t2 : void 0;
  }
  function se(t2) {
    if (null == t2) return t2;
    if ("string" == typeof t2 && t2) t2 = +t2;
    else if ("number" != typeof t2) return;
    return qt(t2) ? t2 >>> 0 : void 0;
  }
  function oe(t2) {
    const e2 = t2.length;
    return ("-" === t2[0] ? e2 < 20 || 20 === e2 && t2 <= "-9223372036854775808" : e2 < 19 || 19 === e2 && t2 <= "9223372036854775807") ? t2 : (Xt(t2), Vt(Ft, Mt));
  }
  function ae(t2) {
    return t2 = $t(t2), Yt(t2) || (Ct(t2), t2 = Dt(Ft, Mt)), t2;
  }
  function ce(t2) {
    var e2 = $t(Number(t2));
    return Yt(e2) ? String(e2) : (-1 !== (e2 = t2.indexOf(".")) && (t2 = t2.substring(0, e2)), oe(t2));
  }
  function he(t2) {
    var e2 = $t(Number(t2));
    return Yt(e2) ? Tt(e2) : (-1 !== (e2 = t2.indexOf(".")) && (t2 = t2.substring(0, e2)), G() ? Tt(zt(64, BigInt(t2))) : Tt(oe(t2)));
  }
  function ue(t2) {
    return Yt(t2) ? t2 = Tt(ae(t2)) : (t2 = $t(t2), Yt(t2) ? t2 = String(t2) : (Ct(t2), t2 = Vt(Ft, Mt)), t2 = Tt(t2)), t2;
  }
  function le(t2) {
    return null == t2 ? t2 : "bigint" == typeof t2 ? (At(t2) ? t2 = Number(t2) : (t2 = zt(64, t2), t2 = At(t2) ? Number(t2) : String(t2)), t2) : re(t2) ? "number" == typeof t2 ? ae(t2) : ce(t2) : void 0;
  }
  function fe(t2) {
    const e2 = typeof t2;
    return null == t2 ? t2 : "bigint" === e2 ? Tt(zt(64, t2)) : re(t2) ? "string" === e2 ? he(t2) : ue(t2) : void 0;
  }
  function de(t2) {
    if ("string" != typeof t2) throw Error();
    return t2;
  }
  function pe(t2) {
    if (null != t2 && "string" != typeof t2) throw Error();
    return t2;
  }
  function ge(t2) {
    return null == t2 || "string" == typeof t2 ? t2 : void 0;
  }
  function me(t2, e2, n2, r2) {
    return null != t2 && t2[J] === ct ? t2 : Array.isArray(t2) ? ((r2 = (n2 = 0 | t2[et]) | 32 & r2 | 2 & r2) !== n2 && st(t2, r2), new e2(t2)) : (n2 ? 2 & r2 ? ((t2 = e2[H]) || (ot((t2 = new e2()).v), t2 = e2[H] = t2), e2 = t2) : e2 = new e2() : e2 = void 0, e2);
  }
  function ye(t2, e2, n2) {
    if (e2) t: {
      if (!re(e2 = t2)) throw D("int64");
      switch (typeof e2) {
        case "string":
          e2 = he(e2);
          break t;
        case "bigint":
          e2 = Tt(zt(64, e2));
          break t;
        default:
          e2 = ue(e2);
      }
    }
    else e2 = fe(t2);
    return null == (t2 = e2) ? n2 ? Jt : void 0 : t2;
  }
  var _e = {};
  var ve = function() {
    try {
      return _(new class extends Map {
        constructor() {
          super();
        }
      }()), false;
    } catch {
      return true;
    }
  }();
  var Ee = class {
    constructor() {
      this.g = /* @__PURE__ */ new Map();
    }
    get(t2) {
      return this.g.get(t2);
    }
    set(t2, e2) {
      return this.g.set(t2, e2), this.size = this.g.size, this;
    }
    delete(t2) {
      return t2 = this.g.delete(t2), this.size = this.g.size, t2;
    }
    clear() {
      this.g.clear(), this.size = this.g.size;
    }
    has(t2) {
      return this.g.has(t2);
    }
    entries() {
      return this.g.entries();
    }
    keys() {
      return this.g.keys();
    }
    values() {
      return this.g.values();
    }
    forEach(t2, e2) {
      return this.g.forEach(t2, e2);
    }
    [Symbol.iterator]() {
      return this.entries();
    }
  };
  var we = ve ? (Object.setPrototypeOf(Ee.prototype, Map.prototype), Object.defineProperties(Ee.prototype, { size: { value: 0, configurable: true, enumerable: true, writable: true } }), Ee) : class extends Map {
    constructor() {
      super();
    }
  };
  function Te(t2) {
    return t2;
  }
  function Ae(t2) {
    if (2 & t2.J) throw Error("Cannot mutate an immutable Map");
  }
  var be = class extends we {
    constructor(t2, e2, n2 = Te, r2 = Te) {
      super(), this.J = 0 | t2[et], this.K = e2, this.S = n2, this.fa = this.K ? ke : r2;
      for (let i2 = 0; i2 < t2.length; i2++) {
        const s2 = t2[i2], o2 = n2(s2[0], false, true);
        let a2 = s2[1];
        e2 ? void 0 === a2 && (a2 = null) : a2 = r2(s2[1], false, true, void 0, void 0, this.J), super.set(o2, a2);
      }
    }
    V(t2) {
      return at(Array.from(super.entries(), t2));
    }
    clear() {
      Ae(this), super.clear();
    }
    delete(t2) {
      return Ae(this), super.delete(this.S(t2, true, false));
    }
    entries() {
      if (this.K) {
        var t2 = super.keys();
        t2 = new ft(t2, Se, this);
      } else t2 = super.entries();
      return t2;
    }
    values() {
      if (this.K) {
        var t2 = super.keys();
        t2 = new ft(t2, be.prototype.get, this);
      } else t2 = super.values();
      return t2;
    }
    forEach(t2, e2) {
      this.K ? super.forEach((n2, r2, i2) => {
        t2.call(e2, i2.get(r2), r2, i2);
      }) : super.forEach(t2, e2);
    }
    set(t2, e2) {
      return Ae(this), null == (t2 = this.S(t2, true, false)) ? this : null == e2 ? (super.delete(t2), this) : super.set(t2, this.fa(e2, true, true, this.K, false, this.J));
    }
    Ma(t2) {
      const e2 = this.S(t2[0], false, true);
      t2 = t2[1], t2 = this.K ? void 0 === t2 ? null : t2 : this.fa(t2, false, true, void 0, false, this.J), super.set(e2, t2);
    }
    has(t2) {
      return super.has(this.S(t2, false, false));
    }
    get(t2) {
      t2 = this.S(t2, false, false);
      const e2 = super.get(t2);
      if (void 0 !== e2) {
        var n2 = this.K;
        return n2 ? ((n2 = this.fa(e2, false, true, n2, this.ra, this.J)) !== e2 && super.set(t2, n2), n2) : e2;
      }
    }
    [Symbol.iterator]() {
      return this.entries();
    }
  };
  function ke(t2, e2, n2, r2, i2, s2) {
    return t2 = me(t2, r2, n2, s2), i2 && (t2 = Ke(t2)), t2;
  }
  function Se(t2) {
    return [t2, this.get(t2)];
  }
  var xe;
  function Le() {
    return xe || (xe = new be(ot([]), void 0, void 0, void 0, _e));
  }
  function Re(t2) {
    return z ? t2[z] : void 0;
  }
  function Ie(t2, e2) {
    for (const n2 in t2) !isNaN(n2) && e2(t2, +n2, t2[n2]);
  }
  be.prototype.toJSON = void 0;
  var Fe = class {
  };
  var Me = { Ka: true };
  function Pe(t2, e2) {
    e2 < 100 || B(Y, 1);
  }
  function Ce(t2, e2, n2, r2) {
    const i2 = void 0 !== r2;
    r2 = !!r2;
    var s2, o2 = z;
    !i2 && j && o2 && (s2 = t2[o2]) && Ie(s2, Pe), o2 = [];
    var a2 = t2.length;
    let c2;
    s2 = 4294967295;
    let h2 = false;
    const u2 = !!(64 & e2), l2 = u2 ? 128 & e2 ? 0 : -1 : void 0;
    1 & e2 || (c2 = a2 && t2[a2 - 1], null != c2 && "object" == typeof c2 && c2.constructor === Object ? s2 = --a2 : c2 = void 0, !u2 || 128 & e2 || i2 || (h2 = true, s2 = s2 - l2 + l2)), e2 = void 0;
    for (var f2 = 0; f2 < a2; f2++) {
      let i3 = t2[f2];
      if (null != i3 && null != (i3 = n2(i3, r2))) if (u2 && f2 >= s2) {
        const t3 = f2 - l2;
        (e2 ?? (e2 = {}))[t3] = i3;
      } else o2[f2] = i3;
    }
    if (c2) for (let t3 in c2) {
      if (null == (a2 = c2[t3]) || null == (a2 = n2(a2, r2))) continue;
      let i3;
      f2 = +t3, u2 && !Number.isNaN(f2) && (i3 = f2 + l2) < s2 ? o2[i3] = a2 : (e2 ?? (e2 = {}))[t3] = a2;
    }
    return e2 && (h2 ? o2.push(e2) : o2[s2] = e2), i2 && z && (t2 = Re(t2)) && t2 instanceof Fe && (o2[z] = function(t3) {
      const e3 = new Fe();
      return Ie(t3, (t4, n3, r3) => {
        e3[n3] = Wt(r3);
      }), e3.da = t3.da, e3;
    }(t2)), o2;
  }
  function Oe(t2) {
    return t2[0] = Ne(t2[0]), t2[1] = Ne(t2[1]), t2;
  }
  function Ne(t2) {
    switch (typeof t2) {
      case "number":
        return Number.isFinite(t2) ? t2 : "" + t2;
      case "bigint":
        return At(t2) ? Number(t2) : "" + t2;
      case "boolean":
        return t2 ? 1 : 0;
      case "object":
        if (Array.isArray(t2)) {
          var e2 = 0 | t2[et];
          return 0 === t2.length && 1 & e2 ? void 0 : Ce(t2, e2, Ne);
        }
        if (null != t2 && t2[J] === ct) return Ue(t2);
        if (t2 instanceof P) {
          if (null == (e2 = t2.g)) t2 = "";
          else if ("string" == typeof e2) t2 = e2;
          else {
            if (b) {
              for (var n2 = "", r2 = 0, i2 = e2.length - 10240; r2 < i2; ) n2 += String.fromCharCode.apply(null, e2.subarray(r2, r2 += 10240));
              n2 += String.fromCharCode.apply(null, r2 ? e2.subarray(r2) : e2), e2 = btoa(n2);
            } else {
              void 0 === n2 && (n2 = 0), T(), n2 = v[n2], r2 = Array(Math.floor(e2.length / 3)), i2 = n2[64] || "";
              let t3 = 0, h2 = 0;
              for (; t3 < e2.length - 2; t3 += 3) {
                var s2 = e2[t3], o2 = e2[t3 + 1], a2 = e2[t3 + 2], c2 = n2[s2 >> 2];
                s2 = n2[(3 & s2) << 4 | o2 >> 4], o2 = n2[(15 & o2) << 2 | a2 >> 6], a2 = n2[63 & a2], r2[h2++] = c2 + s2 + o2 + a2;
              }
              switch (c2 = 0, a2 = i2, e2.length - t3) {
                case 2:
                  a2 = n2[(15 & (c2 = e2[t3 + 1])) << 2] || i2;
                case 1:
                  e2 = e2[t3], r2[h2] = n2[e2 >> 2] + n2[(3 & e2) << 4 | c2 >> 4] + a2 + i2;
              }
              e2 = r2.join("");
            }
            t2 = t2.g = e2;
          }
          return t2;
        }
        return t2 instanceof be ? t2 = 0 !== t2.size ? t2.V(Oe) : void 0 : void 0;
    }
    return t2;
  }
  function Ue(t2) {
    return Ce(t2 = t2.v, 0 | t2[et], Ne);
  }
  var De;
  var Be;
  function Ge(t2, e2) {
    return je(t2, e2[0], e2[1]);
  }
  function je(t2, e2, n2, r2 = 0) {
    if (null == t2) {
      var i2 = 32;
      n2 ? (t2 = [n2], i2 |= 128) : t2 = [], e2 && (i2 = -16760833 & i2 | (1023 & e2) << 14);
    } else {
      if (!Array.isArray(t2)) throw Error("narr");
      if (i2 = 0 | t2[et], d && 1 & i2) throw Error("rfarr");
      if (2048 & i2 && !(2 & i2) && function() {
        if (d) throw Error("carr");
        B($, 5);
      }(), 256 & i2) throw Error("farr");
      if (64 & i2) return (i2 | r2) !== i2 && st(t2, i2 | r2), t2;
      if (n2 && (i2 |= 128, n2 !== t2[0])) throw Error("mid");
      t: {
        i2 |= 64;
        var s2 = (n2 = t2).length;
        if (s2) {
          var o2 = s2 - 1;
          const t3 = n2[o2];
          if (null != t3 && "object" == typeof t3 && t3.constructor === Object) {
            if ((o2 -= e2 = 128 & i2 ? 0 : -1) >= 1024) throw Error("pvtlmt");
            for (var a2 in t3) (s2 = +a2) < o2 && (n2[s2 + e2] = t3[a2], delete t3[a2]);
            i2 = -16760833 & i2 | (1023 & o2) << 14;
            break t;
          }
        }
        if (e2) {
          if ((a2 = Math.max(e2, s2 - (128 & i2 ? 0 : -1))) > 1024) throw Error("spvt");
          i2 = -16760833 & i2 | (1023 & a2) << 14;
        }
      }
    }
    return st(t2, 64 | i2 | r2), t2;
  }
  function Ve(t2, e2) {
    if ("object" != typeof t2) return t2;
    if (Array.isArray(t2)) {
      var n2 = 0 | t2[et];
      return 0 === t2.length && 1 & n2 ? void 0 : Xe(t2, n2, e2);
    }
    if (null != t2 && t2[J] === ct) return We(t2);
    if (t2 instanceof be) {
      if (2 & (e2 = t2.J)) return t2;
      if (!t2.size) return;
      if (n2 = ot(t2.V()), t2.K) for (t2 = 0; t2 < n2.length; t2++) {
        const r2 = n2[t2];
        let i2 = r2[1];
        i2 = null == i2 || "object" != typeof i2 ? void 0 : null != i2 && i2[J] === ct ? We(i2) : Array.isArray(i2) ? Xe(i2, 0 | i2[et], !!(32 & e2)) : void 0, r2[1] = i2;
      }
      return n2;
    }
    return t2 instanceof P ? t2 : void 0;
  }
  function Xe(t2, e2, n2) {
    return 2 & e2 || (!n2 || 4096 & e2 || 16 & e2 ? t2 = ze(t2, e2, false, n2 && !(16 & e2)) : (it(t2, 34), 4 & e2 && Object.freeze(t2))), t2;
  }
  function He(t2, e2, n2) {
    return t2 = new t2.constructor(e2), n2 && (t2.h = ut), t2.m = ut, t2;
  }
  function We(t2) {
    const e2 = t2.v, n2 = 0 | e2[et];
    return ht(t2, n2) ? t2 : Je(t2, e2, n2) ? He(t2, e2) : ze(e2, n2);
  }
  function ze(t2, e2, n2, r2) {
    return r2 ?? (r2 = !!(34 & e2)), t2 = Ce(t2, e2, Ve, r2), r2 = 32, n2 && (r2 |= 2), st(t2, e2 = 16769217 & e2 | r2), t2;
  }
  function Ke(t2) {
    const e2 = t2.v, n2 = 0 | e2[et];
    return ht(t2, n2) ? Je(t2, e2, n2) ? He(t2, e2, true) : new t2.constructor(ze(e2, n2, false)) : t2;
  }
  function Ye(t2) {
    if (t2.h !== ut) return false;
    var e2 = t2.v;
    return it(e2 = ze(e2, 0 | e2[et]), 2048), t2.v = e2, t2.h = void 0, t2.m = void 0, true;
  }
  function qe(t2) {
    if (!Ye(t2) && ht(t2, 0 | t2.v[et])) throw Error();
  }
  function $e(t2, e2) {
    void 0 === e2 && (e2 = 0 | t2[et]), 32 & e2 && !(4096 & e2) && st(t2, 4096 | e2);
  }
  function Je(t2, e2, n2) {
    return !!(2 & n2) || !(!(32 & n2) || 4096 & n2) && (st(e2, 2 | n2), t2.h = ut, true);
  }
  var Ze = Tt(0);
  var Qe = {};
  function tn(t2, e2, n2, r2, i2) {
    if (null !== (e2 = en(t2.v, e2, n2, i2)) || r2 && t2.m !== ut) return e2;
  }
  function en(t2, e2, n2, r2) {
    if (-1 === e2) return null;
    const i2 = e2 + (n2 ? 0 : -1), s2 = t2.length - 1;
    let o2, a2;
    if (!(s2 < 1 + (n2 ? 0 : -1))) {
      if (i2 >= s2) if (o2 = t2[s2], null != o2 && "object" == typeof o2 && o2.constructor === Object) n2 = o2[e2], a2 = true;
      else {
        if (i2 !== s2) return;
        n2 = o2;
      }
      else n2 = t2[i2];
      if (r2 && null != n2) {
        if (null == (r2 = r2(n2))) return r2;
        if (!Object.is(r2, n2)) return a2 ? o2[e2] = r2 : t2[i2] = r2, r2;
      }
      return n2;
    }
  }
  function nn(t2, e2, n2, r2) {
    qe(t2), rn(t2 = t2.v, 0 | t2[et], e2, n2, r2);
  }
  function rn(t2, e2, n2, r2, i2) {
    const s2 = n2 + (i2 ? 0 : -1);
    var o2 = t2.length - 1;
    if (o2 >= 1 + (i2 ? 0 : -1) && s2 >= o2) {
      const i3 = t2[o2];
      if (null != i3 && "object" == typeof i3 && i3.constructor === Object) return i3[n2] = r2, e2;
    }
    return s2 <= o2 ? (t2[s2] = r2, e2) : (void 0 !== r2 && (n2 >= (o2 = (e2 ?? (e2 = 0 | t2[et])) >> 14 & 1023 || 536870912) ? null != r2 && (t2[o2 + (i2 ? 0 : -1)] = { [n2]: r2 }) : t2[s2] = r2), e2);
  }
  function sn() {
    return void 0 === dt ? 2 : 4;
  }
  function on(t2, e2, n2, r2, i2) {
    let s2 = t2.v, o2 = 0 | s2[et];
    r2 = ht(t2, o2) ? 1 : r2, i2 = !!i2 || 3 === r2, 2 === r2 && Ye(t2) && (s2 = t2.v, o2 = 0 | s2[et]);
    let a2 = (t2 = cn(s2, e2)) === nt ? 7 : 0 | t2[et], c2 = hn(a2, o2);
    var h2 = !(4 & c2);
    if (h2) {
      4 & c2 && (t2 = Wt(t2), a2 = 0, c2 = xn(c2, o2), o2 = rn(s2, o2, e2, t2));
      let r3 = 0, i3 = 0;
      for (; r3 < t2.length; r3++) {
        const e3 = n2(t2[r3]);
        null != e3 && (t2[i3++] = e3);
      }
      i3 < r3 && (t2.length = i3), n2 = -513 & (4 | c2), c2 = n2 &= -1025, c2 &= -4097;
    }
    return c2 !== a2 && (st(t2, c2), 2 & c2 && Object.freeze(t2)), an(t2, c2, s2, o2, e2, r2, h2, i2);
  }
  function an(t2, e2, n2, r2, i2, s2, o2, a2) {
    let c2 = e2;
    return 1 === s2 || 4 === s2 && (2 & e2 || !(16 & e2) && 32 & r2) ? un(e2) || ((e2 |= !t2.length || o2 && !(4096 & e2) || 32 & r2 && !(4096 & e2 || 16 & e2) ? 2 : 256) !== c2 && st(t2, e2), Object.freeze(t2)) : (2 === s2 && un(e2) && (t2 = Wt(t2), c2 = 0, e2 = xn(e2, r2), r2 = rn(n2, r2, i2, t2)), un(e2) || (a2 || (e2 |= 16), e2 !== c2 && st(t2, e2))), 2 & e2 || !(4096 & e2 || 16 & e2) || $e(n2, r2), t2;
  }
  function cn(t2, e2, n2) {
    return t2 = en(t2, e2, n2), Array.isArray(t2) ? t2 : nt;
  }
  function hn(t2, e2) {
    return 2 & e2 && (t2 |= 2), 1 | t2;
  }
  function un(t2) {
    return !!(2 & t2) && !!(4 & t2) || !!(256 & t2);
  }
  function ln(t2) {
    return lt(t2, true);
  }
  function fn(t2) {
    t2 = Wt(t2);
    for (let e2 = 0; e2 < t2.length; e2++) {
      const n2 = t2[e2] = Wt(t2[e2]);
      Array.isArray(n2[1]) && (n2[1] = ot(n2[1]));
    }
    return at(t2);
  }
  function dn(t2, e2, n2, r2) {
    qe(t2), rn(t2 = t2.v, 0 | t2[et], e2, ("0" === r2 ? 0 === Number(n2) : n2 === r2) ? void 0 : n2);
  }
  function pn(t2, e2, n2) {
    if (2 & e2) throw Error();
    const r2 = mt(e2);
    let i2 = cn(t2, n2, r2), s2 = i2 === nt ? 7 : 0 | i2[et], o2 = hn(s2, e2);
    return (2 & o2 || un(o2) || 16 & o2) && (o2 === s2 || un(o2) || st(i2, o2), i2 = Wt(i2), s2 = 0, o2 = xn(o2, e2), rn(t2, e2, n2, i2, r2)), o2 &= -13, o2 !== s2 && st(i2, o2), i2;
  }
  function gn(t2, e2) {
    var n2 = Ds;
    return _n(mn(t2 = t2.v), t2, void 0, n2) === e2 ? e2 : -1;
  }
  function mn(t2) {
    if (j) return t2[W] ?? (t2[W] = /* @__PURE__ */ new Map());
    if (W in t2) return t2[W];
    const e2 = /* @__PURE__ */ new Map();
    return Object.defineProperty(t2, W, { value: e2 }), e2;
  }
  function yn(t2, e2, n2, r2, i2) {
    const s2 = mn(t2), o2 = _n(s2, t2, e2, n2, i2);
    return o2 !== r2 && (o2 && (e2 = rn(t2, e2, o2, void 0, i2)), s2.set(n2, r2)), e2;
  }
  function _n(t2, e2, n2, r2, i2) {
    let s2 = t2.get(r2);
    if (null != s2) return s2;
    s2 = 0;
    for (let t3 = 0; t3 < r2.length; t3++) {
      const o2 = r2[t3];
      null != en(e2, o2, i2) && (0 !== s2 && (n2 = rn(e2, n2, s2, void 0, i2)), s2 = o2);
    }
    return t2.set(r2, s2), s2;
  }
  function vn(t2, e2, n2) {
    let r2 = 0 | t2[et];
    const i2 = mt(r2), s2 = en(t2, n2, i2);
    let o2;
    if (null != s2 && s2[J] === ct) {
      if (!ht(s2)) return Ye(s2), s2.v;
      o2 = s2.v;
    } else Array.isArray(s2) && (o2 = s2);
    if (o2) {
      const t3 = 0 | o2[et];
      2 & t3 && (o2 = ze(o2, t3));
    }
    return o2 = Ge(o2, e2), o2 !== s2 && rn(t2, r2, n2, o2, i2), o2;
  }
  function En(t2, e2, n2, r2, i2) {
    let s2 = false;
    if (null != (r2 = en(t2, r2, i2, (t3) => {
      const r3 = me(t3, n2, false, e2);
      return s2 = r3 !== t3 && null != r3, r3;
    }))) return s2 && !ht(r2) && $e(t2, e2), r2;
  }
  function wn(t2, e2, n2, r2) {
    let i2 = t2.v, s2 = 0 | i2[et];
    if (null == (e2 = En(i2, s2, e2, n2, r2))) return e2;
    if (s2 = 0 | i2[et], !ht(t2, s2)) {
      const o2 = Ke(e2);
      o2 !== e2 && (Ye(t2) && (i2 = t2.v, s2 = 0 | i2[et]), s2 = rn(i2, s2, n2, e2 = o2, r2), $e(i2, s2));
    }
    return e2;
  }
  function Tn(t2, e2, n2, r2, i2, s2, o2, a2) {
    var c2 = ht(t2, n2);
    s2 = c2 ? 1 : s2, o2 = !!o2 || 3 === s2, c2 = a2 && !c2, (2 === s2 || c2) && Ye(t2) && (n2 = 0 | (e2 = t2.v)[et]);
    var h2 = (t2 = cn(e2, i2)) === nt ? 7 : 0 | t2[et], u2 = hn(h2, n2);
    if (a2 = !(4 & u2)) {
      var l2 = t2, f2 = n2;
      const e3 = !!(2 & u2);
      e3 && (f2 |= 2);
      let i3 = !e3, s3 = true, o3 = 0, a3 = 0;
      for (; o3 < l2.length; o3++) {
        const t3 = me(l2[o3], r2, false, f2);
        if (t3 instanceof r2) {
          if (!e3) {
            const e4 = ht(t3);
            i3 && (i3 = !e4), s3 && (s3 = e4);
          }
          l2[a3++] = t3;
        }
      }
      a3 < o3 && (l2.length = a3), u2 |= 4, u2 = s3 ? -4097 & u2 : 4096 | u2, u2 = i3 ? 8 | u2 : -9 & u2;
    }
    if (u2 !== h2 && (st(t2, u2), 2 & u2 && Object.freeze(t2)), c2 && !(8 & u2 || !t2.length && (1 === s2 || 4 === s2 && (2 & u2 || !(16 & u2) && 32 & n2)))) {
      for (un(u2) && (t2 = Wt(t2), u2 = xn(u2, n2), n2 = rn(e2, n2, i2, t2)), r2 = t2, c2 = u2, h2 = 0; h2 < r2.length; h2++) (l2 = r2[h2]) !== (u2 = Ke(l2)) && (r2[h2] = u2);
      c2 |= 8, st(t2, u2 = c2 = r2.length ? 4096 | c2 : -4097 & c2);
    }
    return an(t2, u2, e2, n2, i2, s2, a2, o2);
  }
  function An(t2, e2, n2) {
    const r2 = t2.v;
    return Tn(t2, r2, 0 | r2[et], e2, n2, sn(), false, true);
  }
  function bn(t2) {
    return null == t2 && (t2 = void 0), t2;
  }
  function kn(t2, e2, n2, r2, i2) {
    return nn(t2, n2, r2 = bn(r2), i2), r2 && !ht(r2) && $e(t2.v), t2;
  }
  function Sn(t2, e2, n2, r2) {
    t: {
      var i2 = r2 = bn(r2);
      qe(t2);
      const s2 = t2.v;
      let o2 = 0 | s2[et];
      if (null == i2) {
        const t3 = mn(s2);
        if (_n(t3, s2, o2, n2) !== e2) break t;
        t3.set(n2, 0);
      } else o2 = yn(s2, o2, n2, e2);
      rn(s2, o2, e2, i2);
    }
    r2 && !ht(r2) && $e(t2.v);
  }
  function xn(t2, e2) {
    return -273 & (2 & e2 ? 2 | t2 : -3 & t2);
  }
  function Ln(t2, e2, n2, r2) {
    var i2 = r2;
    qe(t2), t2 = Tn(t2, r2 = t2.v, 0 | r2[et], n2, e2, 2, true), i2 = null != i2 ? i2 : new n2(), t2.push(i2), e2 = n2 = t2 === nt ? 7 : 0 | t2[et], (i2 = ht(i2)) ? (n2 &= -9, 1 === t2.length && (n2 &= -4097)) : n2 |= 4096, n2 !== e2 && st(t2, n2), i2 || $e(r2);
  }
  function Rn(t2, e2, n2) {
    return ie(tn(t2, e2, void 0, n2));
  }
  function In(t2) {
    return (g ? tn(t2, 2, void 0, void 0, fe) : fe(tn(t2, 2))) ?? Ze;
  }
  function Fn(t2, e2) {
    return tn(t2, e2, void 0, void 0, Qt) ?? 0;
  }
  function Mn(t2, e2, n2) {
    if (null != n2) {
      if ("number" != typeof n2) throw D("int32");
      if (!qt(n2)) throw D("int32");
      n2 |= 0;
    }
    nn(t2, e2, n2);
  }
  function Pn(t2, e2, n2) {
    nn(t2, e2, Zt(n2));
  }
  function Cn(t2, e2, n2) {
    dn(t2, e2, pe(n2), "");
  }
  function On(t2, e2, n2) {
    {
      qe(t2);
      const o2 = t2.v;
      let a2 = 0 | o2[et];
      if (null == n2) rn(o2, a2, e2);
      else {
        var r2 = t2 = n2 === nt ? 7 : 0 | n2[et], i2 = un(t2), s2 = i2 || Object.isFrozen(n2);
        for (i2 || (t2 = 0), s2 || (n2 = Wt(n2), r2 = 0, t2 = xn(t2, a2), s2 = false), t2 |= 5, t2 |= (4 & t2 ? 512 & t2 ? 512 : 1024 & t2 ? 1024 : 0 : void 0) ?? (g ? 1024 : 0), i2 = 0; i2 < n2.length; i2++) {
          const e3 = n2[i2], o3 = de(e3);
          Object.is(e3, o3) || (s2 && (n2 = Wt(n2), r2 = 0, t2 = xn(t2, a2), s2 = false), n2[i2] = o3);
        }
        t2 !== r2 && (s2 && (n2 = Wt(n2), t2 = xn(t2, a2)), st(n2, t2)), rn(o2, a2, e2, n2);
      }
    }
  }
  function Nn(t2, e2, n2) {
    qe(t2), on(t2, e2, ge, 2, true).push(de(n2));
  }
  var Un = class {
    constructor(t2, e2, n2) {
      if (this.buffer = t2, n2 && !e2) throw Error();
      this.g = e2;
    }
  };
  function Dn(t2, e2) {
    if ("string" == typeof t2) return new Un(L(t2), e2);
    if (Array.isArray(t2)) return new Un(new Uint8Array(t2), e2);
    if (t2.constructor === Uint8Array) return new Un(t2, false);
    if (t2.constructor === ArrayBuffer) return t2 = new Uint8Array(t2), new Un(t2, false);
    if (t2.constructor === P) return e2 = M(t2) || new Uint8Array(0), new Un(e2, true, t2);
    if (t2 instanceof Uint8Array) return t2 = t2.constructor === Uint8Array ? t2 : new Uint8Array(t2.buffer, t2.byteOffset, t2.byteLength), new Un(t2, false);
    throw Error();
  }
  function Bn(t2, e2) {
    let n2, r2 = 0, i2 = 0, s2 = 0;
    const o2 = t2.h;
    let a2 = t2.g;
    do {
      n2 = o2[a2++], r2 |= (127 & n2) << s2, s2 += 7;
    } while (s2 < 32 && 128 & n2);
    if (s2 > 32) for (i2 |= (127 & n2) >> 4, s2 = 3; s2 < 32 && 128 & n2; s2 += 7) n2 = o2[a2++], i2 |= (127 & n2) << s2;
    if (Wn(t2, a2), !(128 & n2)) return e2(r2 >>> 0, i2 >>> 0);
    throw Error();
  }
  function Gn(t2) {
    let e2 = 0, n2 = t2.g;
    const r2 = n2 + 10, i2 = t2.h;
    for (; n2 < r2; ) {
      const r3 = i2[n2++];
      if (e2 |= r3, 0 == (128 & r3)) return Wn(t2, n2), !!(127 & e2);
    }
    throw Error();
  }
  function jn(t2) {
    const e2 = t2.h;
    let n2 = t2.g, r2 = e2[n2++], i2 = 127 & r2;
    if (128 & r2 && (r2 = e2[n2++], i2 |= (127 & r2) << 7, 128 & r2 && (r2 = e2[n2++], i2 |= (127 & r2) << 14, 128 & r2 && (r2 = e2[n2++], i2 |= (127 & r2) << 21, 128 & r2 && (r2 = e2[n2++], i2 |= r2 << 28, 128 & r2 && 128 & e2[n2++] && 128 & e2[n2++] && 128 & e2[n2++] && 128 & e2[n2++] && 128 & e2[n2++]))))) throw Error();
    return Wn(t2, n2), i2;
  }
  function Vn(t2) {
    return jn(t2) >>> 0;
  }
  function Xn(t2) {
    var e2 = t2.h;
    const n2 = t2.g;
    var r2 = e2[n2], i2 = e2[n2 + 1];
    const s2 = e2[n2 + 2];
    return e2 = e2[n2 + 3], Wn(t2, t2.g + 4), t2 = 2 * ((i2 = (r2 << 0 | i2 << 8 | s2 << 16 | e2 << 24) >>> 0) >> 31) + 1, r2 = i2 >>> 23 & 255, i2 &= 8388607, 255 == r2 ? i2 ? NaN : t2 * (1 / 0) : 0 == r2 ? 1401298464324817e-60 * t2 * i2 : t2 * Math.pow(2, r2 - 150) * (i2 + 8388608);
  }
  function Hn(t2) {
    return jn(t2);
  }
  function Wn(t2, e2) {
    if (t2.g = e2, e2 > t2.l) throw Error();
  }
  function zn(t2, e2) {
    if (e2 < 0) throw Error();
    const n2 = t2.g;
    if ((e2 = n2 + e2) > t2.l) throw Error();
    return t2.g = e2, n2;
  }
  function Kn(t2, e2) {
    if (0 == e2) return F();
    var n2 = zn(t2, e2);
    return t2.Y && t2.j ? n2 = t2.h.subarray(n2, n2 + e2) : (t2 = t2.h, n2 = n2 === (e2 = n2 + e2) ? new Uint8Array(0) : Rt ? t2.slice(n2, e2) : new Uint8Array(t2.subarray(n2, e2))), 0 == n2.length ? F() : new P(n2, I);
  }
  var Yn = [];
  function qn(t2, e2, n2, r2) {
    if (ir.length) {
      const i2 = ir.pop();
      return i2.o(r2), i2.g.init(t2, e2, n2, r2), i2;
    }
    return new rr(t2, e2, n2, r2);
  }
  function $n(t2) {
    t2.g.clear(), t2.l = -1, t2.h = -1, ir.length < 100 && ir.push(t2);
  }
  function Jn(t2) {
    var e2 = t2.g;
    if (e2.g == e2.l) return false;
    t2.m = t2.g.g;
    var n2 = Vn(t2.g);
    if (e2 = n2 >>> 3, !((n2 &= 7) >= 0 && n2 <= 5)) throw Error();
    if (e2 < 1) throw Error();
    return t2.l = e2, t2.h = n2, true;
  }
  function Zn(t2) {
    switch (t2.h) {
      case 0:
        0 != t2.h ? Zn(t2) : Gn(t2.g);
        break;
      case 1:
        Wn(t2 = t2.g, t2.g + 8);
        break;
      case 2:
        if (2 != t2.h) Zn(t2);
        else {
          var e2 = Vn(t2.g);
          Wn(t2 = t2.g, t2.g + e2);
        }
        break;
      case 5:
        Wn(t2 = t2.g, t2.g + 4);
        break;
      case 3:
        for (e2 = t2.l; ; ) {
          if (!Jn(t2)) throw Error();
          if (4 == t2.h) {
            if (t2.l != e2) throw Error();
            break;
          }
          Zn(t2);
        }
        break;
      default:
        throw Error();
    }
  }
  function Qn(t2, e2, n2) {
    const r2 = t2.g.l;
    var i2 = Vn(t2.g);
    let s2 = (i2 = t2.g.g + i2) - r2;
    if (s2 <= 0 && (t2.g.l = i2, n2(e2, t2, void 0, void 0, void 0), s2 = i2 - t2.g.g), s2) throw Error();
    return t2.g.g = i2, t2.g.l = r2, e2;
  }
  function tr(t2) {
    var e2 = Vn(t2.g), a2 = zn(t2 = t2.g, e2);
    if (t2 = t2.h, o) {
      var c2, h2 = t2;
      (c2 = s) || (c2 = s = new TextDecoder("utf-8", { fatal: true })), e2 = a2 + e2, h2 = 0 === a2 && e2 === h2.length ? h2 : h2.subarray(a2, e2);
      try {
        var u2 = c2.decode(h2);
      } catch (t3) {
        if (void 0 === i) {
          try {
            c2.decode(new Uint8Array([128]));
          } catch (t4) {
          }
          try {
            c2.decode(new Uint8Array([97])), i = true;
          } catch (t4) {
            i = false;
          }
        }
        throw !i && (s = void 0), t3;
      }
    } else {
      e2 = (u2 = a2) + e2, a2 = [];
      let i2, s2 = null;
      for (; u2 < e2; ) {
        var l2 = t2[u2++];
        l2 < 128 ? a2.push(l2) : l2 < 224 ? u2 >= e2 ? n() : (i2 = t2[u2++], l2 < 194 || 128 != (192 & i2) ? (u2--, n()) : a2.push((31 & l2) << 6 | 63 & i2)) : l2 < 240 ? u2 >= e2 - 1 ? n() : (i2 = t2[u2++], 128 != (192 & i2) || 224 === l2 && i2 < 160 || 237 === l2 && i2 >= 160 || 128 != (192 & (c2 = t2[u2++])) ? (u2--, n()) : a2.push((15 & l2) << 12 | (63 & i2) << 6 | 63 & c2)) : l2 <= 244 ? u2 >= e2 - 2 ? n() : (i2 = t2[u2++], 128 != (192 & i2) || i2 - 144 + (l2 << 28) >> 30 != 0 || 128 != (192 & (c2 = t2[u2++])) || 128 != (192 & (h2 = t2[u2++])) ? (u2--, n()) : (l2 = (7 & l2) << 18 | (63 & i2) << 12 | (63 & c2) << 6 | 63 & h2, l2 -= 65536, a2.push(55296 + (l2 >> 10 & 1023), 56320 + (1023 & l2)))) : n(), a2.length >= 8192 && (s2 = r(s2, a2), a2.length = 0);
      }
      u2 = r(s2, a2);
    }
    return u2;
  }
  function er(t2) {
    const e2 = Vn(t2.g);
    return Kn(t2.g, e2);
  }
  function nr(t2, e2, n2) {
    var r2 = Vn(t2.g);
    for (r2 = t2.g.g + r2; t2.g.g < r2; ) n2.push(e2(t2.g));
  }
  var rr = class {
    constructor(t2, e2, n2, r2) {
      if (Yn.length) {
        const i2 = Yn.pop();
        i2.init(t2, e2, n2, r2), t2 = i2;
      } else t2 = new class {
        constructor(t3, e3, n3, r3) {
          this.h = null, this.j = false, this.g = this.l = this.m = 0, this.init(t3, e3, n3, r3);
        }
        init(t3, e3, n3, { Y: r3 = false, ea: i2 = false } = {}) {
          this.Y = r3, this.ea = i2, t3 && (t3 = Dn(t3, this.ea), this.h = t3.buffer, this.j = t3.g, this.m = e3 || 0, this.l = void 0 !== n3 ? this.m + n3 : this.h.length, this.g = this.m);
        }
        clear() {
          this.h = null, this.j = false, this.g = this.l = this.m = 0, this.Y = false;
        }
      }(t2, e2, n2, r2);
      this.g = t2, this.m = this.g.g, this.h = this.l = -1, this.o(r2);
    }
    o({ ha: t2 = false } = {}) {
      this.ha = t2;
    }
  };
  var ir = [];
  function sr(t2) {
    return t2 ? /^\d+$/.test(t2) ? (Xt(t2), new or(Ft, Mt)) : null : ar || (ar = new or(0, 0));
  }
  var or = class {
    constructor(t2, e2) {
      this.h = t2 >>> 0, this.g = e2 >>> 0;
    }
  };
  var ar;
  function cr(t2) {
    return t2 ? /^-?\d+$/.test(t2) ? (Xt(t2), new hr(Ft, Mt)) : null : ur || (ur = new hr(0, 0));
  }
  var hr = class {
    constructor(t2, e2) {
      this.h = t2 >>> 0, this.g = e2 >>> 0;
    }
  };
  var ur;
  function lr(t2, e2, n2) {
    for (; n2 > 0 || e2 > 127; ) t2.g.push(127 & e2 | 128), e2 = (e2 >>> 7 | n2 << 25) >>> 0, n2 >>>= 7;
    t2.g.push(e2);
  }
  function fr(t2, e2) {
    for (; e2 > 127; ) t2.g.push(127 & e2 | 128), e2 >>>= 7;
    t2.g.push(e2);
  }
  function dr(t2, e2) {
    if (e2 >= 0) fr(t2, e2);
    else {
      for (let n2 = 0; n2 < 9; n2++) t2.g.push(127 & e2 | 128), e2 >>= 7;
      t2.g.push(1);
    }
  }
  function pr(t2) {
    var e2 = Ft;
    t2.g.push(e2 >>> 0 & 255), t2.g.push(e2 >>> 8 & 255), t2.g.push(e2 >>> 16 & 255), t2.g.push(e2 >>> 24 & 255);
  }
  function gr(t2, e2) {
    0 !== e2.length && (t2.l.push(e2), t2.h += e2.length);
  }
  function mr(t2, e2, n2) {
    fr(t2.g, 8 * e2 + n2);
  }
  function yr(t2, e2) {
    return mr(t2, e2, 2), e2 = t2.g.end(), gr(t2, e2), e2.push(t2.h), e2;
  }
  function _r(t2, e2) {
    var n2 = e2.pop();
    for (n2 = t2.h + t2.g.length() - n2; n2 > 127; ) e2.push(127 & n2 | 128), n2 >>>= 7, t2.h++;
    e2.push(n2), t2.h++;
  }
  function vr(t2, e2, n2) {
    mr(t2, e2, 2), fr(t2.g, n2.length), gr(t2, t2.g.end()), gr(t2, n2);
  }
  function Er(t2, e2, n2, r2) {
    null != n2 && (e2 = yr(t2, e2), r2(n2, t2), _r(t2, e2));
  }
  function wr() {
    const t2 = class {
      constructor() {
        throw Error();
      }
    };
    return Object.setPrototypeOf(t2, t2.prototype), t2;
  }
  var Tr = wr();
  var Ar = wr();
  var br = wr();
  var kr = wr();
  var Sr = wr();
  var xr = wr();
  var Lr = wr();
  var Rr = wr();
  var Ir = wr();
  var Fr = wr();
  function Mr(t2, e2, n2) {
    var r2 = t2.v;
    z && z in r2 && (r2 = r2[z]) && delete r2[e2.g], e2.h ? e2.j(t2, e2.h, e2.g, n2, e2.l) : e2.j(t2, e2.g, n2, e2.l);
  }
  var Pr = class {
    constructor(t2, e2) {
      this.v = je(t2, e2, void 0, 2048);
    }
    toJSON() {
      return Ue(this);
    }
    j() {
      var _a2;
      var t2 = Fo, e2 = this.v, n2 = t2.g, r2 = z;
      if (j && r2 && null != ((_a2 = e2[r2]) == null ? void 0 : _a2[n2]) && B(K, 3), e2 = t2.g, Z && z && void 0 === Z && (r2 = (n2 = this.v)[z]) && (r2 = r2.da)) try {
        r2(n2, e2, Me);
      } catch (t3) {
        u(t3);
      }
      return t2.h ? t2.m(this, t2.h, t2.g, t2.l) : t2.m(this, t2.g, t2.defaultValue, t2.l);
    }
    clone() {
      const t2 = this.v, e2 = 0 | t2[et];
      return Je(this, t2, e2) ? He(this, t2, true) : new this.constructor(ze(t2, e2, false));
    }
  };
  Pr.prototype[J] = ct, Pr.prototype.toString = function() {
    return this.v.toString();
  };
  var Cr = class {
    constructor(t2, e2, n2) {
      this.g = t2, this.h = e2, t2 = Tr, this.l = !!t2 && n2 === t2 || false;
    }
  };
  function Or(t2, e2) {
    return new Cr(t2, e2, Tr);
  }
  function Nr(t2, e2, n2, r2, i2) {
    Er(t2, n2, Yr(e2, r2), i2);
  }
  var Ur = Or(function(t2, e2, n2, r2, i2) {
    return 2 === t2.h && (Qn(t2, vn(e2, r2, n2), i2), true);
  }, Nr);
  var Dr = Or(function(t2, e2, n2, r2, i2) {
    return 2 === t2.h && (Qn(t2, vn(e2, r2, n2), i2), true);
  }, Nr);
  var Br = Symbol();
  var Gr = Symbol();
  var jr = Symbol();
  var Vr = Symbol();
  var Xr = Symbol();
  var Hr;
  var Wr;
  function zr(t2, e2, n2, r2) {
    var i2 = r2[t2];
    if (i2) return i2;
    (i2 = {}).qa = r2, i2.T = function(t3) {
      switch (typeof t3) {
        case "boolean":
          return De || (De = [0, void 0, true]);
        case "number":
          return t3 > 0 ? void 0 : 0 === t3 ? Be || (Be = [0, void 0]) : [-t3, void 0];
        case "string":
          return [0, t3];
        case "object":
          return t3;
      }
    }(r2[0]);
    var s2 = r2[1];
    let o2 = 1;
    s2 && s2.constructor === Object && (i2.ba = s2, "function" == typeof (s2 = r2[++o2]) && (i2.ma = true, Hr ?? (Hr = s2), Wr ?? (Wr = r2[o2 + 1]), s2 = r2[o2 += 2]));
    const a2 = {};
    for (; s2 && Array.isArray(s2) && s2.length && "number" == typeof s2[0] && s2[0] > 0; ) {
      for (var c2 = 0; c2 < s2.length; c2++) a2[s2[c2]] = s2;
      s2 = r2[++o2];
    }
    for (c2 = 1; void 0 !== s2; ) {
      let t3;
      "number" == typeof s2 && (c2 += s2, s2 = r2[++o2]);
      var h2 = void 0;
      if (s2 instanceof Cr ? t3 = s2 : (t3 = Ur, o2--), t3 == null ? void 0 : t3.l) {
        s2 = r2[++o2], h2 = r2;
        var u2 = o2;
        "function" == typeof s2 && (s2 = s2(), h2[u2] = s2), h2 = s2;
      }
      for (u2 = c2 + 1, "number" == typeof (s2 = r2[++o2]) && s2 < 0 && (u2 -= s2, s2 = r2[++o2]); c2 < u2; c2++) {
        const r3 = a2[c2];
        h2 ? n2(i2, c2, t3, h2, r3) : e2(i2, c2, t3, r3);
      }
    }
    return r2[t2] = i2;
  }
  function Kr(t2) {
    return Array.isArray(t2) ? t2[0] instanceof Cr ? t2 : [Dr, t2] : [t2, void 0];
  }
  function Yr(t2, e2) {
    return t2 instanceof Pr ? t2.v : Array.isArray(t2) ? Ge(t2, e2) : void 0;
  }
  function qr(t2, e2, n2, r2) {
    const i2 = n2.g;
    t2[e2] = r2 ? (t3, e3, n3) => i2(t3, e3, n3, r2) : i2;
  }
  function $r(t2, e2, n2, r2, i2) {
    const s2 = n2.g;
    let o2, a2;
    t2[e2] = (t3, e3, n3) => s2(t3, e3, n3, a2 || (a2 = zr(Gr, qr, $r, r2).T), o2 || (o2 = Jr(r2)), i2);
  }
  function Jr(t2) {
    let e2 = t2[jr];
    if (null != e2) return e2;
    const n2 = zr(Gr, qr, $r, t2);
    return e2 = n2.ma ? (t3, e3) => Hr(t3, e3, n2) : (t3, e3) => {
      for (; Jn(e3) && 4 != e3.h; ) {
        var r2 = e3.l, i2 = n2[r2];
        if (null == i2) {
          var s2 = n2.ba;
          s2 && (s2 = s2[r2]) && (null != (s2 = Qr(s2)) && (i2 = n2[r2] = s2));
        }
        if (null == i2 || !i2(e3, t3, r2)) {
          if (i2 = (s2 = e3).m, Zn(s2), s2.ha) var o2 = void 0;
          else o2 = s2.g.g - i2, s2.g.g = i2, o2 = Kn(s2.g, o2);
          i2 = void 0, s2 = t3, o2 && ((i2 = s2[z] ?? (s2[z] = new Fe()))[r2] ?? (i2[r2] = [])).push(o2);
        }
      }
      return (t3 = Re(t3)) && (t3.da = n2.qa[Xr]), true;
    }, t2[jr] = e2, t2[Xr] = Zr.bind(t2), e2;
  }
  function Zr(t2, e2, n2, r2) {
    var i2 = this[Gr];
    const s2 = this[jr], o2 = Ge(void 0, i2.T), a2 = Re(t2);
    if (a2) {
      var c2 = false, h2 = i2.ba;
      if (h2) {
        if (i2 = (e3, n3, i3) => {
          if (0 !== i3.length) if (h2[n3]) for (const t3 of i3) {
            e3 = qn(t3);
            try {
              c2 = true, s2(o2, e3);
            } finally {
              $n(e3);
            }
          }
          else r2 == null ? void 0 : r2(t2, n3, i3);
        }, null == e2) Ie(a2, i2);
        else if (null != a2) {
          const t3 = a2[e2];
          t3 && i2(a2, e2, t3);
        }
        if (c2) {
          let r3 = 0 | t2[et];
          if (2 & r3 && 2048 & r3 && !(n2 == null ? void 0 : n2.Ka)) throw Error();
          const i3 = mt(r3), s3 = (e3, s4) => {
            if (null != en(t2, e3, i3)) {
              if (1 === (n2 == null ? void 0 : n2.Qa)) return;
              throw Error();
            }
            null != s4 && (r3 = rn(t2, r3, e3, s4, i3)), delete a2[e3];
          };
          null == e2 ? pt(o2, 0 | o2[et], (t3, e3) => {
            s3(t3, e3);
          }) : s3(e2, en(o2, e2, i3));
        }
      }
    }
  }
  function Qr(t2) {
    const e2 = (t2 = Kr(t2))[0].g;
    if (t2 = t2[1]) {
      const n2 = Jr(t2), r2 = zr(Gr, qr, $r, t2).T;
      return (t3, i2, s2) => e2(t3, i2, s2, r2, n2);
    }
    return e2;
  }
  function ti(t2, e2, n2) {
    t2[e2] = n2.h;
  }
  function ei(t2, e2, n2, r2) {
    let i2, s2;
    const o2 = n2.h;
    t2[e2] = (t3, e3, n3) => o2(t3, e3, n3, s2 || (s2 = zr(Br, ti, ei, r2).T), i2 || (i2 = ni(r2)));
  }
  function ni(t2) {
    let e2 = t2[Vr];
    if (!e2) {
      const n2 = zr(Br, ti, ei, t2);
      e2 = (t3, e3) => ri(t3, e3, n2), t2[Vr] = e2;
    }
    return e2;
  }
  function ri(t2, e2, n2) {
    pt(t2, 0 | t2[et], (t3, r2) => {
      if (null != r2) {
        var i2 = function(t4, e3) {
          var n3 = t4[e3];
          if (n3) return n3;
          if ((n3 = t4.ba) && (n3 = n3[e3])) {
            var r3 = (n3 = Kr(n3))[0].h;
            if (n3 = n3[1]) {
              const e4 = ni(n3), i3 = zr(Br, ti, ei, n3).T;
              n3 = t4.ma ? Wr(i3, e4) : (t5, n4, s2) => r3(t5, n4, s2, i3, e4);
            } else n3 = r3;
            return t4[e3] = n3;
          }
        }(n2, t3);
        i2 ? i2(e2, r2, t3) : t3 < 500 || B(q, 3);
      }
    }), (t2 = Re(t2)) && Ie(t2, (t3, n3, r2) => {
      for (gr(e2, e2.g.end()), t3 = 0; t3 < r2.length; t3++) gr(e2, M(r2[t3]) || new Uint8Array(0));
    });
  }
  var ii = Tt(0);
  function si(t2, e2) {
    if (Array.isArray(e2)) {
      var n2 = 0 | e2[et];
      if (4 & n2) return e2;
      for (var r2 = 0, i2 = 0; r2 < e2.length; r2++) {
        const n3 = t2(e2[r2]);
        null != n3 && (e2[i2++] = n3);
      }
      return i2 < r2 && (e2.length = i2), (t2 = -1537 & (5 | n2)) !== n2 && st(e2, t2), 2 & t2 && Object.freeze(e2), e2;
    }
  }
  function oi(t2, e2, n2) {
    return new Cr(t2, e2, n2);
  }
  function ai(t2, e2, n2) {
    return new Cr(t2, e2, n2);
  }
  function ci(t2, e2, n2) {
    rn(t2, 0 | t2[et], e2, n2, mt(0 | t2[et]));
  }
  var hi = Or(function(t2, e2, n2, r2, i2) {
    if (2 !== t2.h) return false;
    if (t2 = Wt(t2 = Qn(t2, Ge([void 0, void 0], r2), i2)), i2 = mt(r2 = 0 | e2[et]), 2 & r2) throw Error();
    let s2 = en(e2, n2, i2);
    if (s2 instanceof be) 0 != (2 & s2.J) ? (s2 = s2.V(), s2.push(t2), rn(e2, r2, n2, s2, i2)) : s2.Ma(t2);
    else if (Array.isArray(s2)) {
      var o2 = 0 | s2[et];
      8192 & o2 || st(s2, o2 |= 8192), 2 & o2 && (s2 = fn(s2), rn(e2, r2, n2, s2, i2)), s2.push(t2);
    } else rn(e2, r2, n2, at([t2]), i2);
    return true;
  }, function(t2, e2, n2, r2, i2) {
    if (e2 instanceof be) e2.forEach((e3, s2) => {
      Er(t2, n2, Ge([s2, e3], r2), i2);
    });
    else if (Array.isArray(e2)) {
      for (let s2 = 0; s2 < e2.length; s2++) {
        const o2 = e2[s2];
        Array.isArray(o2) && Er(t2, n2, Ge(o2, r2), i2);
      }
      at(e2);
    }
  });
  function ui(t2, e2, n2) {
    null != (e2 = Qt(e2)) && (mr(t2, n2, 5), t2 = t2.g, Ot(e2), pr(t2));
  }
  function li(t2, e2, n2) {
    if (e2 = function(t3) {
      if (null == t3) return t3;
      const e3 = typeof t3;
      if ("bigint" === e3) return String(zt(64, t3));
      if (re(t3)) {
        if ("string" === e3) return ce(t3);
        if ("number" === e3) return ae(t3);
      }
    }(e2), null != e2) {
      if ("string" == typeof e2) cr(e2);
      if (null != e2) switch (mr(t2, n2, 0), typeof e2) {
        case "number":
          t2 = t2.g, Ct(e2), lr(t2, Ft, Mt);
          break;
        case "bigint":
          n2 = BigInt.asUintN(64, e2), n2 = new hr(Number(n2 & BigInt(4294967295)), Number(n2 >> BigInt(32))), lr(t2.g, n2.h, n2.g);
          break;
        default:
          n2 = cr(e2), lr(t2.g, n2.h, n2.g);
      }
    }
  }
  function fi(t2, e2, n2) {
    null != (e2 = ie(e2)) && null != e2 && (mr(t2, n2, 0), dr(t2.g, e2));
  }
  function di(t2, e2, n2) {
    null != (e2 = ee(e2)) && (mr(t2, n2, 0), t2.g.g.push(e2 ? 1 : 0));
  }
  function pi(t2, e2, n2) {
    null != (e2 = ge(e2)) && vr(t2, n2, h(e2));
  }
  function gi(t2, e2, n2, r2, i2) {
    Er(t2, n2, Yr(e2, r2), i2);
  }
  function mi(t2, e2, n2) {
    null != (e2 = null == e2 || "string" == typeof e2 || e2 instanceof P ? e2 : void 0) && vr(t2, n2, Dn(e2, true).buffer);
  }
  function yi(t2, e2, n2) {
    return (5 === t2.h || 2 === t2.h) && (e2 = pn(e2, 0 | e2[et], n2), 2 == t2.h ? nr(t2, Xn, e2) : e2.push(Xn(t2.g)), true);
  }
  var _i = oi(function(t2, e2, n2) {
    return 5 === t2.h && (ci(e2, n2, Xn(t2.g)), true);
  }, ui, Rr);
  var vi = ai(yi, function(t2, e2, n2) {
    if (null != (e2 = si(Qt, e2))) for (let o2 = 0; o2 < e2.length; o2++) {
      var r2 = t2, i2 = n2, s2 = e2[o2];
      null != s2 && (mr(r2, i2, 5), r2 = r2.g, Ot(s2), pr(r2));
    }
  }, Rr);
  var Ei = ai(yi, function(t2, e2, n2) {
    if (null != (e2 = si(Qt, e2)) && e2.length) {
      mr(t2, n2, 2), fr(t2.g, 4 * e2.length);
      for (let r2 = 0; r2 < e2.length; r2++) n2 = t2.g, Ot(e2[r2]), pr(n2);
    }
  }, Rr);
  var wi = oi(function(t2, e2, n2) {
    return 5 === t2.h && (ci(e2, n2, 0 === (t2 = Xn(t2.g)) ? void 0 : t2), true);
  }, ui, Rr);
  var Ti = oi(function(t2, e2, n2) {
    return p ? (0 !== t2.h ? t2 = false : (ci(e2, n2, Bn(t2.g, Bt)), t2 = true), t2) : 0 === t2.h && (ci(e2, n2, Bn(t2.g, Dt)), true);
  }, li, xr);
  var Ai = oi(function(t2, e2, n2) {
    return p ? (0 !== t2.h ? e2 = false : (ci(e2, n2, (t2 = Bn(t2.g, Bt)) === ii ? void 0 : t2), e2 = true), e2) : 0 === t2.h && (ci(e2, n2, 0 === (t2 = Bn(t2.g, Dt)) ? void 0 : t2), true);
  }, li, xr);
  var bi = oi(function(t2, e2, n2) {
    return p ? (0 !== t2.h ? t2 = false : (ci(e2, n2, Bn(t2.g, Ut)), t2 = true), t2) : 0 === t2.h && (ci(e2, n2, Bn(t2.g, Nt)), true);
  }, function(t2, e2, n2) {
    if (e2 = function(t3) {
      if (null == t3) return t3;
      var e3 = typeof t3;
      if ("bigint" === e3) return String(Kt(64, t3));
      if (re(t3)) {
        if ("string" === e3) return e3 = $t(Number(t3)), Yt(e3) && e3 >= 0 ? t3 = String(e3) : (-1 !== (e3 = t3.indexOf(".")) && (t3 = t3.substring(0, e3)), (e3 = "-" !== t3[0] && ((e3 = t3.length) < 20 || 20 === e3 && t3 <= "18446744073709551615")) || (Xt(t3), t3 = Gt(Ft, Mt))), t3;
        if ("number" === e3) return (t3 = $t(t3)) >= 0 && Yt(t3) || (Ct(t3), t3 = Nt(Ft, Mt)), t3;
      }
    }(e2), null != e2) {
      if ("string" == typeof e2) sr(e2);
      if (null != e2) switch (mr(t2, n2, 0), typeof e2) {
        case "number":
          t2 = t2.g, Ct(e2), lr(t2, Ft, Mt);
          break;
        case "bigint":
          n2 = BigInt.asUintN(64, e2), n2 = new or(Number(n2 & BigInt(4294967295)), Number(n2 >> BigInt(32))), lr(t2.g, n2.h, n2.g);
          break;
        default:
          n2 = sr(e2), lr(t2.g, n2.h, n2.g);
      }
    }
  }, Lr);
  var ki = oi(function(t2, e2, n2) {
    return 0 === t2.h && (ci(e2, n2, jn(t2.g)), true);
  }, fi, kr);
  var Si = ai(function(t2, e2, n2) {
    return (0 === t2.h || 2 === t2.h) && (e2 = pn(e2, 0 | e2[et], n2), 2 == t2.h ? nr(t2, jn, e2) : e2.push(jn(t2.g)), true);
  }, function(t2, e2, n2) {
    if (null != (e2 = si(ie, e2)) && e2.length) {
      n2 = yr(t2, n2);
      for (let n3 = 0; n3 < e2.length; n3++) dr(t2.g, e2[n3]);
      _r(t2, n2);
    }
  }, kr);
  var xi = oi(function(t2, e2, n2) {
    return 0 === t2.h && (ci(e2, n2, 0 === (t2 = jn(t2.g)) ? void 0 : t2), true);
  }, fi, kr);
  var Li = oi(function(t2, e2, n2) {
    return 0 === t2.h && (ci(e2, n2, Gn(t2.g)), true);
  }, di, Ar);
  var Ri = oi(function(t2, e2, n2) {
    return 0 === t2.h && (ci(e2, n2, false === (t2 = Gn(t2.g)) ? void 0 : t2), true);
  }, di, Ar);
  var Ii = ai(function(t2, e2, n2) {
    return 2 === t2.h && (t2 = tr(t2), pn(e2, 0 | e2[et], n2).push(t2), true);
  }, function(t2, e2, n2) {
    if (null != (e2 = si(ge, e2))) for (let o2 = 0; o2 < e2.length; o2++) {
      var r2 = t2, i2 = n2, s2 = e2[o2];
      null != s2 && vr(r2, i2, h(s2));
    }
  }, br);
  var Fi = oi(function(t2, e2, n2) {
    return 2 === t2.h && (ci(e2, n2, "" === (t2 = tr(t2)) ? void 0 : t2), true);
  }, pi, br);
  var Mi = oi(function(t2, e2, n2) {
    return 2 === t2.h && (ci(e2, n2, tr(t2)), true);
  }, pi, br);
  var Pi = function(t2, e2, n2 = Tr) {
    return new Cr(t2, e2, n2);
  }(function(t2, e2, n2, r2, i2) {
    return 2 === t2.h && (r2 = Ge(void 0, r2), pn(e2, 0 | e2[et], n2).push(r2), Qn(t2, r2, i2), true);
  }, function(t2, e2, n2, r2, i2) {
    if (Array.isArray(e2)) {
      for (let s2 = 0; s2 < e2.length; s2++) gi(t2, e2[s2], n2, r2, i2);
      1 & (t2 = 0 | e2[et]) || st(e2, 1 | t2);
    }
  });
  var Ci = Or(function(t2, e2, n2, r2, i2, s2) {
    if (2 !== t2.h) return false;
    let o2 = 0 | e2[et];
    return yn(e2, o2, s2, n2, mt(o2)), Qn(t2, e2 = vn(e2, r2, n2), i2), true;
  }, gi);
  var Oi = oi(function(t2, e2, n2) {
    return 2 === t2.h && (ci(e2, n2, er(t2)), true);
  }, mi, Ir);
  var Ni = ai(function(t2, e2, n2) {
    return (0 === t2.h || 2 === t2.h) && (e2 = pn(e2, 0 | e2[et], n2), 2 == t2.h ? nr(t2, Vn, e2) : e2.push(Vn(t2.g)), true);
  }, function(t2, e2, n2) {
    if (null != (e2 = si(se, e2))) for (let o2 = 0; o2 < e2.length; o2++) {
      var r2 = t2, i2 = n2, s2 = e2[o2];
      null != s2 && (mr(r2, i2, 0), fr(r2.g, s2));
    }
  }, Sr);
  var Ui = oi(function(t2, e2, n2) {
    return 0 === t2.h && (ci(e2, n2, 0 === (t2 = Vn(t2.g)) ? void 0 : t2), true);
  }, function(t2, e2, n2) {
    null != (e2 = se(e2)) && null != e2 && (mr(t2, n2, 0), fr(t2.g, e2));
  }, Sr);
  var Di = oi(function(t2, e2, n2) {
    return 0 === t2.h && (ci(e2, n2, jn(t2.g)), true);
  }, function(t2, e2, n2) {
    null != (e2 = ie(e2)) && (e2 = parseInt(e2, 10), mr(t2, n2, 0), dr(t2.g, e2));
  }, Fr);
  var Bi = class {
    constructor(t2, e2) {
      var n2 = rs;
      this.g = t2, this.h = e2, this.m = wn, this.j = kn, this.defaultValue = void 0, this.l = null != n2.Oa ? gt : void 0;
    }
    register() {
      _(this);
    }
  };
  function Gi(t2, e2) {
    return new Bi(t2, e2);
  }
  function ji(t2, e2) {
    return (n2, r2) => {
      {
        const s2 = { ea: true };
        r2 && Object.assign(s2, r2), n2 = qn(n2, void 0, void 0, s2);
        try {
          const r3 = new t2(), s3 = r3.v;
          Jr(e2)(s3, n2);
          var i2 = r3;
        } finally {
          $n(n2);
        }
      }
      return i2;
    };
  }
  function Vi(t2) {
    return function() {
      const e2 = new class {
        constructor() {
          this.l = [], this.h = 0, this.g = new class {
            constructor() {
              this.g = [];
            }
            length() {
              return this.g.length;
            }
            end() {
              const t3 = this.g;
              return this.g = [], t3;
            }
          }();
        }
      }();
      ri(this.v, e2, zr(Br, ti, ei, t2)), gr(e2, e2.g.end());
      const n2 = new Uint8Array(e2.h), r2 = e2.l, i2 = r2.length;
      let s2 = 0;
      for (let t3 = 0; t3 < i2; t3++) {
        const e3 = r2[t3];
        n2.set(e3, s2), s2 += e3.length;
      }
      return e2.l = [n2], n2;
    };
  }
  var Xi = class extends Pr {
    constructor(t2) {
      super(t2);
    }
  };
  var Hi = [0, Fi, oi(function(t2, e2, n2) {
    return 2 === t2.h && (ci(e2, n2, (t2 = er(t2)) === F() ? void 0 : t2), true);
  }, function(t2, e2, n2) {
    if (null != e2) {
      if (e2 instanceof Pr) {
        const r2 = e2.Ra;
        return void (r2 ? (e2 = r2(e2), null != e2 && vr(t2, n2, Dn(e2, true).buffer)) : B(q, 3));
      }
      if (Array.isArray(e2)) return void B(q, 3);
    }
    mi(t2, e2, n2);
  }, Ir)];
  var Wi;
  var zi = globalThis.trustedTypes;
  function Ki(t2) {
    var e2;
    return void 0 === Wi && (Wi = function() {
      let t3 = null;
      if (!zi) return t3;
      try {
        const e3 = (t4) => t4;
        t3 = zi.createPolicy("goog#html", { createHTML: e3, createScript: e3, createScriptURL: e3 });
      } catch (t4) {
      }
      return t3;
    }()), t2 = (e2 = Wi) ? e2.createScriptURL(t2) : t2, new class {
      constructor(t3) {
        this.g = t3;
      }
      toString() {
        return this.g + "";
      }
    }(t2);
  }
  function Yi(t2, ...e2) {
    if (0 === e2.length) return Ki(t2[0]);
    let n2 = t2[0];
    for (let r2 = 0; r2 < e2.length; r2++) n2 += encodeURIComponent(e2[r2]) + t2[r2 + 1];
    return Ki(n2);
  }
  var qi = [0, ki, Di, Li, -1, Si, Di, -1, Li];
  var $i = class extends Pr {
    constructor(t2) {
      super(t2);
    }
  };
  var Ji = [0, Li, Mi, Li, Di, -1, ai(function(t2, e2, n2) {
    return (0 === t2.h || 2 === t2.h) && (e2 = pn(e2, 0 | e2[et], n2), 2 == t2.h ? nr(t2, Hn, e2) : e2.push(jn(t2.g)), true);
  }, function(t2, e2, n2) {
    if (null != (e2 = si(ie, e2)) && e2.length) {
      n2 = yr(t2, n2);
      for (let n3 = 0; n3 < e2.length; n3++) dr(t2.g, e2[n3]);
      _r(t2, n2);
    }
  }, Fr), Mi, -1, [0, Li, -1], Di, Li, -1];
  var Zi = [0, 3, Li, -1, 2, [0, ki], [0, Di, Li], [0, Mi, -1], [0]];
  var Qi = [0, Mi, -2];
  var ts = class extends Pr {
    constructor(t2) {
      super(t2);
    }
  };
  var es = [0];
  var ns = [0, ki, Li, 1, Li, -4];
  var rs = class extends Pr {
    constructor(t2) {
      super(t2, 2);
    }
  };
  var is = {};
  is[336783863] = [0, Mi, Li, -1, ki, [0, [1, 2, 3, 4, 5, 6, 7, 8, 9], Ci, es, Ci, Ji, Ci, Qi, Ci, ns, Ci, qi, Ci, [0, Mi, -2], Ci, [0, Mi, Di], Ci, Zi, Ci, [0, Di, -1, Li]], [0, Mi], Li, [0, [1, 3], [2, 4], Ci, [0, Si], -1, Ci, [0, Ii], -1, Pi, [0, Mi, -1]], Mi];
  var ss = [0, Ai, -1, Ri, -3, Ai, Si, Fi, xi, Ai, -1, Ri, xi, Ri, -2, Fi];
  function os(t2, e2) {
    Nn(t2, 3, e2);
  }
  function as(t2, e2) {
    Nn(t2, 4, e2);
  }
  var cs = class extends Pr {
    constructor(t2) {
      super(t2, 500);
    }
    o(t2) {
      return kn(this, 0, 7, t2);
    }
  };
  var hs = [-1, {}];
  var us = [0, Mi, 1, hs];
  var ls = [0, Mi, Ii, hs];
  function fs(t2, e2) {
    Ln(t2, 1, cs, e2);
  }
  function ds(t2, e2) {
    Nn(t2, 10, e2);
  }
  function ps(t2, e2) {
    Nn(t2, 15, e2);
  }
  var gs = class extends Pr {
    constructor(t2) {
      super(t2, 500);
    }
    o(t2) {
      return kn(this, 0, 1001, t2);
    }
  };
  var ms = [-500, Pi, [-500, Fi, -1, Ii, -3, [-2, is, Li], Pi, Hi, xi, -1, us, ls, Pi, [0, Fi, Ri], Fi, ss, xi, Ii, 987, Ii], 4, Pi, [-500, Mi, -1, [-1, {}], 998, Mi], Pi, [-500, Mi, Ii, -1, [-2, {}, Li], 997, Ii, -1], xi, Pi, [-500, Mi, Ii, hs, 998, Ii], Ii, xi, us, ls, Pi, [0, Fi, -1, hs], Ii, -2, ss, Fi, -1, Ri, [0, Ri, Ui], 978, hs, Pi, Hi];
  gs.prototype.g = Vi(ms);
  var ys = ji(gs, ms);
  var _s = class extends Pr {
    constructor(t2) {
      super(t2);
    }
  };
  var vs = class extends Pr {
    constructor(t2) {
      super(t2);
    }
    g() {
      return An(this, _s, 1);
    }
  };
  var Es = [0, Pi, [0, ki, _i, Mi, -1]];
  var ws = ji(vs, Es);
  var Ts = class extends Pr {
    constructor(t2) {
      super(t2);
    }
  };
  var As = class extends Pr {
    constructor(t2) {
      super(t2);
    }
  };
  var bs = class extends Pr {
    constructor(t2) {
      super(t2);
    }
    l() {
      return wn(this, Ts, 2);
    }
    g() {
      return An(this, As, 5);
    }
  };
  var ks = ji(class extends Pr {
    constructor(t2) {
      super(t2);
    }
  }, [0, Ii, Si, Ei, [0, Di, [0, ki, -3], [0, _i, -3], [0, ki, -1, [0, Pi, [0, ki, -2]]], Pi, [0, _i, -1, Mi, _i]], Mi, -1, Ti, Pi, [0, ki, _i], Ii, Ti]);
  var Ss = class extends Pr {
    constructor(t2) {
      super(t2);
    }
  };
  var xs = ji(class extends Pr {
    constructor(t2) {
      super(t2);
    }
  }, [0, Pi, [0, _i, -4]]);
  var Ls = class extends Pr {
    constructor(t2) {
      super(t2);
    }
  };
  var Rs = ji(class extends Pr {
    constructor(t2) {
      super(t2);
    }
  }, [0, Pi, [0, _i, -4]]);
  var Is = class extends Pr {
    constructor(t2) {
      super(t2);
    }
  };
  var Fs = [0, ki, -1, Ei, Di];
  var Ms = class extends Pr {
    constructor(t2) {
      super(t2);
    }
  };
  Ms.prototype.g = Vi([0, _i, -4, Ti]);
  var Ps = class extends Pr {
    constructor(t2) {
      super(t2);
    }
  };
  var Cs = ji(class extends Pr {
    constructor(t2) {
      super(t2);
    }
  }, [0, Pi, [0, 1, ki, Mi, Es], Ti]);
  var Os = class extends Pr {
    constructor(t2) {
      super(t2);
    }
  };
  var Ns = class extends Pr {
    constructor(t2) {
      super(t2);
    }
    na() {
      const t2 = tn(this, 1, void 0, void 0, ln);
      return null == t2 ? F() : t2;
    }
  };
  var Us = class extends Pr {
    constructor(t2) {
      super(t2);
    }
  };
  var Ds = [1, 2];
  var Bs = ji(class extends Pr {
    constructor(t2) {
      super(t2);
    }
  }, [0, Pi, [0, Ds, Ci, [0, Ei], Ci, [0, Oi], ki, Mi], Ti]);
  var Gs = class extends Pr {
    constructor(t2) {
      super(t2);
    }
  };
  var js = [0, Mi, ki, _i, Ii, -1];
  var Vs = class extends Pr {
    constructor(t2) {
      super(t2);
    }
  };
  var Xs = [0, Li, -1];
  var Hs = class extends Pr {
    constructor(t2) {
      super(t2);
    }
  };
  var Ws = [1, 2, 3, 4, 5, 6];
  var zs = class extends Pr {
    constructor(t2) {
      super(t2);
    }
    g() {
      return null != tn(this, 1, void 0, void 0, ln);
    }
    l() {
      return null != ge(tn(this, 2));
    }
  };
  var Ks = class extends Pr {
    constructor(t2) {
      super(t2);
    }
    g() {
      return ee(tn(this, 2)) ?? false;
    }
  };
  var Ys = [0, Oi, Mi, [0, ki, Ti, -1], [0, bi, Ti]];
  var qs = [0, Ys, Li, [0, Ws, Ci, ns, Ci, Ji, Ci, qi, Ci, es, Ci, Qi, Ci, Zi], Di];
  var $s = class extends Pr {
    constructor(t2) {
      super(t2);
    }
  };
  var Js = [0, qs, _i, -1, ki];
  var Zs = Gi(502141897, $s);
  is[502141897] = Js;
  var Qs = ji(class extends Pr {
    constructor(t2) {
      super(t2);
    }
  }, [0, [0, Di, -1, vi, Ni], Fs]);
  var to = class extends Pr {
    constructor(t2) {
      super(t2);
    }
  };
  var eo = class extends Pr {
    constructor(t2) {
      super(t2);
    }
  };
  var no = [0, qs, _i, [0, qs], Li];
  var ro = Gi(508968150, eo);
  is[508968150] = [0, qs, Js, no, _i, [0, [0, Ys]]], is[508968149] = no;
  var io = class extends Pr {
    constructor(t2) {
      super(t2);
    }
    l() {
      return wn(this, Gs, 2);
    }
    g() {
      nn(this, 2);
    }
  };
  var so = [0, qs, js];
  is[478825465] = so;
  var oo = class extends Pr {
    constructor(t2) {
      super(t2);
    }
  };
  var ao = class extends Pr {
    constructor(t2) {
      super(t2);
    }
  };
  var co = class extends Pr {
    constructor(t2) {
      super(t2);
    }
  };
  var ho = class extends Pr {
    constructor(t2) {
      super(t2);
    }
  };
  var uo = class extends Pr {
    constructor(t2) {
      super(t2);
    }
  };
  var lo = [0, qs, [0, qs], so, -1];
  var fo = [0, qs, _i, ki];
  var po = [0, qs, _i];
  var go = [0, qs, fo, po, _i];
  var mo = Gi(479097054, uo);
  is[479097054] = [0, qs, go, lo], is[463370452] = lo, is[464864288] = fo;
  var yo = Gi(462713202, ho);
  is[462713202] = go, is[474472470] = po;
  var _o = class extends Pr {
    constructor(t2) {
      super(t2);
    }
  };
  var vo = class extends Pr {
    constructor(t2) {
      super(t2);
    }
  };
  var Eo = class extends Pr {
    constructor(t2) {
      super(t2);
    }
  };
  var wo = class extends Pr {
    constructor(t2) {
      super(t2);
    }
  };
  var To = [0, qs, _i, -1, ki];
  var Ao = [0, qs, _i, Li];
  wo.prototype.g = Vi([0, qs, po, [0, qs], Js, no, To, Ao]);
  var bo = class extends Pr {
    constructor(t2) {
      super(t2);
    }
  };
  var ko = Gi(456383383, bo);
  is[456383383] = [0, qs, js];
  var So = class extends Pr {
    constructor(t2) {
      super(t2);
    }
  };
  var xo = Gi(476348187, So);
  is[476348187] = [0, qs, Xs];
  var Lo = class extends Pr {
    constructor(t2) {
      super(t2);
    }
  };
  var Ro = class extends Pr {
    constructor(t2) {
      super(t2);
    }
  };
  var Io = [0, Di, -1];
  var Fo = Gi(458105876, class extends Pr {
    constructor(t2) {
      super(t2);
    }
    g() {
      let t2;
      var e2 = this.v;
      const n2 = 0 | e2[et];
      return t2 = ht(this, n2), e2 = function(t3, e3, n3, r2) {
        var i2 = Ro;
        !r2 && Ye(t3) && (n3 = 0 | (e3 = t3.v)[et]);
        var s2 = en(e3, 2);
        if (t3 = false, null == s2) {
          if (r2) return Le();
          s2 = [];
        } else if (s2.constructor === be) {
          if (!(2 & s2.J) || r2) return s2;
          s2 = s2.V();
        } else Array.isArray(s2) ? t3 = !!(2 & (0 | s2[et])) : s2 = [];
        if (r2) {
          if (!s2.length) return Le();
          t3 || (t3 = true, ot(s2));
        } else t3 && (t3 = false, at(s2), s2 = fn(s2));
        return !t3 && 32 & n3 && it(s2, 32), n3 = rn(e3, n3, 2, r2 = new be(s2, i2, ye, void 0)), t3 || $e(e3, n3), r2;
      }(this, e2, n2, t2), !t2 && Ro && (e2.ra = true), e2;
    }
  });
  is[458105876] = [0, Io, hi, [true, Ti, [0, Mi, -1, Ii]], [0, Si, Li, Di]];
  var Mo = class extends Pr {
    constructor(t2) {
      super(t2);
    }
  };
  var Po = Gi(458105758, Mo);
  is[458105758] = [0, qs, Mi, Io];
  var Co = class extends Pr {
    constructor(t2) {
      super(t2);
    }
  };
  var Oo = [0, wi, -1, Ri];
  var No = class extends Pr {
    constructor(t2) {
      super(t2);
    }
  };
  var Uo = class extends Pr {
    constructor(t2) {
      super(t2);
    }
  };
  var Do = [1, 2];
  Uo.prototype.g = Vi([0, Do, Ci, Oo, Ci, [0, Pi, Oo]]);
  var Bo = class extends Pr {
    constructor(t2) {
      super(t2);
    }
  };
  var Go = Gi(443442058, Bo);
  is[443442058] = [0, qs, Mi, ki, _i, Ii, -1, Li, _i], is[514774813] = To;
  var jo = class extends Pr {
    constructor(t2) {
      super(t2);
    }
  };
  var Vo = Gi(516587230, jo);
  function Xo(t2, e2) {
    return e2 = e2 ? e2.clone() : new Gs(), void 0 !== t2.displayNamesLocale ? nn(e2, 1, pe(t2.displayNamesLocale)) : void 0 === t2.displayNamesLocale && nn(e2, 1), void 0 !== t2.maxResults ? Mn(e2, 2, t2.maxResults) : "maxResults" in t2 && nn(e2, 2), void 0 !== t2.scoreThreshold ? Pn(e2, 3, t2.scoreThreshold) : "scoreThreshold" in t2 && nn(e2, 3), void 0 !== t2.categoryAllowlist ? On(e2, 4, t2.categoryAllowlist) : "categoryAllowlist" in t2 && nn(e2, 4), void 0 !== t2.categoryDenylist ? On(e2, 5, t2.categoryDenylist) : "categoryDenylist" in t2 && nn(e2, 5), e2;
  }
  function Ho(t2) {
    const e2 = Number(t2);
    return Number.isSafeInteger(e2) ? e2 : String(t2);
  }
  function Wo(t2, e2 = -1, n2 = "") {
    return { categories: t2.map((t3) => ({ index: Rn(t3, 1) ?? 0 ?? -1, score: Fn(t3, 2) ?? 0, categoryName: ge(tn(t3, 3)) ?? "" ?? "", displayName: ge(tn(t3, 4)) ?? "" ?? "" })), headIndex: e2, headName: n2 };
  }
  function zo(t2) {
    const e2 = { classifications: An(t2, Ps, 1).map((t3) => {
      var _a2;
      return Wo(((_a2 = wn(t3, vs, 4)) == null ? void 0 : _a2.g()) ?? [], Rn(t3, 2) ?? 0, ge(tn(t3, 3)) ?? "");
    }) };
    return null != function(t3) {
      return le(g ? tn(t3, 2, void 0, void 0, fe) : tn(t3, 2));
    }(t2) && (e2.timestampMs = Ho(In(t2))), e2;
  }
  function Ko(t2) {
    var _a2, _b;
    var e2 = on(t2, 3, Qt, sn()), n2 = on(t2, 2, ie, sn()), r2 = on(t2, 1, ge, sn()), i2 = on(t2, 9, ge, sn());
    const s2 = { categories: [], keypoints: [] };
    for (let t3 = 0; t3 < e2.length; t3++) s2.categories.push({ score: e2[t3], index: n2[t3] ?? -1, categoryName: r2[t3] ?? "", displayName: i2[t3] ?? "" });
    if ((e2 = (_a2 = wn(t2, bs, 4)) == null ? void 0 : _a2.l()) && (s2.boundingBox = { originX: Rn(e2, 1, Qe) ?? 0, originY: Rn(e2, 2, Qe) ?? 0, width: Rn(e2, 3, Qe) ?? 0, height: Rn(e2, 4, Qe) ?? 0, angle: 0 }), (_b = wn(t2, bs, 4)) == null ? void 0 : _b.g().length) for (const e3 of wn(t2, bs, 4).g()) s2.keypoints.push({ x: tn(e3, 1, void 0, Qe, Qt) ?? 0, y: tn(e3, 2, void 0, Qe, Qt) ?? 0, score: tn(e3, 4, void 0, Qe, Qt) ?? 0, label: ge(tn(e3, 3, void 0, Qe)) ?? "" });
    return s2;
  }
  function Yo(t2) {
    const e2 = [];
    for (const n2 of An(t2, Ls, 1)) e2.push({ x: Fn(n2, 1) ?? 0, y: Fn(n2, 2) ?? 0, z: Fn(n2, 3) ?? 0, visibility: Fn(n2, 4) ?? 0 });
    return e2;
  }
  function qo(t2) {
    const e2 = [];
    for (const n2 of An(t2, Ss, 1)) e2.push({ x: Fn(n2, 1) ?? 0, y: Fn(n2, 2) ?? 0, z: Fn(n2, 3) ?? 0, visibility: Fn(n2, 4) ?? 0 });
    return e2;
  }
  function $o(t2) {
    return Array.from(t2, (t3) => t3 > 127 ? t3 - 256 : t3);
  }
  function Jo(t2, e2) {
    if (t2.length !== e2.length) throw Error(`Cannot compute cosine similarity between embeddings of different sizes (${t2.length} vs. ${e2.length}).`);
    let n2 = 0, r2 = 0, i2 = 0;
    for (let s2 = 0; s2 < t2.length; s2++) n2 += t2[s2] * e2[s2], r2 += t2[s2] * t2[s2], i2 += e2[s2] * e2[s2];
    if (r2 <= 0 || i2 <= 0) throw Error("Cannot compute cosine similarity on embedding with 0 norm.");
    return n2 / Math.sqrt(r2 * i2);
  }
  var Zo;
  is[516587230] = [0, qs, To, Ao, _i], is[518928384] = Ao;
  var Qo = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);
  async function ta() {
    if (void 0 === Zo) try {
      await WebAssembly.instantiate(Qo), Zo = true;
    } catch {
      Zo = false;
    }
    return Zo;
  }
  async function ea(t2, e2 = Yi``) {
    const n2 = await ta() ? "wasm_internal" : "wasm_nosimd_internal";
    return { wasmLoaderPath: `${e2}/${t2}_${n2}.js`, wasmBinaryPath: `${e2}/${t2}_${n2}.wasm` };
  }
  var na = class {
  };
  function ra() {
    var t2 = navigator;
    return "undefined" != typeof OffscreenCanvas && (!function(t3 = navigator) {
      return (t3 = t3.userAgent).includes("Safari") && !t3.includes("Chrome");
    }(t2) || !!((t2 = t2.userAgent.match(/Version\/([\d]+).*Safari/)) && t2.length >= 1 && Number(t2[1]) >= 17));
  }
  async function ia(t2) {
    if ("function" != typeof importScripts) {
      const e2 = document.createElement("script");
      return e2.src = t2.toString(), e2.crossOrigin = "anonymous", new Promise((t3, n2) => {
        e2.addEventListener("load", () => {
          t3();
        }, false), e2.addEventListener("error", (t4) => {
          n2(t4);
        }, false), document.body.appendChild(e2);
      });
    }
    try {
      importScripts(t2.toString());
    } catch (e2) {
      if (!(e2 instanceof TypeError)) throw e2;
      await self.import(t2.toString());
    }
  }
  function sa(t2) {
    return void 0 !== t2.videoWidth ? [t2.videoWidth, t2.videoHeight] : void 0 !== t2.naturalWidth ? [t2.naturalWidth, t2.naturalHeight] : void 0 !== t2.displayWidth ? [t2.displayWidth, t2.displayHeight] : [t2.width, t2.height];
  }
  function oa(t2, e2, n2) {
    t2.m || console.error("No wasm multistream support detected: ensure dependency inclusion of :gl_graph_runner_internal_multi_input target"), n2(e2 = t2.i.stringToNewUTF8(e2)), t2.i._free(e2);
  }
  function aa(t2, e2, n2) {
    if (!t2.i.canvas) throw Error("No OpenGL canvas configured.");
    if (n2 ? t2.i._bindTextureToStream(n2) : t2.i._bindTextureToCanvas(), !(n2 = t2.i.canvas.getContext("webgl2") || t2.i.canvas.getContext("webgl"))) throw Error("Failed to obtain WebGL context from the provided canvas. `getContext()` should only be invoked with `webgl` or `webgl2`.");
    t2.i.gpuOriginForWebTexturesIsBottomLeft && n2.pixelStorei(n2.UNPACK_FLIP_Y_WEBGL, true), n2.texImage2D(n2.TEXTURE_2D, 0, n2.RGBA, n2.RGBA, n2.UNSIGNED_BYTE, e2), t2.i.gpuOriginForWebTexturesIsBottomLeft && n2.pixelStorei(n2.UNPACK_FLIP_Y_WEBGL, false);
    const [r2, i2] = sa(e2);
    return !t2.l || r2 === t2.i.canvas.width && i2 === t2.i.canvas.height || (t2.i.canvas.width = r2, t2.i.canvas.height = i2), [r2, i2];
  }
  function ca(t2, e2, n2) {
    t2.m || console.error("No wasm multistream support detected: ensure dependency inclusion of :gl_graph_runner_internal_multi_input target");
    const r2 = new Uint32Array(e2.length);
    for (let n3 = 0; n3 < e2.length; n3++) r2[n3] = t2.i.stringToNewUTF8(e2[n3]);
    e2 = t2.i._malloc(4 * r2.length), t2.i.HEAPU32.set(r2, e2 >> 2), n2(e2);
    for (const e3 of r2) t2.i._free(e3);
    t2.i._free(e2);
  }
  function ha(t2, e2, n2) {
    t2.i.simpleListeners = t2.i.simpleListeners || {}, t2.i.simpleListeners[e2] = n2;
  }
  function ua(t2, e2, n2) {
    let r2 = [];
    t2.i.simpleListeners = t2.i.simpleListeners || {}, t2.i.simpleListeners[e2] = (t3, e3, i2) => {
      e3 ? (n2(r2, i2), r2 = []) : r2.push(t3);
    };
  }
  na.forVisionTasks = function(t2) {
    return ea("vision", t2);
  }, na.forTextTasks = function(t2) {
    return ea("text", t2);
  }, na.forGenAiExperimentalTasks = function(t2) {
    return ea("genai_experimental", t2);
  }, na.forGenAiTasks = function(t2) {
    return ea("genai", t2);
  }, na.forAudioTasks = function(t2) {
    return ea("audio", t2);
  }, na.isSimdSupported = function() {
    return ta();
  };
  async function la(t2, e2, n2, r2) {
    return t2 = await (async (t3, e3, n3, r3, i2) => {
      if (e3 && await ia(e3), !self.ModuleFactory) throw Error("ModuleFactory not set.");
      if (n3 && (await ia(n3), !self.ModuleFactory)) throw Error("ModuleFactory not set.");
      return self.Module && i2 && ((e3 = self.Module).locateFile = i2.locateFile, i2.mainScriptUrlOrBlob && (e3.mainScriptUrlOrBlob = i2.mainScriptUrlOrBlob)), i2 = await self.ModuleFactory(self.Module || i2), self.ModuleFactory = self.Module = void 0, new t3(i2, r3);
    })(t2, n2.wasmLoaderPath, n2.assetLoaderPath, e2, { locateFile: (t3) => t3.endsWith(".wasm") ? n2.wasmBinaryPath.toString() : n2.assetBinaryPath && t3.endsWith(".data") ? n2.assetBinaryPath.toString() : t3 }), await t2.o(r2), t2;
  }
  function fa(t2, e2) {
    const n2 = wn(t2.baseOptions, zs, 1) || new zs();
    "string" == typeof e2 ? (nn(n2, 2, pe(e2)), nn(n2, 1)) : e2 instanceof Uint8Array && (nn(n2, 1, lt(e2, false)), nn(n2, 2)), kn(t2.baseOptions, 0, 1, n2);
  }
  function da(t2) {
    try {
      const e2 = t2.H.length;
      if (1 === e2) throw Error(t2.H[0].message);
      if (e2 > 1) throw Error("Encountered multiple errors: " + t2.H.map((t3) => t3.message).join(", "));
    } finally {
      t2.H = [];
    }
  }
  function pa(t2, e2) {
    t2.C = Math.max(t2.C, e2);
  }
  function ga(t2, e2) {
    t2.B = new cs(), Cn(t2.B, 2, "PassThroughCalculator"), os(t2.B, "free_memory"), as(t2.B, "free_memory_unused_out"), ds(e2, "free_memory"), fs(e2, t2.B);
  }
  function ma(t2, e2) {
    os(t2.B, e2), as(t2.B, e2 + "_unused_out");
  }
  function ya(t2) {
    t2.g.addBoolToStream(true, "free_memory", t2.C);
  }
  var _a = class {
    constructor(t2) {
      this.g = t2, this.H = [], this.C = 0, this.g.setAutoRenderToScreen(false);
    }
    l(t2, e2 = true) {
      var _a2, _b, _c2, _d, _e2, _f;
      if (e2) {
        const e3 = t2.baseOptions || {};
        if (((_a2 = t2.baseOptions) == null ? void 0 : _a2.modelAssetBuffer) && ((_b = t2.baseOptions) == null ? void 0 : _b.modelAssetPath)) throw Error("Cannot set both baseOptions.modelAssetPath and baseOptions.modelAssetBuffer");
        if (!(((_c2 = wn(this.baseOptions, zs, 1)) == null ? void 0 : _c2.g()) || ((_d = wn(this.baseOptions, zs, 1)) == null ? void 0 : _d.l()) || ((_e2 = t2.baseOptions) == null ? void 0 : _e2.modelAssetBuffer) || ((_f = t2.baseOptions) == null ? void 0 : _f.modelAssetPath))) throw Error("Either baseOptions.modelAssetPath or baseOptions.modelAssetBuffer must be set");
        if (function(t3, e4) {
          let n2 = wn(t3.baseOptions, Hs, 3);
          if (!n2) {
            var r2 = n2 = new Hs(), i2 = new ts();
            Sn(r2, 4, Ws, i2);
          }
          "delegate" in e4 && ("GPU" === e4.delegate ? (e4 = n2, r2 = new $i(), Sn(e4, 2, Ws, r2)) : (e4 = n2, r2 = new ts(), Sn(e4, 4, Ws, r2))), kn(t3.baseOptions, 0, 3, n2);
        }(this, e3), e3.modelAssetPath) return fetch(e3.modelAssetPath.toString()).then((t3) => {
          if (t3.ok) return t3.arrayBuffer();
          throw Error(`Failed to fetch model: ${e3.modelAssetPath} (${t3.status})`);
        }).then((t3) => {
          try {
            this.g.i.FS_unlink("/model.dat");
          } catch {
          }
          this.g.i.FS_createDataFile("/", "model.dat", new Uint8Array(t3), true, false, false), fa(this, "/model.dat"), this.m(), this.L();
        });
        if (e3.modelAssetBuffer instanceof Uint8Array) fa(this, e3.modelAssetBuffer);
        else if (e3.modelAssetBuffer) return async function(t3) {
          const e4 = [];
          for (var n2 = 0; ; ) {
            const { done: r2, value: i2 } = await t3.read();
            if (r2) break;
            e4.push(i2), n2 += i2.length;
          }
          if (0 === e4.length) return new Uint8Array(0);
          if (1 === e4.length) return e4[0];
          t3 = new Uint8Array(n2), n2 = 0;
          for (const r2 of e4) t3.set(r2, n2), n2 += r2.length;
          return t3;
        }(e3.modelAssetBuffer).then((t3) => {
          fa(this, t3), this.m(), this.L();
        });
      }
      return this.m(), this.L(), Promise.resolve();
    }
    L() {
    }
    ca() {
      let t2;
      if (this.g.ca((e2) => {
        t2 = ys(e2);
      }), !t2) throw Error("Failed to retrieve CalculatorGraphConfig");
      return t2;
    }
    setGraph(t2, e2) {
      this.g.attachErrorListener((t3, e3) => {
        this.H.push(Error(e3));
      }), this.g.Ja(), this.g.setGraph(t2, e2), this.B = void 0, da(this);
    }
    finishProcessing() {
      this.g.finishProcessing(), da(this);
    }
    close() {
      this.B = void 0, this.g.closeGraph();
    }
  };
  function va(t2, e2) {
    if (!t2) throw Error(`Unable to obtain required WebGL resource: ${e2}`);
    return t2;
  }
  _a.prototype.close = _a.prototype.close;
  var Ea = class {
    constructor(t2, e2, n2, r2) {
      this.g = t2, this.h = e2, this.m = n2, this.l = r2;
    }
    bind() {
      this.g.bindVertexArray(this.h);
    }
    close() {
      this.g.deleteVertexArray(this.h), this.g.deleteBuffer(this.m), this.g.deleteBuffer(this.l);
    }
  };
  function wa(t2, e2, n2) {
    const r2 = t2.g;
    if (n2 = va(r2.createShader(n2), "Failed to create WebGL shader"), r2.shaderSource(n2, e2), r2.compileShader(n2), !r2.getShaderParameter(n2, r2.COMPILE_STATUS)) throw Error(`Could not compile WebGL shader: ${r2.getShaderInfoLog(n2)}`);
    return r2.attachShader(t2.h, n2), n2;
  }
  function Ta(t2, e2) {
    const n2 = t2.g, r2 = va(n2.createVertexArray(), "Failed to create vertex array");
    n2.bindVertexArray(r2);
    const i2 = va(n2.createBuffer(), "Failed to create buffer");
    n2.bindBuffer(n2.ARRAY_BUFFER, i2), n2.enableVertexAttribArray(t2.O), n2.vertexAttribPointer(t2.O, 2, n2.FLOAT, false, 0, 0), n2.bufferData(n2.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), n2.STATIC_DRAW);
    const s2 = va(n2.createBuffer(), "Failed to create buffer");
    return n2.bindBuffer(n2.ARRAY_BUFFER, s2), n2.enableVertexAttribArray(t2.L), n2.vertexAttribPointer(t2.L, 2, n2.FLOAT, false, 0, 0), n2.bufferData(n2.ARRAY_BUFFER, new Float32Array(e2 ? [0, 1, 0, 0, 1, 0, 1, 1] : [0, 0, 0, 1, 1, 1, 1, 0]), n2.STATIC_DRAW), n2.bindBuffer(n2.ARRAY_BUFFER, null), n2.bindVertexArray(null), new Ea(n2, r2, i2, s2);
  }
  function Aa(t2, e2) {
    if (t2.g) {
      if (e2 !== t2.g) throw Error("Cannot change GL context once initialized");
    } else t2.g = e2;
  }
  function ba(t2, e2, n2, r2) {
    return Aa(t2, e2), t2.h || (t2.m(), t2.D()), n2 ? (t2.u || (t2.u = Ta(t2, true)), n2 = t2.u) : (t2.A || (t2.A = Ta(t2, false)), n2 = t2.A), e2.useProgram(t2.h), n2.bind(), t2.l(), t2 = r2(), n2.g.bindVertexArray(null), t2;
  }
  function ka(t2, e2, n2) {
    return Aa(t2, e2), t2 = va(e2.createTexture(), "Failed to create texture"), e2.bindTexture(e2.TEXTURE_2D, t2), e2.texParameteri(e2.TEXTURE_2D, e2.TEXTURE_WRAP_S, e2.CLAMP_TO_EDGE), e2.texParameteri(e2.TEXTURE_2D, e2.TEXTURE_WRAP_T, e2.CLAMP_TO_EDGE), e2.texParameteri(e2.TEXTURE_2D, e2.TEXTURE_MIN_FILTER, n2 ?? e2.LINEAR), e2.texParameteri(e2.TEXTURE_2D, e2.TEXTURE_MAG_FILTER, n2 ?? e2.LINEAR), e2.bindTexture(e2.TEXTURE_2D, null), t2;
  }
  function Sa(t2, e2, n2) {
    Aa(t2, e2), t2.B || (t2.B = va(e2.createFramebuffer(), "Failed to create framebuffe.")), e2.bindFramebuffer(e2.FRAMEBUFFER, t2.B), e2.framebufferTexture2D(e2.FRAMEBUFFER, e2.COLOR_ATTACHMENT0, e2.TEXTURE_2D, n2, 0);
  }
  function xa(t2) {
    var _a2;
    (_a2 = t2.g) == null ? void 0 : _a2.bindFramebuffer(t2.g.FRAMEBUFFER, null);
  }
  var La = class {
    H() {
      return "\n  precision mediump float;\n  varying vec2 vTex;\n  uniform sampler2D inputTexture;\n  void main() {\n    gl_FragColor = texture2D(inputTexture, vTex);\n  }\n ";
    }
    m() {
      const t2 = this.g;
      if (this.h = va(t2.createProgram(), "Failed to create WebGL program"), this.X = wa(this, "\n  attribute vec2 aVertex;\n  attribute vec2 aTex;\n  varying vec2 vTex;\n  void main(void) {\n    gl_Position = vec4(aVertex, 0.0, 1.0);\n    vTex = aTex;\n  }", t2.VERTEX_SHADER), this.W = wa(this, this.H(), t2.FRAGMENT_SHADER), t2.linkProgram(this.h), !t2.getProgramParameter(this.h, t2.LINK_STATUS)) throw Error(`Error during program linking: ${t2.getProgramInfoLog(this.h)}`);
      this.O = t2.getAttribLocation(this.h, "aVertex"), this.L = t2.getAttribLocation(this.h, "aTex");
    }
    D() {
    }
    l() {
    }
    close() {
      if (this.h) {
        const t2 = this.g;
        t2.deleteProgram(this.h), t2.deleteShader(this.X), t2.deleteShader(this.W);
      }
      this.B && this.g.deleteFramebuffer(this.B), this.A && this.A.close(), this.u && this.u.close();
    }
  };
  var Ra = class extends La {
    H() {
      return "\n  precision mediump float;\n  uniform sampler2D backgroundTexture;\n  uniform sampler2D maskTexture;\n  uniform sampler2D colorMappingTexture;\n  varying vec2 vTex;\n  void main() {\n    vec4 backgroundColor = texture2D(backgroundTexture, vTex);\n    float category = texture2D(maskTexture, vTex).r;\n    vec4 categoryColor = texture2D(colorMappingTexture, vec2(category, 0.0));\n    gl_FragColor = mix(backgroundColor, categoryColor, categoryColor.a);\n  }\n ";
    }
    D() {
      const t2 = this.g;
      t2.activeTexture(t2.TEXTURE1), this.C = ka(this, t2, t2.LINEAR), t2.activeTexture(t2.TEXTURE2), this.j = ka(this, t2, t2.NEAREST);
    }
    m() {
      super.m();
      const t2 = this.g;
      this.P = va(t2.getUniformLocation(this.h, "backgroundTexture"), "Uniform location"), this.U = va(t2.getUniformLocation(this.h, "colorMappingTexture"), "Uniform location"), this.M = va(t2.getUniformLocation(this.h, "maskTexture"), "Uniform location");
    }
    l() {
      super.l();
      const t2 = this.g;
      t2.uniform1i(this.M, 0), t2.uniform1i(this.P, 1), t2.uniform1i(this.U, 2);
    }
    close() {
      this.C && this.g.deleteTexture(this.C), this.j && this.g.deleteTexture(this.j), super.close();
    }
  };
  var Ia = class extends La {
    H() {
      return "\n  precision mediump float;\n  uniform sampler2D maskTexture;\n  uniform sampler2D defaultTexture;\n  uniform sampler2D overlayTexture;\n  varying vec2 vTex;\n  void main() {\n    float confidence = texture2D(maskTexture, vTex).r;\n    vec4 defaultColor = texture2D(defaultTexture, vTex);\n    vec4 overlayColor = texture2D(overlayTexture, vTex);\n    // Apply the alpha from the overlay and merge in the default color\n    overlayColor = mix(defaultColor, overlayColor, overlayColor.a);\n    gl_FragColor = mix(defaultColor, overlayColor, confidence);\n  }\n ";
    }
    D() {
      const t2 = this.g;
      t2.activeTexture(t2.TEXTURE1), this.j = ka(this, t2), t2.activeTexture(t2.TEXTURE2), this.C = ka(this, t2);
    }
    m() {
      super.m();
      const t2 = this.g;
      this.M = va(t2.getUniformLocation(this.h, "defaultTexture"), "Uniform location"), this.P = va(t2.getUniformLocation(this.h, "overlayTexture"), "Uniform location"), this.I = va(t2.getUniformLocation(this.h, "maskTexture"), "Uniform location");
    }
    l() {
      super.l();
      const t2 = this.g;
      t2.uniform1i(this.I, 0), t2.uniform1i(this.M, 1), t2.uniform1i(this.P, 2);
    }
    close() {
      this.j && this.g.deleteTexture(this.j), this.C && this.g.deleteTexture(this.C), super.close();
    }
  };
  function Fa(t2, e2) {
    switch (e2) {
      case 0:
        return t2.g.find((t3) => t3 instanceof Uint8Array);
      case 1:
        return t2.g.find((t3) => t3 instanceof Float32Array);
      case 2:
        return t2.g.find((t3) => "undefined" != typeof WebGLTexture && t3 instanceof WebGLTexture);
      default:
        throw Error(`Type is not supported: ${e2}`);
    }
  }
  function Ma(t2) {
    var e2 = Fa(t2, 1);
    if (!e2) {
      if (e2 = Fa(t2, 0)) e2 = new Float32Array(e2).map((t3) => t3 / 255);
      else {
        e2 = new Float32Array(t2.width * t2.height);
        const r2 = Ca(t2);
        var n2 = Na(t2);
        if (Sa(n2, r2, Pa(t2)), "iPad Simulator;iPhone Simulator;iPod Simulator;iPad;iPhone;iPod".split(";").includes(navigator.platform) || navigator.userAgent.includes("Mac") && "document" in self && "ontouchend" in self.document) {
          n2 = new Float32Array(t2.width * t2.height * 4), r2.readPixels(0, 0, t2.width, t2.height, r2.RGBA, r2.FLOAT, n2);
          for (let t3 = 0, r3 = 0; t3 < e2.length; ++t3, r3 += 4) e2[t3] = n2[r3];
        } else r2.readPixels(0, 0, t2.width, t2.height, r2.RED, r2.FLOAT, e2);
      }
      t2.g.push(e2);
    }
    return e2;
  }
  function Pa(t2) {
    let e2 = Fa(t2, 2);
    if (!e2) {
      const n2 = Ca(t2);
      e2 = Ua(t2);
      const r2 = Ma(t2), i2 = Oa(t2);
      n2.texImage2D(n2.TEXTURE_2D, 0, i2, t2.width, t2.height, 0, n2.RED, n2.FLOAT, r2), Da(t2);
    }
    return e2;
  }
  function Ca(t2) {
    if (!t2.canvas) throw Error("Conversion to different image formats require that a canvas is passed when initializing the image.");
    return t2.h || (t2.h = va(t2.canvas.getContext("webgl2"), "You cannot use a canvas that is already bound to a different type of rendering context.")), t2.h;
  }
  function Oa(t2) {
    if (t2 = Ca(t2), !Ba) if (t2.getExtension("EXT_color_buffer_float") && t2.getExtension("OES_texture_float_linear") && t2.getExtension("EXT_float_blend")) Ba = t2.R32F;
    else {
      if (!t2.getExtension("EXT_color_buffer_half_float")) throw Error("GPU does not fully support 4-channel float32 or float16 formats");
      Ba = t2.R16F;
    }
    return Ba;
  }
  function Na(t2) {
    return t2.l || (t2.l = new La()), t2.l;
  }
  function Ua(t2) {
    const e2 = Ca(t2);
    e2.viewport(0, 0, t2.width, t2.height), e2.activeTexture(e2.TEXTURE0);
    let n2 = Fa(t2, 2);
    return n2 || (n2 = ka(Na(t2), e2, t2.m ? e2.LINEAR : e2.NEAREST), t2.g.push(n2), t2.j = true), e2.bindTexture(e2.TEXTURE_2D, n2), n2;
  }
  function Da(t2) {
    t2.h.bindTexture(t2.h.TEXTURE_2D, null);
  }
  var Ba;
  var Ga = class {
    constructor(t2, e2, n2, r2, i2, s2, o2) {
      this.g = t2, this.m = e2, this.j = n2, this.canvas = r2, this.l = i2, this.width = s2, this.height = o2, this.j && (0 === --ja && console.error("You seem to be creating MPMask instances without invoking .close(). This leaks resources."));
    }
    Fa() {
      return !!Fa(this, 0);
    }
    ka() {
      return !!Fa(this, 1);
    }
    R() {
      return !!Fa(this, 2);
    }
    ja() {
      return (e2 = Fa(t2 = this, 0)) || (e2 = Ma(t2), e2 = new Uint8Array(e2.map((t3) => Math.round(255 * t3))), t2.g.push(e2)), e2;
      var t2, e2;
    }
    ia() {
      return Ma(this);
    }
    N() {
      return Pa(this);
    }
    clone() {
      const t2 = [];
      for (const e2 of this.g) {
        let n2;
        if (e2 instanceof Uint8Array) n2 = new Uint8Array(e2);
        else if (e2 instanceof Float32Array) n2 = new Float32Array(e2);
        else {
          if (!(e2 instanceof WebGLTexture)) throw Error(`Type is not supported: ${e2}`);
          {
            const t3 = Ca(this), e3 = Na(this);
            t3.activeTexture(t3.TEXTURE1), n2 = ka(e3, t3, this.m ? t3.LINEAR : t3.NEAREST), t3.bindTexture(t3.TEXTURE_2D, n2);
            const r2 = Oa(this);
            t3.texImage2D(t3.TEXTURE_2D, 0, r2, this.width, this.height, 0, t3.RED, t3.FLOAT, null), t3.bindTexture(t3.TEXTURE_2D, null), Sa(e3, t3, n2), ba(e3, t3, false, () => {
              Ua(this), t3.clearColor(0, 0, 0, 0), t3.clear(t3.COLOR_BUFFER_BIT), t3.drawArrays(t3.TRIANGLE_FAN, 0, 4), Da(this);
            }), xa(e3), Da(this);
          }
        }
        t2.push(n2);
      }
      return new Ga(t2, this.m, this.R(), this.canvas, this.l, this.width, this.height);
    }
    close() {
      this.j && Ca(this).deleteTexture(Fa(this, 2)), ja = -1;
    }
  };
  Ga.prototype.close = Ga.prototype.close, Ga.prototype.clone = Ga.prototype.clone, Ga.prototype.getAsWebGLTexture = Ga.prototype.N, Ga.prototype.getAsFloat32Array = Ga.prototype.ia, Ga.prototype.getAsUint8Array = Ga.prototype.ja, Ga.prototype.hasWebGLTexture = Ga.prototype.R, Ga.prototype.hasFloat32Array = Ga.prototype.ka, Ga.prototype.hasUint8Array = Ga.prototype.Fa;
  var ja = 250;
  var Va = { color: "white", lineWidth: 4, radius: 6 };
  function Xa(t2) {
    return { ...Va, fillColor: (t2 = t2 || {}).color, ...t2 };
  }
  function Ha(t2, e2) {
    return t2 instanceof Function ? t2(e2) : t2;
  }
  function Wa(t2, e2, n2) {
    return Math.max(Math.min(e2, n2), Math.min(Math.max(e2, n2), t2));
  }
  function za(t2) {
    if (!t2.l) throw Error("CPU rendering requested but CanvasRenderingContext2D not provided.");
    return t2.l;
  }
  function Ka(t2) {
    if (!t2.j) throw Error("GPU rendering requested but WebGL2RenderingContext not provided.");
    return t2.j;
  }
  function Ya(t2, e2, n2) {
    if (e2.R()) n2(e2.N());
    else {
      const r2 = e2.ka() ? e2.ia() : e2.ja();
      t2.m = t2.m ?? new La();
      const i2 = Ka(t2);
      n2((t2 = new Ga([r2], e2.m, false, i2.canvas, t2.m, e2.width, e2.height)).N()), t2.close();
    }
  }
  function qa(t2, e2, n2, r2) {
    const i2 = function(t3) {
      return t3.g || (t3.g = new Ra()), t3.g;
    }(t2), s2 = Ka(t2), o2 = Array.isArray(n2) ? new ImageData(new Uint8ClampedArray(n2), 1, 1) : n2;
    ba(i2, s2, true, () => {
      !function(t4, e3, n3, r3) {
        const i3 = t4.g;
        if (i3.activeTexture(i3.TEXTURE0), i3.bindTexture(i3.TEXTURE_2D, e3), i3.activeTexture(i3.TEXTURE1), i3.bindTexture(i3.TEXTURE_2D, t4.C), i3.texImage2D(i3.TEXTURE_2D, 0, i3.RGBA, i3.RGBA, i3.UNSIGNED_BYTE, n3), t4.I && function(t5, e4) {
          if (t5 !== e4) return false;
          t5 = t5.entries(), e4 = e4.entries();
          for (const [r4, i4] of t5) {
            t5 = r4;
            const s3 = i4;
            var n4 = e4.next();
            if (n4.done) return false;
            const [o3, a2] = n4.value;
            if (n4 = a2, t5 !== o3 || s3[0] !== n4[0] || s3[1] !== n4[1] || s3[2] !== n4[2] || s3[3] !== n4[3]) return false;
          }
          return !!e4.next().done;
        }(t4.I, r3)) i3.activeTexture(i3.TEXTURE2), i3.bindTexture(i3.TEXTURE_2D, t4.j);
        else {
          t4.I = r3;
          const e4 = Array(1024).fill(0);
          r3.forEach((t5, n4) => {
            if (4 !== t5.length) throw Error(`Color at index ${n4} is not a four-channel value.`);
            e4[4 * n4] = t5[0], e4[4 * n4 + 1] = t5[1], e4[4 * n4 + 2] = t5[2], e4[4 * n4 + 3] = t5[3];
          }), i3.activeTexture(i3.TEXTURE2), i3.bindTexture(i3.TEXTURE_2D, t4.j), i3.texImage2D(i3.TEXTURE_2D, 0, i3.RGBA, 256, 1, 0, i3.RGBA, i3.UNSIGNED_BYTE, new Uint8Array(e4));
        }
      }(i2, e2, o2, r2), s2.clearColor(0, 0, 0, 0), s2.clear(s2.COLOR_BUFFER_BIT), s2.drawArrays(s2.TRIANGLE_FAN, 0, 4);
      const t3 = i2.g;
      t3.activeTexture(t3.TEXTURE0), t3.bindTexture(t3.TEXTURE_2D, null), t3.activeTexture(t3.TEXTURE1), t3.bindTexture(t3.TEXTURE_2D, null), t3.activeTexture(t3.TEXTURE2), t3.bindTexture(t3.TEXTURE_2D, null);
    });
  }
  function $a(t2, e2, n2, r2) {
    const i2 = Ka(t2), s2 = function(t3) {
      return t3.h || (t3.h = new Ia()), t3.h;
    }(t2), o2 = Array.isArray(n2) ? new ImageData(new Uint8ClampedArray(n2), 1, 1) : n2, a2 = Array.isArray(r2) ? new ImageData(new Uint8ClampedArray(r2), 1, 1) : r2;
    ba(s2, i2, true, () => {
      var t3 = s2.g;
      t3.activeTexture(t3.TEXTURE0), t3.bindTexture(t3.TEXTURE_2D, e2), t3.activeTexture(t3.TEXTURE1), t3.bindTexture(t3.TEXTURE_2D, s2.j), t3.texImage2D(t3.TEXTURE_2D, 0, t3.RGBA, t3.RGBA, t3.UNSIGNED_BYTE, o2), t3.activeTexture(t3.TEXTURE2), t3.bindTexture(t3.TEXTURE_2D, s2.C), t3.texImage2D(t3.TEXTURE_2D, 0, t3.RGBA, t3.RGBA, t3.UNSIGNED_BYTE, a2), i2.clearColor(0, 0, 0, 0), i2.clear(i2.COLOR_BUFFER_BIT), i2.drawArrays(i2.TRIANGLE_FAN, 0, 4), i2.bindTexture(i2.TEXTURE_2D, null), (t3 = s2.g).activeTexture(t3.TEXTURE0), t3.bindTexture(t3.TEXTURE_2D, null), t3.activeTexture(t3.TEXTURE1), t3.bindTexture(t3.TEXTURE_2D, null), t3.activeTexture(t3.TEXTURE2), t3.bindTexture(t3.TEXTURE_2D, null);
    });
  }
  var Ja = class {
    constructor(t2, e2) {
      "undefined" != typeof CanvasRenderingContext2D && t2 instanceof CanvasRenderingContext2D || t2 instanceof OffscreenCanvasRenderingContext2D ? (this.l = t2, this.j = e2) : this.j = t2;
    }
    ya(t2, e2) {
      if (t2) {
        var n2 = za(this);
        e2 = Xa(e2), n2.save();
        var r2 = n2.canvas, i2 = 0;
        for (const s2 of t2) n2.fillStyle = Ha(e2.fillColor, { index: i2, from: s2 }), n2.strokeStyle = Ha(e2.color, { index: i2, from: s2 }), n2.lineWidth = Ha(e2.lineWidth, { index: i2, from: s2 }), (t2 = new Path2D()).arc(s2.x * r2.width, s2.y * r2.height, Ha(e2.radius, { index: i2, from: s2 }), 0, 2 * Math.PI), n2.fill(t2), n2.stroke(t2), ++i2;
        n2.restore();
      }
    }
    xa(t2, e2, n2) {
      if (t2 && e2) {
        var r2 = za(this);
        n2 = Xa(n2), r2.save();
        var i2 = r2.canvas, s2 = 0;
        for (const o2 of e2) {
          r2.beginPath(), e2 = t2[o2.start];
          const a2 = t2[o2.end];
          e2 && a2 && (r2.strokeStyle = Ha(n2.color, { index: s2, from: e2, to: a2 }), r2.lineWidth = Ha(n2.lineWidth, { index: s2, from: e2, to: a2 }), r2.moveTo(e2.x * i2.width, e2.y * i2.height), r2.lineTo(a2.x * i2.width, a2.y * i2.height)), ++s2, r2.stroke();
        }
        r2.restore();
      }
    }
    ua(t2, e2) {
      const n2 = za(this);
      e2 = Xa(e2), n2.save(), n2.beginPath(), n2.lineWidth = Ha(e2.lineWidth, {}), n2.strokeStyle = Ha(e2.color, {}), n2.fillStyle = Ha(e2.fillColor, {}), n2.moveTo(t2.originX, t2.originY), n2.lineTo(t2.originX + t2.width, t2.originY), n2.lineTo(t2.originX + t2.width, t2.originY + t2.height), n2.lineTo(t2.originX, t2.originY + t2.height), n2.lineTo(t2.originX, t2.originY), n2.stroke(), n2.fill(), n2.restore();
    }
    va(t2, e2, n2 = [0, 0, 0, 255]) {
      this.l ? function(t3, e3, n3, r2) {
        const i2 = Ka(t3);
        Ya(t3, e3, (e4) => {
          qa(t3, e4, n3, r2), (e4 = za(t3)).drawImage(i2.canvas, 0, 0, e4.canvas.width, e4.canvas.height);
        });
      }(this, t2, n2, e2) : qa(this, t2.N(), n2, e2);
    }
    wa(t2, e2, n2) {
      this.l ? function(t3, e3, n3, r2) {
        const i2 = Ka(t3);
        Ya(t3, e3, (e4) => {
          $a(t3, e4, n3, r2), (e4 = za(t3)).drawImage(i2.canvas, 0, 0, e4.canvas.width, e4.canvas.height);
        });
      }(this, t2, e2, n2) : $a(this, t2.N(), e2, n2);
    }
    close() {
      var _a2, _b, _c2;
      (_a2 = this.g) == null ? void 0 : _a2.close(), this.g = void 0, (_b = this.h) == null ? void 0 : _b.close(), this.h = void 0, (_c2 = this.m) == null ? void 0 : _c2.close(), this.m = void 0;
    }
  };
  function Za(t2, e2) {
    switch (e2) {
      case 0:
        return t2.g.find((t3) => t3 instanceof ImageData);
      case 1:
        return t2.g.find((t3) => "undefined" != typeof ImageBitmap && t3 instanceof ImageBitmap);
      case 2:
        return t2.g.find((t3) => "undefined" != typeof WebGLTexture && t3 instanceof WebGLTexture);
      default:
        throw Error(`Type is not supported: ${e2}`);
    }
  }
  function Qa(t2) {
    var e2 = Za(t2, 0);
    if (!e2) {
      e2 = ec(t2);
      const n2 = nc(t2), r2 = new Uint8Array(t2.width * t2.height * 4);
      Sa(n2, e2, tc(t2)), e2.readPixels(0, 0, t2.width, t2.height, e2.RGBA, e2.UNSIGNED_BYTE, r2), xa(n2), e2 = new ImageData(new Uint8ClampedArray(r2.buffer), t2.width, t2.height), t2.g.push(e2);
    }
    return e2;
  }
  function tc(t2) {
    let e2 = Za(t2, 2);
    if (!e2) {
      const n2 = ec(t2);
      e2 = rc(t2);
      const r2 = Za(t2, 1) || Qa(t2);
      n2.texImage2D(n2.TEXTURE_2D, 0, n2.RGBA, n2.RGBA, n2.UNSIGNED_BYTE, r2), ic(t2);
    }
    return e2;
  }
  function ec(t2) {
    if (!t2.canvas) throw Error("Conversion to different image formats require that a canvas is passed when initializing the image.");
    return t2.h || (t2.h = va(t2.canvas.getContext("webgl2"), "You cannot use a canvas that is already bound to a different type of rendering context.")), t2.h;
  }
  function nc(t2) {
    return t2.l || (t2.l = new La()), t2.l;
  }
  function rc(t2) {
    const e2 = ec(t2);
    e2.viewport(0, 0, t2.width, t2.height), e2.activeTexture(e2.TEXTURE0);
    let n2 = Za(t2, 2);
    return n2 || (n2 = ka(nc(t2), e2), t2.g.push(n2), t2.m = true), e2.bindTexture(e2.TEXTURE_2D, n2), n2;
  }
  function ic(t2) {
    t2.h.bindTexture(t2.h.TEXTURE_2D, null);
  }
  function sc(t2) {
    const e2 = ec(t2);
    return ba(nc(t2), e2, true, () => function(t3, e3) {
      const n2 = t3.canvas;
      if (n2.width === t3.width && n2.height === t3.height) return e3();
      const r2 = n2.width, i2 = n2.height;
      return n2.width = t3.width, n2.height = t3.height, t3 = e3(), n2.width = r2, n2.height = i2, t3;
    }(t2, () => {
      if (e2.bindFramebuffer(e2.FRAMEBUFFER, null), e2.clearColor(0, 0, 0, 0), e2.clear(e2.COLOR_BUFFER_BIT), e2.drawArrays(e2.TRIANGLE_FAN, 0, 4), !(t2.canvas instanceof OffscreenCanvas)) throw Error("Conversion to ImageBitmap requires that the MediaPipe Tasks is initialized with an OffscreenCanvas");
      return t2.canvas.transferToImageBitmap();
    }));
  }
  Ja.prototype.close = Ja.prototype.close, Ja.prototype.drawConfidenceMask = Ja.prototype.wa, Ja.prototype.drawCategoryMask = Ja.prototype.va, Ja.prototype.drawBoundingBox = Ja.prototype.ua, Ja.prototype.drawConnectors = Ja.prototype.xa, Ja.prototype.drawLandmarks = Ja.prototype.ya, Ja.lerp = function(t2, e2, n2, r2, i2) {
    return Wa(r2 * (1 - (t2 - e2) / (n2 - e2)) + i2 * (1 - (n2 - t2) / (n2 - e2)), r2, i2);
  }, Ja.clamp = Wa;
  var oc = class {
    constructor(t2, e2, n2, r2, i2, s2, o2) {
      this.g = t2, this.j = e2, this.m = n2, this.canvas = r2, this.l = i2, this.width = s2, this.height = o2, (this.j || this.m) && (0 === --ac && console.error("You seem to be creating MPImage instances without invoking .close(). This leaks resources."));
    }
    Ea() {
      return !!Za(this, 0);
    }
    la() {
      return !!Za(this, 1);
    }
    R() {
      return !!Za(this, 2);
    }
    Ca() {
      return Qa(this);
    }
    Ba() {
      var t2 = Za(this, 1);
      return t2 || (tc(this), rc(this), t2 = sc(this), ic(this), this.g.push(t2), this.j = true), t2;
    }
    N() {
      return tc(this);
    }
    clone() {
      const t2 = [];
      for (const e2 of this.g) {
        let n2;
        if (e2 instanceof ImageData) n2 = new ImageData(e2.data, this.width, this.height);
        else if (e2 instanceof WebGLTexture) {
          const t3 = ec(this), e3 = nc(this);
          t3.activeTexture(t3.TEXTURE1), n2 = ka(e3, t3), t3.bindTexture(t3.TEXTURE_2D, n2), t3.texImage2D(t3.TEXTURE_2D, 0, t3.RGBA, this.width, this.height, 0, t3.RGBA, t3.UNSIGNED_BYTE, null), t3.bindTexture(t3.TEXTURE_2D, null), Sa(e3, t3, n2), ba(e3, t3, false, () => {
            rc(this), t3.clearColor(0, 0, 0, 0), t3.clear(t3.COLOR_BUFFER_BIT), t3.drawArrays(t3.TRIANGLE_FAN, 0, 4), ic(this);
          }), xa(e3), ic(this);
        } else {
          if (!(e2 instanceof ImageBitmap)) throw Error(`Type is not supported: ${e2}`);
          tc(this), rc(this), n2 = sc(this), ic(this);
        }
        t2.push(n2);
      }
      return new oc(t2, this.la(), this.R(), this.canvas, this.l, this.width, this.height);
    }
    close() {
      this.j && Za(this, 1).close(), this.m && ec(this).deleteTexture(Za(this, 2)), ac = -1;
    }
  };
  oc.prototype.close = oc.prototype.close, oc.prototype.clone = oc.prototype.clone, oc.prototype.getAsWebGLTexture = oc.prototype.N, oc.prototype.getAsImageBitmap = oc.prototype.Ba, oc.prototype.getAsImageData = oc.prototype.Ca, oc.prototype.hasWebGLTexture = oc.prototype.R, oc.prototype.hasImageBitmap = oc.prototype.la, oc.prototype.hasImageData = oc.prototype.Ea;
  var ac = 250;
  function cc(...t2) {
    return t2.map(([t3, e2]) => ({ start: t3, end: e2 }));
  }
  var hc = /* @__PURE__ */ function(t2) {
    return class extends t2 {
      Ja() {
        this.i._registerModelResourcesGraphService();
      }
    };
  }((uc = class {
    constructor(t2, e2) {
      this.l = true, this.i = t2, this.g = null, this.h = 0, this.m = "function" == typeof this.i._addIntToInputStream, void 0 !== e2 ? this.i.canvas = e2 : ra() ? this.i.canvas = new OffscreenCanvas(1, 1) : (console.warn("OffscreenCanvas not supported and GraphRunner constructor glCanvas parameter is undefined. Creating backup canvas."), this.i.canvas = document.createElement("canvas"));
    }
    async initializeGraph(t2) {
      const e2 = await (await fetch(t2)).arrayBuffer();
      t2 = !(t2.endsWith(".pbtxt") || t2.endsWith(".textproto")), this.setGraph(new Uint8Array(e2), t2);
    }
    setGraphFromString(t2) {
      this.setGraph(new TextEncoder().encode(t2), false);
    }
    setGraph(t2, e2) {
      const n2 = t2.length, r2 = this.i._malloc(n2);
      this.i.HEAPU8.set(t2, r2), e2 ? this.i._changeBinaryGraph(n2, r2) : this.i._changeTextGraph(n2, r2), this.i._free(r2);
    }
    configureAudio(t2, e2, n2, r2, i2) {
      this.i._configureAudio || console.warn('Attempting to use configureAudio without support for input audio. Is build dep ":gl_graph_runner_audio" missing?'), oa(this, r2 || "input_audio", (r3) => {
        oa(this, i2 = i2 || "audio_header", (i3) => {
          this.i._configureAudio(r3, i3, t2, e2 ?? 0, n2);
        });
      });
    }
    setAutoResizeCanvas(t2) {
      this.l = t2;
    }
    setAutoRenderToScreen(t2) {
      this.i._setAutoRenderToScreen(t2);
    }
    setGpuBufferVerticalFlip(t2) {
      this.i.gpuOriginForWebTexturesIsBottomLeft = t2;
    }
    ca(t2) {
      ha(this, "__graph_config__", (e2) => {
        t2(e2);
      }), oa(this, "__graph_config__", (t3) => {
        this.i._getGraphConfig(t3, void 0);
      }), delete this.i.simpleListeners.__graph_config__;
    }
    attachErrorListener(t2) {
      this.i.errorListener = t2;
    }
    attachEmptyPacketListener(t2, e2) {
      this.i.emptyPacketListeners = this.i.emptyPacketListeners || {}, this.i.emptyPacketListeners[t2] = e2;
    }
    addAudioToStream(t2, e2, n2) {
      this.addAudioToStreamWithShape(t2, 0, 0, e2, n2);
    }
    addAudioToStreamWithShape(t2, e2, n2, r2, i2) {
      const s2 = 4 * t2.length;
      this.h !== s2 && (this.g && this.i._free(this.g), this.g = this.i._malloc(s2), this.h = s2), this.i.HEAPF32.set(t2, this.g / 4), oa(this, r2, (t3) => {
        this.i._addAudioToInputStream(this.g, e2, n2, t3, i2);
      });
    }
    addGpuBufferToStream(t2, e2, n2) {
      oa(this, e2, (e3) => {
        const [r2, i2] = aa(this, t2, e3);
        this.i._addBoundTextureToStream(e3, r2, i2, n2);
      });
    }
    addBoolToStream(t2, e2, n2) {
      oa(this, e2, (e3) => {
        this.i._addBoolToInputStream(t2, e3, n2);
      });
    }
    addDoubleToStream(t2, e2, n2) {
      oa(this, e2, (e3) => {
        this.i._addDoubleToInputStream(t2, e3, n2);
      });
    }
    addFloatToStream(t2, e2, n2) {
      oa(this, e2, (e3) => {
        this.i._addFloatToInputStream(t2, e3, n2);
      });
    }
    addIntToStream(t2, e2, n2) {
      oa(this, e2, (e3) => {
        this.i._addIntToInputStream(t2, e3, n2);
      });
    }
    addUintToStream(t2, e2, n2) {
      oa(this, e2, (e3) => {
        this.i._addUintToInputStream(t2, e3, n2);
      });
    }
    addStringToStream(t2, e2, n2) {
      oa(this, e2, (e3) => {
        oa(this, t2, (t3) => {
          this.i._addStringToInputStream(t3, e3, n2);
        });
      });
    }
    addStringRecordToStream(t2, e2, n2) {
      oa(this, e2, (e3) => {
        ca(this, Object.keys(t2), (r2) => {
          ca(this, Object.values(t2), (i2) => {
            this.i._addFlatHashMapToInputStream(r2, i2, Object.keys(t2).length, e3, n2);
          });
        });
      });
    }
    addProtoToStream(t2, e2, n2, r2) {
      oa(this, n2, (n3) => {
        oa(this, e2, (e3) => {
          const i2 = this.i._malloc(t2.length);
          this.i.HEAPU8.set(t2, i2), this.i._addProtoToInputStream(i2, t2.length, e3, n3, r2), this.i._free(i2);
        });
      });
    }
    addEmptyPacketToStream(t2, e2) {
      oa(this, t2, (t3) => {
        this.i._addEmptyPacketToInputStream(t3, e2);
      });
    }
    addBoolVectorToStream(t2, e2, n2) {
      oa(this, e2, (e3) => {
        const r2 = this.i._allocateBoolVector(t2.length);
        if (!r2) throw Error("Unable to allocate new bool vector on heap.");
        for (const e4 of t2) this.i._addBoolVectorEntry(r2, e4);
        this.i._addBoolVectorToInputStream(r2, e3, n2);
      });
    }
    addDoubleVectorToStream(t2, e2, n2) {
      oa(this, e2, (e3) => {
        const r2 = this.i._allocateDoubleVector(t2.length);
        if (!r2) throw Error("Unable to allocate new double vector on heap.");
        for (const e4 of t2) this.i._addDoubleVectorEntry(r2, e4);
        this.i._addDoubleVectorToInputStream(r2, e3, n2);
      });
    }
    addFloatVectorToStream(t2, e2, n2) {
      oa(this, e2, (e3) => {
        const r2 = this.i._allocateFloatVector(t2.length);
        if (!r2) throw Error("Unable to allocate new float vector on heap.");
        for (const e4 of t2) this.i._addFloatVectorEntry(r2, e4);
        this.i._addFloatVectorToInputStream(r2, e3, n2);
      });
    }
    addIntVectorToStream(t2, e2, n2) {
      oa(this, e2, (e3) => {
        const r2 = this.i._allocateIntVector(t2.length);
        if (!r2) throw Error("Unable to allocate new int vector on heap.");
        for (const e4 of t2) this.i._addIntVectorEntry(r2, e4);
        this.i._addIntVectorToInputStream(r2, e3, n2);
      });
    }
    addUintVectorToStream(t2, e2, n2) {
      oa(this, e2, (e3) => {
        const r2 = this.i._allocateUintVector(t2.length);
        if (!r2) throw Error("Unable to allocate new unsigned int vector on heap.");
        for (const e4 of t2) this.i._addUintVectorEntry(r2, e4);
        this.i._addUintVectorToInputStream(r2, e3, n2);
      });
    }
    addStringVectorToStream(t2, e2, n2) {
      oa(this, e2, (e3) => {
        const r2 = this.i._allocateStringVector(t2.length);
        if (!r2) throw Error("Unable to allocate new string vector on heap.");
        for (const e4 of t2) oa(this, e4, (t3) => {
          this.i._addStringVectorEntry(r2, t3);
        });
        this.i._addStringVectorToInputStream(r2, e3, n2);
      });
    }
    addBoolToInputSidePacket(t2, e2) {
      oa(this, e2, (e3) => {
        this.i._addBoolToInputSidePacket(t2, e3);
      });
    }
    addDoubleToInputSidePacket(t2, e2) {
      oa(this, e2, (e3) => {
        this.i._addDoubleToInputSidePacket(t2, e3);
      });
    }
    addFloatToInputSidePacket(t2, e2) {
      oa(this, e2, (e3) => {
        this.i._addFloatToInputSidePacket(t2, e3);
      });
    }
    addIntToInputSidePacket(t2, e2) {
      oa(this, e2, (e3) => {
        this.i._addIntToInputSidePacket(t2, e3);
      });
    }
    addUintToInputSidePacket(t2, e2) {
      oa(this, e2, (e3) => {
        this.i._addUintToInputSidePacket(t2, e3);
      });
    }
    addStringToInputSidePacket(t2, e2) {
      oa(this, e2, (e3) => {
        oa(this, t2, (t3) => {
          this.i._addStringToInputSidePacket(t3, e3);
        });
      });
    }
    addProtoToInputSidePacket(t2, e2, n2) {
      oa(this, n2, (n3) => {
        oa(this, e2, (e3) => {
          const r2 = this.i._malloc(t2.length);
          this.i.HEAPU8.set(t2, r2), this.i._addProtoToInputSidePacket(r2, t2.length, e3, n3), this.i._free(r2);
        });
      });
    }
    addBoolVectorToInputSidePacket(t2, e2) {
      oa(this, e2, (e3) => {
        const n2 = this.i._allocateBoolVector(t2.length);
        if (!n2) throw Error("Unable to allocate new bool vector on heap.");
        for (const e4 of t2) this.i._addBoolVectorEntry(n2, e4);
        this.i._addBoolVectorToInputSidePacket(n2, e3);
      });
    }
    addDoubleVectorToInputSidePacket(t2, e2) {
      oa(this, e2, (e3) => {
        const n2 = this.i._allocateDoubleVector(t2.length);
        if (!n2) throw Error("Unable to allocate new double vector on heap.");
        for (const e4 of t2) this.i._addDoubleVectorEntry(n2, e4);
        this.i._addDoubleVectorToInputSidePacket(n2, e3);
      });
    }
    addFloatVectorToInputSidePacket(t2, e2) {
      oa(this, e2, (e3) => {
        const n2 = this.i._allocateFloatVector(t2.length);
        if (!n2) throw Error("Unable to allocate new float vector on heap.");
        for (const e4 of t2) this.i._addFloatVectorEntry(n2, e4);
        this.i._addFloatVectorToInputSidePacket(n2, e3);
      });
    }
    addIntVectorToInputSidePacket(t2, e2) {
      oa(this, e2, (e3) => {
        const n2 = this.i._allocateIntVector(t2.length);
        if (!n2) throw Error("Unable to allocate new int vector on heap.");
        for (const e4 of t2) this.i._addIntVectorEntry(n2, e4);
        this.i._addIntVectorToInputSidePacket(n2, e3);
      });
    }
    addUintVectorToInputSidePacket(t2, e2) {
      oa(this, e2, (e3) => {
        const n2 = this.i._allocateUintVector(t2.length);
        if (!n2) throw Error("Unable to allocate new unsigned int vector on heap.");
        for (const e4 of t2) this.i._addUintVectorEntry(n2, e4);
        this.i._addUintVectorToInputSidePacket(n2, e3);
      });
    }
    addStringVectorToInputSidePacket(t2, e2) {
      oa(this, e2, (e3) => {
        const n2 = this.i._allocateStringVector(t2.length);
        if (!n2) throw Error("Unable to allocate new string vector on heap.");
        for (const e4 of t2) oa(this, e4, (t3) => {
          this.i._addStringVectorEntry(n2, t3);
        });
        this.i._addStringVectorToInputSidePacket(n2, e3);
      });
    }
    attachBoolListener(t2, e2) {
      ha(this, t2, e2), oa(this, t2, (t3) => {
        this.i._attachBoolListener(t3);
      });
    }
    attachBoolVectorListener(t2, e2) {
      ua(this, t2, e2), oa(this, t2, (t3) => {
        this.i._attachBoolVectorListener(t3);
      });
    }
    attachIntListener(t2, e2) {
      ha(this, t2, e2), oa(this, t2, (t3) => {
        this.i._attachIntListener(t3);
      });
    }
    attachIntVectorListener(t2, e2) {
      ua(this, t2, e2), oa(this, t2, (t3) => {
        this.i._attachIntVectorListener(t3);
      });
    }
    attachUintListener(t2, e2) {
      ha(this, t2, e2), oa(this, t2, (t3) => {
        this.i._attachUintListener(t3);
      });
    }
    attachUintVectorListener(t2, e2) {
      ua(this, t2, e2), oa(this, t2, (t3) => {
        this.i._attachUintVectorListener(t3);
      });
    }
    attachDoubleListener(t2, e2) {
      ha(this, t2, e2), oa(this, t2, (t3) => {
        this.i._attachDoubleListener(t3);
      });
    }
    attachDoubleVectorListener(t2, e2) {
      ua(this, t2, e2), oa(this, t2, (t3) => {
        this.i._attachDoubleVectorListener(t3);
      });
    }
    attachFloatListener(t2, e2) {
      ha(this, t2, e2), oa(this, t2, (t3) => {
        this.i._attachFloatListener(t3);
      });
    }
    attachFloatVectorListener(t2, e2) {
      ua(this, t2, e2), oa(this, t2, (t3) => {
        this.i._attachFloatVectorListener(t3);
      });
    }
    attachStringListener(t2, e2) {
      ha(this, t2, e2), oa(this, t2, (t3) => {
        this.i._attachStringListener(t3);
      });
    }
    attachStringVectorListener(t2, e2) {
      ua(this, t2, e2), oa(this, t2, (t3) => {
        this.i._attachStringVectorListener(t3);
      });
    }
    attachProtoListener(t2, e2, n2) {
      ha(this, t2, e2), oa(this, t2, (t3) => {
        this.i._attachProtoListener(t3, n2 || false);
      });
    }
    attachProtoVectorListener(t2, e2, n2) {
      ua(this, t2, e2), oa(this, t2, (t3) => {
        this.i._attachProtoVectorListener(t3, n2 || false);
      });
    }
    attachAudioListener(t2, e2, n2) {
      this.i._attachAudioListener || console.warn('Attempting to use attachAudioListener without support for output audio. Is build dep ":gl_graph_runner_audio_out" missing?'), ha(this, t2, (t3, n3) => {
        t3 = new Float32Array(t3.buffer, t3.byteOffset, t3.length / 4), e2(t3, n3);
      }), oa(this, t2, (t3) => {
        this.i._attachAudioListener(t3, n2 || false);
      });
    }
    finishProcessing() {
      this.i._waitUntilIdle();
    }
    closeGraph() {
      this.i._closeGraph(), this.i.simpleListeners = void 0, this.i.emptyPacketListeners = void 0;
    }
  }, class extends uc {
    get ga() {
      return this.i;
    }
    pa(t2, e2, n2) {
      oa(this, e2, (e3) => {
        const [r2, i2] = aa(this, t2, e3);
        this.ga._addBoundTextureAsImageToStream(e3, r2, i2, n2);
      });
    }
    Z(t2, e2) {
      ha(this, t2, e2), oa(this, t2, (t3) => {
        this.ga._attachImageListener(t3);
      });
    }
    aa(t2, e2) {
      ua(this, t2, e2), oa(this, t2, (t3) => {
        this.ga._attachImageVectorListener(t3);
      });
    }
  }));
  var uc;
  var lc = class extends hc {
  };
  async function fc(t2, e2, n2) {
    return async function(t3, e3, n3, r2) {
      return la(t3, e3, n3, r2);
    }(t2, n2.canvas ?? (ra() ? void 0 : document.createElement("canvas")), e2, n2);
  }
  function dc(t2, e2, n2, r2) {
    if (t2.U) {
      const s2 = new Ms();
      if (n2 == null ? void 0 : n2.regionOfInterest) {
        if (!t2.oa) throw Error("This task doesn't support region-of-interest.");
        var i2 = n2.regionOfInterest;
        if (i2.left >= i2.right || i2.top >= i2.bottom) throw Error("Expected RectF with left < right and top < bottom.");
        if (i2.left < 0 || i2.top < 0 || i2.right > 1 || i2.bottom > 1) throw Error("Expected RectF values to be in [0,1].");
        Pn(s2, 1, (i2.left + i2.right) / 2), Pn(s2, 2, (i2.top + i2.bottom) / 2), Pn(s2, 4, i2.right - i2.left), Pn(s2, 3, i2.bottom - i2.top);
      } else Pn(s2, 1, 0.5), Pn(s2, 2, 0.5), Pn(s2, 4, 1), Pn(s2, 3, 1);
      if (n2 == null ? void 0 : n2.rotationDegrees) {
        if ((n2 == null ? void 0 : n2.rotationDegrees) % 90 != 0) throw Error("Expected rotation to be a multiple of 90\xB0.");
        if (Pn(s2, 5, -Math.PI * n2.rotationDegrees / 180), (n2 == null ? void 0 : n2.rotationDegrees) % 180 != 0) {
          const [t3, r3] = sa(e2);
          n2 = Fn(s2, 3) * r3 / t3, i2 = Fn(s2, 4) * t3 / r3, Pn(s2, 4, n2), Pn(s2, 3, i2);
        }
      }
      t2.g.addProtoToStream(s2.g(), "mediapipe.NormalizedRect", t2.U, r2);
    }
    t2.g.pa(e2, t2.X, r2 ?? performance.now()), t2.finishProcessing();
  }
  function pc(t2, e2, n2) {
    var _a2;
    if ((_a2 = t2.baseOptions) == null ? void 0 : _a2.g()) throw Error("Task is not initialized with image mode. 'runningMode' must be set to 'IMAGE'.");
    dc(t2, e2, n2, t2.C + 1);
  }
  function gc(t2, e2, n2, r2) {
    var _a2;
    if (!((_a2 = t2.baseOptions) == null ? void 0 : _a2.g())) throw Error("Task is not initialized with video mode. 'runningMode' must be set to 'VIDEO'.");
    dc(t2, e2, n2, r2);
  }
  function mc(t2, e2, n2, r2) {
    var i2 = e2.data;
    const s2 = e2.width, o2 = s2 * (e2 = e2.height);
    if ((i2 instanceof Uint8Array || i2 instanceof Float32Array) && i2.length !== o2) throw Error("Unsupported channel count: " + i2.length / o2);
    return t2 = new Ga([i2], n2, false, t2.g.i.canvas, t2.P, s2, e2), r2 ? t2.clone() : t2;
  }
  var yc = class extends _a {
    constructor(t2, e2, n2, r2) {
      super(t2), this.g = t2, this.X = e2, this.U = n2, this.oa = r2, this.P = new La();
    }
    l(t2, e2 = true) {
      if ("runningMode" in t2 && nn(this.baseOptions, 2, te(!!t2.runningMode && "IMAGE" !== t2.runningMode)), void 0 !== t2.canvas && this.g.i.canvas !== t2.canvas) throw Error("You must create a new task to reset the canvas.");
      return super.l(t2, e2);
    }
    close() {
      this.P.close(), super.close();
    }
  };
  yc.prototype.close = yc.prototype.close;
  var _c = class extends yc {
    constructor(t2, e2) {
      super(new lc(t2, e2), "image_in", "norm_rect_in", false), this.j = { detections: [] }, kn(t2 = this.h = new $s(), 0, 1, e2 = new Ks()), Pn(this.h, 2, 0.5), Pn(this.h, 3, 0.3);
    }
    get baseOptions() {
      return wn(this.h, Ks, 1);
    }
    set baseOptions(t2) {
      kn(this.h, 0, 1, t2);
    }
    o(t2) {
      return "minDetectionConfidence" in t2 && Pn(this.h, 2, t2.minDetectionConfidence ?? 0.5), "minSuppressionThreshold" in t2 && Pn(this.h, 3, t2.minSuppressionThreshold ?? 0.3), this.l(t2);
    }
    F(t2, e2) {
      return this.j = { detections: [] }, pc(this, t2, e2), this.j;
    }
    G(t2, e2, n2) {
      return this.j = { detections: [] }, gc(this, t2, n2, e2), this.j;
    }
    m() {
      var t2 = new gs();
      ds(t2, "image_in"), ds(t2, "norm_rect_in"), ps(t2, "detections");
      const e2 = new rs();
      Mr(e2, Zs, this.h);
      const n2 = new cs();
      Cn(n2, 2, "mediapipe.tasks.vision.face_detector.FaceDetectorGraph"), os(n2, "IMAGE:image_in"), os(n2, "NORM_RECT:norm_rect_in"), as(n2, "DETECTIONS:detections"), n2.o(e2), fs(t2, n2), this.g.attachProtoVectorListener("detections", (t3, e3) => {
        for (const e4 of t3) t3 = ks(e4), this.j.detections.push(Ko(t3));
        pa(this, e3);
      }), this.g.attachEmptyPacketListener("detections", (t3) => {
        pa(this, t3);
      }), t2 = t2.g(), this.setGraph(new Uint8Array(t2), true);
    }
  };
  _c.prototype.detectForVideo = _c.prototype.G, _c.prototype.detect = _c.prototype.F, _c.prototype.setOptions = _c.prototype.o, _c.createFromModelPath = async function(t2, e2) {
    return fc(_c, t2, { baseOptions: { modelAssetPath: e2 } });
  }, _c.createFromModelBuffer = function(t2, e2) {
    return fc(_c, t2, { baseOptions: { modelAssetBuffer: e2 } });
  }, _c.createFromOptions = function(t2, e2) {
    return fc(_c, t2, e2);
  };
  var vc = cc([61, 146], [146, 91], [91, 181], [181, 84], [84, 17], [17, 314], [314, 405], [405, 321], [321, 375], [375, 291], [61, 185], [185, 40], [40, 39], [39, 37], [37, 0], [0, 267], [267, 269], [269, 270], [270, 409], [409, 291], [78, 95], [95, 88], [88, 178], [178, 87], [87, 14], [14, 317], [317, 402], [402, 318], [318, 324], [324, 308], [78, 191], [191, 80], [80, 81], [81, 82], [82, 13], [13, 312], [312, 311], [311, 310], [310, 415], [415, 308]);
  var Ec = cc([263, 249], [249, 390], [390, 373], [373, 374], [374, 380], [380, 381], [381, 382], [382, 362], [263, 466], [466, 388], [388, 387], [387, 386], [386, 385], [385, 384], [384, 398], [398, 362]);
  var wc = cc([276, 283], [283, 282], [282, 295], [295, 285], [300, 293], [293, 334], [334, 296], [296, 336]);
  var Tc = cc([474, 475], [475, 476], [476, 477], [477, 474]);
  var Ac = cc([33, 7], [7, 163], [163, 144], [144, 145], [145, 153], [153, 154], [154, 155], [155, 133], [33, 246], [246, 161], [161, 160], [160, 159], [159, 158], [158, 157], [157, 173], [173, 133]);
  var bc = cc([46, 53], [53, 52], [52, 65], [65, 55], [70, 63], [63, 105], [105, 66], [66, 107]);
  var kc = cc([469, 470], [470, 471], [471, 472], [472, 469]);
  var Sc = cc([10, 338], [338, 297], [297, 332], [332, 284], [284, 251], [251, 389], [389, 356], [356, 454], [454, 323], [323, 361], [361, 288], [288, 397], [397, 365], [365, 379], [379, 378], [378, 400], [400, 377], [377, 152], [152, 148], [148, 176], [176, 149], [149, 150], [150, 136], [136, 172], [172, 58], [58, 132], [132, 93], [93, 234], [234, 127], [127, 162], [162, 21], [21, 54], [54, 103], [103, 67], [67, 109], [109, 10]);
  var xc = [...vc, ...Ec, ...wc, ...Ac, ...bc, ...Sc];
  var Lc = cc([127, 34], [34, 139], [139, 127], [11, 0], [0, 37], [37, 11], [232, 231], [231, 120], [120, 232], [72, 37], [37, 39], [39, 72], [128, 121], [121, 47], [47, 128], [232, 121], [121, 128], [128, 232], [104, 69], [69, 67], [67, 104], [175, 171], [171, 148], [148, 175], [118, 50], [50, 101], [101, 118], [73, 39], [39, 40], [40, 73], [9, 151], [151, 108], [108, 9], [48, 115], [115, 131], [131, 48], [194, 204], [204, 211], [211, 194], [74, 40], [40, 185], [185, 74], [80, 42], [42, 183], [183, 80], [40, 92], [92, 186], [186, 40], [230, 229], [229, 118], [118, 230], [202, 212], [212, 214], [214, 202], [83, 18], [18, 17], [17, 83], [76, 61], [61, 146], [146, 76], [160, 29], [29, 30], [30, 160], [56, 157], [157, 173], [173, 56], [106, 204], [204, 194], [194, 106], [135, 214], [214, 192], [192, 135], [203, 165], [165, 98], [98, 203], [21, 71], [71, 68], [68, 21], [51, 45], [45, 4], [4, 51], [144, 24], [24, 23], [23, 144], [77, 146], [146, 91], [91, 77], [205, 50], [50, 187], [187, 205], [201, 200], [200, 18], [18, 201], [91, 106], [106, 182], [182, 91], [90, 91], [91, 181], [181, 90], [85, 84], [84, 17], [17, 85], [206, 203], [203, 36], [36, 206], [148, 171], [171, 140], [140, 148], [92, 40], [40, 39], [39, 92], [193, 189], [189, 244], [244, 193], [159, 158], [158, 28], [28, 159], [247, 246], [246, 161], [161, 247], [236, 3], [3, 196], [196, 236], [54, 68], [68, 104], [104, 54], [193, 168], [168, 8], [8, 193], [117, 228], [228, 31], [31, 117], [189, 193], [193, 55], [55, 189], [98, 97], [97, 99], [99, 98], [126, 47], [47, 100], [100, 126], [166, 79], [79, 218], [218, 166], [155, 154], [154, 26], [26, 155], [209, 49], [49, 131], [131, 209], [135, 136], [136, 150], [150, 135], [47, 126], [126, 217], [217, 47], [223, 52], [52, 53], [53, 223], [45, 51], [51, 134], [134, 45], [211, 170], [170, 140], [140, 211], [67, 69], [69, 108], [108, 67], [43, 106], [106, 91], [91, 43], [230, 119], [119, 120], [120, 230], [226, 130], [130, 247], [247, 226], [63, 53], [53, 52], [52, 63], [238, 20], [20, 242], [242, 238], [46, 70], [70, 156], [156, 46], [78, 62], [62, 96], [96, 78], [46, 53], [53, 63], [63, 46], [143, 34], [34, 227], [227, 143], [123, 117], [117, 111], [111, 123], [44, 125], [125, 19], [19, 44], [236, 134], [134, 51], [51, 236], [216, 206], [206, 205], [205, 216], [154, 153], [153, 22], [22, 154], [39, 37], [37, 167], [167, 39], [200, 201], [201, 208], [208, 200], [36, 142], [142, 100], [100, 36], [57, 212], [212, 202], [202, 57], [20, 60], [60, 99], [99, 20], [28, 158], [158, 157], [157, 28], [35, 226], [226, 113], [113, 35], [160, 159], [159, 27], [27, 160], [204, 202], [202, 210], [210, 204], [113, 225], [225, 46], [46, 113], [43, 202], [202, 204], [204, 43], [62, 76], [76, 77], [77, 62], [137, 123], [123, 116], [116, 137], [41, 38], [38, 72], [72, 41], [203, 129], [129, 142], [142, 203], [64, 98], [98, 240], [240, 64], [49, 102], [102, 64], [64, 49], [41, 73], [73, 74], [74, 41], [212, 216], [216, 207], [207, 212], [42, 74], [74, 184], [184, 42], [169, 170], [170, 211], [211, 169], [170, 149], [149, 176], [176, 170], [105, 66], [66, 69], [69, 105], [122, 6], [6, 168], [168, 122], [123, 147], [147, 187], [187, 123], [96, 77], [77, 90], [90, 96], [65, 55], [55, 107], [107, 65], [89, 90], [90, 180], [180, 89], [101, 100], [100, 120], [120, 101], [63, 105], [105, 104], [104, 63], [93, 137], [137, 227], [227, 93], [15, 86], [86, 85], [85, 15], [129, 102], [102, 49], [49, 129], [14, 87], [87, 86], [86, 14], [55, 8], [8, 9], [9, 55], [100, 47], [47, 121], [121, 100], [145, 23], [23, 22], [22, 145], [88, 89], [89, 179], [179, 88], [6, 122], [122, 196], [196, 6], [88, 95], [95, 96], [96, 88], [138, 172], [172, 136], [136, 138], [215, 58], [58, 172], [172, 215], [115, 48], [48, 219], [219, 115], [42, 80], [80, 81], [81, 42], [195, 3], [3, 51], [51, 195], [43, 146], [146, 61], [61, 43], [171, 175], [175, 199], [199, 171], [81, 82], [82, 38], [38, 81], [53, 46], [46, 225], [225, 53], [144, 163], [163, 110], [110, 144], [52, 65], [65, 66], [66, 52], [229, 228], [228, 117], [117, 229], [34, 127], [127, 234], [234, 34], [107, 108], [108, 69], [69, 107], [109, 108], [108, 151], [151, 109], [48, 64], [64, 235], [235, 48], [62, 78], [78, 191], [191, 62], [129, 209], [209, 126], [126, 129], [111, 35], [35, 143], [143, 111], [117, 123], [123, 50], [50, 117], [222, 65], [65, 52], [52, 222], [19, 125], [125, 141], [141, 19], [221, 55], [55, 65], [65, 221], [3, 195], [195, 197], [197, 3], [25, 7], [7, 33], [33, 25], [220, 237], [237, 44], [44, 220], [70, 71], [71, 139], [139, 70], [122, 193], [193, 245], [245, 122], [247, 130], [130, 33], [33, 247], [71, 21], [21, 162], [162, 71], [170, 169], [169, 150], [150, 170], [188, 174], [174, 196], [196, 188], [216, 186], [186, 92], [92, 216], [2, 97], [97, 167], [167, 2], [141, 125], [125, 241], [241, 141], [164, 167], [167, 37], [37, 164], [72, 38], [38, 12], [12, 72], [38, 82], [82, 13], [13, 38], [63, 68], [68, 71], [71, 63], [226, 35], [35, 111], [111, 226], [101, 50], [50, 205], [205, 101], [206, 92], [92, 165], [165, 206], [209, 198], [198, 217], [217, 209], [165, 167], [167, 97], [97, 165], [220, 115], [115, 218], [218, 220], [133, 112], [112, 243], [243, 133], [239, 238], [238, 241], [241, 239], [214, 135], [135, 169], [169, 214], [190, 173], [173, 133], [133, 190], [171, 208], [208, 32], [32, 171], [125, 44], [44, 237], [237, 125], [86, 87], [87, 178], [178, 86], [85, 86], [86, 179], [179, 85], [84, 85], [85, 180], [180, 84], [83, 84], [84, 181], [181, 83], [201, 83], [83, 182], [182, 201], [137, 93], [93, 132], [132, 137], [76, 62], [62, 183], [183, 76], [61, 76], [76, 184], [184, 61], [57, 61], [61, 185], [185, 57], [212, 57], [57, 186], [186, 212], [214, 207], [207, 187], [187, 214], [34, 143], [143, 156], [156, 34], [79, 239], [239, 237], [237, 79], [123, 137], [137, 177], [177, 123], [44, 1], [1, 4], [4, 44], [201, 194], [194, 32], [32, 201], [64, 102], [102, 129], [129, 64], [213, 215], [215, 138], [138, 213], [59, 166], [166, 219], [219, 59], [242, 99], [99, 97], [97, 242], [2, 94], [94, 141], [141, 2], [75, 59], [59, 235], [235, 75], [24, 110], [110, 228], [228, 24], [25, 130], [130, 226], [226, 25], [23, 24], [24, 229], [229, 23], [22, 23], [23, 230], [230, 22], [26, 22], [22, 231], [231, 26], [112, 26], [26, 232], [232, 112], [189, 190], [190, 243], [243, 189], [221, 56], [56, 190], [190, 221], [28, 56], [56, 221], [221, 28], [27, 28], [28, 222], [222, 27], [29, 27], [27, 223], [223, 29], [30, 29], [29, 224], [224, 30], [247, 30], [30, 225], [225, 247], [238, 79], [79, 20], [20, 238], [166, 59], [59, 75], [75, 166], [60, 75], [75, 240], [240, 60], [147, 177], [177, 215], [215, 147], [20, 79], [79, 166], [166, 20], [187, 147], [147, 213], [213, 187], [112, 233], [233, 244], [244, 112], [233, 128], [128, 245], [245, 233], [128, 114], [114, 188], [188, 128], [114, 217], [217, 174], [174, 114], [131, 115], [115, 220], [220, 131], [217, 198], [198, 236], [236, 217], [198, 131], [131, 134], [134, 198], [177, 132], [132, 58], [58, 177], [143, 35], [35, 124], [124, 143], [110, 163], [163, 7], [7, 110], [228, 110], [110, 25], [25, 228], [356, 389], [389, 368], [368, 356], [11, 302], [302, 267], [267, 11], [452, 350], [350, 349], [349, 452], [302, 303], [303, 269], [269, 302], [357, 343], [343, 277], [277, 357], [452, 453], [453, 357], [357, 452], [333, 332], [332, 297], [297, 333], [175, 152], [152, 377], [377, 175], [347, 348], [348, 330], [330, 347], [303, 304], [304, 270], [270, 303], [9, 336], [336, 337], [337, 9], [278, 279], [279, 360], [360, 278], [418, 262], [262, 431], [431, 418], [304, 408], [408, 409], [409, 304], [310, 415], [415, 407], [407, 310], [270, 409], [409, 410], [410, 270], [450, 348], [348, 347], [347, 450], [422, 430], [430, 434], [434, 422], [313, 314], [314, 17], [17, 313], [306, 307], [307, 375], [375, 306], [387, 388], [388, 260], [260, 387], [286, 414], [414, 398], [398, 286], [335, 406], [406, 418], [418, 335], [364, 367], [367, 416], [416, 364], [423, 358], [358, 327], [327, 423], [251, 284], [284, 298], [298, 251], [281, 5], [5, 4], [4, 281], [373, 374], [374, 253], [253, 373], [307, 320], [320, 321], [321, 307], [425, 427], [427, 411], [411, 425], [421, 313], [313, 18], [18, 421], [321, 405], [405, 406], [406, 321], [320, 404], [404, 405], [405, 320], [315, 16], [16, 17], [17, 315], [426, 425], [425, 266], [266, 426], [377, 400], [400, 369], [369, 377], [322, 391], [391, 269], [269, 322], [417, 465], [465, 464], [464, 417], [386, 257], [257, 258], [258, 386], [466, 260], [260, 388], [388, 466], [456, 399], [399, 419], [419, 456], [284, 332], [332, 333], [333, 284], [417, 285], [285, 8], [8, 417], [346, 340], [340, 261], [261, 346], [413, 441], [441, 285], [285, 413], [327, 460], [460, 328], [328, 327], [355, 371], [371, 329], [329, 355], [392, 439], [439, 438], [438, 392], [382, 341], [341, 256], [256, 382], [429, 420], [420, 360], [360, 429], [364, 394], [394, 379], [379, 364], [277, 343], [343, 437], [437, 277], [443, 444], [444, 283], [283, 443], [275, 440], [440, 363], [363, 275], [431, 262], [262, 369], [369, 431], [297, 338], [338, 337], [337, 297], [273, 375], [375, 321], [321, 273], [450, 451], [451, 349], [349, 450], [446, 342], [342, 467], [467, 446], [293, 334], [334, 282], [282, 293], [458, 461], [461, 462], [462, 458], [276, 353], [353, 383], [383, 276], [308, 324], [324, 325], [325, 308], [276, 300], [300, 293], [293, 276], [372, 345], [345, 447], [447, 372], [352, 345], [345, 340], [340, 352], [274, 1], [1, 19], [19, 274], [456, 248], [248, 281], [281, 456], [436, 427], [427, 425], [425, 436], [381, 256], [256, 252], [252, 381], [269, 391], [391, 393], [393, 269], [200, 199], [199, 428], [428, 200], [266, 330], [330, 329], [329, 266], [287, 273], [273, 422], [422, 287], [250, 462], [462, 328], [328, 250], [258, 286], [286, 384], [384, 258], [265, 353], [353, 342], [342, 265], [387, 259], [259, 257], [257, 387], [424, 431], [431, 430], [430, 424], [342, 353], [353, 276], [276, 342], [273, 335], [335, 424], [424, 273], [292, 325], [325, 307], [307, 292], [366, 447], [447, 345], [345, 366], [271, 303], [303, 302], [302, 271], [423, 266], [266, 371], [371, 423], [294, 455], [455, 460], [460, 294], [279, 278], [278, 294], [294, 279], [271, 272], [272, 304], [304, 271], [432, 434], [434, 427], [427, 432], [272, 407], [407, 408], [408, 272], [394, 430], [430, 431], [431, 394], [395, 369], [369, 400], [400, 395], [334, 333], [333, 299], [299, 334], [351, 417], [417, 168], [168, 351], [352, 280], [280, 411], [411, 352], [325, 319], [319, 320], [320, 325], [295, 296], [296, 336], [336, 295], [319, 403], [403, 404], [404, 319], [330, 348], [348, 349], [349, 330], [293, 298], [298, 333], [333, 293], [323, 454], [454, 447], [447, 323], [15, 16], [16, 315], [315, 15], [358, 429], [429, 279], [279, 358], [14, 15], [15, 316], [316, 14], [285, 336], [336, 9], [9, 285], [329, 349], [349, 350], [350, 329], [374, 380], [380, 252], [252, 374], [318, 402], [402, 403], [403, 318], [6, 197], [197, 419], [419, 6], [318, 319], [319, 325], [325, 318], [367, 364], [364, 365], [365, 367], [435, 367], [367, 397], [397, 435], [344, 438], [438, 439], [439, 344], [272, 271], [271, 311], [311, 272], [195, 5], [5, 281], [281, 195], [273, 287], [287, 291], [291, 273], [396, 428], [428, 199], [199, 396], [311, 271], [271, 268], [268, 311], [283, 444], [444, 445], [445, 283], [373, 254], [254, 339], [339, 373], [282, 334], [334, 296], [296, 282], [449, 347], [347, 346], [346, 449], [264, 447], [447, 454], [454, 264], [336, 296], [296, 299], [299, 336], [338, 10], [10, 151], [151, 338], [278, 439], [439, 455], [455, 278], [292, 407], [407, 415], [415, 292], [358, 371], [371, 355], [355, 358], [340, 345], [345, 372], [372, 340], [346, 347], [347, 280], [280, 346], [442, 443], [443, 282], [282, 442], [19, 94], [94, 370], [370, 19], [441, 442], [442, 295], [295, 441], [248, 419], [419, 197], [197, 248], [263, 255], [255, 359], [359, 263], [440, 275], [275, 274], [274, 440], [300, 383], [383, 368], [368, 300], [351, 412], [412, 465], [465, 351], [263, 467], [467, 466], [466, 263], [301, 368], [368, 389], [389, 301], [395, 378], [378, 379], [379, 395], [412, 351], [351, 419], [419, 412], [436, 426], [426, 322], [322, 436], [2, 164], [164, 393], [393, 2], [370, 462], [462, 461], [461, 370], [164, 0], [0, 267], [267, 164], [302, 11], [11, 12], [12, 302], [268, 12], [12, 13], [13, 268], [293, 300], [300, 301], [301, 293], [446, 261], [261, 340], [340, 446], [330, 266], [266, 425], [425, 330], [426, 423], [423, 391], [391, 426], [429, 355], [355, 437], [437, 429], [391, 327], [327, 326], [326, 391], [440, 457], [457, 438], [438, 440], [341, 382], [382, 362], [362, 341], [459, 457], [457, 461], [461, 459], [434, 430], [430, 394], [394, 434], [414, 463], [463, 362], [362, 414], [396, 369], [369, 262], [262, 396], [354, 461], [461, 457], [457, 354], [316, 403], [403, 402], [402, 316], [315, 404], [404, 403], [403, 315], [314, 405], [405, 404], [404, 314], [313, 406], [406, 405], [405, 313], [421, 418], [418, 406], [406, 421], [366, 401], [401, 361], [361, 366], [306, 408], [408, 407], [407, 306], [291, 409], [409, 408], [408, 291], [287, 410], [410, 409], [409, 287], [432, 436], [436, 410], [410, 432], [434, 416], [416, 411], [411, 434], [264, 368], [368, 383], [383, 264], [309, 438], [438, 457], [457, 309], [352, 376], [376, 401], [401, 352], [274, 275], [275, 4], [4, 274], [421, 428], [428, 262], [262, 421], [294, 327], [327, 358], [358, 294], [433, 416], [416, 367], [367, 433], [289, 455], [455, 439], [439, 289], [462, 370], [370, 326], [326, 462], [2, 326], [326, 370], [370, 2], [305, 460], [460, 455], [455, 305], [254, 449], [449, 448], [448, 254], [255, 261], [261, 446], [446, 255], [253, 450], [450, 449], [449, 253], [252, 451], [451, 450], [450, 252], [256, 452], [452, 451], [451, 256], [341, 453], [453, 452], [452, 341], [413, 464], [464, 463], [463, 413], [441, 413], [413, 414], [414, 441], [258, 442], [442, 441], [441, 258], [257, 443], [443, 442], [442, 257], [259, 444], [444, 443], [443, 259], [260, 445], [445, 444], [444, 260], [467, 342], [342, 445], [445, 467], [459, 458], [458, 250], [250, 459], [289, 392], [392, 290], [290, 289], [290, 328], [328, 460], [460, 290], [376, 433], [433, 435], [435, 376], [250, 290], [290, 392], [392, 250], [411, 416], [416, 433], [433, 411], [341, 463], [463, 464], [464, 341], [453, 464], [464, 465], [465, 453], [357, 465], [465, 412], [412, 357], [343, 412], [412, 399], [399, 343], [360, 363], [363, 440], [440, 360], [437, 399], [399, 456], [456, 437], [420, 456], [456, 363], [363, 420], [401, 435], [435, 288], [288, 401], [372, 383], [383, 353], [353, 372], [339, 255], [255, 249], [249, 339], [448, 261], [261, 255], [255, 448], [133, 243], [243, 190], [190, 133], [133, 155], [155, 112], [112, 133], [33, 246], [246, 247], [247, 33], [33, 130], [130, 25], [25, 33], [398, 384], [384, 286], [286, 398], [362, 398], [398, 414], [414, 362], [362, 463], [463, 341], [341, 362], [263, 359], [359, 467], [467, 263], [263, 249], [249, 255], [255, 263], [466, 467], [467, 260], [260, 466], [75, 60], [60, 166], [166, 75], [238, 239], [239, 79], [79, 238], [162, 127], [127, 139], [139, 162], [72, 11], [11, 37], [37, 72], [121, 232], [232, 120], [120, 121], [73, 72], [72, 39], [39, 73], [114, 128], [128, 47], [47, 114], [233, 232], [232, 128], [128, 233], [103, 104], [104, 67], [67, 103], [152, 175], [175, 148], [148, 152], [119, 118], [118, 101], [101, 119], [74, 73], [73, 40], [40, 74], [107, 9], [9, 108], [108, 107], [49, 48], [48, 131], [131, 49], [32, 194], [194, 211], [211, 32], [184, 74], [74, 185], [185, 184], [191, 80], [80, 183], [183, 191], [185, 40], [40, 186], [186, 185], [119, 230], [230, 118], [118, 119], [210, 202], [202, 214], [214, 210], [84, 83], [83, 17], [17, 84], [77, 76], [76, 146], [146, 77], [161, 160], [160, 30], [30, 161], [190, 56], [56, 173], [173, 190], [182, 106], [106, 194], [194, 182], [138, 135], [135, 192], [192, 138], [129, 203], [203, 98], [98, 129], [54, 21], [21, 68], [68, 54], [5, 51], [51, 4], [4, 5], [145, 144], [144, 23], [23, 145], [90, 77], [77, 91], [91, 90], [207, 205], [205, 187], [187, 207], [83, 201], [201, 18], [18, 83], [181, 91], [91, 182], [182, 181], [180, 90], [90, 181], [181, 180], [16, 85], [85, 17], [17, 16], [205, 206], [206, 36], [36, 205], [176, 148], [148, 140], [140, 176], [165, 92], [92, 39], [39, 165], [245, 193], [193, 244], [244, 245], [27, 159], [159, 28], [28, 27], [30, 247], [247, 161], [161, 30], [174, 236], [236, 196], [196, 174], [103, 54], [54, 104], [104, 103], [55, 193], [193, 8], [8, 55], [111, 117], [117, 31], [31, 111], [221, 189], [189, 55], [55, 221], [240, 98], [98, 99], [99, 240], [142, 126], [126, 100], [100, 142], [219, 166], [166, 218], [218, 219], [112, 155], [155, 26], [26, 112], [198, 209], [209, 131], [131, 198], [169, 135], [135, 150], [150, 169], [114, 47], [47, 217], [217, 114], [224, 223], [223, 53], [53, 224], [220, 45], [45, 134], [134, 220], [32, 211], [211, 140], [140, 32], [109, 67], [67, 108], [108, 109], [146, 43], [43, 91], [91, 146], [231, 230], [230, 120], [120, 231], [113, 226], [226, 247], [247, 113], [105, 63], [63, 52], [52, 105], [241, 238], [238, 242], [242, 241], [124, 46], [46, 156], [156, 124], [95, 78], [78, 96], [96, 95], [70, 46], [46, 63], [63, 70], [116, 143], [143, 227], [227, 116], [116, 123], [123, 111], [111, 116], [1, 44], [44, 19], [19, 1], [3, 236], [236, 51], [51, 3], [207, 216], [216, 205], [205, 207], [26, 154], [154, 22], [22, 26], [165, 39], [39, 167], [167, 165], [199, 200], [200, 208], [208, 199], [101, 36], [36, 100], [100, 101], [43, 57], [57, 202], [202, 43], [242, 20], [20, 99], [99, 242], [56, 28], [28, 157], [157, 56], [124, 35], [35, 113], [113, 124], [29, 160], [160, 27], [27, 29], [211, 204], [204, 210], [210, 211], [124, 113], [113, 46], [46, 124], [106, 43], [43, 204], [204, 106], [96, 62], [62, 77], [77, 96], [227, 137], [137, 116], [116, 227], [73, 41], [41, 72], [72, 73], [36, 203], [203, 142], [142, 36], [235, 64], [64, 240], [240, 235], [48, 49], [49, 64], [64, 48], [42, 41], [41, 74], [74, 42], [214, 212], [212, 207], [207, 214], [183, 42], [42, 184], [184, 183], [210, 169], [169, 211], [211, 210], [140, 170], [170, 176], [176, 140], [104, 105], [105, 69], [69, 104], [193, 122], [122, 168], [168, 193], [50, 123], [123, 187], [187, 50], [89, 96], [96, 90], [90, 89], [66, 65], [65, 107], [107, 66], [179, 89], [89, 180], [180, 179], [119, 101], [101, 120], [120, 119], [68, 63], [63, 104], [104, 68], [234, 93], [93, 227], [227, 234], [16, 15], [15, 85], [85, 16], [209, 129], [129, 49], [49, 209], [15, 14], [14, 86], [86, 15], [107, 55], [55, 9], [9, 107], [120, 100], [100, 121], [121, 120], [153, 145], [145, 22], [22, 153], [178, 88], [88, 179], [179, 178], [197, 6], [6, 196], [196, 197], [89, 88], [88, 96], [96, 89], [135, 138], [138, 136], [136, 135], [138, 215], [215, 172], [172, 138], [218, 115], [115, 219], [219, 218], [41, 42], [42, 81], [81, 41], [5, 195], [195, 51], [51, 5], [57, 43], [43, 61], [61, 57], [208, 171], [171, 199], [199, 208], [41, 81], [81, 38], [38, 41], [224, 53], [53, 225], [225, 224], [24, 144], [144, 110], [110, 24], [105, 52], [52, 66], [66, 105], [118, 229], [229, 117], [117, 118], [227, 34], [34, 234], [234, 227], [66, 107], [107, 69], [69, 66], [10, 109], [109, 151], [151, 10], [219, 48], [48, 235], [235, 219], [183, 62], [62, 191], [191, 183], [142, 129], [129, 126], [126, 142], [116, 111], [111, 143], [143, 116], [118, 117], [117, 50], [50, 118], [223, 222], [222, 52], [52, 223], [94, 19], [19, 141], [141, 94], [222, 221], [221, 65], [65, 222], [196, 3], [3, 197], [197, 196], [45, 220], [220, 44], [44, 45], [156, 70], [70, 139], [139, 156], [188, 122], [122, 245], [245, 188], [139, 71], [71, 162], [162, 139], [149, 170], [170, 150], [150, 149], [122, 188], [188, 196], [196, 122], [206, 216], [216, 92], [92, 206], [164, 2], [2, 167], [167, 164], [242, 141], [141, 241], [241, 242], [0, 164], [164, 37], [37, 0], [11, 72], [72, 12], [12, 11], [12, 38], [38, 13], [13, 12], [70, 63], [63, 71], [71, 70], [31, 226], [226, 111], [111, 31], [36, 101], [101, 205], [205, 36], [203, 206], [206, 165], [165, 203], [126, 209], [209, 217], [217, 126], [98, 165], [165, 97], [97, 98], [237, 220], [220, 218], [218, 237], [237, 239], [239, 241], [241, 237], [210, 214], [214, 169], [169, 210], [140, 171], [171, 32], [32, 140], [241, 125], [125, 237], [237, 241], [179, 86], [86, 178], [178, 179], [180, 85], [85, 179], [179, 180], [181, 84], [84, 180], [180, 181], [182, 83], [83, 181], [181, 182], [194, 201], [201, 182], [182, 194], [177, 137], [137, 132], [132, 177], [184, 76], [76, 183], [183, 184], [185, 61], [61, 184], [184, 185], [186, 57], [57, 185], [185, 186], [216, 212], [212, 186], [186, 216], [192, 214], [214, 187], [187, 192], [139, 34], [34, 156], [156, 139], [218, 79], [79, 237], [237, 218], [147, 123], [123, 177], [177, 147], [45, 44], [44, 4], [4, 45], [208, 201], [201, 32], [32, 208], [98, 64], [64, 129], [129, 98], [192, 213], [213, 138], [138, 192], [235, 59], [59, 219], [219, 235], [141, 242], [242, 97], [97, 141], [97, 2], [2, 141], [141, 97], [240, 75], [75, 235], [235, 240], [229, 24], [24, 228], [228, 229], [31, 25], [25, 226], [226, 31], [230, 23], [23, 229], [229, 230], [231, 22], [22, 230], [230, 231], [232, 26], [26, 231], [231, 232], [233, 112], [112, 232], [232, 233], [244, 189], [189, 243], [243, 244], [189, 221], [221, 190], [190, 189], [222, 28], [28, 221], [221, 222], [223, 27], [27, 222], [222, 223], [224, 29], [29, 223], [223, 224], [225, 30], [30, 224], [224, 225], [113, 247], [247, 225], [225, 113], [99, 60], [60, 240], [240, 99], [213, 147], [147, 215], [215, 213], [60, 20], [20, 166], [166, 60], [192, 187], [187, 213], [213, 192], [243, 112], [112, 244], [244, 243], [244, 233], [233, 245], [245, 244], [245, 128], [128, 188], [188, 245], [188, 114], [114, 174], [174, 188], [134, 131], [131, 220], [220, 134], [174, 217], [217, 236], [236, 174], [236, 198], [198, 134], [134, 236], [215, 177], [177, 58], [58, 215], [156, 143], [143, 124], [124, 156], [25, 110], [110, 7], [7, 25], [31, 228], [228, 25], [25, 31], [264, 356], [356, 368], [368, 264], [0, 11], [11, 267], [267, 0], [451, 452], [452, 349], [349, 451], [267, 302], [302, 269], [269, 267], [350, 357], [357, 277], [277, 350], [350, 452], [452, 357], [357, 350], [299, 333], [333, 297], [297, 299], [396, 175], [175, 377], [377, 396], [280, 347], [347, 330], [330, 280], [269, 303], [303, 270], [270, 269], [151, 9], [9, 337], [337, 151], [344, 278], [278, 360], [360, 344], [424, 418], [418, 431], [431, 424], [270, 304], [304, 409], [409, 270], [272, 310], [310, 407], [407, 272], [322, 270], [270, 410], [410, 322], [449, 450], [450, 347], [347, 449], [432, 422], [422, 434], [434, 432], [18, 313], [313, 17], [17, 18], [291, 306], [306, 375], [375, 291], [259, 387], [387, 260], [260, 259], [424, 335], [335, 418], [418, 424], [434, 364], [364, 416], [416, 434], [391, 423], [423, 327], [327, 391], [301, 251], [251, 298], [298, 301], [275, 281], [281, 4], [4, 275], [254, 373], [373, 253], [253, 254], [375, 307], [307, 321], [321, 375], [280, 425], [425, 411], [411, 280], [200, 421], [421, 18], [18, 200], [335, 321], [321, 406], [406, 335], [321, 320], [320, 405], [405, 321], [314, 315], [315, 17], [17, 314], [423, 426], [426, 266], [266, 423], [396, 377], [377, 369], [369, 396], [270, 322], [322, 269], [269, 270], [413, 417], [417, 464], [464, 413], [385, 386], [386, 258], [258, 385], [248, 456], [456, 419], [419, 248], [298, 284], [284, 333], [333, 298], [168, 417], [417, 8], [8, 168], [448, 346], [346, 261], [261, 448], [417, 413], [413, 285], [285, 417], [326, 327], [327, 328], [328, 326], [277, 355], [355, 329], [329, 277], [309, 392], [392, 438], [438, 309], [381, 382], [382, 256], [256, 381], [279, 429], [429, 360], [360, 279], [365, 364], [364, 379], [379, 365], [355, 277], [277, 437], [437, 355], [282, 443], [443, 283], [283, 282], [281, 275], [275, 363], [363, 281], [395, 431], [431, 369], [369, 395], [299, 297], [297, 337], [337, 299], [335, 273], [273, 321], [321, 335], [348, 450], [450, 349], [349, 348], [359, 446], [446, 467], [467, 359], [283, 293], [293, 282], [282, 283], [250, 458], [458, 462], [462, 250], [300, 276], [276, 383], [383, 300], [292, 308], [308, 325], [325, 292], [283, 276], [276, 293], [293, 283], [264, 372], [372, 447], [447, 264], [346, 352], [352, 340], [340, 346], [354, 274], [274, 19], [19, 354], [363, 456], [456, 281], [281, 363], [426, 436], [436, 425], [425, 426], [380, 381], [381, 252], [252, 380], [267, 269], [269, 393], [393, 267], [421, 200], [200, 428], [428, 421], [371, 266], [266, 329], [329, 371], [432, 287], [287, 422], [422, 432], [290, 250], [250, 328], [328, 290], [385, 258], [258, 384], [384, 385], [446, 265], [265, 342], [342, 446], [386, 387], [387, 257], [257, 386], [422, 424], [424, 430], [430, 422], [445, 342], [342, 276], [276, 445], [422, 273], [273, 424], [424, 422], [306, 292], [292, 307], [307, 306], [352, 366], [366, 345], [345, 352], [268, 271], [271, 302], [302, 268], [358, 423], [423, 371], [371, 358], [327, 294], [294, 460], [460, 327], [331, 279], [279, 294], [294, 331], [303, 271], [271, 304], [304, 303], [436, 432], [432, 427], [427, 436], [304, 272], [272, 408], [408, 304], [395, 394], [394, 431], [431, 395], [378, 395], [395, 400], [400, 378], [296, 334], [334, 299], [299, 296], [6, 351], [351, 168], [168, 6], [376, 352], [352, 411], [411, 376], [307, 325], [325, 320], [320, 307], [285, 295], [295, 336], [336, 285], [320, 319], [319, 404], [404, 320], [329, 330], [330, 349], [349, 329], [334, 293], [293, 333], [333, 334], [366, 323], [323, 447], [447, 366], [316, 15], [15, 315], [315, 316], [331, 358], [358, 279], [279, 331], [317, 14], [14, 316], [316, 317], [8, 285], [285, 9], [9, 8], [277, 329], [329, 350], [350, 277], [253, 374], [374, 252], [252, 253], [319, 318], [318, 403], [403, 319], [351, 6], [6, 419], [419, 351], [324, 318], [318, 325], [325, 324], [397, 367], [367, 365], [365, 397], [288, 435], [435, 397], [397, 288], [278, 344], [344, 439], [439, 278], [310, 272], [272, 311], [311, 310], [248, 195], [195, 281], [281, 248], [375, 273], [273, 291], [291, 375], [175, 396], [396, 199], [199, 175], [312, 311], [311, 268], [268, 312], [276, 283], [283, 445], [445, 276], [390, 373], [373, 339], [339, 390], [295, 282], [282, 296], [296, 295], [448, 449], [449, 346], [346, 448], [356, 264], [264, 454], [454, 356], [337, 336], [336, 299], [299, 337], [337, 338], [338, 151], [151, 337], [294, 278], [278, 455], [455, 294], [308, 292], [292, 415], [415, 308], [429, 358], [358, 355], [355, 429], [265, 340], [340, 372], [372, 265], [352, 346], [346, 280], [280, 352], [295, 442], [442, 282], [282, 295], [354, 19], [19, 370], [370, 354], [285, 441], [441, 295], [295, 285], [195, 248], [248, 197], [197, 195], [457, 440], [440, 274], [274, 457], [301, 300], [300, 368], [368, 301], [417, 351], [351, 465], [465, 417], [251, 301], [301, 389], [389, 251], [394, 395], [395, 379], [379, 394], [399, 412], [412, 419], [419, 399], [410, 436], [436, 322], [322, 410], [326, 2], [2, 393], [393, 326], [354, 370], [370, 461], [461, 354], [393, 164], [164, 267], [267, 393], [268, 302], [302, 12], [12, 268], [312, 268], [268, 13], [13, 312], [298, 293], [293, 301], [301, 298], [265, 446], [446, 340], [340, 265], [280, 330], [330, 425], [425, 280], [322, 426], [426, 391], [391, 322], [420, 429], [429, 437], [437, 420], [393, 391], [391, 326], [326, 393], [344, 440], [440, 438], [438, 344], [458, 459], [459, 461], [461, 458], [364, 434], [434, 394], [394, 364], [428, 396], [396, 262], [262, 428], [274, 354], [354, 457], [457, 274], [317, 316], [316, 402], [402, 317], [316, 315], [315, 403], [403, 316], [315, 314], [314, 404], [404, 315], [314, 313], [313, 405], [405, 314], [313, 421], [421, 406], [406, 313], [323, 366], [366, 361], [361, 323], [292, 306], [306, 407], [407, 292], [306, 291], [291, 408], [408, 306], [291, 287], [287, 409], [409, 291], [287, 432], [432, 410], [410, 287], [427, 434], [434, 411], [411, 427], [372, 264], [264, 383], [383, 372], [459, 309], [309, 457], [457, 459], [366, 352], [352, 401], [401, 366], [1, 274], [274, 4], [4, 1], [418, 421], [421, 262], [262, 418], [331, 294], [294, 358], [358, 331], [435, 433], [433, 367], [367, 435], [392, 289], [289, 439], [439, 392], [328, 462], [462, 326], [326, 328], [94, 2], [2, 370], [370, 94], [289, 305], [305, 455], [455, 289], [339, 254], [254, 448], [448, 339], [359, 255], [255, 446], [446, 359], [254, 253], [253, 449], [449, 254], [253, 252], [252, 450], [450, 253], [252, 256], [256, 451], [451, 252], [256, 341], [341, 452], [452, 256], [414, 413], [413, 463], [463, 414], [286, 441], [441, 414], [414, 286], [286, 258], [258, 441], [441, 286], [258, 257], [257, 442], [442, 258], [257, 259], [259, 443], [443, 257], [259, 260], [260, 444], [444, 259], [260, 467], [467, 445], [445, 260], [309, 459], [459, 250], [250, 309], [305, 289], [289, 290], [290, 305], [305, 290], [290, 460], [460, 305], [401, 376], [376, 435], [435, 401], [309, 250], [250, 392], [392, 309], [376, 411], [411, 433], [433, 376], [453, 341], [341, 464], [464, 453], [357, 453], [453, 465], [465, 357], [343, 357], [357, 412], [412, 343], [437, 343], [343, 399], [399, 437], [344, 360], [360, 440], [440, 344], [420, 437], [437, 456], [456, 420], [360, 420], [420, 363], [363, 360], [361, 401], [401, 288], [288, 361], [265, 372], [372, 353], [353, 265], [390, 339], [339, 249], [249, 390], [339, 448], [448, 255], [255, 339]);
  function Rc(t2) {
    t2.j = { faceLandmarks: [], faceBlendshapes: [], facialTransformationMatrixes: [] };
  }
  var Ic = class extends yc {
    constructor(t2, e2) {
      super(new lc(t2, e2), "image_in", "norm_rect", false), this.j = { faceLandmarks: [], faceBlendshapes: [], facialTransformationMatrixes: [] }, this.outputFacialTransformationMatrixes = this.outputFaceBlendshapes = false, kn(t2 = this.h = new eo(), 0, 1, e2 = new Ks()), this.A = new to(), kn(this.h, 0, 3, this.A), this.u = new $s(), kn(this.h, 0, 2, this.u), Mn(this.u, 4, 1), Pn(this.u, 2, 0.5), Pn(this.A, 2, 0.5), Pn(this.h, 4, 0.5);
    }
    get baseOptions() {
      return wn(this.h, Ks, 1);
    }
    set baseOptions(t2) {
      kn(this.h, 0, 1, t2);
    }
    o(t2) {
      return "numFaces" in t2 && Mn(this.u, 4, t2.numFaces ?? 1), "minFaceDetectionConfidence" in t2 && Pn(this.u, 2, t2.minFaceDetectionConfidence ?? 0.5), "minTrackingConfidence" in t2 && Pn(this.h, 4, t2.minTrackingConfidence ?? 0.5), "minFacePresenceConfidence" in t2 && Pn(this.A, 2, t2.minFacePresenceConfidence ?? 0.5), "outputFaceBlendshapes" in t2 && (this.outputFaceBlendshapes = !!t2.outputFaceBlendshapes), "outputFacialTransformationMatrixes" in t2 && (this.outputFacialTransformationMatrixes = !!t2.outputFacialTransformationMatrixes), this.l(t2);
    }
    F(t2, e2) {
      return Rc(this), pc(this, t2, e2), this.j;
    }
    G(t2, e2, n2) {
      return Rc(this), gc(this, t2, n2, e2), this.j;
    }
    m() {
      var t2 = new gs();
      ds(t2, "image_in"), ds(t2, "norm_rect"), ps(t2, "face_landmarks");
      const e2 = new rs();
      Mr(e2, ro, this.h);
      const n2 = new cs();
      Cn(n2, 2, "mediapipe.tasks.vision.face_landmarker.FaceLandmarkerGraph"), os(n2, "IMAGE:image_in"), os(n2, "NORM_RECT:norm_rect"), as(n2, "NORM_LANDMARKS:face_landmarks"), n2.o(e2), fs(t2, n2), this.g.attachProtoVectorListener("face_landmarks", (t3, e3) => {
        for (const e4 of t3) t3 = Rs(e4), this.j.faceLandmarks.push(Yo(t3));
        pa(this, e3);
      }), this.g.attachEmptyPacketListener("face_landmarks", (t3) => {
        pa(this, t3);
      }), this.outputFaceBlendshapes && (ps(t2, "blendshapes"), as(n2, "BLENDSHAPES:blendshapes"), this.g.attachProtoVectorListener("blendshapes", (t3, e3) => {
        if (this.outputFaceBlendshapes) for (const e4 of t3) t3 = ws(e4), this.j.faceBlendshapes.push(Wo(t3.g() ?? []));
        pa(this, e3);
      }), this.g.attachEmptyPacketListener("blendshapes", (t3) => {
        pa(this, t3);
      })), this.outputFacialTransformationMatrixes && (ps(t2, "face_geometry"), as(n2, "FACE_GEOMETRY:face_geometry"), this.g.attachProtoVectorListener("face_geometry", (t3, e3) => {
        if (this.outputFacialTransformationMatrixes) for (const e4 of t3) (t3 = wn(t3 = Qs(e4), Is, 2)) && this.j.facialTransformationMatrixes.push({ rows: Rn(t3, 1) ?? 0 ?? 0, columns: Rn(t3, 2) ?? 0 ?? 0, data: on(t3, 3, Qt, sn()).slice() ?? [] });
        pa(this, e3);
      }), this.g.attachEmptyPacketListener("face_geometry", (t3) => {
        pa(this, t3);
      })), t2 = t2.g(), this.setGraph(new Uint8Array(t2), true);
    }
  };
  Ic.prototype.detectForVideo = Ic.prototype.G, Ic.prototype.detect = Ic.prototype.F, Ic.prototype.setOptions = Ic.prototype.o, Ic.createFromModelPath = function(t2, e2) {
    return fc(Ic, t2, { baseOptions: { modelAssetPath: e2 } });
  }, Ic.createFromModelBuffer = function(t2, e2) {
    return fc(Ic, t2, { baseOptions: { modelAssetBuffer: e2 } });
  }, Ic.createFromOptions = function(t2, e2) {
    return fc(Ic, t2, e2);
  }, Ic.FACE_LANDMARKS_LIPS = vc, Ic.FACE_LANDMARKS_LEFT_EYE = Ec, Ic.FACE_LANDMARKS_LEFT_EYEBROW = wc, Ic.FACE_LANDMARKS_LEFT_IRIS = Tc, Ic.FACE_LANDMARKS_RIGHT_EYE = Ac, Ic.FACE_LANDMARKS_RIGHT_EYEBROW = bc, Ic.FACE_LANDMARKS_RIGHT_IRIS = kc, Ic.FACE_LANDMARKS_FACE_OVAL = Sc, Ic.FACE_LANDMARKS_CONTOURS = xc, Ic.FACE_LANDMARKS_TESSELATION = Lc;
  var Fc = cc([0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]);
  function Mc(t2) {
    t2.gestures = [], t2.landmarks = [], t2.worldLandmarks = [], t2.handedness = [];
  }
  function Pc(t2) {
    return 0 === t2.gestures.length ? { gestures: [], landmarks: [], worldLandmarks: [], handedness: [], handednesses: [] } : { gestures: t2.gestures, landmarks: t2.landmarks, worldLandmarks: t2.worldLandmarks, handedness: t2.handedness, handednesses: t2.handedness };
  }
  function Cc(t2, e2 = true) {
    const n2 = [];
    for (const i2 of t2) {
      var r2 = ws(i2);
      t2 = [];
      for (const n3 of r2.g()) r2 = e2 && null != Rn(n3, 1) ? Rn(n3, 1) ?? 0 : -1, t2.push({ score: Fn(n3, 2) ?? 0, index: r2, categoryName: ge(tn(n3, 3)) ?? "" ?? "", displayName: ge(tn(n3, 4)) ?? "" ?? "" });
      n2.push(t2);
    }
    return n2;
  }
  var Oc = class extends yc {
    constructor(t2, e2) {
      super(new lc(t2, e2), "image_in", "norm_rect", false), this.gestures = [], this.landmarks = [], this.worldLandmarks = [], this.handedness = [], kn(t2 = this.j = new uo(), 0, 1, e2 = new Ks()), this.u = new ho(), kn(this.j, 0, 2, this.u), this.D = new co(), kn(this.u, 0, 3, this.D), this.A = new ao(), kn(this.u, 0, 2, this.A), this.h = new oo(), kn(this.j, 0, 3, this.h), Pn(this.A, 2, 0.5), Pn(this.u, 4, 0.5), Pn(this.D, 2, 0.5);
    }
    get baseOptions() {
      return wn(this.j, Ks, 1);
    }
    set baseOptions(t2) {
      kn(this.j, 0, 1, t2);
    }
    o(t2) {
      var _a2, _b, _c2, _d;
      if (Mn(this.A, 3, t2.numHands ?? 1), "minHandDetectionConfidence" in t2 && Pn(this.A, 2, t2.minHandDetectionConfidence ?? 0.5), "minTrackingConfidence" in t2 && Pn(this.u, 4, t2.minTrackingConfidence ?? 0.5), "minHandPresenceConfidence" in t2 && Pn(this.D, 2, t2.minHandPresenceConfidence ?? 0.5), t2.cannedGesturesClassifierOptions) {
        var e2 = new io(), n2 = e2, r2 = Xo(t2.cannedGesturesClassifierOptions, (_a2 = wn(this.h, io, 3)) == null ? void 0 : _a2.l());
        kn(n2, 0, 2, r2), kn(this.h, 0, 3, e2);
      } else void 0 === t2.cannedGesturesClassifierOptions && ((_b = wn(this.h, io, 3)) == null ? void 0 : _b.g());
      return t2.customGesturesClassifierOptions ? (kn(n2 = e2 = new io(), 0, 2, r2 = Xo(t2.customGesturesClassifierOptions, (_c2 = wn(this.h, io, 4)) == null ? void 0 : _c2.l())), kn(this.h, 0, 4, e2)) : void 0 === t2.customGesturesClassifierOptions && ((_d = wn(this.h, io, 4)) == null ? void 0 : _d.g()), this.l(t2);
    }
    Ha(t2, e2) {
      return Mc(this), pc(this, t2, e2), Pc(this);
    }
    Ia(t2, e2, n2) {
      return Mc(this), gc(this, t2, n2, e2), Pc(this);
    }
    m() {
      var t2 = new gs();
      ds(t2, "image_in"), ds(t2, "norm_rect"), ps(t2, "hand_gestures"), ps(t2, "hand_landmarks"), ps(t2, "world_hand_landmarks"), ps(t2, "handedness");
      const e2 = new rs();
      Mr(e2, mo, this.j);
      const n2 = new cs();
      Cn(n2, 2, "mediapipe.tasks.vision.gesture_recognizer.GestureRecognizerGraph"), os(n2, "IMAGE:image_in"), os(n2, "NORM_RECT:norm_rect"), as(n2, "HAND_GESTURES:hand_gestures"), as(n2, "LANDMARKS:hand_landmarks"), as(n2, "WORLD_LANDMARKS:world_hand_landmarks"), as(n2, "HANDEDNESS:handedness"), n2.o(e2), fs(t2, n2), this.g.attachProtoVectorListener("hand_landmarks", (t3, e3) => {
        for (const e4 of t3) {
          t3 = Rs(e4);
          const n3 = [];
          for (const e5 of An(t3, Ls, 1)) n3.push({ x: Fn(e5, 1) ?? 0, y: Fn(e5, 2) ?? 0, z: Fn(e5, 3) ?? 0, visibility: Fn(e5, 4) ?? 0 });
          this.landmarks.push(n3);
        }
        pa(this, e3);
      }), this.g.attachEmptyPacketListener("hand_landmarks", (t3) => {
        pa(this, t3);
      }), this.g.attachProtoVectorListener("world_hand_landmarks", (t3, e3) => {
        for (const e4 of t3) {
          t3 = xs(e4);
          const n3 = [];
          for (const e5 of An(t3, Ss, 1)) n3.push({ x: Fn(e5, 1) ?? 0, y: Fn(e5, 2) ?? 0, z: Fn(e5, 3) ?? 0, visibility: Fn(e5, 4) ?? 0 });
          this.worldLandmarks.push(n3);
        }
        pa(this, e3);
      }), this.g.attachEmptyPacketListener("world_hand_landmarks", (t3) => {
        pa(this, t3);
      }), this.g.attachProtoVectorListener("hand_gestures", (t3, e3) => {
        this.gestures.push(...Cc(t3, false)), pa(this, e3);
      }), this.g.attachEmptyPacketListener("hand_gestures", (t3) => {
        pa(this, t3);
      }), this.g.attachProtoVectorListener("handedness", (t3, e3) => {
        this.handedness.push(...Cc(t3)), pa(this, e3);
      }), this.g.attachEmptyPacketListener("handedness", (t3) => {
        pa(this, t3);
      }), t2 = t2.g(), this.setGraph(new Uint8Array(t2), true);
    }
  };
  function Nc(t2) {
    return { landmarks: t2.landmarks, worldLandmarks: t2.worldLandmarks, handednesses: t2.handedness, handedness: t2.handedness };
  }
  Oc.prototype.recognizeForVideo = Oc.prototype.Ia, Oc.prototype.recognize = Oc.prototype.Ha, Oc.prototype.setOptions = Oc.prototype.o, Oc.createFromModelPath = function(t2, e2) {
    return fc(Oc, t2, { baseOptions: { modelAssetPath: e2 } });
  }, Oc.createFromModelBuffer = function(t2, e2) {
    return fc(Oc, t2, { baseOptions: { modelAssetBuffer: e2 } });
  }, Oc.createFromOptions = function(t2, e2) {
    return fc(Oc, t2, e2);
  }, Oc.HAND_CONNECTIONS = Fc;
  var Uc = class extends yc {
    constructor(t2, e2) {
      super(new lc(t2, e2), "image_in", "norm_rect", false), this.landmarks = [], this.worldLandmarks = [], this.handedness = [], kn(t2 = this.h = new ho(), 0, 1, e2 = new Ks()), this.u = new co(), kn(this.h, 0, 3, this.u), this.j = new ao(), kn(this.h, 0, 2, this.j), Mn(this.j, 3, 1), Pn(this.j, 2, 0.5), Pn(this.u, 2, 0.5), Pn(this.h, 4, 0.5);
    }
    get baseOptions() {
      return wn(this.h, Ks, 1);
    }
    set baseOptions(t2) {
      kn(this.h, 0, 1, t2);
    }
    o(t2) {
      return "numHands" in t2 && Mn(this.j, 3, t2.numHands ?? 1), "minHandDetectionConfidence" in t2 && Pn(this.j, 2, t2.minHandDetectionConfidence ?? 0.5), "minTrackingConfidence" in t2 && Pn(this.h, 4, t2.minTrackingConfidence ?? 0.5), "minHandPresenceConfidence" in t2 && Pn(this.u, 2, t2.minHandPresenceConfidence ?? 0.5), this.l(t2);
    }
    F(t2, e2) {
      return this.landmarks = [], this.worldLandmarks = [], this.handedness = [], pc(this, t2, e2), Nc(this);
    }
    G(t2, e2, n2) {
      return this.landmarks = [], this.worldLandmarks = [], this.handedness = [], gc(this, t2, n2, e2), Nc(this);
    }
    m() {
      var t2 = new gs();
      ds(t2, "image_in"), ds(t2, "norm_rect"), ps(t2, "hand_landmarks"), ps(t2, "world_hand_landmarks"), ps(t2, "handedness");
      const e2 = new rs();
      Mr(e2, yo, this.h);
      const n2 = new cs();
      Cn(n2, 2, "mediapipe.tasks.vision.hand_landmarker.HandLandmarkerGraph"), os(n2, "IMAGE:image_in"), os(n2, "NORM_RECT:norm_rect"), as(n2, "LANDMARKS:hand_landmarks"), as(n2, "WORLD_LANDMARKS:world_hand_landmarks"), as(n2, "HANDEDNESS:handedness"), n2.o(e2), fs(t2, n2), this.g.attachProtoVectorListener("hand_landmarks", (t3, e3) => {
        for (const e4 of t3) t3 = Rs(e4), this.landmarks.push(Yo(t3));
        pa(this, e3);
      }), this.g.attachEmptyPacketListener("hand_landmarks", (t3) => {
        pa(this, t3);
      }), this.g.attachProtoVectorListener("world_hand_landmarks", (t3, e3) => {
        for (const e4 of t3) t3 = xs(e4), this.worldLandmarks.push(qo(t3));
        pa(this, e3);
      }), this.g.attachEmptyPacketListener("world_hand_landmarks", (t3) => {
        pa(this, t3);
      }), this.g.attachProtoVectorListener("handedness", (t3, e3) => {
        var n3 = this.handedness, r2 = n3.push;
        const i2 = [];
        for (const e4 of t3) {
          t3 = ws(e4);
          const n4 = [];
          for (const e5 of t3.g()) n4.push({ score: Fn(e5, 2) ?? 0, index: Rn(e5, 1) ?? 0 ?? -1, categoryName: ge(tn(e5, 3)) ?? "" ?? "", displayName: ge(tn(e5, 4)) ?? "" ?? "" });
          i2.push(n4);
        }
        r2.call(n3, ...i2), pa(this, e3);
      }), this.g.attachEmptyPacketListener("handedness", (t3) => {
        pa(this, t3);
      }), t2 = t2.g(), this.setGraph(new Uint8Array(t2), true);
    }
  };
  Uc.prototype.detectForVideo = Uc.prototype.G, Uc.prototype.detect = Uc.prototype.F, Uc.prototype.setOptions = Uc.prototype.o, Uc.createFromModelPath = function(t2, e2) {
    return fc(Uc, t2, { baseOptions: { modelAssetPath: e2 } });
  }, Uc.createFromModelBuffer = function(t2, e2) {
    return fc(Uc, t2, { baseOptions: { modelAssetBuffer: e2 } });
  }, Uc.createFromOptions = function(t2, e2) {
    return fc(Uc, t2, e2);
  }, Uc.HAND_CONNECTIONS = Fc;
  var Dc = cc([0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8], [9, 10], [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19], [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20], [11, 23], [12, 24], [23, 24], [23, 25], [24, 26], [25, 27], [26, 28], [27, 29], [28, 30], [29, 31], [30, 32], [27, 31], [28, 32]);
  function Bc(t2) {
    t2.h = { faceLandmarks: [], faceBlendshapes: [], poseLandmarks: [], poseWorldLandmarks: [], poseSegmentationMasks: [], leftHandLandmarks: [], leftHandWorldLandmarks: [], rightHandLandmarks: [], rightHandWorldLandmarks: [] };
  }
  function Gc(t2) {
    try {
      if (!t2.D) return t2.h;
      t2.D(t2.h);
    } finally {
      ya(t2);
    }
  }
  function jc(t2, e2) {
    t2 = Rs(t2), e2.push(Yo(t2));
  }
  var Vc = class extends yc {
    constructor(t2, e2) {
      super(new lc(t2, e2), "input_frames_image", null, false), this.h = { faceLandmarks: [], faceBlendshapes: [], poseLandmarks: [], poseWorldLandmarks: [], poseSegmentationMasks: [], leftHandLandmarks: [], leftHandWorldLandmarks: [], rightHandLandmarks: [], rightHandWorldLandmarks: [] }, this.outputPoseSegmentationMasks = this.outputFaceBlendshapes = false, kn(t2 = this.j = new wo(), 0, 1, e2 = new Ks()), this.I = new co(), kn(this.j, 0, 2, this.I), this.W = new _o(), kn(this.j, 0, 3, this.W), this.u = new $s(), kn(this.j, 0, 4, this.u), this.O = new to(), kn(this.j, 0, 5, this.O), this.A = new vo(), kn(this.j, 0, 6, this.A), this.M = new Eo(), kn(this.j, 0, 7, this.M), Pn(this.u, 2, 0.5), Pn(this.u, 3, 0.3), Pn(this.O, 2, 0.5), Pn(this.A, 2, 0.5), Pn(this.A, 3, 0.3), Pn(this.M, 2, 0.5), Pn(this.I, 2, 0.5);
    }
    get baseOptions() {
      return wn(this.j, Ks, 1);
    }
    set baseOptions(t2) {
      kn(this.j, 0, 1, t2);
    }
    o(t2) {
      return "minFaceDetectionConfidence" in t2 && Pn(this.u, 2, t2.minFaceDetectionConfidence ?? 0.5), "minFaceSuppressionThreshold" in t2 && Pn(this.u, 3, t2.minFaceSuppressionThreshold ?? 0.3), "minFacePresenceConfidence" in t2 && Pn(this.O, 2, t2.minFacePresenceConfidence ?? 0.5), "outputFaceBlendshapes" in t2 && (this.outputFaceBlendshapes = !!t2.outputFaceBlendshapes), "minPoseDetectionConfidence" in t2 && Pn(this.A, 2, t2.minPoseDetectionConfidence ?? 0.5), "minPoseSuppressionThreshold" in t2 && Pn(this.A, 3, t2.minPoseSuppressionThreshold ?? 0.3), "minPosePresenceConfidence" in t2 && Pn(this.M, 2, t2.minPosePresenceConfidence ?? 0.5), "outputPoseSegmentationMasks" in t2 && (this.outputPoseSegmentationMasks = !!t2.outputPoseSegmentationMasks), "minHandLandmarksConfidence" in t2 && Pn(this.I, 2, t2.minHandLandmarksConfidence ?? 0.5), this.l(t2);
    }
    F(t2, e2, n2) {
      const r2 = "function" != typeof e2 ? e2 : {};
      return this.D = "function" == typeof e2 ? e2 : n2, Bc(this), pc(this, t2, r2), Gc(this);
    }
    G(t2, e2, n2, r2) {
      const i2 = "function" != typeof n2 ? n2 : {};
      return this.D = "function" == typeof n2 ? n2 : r2, Bc(this), gc(this, t2, i2, e2), Gc(this);
    }
    m() {
      var t2 = new gs();
      ds(t2, "input_frames_image"), ps(t2, "pose_landmarks"), ps(t2, "pose_world_landmarks"), ps(t2, "face_landmarks"), ps(t2, "left_hand_landmarks"), ps(t2, "left_hand_world_landmarks"), ps(t2, "right_hand_landmarks"), ps(t2, "right_hand_world_landmarks");
      const e2 = new rs(), n2 = new Xi();
      Cn(n2, 1, "type.googleapis.com/mediapipe.tasks.vision.holistic_landmarker.proto.HolisticLandmarkerGraphOptions"), function(t3, e3) {
        if (null != e3) if (Array.isArray(e3)) nn(t3, 2, Ce(e3, 0, Ne));
        else {
          if (!("string" == typeof e3 || e3 instanceof P || R(e3))) throw Error("invalid value in Any.value field: " + e3 + " expected a ByteString, a base64 encoded string, a Uint8Array or a jspb array");
          dn(t3, 2, lt(e3, false), F());
        }
      }(n2, this.j.g());
      const r2 = new cs();
      Cn(r2, 2, "mediapipe.tasks.vision.holistic_landmarker.HolisticLandmarkerGraph"), Ln(r2, 8, Xi, n2), os(r2, "IMAGE:input_frames_image"), as(r2, "POSE_LANDMARKS:pose_landmarks"), as(r2, "POSE_WORLD_LANDMARKS:pose_world_landmarks"), as(r2, "FACE_LANDMARKS:face_landmarks"), as(r2, "LEFT_HAND_LANDMARKS:left_hand_landmarks"), as(r2, "LEFT_HAND_WORLD_LANDMARKS:left_hand_world_landmarks"), as(r2, "RIGHT_HAND_LANDMARKS:right_hand_landmarks"), as(r2, "RIGHT_HAND_WORLD_LANDMARKS:right_hand_world_landmarks"), r2.o(e2), fs(t2, r2), ga(this, t2), this.g.attachProtoListener("pose_landmarks", (t3, e3) => {
        jc(t3, this.h.poseLandmarks), pa(this, e3);
      }), this.g.attachEmptyPacketListener("pose_landmarks", (t3) => {
        pa(this, t3);
      }), this.g.attachProtoListener("pose_world_landmarks", (t3, e3) => {
        var n3 = this.h.poseWorldLandmarks;
        t3 = xs(t3), n3.push(qo(t3)), pa(this, e3);
      }), this.g.attachEmptyPacketListener("pose_world_landmarks", (t3) => {
        pa(this, t3);
      }), this.outputPoseSegmentationMasks && (as(r2, "POSE_SEGMENTATION_MASK:pose_segmentation_mask"), ma(this, "pose_segmentation_mask"), this.g.Z("pose_segmentation_mask", (t3, e3) => {
        this.h.poseSegmentationMasks = [mc(this, t3, true, !this.D)], pa(this, e3);
      }), this.g.attachEmptyPacketListener("pose_segmentation_mask", (t3) => {
        this.h.poseSegmentationMasks = [], pa(this, t3);
      })), this.g.attachProtoListener("face_landmarks", (t3, e3) => {
        jc(t3, this.h.faceLandmarks), pa(this, e3);
      }), this.g.attachEmptyPacketListener("face_landmarks", (t3) => {
        pa(this, t3);
      }), this.outputFaceBlendshapes && (ps(t2, "extra_blendshapes"), as(r2, "FACE_BLENDSHAPES:extra_blendshapes"), this.g.attachProtoListener("extra_blendshapes", (t3, e3) => {
        var n3 = this.h.faceBlendshapes;
        this.outputFaceBlendshapes && (t3 = ws(t3), n3.push(Wo(t3.g() ?? []))), pa(this, e3);
      }), this.g.attachEmptyPacketListener("extra_blendshapes", (t3) => {
        pa(this, t3);
      })), this.g.attachProtoListener("left_hand_landmarks", (t3, e3) => {
        jc(t3, this.h.leftHandLandmarks), pa(this, e3);
      }), this.g.attachEmptyPacketListener("left_hand_landmarks", (t3) => {
        pa(this, t3);
      }), this.g.attachProtoListener("left_hand_world_landmarks", (t3, e3) => {
        var n3 = this.h.leftHandWorldLandmarks;
        t3 = xs(t3), n3.push(qo(t3)), pa(this, e3);
      }), this.g.attachEmptyPacketListener("left_hand_world_landmarks", (t3) => {
        pa(this, t3);
      }), this.g.attachProtoListener("right_hand_landmarks", (t3, e3) => {
        jc(t3, this.h.rightHandLandmarks), pa(this, e3);
      }), this.g.attachEmptyPacketListener("right_hand_landmarks", (t3) => {
        pa(this, t3);
      }), this.g.attachProtoListener("right_hand_world_landmarks", (t3, e3) => {
        var n3 = this.h.rightHandWorldLandmarks;
        t3 = xs(t3), n3.push(qo(t3)), pa(this, e3);
      }), this.g.attachEmptyPacketListener("right_hand_world_landmarks", (t3) => {
        pa(this, t3);
      }), t2 = t2.g(), this.setGraph(new Uint8Array(t2), true);
    }
  };
  Vc.prototype.detectForVideo = Vc.prototype.G, Vc.prototype.detect = Vc.prototype.F, Vc.prototype.setOptions = Vc.prototype.o, Vc.createFromModelPath = function(t2, e2) {
    return fc(Vc, t2, { baseOptions: { modelAssetPath: e2 } });
  }, Vc.createFromModelBuffer = function(t2, e2) {
    return fc(Vc, t2, { baseOptions: { modelAssetBuffer: e2 } });
  }, Vc.createFromOptions = function(t2, e2) {
    return fc(Vc, t2, e2);
  }, Vc.HAND_CONNECTIONS = Fc, Vc.POSE_CONNECTIONS = Dc, Vc.FACE_LANDMARKS_LIPS = vc, Vc.FACE_LANDMARKS_LEFT_EYE = Ec, Vc.FACE_LANDMARKS_LEFT_EYEBROW = wc, Vc.FACE_LANDMARKS_LEFT_IRIS = Tc, Vc.FACE_LANDMARKS_RIGHT_EYE = Ac, Vc.FACE_LANDMARKS_RIGHT_EYEBROW = bc, Vc.FACE_LANDMARKS_RIGHT_IRIS = kc, Vc.FACE_LANDMARKS_FACE_OVAL = Sc, Vc.FACE_LANDMARKS_CONTOURS = xc, Vc.FACE_LANDMARKS_TESSELATION = Lc;
  var Xc = class extends yc {
    constructor(t2, e2) {
      super(new lc(t2, e2), "input_image", "norm_rect", true), this.j = { classifications: [] }, kn(t2 = this.h = new bo(), 0, 1, e2 = new Ks());
    }
    get baseOptions() {
      return wn(this.h, Ks, 1);
    }
    set baseOptions(t2) {
      kn(this.h, 0, 1, t2);
    }
    o(t2) {
      return kn(this.h, 0, 2, Xo(t2, wn(this.h, Gs, 2))), this.l(t2);
    }
    sa(t2, e2) {
      return this.j = { classifications: [] }, pc(this, t2, e2), this.j;
    }
    ta(t2, e2, n2) {
      return this.j = { classifications: [] }, gc(this, t2, n2, e2), this.j;
    }
    m() {
      var t2 = new gs();
      ds(t2, "input_image"), ds(t2, "norm_rect"), ps(t2, "classifications");
      const e2 = new rs();
      Mr(e2, ko, this.h);
      const n2 = new cs();
      Cn(n2, 2, "mediapipe.tasks.vision.image_classifier.ImageClassifierGraph"), os(n2, "IMAGE:input_image"), os(n2, "NORM_RECT:norm_rect"), as(n2, "CLASSIFICATIONS:classifications"), n2.o(e2), fs(t2, n2), this.g.attachProtoListener("classifications", (t3, e3) => {
        this.j = zo(Cs(t3)), pa(this, e3);
      }), this.g.attachEmptyPacketListener("classifications", (t3) => {
        pa(this, t3);
      }), t2 = t2.g(), this.setGraph(new Uint8Array(t2), true);
    }
  };
  Xc.prototype.classifyForVideo = Xc.prototype.ta, Xc.prototype.classify = Xc.prototype.sa, Xc.prototype.setOptions = Xc.prototype.o, Xc.createFromModelPath = function(t2, e2) {
    return fc(Xc, t2, { baseOptions: { modelAssetPath: e2 } });
  }, Xc.createFromModelBuffer = function(t2, e2) {
    return fc(Xc, t2, { baseOptions: { modelAssetBuffer: e2 } });
  }, Xc.createFromOptions = function(t2, e2) {
    return fc(Xc, t2, e2);
  };
  var Hc = class extends yc {
    constructor(t2, e2) {
      super(new lc(t2, e2), "image_in", "norm_rect", true), this.h = new So(), this.embeddings = { embeddings: [] }, kn(t2 = this.h, 0, 1, e2 = new Ks());
    }
    get baseOptions() {
      return wn(this.h, Ks, 1);
    }
    set baseOptions(t2) {
      kn(this.h, 0, 1, t2);
    }
    o(t2) {
      var e2 = this.h, n2 = wn(this.h, Vs, 2);
      return n2 = n2 ? n2.clone() : new Vs(), void 0 !== t2.l2Normalize ? nn(n2, 1, te(t2.l2Normalize)) : "l2Normalize" in t2 && nn(n2, 1), void 0 !== t2.quantize ? nn(n2, 2, te(t2.quantize)) : "quantize" in t2 && nn(n2, 2), kn(e2, 0, 2, n2), this.l(t2);
    }
    za(t2, e2) {
      return pc(this, t2, e2), this.embeddings;
    }
    Aa(t2, e2, n2) {
      return gc(this, t2, n2, e2), this.embeddings;
    }
    m() {
      var t2 = new gs();
      ds(t2, "image_in"), ds(t2, "norm_rect"), ps(t2, "embeddings_out");
      const e2 = new rs();
      Mr(e2, xo, this.h);
      const n2 = new cs();
      Cn(n2, 2, "mediapipe.tasks.vision.image_embedder.ImageEmbedderGraph"), os(n2, "IMAGE:image_in"), os(n2, "NORM_RECT:norm_rect"), as(n2, "EMBEDDINGS:embeddings_out"), n2.o(e2), fs(t2, n2), this.g.attachProtoListener("embeddings_out", (t3, e3) => {
        t3 = Bs(t3), this.embeddings = function(t4) {
          return { embeddings: An(t4, Us, 1).map((t5) => {
            var _a2, _b;
            const e4 = { headIndex: Rn(t5, 3) ?? 0 ?? -1, headName: ge(tn(t5, 4)) ?? "" ?? "" };
            var n3 = t5.v;
            return void 0 !== En(n3, 0 | n3[et], Os, gn(t5, 1)) ? (t5 = on(t5 = wn(t5, Os, gn(t5, 1), void 0), 1, Qt, sn()), e4.floatEmbedding = t5.slice()) : (n3 = new Uint8Array(0), e4.quantizedEmbedding = ((_b = (_a2 = wn(t5, Ns, gn(t5, 2), void 0)) == null ? void 0 : _a2.na()) == null ? void 0 : _b.h()) ?? n3), e4;
          }), timestampMs: Ho(In(t4)) };
        }(t3), pa(this, e3);
      }), this.g.attachEmptyPacketListener("embeddings_out", (t3) => {
        pa(this, t3);
      }), t2 = t2.g(), this.setGraph(new Uint8Array(t2), true);
    }
  };
  Hc.cosineSimilarity = function(t2, e2) {
    if (t2.floatEmbedding && e2.floatEmbedding) t2 = Jo(t2.floatEmbedding, e2.floatEmbedding);
    else {
      if (!t2.quantizedEmbedding || !e2.quantizedEmbedding) throw Error("Cannot compute cosine similarity between quantized and float embeddings.");
      t2 = Jo($o(t2.quantizedEmbedding), $o(e2.quantizedEmbedding));
    }
    return t2;
  }, Hc.prototype.embedForVideo = Hc.prototype.Aa, Hc.prototype.embed = Hc.prototype.za, Hc.prototype.setOptions = Hc.prototype.o, Hc.createFromModelPath = function(t2, e2) {
    return fc(Hc, t2, { baseOptions: { modelAssetPath: e2 } });
  }, Hc.createFromModelBuffer = function(t2, e2) {
    return fc(Hc, t2, { baseOptions: { modelAssetBuffer: e2 } });
  }, Hc.createFromOptions = function(t2, e2) {
    return fc(Hc, t2, e2);
  };
  var Wc = class {
    constructor(t2, e2, n2) {
      this.confidenceMasks = t2, this.categoryMask = e2, this.qualityScores = n2;
    }
    close() {
      var _a2, _b;
      (_a2 = this.confidenceMasks) == null ? void 0 : _a2.forEach((t2) => {
        t2.close();
      }), (_b = this.categoryMask) == null ? void 0 : _b.close();
    }
  };
  function zc(t2) {
    var _a2, _b;
    const e2 = function(t3) {
      return An(t3, cs, 1);
    }(t2.ca()).filter((t3) => (ge(tn(t3, 1)) ?? "").includes("mediapipe.tasks.TensorsToSegmentationCalculator"));
    if (t2.u = [], e2.length > 1) throw Error("The graph has more than one mediapipe.tasks.TensorsToSegmentationCalculator.");
    1 === e2.length && (((_b = (_a2 = wn(e2[0], rs, 7)) == null ? void 0 : _a2.j()) == null ? void 0 : _b.g()) ?? /* @__PURE__ */ new Map()).forEach((e3, n2) => {
      t2.u[Number(n2)] = ge(tn(e3, 1)) ?? "";
    });
  }
  function Kc(t2) {
    t2.categoryMask = void 0, t2.confidenceMasks = void 0, t2.qualityScores = void 0;
  }
  function Yc(t2) {
    try {
      const e2 = new Wc(t2.confidenceMasks, t2.categoryMask, t2.qualityScores);
      if (!t2.j) return e2;
      t2.j(e2);
    } finally {
      ya(t2);
    }
  }
  Wc.prototype.close = Wc.prototype.close;
  var qc = class extends yc {
    constructor(t2, e2) {
      super(new lc(t2, e2), "image_in", "norm_rect", false), this.u = [], this.outputCategoryMask = false, this.outputConfidenceMasks = true, this.h = new Mo(), this.A = new Lo(), kn(this.h, 0, 3, this.A), kn(t2 = this.h, 0, 1, e2 = new Ks());
    }
    get baseOptions() {
      return wn(this.h, Ks, 1);
    }
    set baseOptions(t2) {
      kn(this.h, 0, 1, t2);
    }
    o(t2) {
      return void 0 !== t2.displayNamesLocale ? nn(this.h, 2, pe(t2.displayNamesLocale)) : "displayNamesLocale" in t2 && nn(this.h, 2), "outputCategoryMask" in t2 && (this.outputCategoryMask = t2.outputCategoryMask ?? false), "outputConfidenceMasks" in t2 && (this.outputConfidenceMasks = t2.outputConfidenceMasks ?? true), super.l(t2);
    }
    L() {
      zc(this);
    }
    segment(t2, e2, n2) {
      const r2 = "function" != typeof e2 ? e2 : {};
      return this.j = "function" == typeof e2 ? e2 : n2, Kc(this), pc(this, t2, r2), Yc(this);
    }
    La(t2, e2, n2, r2) {
      const i2 = "function" != typeof n2 ? n2 : {};
      return this.j = "function" == typeof n2 ? n2 : r2, Kc(this), gc(this, t2, i2, e2), Yc(this);
    }
    Da() {
      return this.u;
    }
    m() {
      var t2 = new gs();
      ds(t2, "image_in"), ds(t2, "norm_rect");
      const e2 = new rs();
      Mr(e2, Po, this.h);
      const n2 = new cs();
      Cn(n2, 2, "mediapipe.tasks.vision.image_segmenter.ImageSegmenterGraph"), os(n2, "IMAGE:image_in"), os(n2, "NORM_RECT:norm_rect"), n2.o(e2), fs(t2, n2), ga(this, t2), this.outputConfidenceMasks && (ps(t2, "confidence_masks"), as(n2, "CONFIDENCE_MASKS:confidence_masks"), ma(this, "confidence_masks"), this.g.aa("confidence_masks", (t3, e3) => {
        this.confidenceMasks = t3.map((t4) => mc(this, t4, true, !this.j)), pa(this, e3);
      }), this.g.attachEmptyPacketListener("confidence_masks", (t3) => {
        this.confidenceMasks = [], pa(this, t3);
      })), this.outputCategoryMask && (ps(t2, "category_mask"), as(n2, "CATEGORY_MASK:category_mask"), ma(this, "category_mask"), this.g.Z("category_mask", (t3, e3) => {
        this.categoryMask = mc(this, t3, false, !this.j), pa(this, e3);
      }), this.g.attachEmptyPacketListener("category_mask", (t3) => {
        this.categoryMask = void 0, pa(this, t3);
      })), ps(t2, "quality_scores"), as(n2, "QUALITY_SCORES:quality_scores"), this.g.attachFloatVectorListener("quality_scores", (t3, e3) => {
        this.qualityScores = t3, pa(this, e3);
      }), this.g.attachEmptyPacketListener("quality_scores", (t3) => {
        this.categoryMask = void 0, pa(this, t3);
      }), t2 = t2.g(), this.setGraph(new Uint8Array(t2), true);
    }
  };
  qc.prototype.getLabels = qc.prototype.Da, qc.prototype.segmentForVideo = qc.prototype.La, qc.prototype.segment = qc.prototype.segment, qc.prototype.setOptions = qc.prototype.o, qc.createFromModelPath = function(t2, e2) {
    return fc(qc, t2, { baseOptions: { modelAssetPath: e2 } });
  }, qc.createFromModelBuffer = function(t2, e2) {
    return fc(qc, t2, { baseOptions: { modelAssetBuffer: e2 } });
  }, qc.createFromOptions = function(t2, e2) {
    return fc(qc, t2, e2);
  };
  var $c = class {
    constructor(t2, e2, n2) {
      this.confidenceMasks = t2, this.categoryMask = e2, this.qualityScores = n2;
    }
    close() {
      var _a2, _b;
      (_a2 = this.confidenceMasks) == null ? void 0 : _a2.forEach((t2) => {
        t2.close();
      }), (_b = this.categoryMask) == null ? void 0 : _b.close();
    }
  };
  $c.prototype.close = $c.prototype.close;
  var Jc = class extends yc {
    constructor(t2, e2) {
      super(new lc(t2, e2), "image_in", "norm_rect_in", false), this.outputCategoryMask = false, this.outputConfidenceMasks = true, this.h = new Mo(), this.u = new Lo(), kn(this.h, 0, 3, this.u), kn(t2 = this.h, 0, 1, e2 = new Ks());
    }
    get baseOptions() {
      return wn(this.h, Ks, 1);
    }
    set baseOptions(t2) {
      kn(this.h, 0, 1, t2);
    }
    o(t2) {
      return "outputCategoryMask" in t2 && (this.outputCategoryMask = t2.outputCategoryMask ?? false), "outputConfidenceMasks" in t2 && (this.outputConfidenceMasks = t2.outputConfidenceMasks ?? true), super.l(t2);
    }
    segment(t2, e2, n2, r2) {
      const i2 = "function" != typeof n2 ? n2 : {};
      if (this.j = "function" == typeof n2 ? n2 : r2, this.qualityScores = this.categoryMask = this.confidenceMasks = void 0, n2 = this.C + 1, r2 = new Uo(), e2.keypoint && e2.scribble) throw Error("Cannot provide both keypoint and scribble.");
      if (e2.keypoint) {
        var s2 = new Co();
        dn(s2, 3, te(true), false), dn(s2, 1, Zt(e2.keypoint.x), 0), dn(s2, 2, Zt(e2.keypoint.y), 0), Sn(r2, 1, Do, s2);
      } else {
        if (!e2.scribble) throw Error("Must provide either a keypoint or a scribble.");
        {
          const t3 = new No();
          for (s2 of e2.scribble) dn(e2 = new Co(), 3, te(true), false), dn(e2, 1, Zt(s2.x), 0), dn(e2, 2, Zt(s2.y), 0), Ln(t3, 1, Co, e2);
          Sn(r2, 2, Do, t3);
        }
      }
      this.g.addProtoToStream(r2.g(), "mediapipe.tasks.vision.interactive_segmenter.proto.RegionOfInterest", "roi_in", n2), pc(this, t2, i2);
      t: {
        try {
          const t3 = new $c(this.confidenceMasks, this.categoryMask, this.qualityScores);
          if (!this.j) {
            var o2 = t3;
            break t;
          }
          this.j(t3);
        } finally {
          ya(this);
        }
        o2 = void 0;
      }
      return o2;
    }
    m() {
      var t2 = new gs();
      ds(t2, "image_in"), ds(t2, "roi_in"), ds(t2, "norm_rect_in");
      const e2 = new rs();
      Mr(e2, Po, this.h);
      const n2 = new cs();
      Cn(n2, 2, "mediapipe.tasks.vision.interactive_segmenter.InteractiveSegmenterGraphV2"), os(n2, "IMAGE:image_in"), os(n2, "ROI:roi_in"), os(n2, "NORM_RECT:norm_rect_in"), n2.o(e2), fs(t2, n2), ga(this, t2), this.outputConfidenceMasks && (ps(t2, "confidence_masks"), as(n2, "CONFIDENCE_MASKS:confidence_masks"), ma(this, "confidence_masks"), this.g.aa("confidence_masks", (t3, e3) => {
        this.confidenceMasks = t3.map((t4) => mc(this, t4, true, !this.j)), pa(this, e3);
      }), this.g.attachEmptyPacketListener("confidence_masks", (t3) => {
        this.confidenceMasks = [], pa(this, t3);
      })), this.outputCategoryMask && (ps(t2, "category_mask"), as(n2, "CATEGORY_MASK:category_mask"), ma(this, "category_mask"), this.g.Z("category_mask", (t3, e3) => {
        this.categoryMask = mc(this, t3, false, !this.j), pa(this, e3);
      }), this.g.attachEmptyPacketListener("category_mask", (t3) => {
        this.categoryMask = void 0, pa(this, t3);
      })), ps(t2, "quality_scores"), as(n2, "QUALITY_SCORES:quality_scores"), this.g.attachFloatVectorListener("quality_scores", (t3, e3) => {
        this.qualityScores = t3, pa(this, e3);
      }), this.g.attachEmptyPacketListener("quality_scores", (t3) => {
        this.categoryMask = void 0, pa(this, t3);
      }), t2 = t2.g(), this.setGraph(new Uint8Array(t2), true);
    }
  };
  Jc.prototype.segment = Jc.prototype.segment, Jc.prototype.setOptions = Jc.prototype.o, Jc.createFromModelPath = function(t2, e2) {
    return fc(Jc, t2, { baseOptions: { modelAssetPath: e2 } });
  }, Jc.createFromModelBuffer = function(t2, e2) {
    return fc(Jc, t2, { baseOptions: { modelAssetBuffer: e2 } });
  }, Jc.createFromOptions = function(t2, e2) {
    return fc(Jc, t2, e2);
  };
  var Zc = class extends yc {
    constructor(t2, e2) {
      super(new lc(t2, e2), "input_frame_gpu", "norm_rect", false), this.j = { detections: [] }, kn(t2 = this.h = new Bo(), 0, 1, e2 = new Ks());
    }
    get baseOptions() {
      return wn(this.h, Ks, 1);
    }
    set baseOptions(t2) {
      kn(this.h, 0, 1, t2);
    }
    o(t2) {
      return void 0 !== t2.displayNamesLocale ? nn(this.h, 2, pe(t2.displayNamesLocale)) : "displayNamesLocale" in t2 && nn(this.h, 2), void 0 !== t2.maxResults ? Mn(this.h, 3, t2.maxResults) : "maxResults" in t2 && nn(this.h, 3), void 0 !== t2.scoreThreshold ? Pn(this.h, 4, t2.scoreThreshold) : "scoreThreshold" in t2 && nn(this.h, 4), void 0 !== t2.categoryAllowlist ? On(this.h, 5, t2.categoryAllowlist) : "categoryAllowlist" in t2 && nn(this.h, 5), void 0 !== t2.categoryDenylist ? On(this.h, 6, t2.categoryDenylist) : "categoryDenylist" in t2 && nn(this.h, 6), this.l(t2);
    }
    F(t2, e2) {
      return this.j = { detections: [] }, pc(this, t2, e2), this.j;
    }
    G(t2, e2, n2) {
      return this.j = { detections: [] }, gc(this, t2, n2, e2), this.j;
    }
    m() {
      var t2 = new gs();
      ds(t2, "input_frame_gpu"), ds(t2, "norm_rect"), ps(t2, "detections");
      const e2 = new rs();
      Mr(e2, Go, this.h);
      const n2 = new cs();
      Cn(n2, 2, "mediapipe.tasks.vision.ObjectDetectorGraph"), os(n2, "IMAGE:input_frame_gpu"), os(n2, "NORM_RECT:norm_rect"), as(n2, "DETECTIONS:detections"), n2.o(e2), fs(t2, n2), this.g.attachProtoVectorListener("detections", (t3, e3) => {
        for (const e4 of t3) t3 = ks(e4), this.j.detections.push(Ko(t3));
        pa(this, e3);
      }), this.g.attachEmptyPacketListener("detections", (t3) => {
        pa(this, t3);
      }), t2 = t2.g(), this.setGraph(new Uint8Array(t2), true);
    }
  };
  Zc.prototype.detectForVideo = Zc.prototype.G, Zc.prototype.detect = Zc.prototype.F, Zc.prototype.setOptions = Zc.prototype.o, Zc.createFromModelPath = async function(t2, e2) {
    return fc(Zc, t2, { baseOptions: { modelAssetPath: e2 } });
  }, Zc.createFromModelBuffer = function(t2, e2) {
    return fc(Zc, t2, { baseOptions: { modelAssetBuffer: e2 } });
  }, Zc.createFromOptions = function(t2, e2) {
    return fc(Zc, t2, e2);
  };
  var Qc = class {
    constructor(t2, e2, n2) {
      this.landmarks = t2, this.worldLandmarks = e2, this.segmentationMasks = n2;
    }
    close() {
      var _a2;
      (_a2 = this.segmentationMasks) == null ? void 0 : _a2.forEach((t2) => {
        t2.close();
      });
    }
  };
  function th(t2) {
    t2.landmarks = [], t2.worldLandmarks = [], t2.segmentationMasks = void 0;
  }
  function eh(t2) {
    try {
      const e2 = new Qc(t2.landmarks, t2.worldLandmarks, t2.segmentationMasks);
      if (!t2.u) return e2;
      t2.u(e2);
    } finally {
      ya(t2);
    }
  }
  Qc.prototype.close = Qc.prototype.close;
  var nh = class extends yc {
    constructor(t2, e2) {
      super(new lc(t2, e2), "image_in", "norm_rect", false), this.landmarks = [], this.worldLandmarks = [], this.outputSegmentationMasks = false, kn(t2 = this.h = new jo(), 0, 1, e2 = new Ks()), this.A = new Eo(), kn(this.h, 0, 3, this.A), this.j = new vo(), kn(this.h, 0, 2, this.j), Mn(this.j, 4, 1), Pn(this.j, 2, 0.5), Pn(this.A, 2, 0.5), Pn(this.h, 4, 0.5);
    }
    get baseOptions() {
      return wn(this.h, Ks, 1);
    }
    set baseOptions(t2) {
      kn(this.h, 0, 1, t2);
    }
    o(t2) {
      return "numPoses" in t2 && Mn(this.j, 4, t2.numPoses ?? 1), "minPoseDetectionConfidence" in t2 && Pn(this.j, 2, t2.minPoseDetectionConfidence ?? 0.5), "minTrackingConfidence" in t2 && Pn(this.h, 4, t2.minTrackingConfidence ?? 0.5), "minPosePresenceConfidence" in t2 && Pn(this.A, 2, t2.minPosePresenceConfidence ?? 0.5), "outputSegmentationMasks" in t2 && (this.outputSegmentationMasks = t2.outputSegmentationMasks ?? false), this.l(t2);
    }
    F(t2, e2, n2) {
      const r2 = "function" != typeof e2 ? e2 : {};
      return this.u = "function" == typeof e2 ? e2 : n2, th(this), pc(this, t2, r2), eh(this);
    }
    G(t2, e2, n2, r2) {
      const i2 = "function" != typeof n2 ? n2 : {};
      return this.u = "function" == typeof n2 ? n2 : r2, th(this), gc(this, t2, i2, e2), eh(this);
    }
    m() {
      var t2 = new gs();
      ds(t2, "image_in"), ds(t2, "norm_rect"), ps(t2, "normalized_landmarks"), ps(t2, "world_landmarks"), ps(t2, "segmentation_masks");
      const e2 = new rs();
      Mr(e2, Vo, this.h);
      const n2 = new cs();
      Cn(n2, 2, "mediapipe.tasks.vision.pose_landmarker.PoseLandmarkerGraph"), os(n2, "IMAGE:image_in"), os(n2, "NORM_RECT:norm_rect"), as(n2, "NORM_LANDMARKS:normalized_landmarks"), as(n2, "WORLD_LANDMARKS:world_landmarks"), n2.o(e2), fs(t2, n2), ga(this, t2), this.g.attachProtoVectorListener("normalized_landmarks", (t3, e3) => {
        this.landmarks = [];
        for (const e4 of t3) t3 = Rs(e4), this.landmarks.push(Yo(t3));
        pa(this, e3);
      }), this.g.attachEmptyPacketListener("normalized_landmarks", (t3) => {
        this.landmarks = [], pa(this, t3);
      }), this.g.attachProtoVectorListener("world_landmarks", (t3, e3) => {
        this.worldLandmarks = [];
        for (const e4 of t3) t3 = xs(e4), this.worldLandmarks.push(qo(t3));
        pa(this, e3);
      }), this.g.attachEmptyPacketListener("world_landmarks", (t3) => {
        this.worldLandmarks = [], pa(this, t3);
      }), this.outputSegmentationMasks && (as(n2, "SEGMENTATION_MASK:segmentation_masks"), ma(this, "segmentation_masks"), this.g.aa("segmentation_masks", (t3, e3) => {
        this.segmentationMasks = t3.map((t4) => mc(this, t4, true, !this.u)), pa(this, e3);
      }), this.g.attachEmptyPacketListener("segmentation_masks", (t3) => {
        this.segmentationMasks = [], pa(this, t3);
      })), t2 = t2.g(), this.setGraph(new Uint8Array(t2), true);
    }
  };
  nh.prototype.detectForVideo = nh.prototype.G, nh.prototype.detect = nh.prototype.F, nh.prototype.setOptions = nh.prototype.o, nh.createFromModelPath = function(t2, e2) {
    return fc(nh, t2, { baseOptions: { modelAssetPath: e2 } });
  }, nh.createFromModelBuffer = function(t2, e2) {
    return fc(nh, t2, { baseOptions: { modelAssetBuffer: e2 } });
  }, nh.createFromOptions = function(t2, e2) {
    return fc(nh, t2, e2);
  }, nh.POSE_CONNECTIONS = Dc;

  // src/pose/detector.ts
  var PoseDetectionError = class extends Error {
    constructor(message) {
      super(message);
      this.name = "PoseDetectionError";
    }
  };
  var DetectorClosedError = class extends Error {
    constructor() {
      super("Cannot use detector after it has been closed.");
      this.name = "DetectorClosedError";
    }
  };

  // src/pose/types.ts
  var LANDMARK_INDEX = {
    // Face landmarks
    NOSE: 0,
    LEFT_EYE_INNER: 1,
    LEFT_EYE: 2,
    LEFT_EYE_OUTER: 3,
    RIGHT_EYE_INNER: 4,
    RIGHT_EYE: 5,
    RIGHT_EYE_OUTER: 6,
    LEFT_EAR: 7,
    RIGHT_EAR: 8,
    MOUTH_LEFT: 9,
    MOUTH_RIGHT: 10,
    // Upper body landmarks
    LEFT_SHOULDER: 11,
    RIGHT_SHOULDER: 12,
    LEFT_ELBOW: 13,
    RIGHT_ELBOW: 14,
    LEFT_WRIST: 15,
    RIGHT_WRIST: 16,
    // Hand landmarks
    LEFT_PINKY: 17,
    RIGHT_PINKY: 18,
    LEFT_INDEX: 19,
    RIGHT_INDEX: 20,
    LEFT_THUMB: 21,
    RIGHT_THUMB: 22,
    // Lower body landmarks
    LEFT_HIP: 23,
    RIGHT_HIP: 24,
    LEFT_KNEE: 25,
    RIGHT_KNEE: 26,
    LEFT_ANKLE: 27,
    RIGHT_ANKLE: 28,
    LEFT_HEEL: 29,
    RIGHT_HEEL: 30,
    LEFT_FOOT_INDEX: 31,
    RIGHT_FOOT_INDEX: 32
  };
  var TOTAL_LANDMARKS2 = 33;
  function createEmptyLandmark() {
    return {
      x: 0,
      y: 0,
      z: 0,
      visibility: 0,
      confidence: 0
    };
  }
  function createEmptyPoseLandmarks() {
    return {
      landmarks: Array.from(
        { length: TOTAL_LANDMARKS2 },
        () => createEmptyLandmark()
      ),
      poseConfidence: 0
    };
  }

  // src/pose/mediapipe-node.ts
  var MEDIAPIPE_MODEL_BASE_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker";
  var MODEL_PATHS = {
    0: `${MEDIAPIPE_MODEL_BASE_URL}/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
    1: `${MEDIAPIPE_MODEL_BASE_URL}/pose_landmarker_full/float16/1/pose_landmarker_full.task`,
    2: `${MEDIAPIPE_MODEL_BASE_URL}/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task`
  };
  var DEFAULT_MODEL_PATH = MODEL_PATHS[1];
  var ModelNotFoundError = class extends Error {
    constructor(modelPath) {
      super(`Model file not found or failed to load: ${modelPath}`);
      __publicField(this, "modelPath");
      this.name = "ModelNotFoundError";
      this.modelPath = modelPath;
    }
  };
  var WasmInitializationError = class extends Error {
    constructor(message, originalError) {
      super(message);
      __publicField(this, "originalError");
      this.name = "WasmInitializationError";
      this.originalError = originalError;
    }
  };
  var ModelCreationError = class extends Error {
    constructor(message, originalError) {
      super(message);
      __publicField(this, "originalError");
      this.name = "ModelCreationError";
      this.originalError = originalError;
    }
  };
  var MediaPipeNodeDetector = class _MediaPipeNodeDetector {
    /**
     * Private constructor. Use createMediaPipeNodeDetector() factory function.
     */
    constructor(landmarker) {
      __publicField(this, "landmarker");
      __publicField(this, "closed", false);
      this.landmarker = landmarker;
    }
    /**
     * Creates a new MediaPipeNodeDetector instance.
     *
     * @param config - Configuration options
     * @returns Promise resolving to initialized detector
     * @throws {ModelNotFoundError} If the model file cannot be found
     * @throws {WasmInitializationError} If WASM runtime fails to initialize
     * @throws {ModelCreationError} If model creation fails for other reasons
     * @internal
     */
    static async create(config = {}) {
      const {
        modelComplexity = 1,
        minDetectionConfidence = 0.5,
        minTrackingConfidence = 0.5,
        minPresenceConfidence = 0.5
      } = config;
      const modelPath = config.modelPath ?? MODEL_PATHS[modelComplexity];
      let vision;
      try {
        vision = await na.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
      } catch (error) {
        throw new WasmInitializationError(
          `Failed to initialize MediaPipe WASM runtime: ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error : void 0
        );
      }
      let landmarker;
      try {
        landmarker = await nh.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: modelPath
          },
          runningMode: "IMAGE",
          numPoses: 1,
          minPoseDetectionConfidence: minDetectionConfidence,
          minTrackingConfidence,
          minPosePresenceConfidence: minPresenceConfidence
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes("404") || errorMessage.includes("not found") || errorMessage.includes("Failed to load") || errorMessage.includes("Failed to fetch") || errorMessage.includes("ENOENT") || errorMessage.includes("no such file")) {
          throw new ModelNotFoundError(modelPath);
        }
        throw new ModelCreationError(
          `Failed to create pose landmarker: ${errorMessage}`,
          error instanceof Error ? error : void 0
        );
      }
      return new _MediaPipeNodeDetector(landmarker);
    }
    /**
     * Detects body pose landmarks in a video frame.
     *
     * @param frame - The video frame to analyze
     * @returns Promise resolving to PoseLandmarks or null if no pose detected
     * @throws {DetectorClosedError} If called after close()
     * @throws {PoseDetectionError} If detection fails
     */
    async detect(frame) {
      if (this.closed) {
        throw new DetectorClosedError();
      }
      const imageData = {
        data: frame.data,
        width: frame.width,
        height: frame.height
      };
      let result;
      try {
        result = this.landmarker.detect(imageData);
      } catch (error) {
        throw new PoseDetectionError(
          `Pose detection failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      if (!result.landmarks || result.landmarks.length === 0) {
        return null;
      }
      const poseLandmarks = result.landmarks[0];
      if (!poseLandmarks) {
        return null;
      }
      const landmarks = poseLandmarks.map((lm) => ({
        x: lm.x,
        y: lm.y,
        z: lm.z,
        visibility: lm.visibility ?? 0,
        confidence: lm.visibility ?? 0
        // Use visibility as confidence
      }));
      while (landmarks.length < TOTAL_LANDMARKS2) {
        landmarks.push({
          x: 0,
          y: 0,
          z: 0,
          visibility: 0,
          confidence: 0
        });
      }
      const poseConfidence = landmarks.reduce((sum, lm) => sum + lm.visibility, 0) / TOTAL_LANDMARKS2;
      const poseLandmarksResult = {
        landmarks,
        poseConfidence
      };
      return poseLandmarksResult;
    }
    /**
     * Releases resources used by the detector.
     *
     * @throws {DetectorClosedError} If called more than once
     */
    async close() {
      if (this.closed) {
        throw new DetectorClosedError();
      }
      this.closed = true;
      this.landmarker.close();
    }
  };
  async function createMediaPipeNodeDetector(config = {}) {
    return MediaPipeNodeDetector.create(config);
  }

  // src/pose/mediapipe-browser.ts
  var WebGLNotAvailableError = class extends Error {
    constructor() {
      super(
        "WebGL is not available in this browser. Consider using CPU delegate instead."
      );
      this.name = "WebGLNotAvailableError";
    }
  };
  var DEFAULT_WASM_BASE_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
  function detectWebGLSupport() {
    if (typeof document === "undefined") {
      return false;
    }
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      return gl !== null;
    } catch {
      return false;
    }
  }
  var MediaPipeBrowserDetector = class _MediaPipeBrowserDetector {
    /**
     * Private constructor. Use createMediaPipeBrowserDetector() factory function.
     */
    constructor(landmarker, runningMode) {
      __publicField(this, "landmarker");
      __publicField(this, "runningMode");
      __publicField(this, "closed", false);
      this.landmarker = landmarker;
      this.runningMode = runningMode;
    }
    /**
     * Creates a new MediaPipeBrowserDetector instance.
     *
     * @param config - Configuration options
     * @returns Promise resolving to initialized detector
     * @throws {ModelNotFoundError} If the model file cannot be found
     * @throws {WasmInitializationError} If WASM runtime fails to initialize
     * @throws {ModelCreationError} If model creation fails for other reasons
     * @throws {WebGLNotAvailableError} If GPU delegate requested with ERROR fallback and WebGL unavailable
     * @internal
     */
    static async create(config = {}) {
      const {
        modelComplexity = 1,
        minDetectionConfidence = 0.5,
        minTrackingConfidence = 0.5,
        minPresenceConfidence = 0.5,
        runningMode = "IMAGE",
        delegate = "GPU" /* GPU */,
        webglFallback = "AUTO" /* AUTO */
      } = config;
      const modelPath = config.modelPath ?? MODEL_PATHS[modelComplexity];
      let actualDelegate = delegate;
      if (delegate === "GPU" /* GPU */) {
        const webglSupported = detectWebGLSupport();
        if (!webglSupported) {
          if (webglFallback === "ERROR" /* ERROR */) {
            throw new WebGLNotAvailableError();
          }
          actualDelegate = "CPU" /* CPU */;
        }
      }
      let vision;
      try {
        vision = await na.forVisionTasks(
          config.wasmBasePath ?? DEFAULT_WASM_BASE_PATH
        );
      } catch (error) {
        throw new WasmInitializationError(
          `Failed to initialize MediaPipe WASM runtime: ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error : void 0
        );
      }
      let landmarker;
      try {
        landmarker = await nh.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: modelPath,
            delegate: actualDelegate
          },
          runningMode,
          numPoses: 1,
          minPoseDetectionConfidence: minDetectionConfidence,
          minTrackingConfidence,
          minPosePresenceConfidence: minPresenceConfidence
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes("404") || errorMessage.includes("not found") || errorMessage.includes("Failed to load") || errorMessage.includes("Failed to fetch") || errorMessage.includes("ENOENT") || errorMessage.includes("no such file")) {
          throw new ModelNotFoundError(modelPath);
        }
        throw new ModelCreationError(
          `Failed to create pose landmarker: ${errorMessage}`,
          error instanceof Error ? error : void 0
        );
      }
      return new _MediaPipeBrowserDetector(landmarker, runningMode);
    }
    /**
     * Detects body pose landmarks in a video frame.
     *
     * @param frame - The video frame to analyze
     * @returns Promise resolving to PoseLandmarks or null if no pose detected
     * @throws {DetectorClosedError} If called after close()
     * @throws {PoseDetectionError} If detection fails
     */
    async detect(frame) {
      if (this.closed) {
        throw new DetectorClosedError();
      }
      let result;
      try {
        if (this.runningMode === "VIDEO") {
          if (frame.canvas) {
            result = this.landmarker.detectForVideo(
              frame.canvas,
              frame.timestamp
            );
          } else {
            const imageData = new ImageData(
              new Uint8ClampedArray(frame.data),
              frame.width,
              frame.height
            );
            result = this.landmarker.detectForVideo(imageData, frame.timestamp);
          }
        } else {
          const imageData = new ImageData(
            new Uint8ClampedArray(frame.data),
            frame.width,
            frame.height
          );
          result = this.landmarker.detect(imageData);
        }
      } catch (error) {
        throw new PoseDetectionError(
          `Pose detection failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      return this.processLandmarkerResult(result);
    }
    /**
     * Detects body pose landmarks from an HTMLVideoElement.
     *
     * This method is optimized for browser environments where you have
     * direct access to a video element. It avoids the overhead of
     * converting video frames to ImageData.
     *
     * @param video - The HTMLVideoElement to analyze
     * @param timestamp - Timestamp in milliseconds (required for VIDEO mode)
     * @returns Promise resolving to PoseLandmarks or null if no pose detected
     * @throws {DetectorClosedError} If called after close()
     * @throws {PoseDetectionError} If detection fails
     *
     * @example
     * ```typescript
     * const video = document.querySelector('video');
     * const detector = await createMediaPipeBrowserDetector({ runningMode: "VIDEO" });
     *
     * video.addEventListener('timeupdate', async () => {
     *   const result = await detector.detectVideo(video, video.currentTime * 1000);
     *   if (result) {
     *     console.log('Pose detected:', result.poseConfidence);
     *   }
     * });
     * ```
     */
    async detectVideo(video, timestamp) {
      if (this.closed) {
        throw new DetectorClosedError();
      }
      let result;
      try {
        if (this.runningMode === "VIDEO") {
          result = this.landmarker.detectForVideo(video, timestamp);
        } else {
          result = this.landmarker.detect(video);
        }
      } catch (error) {
        throw new PoseDetectionError(
          `Pose detection failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      return this.processLandmarkerResult(result);
    }
    /**
     * Processes MediaPipe landmarker result into our PoseLandmarks format.
     *
     * @param result - The raw MediaPipe result
     * @returns PoseLandmarks or null if no pose detected
     * @internal
     */
    processLandmarkerResult(result) {
      if (!result.landmarks || result.landmarks.length === 0) {
        return null;
      }
      const poseLandmarks = result.landmarks[0];
      if (!poseLandmarks) {
        return null;
      }
      const landmarks = poseLandmarks.map((lm) => ({
        x: lm.x,
        y: lm.y,
        z: lm.z,
        visibility: lm.visibility ?? 0,
        confidence: lm.visibility ?? 0
        // Use visibility as confidence
      }));
      while (landmarks.length < TOTAL_LANDMARKS2) {
        landmarks.push({
          x: 0,
          y: 0,
          z: 0,
          visibility: 0,
          confidence: 0
        });
      }
      const poseConfidence = landmarks.reduce((sum, lm) => sum + lm.visibility, 0) / TOTAL_LANDMARKS2;
      const poseLandmarksResult = {
        landmarks,
        poseConfidence
      };
      return poseLandmarksResult;
    }
    /**
     * Releases resources used by the detector.
     *
     * This method releases all resources including:
     * - MediaPipe PoseLandmarker instance
     * - WebGL context and GPU memory (if GPU delegate was used)
     * - WASM memory allocations
     *
     * The landmarker.close() method internally handles WebGL context cleanup
     * by releasing shader programs, buffers, and textures. No explicit
     * WEBGL_lose_context call is needed as MediaPipe manages this internally.
     *
     * @throws {DetectorClosedError} If called more than once
     */
    async close() {
      if (this.closed) {
        throw new DetectorClosedError();
      }
      this.closed = true;
      this.landmarker.close();
    }
  };
  async function createMediaPipeBrowserDetector(config = {}) {
    return MediaPipeBrowserDetector.create(config);
  }

  // src/pose/factory.ts
  var UnknownRuntimeError = class extends Error {
    constructor(runtime) {
      super(
        `Unknown runtime "${runtime}". Supported runtimes are: 'node', 'browser', 'auto'.`
      );
      __publicField(this, "runtime");
      this.name = "UnknownRuntimeError";
      this.runtime = runtime;
    }
  };
  function detectRuntime() {
    return typeof window !== "undefined" ? "browser" : "node";
  }
  async function createPoseDetector(config = {}) {
    const { runtime = "auto", ...restConfig } = config;
    const actualRuntime = runtime === "auto" ? detectRuntime() : runtime;
    switch (actualRuntime) {
      case "node": {
        const nodeConfig = {};
        if (restConfig.modelPath !== void 0) {
          nodeConfig.modelPath = restConfig.modelPath;
        }
        if (restConfig.modelComplexity !== void 0) {
          nodeConfig.modelComplexity = restConfig.modelComplexity;
        }
        if (restConfig.minDetectionConfidence !== void 0) {
          nodeConfig.minDetectionConfidence = restConfig.minDetectionConfidence;
        }
        if (restConfig.minTrackingConfidence !== void 0) {
          nodeConfig.minTrackingConfidence = restConfig.minTrackingConfidence;
        }
        if (restConfig.minPresenceConfidence !== void 0) {
          nodeConfig.minPresenceConfidence = restConfig.minPresenceConfidence;
        }
        return createMediaPipeNodeDetector(nodeConfig);
      }
      case "browser": {
        const browserConfig = {};
        if (restConfig.modelPath !== void 0) {
          browserConfig.modelPath = restConfig.modelPath;
        }
        if (restConfig.wasmBasePath !== void 0) {
          browserConfig.wasmBasePath = restConfig.wasmBasePath;
        }
        if (restConfig.modelComplexity !== void 0) {
          browserConfig.modelComplexity = restConfig.modelComplexity;
        }
        if (restConfig.minDetectionConfidence !== void 0) {
          browserConfig.minDetectionConfidence = restConfig.minDetectionConfidence;
        }
        if (restConfig.minTrackingConfidence !== void 0) {
          browserConfig.minTrackingConfidence = restConfig.minTrackingConfidence;
        }
        if (restConfig.minPresenceConfidence !== void 0) {
          browserConfig.minPresenceConfidence = restConfig.minPresenceConfidence;
        }
        if (restConfig.runningMode !== void 0) {
          browserConfig.runningMode = restConfig.runningMode;
        }
        if (restConfig.delegate !== void 0) {
          browserConfig.delegate = restConfig.delegate === "GPU" ? "GPU" /* GPU */ : "CPU" /* CPU */;
        }
        if (restConfig.webglFallback !== void 0) {
          browserConfig.webglFallback = restConfig.webglFallback === "AUTO" ? "AUTO" /* AUTO */ : "ERROR" /* ERROR */;
        }
        return createMediaPipeBrowserDetector(browserConfig);
      }
      default:
        throw new UnknownRuntimeError(actualRuntime);
    }
  }

  // src/detection/shot-detector.ts
  var DEFAULT_CONFIG2 = {
    velocityThreshold: 0.012,
    // Lowered from 0.015 to catch more subtle upward motion
    smoothingWindowSize: 3,
    minShotDuration: 10,
    // Lowered from 15 (check becomes >= 5 frames)
    minUpwardFrames: 3,
    armReturnThreshold: 1,
    confirmationWindow: 3
  };
  var MAX_GAP_FRAMES = 3;
  var MIN_WRIST_ABOVE_SHOULDER_DELTA = -0.049;
  var MAX_VALID_VELOCITY = 0.1;
  var MAX_WRIST_ABOVE_SHOULDER_AT_START = -0.05;
  var ShotBoundaryDetector = class {
    constructor(config = {}) {
      __publicField(this, "config");
      this.config = { ...DEFAULT_CONFIG2, ...config };
    }
    /**
     * Detects all shot boundaries in a sequence of pose landmarks.
     *
     * @param sequence - Array of PoseLandmarks from consecutive frames
     * @param originalFrameIndices - Optional array mapping sequence indices to original frame numbers
     * @returns Array of detected boundaries (start/end pairs)
     */
    detectBoundaries(sequence, originalFrameIndices) {
      if (sequence.length < 2) {
        return [];
      }
      const frameData = this.extractFrameData(sequence, originalFrameIndices);
      this.calculateVelocities(frameData);
      const boundaries = this.findBoundaries(frameData, sequence.length);
      return boundaries;
    }
    /**
     * Detects shots as paired start/end boundaries.
     *
     * @param sequence - Array of PoseLandmarks from consecutive frames
     * @param originalFrameIndices - Optional array mapping sequence indices to original frame numbers.
     *                               Used to detect pose tracking gaps and reset shot detection.
     * @returns Array of detected shots with boundaries
     */
    detectShots(sequence, originalFrameIndices) {
      const boundaries = this.detectBoundaries(sequence, originalFrameIndices);
      const shots = this.pairBoundaries(boundaries, sequence.length);
      return this.filterByOrientation(shots, sequence, originalFrameIndices);
    }
    /**
     * Filters detected shots based on orientation metrics.
     * Removes false positives that have body orientations inconsistent with shooting position.
     *
     * Filter criteria:
     * 1. Moderate shoulder separation (0.12-0.20) with positive shoulderDiffX (appearing as back view)
     *    indicates potential false positive. True behind views have larger shoulderSep (>0.20).
     *    The filtering also considers Z-asymmetry: high Z-asymmetry (>0.35) = side view with rotation.
     *
     * 2. Extreme positive Z-depth (>0.55) indicates the left shoulder is much farther from
     *    camera than right - extreme side angle rarely seen in actual shots.
     */
    filterByOrientation(shots, sequence, _originalFrameIndices) {
      const MAX_SHOULDER_SEP_FOR_BACK_VIEW_FILTER = 0.18;
      const MIN_SHOULDER_SEP_FOR_FILTER = 0.12;
      const MAX_POSITIVE_Z_DEPTH = 0.55;
      return shots.filter((shot) => {
        let totalShoulderDiffX = 0;
        let totalShoulderZ = 0;
        let validSamples = 0;
        for (let i2 = shot.start.frameIndex; i2 <= shot.end.frameIndex; i2++) {
          const pose = sequence[i2];
          if (!pose) continue;
          const leftShoulder = pose.landmarks[LANDMARK_INDEX.LEFT_SHOULDER];
          const rightShoulder = pose.landmarks[LANDMARK_INDEX.RIGHT_SHOULDER];
          if (!leftShoulder || !rightShoulder) continue;
          if ((leftShoulder.visibility ?? 0) < 0.3 || (rightShoulder.visibility ?? 0) < 0.3) continue;
          totalShoulderDiffX += rightShoulder.x - leftShoulder.x;
          totalShoulderZ += rightShoulder.z - leftShoulder.z;
          validSamples++;
        }
        if (validSamples === 0) return true;
        const avgShoulderDiffX = totalShoulderDiffX / validSamples;
        const avgShoulderZ = totalShoulderZ / validSamples;
        const shoulderSep = Math.abs(avgShoulderDiffX);
        if (avgShoulderDiffX > 0 && shoulderSep > MIN_SHOULDER_SEP_FOR_FILTER && shoulderSep < MAX_SHOULDER_SEP_FOR_BACK_VIEW_FILTER) {
          return false;
        }
        if (avgShoulderZ > MAX_POSITIVE_Z_DEPTH) {
          return false;
        }
        return true;
      });
    }
    /**
     * Extracts relevant landmark data from each frame.
     */
    extractFrameData(sequence, originalFrameIndices) {
      const frameData = [];
      for (let i2 = 0; i2 < sequence.length; i2++) {
        const landmarks = sequence[i2].landmarks;
        const leftWrist = landmarks[LANDMARK_INDEX.LEFT_WRIST];
        const rightWrist = landmarks[LANDMARK_INDEX.RIGHT_WRIST];
        const leftShoulder = landmarks[LANDMARK_INDEX.LEFT_SHOULDER];
        const rightShoulder = landmarks[LANDMARK_INDEX.RIGHT_SHOULDER];
        const originalFrameIndex = (originalFrameIndices == null ? void 0 : originalFrameIndices[i2]) ?? i2;
        frameData.push({
          frameIndex: i2,
          originalFrameIndex,
          leftWrist,
          rightWrist,
          leftShoulder,
          rightShoulder,
          avgWristY: (leftWrist.y + rightWrist.y) / 2,
          wristVelocity: 0
        });
      }
      if (this.config.smoothingWindowSize > 1) {
        const avgWristYValues = frameData.map((f2) => f2.avgWristY);
        const smoothedY = movingAverage(
          avgWristYValues,
          this.config.smoothingWindowSize
        );
        for (let i2 = 0; i2 < frameData.length; i2++) {
          frameData[i2].avgWristY = smoothedY[i2];
        }
      }
      return frameData;
    }
    /**
     * Calculates wrist velocity for each frame.
     * Velocity is the change in Y position per frame.
     * Negative velocity = upward movement (lower Y value).
     *
     * Velocities that are too large (indicating pose dropout recovery) are clamped to 0.
     */
    calculateVelocities(frameData) {
      for (let i2 = 1; i2 < frameData.length; i2++) {
        const current = frameData[i2];
        const previous = frameData[i2 - 1];
        let velocity = current.avgWristY - previous.avgWristY;
        if (Math.abs(velocity) > MAX_VALID_VELOCITY) {
          velocity = 0;
        }
        current.wristVelocity = velocity;
      }
      if (frameData.length > 0) {
        frameData[0].wristVelocity = 0;
      }
    }
    /**
     * Finds shot start and end boundaries based on velocity patterns.
     * Uses gap tolerance to handle small breaks in upward motion.
     */
    findBoundaries(frameData, totalFrames) {
      var _a2, _b;
      const boundaries = [];
      let inShot = false;
      let shotStartFrame = -1;
      let upwardFrameCount = 0;
      let gapFrames = 0;
      let peakFrame = -1;
      let peakY = Infinity;
      let bestWristAboveShoulderDelta = Infinity;
      const startsInMotion = this.checkStartsInMotion(frameData);
      if (startsInMotion) {
        shotStartFrame = 0;
        upwardFrameCount = this.config.minUpwardFrames;
      }
      for (let i2 = 0; i2 < frameData.length; i2++) {
        const frame = frameData[i2];
        const prevFrame = i2 > 0 ? frameData[i2 - 1] : null;
        const isUpward = frame.wristVelocity < -this.config.velocityThreshold;
        const MAX_ORIGINAL_FRAME_GAP = 3;
        if (prevFrame) {
          const originalGap = frame.originalFrameIndex - prevFrame.originalFrameIndex;
          if (originalGap > MAX_ORIGINAL_FRAME_GAP) {
            if (shotStartFrame !== -1 && !inShot) {
            }
            shotStartFrame = -1;
            upwardFrameCount = 0;
            gapFrames = 0;
            peakY = Infinity;
            peakFrame = -1;
            if (inShot) {
              boundaries.push({
                type: "end",
                frameIndex: i2 - 1,
                confidence: 0.5,
                isPartial: true
              });
              inShot = false;
            }
            continue;
          }
        }
        if (!inShot) {
          if (isUpward) {
            upwardFrameCount++;
            gapFrames = 0;
            if (upwardFrameCount >= this.config.minUpwardFrames && shotStartFrame === -1) {
              shotStartFrame = this.findMotionStart(frameData, i2);
              peakY = Infinity;
              peakFrame = -1;
              bestWristAboveShoulderDelta = Infinity;
            }
            if (shotStartFrame !== -1 && frame.avgWristY < peakY) {
              peakY = frame.avgWristY;
              peakFrame = i2;
            }
            if (shotStartFrame !== -1) {
              const shoulderY = (frame.leftShoulder.y + frame.rightShoulder.y) / 2;
              const wristShoulderDelta = frame.avgWristY - shoulderY;
              if (wristShoulderDelta < bestWristAboveShoulderDelta) {
                bestWristAboveShoulderDelta = wristShoulderDelta;
              }
            }
          } else {
            gapFrames++;
            if (gapFrames > MAX_GAP_FRAMES) {
              if (shotStartFrame !== -1) {
                const startY = ((_a2 = frameData[shotStartFrame]) == null ? void 0 : _a2.avgWristY) ?? 0;
                const yRange = startY - peakY;
                const minFrames = this.config.minShotDuration / 2;
                const minYRange = 0.08;
                const hasWristAboveShoulder = bestWristAboveShoulderDelta <= MIN_WRIST_ABOVE_SHOULDER_DELTA;
                if (upwardFrameCount >= minFrames && yRange >= minYRange && hasWristAboveShoulder) {
                  const refinedStart = this.findDipStart(frameData, shotStartFrame);
                  const actualStart = refinedStart;
                  const startFrame = frameData[actualStart];
                  const startShoulderY = startFrame ? (startFrame.leftShoulder.y + startFrame.rightShoulder.y) / 2 : 0;
                  const startWristShoulderDelta = startFrame ? startFrame.avgWristY - startShoulderY : 0;
                  const wristTooHighAtStart = startWristShoulderDelta < MAX_WRIST_ABOVE_SHOULDER_AT_START;
                  if (wristTooHighAtStart) {
                    shotStartFrame = -1;
                    peakY = Infinity;
                    peakFrame = -1;
                    bestWristAboveShoulderDelta = Infinity;
                    upwardFrameCount = 0;
                    continue;
                  }
                  inShot = true;
                  boundaries.push({
                    type: "start",
                    frameIndex: actualStart,
                    confidence: this.calculateStartConfidence(
                      frameData,
                      actualStart,
                      peakFrame
                    ),
                    isPartial: actualStart === 0
                  });
                } else {
                  shotStartFrame = -1;
                  peakY = Infinity;
                  peakFrame = -1;
                  bestWristAboveShoulderDelta = Infinity;
                }
              }
              upwardFrameCount = 0;
            }
          }
        } else {
          if (frame.avgWristY < peakY) {
            peakY = frame.avgWristY;
            peakFrame = i2;
          }
          const dropFromPeak = frame.avgWristY - peakY;
          const framesSincePeak = i2 - peakFrame;
          const moderateDrop = dropFromPeak >= 0.04 && framesSincePeak >= 5;
          const significantDrop = dropFromPeak >= 0.08;
          if (moderateDrop || significantDrop) {
            const endFrameBuffer = 4;
            const endFrameIndex = Math.min(peakFrame + endFrameBuffer, i2);
            boundaries.push({
              type: "end",
              frameIndex: endFrameIndex,
              confidence: this.calculateEndConfidence(frameData, peakFrame, endFrameIndex),
              isPartial: false
            });
            inShot = false;
            shotStartFrame = -1;
            upwardFrameCount = 0;
            gapFrames = 0;
            peakFrame = -1;
            peakY = Infinity;
            bestWristAboveShoulderDelta = Infinity;
          }
        }
      }
      if (shotStartFrame !== -1 && !inShot) {
        const startY = ((_b = frameData[shotStartFrame]) == null ? void 0 : _b.avgWristY) ?? 0;
        const yRange = startY - peakY;
        const minFrames = this.config.minShotDuration / 2;
        const minYRange = 0.08;
        const hasWristAboveShoulder = bestWristAboveShoulderDelta <= MIN_WRIST_ABOVE_SHOULDER_DELTA;
        if (upwardFrameCount >= minFrames && yRange >= minYRange && hasWristAboveShoulder) {
          boundaries.push({
            type: "start",
            frameIndex: shotStartFrame,
            confidence: this.calculateStartConfidence(
              frameData,
              shotStartFrame,
              frameData.length - 1
            ),
            isPartial: shotStartFrame === 0
          });
          boundaries.push({
            type: "end",
            frameIndex: totalFrames - 1,
            confidence: 0.5,
            isPartial: true
          });
        }
      }
      if (inShot) {
        boundaries.push({
          type: "end",
          frameIndex: totalFrames - 1,
          confidence: 0.5,
          isPartial: true
        });
      }
      return boundaries;
    }
    /**
     * Finds the actual start of upward motion by looking backward from the current frame.
     * Looks for the first frame where Y starts decreasing.
     */
    findMotionStart(frameData, currentFrame) {
      const DEBUG = false;
      if (DEBUG) console.log(`DEBUG findMotionStart: currentFrame=${currentFrame}`);
      const lookback = 7;
      let startFrame = currentFrame;
      for (let i2 = currentFrame - 1; i2 >= Math.max(0, currentFrame - lookback); i2--) {
        const frame = frameData[i2];
        const nextFrame = frameData[i2 + 1];
        if (!frame || !nextFrame) break;
        if (nextFrame.wristVelocity < 0) {
          startFrame = i2;
        } else {
          break;
        }
      }
      return startFrame;
    }
    /**
     * After a shot is confirmed, look backward to find if there's a "dip" phase
     * (where the wrist moved down before the upward motion). This is the gather
     * phase of the shot and should be included in the shot boundary.
     *
     * Uses raw (unsmoothed) wrist positions to detect the dip more accurately.
     * Only adjusts the start if there's a significant gap between dip point and
     * upward start (indicating the labeler expects the dip phase to be included).
     */
    findDipStart(frameData, upwardStartFrame) {
      const DEBUG = false;
      if (DEBUG) console.log(`
DEBUG findDipStart: upwardStartFrame=${upwardStartFrame}`);
      const getRawWristY = (frame) => frame.rightWrist.y;
      const maxDipLookback = 15;
      let dipFrame = upwardStartFrame;
      let dipY = getRawWristY(frameData[upwardStartFrame]) ?? 0;
      for (let i2 = upwardStartFrame - 1; i2 >= Math.max(0, upwardStartFrame - maxDipLookback); i2--) {
        const frame = frameData[i2];
        if (!frame) break;
        const rawY = getRawWristY(frame);
        if (rawY >= dipY) {
          dipY = rawY;
          dipFrame = i2;
        } else if (rawY < dipY - 0.02) {
          break;
        }
      }
      if (dipFrame >= upwardStartFrame) {
        return upwardStartFrame;
      }
      const dipStartLookback = 15;
      let dipStartFrame = dipFrame;
      let consecutivePlateau = 0;
      const maxPlateauFrames = 8;
      for (let i2 = dipFrame - 1; i2 >= Math.max(0, dipFrame - dipStartLookback); i2--) {
        const frame = frameData[i2];
        if (!frame) break;
        const rawY = getRawWristY(frame);
        const progressFromDip = dipY - rawY;
        if (progressFromDip >= 5e-3) {
          dipStartFrame = i2;
          consecutivePlateau = 0;
        } else if (progressFromDip >= 0) {
          consecutivePlateau++;
          if (consecutivePlateau > maxPlateauFrames) {
            break;
          }
        } else {
          break;
        }
      }
      const dipStartY = getRawWristY(frameData[dipStartFrame]) ?? dipY;
      const dipMagnitude = dipY - dipStartY;
      if (dipMagnitude < 0.01) {
        return upwardStartFrame;
      }
      const largeDipThreshold = 0.05;
      const minContinuousDownFrames = 5;
      let continuousDownFrames = 0;
      let maxContinuousDownFrames = 0;
      let prevY = null;
      for (let i2 = dipStartFrame; i2 <= dipFrame; i2++) {
        const frame = frameData[i2];
        if (!frame) continue;
        const rawY = getRawWristY(frame);
        if (prevY !== null) {
          const velocity = rawY - prevY;
          if (velocity > 1e-3) {
            continuousDownFrames++;
            maxContinuousDownFrames = Math.max(maxContinuousDownFrames, continuousDownFrames);
          } else {
            continuousDownFrames = 0;
          }
        }
        prevY = rawY;
      }
      const isLargeContinuousDip = dipMagnitude >= largeDipThreshold && maxContinuousDownFrames >= minContinuousDownFrames;
      let holdFrameCount = 0;
      let holdYSum = 0;
      let holdYSumSq = 0;
      const holdThreshold = 3e-3;
      for (let i2 = dipFrame; i2 >= Math.max(0, dipFrame - 10); i2--) {
        const frame = frameData[i2];
        if (!frame) break;
        const rawY = getRawWristY(frame);
        if (Math.abs(rawY - dipY) <= holdThreshold) {
          holdFrameCount++;
          holdYSum += rawY;
          holdYSumSq += rawY * rawY;
        } else if (holdFrameCount > 0) {
          break;
        }
      }
      let holdPhaseDetected = false;
      if (holdFrameCount >= 5) {
        const mean = holdYSum / holdFrameCount;
        const variance = holdYSumSq / holdFrameCount - mean * mean;
        const stdDev = Math.sqrt(Math.max(0, variance));
        holdPhaseDetected = stdDev < 2e-3;
        if (DEBUG) {
          console.log(`  holdFrameCount=${holdFrameCount}, stdDev=${stdDev.toFixed(4)}, holdPhaseDetected=${holdPhaseDetected}`);
        }
      }
      const minDistanceToDip = 3;
      const distanceToDip = upwardStartFrame - dipFrame;
      const isDipFarEnough = distanceToDip >= minDistanceToDip;
      if (DEBUG) {
        console.log(`  dipFrame=${dipFrame}, dipStartFrame=${dipStartFrame}`);
        console.log(`  dipMagnitude=${dipMagnitude.toFixed(3)}, maxContinuousDownFrames=${maxContinuousDownFrames}`);
        console.log(`  distanceToDip=${distanceToDip}, isDipFarEnough=${isDipFarEnough}`);
        console.log(`  isLargeContinuousDip=${isLargeContinuousDip}`);
      }
      const isHoldPhaseWithDistance9 = holdPhaseDetected && distanceToDip === 9;
      if (!isLargeContinuousDip && !isHoldPhaseWithDistance9) {
        if (DEBUG) console.log(`  \u2192 returning upwardStartFrame=${upwardStartFrame} (not qualifying dip)`);
        return upwardStartFrame;
      }
      let maxAdjustment;
      if (!isDipFarEnough) {
        maxAdjustment = 8;
      } else if (isHoldPhaseWithDistance9) {
        maxAdjustment = 17;
      } else {
        maxAdjustment = 12;
      }
      if (upwardStartFrame - dipStartFrame > maxAdjustment) {
        const result = upwardStartFrame - maxAdjustment;
        if (DEBUG) console.log(`  \u2192 returning capped result=${result} (adjustment ${upwardStartFrame - dipStartFrame} > ${maxAdjustment})`);
        return result;
      }
      if (DEBUG) console.log(`  \u2192 returning dipStartFrame=${dipStartFrame}`);
      return dipStartFrame;
    }
    /**
     * Checks if the video starts in the middle of a shot motion.
     * Returns true if the first few frames show consistent upward movement.
     */
    checkStartsInMotion(frameData) {
      if (frameData.length < this.config.minUpwardFrames + 1) {
        return false;
      }
      let upwardCount = 0;
      for (let i2 = 1; i2 < Math.min(frameData.length, this.config.minUpwardFrames + 2); i2++) {
        if (frameData[i2].wristVelocity < -this.config.velocityThreshold) {
          upwardCount++;
        }
      }
      return upwardCount >= this.config.minUpwardFrames;
    }
    /**
     * Calculates confidence score for a shot start detection.
     */
    calculateStartConfidence(frameData, startFrame, endFrame) {
      let totalVelocity = 0;
      let count = 0;
      for (let i2 = startFrame + 1; i2 <= endFrame && i2 < frameData.length; i2++) {
        if (frameData[i2].wristVelocity < 0) {
          totalVelocity += Math.abs(frameData[i2].wristVelocity);
          count++;
        }
      }
      if (count === 0) return 0.5;
      const avgVelocity = totalVelocity / count;
      const confidence = Math.min(1, avgVelocity / 0.05 + 0.5);
      return Math.round(confidence * 100) / 100;
    }
    /**
     * Calculates confidence score for a shot end detection.
     */
    calculateEndConfidence(frameData, peakFrame, endFrame) {
      var _a2, _b;
      if (peakFrame < 0 || endFrame <= peakFrame) return 0.5;
      const peakY = ((_a2 = frameData[peakFrame]) == null ? void 0 : _a2.avgWristY) ?? 0;
      const endY = ((_b = frameData[endFrame]) == null ? void 0 : _b.avgWristY) ?? 0;
      const drop = endY - peakY;
      const confidence = Math.min(1, drop / 0.3 + 0.5);
      return Math.round(confidence * 100) / 100;
    }
    /**
     * Pairs start and end boundaries into complete shots.
     */
    pairBoundaries(boundaries, totalFrames) {
      const shots = [];
      const starts = boundaries.filter((b2) => b2.type === "start");
      const ends = boundaries.filter((b2) => b2.type === "end");
      for (let i2 = 0; i2 < starts.length; i2++) {
        const start = starts[i2];
        const matchingEnd = ends.find(
          (e2) => {
            var _a2;
            return e2.frameIndex > start.frameIndex && (i2 === starts.length - 1 || e2.frameIndex < (((_a2 = starts[i2 + 1]) == null ? void 0 : _a2.frameIndex) ?? totalFrames));
          }
        );
        if (matchingEnd) {
          shots.push({
            start,
            end: matchingEnd,
            isPartialStart: start.isPartial,
            isPartialEnd: matchingEnd.isPartial
          });
        }
      }
      return shots;
    }
  };

  // src/detection/types.ts
  var ShotPhase = /* @__PURE__ */ ((ShotPhase2) => {
    ShotPhase2["Gather"] = "gather";
    ShotPhase2["Load"] = "load";
    ShotPhase2["Rise"] = "rise";
    ShotPhase2["SetPoint"] = "setPoint";
    ShotPhase2["Release"] = "release";
    ShotPhase2["FollowThrough"] = "followThrough";
    return ShotPhase2;
  })(ShotPhase || {});
  var SHOT_PHASES = Object.values(ShotPhase);
  var TOTAL_SHOT_PHASES = 6;

  // src/detection/phase-detector.ts
  var DEFAULT_CONFIG3 = {
    smoothingWindowSize: 3,
    hysteresisThreshold: 0.01,
    minPhaseDuration: 2,
    handSeparationThreshold: 0.15,
    hipDropThreshold: 0.015,
    wristVelocityThreshold: -0.01
  };
  var PhaseDetector = class {
    constructor(config = {}) {
      __publicField(this, "config");
      this.config = { ...DEFAULT_CONFIG3, ...config };
    }
    /**
     * Detects all shot phases within a frame range.
     *
     * @param sequence - Array of PoseLandmarks from consecutive frames
     * @param startFrame - Starting frame index (inclusive)
     * @param endFrame - Ending frame index (inclusive)
     * @returns Phase detection result with frame ranges and confidence
     */
    detectPhases(sequence, startFrame, endFrame) {
      if (sequence.length === 0 || startFrame > endFrame) {
        return { phases: {}, confidence: 0 };
      }
      const actualStart = Math.max(0, startFrame);
      const actualEnd = Math.min(sequence.length - 1, endFrame);
      if (actualEnd - actualStart < 1) {
        return { phases: {}, confidence: 0 };
      }
      const frameData = this.analyzeFrames(sequence, actualStart, actualEnd);
      if (frameData.length < 2) {
        return { phases: {}, confidence: 0 };
      }
      const phases = this.identifyPhases(frameData, actualStart);
      for (const [phaseName, phaseRange] of Object.entries(phases)) {
        if (phaseRange && (phaseRange.startFrame < actualStart || phaseRange.endFrame > actualEnd)) {
          console.log(
            `[PhaseDetector] WARNING: Phase ${phaseName} out of bounds: ${phaseRange.startFrame}-${phaseRange.endFrame} (expected ${actualStart}-${actualEnd})`
          );
        }
      }
      const confidence = this.calculateOverallConfidence(frameData, phases);
      return { phases, confidence };
    }
    /**
     * Analyzes each frame to extract relevant metrics for phase detection.
     */
    analyzeFrames(sequence, startFrame, endFrame) {
      const frameData = [];
      const wristYValues = [];
      const wristXValues = [];
      const hipYValues = [];
      for (let i2 = startFrame; i2 <= endFrame; i2++) {
        const landmarks = sequence[i2].landmarks;
        const leftWrist = landmarks[LANDMARK_INDEX.LEFT_WRIST];
        const rightWrist = landmarks[LANDMARK_INDEX.RIGHT_WRIST];
        const leftHip = landmarks[LANDMARK_INDEX.LEFT_HIP];
        const rightHip = landmarks[LANDMARK_INDEX.RIGHT_HIP];
        wristYValues.push((leftWrist.y + rightWrist.y) / 2);
        wristXValues.push((leftWrist.x + rightWrist.x) / 2);
        hipYValues.push((leftHip.y + rightHip.y) / 2);
      }
      const smoothedWristY = this.config.smoothingWindowSize > 1 ? movingAverage(wristYValues, this.config.smoothingWindowSize) : wristYValues;
      const smoothedWristX = this.config.smoothingWindowSize > 1 ? movingAverage(wristXValues, this.config.smoothingWindowSize) : wristXValues;
      const smoothedHipY = this.config.smoothingWindowSize > 1 ? movingAverage(hipYValues, this.config.smoothingWindowSize) : hipYValues;
      for (let i2 = startFrame; i2 <= endFrame; i2++) {
        const idx = i2 - startFrame;
        const landmarks = sequence[i2].landmarks;
        const leftWrist = landmarks[LANDMARK_INDEX.LEFT_WRIST];
        const rightWrist = landmarks[LANDMARK_INDEX.RIGHT_WRIST];
        const leftIndex = landmarks[LANDMARK_INDEX.LEFT_INDEX];
        const rightIndex = landmarks[LANDMARK_INDEX.RIGHT_INDEX];
        const leftShoulder = landmarks[LANDMARK_INDEX.LEFT_SHOULDER];
        const rightShoulder = landmarks[LANDMARK_INDEX.RIGHT_SHOULDER];
        const nose = landmarks[LANDMARK_INDEX.NOSE];
        const leftEar = landmarks[LANDMARK_INDEX.LEFT_EAR];
        const rightEar = landmarks[LANDMARK_INDEX.RIGHT_EAR];
        const leftHip = landmarks[LANDMARK_INDEX.LEFT_HIP];
        const rightHip = landmarks[LANDMARK_INDEX.RIGHT_HIP];
        const leftKnee = landmarks[LANDMARK_INDEX.LEFT_KNEE];
        const rightKnee = landmarks[LANDMARK_INDEX.RIGHT_KNEE];
        const leftAnkle = landmarks[LANDMARK_INDEX.LEFT_ANKLE];
        const rightAnkle = landmarks[LANDMARK_INDEX.RIGHT_ANKLE];
        const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);
        const handDx = rightIndex.x - leftIndex.x;
        const handDy = rightIndex.y - leftIndex.y;
        const handDistance = Math.sqrt(handDx * handDx + handDy * handDy);
        const handSeparation = shoulderWidth > 0 ? handDistance / shoulderWidth : handDistance;
        const leftKneeAngle = this.calculateKneeAngle(
          leftHip,
          leftKnee,
          leftAnkle
        );
        const rightKneeAngle = this.calculateKneeAngle(
          rightHip,
          rightKnee,
          rightAnkle
        );
        const kneeAngle = (leftKneeAngle + rightKneeAngle) / 2;
        const wristVelocity = idx > 0 ? smoothedWristY[idx] - smoothedWristY[idx - 1] : 0;
        const hipVelocity = idx > 0 ? smoothedHipY[idx] - smoothedHipY[idx - 1] : 0;
        const avgConfidence = (leftWrist.confidence + rightWrist.confidence + leftHip.confidence + rightHip.confidence + leftKnee.confidence + rightKnee.confidence) / 6;
        const earX = leftEar.confidence + rightEar.confidence > 0 ? (leftEar.x * leftEar.confidence + rightEar.x * rightEar.confidence) / (leftEar.confidence + rightEar.confidence) : (leftEar.x + rightEar.x) / 2;
        const faceDir = nose.x - earX;
        frameData.push({
          frameIndex: i2,
          avgWristY: smoothedWristY[idx],
          avgWristX: smoothedWristX[idx],
          avgHipY: smoothedHipY[idx],
          kneeAngle,
          handSeparation,
          wristVelocity,
          hipVelocity,
          avgConfidence,
          faceDir
        });
      }
      return frameData;
    }
    /**
     * Calculates knee angle from hip-knee-ankle landmarks.
     */
    calculateKneeAngle(hip, knee, ankle) {
      return calculateAngle(
        { x: hip.x, y: hip.y, z: hip.z },
        { x: knee.x, y: knee.y, z: knee.z },
        { x: ankle.x, y: ankle.y, z: ankle.z }
      );
    }
    /**
     * Identifies phases from analyzed frame data.
     */
    identifyPhases(frameData, baseFrame) {
      var _a2;
      const state = {
        currentPhase: null,
        phaseStartFrame: baseFrame,
        phases: /* @__PURE__ */ new Map(),
        peakWristFrame: -1,
        peakWristY: Infinity,
        maxHipY: 0,
        maxHipFrame: -1,
        initialHipY: ((_a2 = frameData[0]) == null ? void 0 : _a2.avgHipY) ?? 0,
        handsTogetheer: false
      };
      this.findKeyPoints(frameData, state);
      this.assignPhases(frameData, state, baseFrame);
      const maxFrameIndex = baseFrame + frameData.length - 1;
      const phases = {};
      for (const [phase, range2] of state.phases) {
        phases[phase] = {
          startFrame: range2.startFrame,
          endFrame: Math.min(range2.endFrame, maxFrameIndex)
        };
      }
      return phases;
    }
    /**
     * Finds the set point: the frame where the wrists are furthest from the
     * basket, just before extending toward it to release. Searches the rise
     * (up to the wrist-height peak) for the horizontal turning point.
     *
     * Basket direction is inferred from the shooter's facing (nose vs ears),
     * which is robust for the side-on framing the app requires. Returns null
     * when there's no clear facing/horizontal signal (e.g. a frontal view or
     * synthetic data), so the caller falls back to the wrist-height peak.
     */
    findSetPointFrame(frameData, state, riseStartFrame, baseFrame) {
      if (state.peakWristFrame < 0) return null;
      const peakIdx = state.peakWristFrame - baseFrame;
      const startIdx = Math.max(
        0,
        (riseStartFrame >= 0 ? riseStartFrame : baseFrame) - baseFrame
      );
      if (peakIdx - startIdx < 2) return null;
      let faceSum = 0;
      for (let i2 = startIdx; i2 <= peakIdx; i2++) faceSum += frameData[i2].faceDir;
      const faceMean = faceSum / (peakIdx - startIdx + 1);
      const MIN_FACING = 0.02;
      if (Math.abs(faceMean) < MIN_FACING) return null;
      const basketDir = Math.sign(faceMean);
      let minX = Infinity;
      let maxX = -Infinity;
      for (let i2 = startIdx; i2 <= peakIdx; i2++) {
        const x2 = frameData[i2].avgWristX;
        if (x2 < minX) minX = x2;
        if (x2 > maxX) maxX = x2;
      }
      const MIN_TRAVEL = 0.03;
      if (maxX - minX < MIN_TRAVEL) return null;
      let bestIdx = startIdx;
      let bestVal = basketDir * frameData[startIdx].avgWristX;
      for (let i2 = startIdx + 1; i2 <= peakIdx; i2++) {
        const v2 = basketDir * frameData[i2].avgWristX;
        if (v2 < bestVal) {
          bestVal = v2;
          bestIdx = i2;
        }
      }
      const setPointFrame = baseFrame + bestIdx;
      if (setPointFrame <= (riseStartFrame >= 0 ? riseStartFrame : baseFrame)) {
        return null;
      }
      return setPointFrame;
    }
    /**
     * Finds key biomechanical points in the sequence.
     */
    findKeyPoints(frameData, state) {
      for (const frame of frameData) {
        if (frame.avgWristY < state.peakWristY) {
          state.peakWristY = frame.avgWristY;
          state.peakWristFrame = frame.frameIndex;
        }
      }
      for (const frame of frameData) {
        if (frame.frameIndex <= state.peakWristFrame) {
          if (frame.avgHipY > state.maxHipY) {
            state.maxHipY = frame.avgHipY;
            state.maxHipFrame = frame.frameIndex;
          }
        }
      }
      const minSeparation = Math.min(...frameData.map((f2) => f2.handSeparation));
      state.handsTogetheer = minSeparation < 0.5;
    }
    /**
     * Assigns phase ranges based on key points and transitions.
     */
    assignPhases(frameData, state, baseFrame) {
      const n2 = frameData.length;
      if (n2 < 3) return;
      let gatherStart = -1;
      let gatherEnd = -1;
      let loadStart = -1;
      let loadEnd = -1;
      let riseStart = -1;
      let riseEnd = -1;
      let setPointStart = -1;
      let setPointEnd = -1;
      let releaseStart = -1;
      let releaseEnd = -1;
      let followThroughStart = -1;
      let followThroughEnd = -1;
      let sustainedUpwardStart = -1;
      for (let i2 = 1; i2 < n2; i2++) {
        const frame = frameData[i2];
        if (frame.wristVelocity < this.config.wristVelocityThreshold) {
          if (sustainedUpwardStart === -1) {
            sustainedUpwardStart = i2 - 1;
          }
        } else if (sustainedUpwardStart !== -1) {
          if (i2 - sustainedUpwardStart >= 3) {
            break;
          }
          sustainedUpwardStart = -1;
        }
      }
      if (sustainedUpwardStart > 0) {
        gatherStart = baseFrame;
        gatherEnd = baseFrame + Math.max(0, sustainedUpwardStart - 1);
        if (gatherEnd - gatherStart + 1 >= this.config.minPhaseDuration) {
          state.phases.set("gather" /* Gather */, {
            startFrame: gatherStart,
            endFrame: gatherEnd
          });
        }
      }
      let hipDropStart = -1;
      let hipDropPeak = -1;
      const hipDropThreshold = this.config.hipDropThreshold;
      for (let i2 = 1; i2 < n2; i2++) {
        const frame = frameData[i2];
        if (frame.avgHipY > state.initialHipY + hipDropThreshold) {
          if (hipDropStart === -1) {
            hipDropStart = frame.frameIndex;
          }
          if (frame.avgHipY >= state.maxHipY - hipDropThreshold) {
            hipDropPeak = frame.frameIndex;
          }
        }
      }
      if (hipDropStart !== -1 && hipDropPeak !== -1 && hipDropStart < state.peakWristFrame) {
        loadStart = hipDropStart;
        loadEnd = hipDropPeak;
        if (gatherEnd !== -1 && loadStart <= gatherEnd) {
          loadStart = gatherEnd + 1;
        }
        if (loadStart <= loadEnd && loadEnd - loadStart + 1 >= this.config.minPhaseDuration) {
          state.phases.set("load" /* Load */, {
            startFrame: loadStart,
            endFrame: loadEnd
          });
        }
      }
      let consistentRiseStart = -1;
      let consistentRiseEnd = -1;
      let consecutiveUpward = 0;
      for (let i2 = 1; i2 < n2; i2++) {
        const frame = frameData[i2];
        if (frame.wristVelocity < this.config.wristVelocityThreshold && frame.frameIndex < state.peakWristFrame) {
          if (consistentRiseStart === -1) {
            consistentRiseStart = frame.frameIndex;
          }
          consecutiveUpward++;
          consistentRiseEnd = frame.frameIndex;
        } else if (consecutiveUpward > 0 && consecutiveUpward < 3) {
          consistentRiseStart = -1;
          consecutiveUpward = 0;
        }
      }
      if (consistentRiseStart !== -1 && consistentRiseEnd !== -1 && consecutiveUpward >= 3) {
        riseStart = consistentRiseStart;
        riseEnd = state.peakWristFrame;
        if (loadEnd !== -1 && riseStart <= loadEnd) {
          riseStart = loadEnd + 1;
        }
        if (riseStart <= riseEnd && riseEnd - riseStart + 1 >= this.config.minPhaseDuration) {
          state.phases.set("rise" /* Rise */, {
            startFrame: riseStart,
            endFrame: riseEnd
          });
        }
      }
      const turningFrame = this.findSetPointFrame(
        frameData,
        state,
        riseStart,
        baseFrame
      );
      if (turningFrame !== null) {
        setPointStart = turningFrame;
        setPointEnd = turningFrame;
        state.phases.set("setPoint" /* SetPoint */, {
          startFrame: turningFrame,
          endFrame: turningFrame
        });
        const rise = state.phases.get("rise" /* Rise */);
        if (rise && rise.endFrame >= turningFrame) {
          const newRiseEnd = turningFrame - 1;
          if (newRiseEnd >= rise.startFrame) {
            state.phases.set("rise" /* Rise */, {
              startFrame: rise.startFrame,
              endFrame: newRiseEnd
            });
            riseEnd = newRiseEnd;
          }
        }
      } else if (state.peakWristFrame >= 0) {
        const peakIdx = state.peakWristFrame - baseFrame;
        const peakThreshold = 0.02;
        let setStart = state.peakWristFrame;
        let setEnd = state.peakWristFrame;
        for (let i2 = peakIdx - 1; i2 >= 0; i2--) {
          const frame = frameData[i2];
          if (Math.abs(frame.avgWristY - state.peakWristY) <= peakThreshold) {
            setStart = frame.frameIndex;
          } else {
            break;
          }
        }
        for (let i2 = peakIdx + 1; i2 < n2; i2++) {
          const frame = frameData[i2];
          if (Math.abs(frame.avgWristY - state.peakWristY) <= peakThreshold) {
            setEnd = frame.frameIndex;
          } else {
            break;
          }
        }
        if (riseEnd !== -1 && setStart <= riseEnd) {
          setStart = riseEnd + 1;
        }
        setPointStart = setStart;
        setPointEnd = setEnd;
        if (setPointStart <= setPointEnd) {
          state.phases.set("setPoint" /* SetPoint */, {
            startFrame: setPointStart,
            endFrame: setPointEnd
          });
        }
      }
      let separationStart = -1;
      let separationEnd = -1;
      const typicalReleaseDuration = 3;
      if (setPointEnd !== -1) {
        separationStart = setPointEnd + 1;
        const remainingFrames = baseFrame + n2 - 1 - separationStart + 1;
        if (remainingFrames <= typicalReleaseDuration) {
          separationEnd = Math.max(
            separationStart,
            baseFrame + n2 - 1 - Math.min(2, Math.floor(remainingFrames / 2))
          );
        } else {
          separationEnd = separationStart + typicalReleaseDuration - 1;
        }
      }
      if (separationStart === -1 && state.peakWristFrame >= 0) {
        separationStart = state.peakWristFrame + 1;
        const remainingFrames = baseFrame + n2 - 1 - separationStart + 1;
        if (remainingFrames <= typicalReleaseDuration) {
          separationEnd = Math.max(
            separationStart,
            baseFrame + n2 - 1 - Math.min(2, Math.floor(remainingFrames / 2))
          );
        } else {
          separationEnd = separationStart + typicalReleaseDuration - 1;
        }
      }
      if (separationStart !== -1 && separationStart <= separationEnd) {
        releaseStart = separationStart;
        releaseEnd = separationEnd;
        if (setPointEnd !== -1 && releaseStart <= setPointEnd) {
          releaseStart = setPointEnd + 1;
        }
        if (releaseStart <= releaseEnd) {
          state.phases.set("release" /* Release */, {
            startFrame: releaseStart,
            endFrame: releaseEnd
          });
        }
      }
      let afterRelease = -1;
      if (releaseEnd !== -1) {
        afterRelease = releaseEnd + 1;
      } else if (setPointEnd !== -1) {
        afterRelease = setPointEnd + 1;
      } else if (state.peakWristFrame >= 0) {
        afterRelease = state.peakWristFrame + 1;
      }
      const lastFrameIndex = baseFrame + n2 - 1;
      if (afterRelease !== -1 && afterRelease <= lastFrameIndex) {
        followThroughStart = afterRelease;
        followThroughEnd = lastFrameIndex;
        if (releaseEnd !== -1 && followThroughStart <= releaseEnd) {
          followThroughStart = releaseEnd + 1;
        }
        const isEndOfSequence = followThroughEnd === lastFrameIndex;
        const minDuration = isEndOfSequence ? 1 : this.config.minPhaseDuration;
        if (followThroughStart <= followThroughEnd && followThroughEnd - followThroughStart + 1 >= minDuration) {
          state.phases.set("followThrough" /* FollowThrough */, {
            startFrame: followThroughStart,
            endFrame: followThroughEnd
          });
        }
      }
    }
    /**
     * Calculates overall confidence for the phase detection.
     */
    calculateOverallConfidence(frameData, phases) {
      if (frameData.length === 0) return 0;
      const avgLandmarkConfidence = frameData.reduce((sum, f2) => sum + f2.avgConfidence, 0) / frameData.length;
      const detectedPhases = Object.keys(phases).length;
      const phaseRatio = detectedPhases / 6;
      let coveredFrames = 0;
      const allFrames = /* @__PURE__ */ new Set();
      for (const frame of frameData) {
        allFrames.add(frame.frameIndex);
      }
      for (const range2 of Object.values(phases)) {
        if (range2) {
          for (let i2 = range2.startFrame; i2 <= range2.endFrame; i2++) {
            if (allFrames.has(i2)) {
              coveredFrames++;
            }
          }
        }
      }
      const coverage = allFrames.size > 0 ? coveredFrames / allFrames.size : 0;
      const confidence = avgLandmarkConfidence * 0.3 + phaseRatio * 0.4 + coverage * 0.3;
      return Math.min(1, Math.max(0, confidence));
    }
  };

  // src/keyframe-detector.ts
  var DEFAULT_CONFIG4 = {
    visibilityThreshold: 0.3,
    // Lowered from 0.5 to handle low-visibility frames in behind views
    ballLowPointSearchWindow: 0.6,
    // Expanded from 0.4 to handle behind views
    legBendSearchWindow: 0.7,
    // Expanded from 0.5 to capture jump shots with late leg bend
    riseSearchWindow: 0.6,
    smoothingWindowSize: 3,
    minConsecutiveFrames: 2,
    kneeVelocityThreshold: 0.5,
    wristVelocityThreshold: -2e-3,
    // Lowered from -0.005 to detect gradual upward motion
    setPointSearchWindow: 0.7,
    setPointMaxElbowAngle: 160,
    releaseSearchWindow: 0.5,
    groundBaselineSearchWindow: 0.4,
    ankleGroundThreshold: 0.01,
    // Lowered to detect small jumps (Jax front-right/side-left); landing uses 2x multiplier
    followThroughSearchWindow: 0.5
  };
  var diagnosticsSink = null;
  function setKeyframeDiagnosticsSink(sink) {
    diagnosticsSink = sink;
  }
  function emitDiagnostic(d2) {
    if (diagnosticsSink) diagnosticsSink(d2);
  }
  function calculateJointAngle(pointA, vertex, pointB) {
    if (!pointA || !vertex || !pointB) {
      return null;
    }
    const a2 = { x: pointA.x, y: pointA.y, z: pointA.z };
    const v2 = { x: vertex.x, y: vertex.y, z: vertex.z };
    const b2 = { x: pointB.x, y: pointB.y, z: pointB.z };
    const vA = {
      x: a2.x - v2.x,
      y: a2.y - v2.y,
      z: a2.z - v2.z
    };
    const vB = {
      x: b2.x - v2.x,
      y: b2.y - v2.y,
      z: b2.z - v2.z
    };
    const magA = Math.sqrt(vA.x * vA.x + vA.y * vA.y + vA.z * vA.z);
    const magB = Math.sqrt(vB.x * vB.x + vB.y * vB.y + vB.z * vB.z);
    if (magA === 0 || magB === 0) {
      return null;
    }
    const dotProduct = vA.x * vB.x + vA.y * vB.y + vA.z * vB.z;
    const cosAngle = Math.max(-1, Math.min(1, dotProduct / (magA * magB)));
    const angleRadians = Math.acos(cosAngle);
    const angleDegrees = angleRadians * (180 / Math.PI);
    return angleDegrees;
  }
  function calculateElbowAngle(shoulder, elbow, wrist) {
    return calculateJointAngle(shoulder, elbow, wrist);
  }
  function calculateWristAngle(elbow, wrist, indexFinger) {
    return calculateJointAngle(elbow, wrist, indexFinger);
  }
  function calculateKneeAngle(hip, knee, ankle) {
    if (!hip || !knee || !ankle) {
      return null;
    }
    const hipPoint = { x: hip.x, y: hip.y, z: hip.z };
    const kneePoint = { x: knee.x, y: knee.y, z: knee.z };
    const anklePoint = { x: ankle.x, y: ankle.y, z: ankle.z };
    const vHip = {
      x: hipPoint.x - kneePoint.x,
      y: hipPoint.y - kneePoint.y,
      z: hipPoint.z - kneePoint.z
    };
    const vAnkle = {
      x: anklePoint.x - kneePoint.x,
      y: anklePoint.y - kneePoint.y,
      z: anklePoint.z - kneePoint.z
    };
    const magHip = Math.sqrt(vHip.x * vHip.x + vHip.y * vHip.y + vHip.z * vHip.z);
    const magAnkle = Math.sqrt(
      vAnkle.x * vAnkle.x + vAnkle.y * vAnkle.y + vAnkle.z * vAnkle.z
    );
    if (magHip === 0 || magAnkle === 0) {
      return null;
    }
    const dotProduct = vHip.x * vAnkle.x + vHip.y * vAnkle.y + vHip.z * vAnkle.z;
    const cosAngle = Math.max(-1, Math.min(1, dotProduct / (magHip * magAnkle)));
    const angleRadians = Math.acos(cosAngle);
    const angleDegrees = angleRadians * (180 / Math.PI);
    return angleDegrees;
  }
  function getFrameKneeAngle(frame, visibilityThreshold) {
    if (!frame.landmarks) {
      return null;
    }
    const landmarks = frame.landmarks;
    const leftHip = landmarks[LANDMARK_INDICES.LEFT_HIP];
    const leftKnee = landmarks[LANDMARK_INDICES.LEFT_KNEE];
    const leftAnkle = landmarks[LANDMARK_INDICES.LEFT_ANKLE];
    const rightHip = landmarks[LANDMARK_INDICES.RIGHT_HIP];
    const rightKnee = landmarks[LANDMARK_INDICES.RIGHT_KNEE];
    const rightAnkle = landmarks[LANDMARK_INDICES.RIGHT_ANKLE];
    const leftVisible = leftHip && leftKnee && leftAnkle && leftHip.visibility >= visibilityThreshold && leftKnee.visibility >= visibilityThreshold && leftAnkle.visibility >= visibilityThreshold;
    const rightVisible = rightHip && rightKnee && rightAnkle && rightHip.visibility >= visibilityThreshold && rightKnee.visibility >= visibilityThreshold && rightAnkle.visibility >= visibilityThreshold;
    const leftAngle = leftVisible ? calculateKneeAngle(leftHip, leftKnee, leftAnkle) : null;
    const rightAngle = rightVisible ? calculateKneeAngle(rightHip, rightKnee, rightAnkle) : null;
    if (leftAngle !== null && rightAngle !== null) {
      return (leftAngle + rightAngle) / 2;
    } else if (leftAngle !== null) {
      return leftAngle;
    } else if (rightAngle !== null) {
      return rightAngle;
    }
    return null;
  }
  function getFrameWristY(frame, visibilityThreshold) {
    if (!frame.landmarks) {
      return null;
    }
    const landmarks = frame.landmarks;
    const leftWrist = landmarks[LANDMARK_INDICES.LEFT_WRIST];
    const rightWrist = landmarks[LANDMARK_INDICES.RIGHT_WRIST];
    const leftVisible = leftWrist && leftWrist.visibility >= visibilityThreshold;
    const rightVisible = rightWrist && rightWrist.visibility >= visibilityThreshold;
    if (leftVisible && rightVisible) {
      return (leftWrist.y + rightWrist.y) / 2;
    } else if (leftVisible) {
      return leftWrist.y;
    } else if (rightVisible) {
      return rightWrist.y;
    }
    return null;
  }
  function getFrameElbowAngle(frame, visibilityThreshold) {
    if (!frame.landmarks) {
      return null;
    }
    const landmarks = frame.landmarks;
    const leftShoulder = landmarks[LANDMARK_INDICES.LEFT_SHOULDER];
    const leftElbow = landmarks[LANDMARK_INDICES.LEFT_ELBOW];
    const leftWrist = landmarks[LANDMARK_INDICES.LEFT_WRIST];
    const rightShoulder = landmarks[LANDMARK_INDICES.RIGHT_SHOULDER];
    const rightElbow = landmarks[LANDMARK_INDICES.RIGHT_ELBOW];
    const rightWrist = landmarks[LANDMARK_INDICES.RIGHT_WRIST];
    const leftVisible = leftShoulder && leftElbow && leftWrist && leftShoulder.visibility >= visibilityThreshold && leftElbow.visibility >= visibilityThreshold && leftWrist.visibility >= visibilityThreshold;
    const rightVisible = rightShoulder && rightElbow && rightWrist && rightShoulder.visibility >= visibilityThreshold && rightElbow.visibility >= visibilityThreshold && rightWrist.visibility >= visibilityThreshold;
    const leftAngle = leftVisible ? calculateElbowAngle(leftShoulder, leftElbow, leftWrist) : null;
    const rightAngle = rightVisible ? calculateElbowAngle(rightShoulder, rightElbow, rightWrist) : null;
    if (leftAngle !== null && rightAngle !== null) {
      return (leftAngle + rightAngle) / 2;
    } else if (leftAngle !== null) {
      return leftAngle;
    } else if (rightAngle !== null) {
      return rightAngle;
    }
    return null;
  }
  function getFrameElbowAnglesPerArm(frame, visibilityThreshold) {
    if (!frame.landmarks) return { left: null, right: null };
    const lm = frame.landmarks;
    const ls2 = lm[LANDMARK_INDICES.LEFT_SHOULDER];
    const le2 = lm[LANDMARK_INDICES.LEFT_ELBOW];
    const lw = lm[LANDMARK_INDICES.LEFT_WRIST];
    const rs2 = lm[LANDMARK_INDICES.RIGHT_SHOULDER];
    const re2 = lm[LANDMARK_INDICES.RIGHT_ELBOW];
    const rw = lm[LANDMARK_INDICES.RIGHT_WRIST];
    const leftVisible = ls2 && le2 && lw && ls2.visibility >= visibilityThreshold && le2.visibility >= visibilityThreshold && lw.visibility >= visibilityThreshold;
    const rightVisible = rs2 && re2 && rw && rs2.visibility >= visibilityThreshold && re2.visibility >= visibilityThreshold && rw.visibility >= visibilityThreshold;
    return {
      left: leftVisible ? calculateElbowAngle(ls2, le2, lw) : null,
      right: rightVisible ? calculateElbowAngle(rs2, re2, rw) : null
    };
  }
  function getFrameWristAngle(frame, visibilityThreshold) {
    if (!frame.landmarks) {
      return null;
    }
    const landmarks = frame.landmarks;
    const leftElbow = landmarks[LANDMARK_INDICES.LEFT_ELBOW];
    const leftWrist = landmarks[LANDMARK_INDICES.LEFT_WRIST];
    const leftIndex = landmarks[LANDMARK_INDICES.LEFT_INDEX];
    const rightElbow = landmarks[LANDMARK_INDICES.RIGHT_ELBOW];
    const rightWrist = landmarks[LANDMARK_INDICES.RIGHT_WRIST];
    const rightIndex = landmarks[LANDMARK_INDICES.RIGHT_INDEX];
    const leftVisible = leftElbow && leftWrist && leftIndex && leftElbow.visibility >= visibilityThreshold && leftWrist.visibility >= visibilityThreshold && leftIndex.visibility >= visibilityThreshold;
    const rightVisible = rightElbow && rightWrist && rightIndex && rightElbow.visibility >= visibilityThreshold && rightWrist.visibility >= visibilityThreshold && rightIndex.visibility >= visibilityThreshold;
    const leftAngle = leftVisible ? calculateWristAngle(leftElbow, leftWrist, leftIndex) : null;
    const rightAngle = rightVisible ? calculateWristAngle(rightElbow, rightWrist, rightIndex) : null;
    if (leftAngle !== null && rightAngle !== null) {
      return (leftAngle + rightAngle) / 2;
    } else if (leftAngle !== null) {
      return leftAngle;
    } else if (rightAngle !== null) {
      return rightAngle;
    }
    return null;
  }
  function detectLegBendLowPoint(frames, startFrame, endFrame, config = DEFAULT_CONFIG4) {
    const shotDuration = endFrame - startFrame + 1;
    const searchEndFrame = startFrame + Math.floor(shotDuration * config.legBendSearchWindow);
    let minAngle = Infinity;
    let minAngleFrame = null;
    for (const frame of frames) {
      const frameIdx = frame.frameIndex;
      if (frameIdx < startFrame || frameIdx > searchEndFrame) {
        continue;
      }
      const kneeAngle = getFrameKneeAngle(frame, config.visibilityThreshold);
      if (kneeAngle !== null && kneeAngle < minAngle) {
        minAngle = kneeAngle;
        minAngleFrame = frameIdx;
      }
    }
    if (minAngleFrame === null) {
      for (const frame of frames) {
        if (frame.frameIndex >= startFrame && frame.frameIndex <= searchEndFrame) {
          if (getFrameKneeAngle(frame, config.visibilityThreshold) !== null) {
            emitDiagnostic({
              keyframe: "leg_bend_low_point",
              frame: frame.frameIndex,
              method: "no-dip-fallback",
              detail: `no clear knee-angle minimum in window ${startFrame}-${searchEndFrame}; used first valid frame`
            });
            return frame.frameIndex;
          }
        }
      }
    }
    emitDiagnostic({
      keyframe: "leg_bend_low_point",
      frame: minAngleFrame,
      method: "knee-angle-min",
      detail: `deepest knee bend (min angle ${minAngle === Infinity ? "n/a" : minAngle.toFixed(0) + "\xB0"}) in window ${startFrame}-${searchEndFrame} (legBendSearchWindow ${config.legBendSearchWindow})`
    });
    return minAngleFrame;
  }
  function detectBallLowPoint(frames, startFrame, endFrame, config = DEFAULT_CONFIG4) {
    const shotDuration = endFrame - startFrame + 1;
    const searchEndFrame = startFrame + Math.floor(shotDuration * config.ballLowPointSearchWindow);
    const findMaxWristYFrame = (visThreshold) => {
      let maxWristY = -Infinity;
      let maxWristYFrame2 = null;
      for (const frame of frames) {
        const frameIdx = frame.frameIndex;
        if (frameIdx < startFrame || frameIdx > searchEndFrame) {
          continue;
        }
        const wristY = getFrameWristY(frame, visThreshold);
        if (wristY !== null && wristY > maxWristY) {
          maxWristY = wristY;
          maxWristYFrame2 = frameIdx;
        }
      }
      return maxWristYFrame2;
    };
    let maxWristYFrame = findMaxWristYFrame(config.visibilityThreshold);
    if (config.visibilityThreshold <= 0.3) {
      const firstHalfEnd = startFrame + Math.floor((searchEndFrame - startFrame) / 2);
      if (maxWristYFrame !== null && maxWristYFrame > firstHalfEnd) {
        const lowVisFrame = findMaxWristYFrame(0.01);
        if (lowVisFrame !== null && lowVisFrame < maxWristYFrame) {
          maxWristYFrame = lowVisFrame;
        }
      }
      if (maxWristYFrame === null) {
        maxWristYFrame = findMaxWristYFrame(0.01);
      }
    }
    return maxWristYFrame;
  }
  function calculateVelocity(values) {
    const velocities = [];
    for (let i2 = 1; i2 < values.length; i2++) {
      velocities.push(values[i2] - values[i2 - 1]);
    }
    return velocities;
  }
  function calculateSmoothedVelocity(values, windowSize) {
    if (values.length < 2) {
      return [];
    }
    const smoothedValues = movingAverage(values, windowSize);
    return calculateVelocity(smoothedValues);
  }
  function detectLegsStartExtending(frames, legBendLowPointFrame, endFrame, config = DEFAULT_CONFIG4) {
    const shotDuration = endFrame - legBendLowPointFrame + 1;
    const searchEndFrame = legBendLowPointFrame + Math.floor(shotDuration * config.riseSearchWindow);
    const frameAngles = [];
    for (const frame of frames) {
      const frameIdx = frame.frameIndex;
      if (frameIdx < legBendLowPointFrame || frameIdx > searchEndFrame) {
        continue;
      }
      const kneeAngle = getFrameKneeAngle(frame, config.visibilityThreshold);
      if (kneeAngle !== null) {
        frameAngles.push({ frameIndex: frameIdx, angle: kneeAngle });
      }
    }
    if (frameAngles.length < config.minConsecutiveFrames + 1) {
      return null;
    }
    frameAngles.sort((a2, b2) => a2.frameIndex - b2.frameIndex);
    const angles = frameAngles.map((fa2) => fa2.angle);
    const smoothedVelocities = calculateSmoothedVelocity(
      angles,
      config.smoothingWindowSize
    );
    let consecutivePositive = 0;
    for (let i2 = 0; i2 < smoothedVelocities.length; i2++) {
      const velocity = smoothedVelocities[i2];
      if (velocity > config.kneeVelocityThreshold) {
        consecutivePositive++;
        if (consecutivePositive >= config.minConsecutiveFrames) {
          const startIdx = i2 - config.minConsecutiveFrames + 1;
          return frameAngles[startIdx + 1].frameIndex;
        }
      } else {
        consecutivePositive = 0;
      }
    }
    return null;
  }
  function detectBallStartsUpward(frames, ballLowPointFrame, endFrame, config = DEFAULT_CONFIG4) {
    const shotDuration = endFrame - ballLowPointFrame + 1;
    const searchEndFrame = ballLowPointFrame + Math.floor(shotDuration * config.riseSearchWindow);
    const findBallStartsUpward = (visThreshold) => {
      const framePositions = [];
      for (const frame of frames) {
        const frameIdx = frame.frameIndex;
        if (frameIdx < ballLowPointFrame || frameIdx > searchEndFrame) {
          continue;
        }
        const wristY = getFrameWristY(frame, visThreshold);
        if (wristY !== null) {
          framePositions.push({ frameIndex: frameIdx, wristY });
        }
      }
      if (framePositions.length < config.minConsecutiveFrames + 1) {
        return null;
      }
      framePositions.sort((a2, b2) => a2.frameIndex - b2.frameIndex);
      const wristYValues = framePositions.map((fp) => fp.wristY);
      const smoothedVelocities = calculateSmoothedVelocity(
        wristYValues,
        config.smoothingWindowSize
      );
      let consecutiveNegative = 0;
      for (let i2 = 0; i2 < smoothedVelocities.length; i2++) {
        const velocity = smoothedVelocities[i2];
        if (velocity < config.wristVelocityThreshold) {
          consecutiveNegative++;
          if (consecutiveNegative >= config.minConsecutiveFrames) {
            const startIdx = i2 - config.minConsecutiveFrames + 1;
            return framePositions[startIdx + 1].frameIndex;
          }
        } else {
          consecutiveNegative = 0;
        }
      }
      return null;
    };
    let result = findBallStartsUpward(config.visibilityThreshold);
    if (config.visibilityThreshold <= 0.3) {
      const expectedNearLowPoint = ballLowPointFrame + 5;
      if (result === null || result > expectedNearLowPoint + 5) {
        const lowVisResult = findBallStartsUpward(0.01);
        if (lowVisResult !== null) {
          if (result === null || lowVisResult < result) {
            result = lowVisResult;
          }
        }
      }
    }
    emitDiagnostic({
      keyframe: "ball_starts_upward",
      frame: result,
      method: "wristY-velocity",
      detail: `first sustained upward wrist motion (<${config.wristVelocityThreshold}/frame for ${config.minConsecutiveFrames} frames) after ball_low_point@${ballLowPointFrame}, window ${ballLowPointFrame}-${searchEndFrame}`
    });
    return result;
  }
  var SET_POINT_FLEX_MAX_DEG = 140;
  var SET_POINT_MIN_DEPTH_DEG = 125;
  var SET_POINT_MIN_DIP_DEG = 15;
  function detectSetPoint(frames, ballStartsUpwardFrame, endFrame, config = DEFAULT_CONFIG4) {
    const shotDuration = endFrame - ballStartsUpwardFrame + 1;
    const searchEndFrame = ballStartsUpwardFrame + Math.floor(shotDuration * config.setPointSearchWindow);
    const buildArm = (key) => {
      const raw = [];
      for (const frame of frames) {
        if (frame.frameIndex < ballStartsUpwardFrame || frame.frameIndex > searchEndFrame) {
          continue;
        }
        const a2 = getFrameElbowAnglesPerArm(
          frame,
          config.visibilityThreshold
        )[key];
        if (a2 != null) raw.push({ frameIndex: frame.frameIndex, angle: a2 });
      }
      raw.sort((a2, b2) => a2.frameIndex - b2.frameIndex);
      const sm = movingAverage(
        raw.map((p2) => p2.angle),
        config.smoothingWindowSize
      );
      return raw.map((p2, i2) => ({
        frameIndex: p2.frameIndex,
        raw: p2.angle,
        smooth: sm[i2]
      }));
    };
    const arms = {
      left: buildArm("left"),
      right: buildArm("right")
    };
    const flexRun = (pts) => {
      let best = 0;
      let cur = 0;
      for (const p2 of pts) {
        if (p2.raw < SET_POINT_FLEX_MAX_DEG) {
          cur++;
          best = Math.max(best, cur);
        } else cur = 0;
      }
      return best;
    };
    const minRaw = (pts) => pts.reduce((m2, p2) => Math.min(m2, p2.raw), Infinity);
    const jitter = (pts) => {
      if (pts.length < 3) return Infinity;
      let sum = 0;
      let n2 = 0;
      for (let i2 = 1; i2 < pts.length - 1; i2++) {
        sum += Math.abs(
          pts[i2 + 1].smooth - 2 * pts[i2].smooth + pts[i2 - 1].smooth
        );
        n2++;
      }
      return n2 === 0 ? Infinity : sum / n2;
    };
    const firstSignificantMin = (pts) => {
      var _a2, _b;
      if (pts.length < 3) return null;
      let runningMax = -Infinity;
      for (let i2 = 0; i2 < pts.length; i2++) {
        runningMax = Math.max(runningMax, pts[i2].smooth);
        const prev = ((_a2 = pts[i2 - 1]) == null ? void 0 : _a2.smooth) ?? Infinity;
        const next = ((_b = pts[i2 + 1]) == null ? void 0 : _b.smooth) ?? Infinity;
        const isLocalMin = pts[i2].smooth <= prev && pts[i2].smooth < next;
        if (isLocalMin && pts[i2].smooth < SET_POINT_FLEX_MAX_DEG && runningMax - pts[i2].smooth >= SET_POINT_MIN_DIP_DEG) {
          return pts[i2];
        }
      }
      return null;
    };
    const globalMin = (pts) => {
      let best = null;
      for (const p2 of pts) if (best === null || p2.smooth < best.smooth) best = p2;
      return best;
    };
    const candidates = ["left", "right"].filter(
      (k2) => minRaw(arms[k2]) < SET_POINT_MIN_DEPTH_DEG && flexRun(arms[k2]) >= 3
    );
    const withSig = candidates.map((k2) => ({ k: k2, sig: firstSignificantMin(arms[k2]) })).filter((c2) => c2.sig !== null);
    let shootingKey = null;
    let chosen = null;
    let how = "";
    if (withSig.length === 1) {
      shootingKey = withSig[0].k;
      chosen = withSig[0].sig;
      how = "first significant flex";
    } else if (withSig.length === 2) {
      const best = jitter(arms.left) <= jitter(arms.right) ? withSig.find((c2) => c2.k === "left") : withSig.find((c2) => c2.k === "right");
      shootingKey = best.k;
      chosen = best.sig;
      how = "first significant flex (smoother arm)";
    } else if (candidates.length > 0) {
      shootingKey = candidates.length === 1 ? candidates[0] : minRaw(arms.left) <= minRaw(arms.right) ? "left" : "right";
      chosen = globalMin(arms[shootingKey]);
      how = "deepest flex (no significant local min)";
    }
    if (shootingKey && chosen) {
      emitDiagnostic({
        keyframe: "set_point",
        frame: chosen.frameIndex,
        method: `shooting-${shootingKey}-elbow`,
        detail: `shooting arm=${shootingKey} (flex-run L ${flexRun(arms.left)} / R ${flexRun(arms.right)}, min L ${minRaw(arms.left) === Infinity ? "n/a" : minRaw(arms.left).toFixed(0) + "\xB0"} / R ${minRaw(arms.right) === Infinity ? "n/a" : minRaw(arms.right).toFixed(0) + "\xB0"}, jitter L ${jitter(arms.left).toFixed(1)} / R ${jitter(arms.right).toFixed(1)}). ${how} (${chosen.smooth.toFixed(0)}\xB0) @${chosen.frameIndex}; window ${ballStartsUpwardFrame}-${searchEndFrame}`
      });
      return chosen.frameIndex;
    }
    const avg = [];
    {
      const raw = [];
      for (const frame of frames) {
        if (frame.frameIndex < ballStartsUpwardFrame || frame.frameIndex > searchEndFrame) {
          continue;
        }
        const a2 = getFrameElbowAngle(frame, config.visibilityThreshold);
        if (a2 != null) raw.push({ frameIndex: frame.frameIndex, angle: a2 });
      }
      raw.sort((a2, b2) => a2.frameIndex - b2.frameIndex);
      const sm = movingAverage(
        raw.map((p2) => p2.angle),
        config.smoothingWindowSize
      );
      raw.forEach(
        (p2, i2) => avg.push({ frameIndex: p2.frameIndex, raw: p2.angle, smooth: sm[i2] })
      );
    }
    const avgSig = firstSignificantMin(avg);
    if (avgSig) {
      emitDiagnostic({
        keyframe: "set_point",
        frame: avgSig.frameIndex,
        method: "avg-elbow-first-flex",
        detail: `no single arm clearly cocked; averaged elbow first significant flex (${avgSig.smooth.toFixed(0)}\xB0) @${avgSig.frameIndex}, window ${ballStartsUpwardFrame}-${searchEndFrame}`
      });
      return avgSig.frameIndex;
    }
    let peak = null;
    for (const frame of frames) {
      if (frame.frameIndex < ballStartsUpwardFrame || frame.frameIndex > searchEndFrame) {
        continue;
      }
      const wy = getFrameWristY(frame, config.visibilityThreshold);
      if (wy == null) continue;
      if (peak === null || wy < peak.wristY)
        peak = { frameIndex: frame.frameIndex, wristY: wy };
    }
    if (peak === null) {
      emitDiagnostic({
        keyframe: "set_point",
        frame: null,
        method: "none",
        detail: `no elbow or wrist data in window ${ballStartsUpwardFrame}-${searchEndFrame}`
      });
      return null;
    }
    emitDiagnostic({
      keyframe: "set_point",
      frame: peak.frameIndex,
      method: "wristY-peak-fallback",
      detail: `no elbow signal; fell back to ball-height peak (min wrist Y) @${peak.frameIndex} (runs ~3-4 frames late)`
    });
    return peak.frameIndex;
  }
  function detectRelease(frames, setPointFrame, endFrame, config = DEFAULT_CONFIG4) {
    const searchStartFrame = setPointFrame + 1;
    const shotDuration = endFrame - setPointFrame + 1;
    const searchEndFrame = setPointFrame + Math.floor(shotDuration * config.releaseSearchWindow);
    const frameData = [];
    for (const frame of frames) {
      const frameIdx = frame.frameIndex;
      if (frameIdx < searchStartFrame || frameIdx > searchEndFrame) {
        continue;
      }
      const wristAngle = getFrameWristAngle(frame, config.visibilityThreshold);
      if (wristAngle !== null) {
        frameData.push({ frameIndex: frameIdx, wristAngle });
      }
    }
    if (frameData.length === 0) {
      emitDiagnostic({
        keyframe: "release",
        frame: null,
        method: "none",
        detail: `no wrist-flexion frames in window ${searchStartFrame}-${searchEndFrame}`
      });
      return null;
    }
    frameData.sort((a2, b2) => a2.frameIndex - b2.frameIndex);
    let releaseFrame = null;
    let minWristAngle = Infinity;
    for (const data of frameData) {
      if (data.wristAngle < minWristAngle) {
        minWristAngle = data.wristAngle;
        releaseFrame = data.frameIndex;
      }
    }
    emitDiagnostic({
      keyframe: "release",
      frame: releaseFrame,
      method: "wrist-flexion-peak",
      detail: `max wrist snap (min flexion angle ${minWristAngle.toFixed(0)}\xB0) after set_point@${setPointFrame}, window ${searchStartFrame}-${searchEndFrame}`
    });
    return releaseFrame;
  }
  function getFrameAnkleY(frame, visibilityThreshold) {
    if (!frame.landmarks) {
      return null;
    }
    const landmarks = frame.landmarks;
    const leftAnkle = landmarks[LANDMARK_INDICES.LEFT_ANKLE];
    const rightAnkle = landmarks[LANDMARK_INDICES.RIGHT_ANKLE];
    const leftVisible = leftAnkle && leftAnkle.visibility >= visibilityThreshold;
    const rightVisible = rightAnkle && rightAnkle.visibility >= visibilityThreshold;
    if (leftVisible && rightVisible) {
      return (leftAnkle.y + rightAnkle.y) / 2;
    } else if (leftVisible) {
      return leftAnkle.y;
    } else if (rightVisible) {
      return rightAnkle.y;
    }
    return null;
  }
  function establishGroundBaseline(frames, startFrame, endFrame, _baselineSearchWindow, visibilityThreshold) {
    const ankleData = [];
    for (const frame of frames) {
      const frameIdx = frame.frameIndex;
      if (frameIdx < startFrame || frameIdx > endFrame) {
        continue;
      }
      const ankleY = getFrameAnkleY(frame, visibilityThreshold);
      if (ankleY !== null) {
        ankleData.push({ frameIndex: frameIdx, ankleY });
      }
    }
    if (ankleData.length === 0) {
      return null;
    }
    ankleData.sort((a2, b2) => a2.frameIndex - b2.frameIndex);
    let bestMaxIdx = -1;
    let bestDescent = -Infinity;
    let bestMaxAnkleY = -Infinity;
    for (let i2 = 0; i2 < ankleData.length; i2++) {
      const currentY = ankleData[i2].ankleY;
      let minAfter = Infinity;
      for (let j2 = i2 + 1; j2 < ankleData.length; j2++) {
        if (ankleData[j2].ankleY < minAfter) {
          minAfter = ankleData[j2].ankleY;
        }
      }
      const descent = currentY - minAfter;
      if (descent > bestDescent && currentY > 0) {
        bestDescent = descent;
        bestMaxIdx = i2;
        bestMaxAnkleY = currentY;
      }
    }
    if (bestMaxIdx === -1 || bestDescent <= 0) {
      for (let i2 = 0; i2 < ankleData.length; i2++) {
        if (ankleData[i2].ankleY > bestMaxAnkleY) {
          bestMaxAnkleY = ankleData[i2].ankleY;
          bestMaxIdx = i2;
        }
      }
    }
    if (bestMaxAnkleY === -Infinity || bestMaxIdx === -1) {
      return null;
    }
    return {
      ankleY: bestMaxAnkleY,
      frameIndex: ankleData[bestMaxIdx].frameIndex
    };
  }
  function detectArmsFullyExtended(frames, releaseFrame, endFrame, config = DEFAULT_CONFIG4) {
    const shotDuration = endFrame - releaseFrame + 1;
    const searchEndFrame = releaseFrame + Math.floor(shotDuration * config.followThroughSearchWindow);
    let maxElbowAngle = -Infinity;
    let maxElbowAngleFrame = null;
    for (const frame of frames) {
      const frameIdx = frame.frameIndex;
      if (frameIdx < releaseFrame || frameIdx > searchEndFrame) {
        continue;
      }
      const elbowAngle = getFrameElbowAngle(frame, config.visibilityThreshold);
      if (elbowAngle !== null && elbowAngle > maxElbowAngle) {
        maxElbowAngle = elbowAngle;
        maxElbowAngleFrame = frameIdx;
      }
    }
    return maxElbowAngleFrame;
  }
  function detectFeetLeaveGround(frames, groundBaselineResult, startFrame, endFrame, config = DEFAULT_CONFIG4) {
    const searchStart = Math.max(startFrame, groundBaselineResult.frameIndex);
    for (const frame of frames) {
      const frameIdx = frame.frameIndex;
      if (frameIdx < searchStart || frameIdx > endFrame) {
        continue;
      }
      const ankleY = getFrameAnkleY(frame, config.visibilityThreshold);
      if (ankleY !== null) {
        const deviation = groundBaselineResult.ankleY - ankleY;
        if (deviation > config.ankleGroundThreshold) {
          return frameIdx;
        }
      }
    }
    return null;
  }
  function detectFeetLand(frames, groundBaselineResult, feetLeaveGroundFrame, endFrame, config = DEFAULT_CONFIG4) {
    if (feetLeaveGroundFrame === null) {
      return null;
    }
    const landingThreshold = config.ankleGroundThreshold * 2;
    let minAnkleY = Infinity;
    let peakFrame = feetLeaveGroundFrame;
    for (const frame of frames) {
      const frameIdx = frame.frameIndex;
      if (frameIdx <= feetLeaveGroundFrame || frameIdx > endFrame) {
        continue;
      }
      const ankleY = getFrameAnkleY(frame, config.visibilityThreshold);
      if (ankleY !== null && ankleY < minAnkleY) {
        minAnkleY = ankleY;
        peakFrame = frameIdx;
      }
    }
    for (const frame of frames) {
      const frameIdx = frame.frameIndex;
      if (frameIdx <= peakFrame || frameIdx > endFrame) {
        continue;
      }
      const ankleY = getFrameAnkleY(frame, config.visibilityThreshold);
      if (ankleY !== null) {
        const deviation = groundBaselineResult.ankleY - ankleY;
        if (deviation <= landingThreshold) {
          return frameIdx;
        }
      }
    }
    return endFrame;
  }
  var KeyframeDetector = class {
    constructor(config = {}) {
      __publicField(this, "config");
      this.config = {
        ...DEFAULT_CONFIG4,
        ...config
      };
    }
    /**
     * Detects Load phase keyframes for a shot.
     *
     * @param frames - Array of frames with pose data
     * @param startFrame - Shot start frame index (inclusive)
     * @param endFrame - Shot end frame index (inclusive)
     * @returns Detection result with keyframes and confidence
     */
    detectLoadPhaseKeyframes(frames, startFrame, endFrame) {
      const keyframes = [];
      const legBendFrame = detectLegBendLowPoint(
        frames,
        startFrame,
        endFrame,
        this.config
      );
      keyframes.push({
        keyframeId: "leg_bend_low_point",
        frameIndex: legBendFrame,
        confidence: legBendFrame !== null ? 0.8 : 0
      });
      const ballLowFrame = detectBallLowPoint(
        frames,
        startFrame,
        endFrame,
        this.config
      );
      keyframes.push({
        keyframeId: "ball_low_point",
        frameIndex: ballLowFrame,
        confidence: ballLowFrame !== null ? 0.8 : 0
      });
      const successCount = keyframes.filter((k2) => k2.frameIndex !== null).length;
      const overallConfidence = successCount / keyframes.length;
      return {
        keyframes,
        confidence: overallConfidence
      };
    }
    /**
     * Detects Rise phase keyframes for a shot.
     *
     * Requires Load phase keyframes to have been detected first,
     * as Rise phase detection starts from the Load phase low points.
     *
     * @param frames - Array of frames with pose data
     * @param legBendLowPointFrame - Frame index of leg bend low point (from Load phase)
     * @param ballLowPointFrame - Frame index of ball low point (from Load phase)
     * @param endFrame - Shot end frame index (inclusive)
     * @returns Detection result with keyframes and confidence
     */
    detectRisePhaseKeyframes(frames, legBendLowPointFrame, ballLowPointFrame, endFrame) {
      const keyframes = [];
      const legsExtendingFrame = detectLegsStartExtending(
        frames,
        legBendLowPointFrame,
        endFrame,
        this.config
      );
      keyframes.push({
        keyframeId: "legs_start_extending",
        frameIndex: legsExtendingFrame,
        confidence: legsExtendingFrame !== null ? 0.8 : 0
      });
      const ballUpwardFrame = detectBallStartsUpward(
        frames,
        ballLowPointFrame,
        endFrame,
        this.config
      );
      keyframes.push({
        keyframeId: "ball_starts_upward",
        frameIndex: ballUpwardFrame,
        confidence: ballUpwardFrame !== null ? 0.8 : 0
      });
      const successCount = keyframes.filter((k2) => k2.frameIndex !== null).length;
      const overallConfidence = successCount / keyframes.length;
      return {
        keyframes,
        confidence: overallConfidence
      };
    }
    /**
     * Detects Set Point and Release phase keyframes for a shot.
     *
     * Requires Rise phase keyframes to have been detected first,
     * as set_point detection starts from ball_starts_upward.
     *
     * @param frames - Array of frames with pose data
     * @param ballStartsUpwardFrame - Frame index where ball starts upward (from Rise phase)
     * @param endFrame - Shot end frame index (inclusive)
     * @returns Detection result with keyframes and confidence
     */
    detectSetPointReleaseKeyframes(frames, ballStartsUpwardFrame, endFrame) {
      const keyframes = [];
      const setPointFrame = detectSetPoint(
        frames,
        ballStartsUpwardFrame,
        endFrame,
        this.config
      );
      keyframes.push({
        keyframeId: "set_point",
        frameIndex: setPointFrame,
        confidence: setPointFrame !== null ? 0.8 : 0
      });
      let releaseFrame = null;
      if (setPointFrame !== null) {
        releaseFrame = detectRelease(
          frames,
          setPointFrame,
          endFrame,
          this.config
        );
      }
      keyframes.push({
        keyframeId: "release",
        frameIndex: releaseFrame,
        confidence: releaseFrame !== null ? 0.8 : 0
      });
      const successCount = keyframes.filter((k2) => k2.frameIndex !== null).length;
      const overallConfidence = successCount / keyframes.length;
      return {
        keyframes,
        confidence: overallConfidence
      };
    }
    /**
     * Detects Follow-through phase keyframes for a shot.
     *
     * Requires previous phases to have been detected first,
     * as Follow-through detection uses the release frame and ground baseline.
     *
     * @param frames - Array of frames with pose data
     * @param releaseFrame - Frame index of the release
     * @param startFrame - Shot start frame index (for ground baseline)
     * @param endFrame - Shot end frame index (inclusive)
     * @returns Detection result with keyframes and confidence
     */
    detectFollowThroughKeyframes(frames, releaseFrame, startFrame, endFrame) {
      const keyframes = [];
      const jumpSearchStart = Math.max(startFrame, releaseFrame - 10);
      const groundBaseline = establishGroundBaseline(
        frames,
        jumpSearchStart,
        endFrame,
        this.config.groundBaselineSearchWindow,
        this.config.visibilityThreshold
      );
      const armsExtendedFrame = detectArmsFullyExtended(
        frames,
        releaseFrame,
        endFrame,
        this.config
      );
      keyframes.push({
        keyframeId: "arms_fully_extended",
        frameIndex: armsExtendedFrame,
        confidence: armsExtendedFrame !== null ? 0.8 : 0
      });
      let feetLeaveGroundFrame = null;
      if (groundBaseline !== null) {
        feetLeaveGroundFrame = detectFeetLeaveGround(
          frames,
          groundBaseline,
          jumpSearchStart,
          endFrame,
          this.config
        );
      }
      keyframes.push({
        keyframeId: "feet_leave_ground",
        frameIndex: feetLeaveGroundFrame,
        // Lower confidence for feet detection since it may be null for set shots
        confidence: feetLeaveGroundFrame !== null ? 0.7 : 0
      });
      let feetLandFrame = null;
      if (groundBaseline !== null) {
        feetLandFrame = detectFeetLand(
          frames,
          groundBaseline,
          feetLeaveGroundFrame,
          endFrame,
          this.config
        );
      }
      keyframes.push({
        keyframeId: "feet_land",
        frameIndex: feetLandFrame,
        confidence: feetLandFrame !== null ? 0.7 : 0
      });
      const armsConfidence = armsExtendedFrame !== null ? 1 : 0;
      const feetConfidence = feetLeaveGroundFrame !== null && feetLandFrame !== null ? 1 : 0.5;
      const overallConfidence = armsConfidence * 0.6 + feetConfidence * 0.4;
      return {
        keyframes,
        confidence: overallConfidence
      };
    }
    /**
     * Get the current configuration.
     */
    getConfig() {
      return { ...this.config };
    }
  };
  function createKeyframeDetector(config) {
    return new KeyframeDetector(config);
  }

  // src/detection/keyframe-phases.ts
  function poseLandmarksToFrames(sequence) {
    return sequence.map((pose, frameIndex) => ({
      frameIndex,
      // The keyframe detectors key off frameIndex, not wall time; a synthetic
      // timestamp keeps the Frame shape valid without needing real fps here.
      timestamp: frameIndex,
      poseConfidence: pose.poseConfidence,
      landmarks: pose.landmarks.map((l2) => ({
        x: l2.x,
        y: l2.y,
        z: l2.z,
        visibility: l2.visibility
      }))
    }));
  }
  function detectKeyframesFromFrames(frames, startFrame, endFrame) {
    const keyframeDetector = createKeyframeDetector();
    const detectedKeyframes = /* @__PURE__ */ new Map();
    const loadResult = keyframeDetector.detectLoadPhaseKeyframes(
      frames,
      startFrame,
      endFrame
    );
    let legBendLowPointFrame = null;
    let ballLowPointFrame = null;
    for (const kf of loadResult.keyframes) {
      detectedKeyframes.set(kf.keyframeId, kf.frameIndex);
      if (kf.keyframeId === "leg_bend_low_point") {
        legBendLowPointFrame = kf.frameIndex;
      }
      if (kf.keyframeId === "ball_low_point") {
        ballLowPointFrame = kf.frameIndex;
      }
    }
    let ballStartsUpwardFrame = null;
    if (legBendLowPointFrame !== null && ballLowPointFrame !== null) {
      const riseResult = keyframeDetector.detectRisePhaseKeyframes(
        frames,
        legBendLowPointFrame,
        ballLowPointFrame,
        endFrame
      );
      for (const kf of riseResult.keyframes) {
        detectedKeyframes.set(kf.keyframeId, kf.frameIndex);
        if (kf.keyframeId === "ball_starts_upward") {
          ballStartsUpwardFrame = kf.frameIndex;
        }
      }
    } else {
      detectedKeyframes.set("legs_start_extending", null);
      detectedKeyframes.set("ball_starts_upward", null);
    }
    let releaseFrame = null;
    if (ballStartsUpwardFrame !== null) {
      const setPointReleaseResult = keyframeDetector.detectSetPointReleaseKeyframes(
        frames,
        ballStartsUpwardFrame,
        endFrame
      );
      for (const kf of setPointReleaseResult.keyframes) {
        detectedKeyframes.set(kf.keyframeId, kf.frameIndex);
        if (kf.keyframeId === "release") {
          releaseFrame = kf.frameIndex;
        }
      }
    } else {
      detectedKeyframes.set("set_point", null);
      detectedKeyframes.set("release", null);
    }
    if (releaseFrame !== null) {
      const followThroughResult = keyframeDetector.detectFollowThroughKeyframes(
        frames,
        releaseFrame,
        startFrame,
        endFrame
      );
      for (const kf of followThroughResult.keyframes) {
        detectedKeyframes.set(kf.keyframeId, kf.frameIndex);
      }
    } else {
      detectedKeyframes.set("arms_fully_extended", null);
      detectedKeyframes.set("feet_leave_ground", null);
      detectedKeyframes.set("feet_land", null);
    }
    detectedKeyframes.set("legs_start_bending", startFrame);
    return detectedKeyframes;
  }
  function range(start, end, lo2, hi2) {
    if (start == null || end == null) return null;
    const s2 = Math.max(lo2, Math.min(start, hi2));
    const e2 = Math.max(lo2, Math.min(end, hi2));
    if (s2 > e2) return null;
    return { startFrame: s2, endFrame: e2 };
  }
  function phasesFromKeyframes(keyframes, startFrame, endFrame) {
    const kf = (id) => keyframes.get(id) ?? null;
    const lo2 = startFrame;
    const hi2 = endFrame;
    const phases = {};
    const legsStartBending = kf("legs_start_bending");
    const loadEnd = kf("leg_bend_low_point") ?? kf("ball_low_point");
    const ballStartsUpward = kf("ball_starts_upward");
    const setPoint = kf("set_point");
    const release = kf("release");
    const armsExtended = kf("arms_fully_extended");
    const releaseEnd = armsExtended ?? release;
    const gather = range(startFrame, legsStartBending, lo2, hi2);
    if (gather && legsStartBending != null && legsStartBending > startFrame) {
      phases["gather" /* Gather */] = range(
        startFrame,
        legsStartBending - 1,
        lo2,
        hi2
      );
    }
    const load = range(legsStartBending, loadEnd, lo2, hi2);
    if (load) phases["load" /* Load */] = load;
    const rise = range(
      ballStartsUpward,
      setPoint != null ? setPoint - 1 : null,
      lo2,
      hi2
    );
    if (rise) phases["rise" /* Rise */] = rise;
    if (setPoint != null) {
      const sp = range(setPoint, setPoint, lo2, hi2);
      if (sp) phases["setPoint" /* SetPoint */] = sp;
    }
    const rel = range(
      setPoint != null ? setPoint + 1 : release,
      releaseEnd,
      lo2,
      hi2
    );
    if (rel) phases["release" /* Release */] = rel;
    const ftStart = rel ? rel.endFrame + 1 : null;
    const ft2 = range(ftStart, endFrame, lo2, hi2);
    if (ft2 && ftStart != null && ftStart <= endFrame) {
      phases["followThrough" /* FollowThrough */] = ft2;
    }
    return phases;
  }

  // src/detection/integrated-shot-detector.ts
  var ShotDetector = class {
    constructor(config = {}) {
      __publicField(this, "boundaryDetector");
      __publicField(this, "phaseDetector");
      __publicField(this, "useKeyframePhases");
      __publicField(this, "state");
      this.boundaryDetector = new ShotBoundaryDetector(config.boundaryConfig);
      this.phaseDetector = new PhaseDetector(config.phaseConfig);
      this.useKeyframePhases = config.useKeyframePhases ?? true;
      this.state = this.createInitialState();
    }
    /**
     * Creates the initial state for the detector.
     */
    createInitialState() {
      return {
        inShot: false,
        shotStartFrame: -1,
        currentShotIndex: 0,
        completedShots: [],
        accumulatedFrames: [],
        frameCounter: 0,
        finalized: false
      };
    }
    /**
     * Resets the detector state to start fresh.
     * Call this between separate video clips or to restart detection.
     */
    reset() {
      this.state = this.createInitialState();
    }
    /**
     * Processes a batch of frames and returns all detected shots.
     *
     * This is the main method for processing complete video files.
     * For live video processing, use processFrame() instead.
     *
     * @param sequence - Array of PoseLandmarks from consecutive frames
     * @returns Array of detected shots with phase breakdowns
     */
    processFrames(sequence) {
      if (sequence.length < 2) {
        return [];
      }
      const detectedShots = this.boundaryDetector.detectShots(sequence);
      const shots = [];
      for (let i2 = 0; i2 < detectedShots.length; i2++) {
        const detected = detectedShots[i2];
        const shot = this.createShotWithPhases(sequence, detected, i2);
        shots.push(shot);
      }
      return shots;
    }
    /**
     * Processes a single frame for incremental/live detection.
     *
     * Call this method for each frame as it arrives from a live video feed.
     * The detector maintains internal state between calls.
     *
     * @param landmarks - PoseLandmarks for the current frame
     * @returns Analysis result for the current frame
     */
    processFrame(landmarks) {
      const frameIndex = this.state.frameCounter;
      this.state.frameCounter++;
      this.state.accumulatedFrames.push(landmarks);
      this.state.finalized = false;
      const detectedShots = this.boundaryDetector.detectShots(
        this.state.accumulatedFrames
      );
      const currentShotIndex = detectedShots.length > 0 ? detectedShots.length - 1 : void 0;
      const inShot = detectedShots.length > 0 && detectedShots.some(
        (shot) => shot.start.frameIndex <= frameIndex && (shot.end.isPartial || shot.end.frameIndex >= frameIndex)
      );
      let currentPhase;
      if (inShot && detectedShots.length > 0) {
        const currentShot = detectedShots[detectedShots.length - 1];
        if (frameIndex >= currentShot.start.frameIndex) {
          const startFrame = currentShot.start.frameIndex;
          const endFrame = Math.min(
            frameIndex,
            this.state.accumulatedFrames.length - 1
          );
          if (endFrame > startFrame) {
            const phaseResult = this.phaseDetector.detectPhases(
              this.state.accumulatedFrames,
              startFrame,
              endFrame
            );
            for (const [phase, range2] of Object.entries(phaseResult.phases)) {
              if (range2 && frameIndex >= range2.startFrame && frameIndex <= range2.endFrame) {
                currentPhase = phase;
                break;
              }
            }
          }
        }
      }
      return {
        frameIndex,
        landmarks,
        currentPhase,
        inShot,
        currentShotIndex
      };
    }
    /**
     * Finalizes detection and returns all completed shots.
     *
     * Call this after all frames have been processed to get the final
     * shot list, including any partial shots at the end of the sequence.
     *
     * @returns Array of all detected shots with phase breakdowns
     */
    finalize() {
      if (this.state.accumulatedFrames.length < 2) {
        return [];
      }
      if (this.state.finalized) {
        return [...this.state.completedShots];
      }
      const shots = this.processFrames(this.state.accumulatedFrames);
      this.state.completedShots = shots;
      this.state.finalized = true;
      return shots;
    }
    /**
     * Returns currently detected shots without finalizing.
     *
     * Use this to get intermediate results during live processing.
     * Note: Results may be incomplete for in-progress shots.
     *
     * @returns Array of currently detected shots
     */
    getDetectedShots() {
      if (this.state.accumulatedFrames.length < 2) {
        return [];
      }
      const detectedShots = this.boundaryDetector.detectShots(
        this.state.accumulatedFrames
      );
      const completedShots = detectedShots.filter((shot) => !shot.end.isPartial);
      return completedShots.map(
        (detected, index) => this.createShotWithPhases(this.state.accumulatedFrames, detected, index)
      );
    }
    /**
     * Creates a Shot object with phase analysis from a detected shot boundary.
     */
    createShotWithPhases(sequence, detected, shotIndex) {
      const startFrame = detected.start.frameIndex;
      const endFrame = detected.end.frameIndex;
      const phaseResult = this.phaseDetector.detectPhases(
        sequence,
        startFrame,
        endFrame
      );
      let phases = phaseResult.phases;
      if (this.useKeyframePhases) {
        const kfFrames = poseLandmarksToFrames(sequence);
        const keyframes = detectKeyframesFromFrames(
          kfFrames,
          startFrame,
          endFrame
        );
        const kfPhases = phasesFromKeyframes(keyframes, startFrame, endFrame);
        phases = { ...phases, ...kfPhases };
      }
      const boundaryConfidence = (detected.start.confidence + detected.end.confidence) / 2;
      const overallConfidence = (boundaryConfidence + phaseResult.confidence) / 2;
      return {
        shotIndex,
        frameRange: {
          start: startFrame,
          end: endFrame
        },
        phases,
        confidence: overallConfidence
      };
    }
  };

  // src/metrics/types.ts
  function createEmptyMetricValue(frame = 0) {
    return {
      value: 0,
      unit: "",
      frame,
      confidence: 0
    };
  }
  function createEmptyShotAnalysis(shotIndex = 0) {
    return {
      shotIndex,
      frameRange: { start: 0, end: 0 },
      phases: {},
      metrics: {},
      overallConfidence: 0
    };
  }
  function createEmptyVideoMetadata() {
    return {
      width: 0,
      height: 0,
      fps: 0,
      totalFrames: 0
    };
  }
  function createEmptyAnalysisResult(config) {
    return {
      shots: [],
      videoMetadata: createEmptyVideoMetadata(),
      config
    };
  }
  function isSuccessfulMetricResult(result) {
    return result.value !== void 0;
  }
  function getAverageMetricConfidence(analysis) {
    const metrics = Object.values(analysis.metrics);
    if (metrics.length === 0) {
      return 0;
    }
    const totalConfidence = metrics.reduce(
      (sum, metric) => sum + metric.confidence,
      0
    );
    return totalConfidence / metrics.length;
  }
  function filterMetricsByConfidence(metrics, minConfidence) {
    const filtered = {};
    for (const [name, metric] of Object.entries(metrics)) {
      if (metric.confidence >= minConfidence) {
        filtered[name] = metric;
      }
    }
    return filtered;
  }

  // src/metrics/metric-orchestrator.ts
  var MetricOrchestrator = class {
    /**
     * Creates a new MetricOrchestrator.
     *
     * @param initialCalculators - Optional array of calculators to register on creation
     */
    constructor(initialCalculators = []) {
      /** Registered calculators keyed by name */
      __publicField(this, "calculators", /* @__PURE__ */ new Map());
      for (const calculator of initialCalculators) {
        this.registerCalculator(calculator);
      }
    }
    /**
     * Registers a metric calculator with the orchestrator.
     *
     * If a calculator with the same name already exists, it will be replaced.
     *
     * @param calculator - The calculator to register
     */
    registerCalculator(calculator) {
      this.calculators.set(calculator.name, calculator);
    }
    /**
     * Returns the names of all registered calculators.
     *
     * @returns Array of calculator names
     */
    getCalculatorNames() {
      return Array.from(this.calculators.keys());
    }
    /**
     * Calculates metrics from all registered calculators.
     *
     * Each calculator is invoked with the provided context. Calculators
     * that fail or throw exceptions have their errors recorded but do
     * not prevent other calculators from running.
     *
     * @param poseLandmarks - Pose landmarks for frames in the shot
     * @param frameRange - Frame range of the shot
     * @param phases - Detected phases for the shot
     * @param config - Analysis configuration
     * @returns Object containing calculated metrics and any errors
     */
    calculateMetrics(poseLandmarks, frameRange, phases, config) {
      const metrics = {};
      const errors = {};
      const context = {
        poseLandmarks,
        frameRange,
        phases,
        config
      };
      for (const [name, calculator] of this.calculators) {
        try {
          const result = calculator.calculate(context);
          if (result.value !== void 0) {
            metrics[name] = result.value;
          }
          if (result.error !== void 0) {
            errors[name] = result.error;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors[name] = `Calculator threw exception: ${errorMessage}`;
        }
      }
      return { metrics, errors };
    }
    /**
     * Analyzes a single shot using all registered calculators.
     *
     * Creates a complete ShotAnalysis including the shot's frame range,
     * phases, calculated metrics, and overall confidence score.
     *
     * @param shotIndex - Zero-based index of the shot
     * @param poseLandmarks - Pose landmarks for frames in the shot
     * @param frameRange - Frame range of the shot
     * @param phases - Detected phases for the shot
     * @param config - Analysis configuration
     * @returns Complete shot analysis
     */
    analyzeShot(shotIndex, poseLandmarks, frameRange, phases, config) {
      const { metrics } = this.calculateMetrics(
        poseLandmarks,
        frameRange,
        phases,
        config
      );
      const analysis = {
        shotIndex,
        frameRange: {
          start: frameRange.start,
          end: frameRange.end
        },
        phases,
        metrics,
        overallConfidence: 0
      };
      const overallConfidence = getAverageMetricConfidence(analysis);
      return {
        ...analysis,
        overallConfidence
      };
    }
  };

  // src/metrics/shooting-arm.ts
  var ARM_EXTENDED_THRESHOLD = 160;
  function getPoseAtFrame(poseLandmarks, frameIndex) {
    var _a2;
    const directPose = poseLandmarks.find((p2) => p2.frameIndex === frameIndex);
    if (directPose) return directPose;
    const arrayIndex = frameIndex - (poseLandmarks.length > 0 ? ((_a2 = poseLandmarks[0]) == null ? void 0 : _a2.frameIndex) ?? 0 : 0);
    if (arrayIndex >= 0 && arrayIndex < poseLandmarks.length) {
      return poseLandmarks[arrayIndex];
    }
    return void 0;
  }
  function calculateMinConfidence(landmarks) {
    if (landmarks.length === 0) return 0;
    return Math.min(...landmarks.map((l2) => l2.visibility));
  }
  function calculateBodyPlaneNormal(leftShoulder, rightShoulder, leftHip, rightHip) {
    const shoulderVector = {
      x: rightShoulder.x - leftShoulder.x,
      y: rightShoulder.y - leftShoulder.y,
      z: rightShoulder.z - leftShoulder.z
    };
    const midHip = {
      x: (leftHip.x + rightHip.x) / 2,
      y: (leftHip.y + rightHip.y) / 2,
      z: (leftHip.z + rightHip.z) / 2
    };
    const midShoulder = {
      x: (leftShoulder.x + rightShoulder.x) / 2,
      y: (leftShoulder.y + rightShoulder.y) / 2,
      z: (leftShoulder.z + rightShoulder.z) / 2
    };
    const verticalVector = {
      x: midHip.x - midShoulder.x,
      y: midHip.y - midShoulder.y,
      z: midHip.z - midShoulder.z
    };
    const normal = {
      x: shoulderVector.y * verticalVector.z - shoulderVector.z * verticalVector.y,
      y: shoulderVector.z * verticalVector.x - shoulderVector.x * verticalVector.z,
      z: shoulderVector.x * verticalVector.y - shoulderVector.y * verticalVector.x
    };
    const magnitude = Math.sqrt(
      normal.x * normal.x + normal.y * normal.y + normal.z * normal.z
    );
    if (magnitude === 0) {
      return { x: 0, y: 0, z: 1 };
    }
    return {
      x: normal.x / magnitude,
      y: normal.y / magnitude,
      z: normal.z / magnitude
    };
  }
  function calculateElbowFlareFromPlane(shoulder, elbow, bodyNormal) {
    const shoulderToElbow = {
      x: elbow.x - shoulder.x,
      y: elbow.y - shoulder.y,
      z: elbow.z - shoulder.z
    };
    const magnitude = Math.sqrt(
      shoulderToElbow.x * shoulderToElbow.x + shoulderToElbow.y * shoulderToElbow.y + shoulderToElbow.z * shoulderToElbow.z
    );
    if (magnitude === 0) return 0;
    const dotProduct = shoulderToElbow.x * bodyNormal.x + shoulderToElbow.y * bodyNormal.y + shoulderToElbow.z * bodyNormal.z;
    const sinAngle = Math.abs(dotProduct) / magnitude;
    const clampedSin = Math.max(-1, Math.min(1, sinAngle));
    const angleDegrees = Math.asin(clampedSin) * (180 / Math.PI);
    return angleDegrees;
  }
  var ShootingElbowFlareCalculator = class {
    constructor() {
      __publicField(this, "name", "shootingElbowFlare");
      __publicField(this, "description", "Angle of shooting elbow relative to body plane at release (degrees)");
      __publicField(this, "unit", "degrees");
    }
    calculate(context) {
      const { poseLandmarks, phases, config } = context;
      const mapping = getHandednessMapping(config.shootingHand);
      const releasePhase = phases["release" /* Release */];
      if (!releasePhase) {
        return { error: "Release phase not detected" };
      }
      const releasePose = getPoseAtFrame(poseLandmarks, releasePhase.startFrame);
      if (!releasePose) {
        return { error: "Pose data missing for release frame" };
      }
      const shootingShoulder = releasePose.landmarks[mapping.shootingShoulder] ?? null;
      const shootingElbow = releasePose.landmarks[mapping.shootingElbow] ?? null;
      const guideShoulder = releasePose.landmarks[mapping.guideShoulder] ?? null;
      const leftHip = releasePose.landmarks[LANDMARK_INDICES.LEFT_HIP] ?? null;
      const rightHip = releasePose.landmarks[LANDMARK_INDICES.RIGHT_HIP] ?? null;
      if (!shootingShoulder || !shootingElbow || !guideShoulder || !leftHip || !rightHip) {
        return { error: "Required landmarks missing" };
      }
      const confidence = calculateMinConfidence([
        shootingShoulder,
        shootingElbow,
        guideShoulder,
        leftHip,
        rightHip
      ]);
      const leftShoulder = config.shootingHand === "right" ? guideShoulder : shootingShoulder;
      const rightShoulder = config.shootingHand === "right" ? shootingShoulder : guideShoulder;
      const bodyNormal = calculateBodyPlaneNormal(
        leftShoulder.position,
        rightShoulder.position,
        leftHip.position,
        rightHip.position
      );
      const flareAngle = calculateElbowFlareFromPlane(
        shootingShoulder.position,
        shootingElbow.position,
        bodyNormal
      );
      const value = {
        value: Math.round(flareAngle * 10) / 10,
        // Round to 1 decimal
        unit: this.unit,
        frame: releasePhase.startFrame,
        confidence
      };
      return { value };
    }
  };
  var ShootingElbowAngleCalculator = class {
    constructor() {
      __publicField(this, "name", "shootingElbowAngle");
      __publicField(this, "description", "Bend angle at elbow (shoulder-elbow-wrist) at set point (degrees)");
      __publicField(this, "unit", "degrees");
    }
    calculate(context) {
      const { poseLandmarks, phases, config } = context;
      const mapping = getHandednessMapping(config.shootingHand);
      let targetPhase = phases["setPoint" /* SetPoint */];
      if (!targetPhase) {
        targetPhase = phases["release" /* Release */];
      }
      if (!targetPhase) {
        return { error: "SetPoint or Release phase not detected" };
      }
      const pose = getPoseAtFrame(poseLandmarks, targetPhase.startFrame);
      if (!pose) {
        return { error: "Pose data missing for target frame" };
      }
      const shoulder = pose.landmarks[mapping.shootingShoulder] ?? null;
      const elbow = pose.landmarks[mapping.shootingElbow] ?? null;
      const wrist = pose.landmarks[mapping.shootingWrist] ?? null;
      if (!shoulder || !elbow || !wrist) {
        return { error: "Required arm landmarks missing" };
      }
      const elbowAngle = calculateAngle(
        shoulder.position,
        elbow.position,
        wrist.position
      );
      const confidence = calculateMinConfidence([shoulder, elbow, wrist]);
      const value = {
        value: Math.round(elbowAngle * 10) / 10,
        unit: this.unit,
        frame: targetPhase.startFrame,
        confidence
      };
      return { value };
    }
  };
  var MaxArmExtensionCalculator = class {
    constructor() {
      __publicField(this, "name", "maxArmExtension");
      __publicField(this, "description", "Maximum elbow extension achieved during follow-through (degrees)");
      __publicField(this, "unit", "degrees");
    }
    calculate(context) {
      const { poseLandmarks, phases, config } = context;
      const mapping = getHandednessMapping(config.shootingHand);
      const followThroughPhase = phases["followThrough" /* FollowThrough */];
      if (!followThroughPhase) {
        return { error: "FollowThrough phase not detected" };
      }
      let maxExtension = 0;
      let maxExtensionFrame = followThroughPhase.startFrame;
      let minConfidence = 1;
      let foundValidFrame = false;
      for (let frameIndex = followThroughPhase.startFrame; frameIndex <= followThroughPhase.endFrame; frameIndex++) {
        const pose = getPoseAtFrame(poseLandmarks, frameIndex);
        if (!pose) continue;
        const shoulder = pose.landmarks[mapping.shootingShoulder] ?? null;
        const elbow = pose.landmarks[mapping.shootingElbow] ?? null;
        const wrist = pose.landmarks[mapping.shootingWrist] ?? null;
        if (!shoulder || !elbow || !wrist) continue;
        const confidence = calculateMinConfidence([shoulder, elbow, wrist]);
        foundValidFrame = true;
        const elbowAngle = calculateAngle(
          shoulder.position,
          elbow.position,
          wrist.position
        );
        if (elbowAngle > maxExtension) {
          maxExtension = elbowAngle;
          maxExtensionFrame = frameIndex;
          minConfidence = confidence;
        }
      }
      if (!foundValidFrame) {
        return { error: "No valid pose data in follow-through phase" };
      }
      const value = {
        value: Math.round(maxExtension * 10) / 10,
        unit: this.unit,
        frame: maxExtensionFrame,
        confidence: minConfidence
      };
      return { value };
    }
  };
  var WristSnapAngleCalculator = class {
    constructor() {
      __publicField(this, "name", "wristSnapAngle");
      __publicField(this, "description", "Wrist flexion change from set point to release (degrees)");
      __publicField(this, "unit", "degrees");
    }
    calculate(context) {
      const { poseLandmarks, phases, config } = context;
      const mapping = getHandednessMapping(config.shootingHand);
      const setPointPhase = phases["setPoint" /* SetPoint */];
      const releasePhase = phases["release" /* Release */];
      if (!setPointPhase && !releasePhase) {
        return { error: "Neither SetPoint nor Release phase detected" };
      }
      if (!releasePhase) {
        return { error: "Release phase not detected" };
      }
      const setPointFrame = (setPointPhase == null ? void 0 : setPointPhase.startFrame) ?? releasePhase.startFrame;
      const releaseFrame = releasePhase.startFrame;
      const setPointPose = getPoseAtFrame(poseLandmarks, setPointFrame);
      const releasePose = getPoseAtFrame(poseLandmarks, releaseFrame);
      if (!setPointPose || !releasePose) {
        return { error: "Pose data missing for set point or release frame" };
      }
      const fingerIndex = config.shootingHand === "right" ? LANDMARK_INDICES.RIGHT_INDEX : LANDMARK_INDICES.LEFT_INDEX;
      const setPointElbow = setPointPose.landmarks[mapping.shootingElbow] ?? null;
      const setPointWrist = setPointPose.landmarks[mapping.shootingWrist] ?? null;
      const setPointFinger = setPointPose.landmarks[fingerIndex] ?? null;
      const releaseElbow = releasePose.landmarks[mapping.shootingElbow] ?? null;
      const releaseWrist = releasePose.landmarks[mapping.shootingWrist] ?? null;
      const releaseFinger = releasePose.landmarks[fingerIndex] ?? null;
      if (!setPointElbow || !setPointWrist || !setPointFinger || !releaseElbow || !releaseWrist || !releaseFinger) {
        return { error: "Required landmarks missing for wrist snap calculation" };
      }
      const setPointWristAngle = calculateAngle(
        setPointElbow.position,
        setPointWrist.position,
        setPointFinger.position
      );
      const releaseWristAngle = calculateAngle(
        releaseElbow.position,
        releaseWrist.position,
        releaseFinger.position
      );
      const wristSnap = Math.abs(releaseWristAngle - setPointWristAngle);
      const confidence = calculateMinConfidence([
        setPointElbow,
        setPointWrist,
        setPointFinger,
        releaseElbow,
        releaseWrist,
        releaseFinger
      ]);
      const value = {
        value: Math.round(wristSnap * 10) / 10,
        unit: this.unit,
        frame: releaseFrame,
        confidence
      };
      return { value };
    }
  };
  var FollowThroughHoldCalculator = class {
    constructor() {
      __publicField(this, "name", "followThroughHold");
      __publicField(this, "description", "Duration arm stays extended during follow-through (% of shot)");
      __publicField(this, "unit", "percent");
    }
    calculate(context) {
      const { poseLandmarks, phases, config, frameRange } = context;
      const mapping = getHandednessMapping(config.shootingHand);
      const followThroughPhase = phases["followThrough" /* FollowThrough */];
      if (!followThroughPhase) {
        return { error: "FollowThrough phase not detected" };
      }
      const totalShotDuration = frameRange.end - frameRange.start + 1;
      if (totalShotDuration <= 0) {
        return { error: "Invalid shot duration" };
      }
      let extendedFrameCount = 0;
      let totalConfidence = 0;
      let validFrameCount = 0;
      for (let frameIndex = followThroughPhase.startFrame; frameIndex <= followThroughPhase.endFrame; frameIndex++) {
        const pose = getPoseAtFrame(poseLandmarks, frameIndex);
        if (!pose) continue;
        const shoulder = pose.landmarks[mapping.shootingShoulder] ?? null;
        const elbow = pose.landmarks[mapping.shootingElbow] ?? null;
        const wrist = pose.landmarks[mapping.shootingWrist] ?? null;
        if (!shoulder || !elbow || !wrist) continue;
        validFrameCount++;
        const confidence = calculateMinConfidence([shoulder, elbow, wrist]);
        totalConfidence += confidence;
        const elbowAngle = calculateAngle(
          shoulder.position,
          elbow.position,
          wrist.position
        );
        if (elbowAngle >= ARM_EXTENDED_THRESHOLD) {
          extendedFrameCount++;
        }
      }
      if (validFrameCount === 0) {
        const followThroughDuration = followThroughPhase.endFrame - followThroughPhase.startFrame + 1;
        const percentage = followThroughDuration / totalShotDuration * 100;
        const value2 = {
          value: Math.round(percentage * 10) / 10,
          unit: this.unit,
          frame: followThroughPhase.startFrame,
          confidence: 0.5
          // Low confidence due to missing data
        };
        return { value: value2 };
      }
      const holdPercentage = extendedFrameCount / totalShotDuration * 100;
      const avgConfidence = totalConfidence / validFrameCount;
      const value = {
        value: Math.round(holdPercentage * 10) / 10,
        unit: this.unit,
        frame: followThroughPhase.startFrame,
        confidence: avgConfidence
      };
      return { value };
    }
  };
  function createShootingArmCalculators() {
    return [
      new ShootingElbowFlareCalculator(),
      new ShootingElbowAngleCalculator(),
      new MaxArmExtensionCalculator(),
      new WristSnapAngleCalculator(),
      new FollowThroughHoldCalculator()
    ];
  }

  // src/metrics/guide-arm.ts
  var HAND_SEPARATION_THRESHOLD = 0.08;
  function getPoseAtFrame2(poseLandmarks, frameIndex) {
    var _a2;
    const directPose = poseLandmarks.find((p2) => p2.frameIndex === frameIndex);
    if (directPose) return directPose;
    const arrayIndex = frameIndex - (poseLandmarks.length > 0 ? ((_a2 = poseLandmarks[0]) == null ? void 0 : _a2.frameIndex) ?? 0 : 0);
    if (arrayIndex >= 0 && arrayIndex < poseLandmarks.length) {
      return poseLandmarks[arrayIndex];
    }
    return void 0;
  }
  function calculateMinConfidence2(landmarks) {
    if (landmarks.length === 0) return 0;
    return Math.min(...landmarks.map((l2) => l2.visibility));
  }
  function calculateBodyPlaneNormal2(leftShoulder, rightShoulder, leftHip, rightHip) {
    const shoulderVector = {
      x: rightShoulder.x - leftShoulder.x,
      y: rightShoulder.y - leftShoulder.y,
      z: rightShoulder.z - leftShoulder.z
    };
    const midHip = {
      x: (leftHip.x + rightHip.x) / 2,
      y: (leftHip.y + rightHip.y) / 2,
      z: (leftHip.z + rightHip.z) / 2
    };
    const midShoulder = {
      x: (leftShoulder.x + rightShoulder.x) / 2,
      y: (leftShoulder.y + rightShoulder.y) / 2,
      z: (leftShoulder.z + rightShoulder.z) / 2
    };
    const verticalVector = {
      x: midHip.x - midShoulder.x,
      y: midHip.y - midShoulder.y,
      z: midHip.z - midShoulder.z
    };
    const normal = {
      x: shoulderVector.y * verticalVector.z - shoulderVector.z * verticalVector.y,
      y: shoulderVector.z * verticalVector.x - shoulderVector.x * verticalVector.z,
      z: shoulderVector.x * verticalVector.y - shoulderVector.y * verticalVector.x
    };
    const magnitude = Math.sqrt(
      normal.x * normal.x + normal.y * normal.y + normal.z * normal.z
    );
    if (magnitude === 0) {
      return { x: 0, y: 0, z: 1 };
    }
    return {
      x: normal.x / magnitude,
      y: normal.y / magnitude,
      z: normal.z / magnitude
    };
  }
  function calculateElbowFlareFromPlane2(shoulder, elbow, bodyNormal) {
    const shoulderToElbow = {
      x: elbow.x - shoulder.x,
      y: elbow.y - shoulder.y,
      z: elbow.z - shoulder.z
    };
    const magnitude = Math.sqrt(
      shoulderToElbow.x * shoulderToElbow.x + shoulderToElbow.y * shoulderToElbow.y + shoulderToElbow.z * shoulderToElbow.z
    );
    if (magnitude === 0) return 0;
    const dotProduct = shoulderToElbow.x * bodyNormal.x + shoulderToElbow.y * bodyNormal.y + shoulderToElbow.z * bodyNormal.z;
    const sinAngle = Math.abs(dotProduct) / magnitude;
    const clampedSin = Math.max(-1, Math.min(1, sinAngle));
    const angleDegrees = Math.asin(clampedSin) * (180 / Math.PI);
    return angleDegrees;
  }
  var GuideElbowFlareCalculator = class {
    constructor() {
      __publicField(this, "name", "guideElbowFlare");
      __publicField(this, "description", "Angle of guide elbow relative to body plane at set point (degrees)");
      __publicField(this, "unit", "degrees");
    }
    calculate(context) {
      const { poseLandmarks, phases, config } = context;
      const mapping = getHandednessMapping(config.shootingHand);
      const setPointPhase = phases["setPoint" /* SetPoint */];
      if (!setPointPhase) {
        return { error: "SetPoint phase not detected" };
      }
      const setPointPose = getPoseAtFrame2(
        poseLandmarks,
        setPointPhase.startFrame
      );
      if (!setPointPose) {
        return { error: "Pose data missing for set point frame" };
      }
      const guideShoulder = setPointPose.landmarks[mapping.guideShoulder] ?? null;
      const guideElbow = setPointPose.landmarks[mapping.guideElbow] ?? null;
      const shootingShoulder = setPointPose.landmarks[mapping.shootingShoulder] ?? null;
      const leftHip = setPointPose.landmarks[LANDMARK_INDICES.LEFT_HIP] ?? null;
      const rightHip = setPointPose.landmarks[LANDMARK_INDICES.RIGHT_HIP] ?? null;
      if (!guideShoulder || !guideElbow || !shootingShoulder || !leftHip || !rightHip) {
        return { error: "Required landmarks missing" };
      }
      const confidence = calculateMinConfidence2([
        guideShoulder,
        guideElbow,
        shootingShoulder,
        leftHip,
        rightHip
      ]);
      const leftShoulder = config.shootingHand === "right" ? guideShoulder : shootingShoulder;
      const rightShoulder = config.shootingHand === "right" ? shootingShoulder : guideShoulder;
      const bodyNormal = calculateBodyPlaneNormal2(
        leftShoulder.position,
        rightShoulder.position,
        leftHip.position,
        rightHip.position
      );
      const flareAngle = calculateElbowFlareFromPlane2(
        guideShoulder.position,
        guideElbow.position,
        bodyNormal
      );
      const value = {
        value: Math.round(flareAngle * 10) / 10,
        // Round to 1 decimal
        unit: this.unit,
        frame: setPointPhase.startFrame,
        confidence
      };
      return { value };
    }
  };
  var GuideHandPositionCalculator = class {
    constructor() {
      __publicField(this, "name", "guideHandPosition");
      __publicField(this, "description", "Position of guide hand relative to ball/shooting hand at set point");
      __publicField(this, "unit", "category");
    }
    calculate(context) {
      const { poseLandmarks, phases, config } = context;
      const mapping = getHandednessMapping(config.shootingHand);
      const setPointPhase = phases["setPoint" /* SetPoint */];
      if (!setPointPhase) {
        return { error: "SetPoint phase not detected" };
      }
      const setPointPose = getPoseAtFrame2(
        poseLandmarks,
        setPointPhase.startFrame
      );
      if (!setPointPose) {
        return { error: "Pose data missing for set point frame" };
      }
      const guideWrist = setPointPose.landmarks[mapping.guideWrist] ?? null;
      const shootingWrist = setPointPose.landmarks[mapping.shootingWrist] ?? null;
      const guideIndexIdx = config.shootingHand === "right" ? LANDMARK_INDICES.LEFT_INDEX : LANDMARK_INDICES.RIGHT_INDEX;
      const guideIndex = setPointPose.landmarks[guideIndexIdx] ?? null;
      if (!guideWrist || !shootingWrist) {
        return { error: "Required wrist landmarks missing" };
      }
      const landmarks = [guideWrist, shootingWrist];
      if (guideIndex) landmarks.push(guideIndex);
      const confidence = calculateMinConfidence2(landmarks);
      const category = this.classifyPosition(
        guideWrist.position,
        shootingWrist.position,
        guideIndex == null ? void 0 : guideIndex.position,
        config.shootingHand
      );
      const value = {
        value: category,
        unit: this.unit,
        frame: setPointPhase.startFrame,
        confidence
      };
      return { value };
    }
    /**
     * Classifies the guide hand position into a category.
     */
    classifyPosition(guideWrist, shootingWrist, guideIndex, shootingHand) {
      const dx = guideWrist.x - shootingWrist.x;
      const dy = guideWrist.y - shootingWrist.y;
      const dz = guideWrist.z - shootingWrist.z;
      if (guideIndex) {
        const indexAboveWrist = guideWrist.y - guideIndex.y;
        const indexHorizontalOffset = Math.abs(guideIndex.x - guideWrist.x);
        if (indexAboveWrist > 0.05 && indexHorizontalOffset < 0.03) {
          return "thumb-up";
        }
      }
      if (Math.abs(dz) > 0.08) {
        return "front";
      }
      if (dy > 0.06) {
        return "under";
      }
      const expectedSideDirection = shootingHand === "right" ? -1 : 1;
      const horizontalOffset = dx * expectedSideDirection;
      if (horizontalOffset > 0.05) {
        return "side";
      }
      return "side";
    }
  };
  var GuideHandReleaseCalculator = class {
    constructor() {
      __publicField(this, "name", "guideHandRelease");
      __publicField(this, "description", "When guide hand releases from ball (% of shot duration)");
      __publicField(this, "unit", "percent");
    }
    calculate(context) {
      const { poseLandmarks, phases, config, frameRange } = context;
      const releasePhase = phases["release" /* Release */];
      if (!releasePhase) {
        return { error: "Release phase not detected" };
      }
      const guideIndexIdx = config.shootingHand === "right" ? LANDMARK_INDICES.LEFT_INDEX : LANDMARK_INDICES.RIGHT_INDEX;
      const shootingIndexIdx = config.shootingHand === "right" ? LANDMARK_INDICES.RIGHT_INDEX : LANDMARK_INDICES.LEFT_INDEX;
      const totalShotDuration = frameRange.end - frameRange.start + 1;
      if (totalShotDuration <= 0) {
        return { error: "Invalid shot duration" };
      }
      let separationFrame = null;
      let lastValidConfidence = 0;
      let wasInContact = false;
      for (let frameIndex = frameRange.start; frameIndex <= frameRange.end; frameIndex++) {
        const pose = getPoseAtFrame2(poseLandmarks, frameIndex);
        if (!pose) continue;
        const guideIndex = pose.landmarks[guideIndexIdx] ?? null;
        const shootingIndex = pose.landmarks[shootingIndexIdx] ?? null;
        if (!guideIndex || !shootingIndex) continue;
        const distance = calculateDistance(
          guideIndex.position,
          shootingIndex.position
        );
        if (distance < HAND_SEPARATION_THRESHOLD) {
          wasInContact = true;
          lastValidConfidence = calculateMinConfidence2([
            guideIndex,
            shootingIndex
          ]);
        }
        if (wasInContact && distance >= HAND_SEPARATION_THRESHOLD) {
          separationFrame = frameIndex;
          lastValidConfidence = calculateMinConfidence2([
            guideIndex,
            shootingIndex
          ]);
          break;
        }
      }
      if (separationFrame === null) {
        if (!wasInContact && poseLandmarks.length === 0) {
          return { error: "No pose data available" };
        }
        const value2 = {
          value: 100,
          unit: this.unit,
          frame: frameRange.end,
          confidence: lastValidConfidence || 0.5
        };
        return { value: value2 };
      }
      const framesSinceStart = separationFrame - frameRange.start;
      const percentage = framesSinceStart / totalShotDuration * 100;
      const value = {
        value: Math.round(percentage * 10) / 10,
        // Round to 1 decimal
        unit: this.unit,
        frame: separationFrame,
        confidence: lastValidConfidence || 0.5
        // Default to 0.5 if no valid frames
      };
      return { value };
    }
  };
  function createGuideArmCalculators() {
    return [
      new GuideElbowFlareCalculator(),
      new GuideHandPositionCalculator(),
      new GuideHandReleaseCalculator()
    ];
  }

  // src/metrics/ball.ts
  var DEFAULT_HAND_TOGETHER_THRESHOLD = 0.08;
  var BALL_CONFIDENCE_PENALTY = 0.8;
  function getPoseAtFrame3(poseLandmarks, frameIndex) {
    var _a2;
    const directPose = poseLandmarks.find((p2) => p2.frameIndex === frameIndex);
    if (directPose) return directPose;
    const arrayIndex = frameIndex - (poseLandmarks.length > 0 ? ((_a2 = poseLandmarks[0]) == null ? void 0 : _a2.frameIndex) ?? 0 : 0);
    if (arrayIndex >= 0 && arrayIndex < poseLandmarks.length) {
      return poseLandmarks[arrayIndex];
    }
    return void 0;
  }
  function getShoulderWidth(pose) {
    const leftShoulder = pose.landmarks[LANDMARK_INDICES.LEFT_SHOULDER];
    const rightShoulder = pose.landmarks[LANDMARK_INDICES.RIGHT_SHOULDER];
    if (!leftShoulder || !rightShoulder) {
      return 0.2;
    }
    return calculateDistance(leftShoulder.position, rightShoulder.position);
  }
  function getNosePosition(pose) {
    const nose = pose.landmarks[LANDMARK_INDICES.NOSE];
    if (!nose) return null;
    return nose.position;
  }
  var SET_POINT_HOLD_ELBOW_BAND_DEG = 18;
  function smoothAngleSeries(series, window2) {
    const half = Math.floor(window2 / 2);
    return series.map((v2, i2) => {
      if (v2 === null) return null;
      let sum = 0;
      let n2 = 0;
      for (let j2 = i2 - half; j2 <= i2 + half; j2++) {
        const x2 = series[j2];
        if (j2 >= 0 && j2 < series.length && x2 !== null && x2 !== void 0) {
          sum += x2;
          n2++;
        }
      }
      return n2 > 0 ? sum / n2 : v2;
    });
  }
  function armElbowAngle(pose, shoulderIdx, elbowIdx, wristIdx, minVisibility = 0.2) {
    const s2 = pose.landmarks[shoulderIdx];
    const e2 = pose.landmarks[elbowIdx];
    const w2 = pose.landmarks[wristIdx];
    if (!s2 || !e2 || !w2) return null;
    if (s2.visibility < minVisibility || e2.visibility < minVisibility || w2.visibility < minVisibility) {
      return null;
    }
    return calculateAngle(s2.position, e2.position, w2.position);
  }
  function pickCockedArm(pose, config) {
    const m2 = getHandednessMapping(config.shootingHand);
    const arms = [
      { shoulder: m2.shootingShoulder, elbow: m2.shootingElbow, wrist: m2.shootingWrist },
      { shoulder: m2.guideShoulder, elbow: m2.guideElbow, wrist: m2.guideWrist }
    ];
    let best = null;
    for (const arm of arms) {
      const a2 = armElbowAngle(pose, arm.shoulder, arm.elbow, arm.wrist);
      if (a2 === null) continue;
      if (best === null || a2 < best.angle) best = { arm, angle: a2 };
    }
    return (best == null ? void 0 : best.arm) ?? null;
  }
  function areHandsTogether(pose, threshold = DEFAULT_HAND_TOGETHER_THRESHOLD) {
    const leftIndex = pose.landmarks[LANDMARK_INDICES.LEFT_INDEX];
    const rightIndex = pose.landmarks[LANDMARK_INDICES.RIGHT_INDEX];
    if (!leftIndex || !rightIndex) {
      return false;
    }
    const distance = calculateDistance(leftIndex.position, rightIndex.position);
    return distance < threshold;
  }
  function inferBallCenter(pose) {
    const leftIndex = pose.landmarks[LANDMARK_INDICES.LEFT_INDEX];
    const rightIndex = pose.landmarks[LANDMARK_INDICES.RIGHT_INDEX];
    if (!leftIndex || !rightIndex) {
      return null;
    }
    if (!areHandsTogether(pose)) {
      return null;
    }
    const position = {
      x: (leftIndex.position.x + rightIndex.position.x) / 2,
      y: (leftIndex.position.y + rightIndex.position.y) / 2,
      z: (leftIndex.position.z + rightIndex.position.z) / 2
    };
    const confidence = Math.min(leftIndex.visibility, rightIndex.visibility) * BALL_CONFIDENCE_PENALTY;
    return { position, confidence };
  }
  var BallDipCalculator = class {
    constructor() {
      __publicField(this, "name", "ballDip");
      __publicField(this, "description", "How far ball drops before rising to set point (normalized to shoulder width)");
      __publicField(this, "unit", "normalized");
    }
    calculate(context) {
      const { poseLandmarks, phases, frameRange } = context;
      const startFrame = frameRange.start;
      let endFrame = frameRange.end;
      const setPointPhase = phases["setPoint" /* SetPoint */];
      if (setPointPhase) {
        endFrame = setPointPhase.startFrame;
      }
      let initialY = null;
      let lowestY = null;
      let lowestFrame = startFrame;
      let totalConfidence = 0;
      let validFrames = 0;
      let shoulderWidth = 0.2;
      for (let frameIndex = startFrame; frameIndex <= endFrame; frameIndex++) {
        const pose = getPoseAtFrame3(poseLandmarks, frameIndex);
        if (!pose) continue;
        const ballPos = inferBallCenter(pose);
        if (!ballPos) continue;
        if (validFrames === 0) {
          shoulderWidth = getShoulderWidth(pose);
        }
        if (initialY === null) {
          initialY = ballPos.position.y;
        }
        if (lowestY === null || ballPos.position.y > lowestY) {
          lowestY = ballPos.position.y;
          lowestFrame = frameIndex;
        }
        totalConfidence += ballPos.confidence;
        validFrames++;
      }
      if (validFrames === 0 || initialY === null || lowestY === null) {
        const value2 = {
          value: 0,
          unit: this.unit,
          frame: startFrame,
          confidence: 0.5
        };
        return { value: value2 };
      }
      const dip = Math.max(0, lowestY - initialY);
      const normalizedDip = dip / shoulderWidth;
      const avgConfidence = totalConfidence / validFrames;
      const value = {
        value: Math.round(normalizedDip * 100) / 100,
        // Round to 2 decimal places
        unit: this.unit,
        frame: lowestFrame,
        confidence: avgConfidence
      };
      return { value };
    }
  };
  var BallPathCalculator = class {
    constructor() {
      __publicField(this, "name", "ballPath");
      __publicField(this, "description", "Straightness of ball path to set point (deviation score, 0 = straight)");
      __publicField(this, "unit", "deviation");
    }
    calculate(context) {
      const { poseLandmarks, phases, frameRange } = context;
      const startFrame = frameRange.start;
      let endFrame = frameRange.end;
      const setPointPhase = phases["setPoint" /* SetPoint */];
      if (setPointPhase) {
        endFrame = setPointPhase.startFrame;
      }
      const positions = [];
      let totalConfidence = 0;
      let shoulderWidth = 0.2;
      for (let frameIndex = startFrame; frameIndex <= endFrame; frameIndex++) {
        const pose = getPoseAtFrame3(poseLandmarks, frameIndex);
        if (!pose) continue;
        const ballPos = inferBallCenter(pose);
        if (!ballPos) continue;
        if (positions.length === 0) {
          shoulderWidth = getShoulderWidth(pose);
        }
        positions.push({
          x: ballPos.position.x,
          y: ballPos.position.y,
          frame: frameIndex
        });
        totalConfidence += ballPos.confidence;
      }
      if (positions.length < 3) {
        const value2 = {
          value: 0,
          unit: this.unit,
          frame: startFrame,
          confidence: 0.5
        };
        return { value: value2 };
      }
      const startPos = positions[0];
      const endPos = positions[positions.length - 1];
      const lineVecX = endPos.x - startPos.x;
      const lineVecY = endPos.y - startPos.y;
      const lineLength = Math.sqrt(lineVecX * lineVecX + lineVecY * lineVecY);
      if (lineLength === 0) {
        const value2 = {
          value: 0,
          unit: this.unit,
          frame: startFrame,
          confidence: totalConfidence / positions.length
        };
        return { value: value2 };
      }
      let totalDeviation = 0;
      let maxDeviationFrame = startFrame;
      let maxDeviation = 0;
      for (let i2 = 1; i2 < positions.length - 1; i2++) {
        const pos = positions[i2];
        const toPointX = pos.x - startPos.x;
        const toPointY = pos.y - startPos.y;
        const crossProduct = toPointX * lineVecY - toPointY * lineVecX;
        const perpDistance = Math.abs(crossProduct) / lineLength;
        totalDeviation += perpDistance;
        if (perpDistance > maxDeviation) {
          maxDeviation = perpDistance;
          maxDeviationFrame = pos.frame;
        }
      }
      const avgDeviation = totalDeviation / (positions.length - 2);
      const normalizedDeviation = avgDeviation / shoulderWidth;
      const avgConfidence = totalConfidence / positions.length;
      const value = {
        value: Math.round(normalizedDeviation * 1e3) / 1e3,
        // Round to 3 decimal places
        unit: this.unit,
        frame: maxDeviationFrame,
        confidence: avgConfidence
      };
      return { value };
    }
  };
  var SetPointHeightCalculator = class {
    constructor() {
      __publicField(this, "name", "setPointHeight");
      __publicField(this, "description", "Height of ball at set point relative to head (normalized to shoulder width)");
      __publicField(this, "unit", "normalized");
    }
    calculate(context) {
      const { poseLandmarks, phases } = context;
      const setPointPhase = phases["setPoint" /* SetPoint */];
      if (!setPointPhase) {
        return { error: "SetPoint phase not detected" };
      }
      const pose = getPoseAtFrame3(poseLandmarks, setPointPhase.startFrame);
      if (!pose) {
        return { error: "Pose data missing for set point frame" };
      }
      const ballPos = inferBallCenter(pose);
      const nosePos = getNosePosition(pose);
      if (!nosePos) {
        return { error: "Nose landmark missing" };
      }
      const shoulderWidth = getShoulderWidth(pose);
      let ballY;
      let confidence;
      if (ballPos) {
        ballY = ballPos.position.y;
        confidence = ballPos.confidence;
      } else {
        const mapping = getHandednessMapping(context.config.shootingHand);
        const wrist = pose.landmarks[mapping.shootingWrist];
        if (!wrist) {
          return {
            error: "Cannot infer ball position - hands separated and wrist missing"
          };
        }
        ballY = wrist.position.y;
        confidence = wrist.visibility * BALL_CONFIDENCE_PENALTY;
      }
      const heightDiff = nosePos.y - ballY;
      const normalizedHeight = heightDiff / shoulderWidth;
      const value = {
        value: Math.round(normalizedHeight * 100) / 100,
        unit: this.unit,
        frame: setPointPhase.startFrame,
        confidence
      };
      return { value };
    }
  };
  var SetPointDurationCalculator = class {
    constructor() {
      __publicField(this, "name", "setPointDuration");
      __publicField(this, "description", "Duration ball stays at set point (milliseconds)");
      __publicField(this, "unit", "ms");
    }
    calculate(context) {
      var _a2, _b;
      const { poseLandmarks, phases, config } = context;
      const setPointPhase = phases["setPoint" /* SetPoint */];
      if (!setPointPhase) {
        return { error: "SetPoint phase not detected" };
      }
      const setFrame = setPointPhase.startFrame;
      const setPose = getPoseAtFrame3(poseLandmarks, setFrame);
      const arm = setPose ? pickCockedArm(setPose, config) : null;
      const setAngle = setPose && arm ? armElbowAngle(setPose, arm.shoulder, arm.elbow, arm.wrist) : null;
      let holdStart = setFrame;
      let holdEnd = setFrame;
      if (setAngle !== null && arm) {
        const band = SET_POINT_HOLD_ELBOW_BAND_DEG;
        const raw = poseLandmarks.map(
          (p2) => armElbowAngle(p2, arm.shoulder, arm.elbow, arm.wrist)
        );
        const smooth = smoothAngleSeries(raw, 3);
        const setIdx = poseLandmarks.findIndex((p2) => p2.frameIndex === setFrame);
        if (setIdx >= 0) {
          const ref = smooth[setIdx];
          if (ref !== null && ref !== void 0) {
            holdStart = setFrame;
            holdEnd = setFrame;
            for (let i2 = setIdx - 1; i2 >= 0; i2--) {
              const a2 = smooth[i2];
              if (a2 === null || a2 === void 0 || Math.abs(a2 - ref) > band) break;
              holdStart = poseLandmarks[i2].frameIndex;
            }
            for (let i2 = setIdx + 1; i2 < smooth.length; i2++) {
              const a2 = smooth[i2];
              if (a2 === null || a2 === void 0 || Math.abs(a2 - ref) > band) break;
              holdEnd = poseLandmarks[i2].frameIndex;
            }
          }
        }
      }
      const durationFrames = holdEnd - holdStart + 1;
      let durationMs;
      const startPose = getPoseAtFrame3(poseLandmarks, holdStart);
      const endPose = getPoseAtFrame3(poseLandmarks, holdEnd);
      if (startPose && endPose && endPose.timestamp > startPose.timestamp) {
        durationMs = endPose.timestamp - startPose.timestamp;
      } else if (poseLandmarks.length >= 2) {
        const fps = 1e3 / Math.max(
          1,
          (((_a2 = poseLandmarks[1]) == null ? void 0 : _a2.timestamp) ?? 33.33) - (((_b = poseLandmarks[0]) == null ? void 0 : _b.timestamp) ?? 0)
        );
        durationMs = durationFrames / fps * 1e3;
      } else {
        durationMs = durationFrames / 30 * 1e3;
      }
      durationMs = Math.max(durationMs, durationFrames / 30 * 1e3);
      let confidence = 0.8;
      if (startPose && endPose) {
        confidence = Math.min(startPose.confidence, endPose.confidence) * BALL_CONFIDENCE_PENALTY;
      }
      const value = {
        value: Math.round(durationMs),
        unit: this.unit,
        frame: holdStart,
        confidence
      };
      return { value };
    }
  };
  var ReleasePointCalculator = class {
    constructor() {
      __publicField(this, "name", "releasePoint");
      __publicField(this, "description", "Ball height at release point relative to head (normalized to shoulder width)");
      __publicField(this, "unit", "normalized");
    }
    calculate(context) {
      const { poseLandmarks, phases, config } = context;
      const releasePhase = phases["release" /* Release */];
      if (!releasePhase) {
        return { error: "Release phase not detected" };
      }
      const pose = getPoseAtFrame3(poseLandmarks, releasePhase.startFrame);
      if (!pose) {
        return { error: "Pose data missing for release frame" };
      }
      const nosePos = getNosePosition(pose);
      if (!nosePos) {
        return { error: "Nose landmark missing" };
      }
      const shoulderWidth = getShoulderWidth(pose);
      const ballPos = inferBallCenter(pose);
      let releaseY;
      let confidence;
      if (ballPos) {
        releaseY = ballPos.position.y;
        confidence = ballPos.confidence;
      } else {
        const mapping = getHandednessMapping(config.shootingHand);
        const wrist = pose.landmarks[mapping.shootingWrist];
        if (!wrist) {
          return { error: "Cannot determine release point - wrist missing" };
        }
        releaseY = wrist.position.y;
        confidence = wrist.visibility * BALL_CONFIDENCE_PENALTY;
      }
      const heightDiff = nosePos.y - releaseY;
      const normalizedHeight = heightDiff / shoulderWidth;
      const value = {
        value: Math.round(normalizedHeight * 100) / 100,
        unit: this.unit,
        frame: releasePhase.startFrame,
        confidence
      };
      return { value };
    }
  };
  var ReleaseAngleCalculator = class {
    constructor() {
      __publicField(this, "name", "releaseAngle");
      __publicField(this, "description", "Angle of shooting arm at release point (degrees from horizontal)");
      __publicField(this, "unit", "degrees");
    }
    calculate(context) {
      const { poseLandmarks, phases, config } = context;
      const mapping = getHandednessMapping(config.shootingHand);
      const releasePhase = phases["release" /* Release */];
      if (!releasePhase) {
        return { error: "Release phase not detected" };
      }
      const pose = getPoseAtFrame3(poseLandmarks, releasePhase.startFrame);
      if (!pose) {
        return { error: "Pose data missing for release frame" };
      }
      const shoulder = pose.landmarks[mapping.shootingShoulder];
      const wrist = pose.landmarks[mapping.shootingWrist];
      if (!shoulder || !wrist) {
        return { error: "Required arm landmarks missing" };
      }
      const dx = wrist.position.x - shoulder.position.x;
      const dy = shoulder.position.y - wrist.position.y;
      let angleRadians = Math.atan2(dy, Math.abs(dx));
      let angleDegrees = angleRadians * (180 / Math.PI);
      angleDegrees = Math.abs(angleDegrees);
      const confidence = Math.min(shoulder.visibility, wrist.visibility) * BALL_CONFIDENCE_PENALTY;
      const value = {
        value: Math.round(angleDegrees * 10) / 10,
        unit: this.unit,
        frame: releasePhase.startFrame,
        confidence
      };
      return { value };
    }
  };
  var BallBehindHeadCalculator = class {
    constructor() {
      __publicField(this, "name", "ballBehindHead");
      __publicField(this, "description", "Furthest back position of ball relative to head (normalized to shoulder width)");
      __publicField(this, "unit", "normalized");
    }
    calculate(context) {
      const { poseLandmarks, phases, frameRange, config } = context;
      const startFrame = frameRange.start;
      let endFrame = frameRange.end;
      const releasePhase = phases["release" /* Release */];
      if (releasePhase) {
        endFrame = releasePhase.startFrame;
      }
      const behindDirection = config.shootingHand === "right" ? 1 : -1;
      let maxBehindDistance = 0;
      let maxBehindFrame = startFrame;
      let totalConfidence = 0;
      let validFrames = 0;
      let shoulderWidth = 0.2;
      for (let frameIndex = startFrame; frameIndex <= endFrame; frameIndex++) {
        const pose = getPoseAtFrame3(poseLandmarks, frameIndex);
        if (!pose) continue;
        const ballPos = inferBallCenter(pose);
        if (!ballPos) continue;
        const nosePos = getNosePosition(pose);
        if (!nosePos) continue;
        if (validFrames === 0) {
          shoulderWidth = getShoulderWidth(pose);
        }
        const behindDistance = (ballPos.position.x - nosePos.x) * behindDirection;
        if (behindDistance > maxBehindDistance) {
          maxBehindDistance = behindDistance;
          maxBehindFrame = frameIndex;
        }
        totalConfidence += ballPos.confidence;
        validFrames++;
      }
      const normalizedDistance = maxBehindDistance / shoulderWidth;
      const clampedDistance = Math.max(0, normalizedDistance);
      const avgConfidence = validFrames > 0 ? totalConfidence / validFrames : 0.5;
      const value = {
        value: Math.round(clampedDistance * 100) / 100,
        unit: this.unit,
        frame: maxBehindFrame,
        confidence: avgConfidence
      };
      return { value };
    }
  };
  function createBallMetricCalculators() {
    return [
      new BallDipCalculator(),
      new BallPathCalculator(),
      new SetPointHeightCalculator(),
      new SetPointDurationCalculator(),
      new ReleasePointCalculator(),
      new ReleaseAngleCalculator(),
      new BallBehindHeadCalculator()
    ];
  }

  // src/metrics/lower-body.ts
  var EXTENSION_ANGLE_THRESHOLD = 3;
  function getPoseAtFrame4(poseLandmarks, frameIndex) {
    var _a2;
    const directPose = poseLandmarks.find((p2) => p2.frameIndex === frameIndex);
    if (directPose) return directPose;
    const arrayIndex = frameIndex - (poseLandmarks.length > 0 ? ((_a2 = poseLandmarks[0]) == null ? void 0 : _a2.frameIndex) ?? 0 : 0);
    if (arrayIndex >= 0 && arrayIndex < poseLandmarks.length) {
      return poseLandmarks[arrayIndex];
    }
    return void 0;
  }
  function calculateMinConfidence3(landmarks) {
    if (landmarks.length === 0) return 0;
    return Math.min(...landmarks.map((l2) => l2.visibility));
  }
  function getAverageHipY(leftHip, rightHip) {
    return (leftHip.position.y + rightHip.position.y) / 2;
  }
  function getShoulderWidth2(leftShoulder, rightShoulder) {
    return calculateDistance(leftShoulder.position, rightShoulder.position);
  }
  function getAverageKneeAngle(leftHip, leftKnee, leftAnkle, rightHip, rightKnee, rightAnkle) {
    const leftAngle = calculateAngle(
      leftHip.position,
      leftKnee.position,
      leftAnkle.position
    );
    const rightAngle = calculateAngle(
      rightHip.position,
      rightKnee.position,
      rightAnkle.position
    );
    return (leftAngle + rightAngle) / 2;
  }
  var HipDropCalculator = class {
    constructor() {
      __publicField(this, "name", "hipDrop");
      __publicField(this, "description", "How far hips drop in load phase (normalized to shoulder width)");
      __publicField(this, "unit", "ratio");
    }
    calculate(context) {
      const { poseLandmarks, phases, frameRange } = context;
      const loadPhase = phases["load" /* Load */];
      if (!loadPhase) {
        return { error: "Load phase not detected" };
      }
      const initialPose = getPoseAtFrame4(poseLandmarks, frameRange.start);
      if (!initialPose) {
        return { error: "Pose data missing for initial frame" };
      }
      const initialLeftHip = initialPose.landmarks[LANDMARK_INDICES.LEFT_HIP] ?? null;
      const initialRightHip = initialPose.landmarks[LANDMARK_INDICES.RIGHT_HIP] ?? null;
      const leftShoulder = initialPose.landmarks[LANDMARK_INDICES.LEFT_SHOULDER] ?? null;
      const rightShoulder = initialPose.landmarks[LANDMARK_INDICES.RIGHT_SHOULDER] ?? null;
      if (!initialLeftHip || !initialRightHip || !leftShoulder || !rightShoulder) {
        return { error: "Required landmarks missing for initial frame" };
      }
      const shoulderWidth = getShoulderWidth2(leftShoulder, rightShoulder);
      if (shoulderWidth === 0) {
        return { error: "Cannot calculate shoulder width" };
      }
      let maxHipDrop = 0;
      let maxDropFrame = loadPhase.startFrame;
      let minConfidence = 1;
      let foundValidFrame = false;
      const initialHipY = getAverageHipY(initialLeftHip, initialRightHip);
      for (let frameIndex = loadPhase.startFrame; frameIndex <= loadPhase.endFrame; frameIndex++) {
        const pose = getPoseAtFrame4(poseLandmarks, frameIndex);
        if (!pose) continue;
        const leftHip = pose.landmarks[LANDMARK_INDICES.LEFT_HIP] ?? null;
        const rightHip = pose.landmarks[LANDMARK_INDICES.RIGHT_HIP] ?? null;
        if (!leftHip || !rightHip) continue;
        foundValidFrame = true;
        const confidence = calculateMinConfidence3([leftHip, rightHip]);
        const currentHipY = getAverageHipY(leftHip, rightHip);
        const hipDrop = currentHipY - initialHipY;
        if (hipDrop > maxHipDrop) {
          maxHipDrop = hipDrop;
          maxDropFrame = frameIndex;
          minConfidence = confidence;
        }
      }
      if (!foundValidFrame) {
        return { error: "No valid pose data in load phase" };
      }
      const normalizedDrop = maxHipDrop / shoulderWidth;
      const value = {
        value: Math.round(normalizedDrop * 100) / 100,
        // Round to 2 decimals
        unit: this.unit,
        frame: maxDropFrame,
        confidence: minConfidence
      };
      return { value };
    }
  };
  var KneeFlexionCalculator = class {
    constructor() {
      __publicField(this, "name", "kneeFlexion");
      __publicField(this, "description", "Maximum knee bend angle at load phase (degrees, 180 = straight)");
      __publicField(this, "unit", "degrees");
    }
    calculate(context) {
      const { poseLandmarks, phases } = context;
      const loadPhase = phases["load" /* Load */];
      if (!loadPhase) {
        return { error: "Load phase not detected" };
      }
      let minAngle = 180;
      let minAngleFrame = loadPhase.startFrame;
      let minConfidence = 1;
      let foundValidFrame = false;
      for (let frameIndex = loadPhase.startFrame; frameIndex <= loadPhase.endFrame; frameIndex++) {
        const pose = getPoseAtFrame4(poseLandmarks, frameIndex);
        if (!pose) continue;
        const leftHip = pose.landmarks[LANDMARK_INDICES.LEFT_HIP] ?? null;
        const leftKnee = pose.landmarks[LANDMARK_INDICES.LEFT_KNEE] ?? null;
        const leftAnkle = pose.landmarks[LANDMARK_INDICES.LEFT_ANKLE] ?? null;
        const rightHip = pose.landmarks[LANDMARK_INDICES.RIGHT_HIP] ?? null;
        const rightKnee = pose.landmarks[LANDMARK_INDICES.RIGHT_KNEE] ?? null;
        const rightAnkle = pose.landmarks[LANDMARK_INDICES.RIGHT_ANKLE] ?? null;
        if (!leftHip || !leftKnee || !leftAnkle || !rightHip || !rightKnee || !rightAnkle) {
          continue;
        }
        foundValidFrame = true;
        const avgAngle = getAverageKneeAngle(
          leftHip,
          leftKnee,
          leftAnkle,
          rightHip,
          rightKnee,
          rightAnkle
        );
        const confidence = calculateMinConfidence3([
          leftHip,
          leftKnee,
          leftAnkle,
          rightHip,
          rightKnee,
          rightAnkle
        ]);
        if (avgAngle <= minAngle) {
          minAngle = avgAngle;
          minAngleFrame = frameIndex;
          minConfidence = confidence;
        }
      }
      if (!foundValidFrame) {
        return { error: "No valid pose data in load phase" };
      }
      const value = {
        value: Math.round(minAngle * 10) / 10,
        // Round to 1 decimal
        unit: this.unit,
        frame: minAngleFrame,
        confidence: minConfidence
      };
      return { value };
    }
  };
  var LegExtensionStartCalculator = class {
    constructor() {
      __publicField(this, "name", "legExtensionStart");
      __publicField(this, "description", "When legs begin extending (% of shot duration)");
      __publicField(this, "unit", "percent");
    }
    calculate(context) {
      const { poseLandmarks, phases, frameRange } = context;
      const risePhase = phases["rise" /* Rise */];
      const releasePhase = phases["release" /* Release */];
      if (!risePhase && !releasePhase) {
        return { error: "Rise or Release phase not detected" };
      }
      const totalShotDuration = frameRange.end - frameRange.start + 1;
      if (totalShotDuration <= 0) {
        return { error: "Invalid shot duration" };
      }
      let previousAngle = null;
      let minAngleFrame = frameRange.start;
      let minAngle = 180;
      let minAngleConfidence = 0.5;
      let extensionStartFrame = null;
      let extensionConfidence = 0.5;
      for (let frameIndex = frameRange.start; frameIndex <= frameRange.end; frameIndex++) {
        const pose = getPoseAtFrame4(poseLandmarks, frameIndex);
        if (!pose) continue;
        const leftHip = pose.landmarks[LANDMARK_INDICES.LEFT_HIP] ?? null;
        const leftKnee = pose.landmarks[LANDMARK_INDICES.LEFT_KNEE] ?? null;
        const leftAnkle = pose.landmarks[LANDMARK_INDICES.LEFT_ANKLE] ?? null;
        const rightHip = pose.landmarks[LANDMARK_INDICES.RIGHT_HIP] ?? null;
        const rightKnee = pose.landmarks[LANDMARK_INDICES.RIGHT_KNEE] ?? null;
        const rightAnkle = pose.landmarks[LANDMARK_INDICES.RIGHT_ANKLE] ?? null;
        if (!leftHip || !leftKnee || !leftAnkle || !rightHip || !rightKnee || !rightAnkle) {
          continue;
        }
        const avgAngle = getAverageKneeAngle(
          leftHip,
          leftKnee,
          leftAnkle,
          rightHip,
          rightKnee,
          rightAnkle
        );
        const confidence = calculateMinConfidence3([
          leftHip,
          leftKnee,
          leftAnkle,
          rightHip,
          rightKnee,
          rightAnkle
        ]);
        if (avgAngle <= minAngle) {
          minAngle = avgAngle;
          minAngleFrame = frameIndex;
          minAngleConfidence = confidence;
        }
      }
      previousAngle = null;
      for (let frameIndex = minAngleFrame; frameIndex <= frameRange.end; frameIndex++) {
        const pose = getPoseAtFrame4(poseLandmarks, frameIndex);
        if (!pose) continue;
        const leftHip = pose.landmarks[LANDMARK_INDICES.LEFT_HIP] ?? null;
        const leftKnee = pose.landmarks[LANDMARK_INDICES.LEFT_KNEE] ?? null;
        const leftAnkle = pose.landmarks[LANDMARK_INDICES.LEFT_ANKLE] ?? null;
        const rightHip = pose.landmarks[LANDMARK_INDICES.RIGHT_HIP] ?? null;
        const rightKnee = pose.landmarks[LANDMARK_INDICES.RIGHT_KNEE] ?? null;
        const rightAnkle = pose.landmarks[LANDMARK_INDICES.RIGHT_ANKLE] ?? null;
        if (!leftHip || !leftKnee || !leftAnkle || !rightHip || !rightKnee || !rightAnkle) {
          continue;
        }
        const avgAngle = getAverageKneeAngle(
          leftHip,
          leftKnee,
          leftAnkle,
          rightHip,
          rightKnee,
          rightAnkle
        );
        const confidence = calculateMinConfidence3([
          leftHip,
          leftKnee,
          leftAnkle,
          rightHip,
          rightKnee,
          rightAnkle
        ]);
        if (previousAngle !== null) {
          const angleIncrease = avgAngle - previousAngle;
          if (angleIncrease >= EXTENSION_ANGLE_THRESHOLD) {
            extensionStartFrame = frameIndex;
            extensionConfidence = confidence;
            break;
          }
        }
        previousAngle = avgAngle;
      }
      if (extensionStartFrame === null) {
        extensionStartFrame = Math.min(minAngleFrame + 1, frameRange.end);
        extensionConfidence = minAngleConfidence;
      }
      const framesSinceStart = extensionStartFrame - frameRange.start;
      const percentage = framesSinceStart / totalShotDuration * 100;
      const value = {
        value: Math.round(percentage * 10) / 10,
        // Round to 1 decimal
        unit: this.unit,
        frame: extensionStartFrame,
        confidence: extensionConfidence
      };
      return { value };
    }
  };
  function createLowerBodyCalculators() {
    return [
      new HipDropCalculator(),
      new KneeFlexionCalculator(),
      new LegExtensionStartCalculator()
    ];
  }

  // src/metrics/posture.ts
  var CUP_ANGLE_THRESHOLD = 150;
  var HINGE_ANGLE_THRESHOLD = 170;
  function getPoseAtFrame5(poseLandmarks, frameIndex) {
    var _a2;
    const directPose = poseLandmarks.find((p2) => p2.frameIndex === frameIndex);
    if (directPose) return directPose;
    const arrayIndex = frameIndex - (poseLandmarks.length > 0 ? ((_a2 = poseLandmarks[0]) == null ? void 0 : _a2.frameIndex) ?? 0 : 0);
    if (arrayIndex >= 0 && arrayIndex < poseLandmarks.length) {
      return poseLandmarks[arrayIndex];
    }
    return void 0;
  }
  function calculateMinConfidence4(landmarks) {
    if (landmarks.length === 0) return 0;
    return Math.min(...landmarks.map((l2) => l2.visibility));
  }
  function angleBetweenVectors(v1, v2) {
    const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);
    if (mag1 === 0 || mag2 === 0) return 0;
    const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
    return Math.acos(cosAngle) * (180 / Math.PI);
  }
  function calculateAngle2(a2, vertex, c2) {
    const va2 = {
      x: a2.x - vertex.x,
      y: a2.y - vertex.y,
      z: a2.z - vertex.z
    };
    const vc2 = {
      x: c2.x - vertex.x,
      y: c2.y - vertex.y,
      z: c2.z - vertex.z
    };
    return angleBetweenVectors(va2, vc2);
  }
  var BackPostureCalculator = class {
    constructor() {
      __publicField(this, "name", "backPosture");
      __publicField(this, "description", "Spine angle from vertical (degrees, 0 = perfectly upright)");
      __publicField(this, "unit", "degrees");
    }
    calculate(context) {
      const { poseLandmarks, phases } = context;
      let targetPhase = phases["release" /* Release */];
      if (!targetPhase) {
        targetPhase = phases["followThrough" /* FollowThrough */];
      }
      if (!targetPhase) {
        targetPhase = phases["setPoint" /* SetPoint */];
      }
      if (!targetPhase) {
        return {
          error: "Release, FollowThrough, or SetPoint phase not detected"
        };
      }
      const pose = getPoseAtFrame5(poseLandmarks, targetPhase.startFrame);
      if (!pose) {
        return { error: "Pose data missing for target frame" };
      }
      const leftShoulder = pose.landmarks[LANDMARK_INDICES.LEFT_SHOULDER] ?? null;
      const rightShoulder = pose.landmarks[LANDMARK_INDICES.RIGHT_SHOULDER] ?? null;
      const leftHip = pose.landmarks[LANDMARK_INDICES.LEFT_HIP] ?? null;
      const rightHip = pose.landmarks[LANDMARK_INDICES.RIGHT_HIP] ?? null;
      if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) {
        return { error: "Required spine landmarks missing" };
      }
      const midShoulder = {
        x: (leftShoulder.position.x + rightShoulder.position.x) / 2,
        y: (leftShoulder.position.y + rightShoulder.position.y) / 2,
        z: (leftShoulder.position.z + rightShoulder.position.z) / 2
      };
      const midHip = {
        x: (leftHip.position.x + rightHip.position.x) / 2,
        y: (leftHip.position.y + rightHip.position.y) / 2,
        z: (leftHip.position.z + rightHip.position.z) / 2
      };
      const spineVector = {
        x: midShoulder.x - midHip.x,
        y: midShoulder.y - midHip.y,
        z: midShoulder.z - midHip.z
      };
      const verticalVector = {
        x: 0,
        y: -1,
        // Pointing up
        z: 0
      };
      const spineAngle = angleBetweenVectors(spineVector, verticalVector);
      const confidence = calculateMinConfidence4([
        leftShoulder,
        rightShoulder,
        leftHip,
        rightHip
      ]);
      const value = {
        value: Math.round(spineAngle * 10) / 10,
        // Round to 1 decimal
        unit: this.unit,
        frame: targetPhase.startFrame,
        confidence
      };
      return { value };
    }
  };
  var HeadTiltCalculator = class {
    constructor() {
      __publicField(this, "name", "headTilt");
      __publicField(this, "description", "Head angle from neutral (degrees) at release/follow-through");
      __publicField(this, "unit", "degrees");
    }
    calculate(context) {
      const { poseLandmarks, phases } = context;
      let targetPhase = phases["release" /* Release */];
      if (!targetPhase) {
        targetPhase = phases["followThrough" /* FollowThrough */];
      }
      if (!targetPhase) {
        return { error: "Release or FollowThrough phase not detected" };
      }
      const pose = getPoseAtFrame5(poseLandmarks, targetPhase.startFrame);
      if (!pose) {
        return { error: "Pose data missing for target frame" };
      }
      const leftEye = pose.landmarks[LANDMARK_INDICES.LEFT_EYE] ?? null;
      const rightEye = pose.landmarks[LANDMARK_INDICES.RIGHT_EYE] ?? null;
      if (!leftEye || !rightEye) {
        return { error: "Required eye landmarks missing" };
      }
      const deltaY = rightEye.position.y - leftEye.position.y;
      const deltaX = rightEye.position.x - leftEye.position.x;
      const tiltRadians = Math.atan2(deltaY, deltaX);
      const tiltDegrees = tiltRadians * (180 / Math.PI);
      const confidence = calculateMinConfidence4([leftEye, rightEye]);
      const value = {
        value: Math.round(tiltDegrees * 10) / 10,
        // Round to 1 decimal
        unit: this.unit,
        frame: targetPhase.startFrame,
        confidence
      };
      return { value };
    }
  };
  var ShoulderAlignmentCalculator = class {
    constructor() {
      __publicField(this, "name", "shoulderAlignment");
      __publicField(this, "description", "Shoulder rotation relative to target (degrees, 0 = square) at set point");
      __publicField(this, "unit", "degrees");
    }
    calculate(context) {
      const { poseLandmarks, phases } = context;
      let targetPhase = phases["setPoint" /* SetPoint */];
      if (!targetPhase) {
        targetPhase = phases["release" /* Release */];
      }
      if (!targetPhase) {
        return { error: "SetPoint or Release phase not detected" };
      }
      const pose = getPoseAtFrame5(poseLandmarks, targetPhase.startFrame);
      if (!pose) {
        return { error: "Pose data missing for target frame" };
      }
      const leftShoulder = pose.landmarks[LANDMARK_INDICES.LEFT_SHOULDER] ?? null;
      const rightShoulder = pose.landmarks[LANDMARK_INDICES.RIGHT_SHOULDER] ?? null;
      if (!leftShoulder || !rightShoulder) {
        return { error: "Required shoulder landmarks missing" };
      }
      const deltaZ = rightShoulder.position.z - leftShoulder.position.z;
      const shoulderWidth = rightShoulder.position.x - leftShoulder.position.x;
      const rotationRadians = Math.atan2(deltaZ, shoulderWidth);
      const rotationDegrees = rotationRadians * (180 / Math.PI);
      const confidence = calculateMinConfidence4([leftShoulder, rightShoulder]);
      const value = {
        value: Math.round(rotationDegrees * 10) / 10,
        // Round to 1 decimal
        unit: this.unit,
        frame: targetPhase.startFrame,
        confidence
      };
      return { value };
    }
  };
  var HandCupVsHingeCalculator = class {
    constructor() {
      __publicField(this, "name", "handCupVsHinge");
      __publicField(this, "description", "Whether hand cups under or hinges back (categorical) at set point");
      __publicField(this, "unit", "category");
    }
    calculate(context) {
      const { poseLandmarks, phases, config } = context;
      const mapping = getHandednessMapping(config.shootingHand);
      let targetPhase = phases["setPoint" /* SetPoint */];
      if (!targetPhase) {
        targetPhase = phases["release" /* Release */];
      }
      if (!targetPhase) {
        return { error: "SetPoint or Release phase not detected" };
      }
      const pose = getPoseAtFrame5(poseLandmarks, targetPhase.startFrame);
      if (!pose) {
        return { error: "Pose data missing for target frame" };
      }
      const elbow = pose.landmarks[mapping.shootingElbow] ?? null;
      const wrist = pose.landmarks[mapping.shootingWrist] ?? null;
      const fingerIndex = config.shootingHand === "right" ? LANDMARK_INDICES.RIGHT_INDEX : LANDMARK_INDICES.LEFT_INDEX;
      const finger = pose.landmarks[fingerIndex] ?? null;
      if (!elbow || !wrist || !finger) {
        return { error: "Required hand landmarks missing" };
      }
      const wristAngle = calculateAngle2(
        elbow.position,
        wrist.position,
        finger.position
      );
      let category;
      if (wristAngle < CUP_ANGLE_THRESHOLD) {
        category = "cup";
      } else if (wristAngle > HINGE_ANGLE_THRESHOLD) {
        category = "hinge";
      } else {
        category = "neutral";
      }
      const confidence = calculateMinConfidence4([elbow, wrist, finger]);
      const value = {
        value: category,
        unit: this.unit,
        frame: targetPhase.startFrame,
        confidence
      };
      return { value };
    }
  };
  function createPostureCalculators() {
    return [
      new BackPostureCalculator(),
      new HeadTiltCalculator(),
      new ShoulderAlignmentCalculator(),
      new HandCupVsHingeCalculator()
    ];
  }

  // src/metrics/timing.ts
  var BALL_RISE_VELOCITY_THRESHOLD = 0.02;
  var LEG_EXTENSION_VELOCITY_THRESHOLD = 2;
  var SMOOTHING_WINDOW = 2;
  function getPoseAtFrame6(poseLandmarks, frameIndex) {
    var _a2;
    const directPose = poseLandmarks.find((p2) => p2.frameIndex === frameIndex);
    if (directPose) return directPose;
    const arrayIndex = frameIndex - (poseLandmarks.length > 0 ? ((_a2 = poseLandmarks[0]) == null ? void 0 : _a2.frameIndex) ?? 0 : 0);
    if (arrayIndex >= 0 && arrayIndex < poseLandmarks.length) {
      return poseLandmarks[arrayIndex];
    }
    return void 0;
  }
  function calculateMinConfidence5(landmarks) {
    if (landmarks.length === 0) return 0;
    return Math.min(...landmarks.map((l2) => l2.visibility));
  }
  function getAverageKneeAngle2(pose) {
    const leftHip = pose.landmarks[LANDMARK_INDICES.LEFT_HIP];
    const leftKnee = pose.landmarks[LANDMARK_INDICES.LEFT_KNEE];
    const leftAnkle = pose.landmarks[LANDMARK_INDICES.LEFT_ANKLE];
    const rightHip = pose.landmarks[LANDMARK_INDICES.RIGHT_HIP];
    const rightKnee = pose.landmarks[LANDMARK_INDICES.RIGHT_KNEE];
    const rightAnkle = pose.landmarks[LANDMARK_INDICES.RIGHT_ANKLE];
    if (!leftHip || !leftKnee || !leftAnkle || !rightHip || !rightKnee || !rightAnkle) {
      return void 0;
    }
    const leftAngle = calculateAngle(
      leftHip.position,
      leftKnee.position,
      leftAnkle.position
    );
    const rightAngle = calculateAngle(
      rightHip.position,
      rightKnee.position,
      rightAnkle.position
    );
    return (leftAngle + rightAngle) / 2;
  }
  function getAverageWristY(pose) {
    const leftWrist = pose.landmarks[LANDMARK_INDICES.LEFT_WRIST];
    const rightWrist = pose.landmarks[LANDMARK_INDICES.RIGHT_WRIST];
    if (!leftWrist || !rightWrist) {
      return void 0;
    }
    return (leftWrist.position.y + rightWrist.position.y) / 2;
  }
  function getWristConfidence(pose) {
    const leftWrist = pose.landmarks[LANDMARK_INDICES.LEFT_WRIST];
    const rightWrist = pose.landmarks[LANDMARK_INDICES.RIGHT_WRIST];
    if (!leftWrist || !rightWrist) {
      return 0;
    }
    return calculateMinConfidence5([leftWrist, rightWrist]);
  }
  function getLegConfidence(pose) {
    const leftHip = pose.landmarks[LANDMARK_INDICES.LEFT_HIP];
    const leftKnee = pose.landmarks[LANDMARK_INDICES.LEFT_KNEE];
    const leftAnkle = pose.landmarks[LANDMARK_INDICES.LEFT_ANKLE];
    const rightHip = pose.landmarks[LANDMARK_INDICES.RIGHT_HIP];
    const rightKnee = pose.landmarks[LANDMARK_INDICES.RIGHT_KNEE];
    const rightAnkle = pose.landmarks[LANDMARK_INDICES.RIGHT_ANKLE];
    const landmarks = [
      leftHip,
      leftKnee,
      leftAnkle,
      rightHip,
      rightKnee,
      rightAnkle
    ].filter((l2) => l2 !== void 0);
    return calculateMinConfidence5(landmarks);
  }
  function detectBallRiseFrame(poseLandmarks, frameRange) {
    let previousY = null;
    let previousPreviousY = null;
    let minConfidence = 1;
    for (let frameIndex = frameRange.start; frameIndex <= frameRange.end; frameIndex++) {
      const pose = getPoseAtFrame6(poseLandmarks, frameIndex);
      if (!pose) continue;
      const currentY = getAverageWristY(pose);
      if (currentY === void 0) continue;
      const confidence = getWristConfidence(pose);
      if (confidence < minConfidence) {
        minConfidence = confidence;
      }
      if (previousY !== null && previousPreviousY !== null) {
        const avgVelocity = (previousPreviousY - currentY) / SMOOTHING_WINDOW;
        if (avgVelocity >= BALL_RISE_VELOCITY_THRESHOLD) {
          return {
            frame: frameIndex - 1,
            // Rise started on previous frame
            confidence: Math.min(minConfidence, confidence)
          };
        }
      }
      previousPreviousY = previousY;
      previousY = currentY;
    }
    return void 0;
  }
  function detectLegRiseFrame(poseLandmarks, frameRange) {
    let minAngle = 180;
    let minAngleFrame = frameRange.start;
    for (let frameIndex = frameRange.start; frameIndex <= frameRange.end; frameIndex++) {
      const pose2 = getPoseAtFrame6(poseLandmarks, frameIndex);
      if (!pose2) continue;
      const angle = getAverageKneeAngle2(pose2);
      if (angle === void 0) continue;
      if (angle < minAngle) {
        minAngle = angle;
        minAngleFrame = frameIndex;
      }
    }
    let previousAngle = null;
    let previousPreviousAngle = null;
    for (let frameIndex = minAngleFrame; frameIndex <= frameRange.end; frameIndex++) {
      const pose2 = getPoseAtFrame6(poseLandmarks, frameIndex);
      if (!pose2) continue;
      const currentAngle = getAverageKneeAngle2(pose2);
      if (currentAngle === void 0) continue;
      const confidence2 = getLegConfidence(pose2);
      if (previousAngle !== null && previousPreviousAngle !== null) {
        const avgVelocity = (currentAngle - previousPreviousAngle) / SMOOTHING_WINDOW;
        if (avgVelocity >= LEG_EXTENSION_VELOCITY_THRESHOLD) {
          return {
            frame: frameIndex - 1,
            // Extension started on previous frame
            confidence: confidence2
          };
        }
      }
      previousPreviousAngle = previousAngle;
      previousAngle = currentAngle;
    }
    const pose = getPoseAtFrame6(poseLandmarks, minAngleFrame);
    const confidence = pose ? getLegConfidence(pose) : 0.5;
    return {
      frame: Math.min(minAngleFrame + 1, frameRange.end),
      confidence
    };
  }
  var BallRiseStartCalculator = class {
    constructor() {
      __publicField(this, "name", "ballRiseStart");
      __publicField(this, "description", "When ball begins upward motion (% of shot duration)");
      __publicField(this, "unit", "percent");
    }
    calculate(context) {
      const { poseLandmarks, phases, frameRange } = context;
      const risePhase = phases["rise" /* Rise */];
      if (!risePhase) {
        return { error: "Rise phase not detected" };
      }
      if (poseLandmarks.length === 0) {
        return { error: "No pose data available" };
      }
      const totalFrames = frameRange.end - frameRange.start + 1;
      if (totalFrames <= 0) {
        return { error: "Invalid frame range" };
      }
      const ballRise = detectBallRiseFrame(poseLandmarks, frameRange);
      if (!ballRise) {
        const percentage2 = (risePhase.startFrame - frameRange.start) / totalFrames * 100;
        const value2 = {
          value: Math.round(percentage2 * 10) / 10,
          unit: this.unit,
          frame: risePhase.startFrame,
          confidence: 0.5
          // Low confidence since we're falling back
        };
        return { value: value2 };
      }
      const framesSinceStart = ballRise.frame - frameRange.start;
      const percentage = framesSinceStart / totalFrames * 100;
      const value = {
        value: Math.round(percentage * 10) / 10,
        unit: this.unit,
        frame: ballRise.frame,
        confidence: ballRise.confidence
      };
      return { value };
    }
  };
  var LegRiseStartCalculator = class {
    constructor() {
      __publicField(this, "name", "legRiseStart");
      __publicField(this, "description", "When legs begin extending (% of shot duration)");
      __publicField(this, "unit", "percent");
    }
    calculate(context) {
      const { poseLandmarks, phases, frameRange } = context;
      const risePhase = phases["rise" /* Rise */];
      if (!risePhase) {
        return { error: "Rise phase not detected" };
      }
      if (poseLandmarks.length === 0) {
        return { error: "No pose data available" };
      }
      const totalFrames = frameRange.end - frameRange.start + 1;
      if (totalFrames <= 0) {
        return { error: "Invalid frame range" };
      }
      const legRise = detectLegRiseFrame(poseLandmarks, frameRange);
      if (!legRise) {
        const percentage2 = (risePhase.startFrame - frameRange.start) / totalFrames * 100;
        const value2 = {
          value: Math.round(percentage2 * 10) / 10,
          unit: this.unit,
          frame: risePhase.startFrame,
          confidence: 0.5
          // Low confidence since we're falling back
        };
        return { value: value2 };
      }
      const framesSinceStart = legRise.frame - frameRange.start;
      const percentage = framesSinceStart / totalFrames * 100;
      const value = {
        value: Math.round(percentage * 10) / 10,
        unit: this.unit,
        frame: legRise.frame,
        confidence: legRise.confidence
      };
      return { value };
    }
  };
  var BallLegSyncCalculator = class {
    constructor() {
      __publicField(this, "name", "ballLegSync");
      __publicField(this, "description", "Ball-leg sync: difference between ball and leg rise (%, negative = ball first)");
      __publicField(this, "unit", "percent");
    }
    calculate(context) {
      const { poseLandmarks, phases, frameRange } = context;
      const risePhase = phases["rise" /* Rise */];
      if (!risePhase) {
        return { error: "Rise phase not detected" };
      }
      if (poseLandmarks.length === 0) {
        return { error: "No pose data available" };
      }
      const totalFrames = frameRange.end - frameRange.start + 1;
      if (totalFrames <= 0) {
        return { error: "Invalid frame range" };
      }
      const ballRise = detectBallRiseFrame(poseLandmarks, frameRange);
      const legRise = detectLegRiseFrame(poseLandmarks, frameRange);
      const ballFrame = (ballRise == null ? void 0 : ballRise.frame) ?? risePhase.startFrame;
      const legFrame = (legRise == null ? void 0 : legRise.frame) ?? risePhase.startFrame;
      const frameDiff = legFrame - ballFrame;
      const syncPercentage = frameDiff / totalFrames * 100;
      const ballConfidence = (ballRise == null ? void 0 : ballRise.confidence) ?? 0.5;
      const legConfidence = (legRise == null ? void 0 : legRise.confidence) ?? 0.5;
      const avgConfidence = (ballConfidence + legConfidence) / 2;
      const value = {
        value: Math.round(syncPercentage * 10) / 10,
        unit: this.unit,
        frame: Math.min(ballFrame, legFrame),
        confidence: avgConfidence
      };
      return { value };
    }
  };
  var ReleaseStartCalculator = class {
    constructor() {
      __publicField(this, "name", "releaseStart");
      __publicField(this, "description", "When release motion begins (% of shot duration)");
      __publicField(this, "unit", "percent");
    }
    calculate(context) {
      const { poseLandmarks, phases, frameRange } = context;
      const releasePhase = phases["release" /* Release */];
      if (!releasePhase) {
        return { error: "Release phase not detected" };
      }
      const totalFrames = frameRange.end - frameRange.start + 1;
      if (totalFrames <= 0) {
        return { error: "Invalid frame range" };
      }
      const framesSinceStart = releasePhase.startFrame - frameRange.start;
      const percentage = framesSinceStart / totalFrames * 100;
      let confidence = 0.9;
      if (poseLandmarks.length > 0) {
        const pose = getPoseAtFrame6(poseLandmarks, releasePhase.startFrame);
        if (pose) {
          confidence = pose.confidence;
        }
      }
      const value = {
        value: Math.round(percentage * 10) / 10,
        unit: this.unit,
        frame: releasePhase.startFrame,
        confidence
      };
      return { value };
    }
  };
  var TotalShotDurationCalculator = class {
    constructor() {
      __publicField(this, "name", "totalShotDuration");
      __publicField(this, "description", "Full shot duration from gather to follow-through (ms)");
      __publicField(this, "unit", "ms");
    }
    calculate(context) {
      const { poseLandmarks, frameRange } = context;
      if (poseLandmarks.length === 0) {
        return { error: "No pose data available" };
      }
      if (frameRange.end < frameRange.start) {
        return { error: "Invalid frame range" };
      }
      const firstPose = getPoseAtFrame6(poseLandmarks, frameRange.start);
      const lastPose = getPoseAtFrame6(poseLandmarks, frameRange.end);
      if (!firstPose || !lastPose) {
        const frameCount = frameRange.end - frameRange.start + 1;
        const estimatedDuration = frameCount / 30 * 1e3;
        const value2 = {
          value: Math.round(estimatedDuration),
          unit: this.unit,
          frame: frameRange.start,
          confidence: 0.5
          // Low confidence for estimation
        };
        return { value: value2 };
      }
      const durationMs = lastPose.timestamp - firstPose.timestamp;
      const avgConfidence = (firstPose.confidence + lastPose.confidence) / 2;
      const value = {
        value: Math.round(durationMs * 10) / 10,
        unit: this.unit,
        frame: frameRange.start,
        confidence: avgConfidence
      };
      return { value };
    }
  };
  function createTimingCalculators() {
    return Object.freeze([
      new BallRiseStartCalculator(),
      new LegRiseStartCalculator(),
      new BallLegSyncCalculator(),
      new ReleaseStartCalculator(),
      new TotalShotDurationCalculator()
    ]);
  }

  // src/profiles/schemas.ts
  var metricPrioritySchema2 = external_exports.enum(["high", "medium", "low"]);
  var comparisonStatusSchema = external_exports.enum(["pass", "fail", "warning"]);
  var numericRangeSchema2 = external_exports.object({
    min: external_exports.number(),
    max: external_exports.number()
  }).refine((data) => data.min <= data.max, {
    message: "min must be less than or equal to max"
  });
  var metricFeedbackSchema = external_exports.object({
    tooLow: external_exports.string().optional(),
    tooHigh: external_exports.string().optional(),
    incorrect: external_exports.string().optional()
  });
  var metricTargetSchema2 = external_exports.object({
    ideal: external_exports.union([external_exports.number(), external_exports.string()]),
    acceptable: external_exports.union([numericRangeSchema2, external_exports.array(external_exports.string()).readonly()]),
    priority: metricPrioritySchema2,
    feedback: metricFeedbackSchema
  });
  var formProfileSchema2 = external_exports.object({
    name: external_exports.string().min(1, "Profile name cannot be empty"),
    description: external_exports.string(),
    targets: external_exports.record(external_exports.string(), metricTargetSchema2)
  });
  var comparisonSummarySchema = external_exports.object({
    passCount: external_exports.number().int().nonnegative(),
    failCount: external_exports.number().int().nonnegative(),
    warningCount: external_exports.number().int().nonnegative(),
    priorityIssues: external_exports.array(external_exports.string()).readonly()
  });
  var metricComparisonResultSchema = external_exports.object({
    value: external_exports.union([external_exports.number(), external_exports.string()]),
    target: metricTargetSchema2,
    status: comparisonStatusSchema,
    deviation: external_exports.number().optional(),
    feedback: external_exports.string().optional()
  });
  var profileComparisonSchema = external_exports.object({
    profile: external_exports.string().min(1, "Profile name cannot be empty"),
    metrics: external_exports.record(external_exports.string(), metricComparisonResultSchema),
    summary: comparisonSummarySchema
  });
  function validateProfile(profile) {
    return formProfileSchema2.parse(profile);
  }

  // src/profiles/youth.ts
  var youthFundamentalsProfile = {
    name: "youth-fundamentals",
    description: "Fundamentals-focused profile for developing players (ages 8-12). Emphasizes basic mechanics with wider acceptable ranges to encourage good habits without over-correction.",
    targets: {
      // ========== Shooting Arm (Core Fundamentals) ==========
      shootingElbowAngle: {
        ideal: 90,
        acceptable: { min: 70, max: 110 },
        priority: "high",
        feedback: {
          tooLow: "Try to bend your elbow a bit more at the set point. Think of making an 'L' shape with your arm.",
          tooHigh: "Your elbow is very straight. Bend it a little more before you shoot."
        }
      },
      shootingElbowFlare: {
        ideal: 15,
        acceptable: { min: 0, max: 40 },
        priority: "medium",
        feedback: {
          tooLow: "Your elbow is tucked in very close. It's okay to let it come out a little.",
          tooHigh: "Your elbow is sticking out to the side. Try to bring it in a bit closer to your body."
        }
      },
      followThroughHold: {
        ideal: 70,
        acceptable: { min: 40, max: 100 },
        priority: "high",
        feedback: {
          tooLow: "Hold your follow-through longer! Keep your arm up like you're reaching into a cookie jar on a high shelf."
        }
      },
      maxArmExtension: {
        ideal: 160,
        acceptable: { min: 130, max: 180 },
        priority: "medium",
        feedback: {
          tooLow: "Reach up higher when you release the ball. Stretch your arm up to the sky!"
        }
      },
      // ========== Ball Position (Fundamentals) ==========
      setPointHeight: {
        ideal: 0.15,
        acceptable: { min: -0.1, max: 0.4 },
        priority: "high",
        feedback: {
          tooLow: "Bring the ball up higher before you shoot. Start with it near your forehead or above.",
          tooHigh: "The ball is starting very high. That's okay, but make sure you're comfortable."
        }
      },
      releaseAngle: {
        ideal: 52,
        acceptable: { min: 35, max: 70 },
        priority: "medium",
        feedback: {
          tooLow: "Your shot is a bit flat. Try to arc the ball more - think 'rainbow shot'!",
          tooHigh: "You're shooting very high. A little less arc might help your accuracy."
        }
      },
      ballDip: {
        ideal: 0.1,
        acceptable: { min: 0, max: 0.4 },
        priority: "low",
        feedback: {
          tooHigh: "You're dipping the ball down a lot before shooting. Try to bring it up more directly."
        }
      },
      // ========== Guide Hand (Basics) ==========
      guideHandPosition: {
        ideal: "side",
        acceptable: ["side", "under", "thumb-up"],
        priority: "medium",
        feedback: {
          incorrect: "Keep your helper hand on the side of the ball. It guides the ball but doesn't push it."
        }
      },
      guideHandRelease: {
        ideal: 50,
        acceptable: { min: 30, max: 80 },
        priority: "low",
        feedback: {
          tooLow: "Your guide hand is coming off the ball very early. Keep it there a bit longer.",
          tooHigh: "Your guide hand is staying on the ball too long. Let it come off as you release."
        }
      },
      // ========== Lower Body (Foundation) ==========
      kneeFlexion: {
        ideal: 45,
        acceptable: { min: 20, max: 80 },
        priority: "medium",
        feedback: {
          tooLow: "Bend your knees more before you shoot. Get low to get power!",
          tooHigh: "You're bending your knees a lot! That's okay, just make sure you can jump up comfortably."
        }
      },
      // ========== Posture (Basics) ==========
      backPosture: {
        ideal: 8,
        acceptable: { min: 0, max: 25 },
        priority: "low",
        feedback: {
          tooHigh: "Try to stand a bit taller. Lean forward just a little, not too much."
        }
      },
      handCupVsHinge: {
        ideal: "cup",
        acceptable: ["cup", "neutral", "hinge"],
        priority: "low",
        feedback: {
          incorrect: "Try cupping the ball in your hand like you're holding a bowl of soup."
        }
      }
    }
  };

  // src/profiles/high-school.ts
  var highSchoolProfile = {
    name: "high-school",
    description: "Intermediate profile for high school players (ages 13-18). More refined mechanics expectations with emphasis on timing, rhythm, and consistency.",
    targets: {
      // ========== Shooting Arm (Refined Mechanics) ==========
      shootingElbowAngle: {
        ideal: 90,
        acceptable: { min: 80, max: 100 },
        priority: "high",
        feedback: {
          tooLow: "Elbow angle is too acute at set point. Aim for a 90-degree angle to maximize power transfer.",
          tooHigh: "Elbow is too straight at set point. Create more of an L-shape before extending."
        }
      },
      shootingElbowFlare: {
        ideal: 10,
        acceptable: { min: 0, max: 25 },
        priority: "high",
        feedback: {
          tooLow: "Elbow is tucked too tight to the body. Allow some natural separation for comfort.",
          tooHigh: "Elbow is flaring out excessively. Keep it more aligned under the ball for accuracy."
        }
      },
      followThroughHold: {
        ideal: 75,
        acceptable: { min: 50, max: 100 },
        priority: "high",
        feedback: {
          tooLow: "Follow-through is too short. Hold your finish position to ensure complete release."
        }
      },
      maxArmExtension: {
        ideal: 165,
        acceptable: { min: 145, max: 180 },
        priority: "medium",
        feedback: {
          tooLow: "Not reaching full extension on release. Extend your arm completely toward the basket."
        }
      },
      wristSnapAngle: {
        ideal: 60,
        acceptable: { min: 45, max: 75 },
        priority: "medium",
        feedback: {
          tooLow: "Wrist snap is insufficient. Focus on snapping your wrist down at release for better rotation.",
          tooHigh: "Wrist is over-flexing. Moderate the snap to maintain control and consistency."
        }
      },
      // ========== Ball Position (Precision) ==========
      setPointHeight: {
        ideal: 0.15,
        acceptable: { min: 0, max: 0.3 },
        priority: "high",
        feedback: {
          tooLow: "Set point is too low. Bring the ball up to forehead level or higher for a cleaner release window.",
          tooHigh: "Set point is very high. This can work but may affect your timing."
        }
      },
      releaseAngle: {
        ideal: 52,
        acceptable: { min: 42, max: 62 },
        priority: "high",
        feedback: {
          tooLow: "Release angle is too flat. Add more arc to improve your chances of the ball going in.",
          tooHigh: "Release angle is too steep. Slightly lower arc will give you better distance control."
        }
      },
      ballDip: {
        ideal: 0.08,
        acceptable: { min: 0, max: 0.25 },
        priority: "medium",
        feedback: {
          tooHigh: "Excessive ball dip is slowing your shot. Minimize downward motion before rising to set point."
        }
      },
      ballPath: {
        ideal: 0.1,
        acceptable: { min: 0, max: 0.3 },
        priority: "medium",
        feedback: {
          tooHigh: "Ball path to set point has too much lateral movement. Work on a straighter, more direct path."
        }
      },
      // ========== Guide Hand (Proper Technique) ==========
      guideHandPosition: {
        ideal: "side",
        acceptable: ["side", "thumb-up"],
        priority: "medium",
        feedback: {
          incorrect: "Guide hand should be positioned on the side of the ball, not underneath or pushing forward."
        }
      },
      guideHandRelease: {
        ideal: 50,
        acceptable: { min: 40, max: 65 },
        priority: "medium",
        feedback: {
          tooLow: "Guide hand is releasing too early. Keep it on the ball until closer to release point.",
          tooHigh: "Guide hand is staying on too long, potentially interfering with the shot. Release it earlier."
        }
      },
      guideElbowFlare: {
        ideal: 30,
        acceptable: { min: 15, max: 50 },
        priority: "low",
        feedback: {
          tooLow: "Guide arm elbow is too tight. Let it open naturally for better ball support.",
          tooHigh: "Guide arm is flared too wide. Bring it in slightly for better control."
        }
      },
      // ========== Lower Body (Power Foundation) ==========
      kneeFlexion: {
        ideal: 50,
        acceptable: { min: 35, max: 70 },
        priority: "medium",
        feedback: {
          tooLow: "Not enough knee bend in your shot. Load your legs more for better power.",
          tooHigh: "Very deep knee bend. This can slow your shot - find a balance between power and quickness."
        }
      },
      hipDrop: {
        ideal: 0.1,
        acceptable: { min: 0.05, max: 0.2 },
        priority: "low",
        feedback: {
          tooLow: "Minimal hip loading. Slight hip drop helps generate upward power.",
          tooHigh: "Excessive hip drop is slowing your shot. Reduce the squat depth slightly."
        }
      },
      legExtensionStart: {
        ideal: 35,
        acceptable: { min: 25, max: 50 },
        priority: "medium",
        feedback: {
          tooLow: "Legs are extending too early before the ball rises. Time your leg drive with your shot.",
          tooHigh: "Legs are extending late in the shot. Start your leg drive earlier for better power transfer."
        }
      },
      // ========== Posture & Alignment (Body Control) ==========
      backPosture: {
        ideal: 5,
        acceptable: { min: 0, max: 15 },
        priority: "medium",
        feedback: {
          tooHigh: "Leaning forward too much. Stay more upright to maintain balance through your shot."
        }
      },
      shoulderAlignment: {
        ideal: 0,
        acceptable: { min: -10, max: 10 },
        priority: "medium",
        feedback: {
          tooLow: "Shoulders are rotated away from target. Square up to the basket for better accuracy.",
          tooHigh: "Shoulders are over-rotated toward target. Neutral alignment is more consistent."
        }
      },
      handCupVsHinge: {
        ideal: "cup",
        acceptable: ["cup", "neutral"],
        priority: "medium",
        feedback: {
          incorrect: "Work on cupping the ball in your shooting hand rather than hinging at the wrist."
        }
      },
      // ========== Timing & Synchronization (Rhythm) ==========
      ballLegSync: {
        ideal: 5,
        acceptable: { min: -10, max: 15 },
        priority: "high",
        feedback: {
          tooLow: "Ball is rising before your legs extend. Start your leg drive earlier for better synchronization.",
          tooHigh: "Legs are extending well before the ball rises. Delay your leg drive slightly."
        }
      },
      ballRiseStart: {
        ideal: 30,
        acceptable: { min: 20, max: 45 },
        priority: "medium",
        feedback: {
          tooLow: "Ball is rising too early in your shot motion. Let your legs load first.",
          tooHigh: "Ball rise is delayed too long. Start bringing the ball up earlier in your motion."
        }
      },
      releaseStart: {
        ideal: 70,
        acceptable: { min: 60, max: 85 },
        priority: "medium",
        feedback: {
          tooLow: "Release is starting early in your motion. Build more rhythm before releasing.",
          tooHigh: "Release is delayed. Quicken your release timing slightly."
        }
      }
    }
  };

  // src/profiles/pro.ts
  var proFormProfile = {
    name: "pro-form",
    description: "Elite profile for professional and advanced college players. Tight tolerances on all metrics emphasizing precision, consistency, and optimal biomechanics.",
    targets: {
      // ========== Shooting Arm (Elite Precision) ==========
      shootingElbowAngle: {
        ideal: 90,
        acceptable: { min: 85, max: 95 },
        priority: "high",
        feedback: {
          tooLow: "Elbow angle is below optimal range. A tighter 90\xB0 angle maximizes force transfer through the shot line.",
          tooHigh: "Elbow is too extended at set point. Optimal L-shape position creates better backspin and consistency."
        }
      },
      shootingElbowFlare: {
        ideal: 8,
        acceptable: { min: 0, max: 18 },
        priority: "high",
        feedback: {
          tooLow: "Elbow is over-tucked. While alignment is good, slight natural flare improves comfort and repeatability.",
          tooHigh: "Excessive elbow flare reduces shot accuracy. Align elbow under the ball for a straighter shot line."
        }
      },
      followThroughHold: {
        ideal: 80,
        acceptable: { min: 60, max: 100 },
        priority: "high",
        feedback: {
          tooLow: "Abbreviated follow-through indicates incomplete release. Full extension and hold ensures consistent ball flight."
        }
      },
      maxArmExtension: {
        ideal: 170,
        acceptable: { min: 155, max: 180 },
        priority: "high",
        feedback: {
          tooLow: "Incomplete arm extension limits release height and angle. Full extension optimizes release point."
        }
      },
      wristSnapAngle: {
        ideal: 65,
        acceptable: { min: 55, max: 75 },
        priority: "high",
        feedback: {
          tooLow: "Insufficient wrist flexion reduces backspin and soft touch. Increase wrist snap for better rotation.",
          tooHigh: "Over-flexion can cause inconsistent release. Moderate snap maintains control while generating spin."
        }
      },
      // ========== Ball Position (Optimal Mechanics) ==========
      setPointHeight: {
        ideal: 0.12,
        acceptable: { min: 0.05, max: 0.22 },
        priority: "high",
        feedback: {
          tooLow: "Set point is too low, reducing release height and creating longer ball path to target. Elevate set point.",
          tooHigh: "Very high set point may affect rhythm and timing. Find optimal height for your mechanics."
        }
      },
      releaseAngle: {
        ideal: 52,
        acceptable: { min: 45, max: 58 },
        priority: "high",
        feedback: {
          tooLow: "Release angle is flat. Increase arc to optimize entry angle into the basket.",
          tooHigh: "Release angle is too steep. Reduce arc slightly for better distance consistency."
        }
      },
      ballDip: {
        ideal: 0.05,
        acceptable: { min: 0, max: 0.15 },
        priority: "medium",
        feedback: {
          tooHigh: "Ball dip is slowing shot tempo. Minimize pre-shot movement for quicker, more fluid release."
        }
      },
      ballPath: {
        ideal: 0.05,
        acceptable: { min: 0, max: 0.15 },
        priority: "medium",
        feedback: {
          tooHigh: "Lateral ball path deviation affects consistency. Straighter path to set point improves repeatability."
        }
      },
      setPointDuration: {
        ideal: 100,
        acceptable: { min: 50, max: 180 },
        priority: "medium",
        feedback: {
          tooLow: "Brief set point may indicate rushing. Slight pause at set point improves rhythm without slowing shot.",
          tooHigh: "Extended pause at set point slows release. Quicken transition to release phase."
        }
      },
      ballBehindHead: {
        ideal: 0.02,
        acceptable: { min: -0.05, max: 0.1 },
        priority: "low",
        feedback: {
          tooLow: "Ball is positioned too far forward. Slight behind-head position creates better shooting angle.",
          tooHigh: "Ball is drifting too far behind head. This can affect release timing and control."
        }
      },
      // ========== Guide Hand (Perfect Technique) ==========
      guideHandPosition: {
        ideal: "side",
        acceptable: ["side"],
        priority: "high",
        feedback: {
          incorrect: "Guide hand must be positioned on the side of the ball at elite level. Under or thumb-up positions introduce inconsistency."
        }
      },
      guideHandRelease: {
        ideal: 50,
        acceptable: { min: 45, max: 58 },
        priority: "high",
        feedback: {
          tooLow: "Guide hand releasing early may cause loss of control. Maintain contact until optimal release point.",
          tooHigh: "Late guide hand release can interfere with shot path. Separate hands precisely at release."
        }
      },
      guideElbowFlare: {
        ideal: 35,
        acceptable: { min: 25, max: 45 },
        priority: "medium",
        feedback: {
          tooLow: "Guide arm too tight restricts natural ball support. Allow moderate separation.",
          tooHigh: "Excessive guide arm flare can pull shot off-line. Maintain controlled position."
        }
      },
      // ========== Lower Body (Power Optimization) ==========
      kneeFlexion: {
        ideal: 45,
        acceptable: { min: 35, max: 55 },
        priority: "medium",
        feedback: {
          tooLow: "Insufficient knee flexion limits power generation. Increase load for better leg drive.",
          tooHigh: "Deep knee bend slows shot release. Optimal flexion balances power and quickness."
        }
      },
      hipDrop: {
        ideal: 0.1,
        acceptable: { min: 0.05, max: 0.15 },
        priority: "medium",
        feedback: {
          tooLow: "Minimal hip engagement reduces power transfer. Engage hips in the load phase.",
          tooHigh: "Excessive hip drop slows overall motion. Optimize load depth for speed and power."
        }
      },
      legExtensionStart: {
        ideal: 35,
        acceptable: { min: 28, max: 42 },
        priority: "high",
        feedback: {
          tooLow: "Premature leg extension disrupts ball-leg synchronization. Delay leg drive slightly.",
          tooHigh: "Late leg extension causes disconnected motion. Start leg drive earlier for fluid power transfer."
        }
      },
      // ========== Posture & Alignment (Perfect Form) ==========
      backPosture: {
        ideal: 3,
        acceptable: { min: 0, max: 8 },
        priority: "high",
        feedback: {
          tooHigh: "Forward lean exceeds optimal range. Maintain near-vertical spine for consistent balance."
        }
      },
      headTilt: {
        ideal: 0,
        acceptable: { min: -5, max: 5 },
        priority: "medium",
        feedback: {
          tooLow: "Head tilting away from target affects aim. Keep head level and eyes on target.",
          tooHigh: "Excessive head tilt toward target can affect body alignment. Maintain neutral head position."
        }
      },
      shoulderAlignment: {
        ideal: 0,
        acceptable: { min: -5, max: 5 },
        priority: "high",
        feedback: {
          tooLow: "Shoulder rotation away from target reduces accuracy. Square shoulders to basket.",
          tooHigh: "Over-rotation creates inconsistency. Maintain neutral shoulder alignment."
        }
      },
      handCupVsHinge: {
        ideal: "cup",
        acceptable: ["cup"],
        priority: "high",
        feedback: {
          incorrect: "Elite shooting requires consistent cup position for optimal ball control and release. Hinge position introduces variability."
        }
      },
      // ========== Timing & Synchronization (Elite Rhythm) ==========
      ballLegSync: {
        ideal: 3,
        acceptable: { min: -5, max: 10 },
        priority: "high",
        feedback: {
          tooLow: "Ball rising before leg extension indicates disconnected upper/lower body. Synchronize leg drive with ball lift.",
          tooHigh: "Leg extension preceding ball rise wastes power. Time ball lift with leg drive initiation."
        }
      },
      ballRiseStart: {
        ideal: 32,
        acceptable: { min: 25, max: 40 },
        priority: "high",
        feedback: {
          tooLow: "Premature ball rise disrupts loading phase. Allow full lower body load before ball lift.",
          tooHigh: "Delayed ball rise extends shot time. Initiate ball lift earlier for quicker release."
        }
      },
      legRiseStart: {
        ideal: 30,
        acceptable: { min: 22, max: 38 },
        priority: "medium",
        feedback: {
          tooLow: "Early leg extension before ball rises creates timing mismatch. Coordinate with ball movement.",
          tooHigh: "Late leg drive results in arm-dominant shot. Initiate leg extension earlier."
        }
      },
      releaseStart: {
        ideal: 72,
        acceptable: { min: 65, max: 80 },
        priority: "high",
        feedback: {
          tooLow: "Early release point indicates rushed shot. Build full rhythm before release.",
          tooHigh: "Late release extends shot time and reduces effectiveness off the catch. Quicken release timing."
        }
      },
      totalShotDuration: {
        ideal: 550,
        acceptable: { min: 400, max: 700 },
        priority: "medium",
        feedback: {
          tooLow: "Very fast release may sacrifice consistency. Ensure full mechanics within quick release.",
          tooHigh: "Extended shot duration creates defensive opportunities. Work on quickening overall motion."
        }
      }
    }
  };

  // src/profiles/registry.ts
  var ProfileRegistry = class {
    /**
     * Creates a new ProfileRegistry with built-in profiles pre-registered.
     */
    constructor() {
      /** Internal map storing profiles by name */
      __publicField(this, "profiles");
      this.profiles = /* @__PURE__ */ new Map();
      this.profiles.set(youthFundamentalsProfile.name, youthFundamentalsProfile);
      this.profiles.set(highSchoolProfile.name, highSchoolProfile);
      this.profiles.set(proFormProfile.name, proFormProfile);
    }
    /**
     * Registers a profile in the registry.
     *
     * Validates the profile before registration. If a profile with the same name
     * already exists, it will be overridden and a warning will be logged.
     *
     * @param profile - The profile to register
     * @throws {Error} If the profile is invalid (fails Zod validation)
     *
     * @example
     * ```typescript
     * registry.register({
     *   name: "custom-profile",
     *   description: "A custom profile",
     *   targets: {
     *     elbowAngle: {
     *       ideal: 90,
     *       acceptable: { min: 80, max: 100 },
     *       priority: "high",
     *       feedback: { tooLow: "Bend more", tooHigh: "Straighten arm" }
     *     }
     *   }
     * });
     * ```
     */
    register(profile) {
      validateProfile(profile);
      if (this.profiles.has(profile.name)) {
        console.warn(
          `ProfileRegistry: Overriding existing profile "${profile.name}"`
        );
      }
      this.profiles.set(profile.name, profile);
    }
    /**
     * Gets a profile by name.
     *
     * @param name - The profile name to retrieve
     * @returns The profile
     * @throws {Error} If the profile does not exist
     *
     * @example
     * ```typescript
     * const profile = registry.get("youth-fundamentals");
     * console.log(profile.description);
     * ```
     */
    get(name) {
      const profile = this.profiles.get(name);
      if (!profile) {
        const available = this.list().join(", ");
        throw new Error(
          `Profile "${name}" not found. Available profiles: ${available}`
        );
      }
      return profile;
    }
    /**
     * Lists all registered profile names.
     *
     * Returns a sorted array of profile names for consistent ordering.
     *
     * @returns Array of profile names, sorted alphabetically
     *
     * @example
     * ```typescript
     * const names = registry.list();
     * // ["high-school", "pro-form", "youth-fundamentals"]
     * ```
     */
    list() {
      return Array.from(this.profiles.keys()).sort();
    }
    /**
     * Checks if a profile exists in the registry.
     *
     * @param name - The profile name to check
     * @returns true if the profile exists, false otherwise
     *
     * @example
     * ```typescript
     * if (registry.has("custom-profile")) {
     *   const profile = registry.get("custom-profile");
     * }
     * ```
     */
    has(name) {
      return this.profiles.has(name);
    }
  };
  var singletonInstance = null;
  function getProfileRegistry() {
    if (!singletonInstance) {
      singletonInstance = new ProfileRegistry();
    }
    return singletonInstance;
  }

  // src/detection/pose-shot-detector.ts
  var DEFAULT_CONFIG5 = {
    kneeBendThreshold: 15,
    hipDropThreshold: 0.015,
    armExtensionThreshold: -0.15,
    minShotDuration: 15,
    maxShotDuration: 90,
    smoothingWindowSize: 3,
    minPoseConfidence: 0.3,
    confirmationFrames: 3
  };
  function calculateKneeAngle2(hip, knee, ankle) {
    return calculateAngle(hip, knee, ankle);
  }
  function getLandmarkPoint(frame, index) {
    if (frame.landmarks === null) {
      return null;
    }
    const landmark = frame.landmarks[index];
    if (!landmark || landmark.visibility < 0.3) {
      return null;
    }
    return { x: landmark.x, y: landmark.y, z: landmark.z };
  }
  function analyzeFrame(frame) {
    const leftHip = getLandmarkPoint(frame, LANDMARK_INDEX.LEFT_HIP);
    const rightHip = getLandmarkPoint(frame, LANDMARK_INDEX.RIGHT_HIP);
    const leftKnee = getLandmarkPoint(frame, LANDMARK_INDEX.LEFT_KNEE);
    const rightKnee = getLandmarkPoint(frame, LANDMARK_INDEX.RIGHT_KNEE);
    const leftAnkle = getLandmarkPoint(frame, LANDMARK_INDEX.LEFT_ANKLE);
    const rightAnkle = getLandmarkPoint(frame, LANDMARK_INDEX.RIGHT_ANKLE);
    const leftWrist = getLandmarkPoint(frame, LANDMARK_INDEX.LEFT_WRIST);
    const rightWrist = getLandmarkPoint(frame, LANDMARK_INDEX.RIGHT_WRIST);
    const leftShoulder = getLandmarkPoint(frame, LANDMARK_INDEX.LEFT_SHOULDER);
    const rightShoulder = getLandmarkPoint(frame, LANDMARK_INDEX.RIGHT_SHOULDER);
    if (!leftHip || !rightHip || !leftWrist || !rightWrist || !leftShoulder || !rightShoulder) {
      return null;
    }
    let leftKneeAngle = 180;
    let rightKneeAngle = 180;
    if (leftHip && leftKnee && leftAnkle) {
      leftKneeAngle = calculateKneeAngle2(leftHip, leftKnee, leftAnkle);
    }
    if (rightHip && rightKnee && rightAnkle) {
      rightKneeAngle = calculateKneeAngle2(rightHip, rightKnee, rightAnkle);
    }
    const avgKneeAngle = (leftKneeAngle + rightKneeAngle) / 2;
    const hipY = (leftHip.y + rightHip.y) / 2;
    const leftWristY = leftWrist.y;
    const rightWristY = rightWrist.y;
    const avgWristY = (leftWristY + rightWristY) / 2;
    const leftShoulderY = leftShoulder.y;
    const rightShoulderY = rightShoulder.y;
    const avgShoulderY = (leftShoulderY + rightShoulderY) / 2;
    const wristToShoulderDiff = avgWristY - avgShoulderY;
    return {
      frameIndex: frame.frameIndex,
      leftKneeAngle,
      rightKneeAngle,
      avgKneeAngle,
      hipY,
      leftWristY,
      rightWristY,
      avgWristY,
      leftShoulderY,
      rightShoulderY,
      avgShoulderY,
      wristToShoulderDiff,
      confidence: frame.poseConfidence
    };
  }
  function smoothFrameAnalysis(analyses, windowSize) {
    const validAnalyses = analyses.filter((a2) => a2 !== null);
    if (validAnalyses.length === 0 || windowSize <= 1) {
      return validAnalyses;
    }
    const kneeAngles = validAnalyses.map((a2) => a2.avgKneeAngle);
    const hipYs = validAnalyses.map((a2) => a2.hipY);
    const wristYs = validAnalyses.map((a2) => a2.avgWristY);
    const shoulderYs = validAnalyses.map((a2) => a2.avgShoulderY);
    const smoothedKneeAngles = movingAverage(kneeAngles, windowSize);
    const smoothedHipYs = movingAverage(hipYs, windowSize);
    const smoothedWristYs = movingAverage(wristYs, windowSize);
    const smoothedShoulderYs = movingAverage(shoulderYs, windowSize);
    return validAnalyses.map((a2, i2) => ({
      ...a2,
      avgKneeAngle: smoothedKneeAngles[i2],
      hipY: smoothedHipYs[i2],
      avgWristY: smoothedWristYs[i2],
      avgShoulderY: smoothedShoulderYs[i2],
      wristToShoulderDiff: smoothedWristYs[i2] - smoothedShoulderYs[i2]
    }));
  }
  function detectOrientation(poseData) {
    if (poseData.frames.length === 0) {
      return "unknown";
    }
    const startSample = Math.floor(poseData.frames.length * 0.3);
    const endSample = Math.floor(poseData.frames.length * 0.7);
    const sampleSize = Math.min(10, endSample - startSample);
    if (sampleSize < 3) {
      return "unknown";
    }
    let totalShoulderDiffX = 0;
    let totalHipDiffX = 0;
    let totalShoulderZ = 0;
    let validSamples = 0;
    for (let i2 = startSample; i2 < startSample + sampleSize && i2 < poseData.frames.length; i2++) {
      const frame = poseData.frames[i2];
      const landmarks = frame.landmarks;
      if (landmarks === null) {
        continue;
      }
      const leftShoulder = landmarks[LANDMARK_INDEX.LEFT_SHOULDER];
      const rightShoulder = landmarks[LANDMARK_INDEX.RIGHT_SHOULDER];
      const leftHip = landmarks[LANDMARK_INDEX.LEFT_HIP];
      const rightHip = landmarks[LANDMARK_INDEX.RIGHT_HIP];
      if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) {
        continue;
      }
      const minVisibility = 0.3;
      if (leftShoulder.visibility < minVisibility || rightShoulder.visibility < minVisibility || leftHip.visibility < minVisibility || rightHip.visibility < minVisibility) {
        continue;
      }
      totalShoulderDiffX += rightShoulder.x - leftShoulder.x;
      totalHipDiffX += rightHip.x - leftHip.x;
      totalShoulderZ += rightShoulder.z - leftShoulder.z;
      validSamples++;
    }
    if (validSamples < 3) {
      return "unknown";
    }
    const avgShoulderDiffX = totalShoulderDiffX / validSamples;
    const avgHipDiffX = totalHipDiffX / validSamples;
    const avgZDiff = totalShoulderZ / validSamples;
    const frontThreshold = 0.15;
    const sideThreshold = 0.05;
    const shoulderSeparation = Math.abs(avgShoulderDiffX);
    const hipSeparation = Math.abs(avgHipDiffX);
    const avgSeparation = (shoulderSeparation + hipSeparation) / 2;
    if (avgSeparation > frontThreshold) {
      const angleThreshold = 0.05;
      if (avgZDiff > angleThreshold) {
        return "front-left";
      } else if (avgZDiff < -angleThreshold) {
        return "front-right";
      }
      return "front";
    } else if (avgSeparation < sideThreshold) {
      if (avgZDiff > 0) {
        return "side-left";
      } else {
        return "side-right";
      }
    } else {
      if (avgZDiff > 0) {
        return "front-left";
      } else if (avgZDiff < 0) {
        return "front-right";
      }
      return "front";
    }
  }
  function detectShots(poseData, config = {}) {
    const cfg = { ...DEFAULT_CONFIG5, ...config };
    const rawAnalyses = poseData.frames.map(analyzeFrame);
    const analyses = smoothFrameAnalysis(rawAnalyses, cfg.smoothingWindowSize);
    const validAnalyses = analyses.filter((a2) => a2.confidence >= cfg.minPoseConfidence);
    if (validAnalyses.length < cfg.minShotDuration) {
      return {
        shots: [],
        orientation: detectOrientation(poseData)
      };
    }
    const shots = detectShotsFromPeaks(validAnalyses, cfg);
    return {
      shots,
      orientation: detectOrientation(poseData)
    };
  }
  function detectShotsFromPeaks(analyses, config) {
    const shots = [];
    const peaks = findWristPeaks(analyses, config.minShotDuration);
    for (const peakIdx of peaks) {
      const startFrame = findShotStartFromPeak(analyses, peakIdx, config);
      if (startFrame < 0) {
        continue;
      }
      const endFrame = findShotEndFromPeak(analyses, peakIdx, config);
      if (endFrame < 0) {
        continue;
      }
      const duration = endFrame - startFrame;
      if (duration < config.minShotDuration || duration > config.maxShotDuration) {
        continue;
      }
      if (shots.length > 0) {
        const lastShot = shots[shots.length - 1];
        if (startFrame <= lastShot.endFrame) {
          continue;
        }
      }
      const confidence = calculateShotConfidence(analyses, startFrame, endFrame, peakIdx);
      shots.push({
        startFrame,
        endFrame,
        confidence
      });
    }
    return shots;
  }
  function findWristPeaks(analyses, minDistance) {
    const peaks = [];
    if (analyses.length < 3) {
      return peaks;
    }
    let globalMinY = Infinity;
    let globalMinIdx = -1;
    for (let i2 = 0; i2 < analyses.length; i2++) {
      const curr = analyses[i2];
      if (curr.avgWristY < globalMinY && curr.wristToShoulderDiff < 0) {
        globalMinY = curr.avgWristY;
        globalMinIdx = i2;
      }
    }
    if (globalMinIdx >= 0) {
      peaks.push(globalMinIdx);
    }
    const windowSize = Math.max(5, Math.floor(minDistance / 2));
    for (let i2 = windowSize; i2 < analyses.length - windowSize; i2++) {
      const curr = analyses[i2];
      if (curr.wristToShoulderDiff >= 0) {
        continue;
      }
      if (i2 === globalMinIdx) {
        continue;
      }
      let isLocalMin = true;
      for (let j2 = i2 - windowSize; j2 <= i2 + windowSize; j2++) {
        if (j2 !== i2 && analyses[j2].avgWristY < curr.avgWristY - 0.02) {
          isLocalMin = false;
          break;
        }
      }
      if (isLocalMin) {
        const lastPeakFrame = peaks.length > 0 ? analyses[peaks[peaks.length - 1]].frameIndex : -minDistance;
        if (curr.frameIndex - lastPeakFrame >= minDistance) {
          peaks.push(i2);
        }
      }
    }
    peaks.sort((a2, b2) => analyses[a2].frameIndex - analyses[b2].frameIndex);
    return peaks;
  }
  function findShotStartFromPeak(analyses, peakIdx, config) {
    var _a2, _b, _c2;
    const peak = analyses[peakIdx];
    let minKneeAngle = peak.avgKneeAngle;
    let maxHipY = peak.hipY;
    let loadingFrame = peakIdx;
    for (let i2 = peakIdx - 1; i2 >= 0 && peakIdx - i2 < config.maxShotDuration; i2--) {
      const frame = analyses[i2];
      if (frame.avgKneeAngle < minKneeAngle) {
        minKneeAngle = frame.avgKneeAngle;
      }
      if (frame.hipY > maxHipY) {
        maxHipY = frame.hipY;
        loadingFrame = i2;
      }
      const isStanding = frame.avgKneeAngle > peak.avgKneeAngle + config.kneeBendThreshold && frame.hipY < maxHipY - config.hipDropThreshold;
      if (isStanding) {
        return ((_a2 = analyses[i2 + 1]) == null ? void 0 : _a2.frameIndex) ?? frame.frameIndex;
      }
    }
    if (loadingFrame !== peakIdx) {
      return ((_b = analyses[loadingFrame]) == null ? void 0 : _b.frameIndex) ?? analyses[0].frameIndex;
    }
    const searchStart = Math.max(0, peakIdx - config.maxShotDuration);
    return ((_c2 = analyses[searchStart]) == null ? void 0 : _c2.frameIndex) ?? -1;
  }
  function findShotEndFromPeak(analyses, peakIdx, config) {
    var _a2;
    const peak = analyses[peakIdx];
    for (let i2 = peakIdx + 1; i2 < analyses.length && i2 - peakIdx < config.maxShotDuration; i2++) {
      const frame = analyses[i2];
      const wristBelowPeak = frame.avgWristY > peak.avgWristY + 0.1;
      const wristNearShoulder = frame.wristToShoulderDiff > -0.05;
      if (wristBelowPeak && wristNearShoulder) {
        return frame.frameIndex;
      }
    }
    const searchEnd = Math.min(analyses.length - 1, peakIdx + config.maxShotDuration);
    return ((_a2 = analyses[searchEnd]) == null ? void 0 : _a2.frameIndex) ?? -1;
  }
  function calculateShotConfidence(analyses, startFrame, endFrame, peakIdx) {
    const peak = analyses[peakIdx];
    if (!peak) {
      return 0.5;
    }
    const wristElevation = Math.max(0, -peak.wristToShoulderDiff);
    const elevationScore = Math.min(1, wristElevation / 0.2);
    const duration = endFrame - startFrame;
    const durationScore = duration >= 20 && duration <= 60 ? 1 : 0.7;
    const confidenceScore = peak.confidence;
    const confidence = elevationScore * 0.4 + durationScore * 0.3 + confidenceScore * 0.3;
    return Math.round(confidence * 100) / 100;
  }
  function createPoseShotDetector(config = {}) {
    return (poseData) => detectShots(poseData, config);
  }

  // src/analyzer.ts
  function convertToMetricsPoseLandmarks(pose, frameIndex, timestamp) {
    return {
      landmarks: pose.landmarks.map((l2) => ({
        position: { x: l2.x, y: l2.y, z: l2.z },
        visibility: l2.visibility,
        presence: l2.confidence
      })),
      confidence: pose.poseConfidence,
      timestamp,
      frameIndex
    };
  }
  function calculateShotOrientation(poseLandmarks, startFrame, endFrame) {
    const shotLandmarks = poseLandmarks.filter(
      (p2) => p2.frameIndex >= startFrame && p2.frameIndex <= endFrame
    );
    if (shotLandmarks.length < 3) {
      return "unknown";
    }
    const poseData = {
      video: "analysis",
      fps: 30,
      totalFrames: shotLandmarks.length,
      width: 1920,
      height: 1080,
      extractedAt: (/* @__PURE__ */ new Date()).toISOString(),
      frames: shotLandmarks.map((pl) => ({
        frameIndex: pl.frameIndex,
        timestamp: pl.timestamp / 1e3,
        // Convert ms to seconds
        poseConfidence: pl.confidence,
        landmarks: pl.landmarks.map((l2) => ({
          x: l2.position.x,
          y: l2.position.y,
          z: l2.position.z,
          visibility: l2.visibility
        }))
      }))
    };
    try {
      const result = detectOrientation(poseData);
      return result === "unknown" ? "unknown" : result;
    } catch {
      return "unknown";
    }
  }
  var ShotAnalyzerNotInitializedError = class extends Error {
    constructor(method) {
      super(
        `ShotAnalyzer.${method}() called before initialization. Call initialize() or use createShotAnalyzer() factory function.`
      );
      this.name = "ShotAnalyzerNotInitializedError";
    }
  };
  var ShotAnalyzerAlreadyInitializedError = class extends Error {
    constructor() {
      super(
        "ShotAnalyzer is already initialized. Call dispose() first if you need to re-initialize."
      );
      this.name = "ShotAnalyzerAlreadyInitializedError";
    }
  };
  var ShotAnalyzer = class {
    /**
     * Creates a new ShotAnalyzer instance.
     *
     * The analyzer is not ready for use until `initialize()` is called.
     * For a simpler API, use the `createShotAnalyzer()` factory function.
     *
     * @param config - Analysis configuration (validated on construction)
     * @param options - Optional initialization options
     *
     * @throws {z.ZodError} If config validation fails
     *
     * @example
     * ```typescript
     * const analyzer = new ShotAnalyzer(createConfig({
     *   shootingHand: 'right',
     *   profile: 'youth-fundamentals',
     * }));
     * await analyzer.initialize();
     * ```
     */
    constructor(config, options = {}) {
      /** Validated configuration */
      __publicField(this, "config");
      /** Optional initialization options */
      __publicField(this, "options");
      /** Pose detector instance (initialized on initialize()) */
      __publicField(this, "poseDetector", null);
      /** Shot detector instance (created on construction) */
      __publicField(this, "shotDetector");
      /** Metric orchestrator with all calculators registered */
      __publicField(this, "metricOrchestrator");
      /** Profile registry for accessing form profiles */
      __publicField(this, "profileRegistry");
      /** Profile comparison engine for comparing shots to profiles */
      __publicField(this, "comparisonEngine");
      /** Whether the analyzer has been initialized */
      __publicField(this, "initialized", false);
      /** Internal state for live session processing */
      __publicField(this, "liveSessionState", null);
      this.config = validateConfig(config);
      this.options = options;
      this.shotDetector = new ShotDetector(options.shotDetectorConfig);
      this.metricOrchestrator = new MetricOrchestrator([
        ...createShootingArmCalculators(),
        ...createGuideArmCalculators(),
        ...createBallMetricCalculators(),
        ...createLowerBodyCalculators(),
        ...createPostureCalculators(),
        ...createTimingCalculators()
      ]);
      this.profileRegistry = getProfileRegistry();
      this.comparisonEngine = new ProfileComparisonEngine();
      if (this.config.customProfile) {
        this.profileRegistry.register(this.config.customProfile);
      }
    }
    /**
     * Initializes the analyzer by setting up the pose detector.
     *
     * This method must be called before using analysis methods.
     * The pose detector requires async initialization due to model loading.
     *
     * @throws {ShotAnalyzerAlreadyInitializedError} If already initialized
     *
     * @example
     * ```typescript
     * const analyzer = new ShotAnalyzer(config);
     * await analyzer.initialize();
     * // Now ready to use
     * ```
     */
    async initialize() {
      if (this.initialized) {
        throw new ShotAnalyzerAlreadyInitializedError();
      }
      this.poseDetector = await createPoseDetector(
        this.options.poseDetectorConfig
      );
      this.initialized = true;
    }
    /**
     * Releases resources used by the analyzer.
     *
     * Closes the pose detector and resets initialization state.
     * Can be called multiple times safely.
     *
     * @example
     * ```typescript
     * try {
     *   const analyzer = await createShotAnalyzer(config);
     *   // Use analyzer...
     * } finally {
     *   await analyzer.dispose();
     * }
     * ```
     */
    async dispose() {
      if (this.poseDetector) {
        await this.poseDetector.close();
        this.poseDetector = null;
      }
      this.initialized = false;
    }
    /**
     * Returns whether the analyzer has been initialized.
     *
     * @returns true if initialize() has been called and dispose() has not
     */
    isInitialized() {
      return this.initialized;
    }
    /**
     * Returns the configuration used to create the analyzer.
     *
     * @returns The validated analysis configuration
     */
    getConfig() {
      return this.config;
    }
    /**
     * Returns the names of all available form profiles.
     *
     * Includes built-in profiles and any custom profiles that have been registered.
     *
     * @returns Array of profile names, sorted alphabetically
     */
    getProfiles() {
      return this.profileRegistry.list();
    }
    /**
     * Returns the internal pose detector instance.
     *
     * @internal For testing and advanced use cases only
     * @throws {ShotAnalyzerNotInitializedError} If not initialized
     */
    getPoseDetector() {
      if (!this.poseDetector) {
        throw new ShotAnalyzerNotInitializedError("getPoseDetector");
      }
      return this.poseDetector;
    }
    /**
     * Returns the internal shot detector instance.
     *
     * @internal For testing and advanced use cases only
     */
    getShotDetector() {
      return this.shotDetector;
    }
    /**
     * Returns the internal metric orchestrator instance.
     *
     * @internal For testing and advanced use cases only
     */
    getMetricOrchestrator() {
      return this.metricOrchestrator;
    }
    /**
     * Returns the internal profile registry instance.
     *
     * @internal For testing and advanced use cases only
     */
    getProfileRegistry() {
      return this.profileRegistry;
    }
    /**
     * Analyzes a video and returns complete shot analysis results.
     *
     * Processes all frames through pose detection, detects shots and phases,
     * extracts metrics for each shot, and returns a comprehensive AnalysisResult.
     *
     * @param frameProvider - Provider for video frames to analyze
     * @returns Promise resolving to complete analysis results
     *
     * @throws {ShotAnalyzerNotInitializedError} If analyzer is not initialized
     *
     * @example
     * ```typescript
     * const analyzer = await createShotAnalyzer(config);
     * const frameProvider = new VideoFileProvider('shot.mp4');
     *
     * const result = await analyzer.analyzeVideo(frameProvider);
     * console.log(`Detected ${result.shots.length} shots`);
     *
     * for (const shot of result.shots) {
     *   console.log(`Shot ${shot.shotIndex}: ${shot.overallConfidence * 100}% confidence`);
     * }
     * ```
     */
    async analyzeVideo(frameProvider) {
      if (!this.initialized || !this.poseDetector) {
        throw new ShotAnalyzerNotInitializedError("analyzeVideo");
      }
      const metadata = frameProvider.getMetadata();
      const fps = frameProvider.getFps();
      const allPoseLandmarks = [];
      const allMetricsLandmarks = [];
      let totalFrames = 0;
      let frame = await frameProvider.getNextFrame();
      let framesWithPose = 0;
      let framesWithoutPose = 0;
      while (frame !== null) {
        const poseLandmarks = await this.poseDetector.detect(frame);
        if (poseLandmarks) {
          framesWithPose++;
          allPoseLandmarks.push(poseLandmarks);
          const metricsLandmarks = convertToMetricsPoseLandmarks(
            poseLandmarks,
            frame.frameIndex,
            frame.timestamp
          );
          allMetricsLandmarks.push(metricsLandmarks);
        } else {
          framesWithoutPose++;
        }
        totalFrames++;
        if (totalFrames % 30 === 0) {
          console.log(
            `[Analyzer] Processed ${totalFrames} frames, poses detected: ${framesWithPose}`
          );
        }
        frame = await frameProvider.getNextFrame();
      }
      console.log(
        `[Analyzer] Total frames: ${totalFrames}, with pose: ${framesWithPose}, without pose: ${framesWithoutPose}`
      );
      const videoMetadata = {
        width: metadata.width,
        height: metadata.height,
        ...metadata.duration !== void 0 && { duration: metadata.duration },
        fps,
        totalFrames
      };
      return this.analyzePoseSequence(
        allPoseLandmarks,
        allMetricsLandmarks,
        videoMetadata
      );
    }
    /**
     * Runs analysis on an already-extracted pose sequence, skipping MediaPipe
     * pose detection entirely. This is the fast path for the validator/harness:
     * given a `poses.json`-style frame list, it runs shot detection, phase
     * detection and metric extraction and returns the same `AnalysisResult` as
     * {@link analyzeVideo}.
     *
     * Does **not** require {@link initialize} — no pose model is loaded, since
     * the poses are supplied. Frame ordering is by array position (dense pose
     * data, one entry per frame, as `poses.json` provides); each frame's own
     * `frameIndex`/`timestamp` is used for metric timing when present.
     *
     * @param frames - Pre-extracted poses (e.g. `poses.json` `frames`)
     * @param videoMetadata - Video dimensions/fps/frame count for the clip
     * @returns Analysis result with per-shot phases and metrics
     */
    analyzePoses(frames, videoMetadata) {
      const fps = videoMetadata.fps || 30;
      const allPoseLandmarks = [];
      const allMetricsLandmarks = [];
      frames.forEach((frame, i2) => {
        const hasPose = frame != null && Array.isArray(frame.landmarks) && frame.landmarks.length > 0;
        const pose = hasPose ? {
          landmarks: frame.landmarks,
          poseConfidence: frame.poseConfidence ?? 0
        } : createEmptyPoseLandmarks();
        allPoseLandmarks.push(pose);
        const frameIndex = (frame == null ? void 0 : frame.frameIndex) ?? i2;
        const timestamp = (frame == null ? void 0 : frame.timestamp) ?? i2 / fps * 1e3;
        allMetricsLandmarks.push(
          convertToMetricsPoseLandmarks(pose, frameIndex, timestamp)
        );
      });
      return this.analyzePoseSequence(
        allPoseLandmarks,
        allMetricsLandmarks,
        videoMetadata
      );
    }
    /**
     * Shared post-extraction pipeline: shot boundary + phase detection, then
     * metric extraction and orientation per shot. Used by both
     * {@link analyzeVideo} (poses from MediaPipe) and {@link analyzePoses}
     * (poses supplied directly).
     */
    analyzePoseSequence(allPoseLandmarks, allMetricsLandmarks, videoMetadata) {
      if (allPoseLandmarks.length < 2) {
        return {
          shots: [],
          videoMetadata,
          config: this.config
        };
      }
      this.shotDetector.reset();
      console.log(
        `[Analyzer] Running shot detection on ${allPoseLandmarks.length} pose frames...`
      );
      const detectedShots = this.shotDetector.processFrames([
        ...allPoseLandmarks
      ]);
      console.log(
        `[Analyzer] Shot detection complete, found ${detectedShots.length} shots`
      );
      const shotAnalyses = [];
      for (const shot of detectedShots) {
        const shotLandmarks = allMetricsLandmarks.slice(
          shot.frameRange.start,
          shot.frameRange.end + 1
        );
        const analysis = this.metricOrchestrator.analyzeShot(
          shot.shotIndex,
          shotLandmarks,
          shot.frameRange,
          shot.phases,
          this.config
        );
        const orientation = calculateShotOrientation(
          allMetricsLandmarks,
          shot.frameRange.start,
          shot.frameRange.end
        );
        shotAnalyses.push({
          ...analysis,
          orientation
        });
      }
      return {
        shots: shotAnalyses,
        videoMetadata,
        config: this.config
      };
    }
    // =========================================================================
    // Live Session Support Methods
    // =========================================================================
    /**
     * Processes a single video frame for live/incremental analysis.
     *
     * This method enables real-time analysis by processing frames one at a time.
     * Internal state is maintained between calls to track shot progress and
     * accumulate metrics. Use `finalizeLiveSession()` to get the complete
     * analysis result when done.
     *
     * @param frame - The video frame to process
     * @returns Promise resolving to the frame analysis with current state
     *
     * @throws {ShotAnalyzerNotInitializedError} If analyzer is not initialized
     *
     * @example
     * ```typescript
     * const analyzer = await createShotAnalyzer(config);
     *
     * // Process frames as they arrive from camera
     * for await (const frame of cameraStream) {
     *   const analysis = await analyzer.processFrame(frame);
     *   if (analysis.currentPhase) {
     *     console.log(`Current phase: ${analysis.currentPhase}`);
     *   }
     * }
     *
     * // Get final results when done
     * const result = await analyzer.finalizeLiveSession();
     * ```
     */
    async processFrame(frame) {
      if (!this.initialized || !this.poseDetector) {
        throw new ShotAnalyzerNotInitializedError("processFrame");
      }
      if (!this.liveSessionState) {
        this.liveSessionState = {
          poseLandmarks: [],
          metricsLandmarks: [],
          frameWidth: frame.width,
          frameHeight: frame.height,
          lastTimestamp: 0,
          totalFrames: 0
        };
      }
      const poseLandmarks = await this.poseDetector.detect(frame);
      this.liveSessionState.lastTimestamp = frame.timestamp;
      this.liveSessionState.totalFrames++;
      let landmarks;
      let currentPhase;
      const partialMetrics = {};
      if (poseLandmarks) {
        this.liveSessionState.poseLandmarks.push(poseLandmarks);
        const metricsLandmarks = convertToMetricsPoseLandmarks(
          poseLandmarks,
          frame.frameIndex,
          frame.timestamp
        );
        this.liveSessionState.metricsLandmarks.push(metricsLandmarks);
        landmarks = metricsLandmarks;
        if (this.liveSessionState.poseLandmarks.length >= 2) {
          const tempShots = this.shotDetector.processFrames(
            this.liveSessionState.poseLandmarks
          );
          if (tempShots.length > 0) {
            const lastShot = tempShots[tempShots.length - 1];
            if (lastShot && frame.frameIndex <= lastShot.frameRange.end) {
              for (const [phaseName, phaseRange] of Object.entries(
                lastShot.phases
              )) {
                if (phaseRange && frame.frameIndex >= phaseRange.startFrame && frame.frameIndex <= phaseRange.endFrame) {
                  currentPhase = phaseName;
                  break;
                }
              }
            }
          }
        }
      }
      const result = {
        frameIndex: frame.frameIndex,
        timestamp: frame.timestamp,
        partialMetrics
      };
      if (landmarks !== void 0) {
        result.landmarks = landmarks;
      }
      if (currentPhase !== void 0) {
        result.currentPhase = currentPhase;
      }
      return result;
    }
    /**
     * Finalizes a live session and returns the complete analysis result.
     *
     * This method completes any partial shot analysis in progress, extracts
     * metrics for all detected shots, and resets the internal state for a
     * new session.
     *
     * @returns Promise resolving to the complete analysis result
     *
     * @throws {ShotAnalyzerNotInitializedError} If analyzer is not initialized
     *
     * @example
     * ```typescript
     * const analyzer = await createShotAnalyzer(config);
     *
     * // Process frames...
     * await analyzer.processFrame(frame1);
     * await analyzer.processFrame(frame2);
     *
     * // Get complete analysis
     * const result = await analyzer.finalizeLiveSession();
     * console.log(`Detected ${result.shots.length} shots`);
     * ```
     */
    async finalizeLiveSession() {
      if (!this.initialized || !this.poseDetector) {
        throw new ShotAnalyzerNotInitializedError("finalizeLiveSession");
      }
      if (!this.liveSessionState) {
        return {
          shots: [],
          videoMetadata: {
            width: 0,
            height: 0,
            fps: 30,
            // Default fps when no frames
            totalFrames: 0
          },
          config: this.config
        };
      }
      const state = this.liveSessionState;
      const videoMetadata = {
        width: state.frameWidth,
        height: state.frameHeight,
        duration: state.lastTimestamp,
        fps: state.totalFrames > 1 ? state.totalFrames / (state.lastTimestamp / 1e3) : 30,
        totalFrames: state.totalFrames
      };
      this.liveSessionState = null;
      if (state.poseLandmarks.length < 2) {
        return {
          shots: [],
          videoMetadata,
          config: this.config
        };
      }
      this.shotDetector.reset();
      const detectedShots = this.shotDetector.processFrames(state.poseLandmarks);
      const shotAnalyses = [];
      for (const shot of detectedShots) {
        const shotLandmarks = state.metricsLandmarks.slice(
          shot.frameRange.start,
          shot.frameRange.end + 1
        );
        const analysis = this.metricOrchestrator.analyzeShot(
          shot.shotIndex,
          shotLandmarks,
          shot.frameRange,
          shot.phases,
          this.config
        );
        const orientation = calculateShotOrientation(
          state.metricsLandmarks,
          shot.frameRange.start,
          shot.frameRange.end
        );
        shotAnalyses.push({
          ...analysis,
          orientation
        });
      }
      return {
        shots: shotAnalyses,
        videoMetadata,
        config: this.config
      };
    }
    /**
     * Compares analysis results against a form profile.
     *
     * Returns a ProfileComparison for each shot in the analysis result,
     * comparing the shot's metrics against the specified profile's targets.
     *
     * @param result - The analysis result to compare
     * @param profileName - Name of the profile to compare against (defaults to config profile)
     * @returns Array of ProfileComparison, one for each shot
     *
     * @throws {Error} If the specified profile is not found
     *
     * @example
     * ```typescript
     * const result = await analyzer.analyzeVideo(provider);
     * const comparisons = analyzer.compareToProfile(result);
     *
     * for (const comparison of comparisons) {
     *   console.log(`Shot compared to ${comparison.profile}`);
     *   console.log(`  Pass: ${comparison.summary.passCount}`);
     *   console.log(`  Fail: ${comparison.summary.failCount}`);
     * }
     * ```
     */
    compareToProfile(result, profileName) {
      const targetProfile = profileName ?? this.config.profile;
      const profile = this.profileRegistry.get(targetProfile);
      return result.shots.map(
        (shot) => this.comparisonEngine.compareToProfile(shot, profile)
      );
    }
    /**
     * Registers a custom form profile for use in comparisons.
     *
     * This is a passthrough to the profile registry. The profile will be
     * available for use with `compareToProfile()` immediately after registration.
     *
     * @param profile - The form profile to register
     *
     * @throws {Error} If the profile is invalid (fails validation)
     *
     * @example
     * ```typescript
     * analyzer.registerProfile({
     *   name: "my-custom-profile",
     *   description: "Optimized for tall players",
     *   targets: {
     *     releaseAngle: {
     *       ideal: 55,
     *       acceptable: { min: 50, max: 60 },
     *       priority: "high",
     *       feedback: { tooLow: "Release higher", tooHigh: "Lower your release" }
     *     }
     *   }
     * });
     *
     * const comparisons = analyzer.compareToProfile(result, "my-custom-profile");
     * ```
     */
    registerProfile(profile) {
      this.profileRegistry.register(profile);
    }
  };
  async function createShotAnalyzer(config, options = {}) {
    const analyzer = new ShotAnalyzer(config, options);
    await analyzer.initialize();
    return analyzer;
  }

  // src/profiles/index.ts
  var builtInProfiles = {
    "youth-fundamentals": youthFundamentalsProfile,
    "high-school": highSchoolProfile,
    "pro-form": proFormProfile
  };
  var allBuiltInProfiles = [
    youthFundamentalsProfile,
    highSchoolProfile,
    proFormProfile
  ];
  function getBuiltInProfile(name) {
    return builtInProfiles[name];
  }
  return __toCommonJS(browser_entry_exports);
})();
//# sourceMappingURL=shot-analysis.browser.js.map
