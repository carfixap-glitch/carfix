import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limit.ts";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
function serverKey(){const raw=Deno.env.get("SUPABASE_SECRET_KEYS");if(raw){try{const p=JSON.parse(raw);if(p?.default)return p.default as string}catch{}}return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??""}
function textFromResponse(payload:any){return payload?.output?.flatMap((x:any)=>x.content??[]).find((x:any)=>x.type==="output_text")?.text??""}

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return reply({error:"Method not allowed"},405);
 try{
  const auth=req.headers.get("Authorization");if(!auth)return reply({error:"Please sign in again."},401);
  const url=Deno.env.get("SUPABASE_URL")??"",anon=Deno.env.get("SUPABASE_ANON_KEY")??"",admin=serverKey(),openai=Deno.env.get("OPENAI_API_KEY")??"";
  if(!url||!anon||!admin||!openai)return reply({error:"Support assistant is not configured."},500);
  const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});
  const {data:{user},error:userError}=await userClient.auth.getUser();if(userError||!user)return reply({error:"Please sign in again."},401);
  const db=createClient(url,admin);
  const rate=await checkRateLimit(db,user.id,"support_assistant",20,3600);if(!rate.allowed)return reply({error:"Too many support requests. Please try again later."},429);
  const body=await req.json().catch(()=>({}));const message=typeof body?.message==="string"?body.message.trim():"";const category=typeof body?.category==="string"?body.category:"other_grievance";
  if(!message||message.length>2000)return reply({error:"Enter a support question up to 2000 characters."},400);

  const sensitive=/refund|chargeback|charged|payment failed|money|delete (my|account|data)|erase|privacy request|grievance|complaint|legal|lawyer|fraud|unauthori[sz]ed|account (locked|hacked)|change (assessment|result)|wrong assessment/i.test(message);
  if(sensitive||["payment_issue","privacy_data_request","other_grievance"].includes(category)){
   return reply({action:"escalate",reason:"This request needs review by CarFix Support."});
  }

  const prompt=`You are the CarFix Support Assistant. Answer ONLY simple informational questions using these approved facts:
- CarFix provides AI-generated preliminary assessments for visible exterior car body damage, dents, scratches and painting.
- It is not a physical inspection, workshop quote, insurance assessment, engineering assessment or guarantee.
- Hidden/internal, mechanical, electrical, structural, ADAS, tyre/wheel, glass and interior issues are outside scope unless expressly stated.
- Repair cost is approximate and varies by location, workshop, vehicle, parts and repair method.
- The first eligible assessment is free. Later assessments are currently ₹199 each.
- Customers receive support replies inside their CarFix account.
- Never promise or approve a refund, payment change, data deletion, account/security action, assessment modification, compensation, or legal outcome.
- Never invent account, assessment, payment or ticket status.
If the question needs account-specific investigation, a human decision, a refund/payment action, privacy/data deletion, grievance handling, or is outside these facts, output exactly ESCALATE.
Otherwise give a concise helpful answer, maximum 120 words. Do not ask for sensitive payment credentials.
Customer category: ${category}
Customer question: ${message}`;
  const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${openai}`,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-5.6-luna",input:prompt,max_output_tokens:220})});
  if(!response.ok){console.error("Support OpenAI failed",{status:response.status,requestId:response.headers.get("x-request-id")});return reply({action:"escalate",reason:"The assistant could not safely answer this request."});}
  const payload=await response.json();const answer=textFromResponse(payload).trim();
  if(!answer||answer==="ESCALATE"||answer.includes("ESCALATE"))return reply({action:"escalate",reason:"This request needs review by CarFix Support."});
  return reply({action:"answer",answer});
 }catch(e){console.error("Support assistant failed",{message:e instanceof Error?e.message:"unknown"});return reply({action:"escalate",reason:"The assistant could not safely answer this request."});}
});