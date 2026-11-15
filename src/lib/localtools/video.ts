import { ALL_FORMATS, BlobSource, CanvasSource, Conversion, Input, Mp4OutputFormat, Output, StreamTarget, WebMOutputFormat, canEncodeAudio, canEncodeVideo } from "mediabunny";
import { inspectMedia } from "../mediatools/engine";
import { BoundedVideoBytes } from "../videos/bounded-target";
import { imageHeader, validateDimensions, validateImageFile } from "../images/policy";

const outputTarget = () => { const bytes = new BoundedVideoBytes(128 * 1048576); return { bytes, target: new StreamTarget(new WritableStream({ write: chunk => bytes.write(chunk.data, chunk.position) }), { chunked: true, chunkSize: 1048576 }) }; };
/** Replace a soundtrack while copying the picture. Source media is never changed. */
export async function replaceSoundtrack(file: Blob, soundtrack: Blob, progress: (fraction: number) => void) {
  const info = await inspectMedia(file, "video");
  if (info.duration > 120) throw new Error("Use a video up to 2 minutes for local soundtrack replacement.");
  const webm = info.mime === "video/webm", codec = webm ? "opus" : "aac";
  if (!await canEncodeAudio(codec, { numberOfChannels: 2, sampleRate: 48000 })) throw new Error(`This browser cannot encode ${codec.toUpperCase()} audio. Try another supported desktop browser.`);
  const videoInput = new Input({ source: new BlobSource(file), formats: ALL_FORMATS }), audioInput = new Input({ source: new BlobSource(soundtrack), formats: ALL_FORMATS });
  const { bytes, target } = outputTarget(), output = new Output({ format: webm ? new WebMOutputFormat() : new Mp4OutputFormat({ fastStart: false }), target });
  try {
    const conversion = await Conversion.init({ input: videoInput, output, composable: true, tracks: "primary", trim:{start:0,end:info.duration}, audio: { discard: true }, copy: { mode: "forced" }, showWarnings: false });
    if (!conversion.utilizedTracks.some(track => track.type === "video")) throw new Error("This picture codec cannot be copied into the output. Convert the video to MP4 first.");
    const audioConversion=await Conversion.init({input:audioInput,output,composable:true,tracks:"primary",video:{discard:true},audio:{codec,sampleRate:48000,numberOfChannels:2,forceTranscode:true},showWarnings:false});
    if(!audioConversion.utilizedTracks.some(track=>track.type==="audio"))throw new Error("The generated soundtrack could not be encoded. Try another output browser.");
    await output.start();
    conversion.onProgress = progress;
    await Promise.all([conversion.execute(),audioConversion.execute()]);
    await output.finalize();
    const blob = bytes.blob(webm ? "video/webm" : "video/mp4"), actual = await inspectMedia(blob, "video");
    if (!actual.audio || actual.video?.codec !== info.video?.codec || Math.abs(actual.duration-info.duration) > 0.25) throw new Error("The output did not preserve the picture, soundtrack or duration. No download was created.");
    return { blob, extension: webm ? "webm" : "mp4" };
  } finally { await output.cancel().catch(() => {}); videoInput.dispose(); audioInput.dispose(); bytes.clear(); }
}

export type StoryOptions = { text?: string; image?: File; duration: number; shape: "portrait" | "landscape" | "square"; motion: "zoom-in" | "zoom-out" | "still"; audio?: Blob };
export async function makeStory(options: StoryOptions, progress: (fraction: number) => void) {
  const { duration, shape } = options;
  if (!Number.isFinite(duration) || duration < 2 || duration > 60 || !["portrait","landscape","square"].includes(shape) || !["zoom-in","zoom-out","still"].includes(options.motion)) throw new Error("Choose a duration from 2–60 seconds and a supported shape/motion.");
  if ((!options.text?.trim() && !options.image) || (options.text?.length ?? 0) > 2000) throw new Error("Add an image or up to 2,000 characters of text.");
  const [width,height] = shape === "portrait" ? [720,1280] : shape === "square" ? [720,720] : [1280,720];
  if (!await canEncodeVideo("avc", { width,height,frameRate:24 }) || options.audio && !await canEncodeAudio("aac")) throw new Error("This browser cannot encode the requested MP4. Try desktop Chrome or Edge.");
  let image: ImageBitmap | undefined;
  if (options.image) { validateImageFile(options.image); const header = imageHeader(new Uint8Array(await options.image.slice(0,1048576).arrayBuffer())); validateDimensions(header.width,header.height); image = await createImageBitmap(options.image,{imageOrientation:"from-image"}); validateDimensions(image.width,image.height); }
  const { bytes,target } = outputTarget(), output = new Output({ format: new Mp4OutputFormat({fastStart:false}),target });
  const canvas = new OffscreenCanvas(width,height), context = canvas.getContext("2d")!;
  const input = options.audio ? new Input({source:new BlobSource(options.audio),formats:ALL_FORMATS}) : undefined;
  try {
    const video = new CanvasSource(canvas,{codec:"avc",bitrate:2000000}); output.addVideoTrack(video,{frameRate:24});
    const audioConversion=input?await Conversion.init({input,output,composable:true,tracks:"primary",video:{discard:true},audio:{codec:"aac",sampleRate:48000,numberOfChannels:2,forceTranscode:true},trim:{start:0,end:duration},showWarnings:false}):undefined;
    if(audioConversion&&!audioConversion.utilizedTracks.some(track=>track.type==="audio"))throw new Error("The narration could not be encoded as AAC. Try another browser.");
    await output.start();
    const words = options.text?.trim().split(/\s+/) ?? [], pages = Array.from({length:Math.ceil(words.length/12)},(_,i)=>words.slice(i*12,(i+1)*12).join(" "));
    let frame = 0; const frames = Math.ceil(duration*24);
    async function drawFrame() {
      const fraction = frame/Math.max(1,frames-1); context.fillStyle="#101418";context.fillRect(0,0,width,height);
      if(image) { const zoom = options.motion === "still" ? 1 : 1 + 0.15*(options.motion === "zoom-in" ? fraction : 1-fraction), scale = Math.max(width/image.width,height/image.height)*zoom, w=image.width*scale,h=image.height*scale; context.drawImage(image,(width-w)/2,(height-h)/2,w,h); }
      const page = pages[Math.min(pages.length-1,Math.floor(fraction*pages.length))];
      if(page) { context.fillStyle="rgba(0,0,0,0.65)";context.fillRect(0,height*.3,width,height*.4);context.font=`600 ${Math.round(width*.05)}px sans-serif`;context.textAlign="center";context.fillStyle="#ffffff"; const lines:string[]=[];let line="";for(const word of page.split(" ")){ const next=line?`${line} ${word}`:word;if(context.measureText(next).width>width*.82&&line){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);lines.forEach((value,i)=>context.fillText(value,width/2,height*.5+(i-(lines.length-1)/2)*width*.07,width*.9)); }
      await video.add(frame/24,Math.min(1/24,duration-frame/24));frame++;if(frame%12===0)progress(frame/frames);
    }
    await Promise.all([audioConversion?.execute(),(async()=>{while(frame<frames)await drawFrame();video.close();})()]);await output.finalize();
    const blob=bytes.blob("video/mp4"), actual=await inspectMedia(blob,"video");if(actual.video?.width!==width||actual.video.height!==height||Math.abs(actual.duration-duration)>.2||!!actual.audio!==!!options.audio)throw new Error("The video failed output validation. Try another browser.");
    return {blob,extension:"mp4"};
  } finally { image?.close();input?.dispose();await output.cancel().catch(()=>{});bytes.clear();canvas.width=canvas.height=1; }
}
