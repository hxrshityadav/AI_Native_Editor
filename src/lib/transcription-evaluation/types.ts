export type Language = "hi" | "en" | "other";
export type WordAnnotation = {
  text:string; punctuation?:string; language:Language; start?:number; end?:number;
  isProperNoun?:boolean; isTechnicalTerm?:boolean; isCodeSwitchBoundary?:boolean;
  entityId?:string; termId?:string;
};
export type Recording = {
  id:string; speakerId:string; audio:{path:string;sha256:string}; duration:number;
  split:"train"|"development"|"test"; conditions:{environment:string;accent?:string;speed:"slow"|"normal"|"fast"|"unknown";noise:string};
  provenance:{kind:"natural"|"synthetic";permission:"consented"|"public-license"|"synthetic";source:string;license?:string};
  reference:{text:string;words:WordAnnotation[];review:{status:"draft"|"reviewed";reviewer?:string;reviewedAt?:string;timingReviewed:boolean}};
};
export type Dataset = {schemaVersion:1;id:string;version:string;kind:"natural"|"synthetic";recordings:Recording[]};
export type NormalizationProfile = "strict"|"roman-hinglish"|"english"|"hindi-roman"|"punctuation-insensitive";
export type Edit = {operation:"correct"|"substitution"|"deletion"|"insertion";referenceIndex:number|null;hypothesisIndex:number|null;reference:string|null;hypothesis:string|null;anchor:number};
export type Counts = {substitutions:number;deletions:number;insertions:number;referenceWords:number;hypothesisWords:number;wer:number|null};
export type PredictionWord = {text:string;start?:number|null;end?:number|null};
export type AlignmentOutput = {method:"native-word"|"native-phrase"|"forced";transcript:string;words?:PredictionWord[];phrases?:PredictionWord[];provenance?:string};
export type Prediction = {
  text:string;rawText:string;audioDuration:number;words:PredictionWord[];phrases:PredictionWord[];
  inferenceSeconds:number|null;elapsedSeconds:number;peakMemoryBytes:number|null;alignment?:AlignmentOutput;
};
export type TimingMetrics = {
  coverage:number|null;missingOrInvalid:number|null;referenceTimedWords:number;validAlignedWords:number;
  startErrors:number[];endErrors:number[];mae:number|null;median:number|null;p90:number|null;phraseCoverage:number|null;
  boundaryErrors:{referenceIndex:number;hypothesisIndex:number;startError:number;endError:number}[];
  invalidWords:number;ambiguousWords:number;overlaps:number;gaps:number;method:string;reason:string|null;
};
export type VocabularyMetric = {evaluated:number;correct:number;accuracy:number|null;items:{id:string;referenceIndices:number[];correct:boolean}[]};
export type Score = {
  overall:Counts;edits:Edit[];cer:{rate:number|null;errors:number;referenceCharacters:number};
  languages:Record<Language,Counts>|null;
  boundaries:{all:Counts;hiToEn:Counts;enToHi:Counts;transitions:{at:number;direction:string;indices:number[]}[]};
  properNouns:VocabularyMetric;technicalTerms:VocabularyMetric;timing:TimingMetrics;
  sentences:{evaluated:number;correct:number;accuracy:number|null};
};
export type ModelSpec = {id:"tiny"|"base"|"hinglish-swift";name:string;repository:string;revision:string;precision:string;downloadBytes:number|null;downloadSizeNote:string;licenseReview:"pending"|"reviewed"};
export type BenchmarkConfig = {language:"hi"|"en"|"auto";profile:NormalizationProfile;boundaryWindow:number;preprocessing:"production-readPcm-16k-mono-v1";pipelineVersion:string;vocabulary?:string[][]};
export type RunResult = {
  cacheKey:string;recordingId:string;model:ModelSpec;status:"completed"|"failed"|"cancelled";cached:boolean;
  prediction?:Prediction;strict?:Score;normalized?:Score;error?:string;errorCode?:string;
};
export type BenchmarkReport = {schemaVersion:1;scorerVersion:string;evidence:"model-run"|"algorithm-fixture"|"legacy-import";id:string;createdAt:string;dataset:Dataset;config:BenchmarkConfig;results:RunResult[]};
