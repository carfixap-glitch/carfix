import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});

function serverKey(){const s=Deno.env.get("SUPABASE_SECRET_KEYS");if(s){try{const p=JSON.parse(s);if(p?.default)return p.default as string;}catch{}}return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";}

async function hmacHex(secret:string,message:string){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);const sig=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(message));return Array.from(new Uint8Array(sig)).map(b=>b.toString(16).padStart(2,"0")).join("");}

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 try{
  const auth=req.headers.get("Authorization"); if(!auth) throw Error("Missing authorization");
  const userClient=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:auth}}});
  const {data:{user},error:ue}=await userClient.auth.getUser(); if(ue||!user) throw Error("Unauthorized");
  const body=await req.json(); const {assessment_id,razorpay_order_id,razorpay_payment_id,razorpay_signature}=body;
  if(!assessment_id||!razorpay_order_id||!razorpay_payment_id||!razorpay_signature) throw Error("Payment verification fields are required");
  const sk=serverKey(); if(!sk) throw Error("Supabase server key is not configured");
  const db=createClient(Deno.env.get("SUPABASE_URL")!,sk);
  const {data:a,error:ae}=await db.from("assessments").select("id,payment_required,payment_status,payment_amount").eq("id",assessment_id).eq("user_id",user.id).single();
  if(ae||!a) throw Error("Assessment not found");
  if(!a.payment_required) return reply({success:true,payment_status:"free"});
  if(a.payment_status==="paid") return reply({success:true,payment_status:"paid"});
  const {data:p,error:pe}=await db.from("payments").select("id,order_id,amount,status").eq("assessment_id",assessment_id).eq("user_id",user.id).eq("order_id",razorpay_order_id).maybeSingle();
  if(pe||!p) throw Error("Payment order not found");
  if(p.status==="paid") return reply({success:true,payment_status:"paid"});
  if(Number(p.amount)!==Number(a.payment_amount)) throw Error("Payment amount mismatch");
  const secret=Deno.env.get("RAZORPAY_KEY_SECRET"); if(!secret) throw Error("Razorpay credentials are not configured");
  const expected=await hmacHex(secret,razorpay_order_id+"|"+razorpay_payment_id); if(expected!==razorpay_signature) throw Error("Invalid Razorpay payment signature");
  const now=new Date().toISOString();
  const {error:upe}=await db.from("payments").update({status:"paid",payment_id:razorpay_payment_id,signature:razorpay_signature,paid_at:now,updated_at:now}).eq("id",p.id).eq("user_id",user.id);
  if(upe) throw Error("Could not update payment: "+upe.message);
  const {error:uae}=await db.from("assessments").update({payment_status:"paid",updated_at:now}).eq("id",assessment_id).eq("user_id",user.id);
  if(uae) throw Error("Could not unlock assessment: "+uae.message);
  return reply({success:true,payment_status:"paid"});
 }catch(e){return reply({error:e instanceof Error?e.message:"Payment verification failed"},200);}
});