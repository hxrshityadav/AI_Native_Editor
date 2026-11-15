/* eslint-disable @next/next/no-img-element -- Local blob preview; no server image processing. */
"use client";
import { useState } from "react";
import { runLocal } from "@/lib/localtools/client";
import { runSpeech, type SpeechAudio } from "@/lib/localtools/speechClient";
import { useBlobUrl } from "../tools/useBlobUrl";
import { ControlGroup, InlineMessage, PrimaryButton, ProcessingPanel, Stage, styles } from "../tools/surface/ToolSurface";
import { useLocalJob } from "./useLocalJob";
import type { LocalResult } from "@/lib/localtools/local.worker";
import type { StoryOptions } from "@/lib/localtools/video";
export function StoryMaker({imageMode}:{imageMode:boolean}){
  const [text,setText]=useState(""),[image,setImage]=useState<File>(),[duration,setDuration]=useState(5),[shape,setShape]=useState<StoryOptions["shape"]>("portrait"),[motion,setMotion]=useState<StoryOptions["motion"]>("zoom-in"),[narrate,setNarrate]=useState(false),[consent,setConsent]=useState(false),[inputError,setInputError]=useState("");
  const job=useLocalJob<LocalResult>(),preview=useBlobUrl(image),output=useBlobUrl(job.result?.blob),title=imageMode?"Image to Video":"Text to Video";
  function changed(){job.reset();setInputError("");}
  async function create(){if(imageMode&&!image){setInputError("Choose a photo first.");return;}if(!imageMode&&!text.trim()){setInputError("Enter the words for your video first.");return;}
    await job.run(async(signal,status,progress)=>{let audio:Blob|undefined,seconds=duration;if(narrate){const speech=await runSpeech<SpeechAudio>({kind:"synthesize",text},signal,status);audio=speech.blob;seconds=Math.max(2,speech.duration);}return runLocal({kind:"story",options:{...(imageMode?{image}:{}),text,duration:seconds,shape,motion,audio}},signal,status,progress);});}
  return <section aria-label={`${title} workspace`} className={styles.root}><div className={styles.surface}>
    <div className={styles.stage}><Stage busy={!!job.busy} processing={<ProcessingPanel title="Rendering local video" status={job.busy} detail={`${job.elapsed.toFixed(1)} seconds elapsed`} progress={job.progress} onCancel={job.cancel}/>}>{output?<video aria-label="Generated video" controls src={output} className="max-h-[32rem] w-full"/>:preview?<img alt="Selected photo" src={preview} className="max-h-[32rem] w-full object-contain"/>:<p className="p-8 text-center text-subtle">Your rendered MP4 preview will appear here.</p>}</Stage></div>
    <div className={styles.side}><div className={styles.sideBody}>
      <InlineMessage tone="info">{imageMode?"Creates a zoom animation from your photo. It does not generate new scenes or simulate subject movement.":"Creates caption cards from your script, with optional locally generated English narration. It does not generate footage from a prompt."}</InlineMessage>
      {imageMode&&<label className={styles.group}><span className={styles.label}>Photo (JPEG, PNG or WebP)</span><input aria-label="Choose photo" type="file" accept="image/jpeg,image/png,image/webp" disabled={!!job.busy} onChange={event=>{const file=event.target.files?.[0];changed();setImage(file);event.target.value="";}}/></label>}
      <label className={styles.group}><span className={styles.label}>{imageMode?"Caption / narration (optional)":"Script"}</span><textarea aria-label="Video script" rows={5} maxLength={narrate?500:2000} className={styles.field} value={text} disabled={!!job.busy} onChange={event=>{changed();setText(event.target.value);}}/></label>
      <ControlGroup label="Video shape"><select aria-label="Video shape" className={styles.field} value={shape} disabled={!!job.busy} onChange={event=>{changed();setShape(event.target.value as typeof shape);}}><option value="portrait">Portrait 720 × 1280</option><option value="landscape">Landscape 1280 × 720</option><option value="square">Square 720 × 720</option></select></ControlGroup>
      {!narrate&&<label className={styles.group}>Duration (seconds)<input aria-label="Video duration" className={styles.field} type="number" min={2} max={60} value={duration} disabled={!!job.busy} onChange={event=>{changed();setDuration(Number(event.target.value));}}/></label>}
      {imageMode&&<label className={styles.group}>Photo motion<select aria-label="Photo motion" className={styles.field} value={motion} disabled={!!job.busy} onChange={event=>{changed();setMotion(event.target.value as typeof motion);}}><option value="zoom-in">Slow zoom in</option><option value="zoom-out">Slow zoom out</option><option value="still">Still photo</option></select></label>}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={narrate} disabled={!!job.busy} onChange={event=>{changed();setNarrate(event.target.checked);setConsent(false);}}/>Generate English narration locally</label>
      {narrate&&<><p className={styles.help}>SpeechT5 downloads optional model assets (about 370 MiB, plus runtime/config files) and runs on this device. English only, up to 500 characters and 60 seconds. Narration sets the video duration. No account or voice cloning.</p><label className="flex items-center gap-2 text-sm"><input aria-label="Allow speech model download" type="checkbox" checked={consent} disabled={!!job.busy} onChange={event=>setConsent(event.target.checked)}/>Allow the local speech-model download</label></>}
      {(job.error||inputError)&&<InlineMessage role="alert" tone="error">{job.error||inputError}</InlineMessage>}{job.notice&&<InlineMessage role="status">{job.notice}</InlineMessage>}{job.result&&<p role="status">Measured MP4: {(job.result.blob.size/1000000).toFixed(2)} MB.</p>}
    </div><div className={styles.sideFoot}><PrimaryButton label="Create video" busyLabel="Rendering video" busy={!!job.busy} disabled={narrate&&(!consent||!text.trim())} onClick={()=>void create()}/>{output&&<a className={styles.primary} href={output} download={imageMode?"photo-animation.mp4":"script-video.mp4"}>Download video</a>}</div></div>
  </div></section>;
}
