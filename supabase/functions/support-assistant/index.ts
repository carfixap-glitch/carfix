import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limit.ts";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
function serverKey(){const raw=Deno.env.get("SUPABASE_SECRET_KEYS");if(raw){try{const p=JSON.parse(raw);if(p?.default)return p.default as string}catch{}}return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??""}
function textFromResponse(payload:any){return payload?.candidates?.[0]?.content?.parts?.map((x:any)=>typeof x?.text==="string"?x.text:"").join("")??""}

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return reply({error:"Method not allowed"},405);
 try{
  const auth=req.headers.get("Authorization");if(!auth)return reply({error:"Please sign in again."},401);
  const url=Deno.env.get("SUPABASE_URL")??"",anon=Deno.env.get("SUPABASE_ANON_KEY")??"",admin=serverKey(),gemini=Deno.env.get("GEMINI_API_KEY")??"";
  if(!url||!anon||!admin||!gemini)return reply({error:"Support assistant is not configured."},500);
  const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});
  const {data:{user},error:userError}=await userClient.auth.getUser();if(userError||!user)return reply({error:"Please sign in again."},401);
  const db=createClient(url,admin);
  const rate=await checkRateLimit(db,user.id,"support_assistant",20,3600);if(!rate.allowed)return reply({error:"Too many support requests. Please try again later."},429);
  const body=await req.json().catch(()=>({}));const message=typeof body?.message==="string"?body.message.trim():"";const category=typeof body?.category==="string"?body.category:"assessment_issue";
  if(!message||message.length>2000)return reply({error:"Enter a support question up to 2000 characters."},400);

  const sensitive=/\b(refund|chargeback|charged twice|unauthori[sz]ed|fraud|lawyer|legal action|complaint|grievance)\b|delete\s+(my\s+)?(account|data)|erase\s+(my\s+)?data|privacy\s+(request|complaint)|account\s+(locked|hacked|compromised)|change\s+(my\s+)?(assessment|result)|wrong\s+assessment|payment\s+(failed|missing|not showing)|money\s+(back|deducted)/i.test(message);
  if(sensitive)return reply({action:"escalate",reason:"This request needs review by a CarFix support agent."});

  const prompt=`You are the CarFix Assistant. Answer the customer's SIMPLE INFORMATIONAL support question using only these approved facts.
- CarFix provides AI-generated preliminary assessments for visible exterior car body damage, dents, scratches and painting.
- It is not a physical inspection, workshop quote, insurance assessment, engineering assessment or guarantee.
- Hidden/internal, mechanical, electrical, structural, ADAS, tyre/wheel, glass and interior issues are outside scope unless expressly stated.
- Repair cost is approximate and varies by location, workshop, vehicle, parts and repair method.
- The first eligible assessment is free. Later assessments are currently ₹199 each.
- Customers receive support replies inside their CarFix account.
- Never promise or approve a refund, payment change, data deletion, account/security action, assessment modification, compensation, or legal outcome.
- Never invent account, assessment, payment or ticket status.
Answer general how-it-works, scope, pricing, report availability, and support-process questions normally.
If the question requires account-specific investigation or an agent decision/action, output exactly ESCALATE.
Otherwise answer clearly and concisely in no more than 120 words. Do not ask for payment credentials.
Customer category: ${category}
Customer question: ${message}`;
  const response=await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",{method:"POST",headers:{"x-goog-api-key":gemini,"Content-Type":"application/json"},body:JSON.stringify({contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{maxOutputTokens:500,temperature:0.2}})});
  if(!response.ok){const errorText=await response.text();let errorBody:any={};try{errorBody=JSON.parse(errorText)}catch{}const apiError=errorBody?.error??{};console.error("Support Gemini failed",{status:response.status,errorStatus:apiError?.status??null,errorCode:apiError?.code??null,errorMessage:typeof apiError?.message==="string"?apiError.message.slice(0,500):null,retryAfter:response.headers.get("retry-after")});return reply({action:"escalate",reason:"CarFix Assistant is temporarily unavailable. An agent can assist you."});}
  const payload=await response.json();const answer=textFromResponse(payload).trim();
  if(!answer){console.error("Support Gemini returned no output",{finishReason:payload?.candidates?.[0]?.finishReason??null,promptBlockReason:payload?.promptFeedback?.blockReason??null});return reply({action:"escalate",reason:"CarFix Assistant is temporarily unavailable. An agent can assist you."});}
  if(answer==="ESCALATE"||answer.includes("ESCALATE"))return reply({action:"escalate",reason:"This request needs review by a CarFix support agent."});
  return reply({action:"answer",answer});
 }catch(e){console.error("Support assistant failed",{message:e instanceof Error?e.message:"unknown"});return reply({action:"escalate",reason:"CarFix Assistant is temporarily unavailable. An agent can assist you."});}
});