import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});

async function callOpenAI(key:string, body:unknown){
  const maxAttempts=3;
  for(let attempt=0;attempt<maxAttempts;attempt++){
    const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify(body)});
    const t=await r.text();
    if(r.ok) return {r,t};
    if(r.status!==429 || attempt===maxAttempts-1){
      let d=t; try{d=JSON.parse(t)?.error?.message||t;}catch{}
      throw new Error(`AI provider error: ${d}`);
    }
    const retryAfter=r.headers.get("Retry-After");
    const parsed=retryAfter?Number(retryAfter):NaN;
    const base=Number.isFinite(parsed)&&parsed>=0?parsed*1000:1000*Math.pow(2,attempt);
    const jitter=Math.floor(Math.random()*500);
    await new Promise(resolve=>setTimeout(resolve,Math.min(base+jitter,15000)));
  }
  throw new Error("AI provider error: retries exhausted");
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  try{
    const auth=req.headers.get("Authorization"); if(!auth) throw Error("Missing authorization");
    const supabase=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:auth}}});
    const {data:{user},error:ue}=await supabase.auth.getUser(); if(ue||!user) throw Error("Unauthorized");
    const {assessment_id}=await req.json(); if(!assessment_id) throw Error("assessment_id is required");
    const {data:a,error:ae}=await supabase.from("assessments").select("id,city,vehicle_id,vehicles(make,model,year)").eq("id",assessment_id).eq("user_id",user.id).single();
    if(ae||!a) throw Error("Assessment not found");
    const {data:photos,error:pe}=await supabase.from("assessment_photos").select("storage_path").eq("assessment_id",assessment_id);
    if(pe) throw Error(pe.message); if(!photos?.length) throw Error("No assessment photos found");
    const images:any[]=[];
    for(const p of photos.slice(0,10)){const {data:s,error:e}=await supabase.storage.from("carfix-damage-photos").createSignedUrl(p.storage_path,600);if(!e&&s?.signedUrl) images.push({type:"input_image",image_url:s.signedUrl});}
    if(!images.length) throw Error("Could not access uploaded photos");
    const key=Deno.env.get("OPENAI_API_KEY"); if(!key) throw Error("OPENAI_API_KEY is not configured");
    const v=Array.isArray(a.vehicles)?a.vehicles[0]:a.vehicles;
    const prompt=`
You are CarFix Body Repair & Painting AI.
IMPORTANT SCOPE: This assessment is ONLY for EXTERIOR CAR BODY REPAIR AND PAINTING.
Analyze uploaded vehicle photos strictly for visible exterior body damage a body/paint workshop would handle.
INCLUDE: dents, panel deformation, creases, scratches, scuffs, paint damage, chips, peeling, transfer, clear-coat damage, repairable/repaintable exterior plastic, bumper, fender, door skin, bonnet/hood, boot/tailgate, quarter-panel, roof, side panels, rocker/side-sill exterior, visible exterior rust, blending, repainting, and body-panel repair vs replacement.
DO NOT ASSESS OR PRICE mechanical, electrical, ADAS, tyres/wheels, glass, interior, or hidden damage. If non-body issues are visible, state they are outside scope and do not include them in cost.
For each visible body area identify panel, visible damage, severity (minor/moderate/major/unknown), likely repair/paint approach, painting requirement, approximate Indian-market body repair/painting cost, and assumptions.
Do not double-count the same damage across photos. Give a range and explain uncertainty. Return ONLY valid JSON with exactly:
{"damage_description":"...","severity":"minor | moderate | major | unknown","damaged_parts":["Panel — damage — approach"],"recommendations":["..."],"repair_or_replacement":[{"part":"...","action":"dent repair | scratch repair | plastic repair | repaint | paint blend | panel replacement | no repair needed","painting_required":true,"estimated_cost_min":0,"estimated_cost_max":0}],"estimated_min_cost":0,"estimated_max_cost":0,"estimated_time_min_hours":0,"estimated_time_max_hours":0,"notes":"..."}
Vehicle: Make: ${v?.make||"unknown"} Model: ${v?.model||"unknown"} Year: ${v?.year||"unknown"} City: ${a.city||"unknown"}
`;
    const {t}=await callOpenAI(key,{model:"gpt-5.6-luna",input:[{role:"user",content:[{type:"input_text",text:prompt},...images]}],text:{format:{type:"json_object"}}});
    let out:any; try{out=JSON.parse(t);}catch{throw Error("AI returned invalid response");}
    const raw=out.output?.flatMap((x:any)=>x.content||[]).find((x:any)=>x.type==="output_text")?.text;
    if(!raw) throw Error("AI returned no analysis");
    let an:any; try{an=JSON.parse(raw);}catch{throw Error("AI returned invalid JSON analysis");}
    const severity=["minor","moderate","major","unknown"].includes(an.severity)?an.severity:"unknown";
    const damagedParts=Array.isArray(an.damaged_parts)?an.damaged_parts:[]; const recommendations=Array.isArray(an.recommendations)?an.recommendations:[]; const repairOrReplacement=Array.isArray(an.repair_or_replacement)?an.repair_or_replacement:[];
    const {error:de}=await supabase.from("damage_analysis").delete().eq("assessment_id",assessment_id); if(de) throw Error(de.message);
    const {error:re}=await supabase.from("repair_estimates").delete().eq("assessment_id",assessment_id); if(re) throw Error(re.message);
    const {error:di}=await supabase.from("damage_analysis").insert({assessment_id,damage_description:String(an.damage_description||"No visible exterior body damage could be determined."),severity,damaged_parts:damagedParts,recommendations,repair_or_replacement:repairOrReplacement}); if(di) throw Error(`Could not save analysis: ${di.message}`);
    const {error:ei}=await supabase.from("repair_estimates").insert({assessment_id,estimated_min_cost:Number(an.estimated_min_cost)||0,estimated_max_cost:Number(an.estimated_max_cost)||0,estimated_time_min:Number(an.estimated_time_min_hours)||0,estimated_time_max:Number(an.estimated_time_max_hours)||0,notes:String(an.notes||"Preliminary visual estimate for exterior body repair and painting only; physical inspection may change the result.")}); if(ei) throw Error(`Could not save estimate: ${ei.message}`);
    const {error:ui}=await supabase.from("assessments").update({status:"completed",updated_at:new Date().toISOString()}).eq("id",assessment_id).eq("user_id",user.id); if(ui) throw Error(ui.message);
    return reply({success:true,scope:"car_body_repair_and_painting_only",analysis:an});
  }catch(e){return reply({error:e instanceof Error?e.message:"Analysis failed"},200);}
});
